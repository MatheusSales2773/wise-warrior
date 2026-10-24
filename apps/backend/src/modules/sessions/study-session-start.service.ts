import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import { UsersService } from '../users/users.service';
import { RaidsService } from '../raids/raids.service';
import { StudySessionTransitionService } from './study-session-transition.service';
import type { ExpiredCompletion, StudySessionTransitionResult } from './study-session-transition.service';
import { StudySessionEventsService } from './study-session-events.service';
import { StudySession } from './entities/study-session.entity';
import type { StartSessionDto } from './dto/start-session.dto';
import { freeFocusCeilingSeconds } from './domain/study-session-time';
import { isStudySessionPreset } from './domain/study-session-presets';
import { isValidIdempotencyKey } from './domain/idempotency-key';
import { InvalidStudySessionSubjectError, normalizeStudySessionSubject } from './domain/study-session-subject';
import { rejectIfStudySessionCommandKeyUsed } from './study-session-command-keys';
import { deserializeStudySessionSnapshot, studySessionSnapshot } from './study-session-snapshot';
import type { StudySessionSnapshot } from './study-session-snapshot';

type ReceiptRow = {
  planned_duration_seconds: number | null;
  subject: string | null;
  response_json: StudySessionSnapshot | string;
};

@Injectable()
export class StudySessionStartService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly users: UsersService,
    private readonly raids: RaidsService,
    private readonly transitions: StudySessionTransitionService,
    private readonly events: StudySessionEventsService,
  ) {}

  /**
   * The active Study Session, or, once, the result of the expired running focus that this read completed
   * (ADR-011 item 6), so the reading device shows it.
   */
  async active(userId: string): Promise<StudySessionSnapshot | StudySessionTransitionResult | null> {
    const completed = await this.transitions.completeExpired(userId);
    if (completed) return completed;
    const session = await this.dataSource.getRepository(StudySession).findOne({
      where: { userId, state: In(['running', 'paused']) },
    });
    return session ? studySessionSnapshot(session, new Date()) : null;
  }

  async start(userId: string, authSessionId: string, dto: StartSessionDto, idempotencyKey: string | undefined): Promise<StudySessionSnapshot> {
    if (dto === null || typeof dto !== 'object' || Array.isArray(dto)) {
      throw new BadRequestException('O corpo da solicitação deve ser um objeto');
    }
    const kind = dto.kind ?? 'cycle';
    if (kind !== 'cycle' && kind !== 'free') throw new BadRequestException('Tipo de Study Session inválido');
    let plannedDurationSeconds: number | null = null;
    if (kind === 'free') {
      if (dto.plannedDurationSeconds !== undefined) {
        throw new BadRequestException('plannedDurationSeconds não é aceito no Foco livre');
      }
    } else {
      plannedDurationSeconds = dto.plannedDurationSeconds === undefined ? 1500 : dto.plannedDurationSeconds;
      if (!isStudySessionPreset(plannedDurationSeconds)) {
        throw new BadRequestException('Duração de foco inválida');
      }
    }
    const subject = this.normalizeSubject(dto.subject);
    const mode = dto.mode ?? 'solo';
    const raidId = dto.raidId ?? null;
    if (mode === 'guild' && raidId === null) throw new BadRequestException('raidId é obrigatório no modo guild');
    if (mode === 'solo' && raidId !== null) throw new BadRequestException('raidId só é aceito no modo guild');
    if (!isValidIdempotencyKey(idempotencyKey)) {
      throw new BadRequestException('Idempotency-Key é obrigatório e deve conter de 1 a 128 caracteres ASCII visíveis');
    }

    // Assigned inside the transaction callback; the cast keeps TypeScript from narrowing it to null.
    let expiredCompletion = null as ExpiredCompletion | null;
    const started = await this.dataSource.transaction(async (manager) => {
      // Lock the stable user row so first starts also serialize, before an active row exists.
      if (!await this.users.lockForUpdate(userId, manager)) throw new BadRequestException('Usuário inválido');

      const receipts = await manager.query(
        'SELECT planned_duration_seconds, subject, response_json FROM study_session_start_receipts WHERE user_id = ? AND idempotency_key = ?',
        [userId, idempotencyKey],
      ) as ReceiptRow[];
      const receipt = receipts[0];
      if (receipt) {
        const replayed = deserializeStudySessionSnapshot(receipt.response_json);
        if (
          (receipt.planned_duration_seconds === null ? null : Number(receipt.planned_duration_seconds)) !== plannedDurationSeconds
          || replayed.kind !== kind
          || receipt.subject !== subject
          || replayed.mode !== mode
          || replayed.raidId !== raidId
        ) {
          throw new ConflictException({
            type: 'https://wise.app/errors/idempotency-key-reused',
            message: 'Idempotency-Key já foi usada com outra duração, Matéria, modo ou tipo',
          });
        }
        return { snapshot: replayed, applied: false };
      }

      await rejectIfStudySessionCommandKeyUsed(manager, userId, idempotencyKey);
      expiredCompletion = await this.transitions.completeExpiredInTransaction(manager, userId);

      const active = await manager.getRepository(StudySession).findOne({
        where: { userId, state: In(['running', 'paused']) },
      });
      if (active) throw new ConflictException({
        type: 'https://wise.app/errors/study-session-active',
        message: 'Já existe uma Study Session ativa nesta conta',
      });

      const now = new Date();
      if (raidId !== null) await this.raids.assertCanStartGuildSession(manager, userId, raidId, now);
      // O teto do Foco livre é o que sobra do limite contínuo e do saldo diário; sem saldo a sessão não começa.
      let runDeadlineAt: Date;
      if (kind === 'free') {
        const priorDailySeconds = await this.transitions.sumEligibleFocusSecondsToday(manager, userId, null, now);
        const ceilingSeconds = freeFocusCeilingSeconds(priorDailySeconds);
        if (ceilingSeconds <= 0) throw new ConflictException({
          type: 'https://wise.app/errors/daily-limit-reached',
          message: 'O limite diário de foco já foi atingido',
        });
        runDeadlineAt = new Date(now.getTime() + ceilingSeconds * 1000);
      } else {
        runDeadlineAt = new Date(now.getTime() + plannedDurationSeconds! * 1000);
      }
      const studySession = manager.getRepository(StudySession).create({
        userId,
        subject,
        kind,
        mode,
        raidId,
        startedAt: now,
        lastHeartbeatAt: now,
        plannedDurationSeconds,
        state: 'running',
        runDeadlineAt,
        pausedAt: null,
        pausedTotalSeconds: 0,
        version: 1,
        pauseCount: 0,
        terminalReason: null,
        initiatingSessionId: authSessionId,
        durationValidSeconds: 0,
        xpAwarded: 0,
        discardedReason: null,
      });
      const saved = await manager.getRepository(StudySession).save(studySession);
      const snapshot = studySessionSnapshot(saved, now);
      await manager.query('INSERT INTO active_study_sessions (user_id, study_session_id) VALUES (?, ?)', [userId, saved.id]);
      await manager.query(
        'INSERT INTO study_session_command_keys (user_id, idempotency_key, command_kind) VALUES (?, ?, ?)',
        [userId, idempotencyKey, 'start'],
      );
      await manager.query(
        'INSERT INTO study_session_start_receipts (user_id, idempotency_key, planned_duration_seconds, subject, initiating_session_id, response_json) VALUES (?, ?, ?, ?, ?, ?)',
        [userId, idempotencyKey, plannedDurationSeconds, subject, authSessionId, JSON.stringify(snapshot)],
      );
      return { snapshot, applied: true };
    });
    // A focus the server completed at its deadline goes first, then the session that took its slot.
    expiredCompletion?.publish();
    if (started.applied) this.events.publishChanged(userId, started.snapshot);
    return started.snapshot;
  }

  private normalizeSubject(value: unknown): string | null {
    try {
      return normalizeStudySessionSubject(value);
    } catch (error) {
      if (error instanceof InvalidStudySessionSubjectError) throw new BadRequestException(error.message);
      throw error;
    }
  }
}
