import { Module } from "@nestjs/common";
import { AdminModule } from "../admin/admin.module";
import { AuthModule } from "../auth/auth.module";
import { BillingModule } from "../billing/billing.module";
import { PublicRuntimeModule } from "../public-runtime/public-runtime.module";
import { SiteDeletionModule } from "../site-deletion/site-deletion.module";
import { UsersModule } from "../users/users.module";
import { TenantMembersController } from "./tenant-members.controller";
import { TenantSitesController } from "./tenant-sites.controller";
import { TenantWorkspaceService } from "./tenant-workspace.service";

@Module({
  imports: [
    AdminModule,
    AuthModule,
    BillingModule,
    PublicRuntimeModule,
    SiteDeletionModule,
    UsersModule,
  ],
  controllers: [TenantSitesController, TenantMembersController],
  providers: [TenantWorkspaceService],
})
export class TenantWorkspaceModule {}
