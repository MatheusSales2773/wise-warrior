import { Module } from '@nestjs/common';
import { EconomyModule } from '../economy/economy.module';
import { RaidsModule } from '../raids/raids.module';
import { ShopController } from './shop.controller';
import { ShopService } from './shop.service';

@Module({
  imports: [EconomyModule, RaidsModule],
  controllers: [ShopController],
  providers: [ShopService],
})
export class ShopModule {}
