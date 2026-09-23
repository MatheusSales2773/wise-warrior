import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { ProgressionService } from '../progression/progression.service';
import { StudySession } from './entities/study-session.entity';
import type { StudySessionSnapshot } from './study-session-start.service';
import { deserializeStudySessionSnapshot, studySessionSnapshot } from './study-session-start.service';
import { StudySessionTransitionDto } from './dto/study-session-transition.dto';
import { isValidIdempotencyKey } from './domain/idempotency-key';
import {
  applyStudySessionComplete,
  applyStudySessionStop,
  applyStudySessionTransition,
  StudySessionTransitionPolicyError,
  type StudySessionCommandAction,
} from './domain/study-session-time';
import type { XpApplicationResult } from '../progression/domain/progression-policy';

export type StudySessionClock = { now(): Date };
export const STUDY_SESSION_CLOCK = Symbol('STUDY_SESSION_CLOCK');
export type StudySessionTransitionContext = {
  userId: string;
  authSessionId: string;
  studySessionId: string;
  dto?: StudySessionTransitionDto;
  idempotencyKey: string | undefined;
};

type StudySessionTransitionCommand = StudySessionTransitionContext & {
  action: StudySessionCommandAction;
};

const TRANSITION_VERBS: Record<StudySessionCommandAction, string> = {
  pause: 'pausar',
  resume: 'retomar',
  stop: 'encerrar',
  complete: 'concluir',
};

type TransitionReceiptRow = {
  study_session_id: string;
  action: StudySessionCommandAction;
  expected_version: number | string;
  response_json: StudySessionSnapshot | string;
};

const problemTypes = {
  idempotencyKeyRequired: 'https://wise.app/errors/idempotency-key-required',
  idempotencyKeyReused: 'https://wise.app/errors/idempotency-key-reused',
  versionConflict: 'https://wise.app/errors/study-session-version-conflict',
  transitionNotAllowed: 'https://wise.app/errors/study-session-transition-not-allowed',
  notControllable: 'https://wise.app/errors/study-session-not-controllable',
  deadlinePassed: 'https://wise.app/errors/study-session-deadline-passed',
  completionTooEarly: 'https://wise.app/errors/study-session-completion-too-early',
};

@Injectable()
export class StudySessionTransitionService {
  constructor(
    private readonly dataSource: DataSource,
    @Inject(STUDY_SESSION_CLOCK) private readonly clock: StudySessionClock,
    private readonly progression: ProgressionService,
  ) {}

  pause(command: StudySessionTransitionContext): Promise<StudySessionSnapshot> {
    return this.transition({ ...command, action: 'pause' });
  }

  resume(command: StudySessionTransitionContext): Promise<StudySessionSnapshot> {
    return this.transition({ ...command, action: 'resume' });
  }

  stop(command: StudySessionTransitionContext): Promise<StudySessionSnapshot> {
    return this.transition({ ...command, action: 'stop' });
  }

  complete(command: StudySessionTransitionContext): Promise<StudySessionSnapshot> {
    return this.transition({ ...command, action: 'complete' });
  }

