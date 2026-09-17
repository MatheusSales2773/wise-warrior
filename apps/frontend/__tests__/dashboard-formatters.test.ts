import { formatDiscardReason, formatDuration, formatSessionDate, formatXp } from '@/features/dashboard/formatters';

describe('dashboard formatters', () => {
  it('formats values for pt-BR without inventing units', () => {
    expect(formatXp(1234567)).toBe('1.234.567');
    expect(formatDuration(45)).toBe('45 s');
    expect(formatDuration(125)).toBe('2 min');
    expect(formatDiscardReason('HEARTBEAT_TIMEOUT')).toBe('Sessão não contabilizada');
    expect(formatDiscardReason(null)).toBe('');
  });

  it('formats an absolute local date and time', () => {
    expect(formatSessionDate('2026-01-02T03:04:05.000Z')).toMatch(/02\/01\/2026/);
  });
});
