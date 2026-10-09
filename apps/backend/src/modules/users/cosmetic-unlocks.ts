import type { EntityManager } from 'typeorm';
import { CosmeticItem } from './entities/cosmetic-item.entity';
import { UserCosmeticItem } from './entities/user-cosmetic-item.entity';
import { isUnlockedAtLevel, parseUnlockCondition } from './domain/unlock-condition';

/**
 * Regra de Desbloqueio: concede todo Cosmetic Item cuja condição de nível seja
 * ≤ `level` e que ainda não esteja no Inventário. Roda na transação de quem
 * chama e é idempotente pelo índice único (usuário + item).
 */
export async function unlockCosmeticItems(
  manager: EntityManager,
  userId: string,
  level: number,
): Promise<void> {
  const catalog = await manager.getRepository(CosmeticItem).find();
  const unlocked = catalog.filter((item) => isUnlockedAtLevel(parseUnlockCondition(item.unlockCondition), level));
  if (unlocked.length === 0) return;
  await manager
    .createQueryBuilder()
    .insert()
    .into(UserCosmeticItem)
    .values(unlocked.map((item) => ({ userId, cosmeticItemId: item.id, equipped: false })))
    .orIgnore()
    .execute();
}

/** Equipa os Itens iniciais do Inventário nas categorias que ainda não têm item equipado. */
export async function equipStarterItems(manager: EntityManager, userId: string): Promise<void> {
  const repository = manager.getRepository(UserCosmeticItem);
  const inventory = await repository.find({ where: { userId }, relations: ['cosmeticItem'] });
  const equippedCategories = new Set(
    inventory.filter((row) => row.equipped).map((row) => row.cosmeticItem.category),
  );
  const starters = inventory.filter((row) => {
    const condition = parseUnlockCondition(row.cosmeticItem.unlockCondition);
    return condition.type === 'level' && condition.level === 1;
  });
  for (const starter of starters) {
    // No máximo um item equipado por categoria, mesmo que o Catálogo ganhe outro Item inicial nela.
    if (equippedCategories.has(starter.cosmeticItem.category)) continue;
    equippedCategories.add(starter.cosmeticItem.category);
    await repository.update({ id: starter.id }, { equipped: true });
  }
}
