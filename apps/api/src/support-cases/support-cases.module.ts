import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { OperatorAuthModule } from "../auth/operator/operator-auth.module";
import { SupportCasesController } from "./support-cases.controller";
import { SupportCasesService } from "./support-cases.service";

/**
 * Phase 5 — native support system backend.
 *
 * Wires the support-case lifecycle service and its operator-facing
 * controller into the API. Auth / RBAC / audit are imported from
 * `OperatorAuthModule` so the same JWT strategy, permission guard, and
 * audit interceptor used by every other operator surface protect these
 * routes too.
 *
 * The service itself is exported so future phases (Phase 6 UI helpers,
 * Phase 9 operations-driven case creation, Phase 12 SLA reconciliation
 * cron) can call it without a circular import on the controller.
 */
@Module({
  imports: [PrismaModule, OperatorAuthModule],
  controllers: [SupportCasesController],
  providers: [SupportCasesService],
  exports: [SupportCasesService],
})
export class SupportCasesModule {}
