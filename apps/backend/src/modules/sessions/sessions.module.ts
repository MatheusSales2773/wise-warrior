import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StudySession } from './entities/study-session.entity';
import { SessionsService } from './sessions.service';
import { SessionsController } from './sessions.controller';
import { ProgressionModule } from '../progression/progression.module';
import { RaidsModule } from '../raids/raids.module';
import { StudySessionStartService } from './study-session-start.service';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [TypeOrmModule.forFeature([StudySession]), ProgressionModule, RaidsModule, UsersModule],
  controllers: [SessionsController],
  providers: [SessionsService, StudySessionStartService],
  exports: [SessionsService],
})
export class SessionsModule {}
