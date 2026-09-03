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
  findOne(@Param('id') id: string) {
    return this.raids.findById(id);
  }

  @Get(':id/ranking')
  ranking(@Param('id') id: string) {
    return this.raids.ranking(id);
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
