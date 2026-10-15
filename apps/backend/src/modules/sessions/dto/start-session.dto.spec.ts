import { validate } from 'class-validator';
import { StartSessionDto } from './start-session.dto';

describe('Study Session start request', () => {
  it('allows omission but rejects null, unsupported durations and unknown fields', async () => {
    expect(await validate(new StartSessionDto(), { whitelist: true, forbidNonWhitelisted: true })).toEqual([]);
    for (const invalid of [null, 0, 1200, 1500.5, '1500']) {
      const request = Object.assign(new StartSessionDto(), { plannedDurationSeconds: invalid });
      expect(await validate(request)).not.toEqual([]);
    }
    const unknownRequest = Object.assign(new StartSessionDto(), { durationMinutes: 25 });
    expect(await validate(unknownRequest, { whitelist: true, forbidNonWhitelisted: true })).not.toEqual([]);
  });

  it('accepts the solo and guild modes with a raidId and rejects other values', async () => {
    const options = { whitelist: true, forbidNonWhitelisted: true };
    for (const valid of [{ mode: 'solo' }, { mode: 'guild', raidId: 'raid-1' }]) {
      expect(await validate(Object.assign(new StartSessionDto(), valid), options)).toEqual([]);
    }
    for (const invalid of [{ mode: 'raid' }, { mode: null }, { raidId: 42 }, { raidId: null }]) {
      expect(await validate(Object.assign(new StartSessionDto(), invalid), options)).not.toEqual([]);
    }
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
