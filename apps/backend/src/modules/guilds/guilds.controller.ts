import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { GuildsService } from './guilds.service';
import { CreateGuildDto } from './dto/create-guild.dto';
import { ListGuildMembersQueryDto } from './dto/list-guild-members-query.dto';
import { ListGuildsQueryDto } from './dto/list-guilds-query.dto';

@Controller('guilds')
@UseGuards(JwtAuthGuard)
export class GuildsController {
  constructor(private readonly guilds: GuildsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateGuildDto) {
    return this.guilds.create(user.sub, dto);
  }

  @Get()
  list(@Query() query: ListGuildsQueryDto) {
    return this.guilds.list(query);
  }

  /** Declared before `:id` so "me" is never parsed as a guild id. */
  @Get('me')
  findMine(@CurrentUser() user: JwtPayload) {
    return this.guilds.findMine(user.sub);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.guilds.findById(id);
  }

  @Get(':id/members')
  listMembers(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Query() query: ListGuildMembersQueryDto,
  ) {
    return this.guilds.listMembers(id, user.sub, query);
  }

  @Delete(':id/members/me')
  @HttpCode(HttpStatus.NO_CONTENT)
  async leave(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ): Promise<void> {
    await this.guilds.leave(id, user.sub);
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
