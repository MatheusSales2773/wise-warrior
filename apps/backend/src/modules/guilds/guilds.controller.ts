import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { GuildsService } from './guilds.service';
import { CreateGuildDto } from './dto/create-guild.dto';

@Controller('guilds')
@UseGuards(JwtAuthGuard)
export class GuildsController {
  constructor(private readonly guilds: GuildsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateGuildDto) {
    return this.guilds.create(user.sub, dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.guilds.findById(id);
  }

  @Post(':id/members')
  @HttpCode(HttpStatus.NO_CONTENT)
  async join(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ): Promise<void> {
    await this.guilds.addMember(id, user.sub);
  }
}
