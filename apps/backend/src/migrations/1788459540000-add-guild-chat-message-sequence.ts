import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `sent_at` and the UUID id cannot order messages that land in the same
 * microsecond, so pagination and reconnection use a monotonic `seq` instead.
 */
export class AddGuildChatMessageSequence1788459540000 implements MigrationInterface {
  name = 'AddGuildChatMessageSequence1788459540000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `guild_chat_messages` ADD COLUMN `seq` BIGINT NOT NULL AUTO_INCREMENT, ADD UNIQUE KEY `UQ_guild_chat_messages_seq` (`seq`)',
    );
    await queryRunner.query(
      'CREATE INDEX `IDX_guild_chat_messages_guild_id_seq` ON `guild_chat_messages` (`guild_id`, `seq`)',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX `IDX_guild_chat_messages_guild_id_seq` ON `guild_chat_messages`');
    await queryRunner.query('ALTER TABLE `guild_chat_messages` DROP COLUMN `seq`');
  }
}
