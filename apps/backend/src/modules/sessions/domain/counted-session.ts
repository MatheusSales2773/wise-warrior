/** What a Study Session of a São Paulo day exposes to Objetivos (ADR-014). */
export interface FinishedSessionOfDay {
  validSeconds: number;
}

/**
 * The one rule for "a Study Session that counted": not discarded, and neither cancelled nor still open (`state` is
 * null on sessions from before the canonical state). Metrics, the daily cap, the Badge counts and the Objetivos all
 * read through it, so they cannot disagree on what a finished session is. Needs the `session` alias.
 */
export const COUNTED_SESSION_SQL =
  "session.discardedReason IS NULL AND (session.state IS NULL OR session.state IN ('completed', 'stopped_early'))";
