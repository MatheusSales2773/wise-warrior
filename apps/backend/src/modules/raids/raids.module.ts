import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Mission } from './entities/mission.entity';
import { Raid } from './entities/raid.entity';
import { RaidContribution } from './entities/raid-contribution.entity';
import { RaidParticipation } from './entities/raid-participation.entity';
import { RaidsService } from './raids.service';
import { RaidsController } from './raids.controller';
import { GuildRaidsController } from './guild-raids.controller';
import { RAID_CLOCK, systemRaidClock } from './raid-clock';
import { GuildsModule } from '../guilds/guilds.module';
import { UsersModule } from '../users/users.module';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Raid, RaidContribution, RaidParticipation, Mission]),
    forwardRef(() => GuildsModule),
    UsersModule,
    RealtimeModule,
  ],
  controllers: [RaidsController, GuildRaidsController],
  providers: [RaidsService, { provide: RAID_CLOCK, useValue: systemRaidClock }],
  exports: [RaidsService],
})
export class RaidsModule {}
