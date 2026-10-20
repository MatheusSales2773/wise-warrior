import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Avisos do Mural: a message with no human author that announces a Golpe. `kind` tells it from a member's message
 * and `contribution_id` points at the Contribution it announces, uniquely, so a Golpe is announced once and the
 * Aviso goes away with its Contribution. The author stays in `user_id` so the client shows the current name.
 */
export class AddGuildChatNotices1788460260000 implements MigrationInterface {
  name = 'AddGuildChatNotices1788460260000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "ALTER TABLE `guild_chat_messages` ADD COLUMN `kind` VARCHAR(16) NOT NULL DEFAULT 'message', ADD COLUMN `contribution_id` VARCHAR(36) NULL, ADD COLUMN `xp` INT NULL",
    );
    await queryRunner.query(
      'CREATE UNIQUE INDEX `UQ_guild_chat_messages_contribution_id` ON `guild_chat_messages` (`contribution_id`)',
    );
    await queryRunner.query(
      'ALTER TABLE `guild_chat_messages` ADD CONSTRAINT `FK_guild_chat_messages_contribution_id_raid_contributions` FOREIGN KEY (`contribution_id`) REFERENCES `raid_contributions`(`id`) ON DELETE CASCADE',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DELETE FROM `guild_chat_messages` WHERE `kind` <> \'message\'');
    await queryRunner.query('ALTER TABLE `guild_chat_messages` DROP FOREIGN KEY `FK_guild_chat_messages_contribution_id_raid_contributions`');
    await queryRunner.query('DROP INDEX `UQ_guild_chat_messages_contribution_id` ON `guild_chat_messages`');
    await queryRunner.query('ALTER TABLE `guild_chat_messages` DROP COLUMN `xp`, DROP COLUMN `contribution_id`, DROP COLUMN `kind`');
  }
}
