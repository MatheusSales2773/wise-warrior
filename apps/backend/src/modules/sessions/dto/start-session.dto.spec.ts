import { validate } from 'class-validator';
import { StartSessionDto } from './start-session.dto';

describe('Study Session start request', () => {
  it('allows omission but rejects null, unsupported durations and legacy fields', async () => {
    expect(await validate(new StartSessionDto(), { whitelist: true, forbidNonWhitelisted: true })).toEqual([]);
    for (const invalid of [null, 0, 1200, 1500.5, '1500']) {
      const request = Object.assign(new StartSessionDto(), { plannedDurationSeconds: invalid });
      expect(await validate(request)).not.toEqual([]);
    }
    const legacyRequest = Object.assign(new StartSessionDto(), { mode: 'guild' });
    expect(await validate(legacyRequest, { whitelist: true, forbidNonWhitelisted: true })).not.toEqual([]);
  });

  it('accepts an optional Matéria as text or null and rejects other types', async () => {
    const options = { whitelist: true, forbidNonWhitelisted: true };
    for (const valid of [undefined, null, '', '  ', 'Cálculo II']) {
      const request = Object.assign(new StartSessionDto(), { subject: valid });
      expect(await validate(request, options)).toEqual([]);
    }
    for (const invalid of [0, 42, true, {}, ['Cálculo']]) {
      const request = Object.assign(new StartSessionDto(), { subject: invalid });
      expect(await validate(request, options)).not.toEqual([]);
    }
  });
});
