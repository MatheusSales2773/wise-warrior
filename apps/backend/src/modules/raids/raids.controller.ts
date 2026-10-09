import {
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
import { RaidsService } from './raids.service';

@Controller('raids')
@UseGuards(JwtAuthGuard)
export class RaidsController {
  constructor(private readonly raids: RaidsService) {}

  @Get(':id')
  findOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.raids.findById(user.sub, id);
  }

  @Get(':id/ranking')
  ranking(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.raids.ranking(user.sub, id);
  }

  @Post(':id/join')
  @HttpCode(HttpStatus.NO_CONTENT)
  async join(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ): Promise<void> {
    await this.raids.join(user.sub, id);
  }
}
