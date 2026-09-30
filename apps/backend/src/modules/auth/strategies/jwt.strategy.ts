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

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    @InjectRepository(Session) private readonly sessions: Repository<Session>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_ACCESS_SECRET') ?? 'change-me-access',
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
