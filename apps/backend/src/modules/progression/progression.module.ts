import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Character } from './entities/character.entity';
import { ProgressionService } from './progression.service';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [TypeOrmModule.forFeature([Character]), RealtimeModule],
  providers: [ProgressionService],
  exports: [ProgressionService],
})
export class ProgressionModule {}
