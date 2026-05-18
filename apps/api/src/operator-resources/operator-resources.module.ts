import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { AdminModule } from "../admin/admin.module";
import { OperatorAuthModule } from "../auth/operator/operator-auth.module";
import { OperatorOverviewController } from "./operator-overview.controller";
import { OperatorTenantsController } from "./operator-tenants.controller";
import { OperatorSitesController } from "./operator-sites.controller";
import { OperatorAuditController } from "./operator-audit.controller";
import { OperatorSearchController } from "./operator-search.controller";
import { OperatorResourcesService } from "./operator-resources.service";

/**
 * Phase 4 — operator resource shell.
 *
 * Wires the read-only operator surfaces (command center, tenants list,
 * Tenant 360, Site 360, audit log v1, global search v1) into the API. The
 * module deliberately re-uses:
 *
 *  - `AdminService` for the heavy command-center aggregation (read-only)
 *    and the existing paginated tenant list. The corresponding mutation
 *    handlers stay on the admin module for now; they will be migrated to
 *    the operator surface with their own permission decorators in later
 *    phases.
 *  - `OperatorAuthModule` providers (JWT guard, permission guard, audit
 *    interceptor) so operator endpoints share the same auth/RBAC/audit
 *    pipeline established in Phases 2 and 3.
 */
@Module({
  imports: [PrismaModule, AdminModule, OperatorAuthModule],
  controllers: [
    OperatorOverviewController,
    OperatorTenantsController,
    OperatorSitesController,
    OperatorAuditController,
    OperatorSearchController,
  ],
  providers: [OperatorResourcesService],
  exports: [OperatorResourcesService],
})
export class OperatorResourcesModule {}
