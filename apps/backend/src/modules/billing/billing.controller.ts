import { Controller, Get, Headers, HttpCode, HttpStatus, Post, Req, UseGuards, type RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { BillingService, type PackList } from './billing.service';

@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get('packs')
  @UseGuards(JwtAuthGuard)
  listPacks(@CurrentUser() user: JwtPayload): Promise<PackList> {
    return this.billing.listPacks(user.sub);
  }

  /** Rota pública: quem autentica é a assinatura do Stripe sobre o corpo bruto (`rawBody` no bootstrap). */
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async webhook(
    @Req() request: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string | undefined,
  ): Promise<{ received: true }> {
    await this.billing.handleWebhook(request.rawBody, signature);
    return { received: true };
  }
}
