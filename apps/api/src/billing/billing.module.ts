import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "../prisma/prisma.module";
import { BillingController } from "./billing.controller";
import { BillingService } from "./billing.service";
import { StripeWebhooksController } from "./stripe-webhooks.controller";
import { AdminSubscriptionsController } from "./admin-subscriptions.controller";

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [
    BillingController,
    StripeWebhooksController,
    AdminSubscriptionsController,
  ],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
