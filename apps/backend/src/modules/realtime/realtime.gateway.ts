import {
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { Server, Socket } from 'socket.io';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { GuildsService } from '../guilds/guilds.service';

const GUILD_ROOM_PREFIX = 'guild:';
const userRoom = (userId: string) => `user:${userId}`;
const sessionRoom = (sessionId: string) => `session:${sessionId}`;
const guildRoom = (guildId: string) => `${GUILD_ROOM_PREFIX}${guildId}`;

/**
 * Gateway único de tempo real. Toda conexão autenticada entra automaticamente
 * na room `user:{id}` (ADR-009) — múltiplos dispositivos do mesmo usuário
 * recebem o mesmo evento em paralelo. Rooms `guild:{id}` são usadas para
 * chat/ranking/raid (Documento de Arquitetura, seção 3.2).
 */
@Injectable()
@WebSocketGateway()
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly jwtStrategy: JwtStrategy,
    @Inject(forwardRef(() => GuildsService))
    private readonly guilds: GuildsService,
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

    await client.join(userRoom(client.data.userId));
    await client.join(sessionRoom(client.data.sessionId));
    // A revocation that landed between the handshake and this join found an empty session room.
    if (!(await this.sessionStillValid(client))) {
      client.disconnect(true);
      return;
    }
    try {
      await this.joinCurrentGuildRoom(client);
    } catch (error) {
      this.logger.warn(`Falha ao entrar na room da Guild: ${(error as Error).message}`);
    }
  }

  private async sessionStillValid(client: Socket): Promise<boolean> {
    try {
      await this.jwtStrategy.validate(client.data.identity as JwtPayload);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * The socket is already in its user room, so a concurrent `syncGuildRoom` reaches it. Reading the membership
   * again after joining catches a change that landed while the first read was in flight.
   */
  private async joinCurrentGuildRoom(client: Socket): Promise<void> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const guildId = await this.guilds.findGuildIdOf(client.data.userId);
      const target = guildId ? guildRoom(guildId) : null;
      for (const room of client.rooms) {
        if (room.startsWith(GUILD_ROOM_PREFIX) && room !== target) await client.leave(room);
      }
      if (target) await client.join(target);
      if (attempt === 1 || guildId === (await this.guilds.findGuildIdOf(client.data.userId))) return;
    }
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
      client.data.identity = payload;
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`Cliente desconectado: ${client.data?.userId ?? 'anônimo'}`);
  }

  joinGuildRoom(client: Socket, guildId: string): void {
    client.join(guildRoom(guildId));
  }

  /**
   * Aponta todos os sockets do usuário para a room da Guild atual (ou nenhuma), sem reconectar.
   * Chamado depois do commit de criar, entrar ou sair de uma Guild.
   */
  async syncGuildRoom(userId: string, guildId: string | null): Promise<void> {
    if (!this.server) return;
    try {
      const sockets = await this.server.in(userRoom(userId)).fetchSockets();
      const target = guildId ? guildRoom(guildId) : null;
      for (const socket of sockets) {
        for (const room of socket.rooms) {
          if (room.startsWith(GUILD_ROOM_PREFIX) && room !== target) socket.leave(room);
        }
        if (target) socket.join(target);
      }
    } catch (error) {
      // O membership já foi commitado; a próxima conexão volta a sincronizar a room.
      this.logger.warn(`Falha ao sincronizar a room da Guild: ${(error as Error).message}`);
    }
  }

  /**
   * Encerra os sockets das Sessões revogadas (logout, revogação de dispositivo, replay de refresh, limite de
   * dispositivos). O access token já emitido continua válido até expirar, mas a conexão em tempo real não.
   */
  async disconnectSessions(sessionIds: readonly string[]): Promise<void> {
    if (!this.server) return;
    for (const sessionId of sessionIds) {
      try {
        this.server.in(sessionRoom(sessionId)).disconnectSockets(true);
      } catch (error) {
        this.logger.warn(`Falha ao encerrar sockets da Sessão: ${(error as Error).message}`);
      }
    }
  }

  emitToUser(userId: string, event: string, payload: unknown): void {
    this.server?.to(userRoom(userId)).emit(event, payload);
  }

  emitToGuild(guildId: string, event: string, payload: unknown): void {
    this.server?.to(guildRoom(guildId)).emit(event, payload);
  }
}
