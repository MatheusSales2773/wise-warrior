import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

/**
 * Contribuição pela Forja (#114): a Meta batida ganha data própria e deixa de mudar o status, e cada
 * Study Session contribui no máximo uma vez (`study_session_id` único em `raid_contributions`).
 */
export class AddRaidGoalReachedAt1788459480000 implements MigrationInterface {
  name = 'AddRaidGoalReachedAt1788459480000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn('raids', new TableColumn({
      name: 'goal_reached_at',
      type: 'datetime',
      precision: 3,
      isNullable: true,
    }));
    // A Meta batida antiga só existia como status: o momento mais próximo é a última Contribuição.
    await queryRunner.query(
      `UPDATE raids
       SET goal_reached_at = COALESCE(
         (SELECT MAX(contribution.created_at) FROM raid_contributions contribution WHERE contribution.raid_id = raids.id),
         raids.starts_at)
       WHERE progress_xp >= goal_xp`,
    );
    // Na semana corrente, a Raid volta a `active`: só o fechamento decide `completed` ou `expired`.
    await queryRunner.query(
      `UPDATE raids SET status = 'active' WHERE status = 'completed' AND ends_at >= UTC_TIMESTAMP()`,
    );

    // Contribuições repetidas da mesma Study Session saem do progresso antes da unicidade.
    await queryRunner.query(
      `UPDATE raids
       JOIN (
         SELECT duplicate.raid_id, SUM(duplicate.xp_contributed) AS xp
         FROM raid_contributions duplicate
         JOIN raid_contributions kept
           ON kept.study_session_id = duplicate.study_session_id
          AND (kept.created_at < duplicate.created_at OR (kept.created_at = duplicate.created_at AND kept.id < duplicate.id))
         GROUP BY duplicate.raid_id
       ) extra ON extra.raid_id = raids.id
       SET raids.progress_xp = GREATEST(0, raids.progress_xp - extra.xp)`,
    );
    await queryRunner.query(
      `DELETE duplicate FROM raid_contributions duplicate
       JOIN raid_contributions kept
         ON kept.study_session_id = duplicate.study_session_id
        AND (kept.created_at < duplicate.created_at OR (kept.created_at = duplicate.created_at AND kept.id < duplicate.id))`,
    );
    // The unique index is created first so the foreign key on study_session_id is never left without an index.
    await queryRunner.createIndex('raid_contributions', new TableIndex({
      name: 'UQ_raid_contributions_study_session_id',
      columnNames: ['study_session_id'],
      isUnique: true,
    }));
    await queryRunner.dropIndex('raid_contributions', 'IDX_raid_contributions_study_session_id');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createIndex('raid_contributions', new TableIndex({
      name: 'IDX_raid_contributions_study_session_id',
      columnNames: ['study_session_id'],
    }));
    await queryRunner.dropIndex('raid_contributions', 'UQ_raid_contributions_study_session_id');
    await queryRunner.query(
      `UPDATE raids SET status = 'completed' WHERE status = 'active' AND goal_reached_at IS NOT NULL`,
    );
    await queryRunner.dropColumn('raids', 'goal_reached_at');
  }
}
