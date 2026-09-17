import { validateXpTotal } from './domain/progression-policy';

export class XpTotalTransformer {
  from(value: string | number): number {
    if (typeof value !== 'string' && typeof value !== 'number') {
      throw new Error('xpTotal persistido deve ser um inteiro seguro não negativo');
    }
    if (typeof value === 'string' && !/^\d+$/.test(value)) {
      throw new Error('xpTotal persistido deve ser um inteiro seguro não negativo');
    }
    const normalizedValue = typeof value === 'number' ? value : Number(value);
    validateXpTotal(normalizedValue);
    return normalizedValue;
  }

  to(value: number): string {
    validateXpTotal(value);
    return value.toString(10);
  }
}

export const xpTotalTransformer = new XpTotalTransformer();
