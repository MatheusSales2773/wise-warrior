import {
  forwardRef,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { ProgressionService } from '../progression/progression.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { CosmeticCategory, CosmeticItem } from './entities/cosmetic-item.entity';
import { UserCosmeticItem } from './entities/user-cosmetic-item.entity';
import {
  isStarterItem,
  isUnlockedAtLevel,
  parseUnlockCondition,
  UnlockCondition,
} from './domain/unlock-condition';

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  planTier: string;
  level: number;
  xpTotal: number;
  levelStartXp: number;
  nextLevelXp: number;
  /** ADR-010: nome do Cosmetic Item de categoria Título equipado, ou `null`. */
  title: string | null;
  equipped: EquippedCosmeticItem[];
}

export interface EquippedCosmeticItem {
  category: CosmeticCategory;
  itemId: string;
  name: string;
}

/** The Avatar, Arma and Acessório a user has equipped, as shown on other people's screens (e.g. the Raid scene). */
const APPEARANCE_CATEGORIES = ['avatar', 'weapon', 'accessory'] as const;

export type EquippedAppearanceItem = { itemId: string; name: string } | null;

export interface EquippedAppearance {
  avatar: EquippedAppearanceItem;
  weapon: EquippedAppearanceItem;
  accessory: EquippedAppearanceItem;
}

/** Aparência sem nada equipado: o valor de quem não aparece no resultado de `findEquippedAppearance`. */
export const EMPTY_APPEARANCE: Readonly<EquippedAppearance> = { avatar: null, weapon: null, accessory: null };

export interface ShopCosmeticItem {
  id: string;
  category: CosmeticCategory;
  name: string;
  price: number;
  owned: boolean;
}

