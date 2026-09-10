import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { RejectBrowserOriginGuard } from './guards/reject-browser-origin.guard';
import { NativeLoginDto } from './dto/native-login.dto';
import { NativeRefreshDto } from './dto/native-refresh.dto';
import { NativeRegisterDto } from './dto/native-register.dto';

/**
 * Transporte iOS/Android. A credencial rotativa é recebida e devolvida pelo
 * corpo, para ser persistida no armazenamento seguro do dispositivo. Reutiliza
 * integralmente o domínio de Session do AuthService — este controller não
 * implementa emissão, rotação, expiração, limite ou revogação próprios.
 */
@Controller('auth/native')
@UseGuards(RejectBrowserOriginGuard)
export class NativeAuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: NativeRegisterDto, @Req() req: Request) {
    const user = await this.auth.register(dto);
    return this.auth.issueSession(user, {
      deviceLabel: dto.deviceLabel,
      userAgent: req.headers['user-agent'],
    });
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: NativeLoginDto, @Req() req: Request) {
    const user = await this.auth.validateCredentials(dto.email, dto.password);
    return this.auth.issueSession(user, {
      deviceLabel: dto.deviceLabel,
      userAgent: req.headers['user-agent'],
    });
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: NativeRefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Body() dto: NativeRefreshDto): Promise<void> {
    await this.auth.logoutByRefreshToken(dto.refreshToken);
  }
}
