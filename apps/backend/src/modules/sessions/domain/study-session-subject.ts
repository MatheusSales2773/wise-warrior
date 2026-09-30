export const MAX_STUDY_SESSION_SUBJECT_LENGTH = 80;

export class InvalidStudySessionSubjectError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidStudySessionSubjectError';
  }
}

// Cc: control characters (includes \n, \r, \t, NUL, DEL); Zl/Zp: Unicode line and paragraph separators.
const CONTROL_OR_LINE_BREAK = /[\p{Cc}\p{Zl}\p{Zp}]/u;
const WHITESPACE_RUN = /\s+/gu;

/**
 * Matéria opcional da Study Session. `null` é sempre "Sem matéria": ausência,
 * `null` e texto só com espaços (inclusive tab e quebras de linha) resultam em `null`, nunca em valor fictício.
 * O limite de 80 caracteres é regra da API, não da coluna (varchar 255).
 */
export function normalizeStudySessionSubject(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') {
    throw new InvalidStudySessionSubjectError('A Matéria deve ser um texto');
  }

  const composed = value.normalize('NFC');
  const subject = composed.replace(WHITESPACE_RUN, ' ').trim();
  if (subject === '') return null;
  if (CONTROL_OR_LINE_BREAK.test(composed)) {
    throw new InvalidStudySessionSubjectError('A Matéria não pode conter quebras de linha nem caracteres de controle');
  }
  if (Array.from(subject).length > MAX_STUDY_SESSION_SUBJECT_LENGTH) {
    throw new InvalidStudySessionSubjectError(
      `A Matéria deve ter no máximo ${MAX_STUDY_SESSION_SUBJECT_LENGTH} caracteres`,
    );
  }
  return subject;
}
