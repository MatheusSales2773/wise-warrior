import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { RateLimit } from '../../shared/security/rate-limit';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { ChooseNextMissionDto } from './dto/choose-next-mission.dto';
import { MissionChoiceService } from './mission-choice.service';

/** Escolha da Missão da próxima Raid (ADR-012), sob a Guild; o módulo dono é Raids. */
@Controller('guilds')
@UseGuards(JwtAuthGuard)
export class GuildMissionChoiceController {
  constructor(private readonly missionChoice: MissionChoiceService) {}

  /** Missões possuídas pelos membros atuais (incluindo as do rodízio), com o dono de cada uma. */
  @Get(':id/raids/next-mission/available')
  availableMissions(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.missionChoice.listAvailable(id, user.sub);
  }

  @Get(':id/raids/next-mission')
  async nextMission(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return { choice: await this.missionChoice.findCurrent(id, user.sub) };
  }

  /** Só o Líder; trocável até a Raid começar. */
  @Put(':id/raids/next-mission')
  @RateLimit('mission-choice')
  async chooseNextMission(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: ChooseNextMissionDto) {
    return { choice: await this.missionChoice.choose(id, user.sub, dto) };
  }
}
