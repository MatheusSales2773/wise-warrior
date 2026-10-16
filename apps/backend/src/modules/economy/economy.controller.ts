import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { EconomyService } from './economy.service';
import { CoinStatementQueryDto } from './dto/coin-statement-query.dto';
import type { CoinBalanceResponseDto, CoinStatementPageDto } from './dto/coin-statement-response.dto';

/** Saldo e Extrato de quem está autenticado (ADR-012). A rota não recebe `userId`: só os dados do próprio usuário. */
@Controller('users/me/coins')
@UseGuards(JwtAuthGuard)
export class EconomyController {
  constructor(private readonly economy: EconomyService) {}

  @Get()
  async balance(@CurrentUser() user: JwtPayload): Promise<CoinBalanceResponseDto> {
    return { balance: await this.economy.getBalance(user.sub) };
  }

  @Get('statement')
  statement(@CurrentUser() user: JwtPayload, @Query() query: CoinStatementQueryDto): Promise<CoinStatementPageDto> {
    return this.economy.listStatement(user.sub, query);
  }
}
