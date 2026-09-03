import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as argon2 from 'argon2';
import { IsNull, Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Character } from '../progression/entities/character.entity';
import { Session } from './entities/session.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { randomToken, sha256Hex } from '../../shared/security/hash.util';

export interface DeviceMetadata {
  deviceLabel?: string;
  userAgent?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
}

export interface SessionSummary {
  id: string;
  deviceLabel: string | null;
  userAgent: string | null;
  createdAt: Date;
  lastUsedAt: Date;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Character)
    private readonly characters: Repository<Character>,
    @InjectRepository(Session) private readonly sessions: Repository<Session>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  private get maxSessionsPerUser(): number {
    return Number(this.config.get('MAX_SESSIONS_PER_USER') ?? 5);
  }

  private get refreshTtlMs(): number {
    const days = Number(this.config.get('JWT_REFRESH_TTL_DAYS') ?? 30);
    return days * 24 * 60 * 60 * 1000;
  }

  async register(dto: RegisterDto): Promise<User> {
    const existing = await this.users.findOne({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('E-mail já cadastrado');
    }

    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });
    const user = await this.users.save(
      this.users.create({
        email: dto.email,
        passwordHash,
        displayName: dto.displayName,
        planTier: 'free',
      }),
    );
    await this.characters.save(
      this.characters.create({ userId: user.id, level: 1, xpTotal: 0 }),
    );

    return user;
  }

  async validateCredentials(email: string, password: string): Promise<User> {
    const user = await this.users.findOne({ where: { email } });
    if (!user) {
      throw new UnauthorizedException('Credenciais inválidas');
    }
    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid) {
      throw new UnauthorizedException('Credenciais inválidas');
    }
    return user;
  }

  /** Cria uma nova sessão persistente por dispositivo (ADR-009), sem invalidar as demais. */
  async issueSession(user: User, device: DeviceMetadata): Promise<AuthTokens> {
    await this.enforceSessionLimit(user.id);

    const secret = randomToken();
    const now = new Date();
    const session = await this.sessions.save(
      this.sessions.create({
        userId: user.id,
        refreshTokenHash: sha256Hex(secret),
        deviceLabel: device.deviceLabel,
        userAgent: device.userAgent,
        lastUsedAt: now,
      }),
    );

    const accessToken = this.signAccessToken(user);
    return {
      accessToken,
      refreshToken: `${session.id}.${secret}`,
      sessionId: session.id,
    };
  }

  private async enforceSessionLimit(userId: string): Promise<void> {
    const active = await this.sessions.find({
      where: { userId, revokedAt: IsNull() },
      order: { lastUsedAt: 'ASC' },
    });
    const overLimit = active.length - this.maxSessionsPerUser + 1;
    if (overLimit > 0) {
      const toRevoke = active.slice(0, overLimit);
      await this.sessions.save(
        toRevoke.map((session) => ({ ...session, revokedAt: new Date() })),
      );
    }
  }

  private signAccessToken(user: Pick<User, 'id' | 'email'>): string {
    return this.jwt.sign(
      { sub: user.id, email: user.email },
      {
        secret: this.config.get('JWT_ACCESS_SECRET'),
        expiresIn: this.config.get('JWT_ACCESS_TTL') ?? '15m',
      },
    );
  }

  /** Rotaciona o refresh token — o valor anterior nunca pode ser reaproveitado. */
  async refresh(refreshToken: string): Promise<AuthTokens> {
    const [sessionId, secret] = refreshToken.split('.');
    if (!sessionId || !secret) {
      throw new UnauthorizedException('Refresh token inválido');
    }

    const session = await this.sessions.findOne({ where: { id: sessionId } });
    if (!session || session.revokedAt) {
      throw new UnauthorizedException('Sessão inválida ou revogada');
    }
    if (session.refreshTokenHash !== sha256Hex(secret)) {
      throw new UnauthorizedException('Refresh token inválido');
    }
    const expiresAt = session.lastUsedAt.getTime() + this.refreshTtlMs;
    if (Date.now() > expiresAt) {
      throw new UnauthorizedException('Sessão expirada');
    }

    // select restrito: refresh nunca precisa do password_hash na memória
    // (postgres-pro: nunca puxar mais colunas do que a operação exige).
    const user = await this.users.findOne({
      where: { id: session.userId },
      select: ['id', 'email'],
    });
    if (!user) {
      throw new UnauthorizedException('Usuário não encontrado');
    }

    const newSecret = randomToken();
    session.refreshTokenHash = sha256Hex(newSecret);
    session.lastUsedAt = new Date();
    await this.sessions.save(session);

    return {
      accessToken: this.signAccessToken(user),
      refreshToken: `${session.id}.${newSecret}`,
      sessionId: session.id,
    };
  }

  /** Usado no logout: revoga a sessão dona do refresh token apresentado, sem exigir access token válido. */
  async logoutByRefreshToken(refreshToken: string): Promise<void> {
    const [sessionId, secret] = refreshToken.split('.');
    if (!sessionId || !secret) {
      return;
    }
    const session = await this.sessions.findOne({ where: { id: sessionId } });
    if (!session || session.refreshTokenHash !== sha256Hex(secret)) {
      return;
    }
    session.revokedAt = new Date();
    await this.sessions.save(session);
  }

  async revokeSession(userId: string, sessionId: string): Promise<void> {
    const session = await this.sessions.findOne({
      where: { id: sessionId, userId },
    });
    if (!session) {
      throw new UnauthorizedException('Sessão não encontrada');
    }
    session.revokedAt = new Date();
    await this.sessions.save(session);
  }

  async revokeAllSessions(userId: string): Promise<void> {
    const active = await this.sessions.find({
      where: { userId, revokedAt: IsNull() },
    });
    await this.sessions.save(
      active.map((session) => ({ ...session, revokedAt: new Date() })),
    );
  }

  async listActiveSessions(userId: string): Promise<SessionSummary[]> {
    const active = await this.sessions.find({
      where: { userId, revokedAt: IsNull() },
      order: { lastUsedAt: 'DESC' },
    });
    return active.map((session) => ({
      id: session.id,
      deviceLabel: session.deviceLabel ?? null,
      userAgent: session.userAgent ?? null,
      createdAt: session.createdAt,
      lastUsedAt: session.lastUsedAt,
    }));
  }
}
