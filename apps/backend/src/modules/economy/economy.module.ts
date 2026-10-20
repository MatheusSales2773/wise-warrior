import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RealtimeModule } from '../realtime/realtime.module';
import { EconomyController } from './economy.controller';
import { EconomyService } from './economy.service';
import { CoinBalance } from './entities/coin-balance.entity';
import { CoinLedgerEntry } from './entities/coin-ledger-entry.entity';

/** Dono da Moeda (ADR-012). Quem ganha ou gasta Moedas importa este módulo e usa `EconomyService`. */
@Module({
  imports: [TypeOrmModule.forFeature([CoinBalance, CoinLedgerEntry]), forwardRef(() => RealtimeModule)],
  controllers: [EconomyController],
  providers: [EconomyService],
  exports: [EconomyService],
})
export class EconomyModule {}
