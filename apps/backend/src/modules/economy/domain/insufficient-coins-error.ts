/** Débito maior que o saldo. Nada é alterado; `missing` é quantas Moedas faltam. */
export class InsufficientCoinsError extends Error {
  constructor(readonly missing: number) {
    super(`Saldo insuficiente de Moedas: faltam ${missing}`);
    this.name = 'InsufficientCoinsError';
  }
}
