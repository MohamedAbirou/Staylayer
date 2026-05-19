import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { OperatorAuthModule } from "../auth/operator/operator-auth.module";
import { SupportCasesController } from "./support-cases.controller";
import { SupportCasesService } from "./support-cases.service";
import { SupportCasesSlaCronService } from "./support-cases-sla-cron.service";

/**
 * Phase 5 — native support system backend.
 *
 * Wires the support-case lifecycle service and its operator-facing
 * controller into the API. Auth / RBAC / audit are imported from
 * `OperatorAuthModule` so the same JWT strategy, permission guard, and
 * audit interceptor used by every other operator surface protect these
 * routes too.
 *
 * Phase 12 adds the SLA breach cron which periodically flags cases that
 * have crossed their first-response / resolution deadlines.
 */
@Module({
  imports: [PrismaModule, OperatorAuthModule],
  controllers: [SupportCasesController],
  providers: [SupportCasesService, SupportCasesSlaCronService],
  exports: [SupportCasesService],
})
export class SupportCasesModule {}
