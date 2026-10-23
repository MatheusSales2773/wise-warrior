import { Controller, Get, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import type { ObjectivesResponseDto } from './dto/objectives-response.dto';
import { ObjectivesService } from './objectives.service';

/** Objetivos de Crônicas de quem está autenticado (ADR-014). A rota não recebe `userId`. */
@Controller('objectives')
@UseGuards(JwtAuthGuard)
export class ObjectivesController {
  constructor(private readonly objectives: ObjectivesService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  list(@CurrentUser() user: JwtPayload): Promise<ObjectivesResponseDto> {
    return this.objectives.list(user.sub);
  }
}
