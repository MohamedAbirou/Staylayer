import { Module } from "@nestjs/common";

import { AdminModule } from "../admin/admin.module";
import { AuthModule } from "../auth/auth.module";
import { PublicRuntimeModule } from "../public-runtime/public-runtime.module";
import { UsersModule } from "../users/users.module";
import { TenantDeletionCronService } from "./tenant-deletion-cron.service";
import {
  TenantDeletionController,
  TenantDeletionJobsController,
} from "./tenant-deletion-jobs.controller";
import { TenantDeletionService } from "./tenant-deletion.service";

@Module({
  imports: [AdminModule, AuthModule, PublicRuntimeModule, UsersModule],
  controllers: [TenantDeletionController, TenantDeletionJobsController],
  providers: [TenantDeletionService, TenantDeletionCronService],
  exports: [TenantDeletionService],
})
export class TenantDeletionModule {}
