import { Module } from "@nestjs/common";
import { AdminModule } from "../admin/admin.module";
import { BillingModule } from "../billing/billing.module";
import { UsersModule } from "../users/users.module";
import { TenantMembersController } from "./tenant-members.controller";
import { TenantSitesController } from "./tenant-sites.controller";
import { TenantWorkspaceService } from "./tenant-workspace.service";

@Module({
  imports: [AdminModule, BillingModule, UsersModule],
  controllers: [TenantSitesController, TenantMembersController],
  providers: [TenantWorkspaceService],
})
export class TenantWorkspaceModule {}
