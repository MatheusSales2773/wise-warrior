import { Controller, Headers, HttpCode, HttpStatus, Post, Req, UseGuards, type RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { BillingService } from './billing.service';

@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  /** Abre o Checkout do premium para o próprio usuário (S3); o usuário vem do token, nunca do corpo. */
  @Post('checkout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  checkout(@CurrentUser() user: JwtPayload): Promise<{ url: string }> {
    return this.billing.openCheckout(user.sub);
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
