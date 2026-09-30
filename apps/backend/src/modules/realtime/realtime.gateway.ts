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
  ) {}

  afterInit(server: Server): void {
    server.use((client, next) => {
      return this.authenticate(client, next);
    });
  }

  handleConnection(client: Socket): void {
    if (
      typeof client.data?.userId !== 'string' ||
      typeof client.data?.sessionId !== 'string'
    ) {
      client.disconnect();
      return;
    }

    client.join(`user:${client.data.userId}`);
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

  joinGuildRoom(client: Socket, guildId: string): void {
    client.join(`guild:${guildId}`);
  }

  emitToUser(userId: string, event: string, payload: unknown): void {
    this.server?.to(`user:${userId}`).emit(event, payload);
  }

  emitToGuild(guildId: string, event: string, payload: unknown): void {
    this.server?.to(`guild:${guildId}`).emit(event, payload);
  }
}
