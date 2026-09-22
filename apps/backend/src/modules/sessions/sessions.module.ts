import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StudySession } from './entities/study-session.entity';
import { SessionsService } from './sessions.service';
import { SessionsController } from './sessions.controller';
import { ProgressionModule } from '../progression/progression.module';
import { RaidsModule } from '../raids/raids.module';
import { StudySessionStartService } from './study-session-start.service';
import { UsersModule } from '../users/users.module';
import { StudySessionTransitionService, STUDY_SESSION_CLOCK } from './study-session-transition.service';

@Module({
  imports: [TypeOrmModule.forFeature([StudySession]), ProgressionModule, RaidsModule, UsersModule],
  controllers: [SessionsController],
  providers: [
    SessionsService,
    StudySessionStartService,
    StudySessionTransitionService,
    { provide: STUDY_SESSION_CLOCK, useValue: { now: () => new Date() } },
  ],
  exports: [SessionsService],
})
export class SessionsModule {}
