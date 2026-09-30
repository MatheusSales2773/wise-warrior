export const MAX_SUBJECT_LENGTH = 80;

export type SubjectValidation =
  | { status: 'valid'; subject: string | null }
  | { status: 'too-long'; length: number }
  | { status: 'invalid-characters' };

// Mirrors the API rules so the Forja can give feedback before the start; the API stays the authority.
const CONTROL_OR_LINE_BREAK = /[\p{Cc}\p{Zl}\p{Zp}]/u;

export function validateSubject(input: string): SubjectValidation {
  const composed = input.normalize('NFC');
  if (CONTROL_OR_LINE_BREAK.test(composed)) return { status: 'invalid-characters' };
  const subject = composed.replace(/\s+/gu, ' ').trim();
  if (subject === '') return { status: 'valid', subject: null };
  const length = Array.from(subject).length;
  if (length > MAX_SUBJECT_LENGTH) return { status: 'too-long', length };
  return { status: 'valid', subject };
}
