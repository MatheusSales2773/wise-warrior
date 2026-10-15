import { HttpException, Injectable, Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { GuildsService } from '../guilds/guilds.service';
import { ChatRejectedError, ChatService } from './chat.service';
import type { ChatMessageView, ChatPage } from './chat.service';
import { PresenceRegistry } from './presence.registry';

type Ack<T> = ({ ok: true } & T) | { ok: false; error: { code: string; message: string; retryAfterMs?: number } };

interface GuildPayload {
  guildId?: unknown;
}

/**
 * Chat e presença da Guilda sobre o gateway autenticado do `RealtimeGateway`
 * (mesmo servidor Socket.IO). Uma conexão só entra na room `guild:{id}` depois
 * de verificada a associação no banco; nenhum comando aceita room arbitrária.
 *
 * Cliente → servidor (todos respondem por ack):
 *  - `chat:join {guildId}`: (re)entra na room e devolve quem está online;
 *  - `chat:send {guildId, body}`: valida, persiste e distribui;
 *  - `chat:history {guildId, before?, limit?}`: página anterior por `seq`;
 *  - `chat:sync {guildId, afterSeq}`: recupera o que foi perdido ao reconectar.
 * Servidor → room: `chat:message` e `member:online`.
 */
@Injectable()
@WebSocketGateway()
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(ChatGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly chat: ChatService,
    private readonly guilds: GuildsService,
    private readonly presence: PresenceRegistry,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    const userId = client.data?.userId;
    if (typeof userId !== 'string') {
      return;
    }
    try {
      for (const guildId of await this.guilds.guildIdsOf(userId)) {
        this.enter(client, guildId, userId);
      }
    } catch (error) {
      this.logger.warn(`Falha ao entrar nas rooms de guilda: ${String(error)}`);
    }
  }

  handleDisconnect(client: Socket): void {
    const userId: unknown = client.data?.userId;
    const guildIds: Set<string> | undefined = client.data?.chatGuildIds;
    if (typeof userId !== 'string' || !guildIds) {
      return;
    }
    for (const guildId of guildIds) {
      if (this.presence.disconnect(guildId, userId, client.id)) {
        this.server?.to(`guild:${guildId}`).emit('member:online', { guildId, userId, online: false });
      }
    }
    guildIds.clear();
  }

  @SubscribeMessage('chat:join')
  join(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: GuildPayload,
  ): Promise<Ack<{ guildId: string; onlineUserIds: string[] }>> {
    return this.handle(async () => {
      const guildId = requireString(payload?.guildId, 'guildId');
      const userId = client.data.userId as string;
      await this.chat.assertMember(guildId, userId);
      this.enter(client, guildId, userId);
      return { guildId, onlineUserIds: this.presence.onlineUserIds(guildId) };
    });
  }

  @SubscribeMessage('chat:send')
  send(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: GuildPayload & { body?: unknown },
  ): Promise<Ack<{ message: ChatMessageView }>> {
    return this.handle(async () => {
      const guildId = requireString(payload?.guildId, 'guildId');
      const message = await this.chat.send(guildId, client.data.userId as string, payload?.body);
      this.server?.to(`guild:${guildId}`).emit('chat:message', message);
      return { message };
    });
  }

  @SubscribeMessage('chat:history')
  history(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: GuildPayload & { before?: unknown; limit?: unknown },
  ): Promise<Ack<ChatPage>> {
    return this.handle(async () => {
      const guildId = requireString(payload?.guildId, 'guildId');
      return this.chat.history(
        guildId,
        client.data.userId as string,
        optionalInteger(payload?.before, 'before'),
        optionalInteger(payload?.limit, 'limit'),
      );
    });
  }

  @SubscribeMessage('chat:sync')
  sync(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: GuildPayload & { afterSeq?: unknown },
  ): Promise<Ack<{ messages: ChatMessageView[]; onlineUserIds: string[] }>> {
    return this.handle(async () => {
      const guildId = requireString(payload?.guildId, 'guildId');
      const userId = client.data.userId as string;
      const messages = await this.chat.since(guildId, userId, optionalInteger(payload?.afterSeq, 'afterSeq') ?? 0);
      this.enter(client, guildId, userId);
      return { messages, onlineUserIds: this.presence.onlineUserIds(guildId) };
    });
  }

  private enter(client: Socket, guildId: string, userId: string): void {
    const guildIds: Set<string> = (client.data.chatGuildIds ??= new Set<string>());
    guildIds.add(guildId);
    void client.join(`guild:${guildId}`);
    if (this.presence.connect(guildId, userId, client.id)) {
      this.server?.to(`guild:${guildId}`).emit('member:online', { guildId, userId, online: true });
    }
  }

  private async handle<T extends object>(action: () => Promise<T>): Promise<Ack<T>> {
    try {
      return { ok: true, ...(await action()) };
    } catch (error) {
      if (error instanceof ChatRejectedError) {
        return { ok: false, error: { code: error.code, message: error.code, retryAfterMs: error.retryAfterMs } };
      }
      if (error instanceof HttpException) {
        return { ok: false, error: { code: httpCode(error.getStatus()), message: error.message } };
      }
      this.logger.error(String(error));
      return { ok: false, error: { code: 'INTERNAL', message: 'Erro interno' } };
    }
  }
}

function httpCode(status: number): string {
  return status === 403 ? 'FORBIDDEN' : status === 404 ? 'NOT_FOUND' : status === 400 ? 'BAD_REQUEST' : 'ERROR';
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 36) {
    throw new HttpException(`${field} inválido`, 400);
  }
  return value;
}

function optionalInteger(value: unknown, field: string): number | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new HttpException(`${field} inválido`, 400);
  }
  return value;
}
