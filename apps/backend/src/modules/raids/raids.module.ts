import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Mission } from './entities/mission.entity';
import { GuildMissionChoice } from './entities/guild-mission-choice.entity';
import { MissionChoiceService } from './mission-choice.service';
import { MissionRewardItem } from './entities/mission-reward-item.entity';
import { UserMission } from './entities/user-mission.entity';
import { MissionsService } from './missions.service';
import { Raid } from './entities/raid.entity';
import { RaidContribution } from './entities/raid-contribution.entity';
import { RaidParticipation } from './entities/raid-participation.entity';
import { RaidsService } from './raids.service';
import { RaidsController } from './raids.controller';
import { GuildMissionChoiceController } from './guild-mission-choice.controller';
import { GuildRaidsController } from './guild-raids.controller';
import { RAID_CLOCK, systemRaidClock } from './raid-clock';
import { RaidWeeklyScheduler } from './raid-weekly.scheduler';
import { GuildsModule } from '../guilds/guilds.module';
import { UsersModule } from '../users/users.module';
import { EconomyModule } from '../economy/economy.module';
import { ChatModule } from '../chat/chat.module';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Raid, RaidContribution, RaidParticipation, Mission, MissionRewardItem, UserMission, GuildMissionChoice]),
    forwardRef(() => GuildsModule),
    forwardRef(() => UsersModule),
    forwardRef(() => RealtimeModule),
    forwardRef(() => EconomyModule),
    forwardRef(() => ChatModule),
  ],
  controllers: [RaidsController, GuildRaidsController, GuildMissionChoiceController],
  providers: [RaidsService, MissionsService, MissionChoiceService, RaidWeeklyScheduler, { provide: RAID_CLOCK, useValue: systemRaidClock }],
  exports: [RaidsService, MissionsService],
})
export class RaidsModule {}
