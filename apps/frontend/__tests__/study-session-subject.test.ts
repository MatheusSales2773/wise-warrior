import { MAX_SUBJECT_LENGTH, validateSubject } from '@/features/study-session/subject';

describe('Matéria input validation (mirror of the API rules)', () => {
  it('treats blank text as Sem matéria', () => {
    for (const blank of ['', '   ', '  ']) {
      expect(validateSubject(blank)).toEqual({ status: 'valid', subject: null });
    }
  });

  it('trims, collapses inner spaces, normalizes to NFC and keeps case and accents', () => {
    expect(validateSubject('  ÁLGEBRA   linear ')).toEqual({ status: 'valid', subject: 'ÁLGEBRA linear' });
    expect(validateSubject('Cálculo II')).toEqual({ status: 'valid', subject: 'Cálculo II' });
  });

  it('warns above 80 characters after normalization, counting characters', () => {
    expect(validateSubject('a'.repeat(MAX_SUBJECT_LENGTH))).toEqual({ status: 'valid', subject: 'a'.repeat(80) });
    expect(validateSubject(`  ${'a'.repeat(80)}  `)).toEqual({ status: 'valid', subject: 'a'.repeat(80) });
    expect(validateSubject('a'.repeat(81))).toMatchObject({ status: 'too-long', length: 81 });
    expect(validateSubject('📚'.repeat(80))).toMatchObject({ status: 'valid' });
    expect(validateSubject('📚'.repeat(81))).toMatchObject({ status: 'too-long', length: 81 });
  });

  it('refuses line breaks and control characters', () => {
    for (const invalid of ['a\nb', 'a\tb', 'a\u0000b', 'a b']) {
      expect(validateSubject(invalid)).toEqual({ status: 'invalid-characters' });
    }
  });
});