  private async transition(
    { userId, authSessionId, studySessionId, action, dto, idempotencyKey }: StudySessionTransitionCommand,
  ): Promise<StudySessionSnapshot> {
    if (!isValidIdempotencyKey(idempotencyKey)) {
      throw new BadRequestException({
        type: problemTypes.idempotencyKeyRequired,
        message: 'Idempotency-Key é obrigatório e deve conter de 1 a 128 caracteres ASCII visíveis',
      });
    }
    if (!dto || typeof dto !== 'object' || !Number.isSafeInteger(dto.expectedVersion) || dto.expectedVersion < 1) {
      throw new BadRequestException({
        type: 'https://wise.app/errors/study-session-version-required',
        message: 'expectedVersion deve ser um inteiro positivo',
      });
    }

    const result = await this.dataSource.transaction(async (manager) => {
      // Match the user-first lock order used by start, serializing the per-user idempotency key scope.
      await manager.query('SELECT id FROM users WHERE id = ? FOR UPDATE', [userId]);

      const sessions = manager.getRepository(StudySession);
      const session = await sessions
        .createQueryBuilder('studySession')
        .where('studySession.id = :studySessionId AND studySession.userId = :userId', { studySessionId, userId })
        .setLock('pessimistic_write')
        .getOne();

      if (!session) throw new NotFoundException('Study Session não encontrada');
      if (session.initiatingSessionId !== authSessionId) {
        throw new ConflictException({
          type: problemTypes.notControllable,
          message: 'Esta Study Session só pode ser controlada pela Session autenticada que a iniciou',
        });
      }

      const receiptRows = await manager.query(
        `SELECT study_session_id, action, expected_version, response_json
         FROM study_session_transition_receipts
         WHERE user_id = ? AND idempotency_key = ?`,
        [userId, idempotencyKey],
      ) as TransitionReceiptRow[];
      const receipt = receiptRows[0];
      if (receipt) {
        if (
          receipt.study_session_id !== studySessionId
          || receipt.action !== action
          || Number(receipt.expected_version) !== dto.expectedVersion
        ) {
          throw new ConflictException({
            type: problemTypes.idempotencyKeyReused,
            message: 'Idempotency-Key já foi usada com outra transição',
          });
        }
        return {
          snapshot: deserializeStudySessionSnapshot(receipt.response_json),
          xpGained: 0,
          progressionResult: null,
        };
      }

      if ((session.version ?? 1) !== dto.expectedVersion) {
        throw new ConflictException({
          type: problemTypes.versionConflict,
          message: 'A Study Session mudou desde a última confirmação; atualize o snapshot antes de continuar',
        });
      }

      const now = this.clock.now();
      let stopResult: ReturnType<typeof applyStudySessionStop> | null = null;
      let completionResult: ReturnType<typeof applyStudySessionComplete> | null = null;
      try {
        if (action === 'stop') {
          stopResult = applyStudySessionStop(session, now);
        } else if (action === 'complete') {
          const priorDailySeconds = session.state === 'running'
            && session.runDeadlineAt
            && now.getTime() >= session.runDeadlineAt.getTime()
            ? await this.sumEligibleFocusSecondsToday(manager, userId, studySessionId, now)
            : 0;
          completionResult = applyStudySessionComplete(session, now, priorDailySeconds);
        } else {
          applyStudySessionTransition(session, action, now);
        }
      } catch (error) {
        if (!(error instanceof StudySessionTransitionPolicyError)) throw error;
        const expired = error.reason === 'deadline-passed';
        const tooEarly = error.reason === 'completion-too-early';
        throw new ConflictException({
          type: tooEarly
            ? problemTypes.completionTooEarly
            : expired
              ? problemTypes.deadlinePassed
              : problemTypes.transitionNotAllowed,
          message: tooEarly
            ? 'O prazo canônico da Study Session ainda não foi alcançado'
            : expired
              ? 'O prazo canônico da Study Session já terminou'
              : `Não é possível ${TRANSITION_VERBS[action]} a Study Session no estado atual`,
        });
      }

      const saved = await sessions.save(session);
      const snapshot = studySessionSnapshot(saved, authSessionId, now);
      let progressionResult: XpApplicationResult | null = null;
      const terminalXpAwarded = stopResult?.xpAwarded ?? completionResult?.xpAwarded ?? 0;
      if (stopResult || completionResult) {
        await manager.query(
          'DELETE FROM active_study_sessions WHERE user_id = ? AND study_session_id = ?',
          [userId, studySessionId],
        );
        if (terminalXpAwarded > 0) {
          progressionResult = await this.progression.awardXpInTransaction(manager, userId, terminalXpAwarded);
        }
      }
      await manager.query(
        `INSERT INTO study_session_transition_receipts
         (user_id, study_session_id, idempotency_key, action, expected_version, response_json)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [userId, studySessionId, idempotencyKey, action, dto.expectedVersion, JSON.stringify(snapshot)],
      );
      return { snapshot, xpGained: terminalXpAwarded, progressionResult };
    });

    if (result.progressionResult) {
      this.progression.publishAwardedXp(userId, result.xpGained, result.progressionResult);
    }
    return result.snapshot;
  }

  private async sumEligibleFocusSecondsToday(
    manager: EntityManager,
    userId: string,
    excludeStudySessionId: string,
    endedAt: Date,
  ): Promise<number> {
    const startOfDay = new Date(endedAt);
    startOfDay.setHours(0, 0, 0, 0);

    const row = await manager
      .getRepository(StudySession)
      .createQueryBuilder('session')
      .select('COALESCE(SUM(session.durationValidSeconds), 0)', 'total')
      .where('session.userId = :userId', { userId })
      .andWhere('session.id != :excludeStudySessionId', { excludeStudySessionId })
      .andWhere('session.endedAt >= :startOfDay', { startOfDay })
      .andWhere('session.discardedReason IS NULL')
      .andWhere("(session.state IS NULL OR session.state IN ('completed', 'stopped_early'))")
      .getRawOne<{ total: string }>();

    return Number(row?.total ?? 0);
  }
}
