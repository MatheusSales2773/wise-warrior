import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { ProgressionService } from '../progression/progression.service';
import { RaidsService, type RaidContributionOutcome } from '../raids/raids.service';
import { EconomyService } from '../economy/economy.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { UsersService } from '../users/users.service';
import type { CoinMovementResult } from '../economy/domain/coin-origin';
import { StudySession } from './entities/study-session.entity';
import type { StudySessionSnapshot } from './study-session-snapshot';
import { deserializeStudySessionSnapshot, studySessionSnapshot } from './study-session-snapshot';
import { StudySessionTransitionDto } from './dto/study-session-transition.dto';
import { coinsForDuration } from './domain/coin-rate';
import { isValidIdempotencyKey } from './domain/idempotency-key';
import { rejectIfStudySessionCommandKeyUsed } from './study-session-command-keys';
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

/** Se a Study Session de modo Guilda contou para a Raid; `xpContributed` é 0 quando não contou. */
export type RaidContributionFeedback = { status: RaidContributionOutcome['status']; xpContributed: number };

/** Só as transições devolvem o feedback da Contribuição; null para sessões solo e pausa/retomada. */
export type StudySessionTransitionResult = StudySessionSnapshot & {
  raidContribution: RaidContributionFeedback | null;
};

/**
 * Sinal de `studySession:changed` (docs/api/asyncapi.yaml): o mínimo para o outro dispositivo
 * invalidar `GET /sessions/active`. `cancelled` e `discarded` são terminais e chegam como
 * `stopped_early`, porque o cliente só precisa saber que a sessão terminou.
 */
export type StudySessionChangedEvent = {
  studySessionId: string;
  version: number;
  state: 'running' | 'paused' | 'completed' | 'stopped_early';
};

type TerminalEffects = {
  xpGained: number;
  progressionResult: XpApplicationResult | null;
  coinMovement: CoinMovementResult | null;
  raidContributionOutcome: RaidContributionOutcome | null;
};

/** A focus the server completed at its deadline, and the publication to run once its transaction commits. */
export type ExpiredCompletion = {
  result: StudySessionTransitionResult;
  publish: () => void;
};

const EXPIRED_RUNNING_WHERE = 'studySession.userId = :userId AND studySession.state = :running AND studySession.runDeadlineAt <= :now';

const NO_TERMINAL_EFFECTS: TerminalEffects = {
  xpGained: 0,
  progressionResult: null,
  coinMovement: null,
  raidContributionOutcome: null,
};

type StudySessionTransitionCommand = StudySessionTransitionContext & {
  action: StudySessionCommandAction;
};

/** `changed` separates a transition applied by this request from a replay that only returned a receipt. */
type TransitionOutcome = TerminalEffects & {
  snapshot: StudySessionTransitionResult;
  changed: boolean;
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
  response_json: StudySessionTransitionResult | string;
};

const problemTypes = {
  idempotencyKeyRequired: 'https://wise.app/errors/idempotency-key-required',
  idempotencyKeyReused: 'https://wise.app/errors/idempotency-key-reused',
  versionConflict: 'https://wise.app/errors/study-session-version-conflict',
  transitionNotAllowed: 'https://wise.app/errors/study-session-transition-not-allowed',
  deadlinePassed: 'https://wise.app/errors/study-session-deadline-passed',
  completionTooEarly: 'https://wise.app/errors/study-session-completion-too-early',
};

@Injectable()
export class StudySessionTransitionService {
  constructor(
    private readonly dataSource: DataSource,
    @Inject(STUDY_SESSION_CLOCK) private readonly clock: StudySessionClock,
    private readonly progression: ProgressionService,
    private readonly raids: RaidsService,
    private readonly economy: EconomyService,
    private readonly users: UsersService,
    @Inject(forwardRef(() => RealtimeGateway)) private readonly realtime: RealtimeGateway,
  ) {}

  pause(command: StudySessionTransitionContext): Promise<StudySessionTransitionResult> {
    return this.transition({ ...command, action: 'pause' });
  }

  resume(command: StudySessionTransitionContext): Promise<StudySessionTransitionResult> {
    return this.transition({ ...command, action: 'resume' });
  }

  stop(command: StudySessionTransitionContext): Promise<StudySessionTransitionResult> {
    return this.transition({ ...command, action: 'stop' });
  }

  complete(command: StudySessionTransitionContext): Promise<StudySessionTransitionResult> {
    return this.transition({ ...command, action: 'complete' });
  }

