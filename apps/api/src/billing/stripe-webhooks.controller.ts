import {
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from "@nestjs/common";
import { Request } from "express";
import { BillingService } from "./billing.service";

@Controller("billing/webhooks")
export class StripeWebhooksController {
  constructor(private readonly billingService: BillingService) {}

  @Post("stripe")
  @HttpCode(HttpStatus.OK)
  async handleStripeWebhook(
    @Headers("stripe-signature") signature: string | string[] | undefined,
    @Req() req: Request,
  ) {
    const request = req as Request & { rawBody?: Buffer };
    return this.billingService.handleStripeWebhook(signature, request.rawBody);
  }
}
