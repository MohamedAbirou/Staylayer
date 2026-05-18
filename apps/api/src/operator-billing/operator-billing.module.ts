import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { BillingModule } from "../billing/billing.module";
import { OperatorAuthModule } from "../auth/operator/operator-auth.module";
import { OperatorBillingController } from "./operator-billing.controller";
import { OperatorBillingService } from "./operator-billing.service";

/**
 * Phase 7 — Billing Control backend.
 *
 * The operator console surface for billing operations. Imports
 * `OperatorAuthModule` so the JWT guard, permission guard, and audit
 * interceptor are wired with the same providers used by the support
 * console. Imports `BillingModule` to reuse `BillingService` for Stripe
 * interactions; we never duplicate Stripe SDK setup.
 *
 * Customer-facing billing routes remain in `BillingModule`; this module
 * mounts only `/operator/billing/*` endpoints.
 */
@Module({
  imports: [PrismaModule, BillingModule, OperatorAuthModule],
  controllers: [OperatorBillingController],
  providers: [OperatorBillingService],
  exports: [OperatorBillingService],
})
export class OperatorBillingModule {}
