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
});
