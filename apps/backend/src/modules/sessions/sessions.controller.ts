import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { SessionsService } from './sessions.service';
import { StartSessionDto } from './dto/start-session.dto';

@Controller('sessions')
@UseGuards(JwtAuthGuard)
export class SessionsController {
  constructor(private readonly sessions: SessionsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  start(@CurrentUser() user: JwtPayload, @Body() dto: StartSessionDto) {
    return this.sessions.start(user.sub, dto);
  }

  @Patch(':id/heartbeat')
  @HttpCode(HttpStatus.NO_CONTENT)
  async heartbeat(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ): Promise<void> {
    await this.sessions.heartbeat(user.sub, id);
  }

  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  complete(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.sessions.complete(user.sub, id);
  }
}
