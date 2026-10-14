import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';
import { Session } from '../entities/session.entity';

export interface JwtPayload {
  sub: string;
  email: string;
  sessionId: string;
}

/** Sem fallback: um segredo de exemplo embutido validaria tokens forjados com ele (#13). */
function requireAccessSecret(config: ConfigService): string {
  const secret = config.get<string>('JWT_ACCESS_SECRET');
  if (!secret) {
    throw new Error('JWT_ACCESS_SECRET não configurado');
  }
  return secret;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    @InjectRepository(Session) private readonly sessions: Repository<Session>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: requireAccessSecret(config),
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    if (
      typeof payload?.sub !== 'string' ||
      payload.sub.trim() === '' ||
      typeof payload.email !== 'string' ||
      payload.email.trim() === '' ||
      typeof payload.sessionId !== 'string' ||
      payload.sessionId.trim() === ''
    ) {
      throw new UnauthorizedException();
    }

    const session = await this.sessions.findOne({
      where: { id: payload.sessionId, userId: payload.sub },
    });
    if (!session || session.revokedAt) {
      throw new UnauthorizedException();
    }

    return payload;
  }
}
