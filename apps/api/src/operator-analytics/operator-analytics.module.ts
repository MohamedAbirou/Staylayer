import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { OperatorAuthModule } from "../auth/operator/operator-auth.module";
import {
  OperatorAnalyticsController,
  OperatorObservabilityController,
} from "./operator-analytics.controller";
import { OperatorAnalyticsService } from "./operator-analytics.service";

/**
 * Phase 10 — operator analytics & observability surface.
 *
 * The module is read-only and lives behind the operator auth pipeline. It
 * does not own any background work or mutation paths.
 */
@Module({
  imports: [PrismaModule, OperatorAuthModule],
  controllers: [OperatorAnalyticsController, OperatorObservabilityController],
  providers: [OperatorAnalyticsService],
  exports: [OperatorAnalyticsService],
})
export class OperatorAnalyticsModule {}
