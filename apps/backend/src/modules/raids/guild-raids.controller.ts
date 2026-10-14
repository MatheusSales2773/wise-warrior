import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { RaidsService } from './raids.service';
import { RaidPageQueryDto } from './dto/raid-page-query.dto';

/** Raid routes nested under a Guild; the owning module is Raids. */
@Controller('guilds')
@UseGuards(JwtAuthGuard)
export class GuildRaidsController {
  constructor(private readonly raids: RaidsService) {}

  @Get(':id/raids/active')
  active(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.raids.findActive(id, user.sub);
  }

  /** Raids anteriores (fechadas), da mais recente para a mais antiga. */
  @Get(':id/raids')
  closed(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Query() query: RaidPageQueryDto) {
    return this.raids.listClosed(id, user.sub, query);
  }
}
