import { goalLine } from '@/features/study-session/meanwhile';

describe('goalLine once the session already counts', () => {
  it('names what is left for the meta', () => {
    expect(goalLine({ progress: 3, target: 4 }, { counted: true })).toBe('Falta 1 sessão para a meta de 4.');
    expect(goalLine({ progress: 2, target: 4 }, { counted: true })).toBe('Faltam 2 sessões para a meta de 4.');
  });

  it('says nothing once the meta is reached or unknown', () => {
    expect(goalLine({ progress: 4, target: 4 }, { counted: true })).toBeNull();
    expect(goalLine(undefined, { counted: true })).toBeNull();
  });
});
