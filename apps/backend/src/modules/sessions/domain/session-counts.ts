import { saoPauloHour } from '../../../shared/time/sao-paulo-calendar';
import type { SessionCounts } from '../../users/domain/unlock-condition';
import type { SessionActivityHour } from './session-metrics';

/** A Study Session that ends before this São Paulo hour counts for the "early" Badge condition. */
export const EARLY_SESSION_BEFORE_HOUR = 7;

/** Counts finished, non-discarded Study Sessions from their hourly UTC activity, and those ended before 7h in São Paulo. */
export function countSessions(hours: readonly SessionActivityHour[]): SessionCounts {
  const counts: SessionCounts = { sessions: 0, earlySessions: 0 };
  for (const { hour, sessionCount } of hours) {
    counts.sessions += sessionCount;
    if (saoPauloHour(new Date(`${hour.replace(' ', 'T')}:00:00Z`)) < EARLY_SESSION_BEFORE_HOUR) {
      counts.earlySessions += sessionCount;
    }
  }
  return counts;
}
