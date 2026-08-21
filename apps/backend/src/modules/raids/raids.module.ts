import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Raid } from './entities/raid.entity';
import { RaidContribution } from './entities/raid-contribution.entity';
import { RaidsService } from './raids.service';
import { RaidsController } from './raids.controller';
import { GuildsModule } from '../guilds/guilds.module';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Raid, RaidContribution]),
    GuildsModule,
    RealtimeModule,
  ],
  controllers: [RaidsController],
  providers: [RaidsService],
  exports: [RaidsService],
})
export class RaidsModule {}
