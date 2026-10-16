import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * #177: Missões à venda da Loja (ADR-012). Ids fixos para que o seed seja versionado. Ficam fora do rodízio
 * (`rotation_order` nulo), sem imagem, e os itens de recompensa nunca estão À venda: só a Raid os concede.
 */
const MISSIONS_FOR_SALE = [
  ['a1550000-0000-4000-8000-000000000101', 'contrato-do-grifo', 'Contrato do Grifo', 'Aceite o contrato do quadro de avisos: rastreie com a guilda o grifo que ronda as matérias atrasadas.', 90],
  ['a1550000-0000-4000-8000-000000000102', 'torre-dos-ratos', 'Torre dos Ratos', 'Suba a torre amaldiçoada e espante, sessão a sessão, os ratos que roem as anotações da guilda.', 180],
  ['a1550000-0000-4000-8000-000000000103', 'ilha-das-brumas', 'Ilha das Brumas', 'Navegue com a guilda pela névoa da ilha esquecida e ache, revisão a revisão, o caminho de volta.', 300],
  ['a1550000-0000-4000-8000-000000000104', 'cacada-selvagem', 'Caçada Selvagem', 'Os cavaleiros espectrais chegaram com o inverno. Só uma guilda unida, focada a semana inteira, quebra a Caçada Selvagem.', 480],
] as const;

/** [id, Missão (slug), categoria, nome] */
const REWARD_ITEMS = [
  ['c05e71c0-0000-4000-8000-000000000201', 'contrato-do-grifo', 'badge', 'Pluma de Grifo'],
  ['c05e71c0-0000-4000-8000-000000000202', 'torre-dos-ratos', 'badge', 'Sino da Torre'],
  ['c05e71c0-0000-4000-8000-000000000203', 'torre-dos-ratos', 'accessory', 'Chave da Torre'],
  ['c05e71c0-0000-4000-8000-000000000204', 'ilha-das-brumas', 'badge', 'Âncora das Brumas'],
  ['c05e71c0-0000-4000-8000-000000000205', 'ilha-das-brumas', 'title', 'Navegante das Brumas'],
  ['c05e71c0-0000-4000-8000-000000000206', 'cacada-selvagem', 'badge', 'Medalhão do Lobo'],
  ['c05e71c0-0000-4000-8000-000000000207', 'cacada-selvagem', 'title', 'Caçador de Monstros'],
  ['c05e71c0-0000-4000-8000-000000000208', 'cacada-selvagem', 'avatar', 'Armadura do Lobo'],
] as const;

const missionIdBySlug = new Map(MISSIONS_FOR_SALE.map(([id, slug]) => [slug, id]));

export class SeedMissionsForSale1788460200000 implements MigrationInterface {
  name = 'SeedMissionsForSale1788460200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO cosmetic_items (id, category, name, unlock_condition, requires_premium, price, for_sale)
       VALUES ${REWARD_ITEMS.map(() => "(?, ?, ?, ?, 0, NULL, 0)").join(', ')}`,
      REWARD_ITEMS.flatMap(([id, slug, category, name]) => [id, category, name, `raid:${slug}`]),
    );
    await queryRunner.query(
      `INSERT INTO missions (id, slug, name, description, image_url, rotation_order, price)
       VALUES ${MISSIONS_FOR_SALE.map(() => '(?, ?, ?, ?, NULL, NULL, ?)').join(', ')}`,
      MISSIONS_FOR_SALE.flat(),
    );
    await queryRunner.query(
      `INSERT INTO mission_reward_items (mission_id, cosmetic_item_id)
       VALUES ${REWARD_ITEMS.map(() => '(?, ?)').join(', ')}`,
      REWARD_ITEMS.flatMap(([id, slug]) => [missionIdBySlug.get(slug)!, id]),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // As Raids e a posse da Missão saem em cascata; o item de recompensa só sai depois do vínculo (RESTRICT).
    await queryRunner.query('DELETE FROM raids WHERE mission_id IN (?)', [MISSIONS_FOR_SALE.map(([id]) => id)]);
    await queryRunner.query('DELETE FROM missions WHERE id IN (?)', [MISSIONS_FOR_SALE.map(([id]) => id)]);
    // Remover o item remove as linhas de Inventário dele (ON DELETE CASCADE).
    await queryRunner.query('DELETE FROM cosmetic_items WHERE id IN (?)', [REWARD_ITEMS.map(([id]) => id)]);
  }
}
