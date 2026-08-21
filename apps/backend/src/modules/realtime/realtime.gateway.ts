import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { Server, Socket } from 'socket.io';

/**
 * Gateway único de tempo real. Toda conexão autenticada entra automaticamente
 * na room `user:{id}` (ADR-009) — múltiplos dispositivos do mesmo usuário
 * recebem o mesmo evento em paralelo. Rooms `guild:{id}` são usadas para
 * chat/ranking/raid (Documento de Arquitetura, seção 3.2).
 */
@Injectable()
@WebSocketGateway({ cors: { origin: process.env.CORS_ORIGIN ?? '*', credentials: true } })
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  handleConnection(client: Socket): void {
    const token =
      (client.handshake.auth?.token as string | undefined) ??
      (client.handshake.query?.token as string | undefined);

    if (!token) {
      client.disconnect();
      return;
    }

    try {
      const payload = this.jwt.verify<{ sub: string }>(token, {
        secret: this.config.get('JWT_ACCESS_SECRET'),
      });
      client.data.userId = payload.sub;
      client.join(`user:${payload.sub}`);
    } catch {
      client.disconnect();
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
