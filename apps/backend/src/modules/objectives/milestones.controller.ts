import { Controller, Get, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import type { MilestonesResponseDto } from './dto/milestones-response.dto';
import { MilestonesService } from './milestones.service';

/** Marcos de Crônicas de quem está autenticado (ADR-014). A rota não recebe `userId`. */
@Controller('milestones')
@UseGuards(JwtAuthGuard)
export class MilestonesController {
  constructor(private readonly milestones: MilestonesService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  list(@CurrentUser() user: JwtPayload): Promise<MilestonesResponseDto> {
    return this.milestones.list(user.sub);
  }
}
