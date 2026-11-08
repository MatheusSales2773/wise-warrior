/** Os campos do Pacote que decidem se ele aparece na Loja. */
export interface PackListing {
  id: string;
  name: string;
  forSale: boolean;
}

/**
 * Os Pacotes que a Loja mostra a um usuário, ordenados por nome, com `owned`: os À venda, e os fora de venda que ele
 * já pagou (a posse é para sempre). Um Pacote fora de venda que ele não pagou fica de fora.
 */
export function visiblePacks<T extends PackListing>(packs: readonly T[], paidPackIds: ReadonlySet<string>): Array<T & { owned: boolean }> {
  return packs
    .filter((pack) => pack.forSale || paidPackIds.has(pack.id))
    .sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'))
    .map((pack) => ({ ...pack, owned: paidPackIds.has(pack.id) }));
}
