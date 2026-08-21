import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService, AuthTokens } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

const REFRESH_COOKIE = 'ww_refresh';
const REFRESH_COOKIE_PATH = '/api/v1/auth';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.auth.register(dto);
    const tokens = await this.auth.issueSession(user, {
      userAgent: req.headers['user-agent'],
    });
    return this.attachRefreshCookie(tokens, res);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.auth.validateCredentials(dto.email, dto.password);
    const tokens = await this.auth.issueSession(user, {
      deviceLabel: dto.deviceLabel,
      userAgent: req.headers['user-agent'],
    });
    return this.attachRefreshCookie(tokens, res);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) {
      throw new UnauthorizedException('Refresh token ausente');
    }
    const tokens = await this.auth.refresh(token);
    return this.attachRefreshCookie(tokens, res);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (token) {
      await this.auth.logoutByRefreshToken(token);
    }
    res.clearCookie(REFRESH_COOKIE, { path: REFRESH_COOKIE_PATH });
  }

  private attachRefreshCookie(tokens: AuthTokens, res: Response) {
    res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: Number(process.env.JWT_REFRESH_TTL_DAYS ?? 30) * 24 * 60 * 60 * 1000,
      path: REFRESH_COOKIE_PATH,
    });
    return { accessToken: tokens.accessToken };
  }
}
