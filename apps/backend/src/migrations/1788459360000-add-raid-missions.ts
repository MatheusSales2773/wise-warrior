import { MigrationInterface, QueryRunner, Table } from 'typeorm';
import { missionIndexForWeek, proportionalGoalXp, raidWeekAt } from '../modules/raids/domain/raid-week';

/** Catálogo inicial de Missões (#110). Os ids são fixos para que o seed seja versionado. */
const MISSIONS = [
  {
    id: 'a1550000-0000-4000-8000-000000000001',
    slug: 'vigilia-da-aurora',
    name: 'Vigília da Aurora',
    description: 'Madrugue com a guilda e acenda as primeiras luzes do dia com foco coletivo.',
    rewardItemId: 'c05e71c0-0000-4000-8000-000000000007',
  },
  {
    id: 'a1550000-0000-4000-8000-000000000002',
    slug: 'cerco-ao-grimorio',
    name: 'Cerco ao Grimório',
    description: 'Cerque os capítulos mais difíceis e vença, página por página, o grimório da semana.',
    rewardItemId: 'c05e71c0-0000-4000-8000-000000000009',
  },
  {
    id: 'a1550000-0000-4000-8000-000000000003',
    slug: 'marcha-do-silencio',
    name: 'Marcha do Silêncio',
    description: 'Marche em silêncio rumo à meta: sessões longas, sem distrações, lado a lado.',
    rewardItemId: 'c05e71c0-0000-4000-8000-00000000000a',
  },
  {
    id: 'a1550000-0000-4000-8000-000000000004',
    slug: 'forja-dos-sabios',
    name: 'Forja dos Sábios',
    description: 'Forje conhecimento sólido na bigorna da guilda: cada sessão é uma martelada.',
    rewardItemId: 'c05e71c0-0000-4000-8000-00000000000b',
  },
] as const;

/** Itens de recompensa novos; o Selo dos Madrugadores (…07) já existe desde o seed da #105. */
const NEW_REWARD_ITEMS = [
  ['c05e71c0-0000-4000-8000-000000000009', 'badge', 'Marcador do Grimório', 'raid:cerco-ao-grimorio', 0],
  ['c05e71c0-0000-4000-8000-00000000000a', 'accessory', 'Lanterna do Silêncio', 'raid:marcha-do-silencio', 0],
  ['c05e71c0-0000-4000-8000-00000000000b', 'badge', 'Brasão da Forja', 'raid:forja-dos-sabios', 0],
] as const;

const SELO_ID = 'c05e71c0-0000-4000-8000-000000000007';

