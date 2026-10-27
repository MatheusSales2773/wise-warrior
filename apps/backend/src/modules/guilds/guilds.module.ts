import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Guild } from './entities/guild.entity';
import { GuildMembership } from './entities/guild-membership.entity';
import { GuildChatMessage } from './entities/guild-chat-message.entity';
import { GuildsService } from './guilds.service';
import { GuildsController } from './guilds.controller';
import { RaidsModule } from '../raids/raids.module';
import { UsersModule } from '../users/users.module';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Guild, GuildMembership, GuildChatMessage]),
    forwardRef(() => RaidsModule),
    forwardRef(() => UsersModule),
    forwardRef(() => RealtimeModule),
  ],
  controllers: [GuildsController],
  providers: [GuildsService],
  exports: [GuildsService],
})
export class GuildsModule {}
