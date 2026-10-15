import { Injectable } from '@nestjs/common';

/**
 * Presença por Guilda, contada por socket: um usuário só fica offline quando
 * o último dispositivo sai. Em memória, instância única (ADR-003).
 */
@Injectable()
export class PresenceRegistry {
  private readonly sockets = new Map<string, Map<string, Set<string>>>();

  /** Devolve `true` se o usuário acabou de ficar online na Guilda. */
  connect(guildId: string, userId: string, socketId: string): boolean {
    const users = this.sockets.get(guildId) ?? new Map<string, Set<string>>();
    this.sockets.set(guildId, users);
    const ids = users.get(userId) ?? new Set<string>();
    users.set(userId, ids);
    const wasOffline = ids.size === 0;
    ids.add(socketId);
    return wasOffline;
  }

  /** Devolve `true` se o usuário acabou de ficar offline na Guilda. */
  disconnect(guildId: string, userId: string, socketId: string): boolean {
    const users = this.sockets.get(guildId);
    const ids = users?.get(userId);
    if (!users || !ids || !ids.delete(socketId)) {
      return false;
    }
    if (ids.size > 0) {
      return false;
    }
    users.delete(userId);
    if (users.size === 0) {
      this.sockets.delete(guildId);
    }
    return true;
  }

  onlineUserIds(guildId: string): string[] {
    return [...(this.sockets.get(guildId)?.keys() ?? [])];
  }
}
