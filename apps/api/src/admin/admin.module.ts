import { Module } from "@nestjs/common";
import { AdminAuditController } from "./admin-audit.controller";
import { AdminOverviewController } from "./admin-overview.controller";
import { AdminTenantsController } from "./admin-tenants.controller";
import { AdminService } from "./admin.service";

@Module({
  controllers: [
    AdminOverviewController,
    AdminTenantsController,
    AdminAuditController,
  ],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
