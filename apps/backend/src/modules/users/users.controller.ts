import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { UsersService } from './users.service';
import { AuthService } from '../auth/auth.service';

@Controller('users/me')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly auth: AuthService,
  ) {}

  @Get()
  getProfile(@CurrentUser() user: JwtPayload) {
    return this.users.getProfile(user.sub);
  }

  @Patch('cosmetics/:itemId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async equipCosmetic(
    @CurrentUser() user: JwtPayload,
    @Param('itemId') itemId: string,
  ): Promise<void> {
    await this.users.equipCosmeticItem(user.sub, itemId);
  }

  /** Lista dispositivos com sessão ativa (ADR-009). */
  @Get('sessions')
  listSessions(@CurrentUser() user: JwtPayload) {
    return this.auth.listActiveSessions(user.sub);
  }

  /** Revoga um dispositivo específico (ex.: notebook antigo esquecido logado). */
  @Delete('sessions/:sessionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeSession(
    @CurrentUser() user: JwtPayload,
    @Param('sessionId') sessionId: string,
  ): Promise<void> {
    await this.auth.revokeSession(user.sub, sessionId);
  }

  /** "Sair de todos os dispositivos". */
  @Delete('sessions')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeAllSessions(@CurrentUser() user: JwtPayload): Promise<void> {
    await this.auth.revokeAllSessions(user.sub);
  }
}
