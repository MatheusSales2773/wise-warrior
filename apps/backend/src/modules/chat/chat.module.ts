import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GuildChatMessage } from '../guilds/entities/guild-chat-message.entity';
import { GuildsModule } from '../guilds/guilds.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { PresenceRegistry } from './presence.registry';

@Module({
  imports: [TypeOrmModule.forFeature([GuildChatMessage]), GuildsModule, RealtimeModule],
  providers: [ChatService, ChatGateway, PresenceRegistry],
})
export class ChatModule {}
