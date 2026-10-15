import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, LessThanOrEqual, MoreThan, Repository } from 'typeorm';
import { GuildChatMessage } from '../guilds/entities/guild-chat-message.entity';
import { GuildsService } from '../guilds/guilds.service';
import {
  CHAT_PAGE_SIZE_DEFAULT,
  CHAT_PAGE_SIZE_MAX,
  CHAT_RETAINED_MESSAGES,
  SlidingWindowRateLimiter,
  parseBlockedTerms,
  sanitizeChatBody,
  type ChatRejection,
} from './chat-policy';

export interface ChatMessageView {
  id: string;
  seq: number;
  guildId: string;
  userId: string;
  displayName: string;
  body: string;
  sentAt: string;
}

export interface ChatPage {
  /** Em ordem cronológica (mais antiga primeiro). */
  messages: ChatMessageView[];
  /** Passe como `before` para a página anterior; `null` quando não há mais. */
  nextBefore: number | null;
}

export interface ChatSync {
  messages: ChatMessageView[];
  truncated: boolean;
}

export class ChatRejectedError extends Error {
  constructor(
    readonly code: ChatRejection | 'RATE_LIMITED',
    readonly retryAfterMs?: number,
  ) {
    super(code);
  }
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly limiter = new SlidingWindowRateLimiter();
  private readonly blockedTerms: string[];

  constructor(
    @InjectRepository(GuildChatMessage)
    private readonly messages: Repository<GuildChatMessage>,
    private readonly guilds: GuildsService,
    config: ConfigService,
  ) {
    this.blockedTerms = parseBlockedTerms(config.get<string>('CHAT_BLOCKED_TERMS'));
  }

  async assertMember(guildId: string, userId: string): Promise<void> {
    if (!(await this.guilds.isMember(guildId, userId))) {
      throw new ForbiddenException('Você não é membro desta guilda');
    }
  }

  async send(guildId: string, userId: string, raw: unknown): Promise<ChatMessageView> {
    await this.assertMember(guildId, userId);
    // Toda tentativa de membro consome cota, inclusive as rejeitadas pelo conteúdo.
    const retryAfterMs = this.limiter.consume(userId);
    if (retryAfterMs !== null) {
      throw new ChatRejectedError('RATE_LIMITED', retryAfterMs);
    }
    const checked = sanitizeChatBody(raw, this.blockedTerms);
    if (!checked.ok) {
      throw new ChatRejectedError(checked.reason);
    }

    const saved = await this.messages.save(
      this.messages.create({ guildId, userId, body: checked.body }),
    );
    const stored = await this.messages.findOneOrFail({
      where: { id: saved.id },
      relations: { user: true },
    });
    // A mensagem já está salva: a poda é best-effort para não falhar o envio depois da persistência.
    await this.prune(guildId).catch((error) => this.logger.warn(`Falha ao podar o chat: ${String(error)}`));
    return toView(stored);
  }

  /** Página das mensagens mais recentes (ou anteriores a `before`), paginada por `seq`. */
  async history(guildId: string, userId: string, before?: number, limit?: number): Promise<ChatPage> {
    await this.assertMember(guildId, userId);
    const size = clamp(limit ?? CHAT_PAGE_SIZE_DEFAULT, 1, CHAT_PAGE_SIZE_MAX);
    const rows = await this.messages.find({
      where: { guildId, ...(before !== undefined ? { seq: LessThan(before) } : {}) },
      relations: { user: true },
      order: { seq: 'DESC' },
      take: size + 1,
    });
    const hasMore = rows.length > size;
    const page = rows.slice(0, size).reverse();
    return {
      messages: page.map(toView),
      nextBefore: hasMore ? (page[0]?.seq ?? null) : null,
    };
  }

  /** Mensagens perdidas durante uma desconexão: estritamente posteriores a `afterSeq`. */
  async messagesAfter(guildId: string, userId: string, afterSeq: number): Promise<ChatSync> {
    await this.assertMember(guildId, userId);
    const rows = await this.messages.find({
      where: { guildId, seq: MoreThan(afterSeq) },
      relations: { user: true },
      order: { seq: 'ASC' },
      take: CHAT_RETAINED_MESSAGES,
    });
    // `truncated`: o cliente ficou fora por mais que a retenção; deve recarregar via `chat:history`.
    return { messages: rows.map(toView), truncated: rows.length === CHAT_RETAINED_MESSAGES };
  }

  /** Mantém só as últimas N mensagens da Guilda (Documento de Arquitetura). */
  private async prune(guildId: string): Promise<void> {
    const boundary = await this.messages.find({
      where: { guildId },
      select: { id: true, seq: true },
      order: { seq: 'DESC' },
      skip: CHAT_RETAINED_MESSAGES,
      take: 1,
    });
    const oldestKept = boundary[0];
    if (oldestKept) {
      await this.messages.delete({ guildId, seq: LessThanOrEqual(oldestKept.seq) });
    }
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(Math.trunc(value) || min, min), max);
}

function toView(row: GuildChatMessage): ChatMessageView {
  return {
    id: row.id,
    seq: row.seq,
    guildId: row.guildId,
    userId: row.userId,
    displayName: row.user.displayName,
    body: row.body,
    sentAt: row.sentAt.toISOString(),
  };
}
