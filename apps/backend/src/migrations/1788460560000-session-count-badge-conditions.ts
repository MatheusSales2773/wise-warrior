import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ADR-014 (Crônicas 7/8, #304): Madrugador e Cem Sessões passam de nível para hábito de estudo. Só a Condição de
 * desbloqueio muda; o Inventário não é tocado, então quem já tem os Badges pela regra de nível continua com eles.
 */
export const MADRUGADOR_ID = 'c05e71c0-0000-4000-8000-000000000003';
export const CEM_SESSOES_ID = 'c05e71c0-0000-4000-8000-000000000006';

export class SessionCountBadgeConditions1788460560000 implements MigrationInterface {
  name = 'SessionCountBadgeConditions1788460560000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("UPDATE cosmetic_items SET unlock_condition = 'early-sessions:5' WHERE id = ?", [MADRUGADOR_ID]);
    await queryRunner.query("UPDATE cosmetic_items SET unlock_condition = 'sessions:100' WHERE id = ?", [CEM_SESSOES_ID]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("UPDATE cosmetic_items SET unlock_condition = 'level:3' WHERE id = ?", [MADRUGADOR_ID]);
    await queryRunner.query("UPDATE cosmetic_items SET unlock_condition = 'level:12' WHERE id = ?", [CEM_SESSOES_ID]);
  }
}
