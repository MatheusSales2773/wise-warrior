import { Module } from '@nestjs/common';
import { EconomyModule } from '../economy/economy.module';
import { RaidsModule } from '../raids/raids.module';
import { UsersModule } from '../users/users.module';
import { ShopController } from './shop.controller';
import { ShopService } from './shop.service';

@Module({
  imports: [EconomyModule, RaidsModule, UsersModule],
  controllers: [ShopController],
  providers: [ShopService],
})
export class ShopModule {}
