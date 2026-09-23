import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import { UsersService } from '../users/users.service';
import { StudySession } from './entities/study-session.entity';
import type { StudySessionState, StudySessionTerminalReason } from './entities/study-session.entity';
import type { StartSessionDto } from './dto/start-session.dto';
import { isStudySessionPreset } from './domain/study-session-presets';
import { getStudySessionTime } from './domain/study-session-time';
import { isValidIdempotencyKey } from './domain/idempotency-key';
import { rejectIfStudySessionCommandKeyUsed } from './study-session-command-keys';

export type StudySessionSnapshot = {
  id: string;
  mode: 'solo' | 'guild';
  subject: string | null;
  state: StudySessionState;
  plannedDurationSeconds: number;
  startedAt: Date;
  runDeadlineAt: Date | null;
  pausedAt: Date | null;
  pausedTotalSeconds: number;
  durationValidSeconds: number;
  remainingSeconds: number;
  serverNow: Date;
  version: number;
  endedAt: Date | null;
  xpAwarded: number;
  terminalReason: StudySessionTerminalReason | null;
  discardedReason: string | null;
  canControl: boolean;
};

type ReceiptRow = {
  planned_duration_seconds: number;
  initiating_session_id: string;
  response_json: StudySessionSnapshot | string;
};

export function studySessionSnapshot(session: StudySession, authSessionId: string, now: Date): StudySessionSnapshot {
  const deadline = session.runDeadlineAt ?? null;
  const state = session.state ?? 'running';
  const time = getStudySessionTime({ ...session, state }, now);
  return {
    id: session.id,
    mode: session.mode,
    subject: session.subject,
    state,
    plannedDurationSeconds: session.plannedDurationSeconds ?? 1500,
    startedAt: session.startedAt,
    runDeadlineAt: deadline,
    pausedAt: session.pausedAt ?? null,
    pausedTotalSeconds: time.pausedTotalSeconds,
    durationValidSeconds: time.durationValidSeconds,
    remainingSeconds: deadline ? time.remainingSeconds : 0,
    serverNow: now,
    version: session.version ?? 1,
    endedAt: session.endedAt ?? null,
    xpAwarded: session.xpAwarded ?? 0,
    terminalReason: session.terminalReason ?? null,
    discardedReason: session.discardedReason ?? null,
    canControl: session.initiatingSessionId === authSessionId,
  };
}

export function deserializeStudySessionSnapshot(
  value: StudySessionSnapshot | string,
  canControl?: boolean,
): StudySessionSnapshot {
  const original = typeof value === 'string' ? JSON.parse(value) as StudySessionSnapshot : value;
  return {
    ...original,
    startedAt: new Date(original.startedAt),
    runDeadlineAt: original.runDeadlineAt ? new Date(original.runDeadlineAt) : null,
    pausedAt: original.pausedAt ? new Date(original.pausedAt) : null,
    serverNow: new Date(original.serverNow),
    endedAt: original.endedAt ? new Date(original.endedAt) : null,
    canControl: canControl ?? original.canControl,
  };
}

@Injectable()
export class StudySessionStartService {
  constructor(private readonly dataSource: DataSource, private readonly users: UsersService) {}

  async active(userId: string, authSessionId: string): Promise<StudySessionSnapshot | null> {
    const session = await this.dataSource.getRepository(StudySession).findOne({
      where: { userId, state: In(['running', 'paused']) },
    });
    return session ? studySessionSnapshot(session, authSessionId, new Date()) : null;
  }

  async start(userId: string, authSessionId: string, dto: StartSessionDto, idempotencyKey: string | undefined): Promise<StudySessionSnapshot> {
    if (dto === null || typeof dto !== 'object' || Array.isArray(dto)) {
      throw new BadRequestException('O corpo da solicitação deve ser um objeto');
    }
    const plannedDurationSeconds = dto.plannedDurationSeconds === undefined ? 1500 : dto.plannedDurationSeconds;
    if (!isStudySessionPreset(plannedDurationSeconds)) {
      throw new BadRequestException('Duração de foco inválida');
    }
    if (!isValidIdempotencyKey(idempotencyKey)) {
      throw new BadRequestException('Idempotency-Key é obrigatório e deve conter de 1 a 128 caracteres ASCII visíveis');
    }

    return this.dataSource.transaction(async (manager) => {
      // Lock the stable user row so first starts also serialize, before an active row exists.
      if (!await this.users.lockForUpdate(userId, manager)) throw new BadRequestException('Usuário inválido');

      const receipts = await manager.query(
        'SELECT planned_duration_seconds, initiating_session_id, response_json FROM study_session_start_receipts WHERE user_id = ? AND idempotency_key = ?',
        [userId, idempotencyKey],
      ) as ReceiptRow[];
      const receipt = receipts[0];
      if (receipt) {
        if (Number(receipt.planned_duration_seconds) !== plannedDurationSeconds) {
          throw new ConflictException({
            type: 'https://wise.app/errors/idempotency-key-reused',
            message: 'Idempotency-Key já foi usada com outra duração',
          });
        }
        return deserializeStudySessionSnapshot(
          receipt.response_json,
          receipt.initiating_session_id === authSessionId,
        );
      }

      await rejectIfStudySessionCommandKeyUsed(manager, userId, idempotencyKey);

      const active = await manager.getRepository(StudySession).findOne({
        where: { userId, state: In(['running', 'paused']) },
      });
      if (active) throw new ConflictException({
        type: 'https://wise.app/errors/study-session-active',
        message: 'Já existe uma Study Session ativa nesta conta',
      });

      const now = new Date();
      const studySession = manager.getRepository(StudySession).create({
        userId,
        subject: null,
        mode: 'solo',
        raidId: null,
        startedAt: now,
        lastHeartbeatAt: now,
        plannedDurationSeconds,
        state: 'running',
        runDeadlineAt: new Date(now.getTime() + plannedDurationSeconds * 1000),
        pausedAt: null,
        pausedTotalSeconds: 0,
        version: 1,
        terminalReason: null,
        initiatingSessionId: authSessionId,
        durationValidSeconds: 0,
        xpAwarded: 0,
        discardedReason: null,
      });
      const saved = await manager.getRepository(StudySession).save(studySession);
      const snapshot = studySessionSnapshot(saved, authSessionId, now);
      await manager.query('INSERT INTO active_study_sessions (user_id, study_session_id) VALUES (?, ?)', [userId, saved.id]);
      await manager.query(
        'INSERT INTO study_session_command_keys (user_id, idempotency_key, command_kind) VALUES (?, ?, ?)',
        [userId, idempotencyKey, 'start'],
      );
      await manager.query(
        'INSERT INTO study_session_start_receipts (user_id, idempotency_key, planned_duration_seconds, initiating_session_id, response_json) VALUES (?, ?, ?, ?, ?)',
        [userId, idempotencyKey, plannedDurationSeconds, authSessionId, JSON.stringify(snapshot)],
      );
      return snapshot;
    });
  }
}
