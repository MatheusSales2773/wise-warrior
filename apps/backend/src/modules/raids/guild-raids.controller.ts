import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { RaidsService } from './raids.service';

/** Raid routes nested under a Guild; the owning module is Raids. */
@Controller('guilds')
@UseGuards(JwtAuthGuard)
export class GuildRaidsController {
  constructor(private readonly raids: RaidsService) {}

  @Get(':id/raids/active')
  active(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.raids.findActive(id, user.sub);
  }
}