  private async transition(
    { userId, studySessionId, action, dto, idempotencyKey }: StudySessionTransitionCommand,
  ): Promise<StudySessionTransitionResult> {
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

    const result: TransitionOutcome = await this.dataSource.transaction(async (manager) => {
      // Match the user-first lock order used by start, serializing the per-user idempotency key scope.
      await this.users.lockForUpdate(userId, manager);

      const sessions = manager.getRepository(StudySession);
      const session = await sessions
        .createQueryBuilder('studySession')
        .where('studySession.id = :studySessionId AND studySession.userId = :userId', { studySessionId, userId })
        .setLock('pessimistic_write')
        .getOne();

      if (!session) throw new NotFoundException('Study Session não encontrada');

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
          snapshot: deserializeTransitionResult(receipt.response_json),
          ...NO_TERMINAL_EFFECTS,
          changed: false,
        };
      }

      await rejectIfStudySessionCommandKeyUsed(manager, userId, idempotencyKey);

      // Another device (or the server) already completed this focus from the version the caller saw:
      // that is the outcome the caller asked for, so answer with it without applying the effects again.
      if (
        action === 'complete'
        && session.terminalReason === 'auto-complete'
        && dto.expectedVersion === (session.version ?? 1) - 1
      ) {
        return {
          snapshot: { ...studySessionSnapshot(session, this.clock.now()), raidContribution: null },
          ...NO_TERMINAL_EFFECTS,
          changed: false,
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
          const priorDailySeconds = await this.sumEligibleFocusSecondsToday(manager, userId, studySessionId, now);
          stopResult = applyStudySessionStop(session, now, priorDailySeconds);
        } else if (action === 'complete') {
          completionResult = await this.completeAtDeadline(manager, session, now);
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
      const terminalXpAwarded = stopResult?.xpAwarded ?? completionResult?.xpAwarded ?? 0;
      const effects = stopResult || completionResult
        ? await this.applyTerminalEffects(manager, saved, terminalXpAwarded)
        : NO_TERMINAL_EFFECTS;
      const snapshot: StudySessionTransitionResult = {
        ...studySessionSnapshot(saved, now),
        raidContribution: raidContributionFeedback(effects.raidContributionOutcome),
      };
      await manager.query(
        'INSERT INTO study_session_command_keys (user_id, idempotency_key, command_kind) VALUES (?, ?, ?)',
        [userId, idempotencyKey, action],
      );
      await manager.query(
        `INSERT INTO study_session_transition_receipts
         (user_id, study_session_id, idempotency_key, action, expected_version, response_json)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [userId, studySessionId, idempotencyKey, action, dto.expectedVersion, JSON.stringify(snapshot)],
      );
      return { snapshot, ...effects, changed: true };
    });

    // Both publications run after the commit, so no device sees a state that could still roll back.
    this.publishTerminalEffects(userId, result);
    if (result.changed) this.publishStudySessionChanged(userId, result.snapshot);
    return result.snapshot;
  }

  /**
   * ADR-011 item 6: a running focus completes at its canonical deadline even when no client calls
   * `/complete`, so a device that died at the deadline does not hold the only active slot forever.
   * Paused sessions never complete by age (D-014). Returns the result once: the next read finds no
   * expired focus.
   */
  async completeExpired(userId: string): Promise<StudySessionTransitionResult | null> {
    // An unlocked read first, so reading the active session takes no lock in the common case.
    const pending = await this.dataSource.getRepository(StudySession)
      .createQueryBuilder('studySession')
      .where(EXPIRED_RUNNING_WHERE, { userId, running: 'running', now: this.clock.now() })
      .getExists();
    if (!pending) return null;

    const completion = await this.dataSource.transaction(async (manager) => {
      await this.users.lockForUpdate(userId, manager);
      return this.completeExpiredInTransaction(manager, userId);
    });
    completion?.publish();
    return completion?.result ?? null;
  }

  /** {@link completeExpired} inside the caller's transaction, which already holds the user lock. */
  async completeExpiredInTransaction(manager: EntityManager, userId: string): Promise<ExpiredCompletion | null> {
    const now = this.clock.now();
    // A plain read finds the candidate and the lock goes by primary key: a locking range read here takes
    // gap locks that deadlock with the inserts of other users' concurrent starts.
    const expired = await manager.getRepository(StudySession)
      .createQueryBuilder('studySession')
      .select('studySession.id')
      .where(EXPIRED_RUNNING_WHERE, { userId, running: 'running', now })
      .getOne();
    // None, or another request completed it while this one waited for the user lock.
    if (!expired) return null;
    const session = await manager.getRepository(StudySession).findOneOrFail({
      where: { id: expired.id },
      lock: { mode: 'pessimistic_write' },
    });
    const completion = await this.completeAtDeadline(manager, session, now);
    const saved = await manager.getRepository(StudySession).save(session);
    const effects = await this.applyTerminalEffects(manager, saved, completion.xpAwarded);
    const result: StudySessionTransitionResult = {
      ...studySessionSnapshot(saved, now),
      raidContribution: raidContributionFeedback(effects.raidContributionOutcome),
    };
    return {
      result,
      publish: () => {
        this.publishTerminalEffects(userId, effects);
        this.publishStudySessionChanged(userId, result);
      },
    };
  }

  /** The daily cap of a completion counts the focus of the deadline day, even when it is recorded later. */
  private async completeAtDeadline(manager: EntityManager, session: StudySession, now: Date) {
    const priorDailySeconds = session.state === 'running'
      && session.runDeadlineAt
      && now.getTime() >= session.runDeadlineAt.getTime()
      ? await this.sumEligibleFocusSecondsToday(manager, session.userId, session.id, session.runDeadlineAt)
      : 0;
    return applyStudySessionComplete(session, now, priorDailySeconds);
  }

  /** XP, Moeda and Contribuição of a terminal Study Session, in the transaction that ended it. */
  private async applyTerminalEffects(
    manager: EntityManager,
    saved: StudySession,
    xpAwarded: number,
  ): Promise<TerminalEffects> {
    const { userId, id: studySessionId } = saved;
    let progressionResult: XpApplicationResult | null = null;
    let coinMovement: CoinMovementResult | null = null;
    let raidContributionOutcome: RaidContributionOutcome | null = null;
    await manager.query(
      'DELETE FROM active_study_sessions WHERE user_id = ? AND study_session_id = ?',
      [userId, studySessionId],
    );
    if (xpAwarded > 0) {
      progressionResult = await this.progression.awardXpInTransaction(manager, userId, xpAwarded);
      // Mesma transação do XP: a Moeda do foco e o XP são commitados ou revertidos juntos (ADR-012).
      coinMovement = await this.economy.credit(manager, userId, coinsForDuration(saved.durationValidSeconds), {
        type: 'study-session',
        ref: studySessionId,
      });
    }
    if (saved.mode === 'guild' && saved.raidId) {
      raidContributionOutcome = await this.raids.recordContributionInTransaction(manager, {
        raidId: saved.raidId,
        userId,
        studySessionId,
        xpContributed: xpAwarded,
        endedAt: saved.endedAt!,
      });
    }
    return { xpGained: xpAwarded, progressionResult, coinMovement, raidContributionOutcome };
  }

  /**
   * D-005/D-006: every authenticated device of the user learns that the active Study Session changed and
   * refetches the canonical `GET /sessions/active`. Only a state that this request applied is published.
   */
  publishStudySessionChanged(userId: string, snapshot: StudySessionSnapshot): void {
    this.realtime.emitToUser(userId, 'studySession:changed', studySessionChangedEvent(snapshot));
  }

  private publishTerminalEffects(userId: string, effects: TerminalEffects): void {
    if (effects.progressionResult) {
      this.progression.publishAwardedXp(userId, effects.xpGained, effects.progressionResult);
    }
    if (effects.coinMovement?.applied) {
      this.economy.publishBalanceChanged(userId, effects.coinMovement);
    }
    if (effects.raidContributionOutcome) this.raids.publishContribution(effects.raidContributionOutcome);
  }

  /**
   * Focus of the day of `endedAt`. There is no upper bound: a late completion passes its deadline, and
   * no other session can have started after it while this one was running (D-005).
   */
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
      .andWhere('session.startedAt >= :startOfDay', { startOfDay })
      .andWhere('session.discardedReason IS NULL')
      .andWhere("(session.state IS NULL OR session.state IN ('completed', 'stopped_early'))")
      .getRawOne<{ total: string }>();

    return Number(row?.total ?? 0);
  }
}

function raidContributionFeedback(outcome: RaidContributionOutcome | null): RaidContributionFeedback | null {
  return outcome ? { status: outcome.status, xpContributed: outcome.xpContributed } : null;
}

function studySessionChangedEvent(snapshot: StudySessionSnapshot): StudySessionChangedEvent {
  return {
    studySessionId: snapshot.id,
    version: snapshot.version,
    // The client only needs to know whether the session is still active; a cancel or a discard ended it.
    state: snapshot.state === 'running' || snapshot.state === 'paused' || snapshot.state === 'completed'
      ? snapshot.state
      : 'stopped_early',
  };
}

function deserializeTransitionResult(value: StudySessionTransitionResult | string): StudySessionTransitionResult {
  const original = typeof value === 'string' ? JSON.parse(value) as StudySessionTransitionResult : value;
  // Recibos gravados antes do feedback da Contribuição não têm `raidContribution`.
  return { ...deserializeStudySessionSnapshot(original), raidContribution: original.raidContribution ?? null };
}
