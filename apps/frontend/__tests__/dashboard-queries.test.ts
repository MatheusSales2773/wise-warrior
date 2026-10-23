import { saoPauloDay } from '@/features/dashboard/queries';

describe('saoPauloDay', () => {
  it('keeps 23:00 in São Paulo (02:00 UTC next day) on the São Paulo day', () => {
    expect(saoPauloDay(Date.parse('2026-09-18T02:00:00Z'))).toBe('2026-09-17');
  });

  it('switches day at São Paulo midnight', () => {
    expect(saoPauloDay(Date.parse('2026-09-18T02:59:59.999Z'))).toBe('2026-09-17');
    expect(saoPauloDay(Date.parse('2026-09-18T03:00:00Z'))).toBe('2026-09-18');
  });
});
