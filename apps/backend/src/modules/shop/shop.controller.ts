import { Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { RateLimit } from '../../shared/security/rate-limit';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { ShopService, type ItemPurchase, type MissionPurchase, type StoreItem, type StoreMission } from './shop.service';

/** Loja, seções Missões e Itens (ADR-012). Só dados do próprio usuário. */
@Controller('shop')
@UseGuards(JwtAuthGuard)
export class ShopController {
  constructor(private readonly shop: ShopService) {}

  @Get('missions')
  listMissions(@CurrentUser() user: JwtPayload): Promise<StoreMission[]> {
    return this.shop.listMissions(user.sub);
  }

  @Post('missions/:id/purchase')
  @RateLimit('shop')
  @HttpCode(HttpStatus.CREATED)
  purchaseMission(@CurrentUser() user: JwtPayload, @Param('id') id: string): Promise<MissionPurchase> {
    return this.shop.purchaseMission(user.sub, id);
  }

  @Get('items')
  listItems(@CurrentUser() user: JwtPayload): Promise<StoreItem[]> {
    return this.shop.listItems(user.sub);
  }

  @Post('items/:itemId/purchase')
  @RateLimit('shop')
  @HttpCode(HttpStatus.CREATED)
  purchaseItem(@CurrentUser() user: JwtPayload, @Param('itemId') itemId: string): Promise<ItemPurchase> {
    return this.shop.purchaseItem(user.sub, itemId);
  }
}
