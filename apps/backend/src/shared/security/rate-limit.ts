import {
  applyDecorators,
  ExecutionContext,
  Injectable,
  Module,
  SetMetadata,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ThrottlerException,
  ThrottlerGuard,
  ThrottlerModule,
  type ThrottlerLimitDetail,
  type ThrottlerOptions,
} from '@nestjs/throttler';
import type { Request, Response } from 'express';

/**
 * Rate limiting (#13, PRD seção 13). Cada rota protegida pertence a um único limite nomeado; os demais
 * limites a ignoram. O contador é por rota: login e cadastro têm contadores separados.
 *
 * - `credentials`: login e cadastro, Web e nativo. Por IP, padrão 10 a cada 60 s.
 * - `refresh`: renovação de Session, Web e nativo. Por IP, padrão 30 a cada 60 s.
 * - `study-session`: iniciar, pausar, retomar, encerrar, heartbeat e concluir. Por usuário, padrão 60 a
 *   cada 60 s, para colegas na mesma rede não se bloquearem.
 * - `shop`: Compras na Loja (#166). Por usuário, padrão 30 a cada 60 s.
 * - `mission-choice`: escolha da Missão da próxima Raid pelo Líder (#168). Por usuário, padrão 30 a cada 60 s.
 *
 * Os valores vêm de `RATE_LIMIT_<LIMITE>_LIMIT` e `RATE_LIMIT_<LIMITE>_TTL_SECONDS`.
 */
export type RateLimitName = 'credentials' | 'refresh' | 'study-session' | 'shop' | 'mission-choice';

const RATE_LIMIT_KEY = 'wise:rate-limit';

/** `perUser`: o contador é por usuário autenticado (IP só como reserva); sem ele, é por IP. */
const DEFAULTS: Record<RateLimitName, { limit: number; ttlSeconds: number; envPrefix: string; perUser?: boolean }> = {
  credentials: { limit: 10, ttlSeconds: 60, envPrefix: 'RATE_LIMIT_CREDENTIALS' },
  refresh: { limit: 30, ttlSeconds: 60, envPrefix: 'RATE_LIMIT_REFRESH' },
  'study-session': { limit: 60, ttlSeconds: 60, envPrefix: 'RATE_LIMIT_STUDY_SESSION', perUser: true },
  shop: { limit: 30, ttlSeconds: 60, envPrefix: 'RATE_LIMIT_SHOP', perUser: true },
  'mission-choice': { limit: 30, ttlSeconds: 60, envPrefix: 'RATE_LIMIT_MISSION_CHOICE', perUser: true },
};

export const RATE_LIMIT_MESSAGE = 'Muitas requisições. Aguarde um instante e tente novamente.';

function routeRateLimit(context: ExecutionContext): RateLimitName | undefined {
  return (
    Reflect.getMetadata(RATE_LIMIT_KEY, context.getHandler()) ??
    Reflect.getMetadata(RATE_LIMIT_KEY, context.getClass())
  );
}

function clientIp(req: Record<string, unknown>): string {
  return (req as unknown as Request).ip ?? 'unknown';
}

/** Depois do `JwtAuthGuard`, o usuário autenticado; antes dele, o IP. */
function userOrIp(req: Record<string, unknown>): string {
  const userId = (req as { user?: { sub?: string } }).user?.sub;
  return userId ? `user:${userId}` : `ip:${clientIp(req)}`;
}

/** Vazio ou ausente usa o padrão: o Docker Compose repassa variáveis opcionais como string vazia. */
function readPositiveInteger(config: ConfigService, key: string, fallback: number): number {
  const raw = config.get<string | number>(key);
  const value = raw === undefined || raw === null ? '' : String(raw).trim();
  return value === '' ? fallback : Number(value);
}

export function createRateLimitOptions(config: ConfigService): ThrottlerOptions[] {
  return (Object.keys(DEFAULTS) as RateLimitName[]).map((name) => {
    const { limit, ttlSeconds, envPrefix, perUser } = DEFAULTS[name];
    return {
      name,
      limit: readPositiveInteger(config, `${envPrefix}_LIMIT`, limit),
      ttl: readPositiveInteger(config, `${envPrefix}_TTL_SECONDS`, ttlSeconds) * 1000,
      skipIf: (context: ExecutionContext) => routeRateLimit(context) !== name,
      getTracker: perUser ? userOrIp : clientIp,
    };
  });
}

/** Responde 429 em RFC 7807 (pelo `HttpExceptionFilter`) com o `Retry-After` padrão, em segundos. */
@Injectable()
export class RateLimitGuard extends ThrottlerGuard {
  protected override async throwThrottlingException(
    context: ExecutionContext,
    detail: ThrottlerLimitDetail,
  ): Promise<void> {
    context.switchToHttp().getResponse<Response>().header('Retry-After', String(detail.timeToBlockExpire));
    throw new ThrottlerException(RATE_LIMIT_MESSAGE);
  }
}

/** Aplica um limite nomeado à rota ou ao controller. Em rotas autenticadas, roda depois do `JwtAuthGuard` do controller. */
export function RateLimit(name: RateLimitName): MethodDecorator & ClassDecorator {
  return applyDecorators(SetMetadata(RATE_LIMIT_KEY, name), UseGuards(RateLimitGuard));
}

/** Contadores em memória: o MVP roda em uma réplica (ADR-003). Com a 2ª réplica, trocar o storage. */
@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: createRateLimitOptions(config),
        setHeaders: false,
      }),
    }),
  ],
})
export class RateLimitModule {}
