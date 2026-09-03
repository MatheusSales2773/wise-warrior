import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StudySession } from './entities/study-session.entity';
import { SessionsService } from './sessions.service';
import { SessionsController } from './sessions.controller';
import { ProgressionModule } from '../progression/progression.module';
import { RaidsModule } from '../raids/raids.module';

@Module({
  imports: [TypeOrmModule.forFeature([StudySession]), ProgressionModule, RaidsModule],
  controllers: [SessionsController],
  providers: [SessionsService],
  exports: [SessionsService],
})
export class SessionsModule {}
