import {
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { Server, Socket } from 'socket.io';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';

/** Diz a Guild atual de um usuário; registrado pelo módulo de Guildas, que é o dono da associação. */
export type GuildRoomResolver = (userId: string) => Promise<string | null>;

/**
 * Gateway único de tempo real. Toda conexão autenticada entra automaticamente
 * na room `user:{id}` (ADR-009) — múltiplos dispositivos do mesmo usuário
 * recebem o mesmo evento em paralelo. Rooms `guild:{id}` são usadas para
 * chat/ranking/raid (Documento de Arquitetura, seção 3.2): o socket entra na
 * room da Guild do usuário ao conectar, e o módulo de Guildas move todos os
 * sockets do usuário quando ele cria, entra ou sai de uma Guild.
 */
@Injectable()
@WebSocketGateway()
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server: Server;

  private guildOf: GuildRoomResolver | null = null;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly jwtStrategy: JwtStrategy,
  ) {}

  afterInit(server: Server): void {
    server.use((client, next) => {
      return this.authenticate(client, next);
    });
  }

  async handleConnection(client: Socket): Promise<void> {
    if (
      typeof client.data?.userId !== 'string' ||
      typeof client.data?.sessionId !== 'string'
    ) {
      client.disconnect();
      return;
    }

    const userId: string = client.data.userId;
    client.join(`user:${userId}`);
    if (!this.guildOf) return;
    try {
      const guildId = await this.guildOf(userId);
      if (guildId && client.connected) client.join(`guild:${guildId}`);
    } catch (error) {
      this.logger.warn(`Não foi possível colocar ${userId} na room da guilda: ${String(error)}`);
    }
  }

  setGuildRoomResolver(resolver: GuildRoomResolver): void {
    this.guildOf = resolver;
  }

  private async authenticate(
    client: Socket,
    next: (error?: Error) => void,
  ): Promise<void> {
    const token =
      (client.handshake.auth?.token as string | undefined) ??
      (client.handshake.query?.token as string | undefined);

    if (!token) {
      next(new Error('Unauthorized'));
      return;
    }

    try {
      const payload = this.jwt.verify<JwtPayload>(token, {
        secret: this.config.get('JWT_ACCESS_SECRET'),
      });
      const identity = await this.jwtStrategy.validate(payload);
      client.data.userId = identity.sub;
      client.data.sessionId = identity.sessionId;
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`Cliente desconectado: ${client.data?.userId ?? 'anônimo'}`);
  }

  /** Todos os sockets do usuário, em todos os dispositivos, passam a receber os eventos da Guild. */
  joinGuildRoom(userId: string, guildId: string): void {
    this.server?.in(`user:${userId}`).socketsJoin(`guild:${guildId}`);
  }

  /** Todos os sockets do usuário deixam de receber os eventos da Guild, sem reconectar. */
  leaveGuildRoom(userId: string, guildId: string): void {
    this.server?.in(`user:${userId}`).socketsLeave(`guild:${guildId}`);
  }

  emitToUser(userId: string, event: string, payload: unknown): void {
    this.server?.to(`user:${userId}`).emit(event, payload);
  }

  emitToGuild(guildId: string, event: string, payload: unknown): void {
    this.server?.to(`guild:${guildId}`).emit(event, payload);
  }
}
