import { Controller, Headers, HttpCode, HttpStatus, Post, Req, type RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { BillingService } from './billing.service';

@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

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
