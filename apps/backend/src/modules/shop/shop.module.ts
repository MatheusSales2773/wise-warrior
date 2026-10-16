import { Module } from '@nestjs/common';
import { EconomyModule } from '../economy/economy.module';
import { UsersModule } from '../users/users.module';
import { ShopController } from './shop.controller';
import { ShopService } from './shop.service';

/** A Loja (ADR-012): junta a Moeda (`economy`) e o Inventário (`users`) numa Compra, sempre pelos Services. */
@Module({
  imports: [EconomyModule, UsersModule],
  controllers: [ShopController],
  providers: [ShopService],
})
export class ShopModule {}