export interface CatalogCosmeticItem {
  id: string;
  category: CosmeticCategory;
  name: string;
  requiresPremium: boolean;
  unlocked: boolean;
  equipped: boolean;
  /** Item de Compra à venda; false para os demais e para os Fora de venda. */
  forSale: boolean;
  unlockCondition: UnlockCondition;
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(UserCosmeticItem)
    private readonly userCosmetics: Repository<UserCosmeticItem>,
    @InjectRepository(CosmeticItem)
    private readonly cosmeticItems: Repository<CosmeticItem>,
    @Inject(forwardRef(() => ProgressionService))
    private readonly progression: ProgressionService,
    @Optional() private readonly config?: ConfigService,
    // Last and optional so the services built by hand in integration tests keep their positional arguments;
    // Nest always injects it in the application.
    @Optional() @Inject(forwardRef(() => RealtimeGateway))
    private readonly realtime?: RealtimeGateway,
  ) {}

  /** Serializes work for a user inside the caller's transaction, including the first insert. */
  async lockForUpdate(userId: string, manager: EntityManager): Promise<boolean> {
    const user = await manager.getRepository(User).findOne({
      where: { id: userId },
      lock: { mode: 'pessimistic_write' },
    });
    return user !== null;
  }

  /**
   * Regra de Desbloqueio: concede todo Cosmetic Item cuja condição de nível seja
   * ≤ `level` e que ainda não esteja no Inventário. Roda na transação de quem
   * chama e é idempotente pelo índice único (usuário + item).
   */
  async unlockCosmeticItems(manager: EntityManager, userId: string, level: number): Promise<void> {
    const unlocked = (await this.readCatalog(manager.getRepository(CosmeticItem)))
      .filter(({ condition }) => isUnlockedAtLevel(condition, level));
    if (unlocked.length === 0) return;
    await this.grantToInventory(manager, unlocked.map(({ item }) => ({ userId, cosmeticItemId: item.id })));
  }

  /**
   * Desbloqueio por Recompensa de Raid (#117, #169): cada usuário recebe os Cosmetic Items da Missão (`itemIds`, do
   * `RaidsService`). Roda na transação de quem chama, é idempotente pelo índice único (usuário + item), pula o que
   * o usuário já tem e nunca equipa.
   */
  async unlockRaidRewards(manager: EntityManager, userIds: string[], itemIds: string[]): Promise<void> {
    if (userIds.length === 0 || itemIds.length === 0) return;
    // Vencer de novo a mesma Missão, ou reprocessar o fechamento, não duplica nem reequipa nada.
    await this.grantToInventory(manager, userIds.flatMap((userId) => itemIds.map((cosmeticItemId) => ({ userId, cosmeticItemId }))));
  }

  /** Os Cosmetic Items À venda (ADR-012), com o preço e se o usuário já os possui. */
  async listItemsForSale(userId: string): Promise<ShopCosmeticItem[]> {
    const [items, inventory] = await Promise.all([
      this.cosmeticItems.find({ where: { forSale: true } }),
      this.userCosmetics.find({ where: { userId } }),
    ]);
    const owned = new Set(inventory.map((row) => row.cosmeticItemId));
    return items.flatMap((item) => (item.price === null ? [] : [{
      id: item.id,
      category: item.category,
      name: item.name,
      price: item.price,
      owned: owned.has(item.id),
    }]));
  }

  /**
   * Compra de um Cosmetic Item (ADR-012): a Condição de desbloqueio `purchase`, concedida pelo mesmo Desbloqueio
   * idempotente das demais. Concede o item ao Inventário na
   * transação de quem chama, que debita o preço na mesma transação. 404 para item que não está À venda, 409 para
   * item que o usuário já tem. Devolve o preço a debitar. Nunca equipa.
   */
  async unlockPurchasedItem(manager: EntityManager, userId: string, cosmeticItemId: string): Promise<{ price: number }> {
    const item = await manager.getRepository(CosmeticItem).findOne({ where: { id: cosmeticItemId, forSale: true } });
    if (!item || item.price === null) {
      throw new NotFoundException('Item não está À venda');
    }
    // O chamador já travou a linha do usuário (`lockForUpdate`), então verificar e conceder não corre contra outra Compra.
    if (await manager.getRepository(UserCosmeticItem).exists({ where: { userId, cosmeticItemId } })) {
      throw new ConflictException('Você já possui este item');
    }
    await this.grantToInventory(manager, [{ userId, cosmeticItemId }]);
    return { price: item.price };
  }

  /**
   * O Desbloqueio idempotente, comum a nível, Raid e Compra: insere no Inventário na transação de quem chama e, pelo
   * índice único (usuário + item), repetir um par não duplica nem reequipa nada.
   */
  private async grantToInventory(
    manager: EntityManager,
    grants: Array<{ userId: string; cosmeticItemId: string }>,
  ): Promise<void> {
    await manager
      .createQueryBuilder()
      .insert()
      .into(UserCosmeticItem)
      .values(grants.map(({ userId, cosmeticItemId }) => ({ userId, cosmeticItemId, equipped: false })))
      // Só a linha repetida (usuário + item) é tolerada; qualquer outro erro continua sendo erro.
      .orUpdate(['cosmetic_item_id'], ['user_id', 'cosmetic_item_id'])
      .execute();
  }

  /** Inventário de um Character recém-criado: os Itens iniciais, já equipados. */
  async grantStarterInventory(manager: EntityManager, userId: string): Promise<void> {
    await this.unlockCosmeticItems(manager, userId, 1);
    const inventory = manager.getRepository(UserCosmeticItem);
    const starters = (await inventory.find({ where: { userId }, relations: ['cosmeticItem'] }))
      .filter((row) => {
        const condition = parseUnlockCondition(row.cosmeticItem.unlockCondition);
        return condition !== null && isStarterItem(condition);
      });
    const equippedCategories = new Set<CosmeticCategory>();
    for (const starter of starters) {
      // No máximo um item equipado por categoria, mesmo que o Catálogo ganhe outro Item inicial nela.
      if (equippedCategories.has(starter.cosmeticItem.category)) continue;
      equippedCategories.add(starter.cosmeticItem.category);
      await inventory.update({ id: starter.id }, { equipped: true });
    }
  }

  /** Dados públicos de Cosmetic Items, para quem precisa exibir a Recompensa (ex.: Raids). */
  async findCosmeticItems(ids: string[]): Promise<Array<Pick<CosmeticItem, 'id' | 'name' | 'category'>>> {
    if (ids.length === 0) return [];
    const items = await this.cosmeticItems.find({ where: { id: In(ids) } });
    return items.map(({ id, name, category }) => ({ id, name, category }));
  }

  /** Avatar, Arma e Acessório equipados de cada usuário, para quem desenha os outros membros. Todos os ids voltam, vazios ou não. */
  async findEquippedAppearance(ids: string[]): Promise<Map<string, EquippedAppearance>> {
    const appearance = new Map<string, EquippedAppearance>(ids.map((id) => [id, { ...EMPTY_APPEARANCE }]));
    if (ids.length === 0) return appearance;
    const rows = await this.userCosmetics.find({
      where: { userId: In(ids), equipped: true, cosmeticItem: { category: In<CosmeticCategory>([...APPEARANCE_CATEGORIES]) } },
      relations: ['cosmeticItem'],
    });
    for (const { userId, cosmeticItem } of rows) {
      const slot = appearance.get(userId);
      const category = APPEARANCE_CATEGORIES.find((candidate) => candidate === cosmeticItem.category);
      if (!slot || !category) continue;
      slot[category] = { itemId: cosmeticItem.id, name: cosmeticItem.name };
    }
    return appearance;
  }

  /** Nome do Título equipado de cada usuário (ADR-010), para quem lista os outros membros. Só voltam os ids com Título equipado. */
  async findEquippedTitles(ids: string[]): Promise<Map<string, string>> {
    const titles = new Map<string, string>();
    if (ids.length === 0) return titles;
    const rows = await this.userCosmetics.find({
      where: { userId: In(ids), equipped: true, cosmeticItem: { category: 'title' } },
      relations: ['cosmeticItem'],
    });
    for (const { userId, cosmeticItem } of rows) titles.set(userId, cosmeticItem.name);
    return titles;
  }

  /** Nomes de exibição, para quem precisa mostrar o dono de algo (ex.: a Missão escolhida pelo Líder). */
  async findDisplayNames(ids: string[]): Promise<Array<{ id: string; displayName: string }>> {
    if (ids.length === 0) return [];
    const rows = await this.users.find({ where: { id: In(ids) }, select: { id: true, displayName: true } });
    return rows.map(({ id, displayName }) => ({ id, displayName }));
  }

  /** O Catálogo inteiro, com o estado de cada item no Inventário do usuário. A interface define a ordem. */
  async listCatalog(userId: string): Promise<CatalogCosmeticItem[]> {
    const [catalog, inventory] = await Promise.all([
      this.readCatalog(this.cosmeticItems),
      this.userCosmetics.find({ where: { userId } }),
    ]);
    const owned = new Map(inventory.map((row) => [row.cosmeticItemId, row]));
    return catalog.map(({ item, condition }) => ({
      id: item.id,
      category: item.category,
      name: item.name,
      requiresPremium: item.requiresPremium,
      unlocked: owned.has(item.id),
      equipped: owned.get(item.id)?.equipped ?? false,
      forSale: item.forSale,
      unlockCondition: condition,
    }));
  }

  /** Itens com Condição de desbloqueio fora do formato ficam fora do Catálogo, sem derrubar o resto. */
  private async readCatalog(
    repository: Repository<CosmeticItem>,
  ): Promise<Array<{ item: CosmeticItem; condition: UnlockCondition }>> {
    const catalog = await repository.find();
    return catalog.flatMap((item) => {
      const condition = parseUnlockCondition(item.unlockCondition);
      if (condition === null) {
        this.logger.warn(`Cosmetic Item ${item.id} ignorado: condição de desbloqueio inválida "${item.unlockCondition}"`);
        return [];
      }
      return [{ item, condition }];
    });
  }

  async getProfile(userId: string): Promise<UserProfile> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }
    const [character, equippedRows] = await Promise.all([
      this.progression.getCharacterSnapshot(userId),
      this.userCosmetics.find({ where: { userId, equipped: true }, relations: ['cosmeticItem'] }),
    ]);
    const equipped = equippedRows.map(({ cosmeticItem }) => ({
      category: cosmeticItem.category,
      itemId: cosmeticItem.id,
      name: cosmeticItem.name,
    }));
    const xpTotal = character?.xpTotal ?? 0;
    const projection = this.progression.getProjection(xpTotal);
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      planTier: user.planTier,
      level: projection.level,
      xpTotal,
      levelStartXp: projection.levelStartXp,
      nextLevelXp: projection.nextLevelXp,
      title: equipped.find((item) => item.category === 'title')?.name ?? null,
      equipped,
    };
  }

  /** Só este Service grava o nome (ADR-001); o Mural e os demais leem por join, então o nome novo aparece em tudo. */
  async updateDisplayName(userId: string, displayName: string): Promise<UserProfile> {
    const { affected } = await this.users.update({ id: userId }, { displayName });
    if (!affected) {
      throw new NotFoundException('Usuário não encontrado');
    }
    return this.getProfile(userId);
  }

  /**
   * Política de entitlement do MVP (ADR-007): enquanto `COSMETICS_PREMIUM_FOR_ALL` não for
   * `false`, os itens premium ficam liberados para todos. A checagem continua no caminho de Equipar.
   */
  private premiumReleasedToEveryone(): boolean {
    return this.config?.get<string>('COSMETICS_PREMIUM_FOR_ALL') !== 'false';
  }

  /**
   * Equipa um item do Inventário e desequipa o da mesma categoria. A transação trava a linha do
   * usuário, então requisições simultâneas se serializam e sempre sobra um único item equipado.
   */
  async equipCosmeticItem(userId: string, cosmeticItemId: string): Promise<void> {
    const category = await this.users.manager.transaction(async (manager) => {
      const user = await manager.getRepository(User).findOne({
        where: { id: userId },
        lock: { mode: 'pessimistic_write' },
      });
      const inventory = manager.getRepository(UserCosmeticItem);
      const target = user
        ? await inventory.findOne({ where: { userId, cosmeticItemId }, relations: ['cosmeticItem'] })
        : null;
      if (!user || !target) {
        throw new NotFoundException('Item não desbloqueado por este usuário');
      }
      if (target.cosmeticItem.requiresPremium && user.planTier !== 'premium' && !this.premiumReleasedToEveryone()) {
        throw new ForbiddenException('Item exclusivo do plano premium');
      }

      const sameCategory = await inventory.find({
        where: { userId, equipped: true, cosmeticItem: { category: target.cosmeticItem.category } },
      });
      const others = sameCategory.filter((row) => row.id !== target.id).map((row) => row.id);
      if (others.length > 0) {
        await inventory.update(others, { equipped: false });
      }
      await inventory.update({ id: target.id }, { equipped: true });
      return target.cosmeticItem.category;
    });
    this.publishEquipmentChanged(userId, category, cosmeticItemId);
  }

  /** Desequipa um item do Inventário; repetir a chamada não muda nada. */
  async unequipCosmeticItem(userId: string, cosmeticItemId: string): Promise<void> {
    const category = await this.users.manager.transaction(async (manager) => {
      const user = await manager.getRepository(User).findOne({
        where: { id: userId },
        lock: { mode: 'pessimistic_write' },
      });
      const inventory = manager.getRepository(UserCosmeticItem);
      const row = user ? await inventory.findOne({ where: { userId, cosmeticItemId }, relations: ['cosmeticItem'] }) : null;
      if (!row) {
        throw new NotFoundException('Item não desbloqueado por este usuário');
      }
      await inventory.update({ id: row.id }, { equipped: false });
      return row.cosmeticItem.category;
    });
    this.publishEquipmentChanged(userId, category, null);
  }

  /**
   * Depois do commit: todos os dispositivos do usuário refletem a nova equipagem sem recarregar (#22, ADR-009).
   * `cosmeticItemId` é o item agora equipado na categoria, ou `null` quando ela ficou vazia.
   */
  private publishEquipmentChanged(userId: string, category: CosmeticCategory, cosmeticItemId: string | null): void {
    this.realtime?.emitToUser(userId, 'character:equipmentChanged', { category, cosmeticItemId });
  }
}
