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
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { RateLimit } from '../../shared/security/rate-limit';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { SessionsService } from './sessions.service';
import { StartSessionDto } from './dto/start-session.dto';
import { StudySessionStartService } from './study-session-start.service';
import { StudySessionTransitionService } from './study-session-transition.service';
import { StudySessionTransitionDto } from './dto/study-session-transition.dto';
import type { RecentSessionResponseDto } from './dto/recent-session-response.dto';
import type { RecentSubjectsResponseDto } from './dto/recent-subjects-response.dto';
import type { FocusCycle } from './domain/focus-cycle';
import type { SessionMetricsResponseDto } from './dto/session-metrics-response.dto';
import type { SessionHistoryPageDto } from './dto/session-history-response.dto';
import { SessionHistoryQueryDto } from './dto/session-history-query.dto';

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
    // An expired running focus stays readable so the returning device completes it and shows the result.
    const snapshot = await this.studySessionStart.active(user.sub);
    if (!snapshot) {
      response.status(HttpStatus.NO_CONTENT);
      return;
    }
    return snapshot;
  }

  @Get('cycle')
  @HttpCode(HttpStatus.OK)
  cycle(@CurrentUser() user: JwtPayload): Promise<FocusCycle> {
    return this.sessions.focusCycle(user.sub);
  }

  @Get('recent')
  @HttpCode(HttpStatus.OK)
  recent(@CurrentUser() user: JwtPayload): Promise<RecentSessionResponseDto[]> {
    return this.sessions.recent(user.sub);
  }

  @Get('subjects/recent')
  @HttpCode(HttpStatus.OK)
  recentSubjects(@CurrentUser() user: JwtPayload): Promise<RecentSubjectsResponseDto> {
    return this.sessions.recentSubjects(user.sub);
  }

  /** Histórico do dia (#17): every Study Session that ended on a UTC day, newest first. */
  @Get('history')
  @HttpCode(HttpStatus.OK)
  history(@CurrentUser() user: JwtPayload, @Query() query: SessionHistoryQueryDto): Promise<SessionHistoryPageDto> {
    return this.sessions.history(user.sub, query);
  }

  @Get('metrics')
  @HttpCode(HttpStatus.OK)
  metrics(@CurrentUser() user: JwtPayload): Promise<SessionMetricsResponseDto> {
    return this.sessions.metrics(user.sub);
  }

  @Post()
  @RateLimit('study-session')
  @HttpCode(HttpStatus.CREATED)
  async start(
    @CurrentUser() user: JwtPayload,
    @Body() dto: StartSessionDto = new StartSessionDto(),
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    await this.studySessionTransitions.completeExpired(user.sub);
    return this.studySessionStart.start(user.sub, user.sessionId, dto, idempotencyKey);
  }

  @Post(':id/pause')
  @RateLimit('study-session')
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
  @RateLimit('study-session')
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
  @RateLimit('study-session')
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
  @RateLimit('study-session')
  @HttpCode(HttpStatus.NO_CONTENT)
  async heartbeat(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ): Promise<void> {
    await this.sessions.heartbeat(user.sub, id);
  }

  @Post(':id/complete')
  @RateLimit('study-session')
  @HttpCode(HttpStatus.OK)
  async complete(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto?: StudySessionTransitionDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    if (!await this.sessions.usesCanonicalStudySessionState(user.sub, id)) {
      return this.sessions.complete(user.sub, id);
    }
    return this.studySessionTransitions.complete({
      userId: user.sub,
      authSessionId: user.sessionId,
      studySessionId: id,
      dto,
      idempotencyKey,
    });
  }
}
