/**
 * Limites e moderação do chat de Guilda. Mantidos num único lugar para que
 * serviço, gateway e testes compartilhem os mesmos números.
 */
export const CHAT_MAX_BODY_LENGTH = 500;
export const CHAT_RETAINED_MESSAGES = 200;
export const CHAT_PAGE_SIZE_DEFAULT = 50;
export const CHAT_PAGE_SIZE_MAX = 100;
/** No máximo 5 mensagens por janela de 10 s por usuário. */
export const CHAT_RATE_LIMIT_MESSAGES = 5;
export const CHAT_RATE_LIMIT_WINDOW_MS = 10_000;

const MAX_REPEATED_CHARACTERS = 15;
const MAX_LINKS = 2;
const MAX_LINES = 8;

export type ChatRejection = 'EMPTY' | 'TOO_LONG' | 'ABUSIVE';

export type ChatBodyResult =
  | { ok: true; body: string }
  | { ok: false; reason: ChatRejection };

/**
 * Normaliza o corpo (remove caracteres de controle, apara espaços) e rejeita
 * conteúdo vazio, longo demais, flood de caracteres repetidos, excesso de
 * links/linhas e termos bloqueados (configuráveis por `CHAT_BLOCKED_TERMS`).
 */
export function sanitizeChatBody(raw: unknown, blockedTerms: readonly string[] = []): ChatBodyResult {
  if (typeof raw !== 'string') {
    return { ok: false, reason: 'EMPTY' };
  }
  // eslint-disable-next-line no-control-regex
  const body = raw.replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, '').replace(/\r\n?/g, '\n').trim();
  if (body.length === 0) {
    return { ok: false, reason: 'EMPTY' };
  }
  if (body.length > CHAT_MAX_BODY_LENGTH) {
    return { ok: false, reason: 'TOO_LONG' };
  }
  if (new RegExp(`(.)\\1{${MAX_REPEATED_CHARACTERS},}`, 'su').test(body)) {
    return { ok: false, reason: 'ABUSIVE' };
  }
  if ((body.match(/https?:\/\//gi) ?? []).length > MAX_LINKS || body.split('\n').length > MAX_LINES) {
    return { ok: false, reason: 'ABUSIVE' };
  }
  const folded = fold(body);
  if (blockedTerms.some((term) => term.length > 0 && folded.includes(fold(term)))) {
    return { ok: false, reason: 'ABUSIVE' };
  }
  return { ok: true, body };
}

function fold(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

export function parseBlockedTerms(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((term) => term.trim())
    .filter((term) => term.length > 0);
}

/** Janela deslizante em memória (instância única, ADR-003: sem Redis na Fase 1). */
export class SlidingWindowRateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly limit = CHAT_RATE_LIMIT_MESSAGES,
    private readonly windowMs = CHAT_RATE_LIMIT_WINDOW_MS,
    private readonly now: () => number = Date.now,
  ) {}

  /** Registra uma tentativa; devolve `null` se permitida ou os ms até liberar. */
  consume(key: string): number | null {
    const now = this.now();
    const recent = (this.hits.get(key) ?? []).filter((at) => now - at < this.windowMs);
    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      return this.windowMs - (now - (recent[0] ?? now));
    }
    recent.push(now);
    this.hits.set(key, recent);
    return null;
  }
}
