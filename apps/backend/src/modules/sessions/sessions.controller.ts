import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { SessionsService } from './sessions.service';
import { StartSessionDto } from './dto/start-session.dto';
import { StudySessionStartService } from './study-session-start.service';
import { StudySessionTransitionService } from './study-session-transition.service';
import { StudySessionTransitionDto } from './dto/study-session-transition.dto';
import type { RecentSessionResponseDto } from './dto/recent-session-response.dto';
import type { SessionMetricsResponseDto } from './dto/session-metrics-response.dto';

@Controller('sessions')
@UseGuards(JwtAuthGuard)
export class SessionsController {
  constructor(
    private readonly sessions: SessionsService,
    private readonly studySessionStart: StudySessionStartService,
    private readonly studySessionTransitions: StudySessionTransitionService,
  ) {}

  @Get('active')
  async active(@CurrentUser() user: JwtPayload, @Res({ passthrough: true }) response: Response) {
    const snapshot = await this.studySessionStart.active(user.sub, user.sessionId);
    if (!snapshot) {
      response.status(HttpStatus.NO_CONTENT);
      return;
    }
    return snapshot;
  }

  @Get('recent')
  @HttpCode(HttpStatus.OK)
  recent(@CurrentUser() user: JwtPayload): Promise<RecentSessionResponseDto[]> {
    return this.sessions.recent(user.sub);
  }

  @Get('metrics')
  @HttpCode(HttpStatus.OK)
  metrics(@CurrentUser() user: JwtPayload): Promise<SessionMetricsResponseDto> {
    return this.sessions.metrics(user.sub);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  start(
    @CurrentUser() user: JwtPayload,
    @Body() dto: StartSessionDto = new StartSessionDto(),
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.studySessionStart.start(user.sub, user.sessionId, dto, idempotencyKey);
  }

  @Post(':id/pause')
  @HttpCode(HttpStatus.OK)
  pause(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: StudySessionTransitionDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.studySessionTransitions.pause({
      userId: user.sub,
      authSessionId: user.sessionId,
      studySessionId: id,
      dto,
      idempotencyKey,
    });
  }

  @Post(':id/resume')
  @HttpCode(HttpStatus.OK)
  resume(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: StudySessionTransitionDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.studySessionTransitions.resume({
      userId: user.sub,
      authSessionId: user.sessionId,
      studySessionId: id,
      dto,
      idempotencyKey,
    });
  }

  @Post(':id/stop')
  @HttpCode(HttpStatus.OK)
  stop(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: StudySessionTransitionDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.studySessionTransitions.stop({
      userId: user.sub,
      authSessionId: user.sessionId,
      studySessionId: id,
      dto,
      idempotencyKey,
    });
  }

  @Patch(':id/heartbeat')
  @HttpCode(HttpStatus.NO_CONTENT)
  async heartbeat(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ): Promise<void> {
    await this.sessions.heartbeat(user.sub, id, user.sessionId);
  }

  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  complete(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.sessions.complete(user.sub, id);
  }
}
