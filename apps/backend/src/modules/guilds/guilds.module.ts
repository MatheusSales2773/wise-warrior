import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Guild } from './entities/guild.entity';
import { GuildMembership } from './entities/guild-membership.entity';
import { GuildChatMessage } from './entities/guild-chat-message.entity';
import { GuildsService } from './guilds.service';
import { GuildsController } from './guilds.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Guild, GuildMembership, GuildChatMessage])],
  controllers: [GuildsController],
  providers: [GuildsService],
  exports: [GuildsService],
})
export class GuildsModule {}
