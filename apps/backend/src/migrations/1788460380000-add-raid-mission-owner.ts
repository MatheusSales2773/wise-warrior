import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Dono da Missão escolhida (#197, ADR-012): a Raid guarda de quem era a Missão que o Líder escolheu, para a tela
 * mostrar "Missão de <nome>". Nulo é a Missão do rodízio (e Raids anteriores). Sem chave estrangeira: o dono pode sair
 * da Guild e da conta sem apagar a Raid.
 */
export class AddRaidMissionOwner1788460380000 implements MigrationInterface {
  name = 'AddRaidMissionOwner1788460380000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'raids',
      new TableColumn({ name: 'mission_owner_user_id', type: 'varchar', length: '36', isNullable: true }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('raids', 'mission_owner_user_id');
  }
}
