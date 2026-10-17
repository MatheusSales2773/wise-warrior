import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GuildChatMessage } from '../guilds/entities/guild-chat-message.entity';
import { GuildsModule } from '../guilds/guilds.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { PresenceRegistry } from './presence.registry';

@Module({
  imports: [TypeOrmModule.forFeature([GuildChatMessage]), forwardRef(() => GuildsModule), forwardRef(() => RealtimeModule)],
  providers: [ChatService, ChatGateway, PresenceRegistry],
  exports: [ChatService],
})
export class ChatModule {}