export class AddRaidMissions1788459360000 implements MigrationInterface {
  name = 'AddRaidMissions1788459360000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO cosmetic_items (id, category, name, unlock_condition, requires_premium)
       VALUES ${NEW_REWARD_ITEMS.map(() => '(?, ?, ?, ?, ?)').join(', ')}`,
      NEW_REWARD_ITEMS.flat(),
    );
    await queryRunner.query(
      "UPDATE cosmetic_items SET unlock_condition = 'raid:vigilia-da-aurora' WHERE id = ?",
      [SELO_ID],
    );

    await queryRunner.createTable(new Table({
      name: 'missions',
      engine: 'InnoDB',
      columns: [
        { name: 'id', type: 'varchar', length: '36', isPrimary: true, isNullable: false },
        { name: 'slug', type: 'varchar', length: '255', isNullable: false },
        { name: 'name', type: 'varchar', length: '255', isNullable: false },
        { name: 'description', type: 'varchar', length: '140', isNullable: false },
        { name: 'image_url', type: 'varchar', length: '255', isNullable: true },
        { name: 'reward_cosmetic_item_id', type: 'varchar', length: '36', isNullable: false },
        { name: 'rotation_order', type: 'int', isNullable: false },
      ],
      indices: [
        { name: 'UQ_missions_slug', columnNames: ['slug'], isUnique: true },
        { name: 'UQ_missions_rotation_order', columnNames: ['rotation_order'], isUnique: true },
      ],
      foreignKeys: [{
        name: 'FK_missions_reward_cosmetic_item_id_cosmetic_items',
        columnNames: ['reward_cosmetic_item_id'],
        referencedTableName: 'cosmetic_items',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      }],
    }));
    for (const [index, mission] of MISSIONS.entries()) {
      await queryRunner.query(
        `INSERT INTO missions (id, slug, name, description, image_url, reward_cosmetic_item_id, rotation_order)
         VALUES (?, ?, ?, ?, NULL, ?, ?)`,
        [mission.id, mission.slug, mission.name, mission.description, mission.rewardItemId, index + 1],
      );
    }

    // A Raid herda o título da Missão: as Raids históricas ganham a Missão que o rodízio daria à semana delas.
    await queryRunner.query('ALTER TABLE raids ADD COLUMN mission_id varchar(36) NULL AFTER guild_id');
    const historical = (await queryRunner.query('SELECT id, starts_at FROM raids')) as Array<{ id: string; starts_at: Date }>;
    for (const raid of historical) {
      const week = raidWeekAt(new Date(raid.starts_at));
      await queryRunner.query('UPDATE raids SET mission_id = ? WHERE id = ?', [
        MISSIONS[missionIndexForWeek(week.number, MISSIONS.length)]!.id,
        raid.id,
      ]);
    }
    await queryRunner.query('ALTER TABLE raids MODIFY COLUMN mission_id varchar(36) NOT NULL');
    await queryRunner.query('ALTER TABLE raids ADD INDEX IDX_raids_mission_id (mission_id)');
    await queryRunner.query(
      `ALTER TABLE raids ADD CONSTRAINT FK_raids_mission_id_missions
       FOREIGN KEY (mission_id) REFERENCES missions (id) ON DELETE RESTRICT`,
    );
    await queryRunner.query('ALTER TABLE raids DROP COLUMN title');

    // As Guilds que já existem recebem a Raid da semana corrente, com a meta proporcional ao que falta.
    const now = new Date();
    const week = raidWeekAt(now);
    const guilds = (await queryRunner.query(
      `SELECT g.id, COUNT(m.id) AS members FROM guilds g
       LEFT JOIN guild_memberships m ON m.guild_id = g.id
       WHERE NOT EXISTS (SELECT 1 FROM raids r WHERE r.guild_id = g.id AND r.starts_at <= ? AND r.ends_at >= ?)
       GROUP BY g.id`,
      [week.endsAt, week.startsAt],
    )) as Array<{ id: string; members: string | number }>;
    const mission = MISSIONS[missionIndexForWeek(week.number, MISSIONS.length)]!;
    for (const guild of guilds) {
      await queryRunner.query(
        `INSERT INTO raids (id, guild_id, mission_id, goal_xp, progress_xp, starts_at, ends_at, status)
         VALUES (UUID(), ?, ?, ?, 0, ?, ?, 'active')`,
        [guild.id, mission.id, proportionalGoalXp(Math.max(1, Number(guild.members)), week, now), week.startsAt, week.endsAt],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE raids ADD COLUMN title varchar(255) NOT NULL DEFAULT \'\' AFTER guild_id');
    await queryRunner.query('UPDATE raids r JOIN missions m ON m.id = r.mission_id SET r.title = m.name');
    await queryRunner.query('ALTER TABLE raids ALTER COLUMN title DROP DEFAULT');
    await queryRunner.query('ALTER TABLE raids DROP FOREIGN KEY FK_raids_mission_id_missions');
    await queryRunner.query('ALTER TABLE raids DROP COLUMN mission_id');
    await queryRunner.dropTable('missions');

    await queryRunner.query("UPDATE cosmetic_items SET unlock_condition = 'raid:*' WHERE id = ?", [SELO_ID]);
    // Remover o item remove as linhas de Inventário dele (ON DELETE CASCADE).
    await queryRunner.query('DELETE FROM cosmetic_items WHERE id IN (?)', [NEW_REWARD_ITEMS.map(([id]) => id)]);
  }
}
