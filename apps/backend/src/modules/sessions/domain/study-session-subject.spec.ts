import {
  InvalidStudySessionSubjectError,
  MAX_STUDY_SESSION_SUBJECT_LENGTH,
  normalizeStudySessionSubject,
} from './study-session-subject';

describe('Study Session subject normalization', () => {
  it('treats absence, null and blank text as no subject', () => {
    for (const blank of [undefined, null, '', '   ', '   ', '\t', ' \n ', '  \n  ', '\r\n', '\u2028']) {
      expect(normalizeStudySessionSubject(blank)).toBeNull();
    }
  });

  it('trims the ends and collapses repeated inner spaces', () => {
    expect(normalizeStudySessionSubject('  Cálculo   II  ')).toBe('Cálculo II');
    expect(normalizeStudySessionSubject('Direito  Civil')).toBe('Direito Civil');
  });

  it('normalizes to NFC while preserving case and accents', () => {
    const decomposed = 'Cálculo II';
    const normalized = normalizeStudySessionSubject(decomposed);
    expect(normalized).toBe('Cálculo II');
    expect(normalized).toBe('Cálculo II');
    expect(normalizeStudySessionSubject('ÁLGEBRA linear')).toBe('ÁLGEBRA linear');
  });

  it('accepts from 1 to 80 characters after normalization', () => {
    expect(normalizeStudySessionSubject('a')).toBe('a');
    const longest = 'a'.repeat(MAX_STUDY_SESSION_SUBJECT_LENGTH);
    expect(normalizeStudySessionSubject(longest)).toBe(longest);
    expect(normalizeStudySessionSubject(`  ${longest}  `)).toBe(longest);
    expect(() => normalizeStudySessionSubject(`${longest}a`)).toThrow(InvalidStudySessionSubjectError);
  });

  it('counts the limit after normalization, not before', () => {
    const padded = `${'a'.repeat(40)}${' '.repeat(50)}${'b'.repeat(39)}`;
    expect(normalizeStudySessionSubject(padded)).toBe(`${'a'.repeat(40)} ${'b'.repeat(39)}`);
  });

  it('counts characters, not UTF-16 code units', () => {
    expect(normalizeStudySessionSubject('📚'.repeat(80))).toBe('📚'.repeat(80));
    expect(() => normalizeStudySessionSubject('📚'.repeat(81))).toThrow(InvalidStudySessionSubjectError);
  });

  it('rejects line breaks and control characters', () => {
    for (const invalid of [
      'Cálculo\nII', 'Cálculo\r\nII', 'Cálculo\tII', 'Cálculo\u0000II', 'Cálculo\u001bII',
      '\u007fCálculo', '\u0085', 'Cálculo II', 'Cálculo II',
    ]) {
      expect(() => normalizeStudySessionSubject(invalid)).toThrow(InvalidStudySessionSubjectError);
    }
  });

  it('rejects values that are not text', () => {
    for (const invalid of [0, 42, true, {}, [], ['Cálculo']]) {
      expect(() => normalizeStudySessionSubject(invalid)).toThrow(InvalidStudySessionSubjectError);
    }
  });
});
