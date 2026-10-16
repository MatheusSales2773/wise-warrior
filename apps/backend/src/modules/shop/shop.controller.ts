import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { RateLimit } from '../../shared/security/rate-limit';
import { ShopService, type ShopItemsResponse, type ShopPurchaseResponse } from './shop.service';

@Controller('shop')
@UseGuards(JwtAuthGuard)
export class ShopController {
  constructor(private readonly shop: ShopService) {}

  /** Seção Itens: os Cosmetic Items À venda, com o preço e o estado para o usuário. */
  @Get('items')
  listItems(@CurrentUser() user: JwtPayload): Promise<ShopItemsResponse> {
    return this.shop.listItems(user.sub);
  }

  @Post('items/:itemId/purchase')
  @RateLimit('purchase')
  purchaseItem(@CurrentUser() user: JwtPayload, @Param('itemId') itemId: string): Promise<ShopPurchaseResponse> {
    return this.shop.purchaseItem(user.sub, itemId);
  }
}
