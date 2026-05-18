import { Module } from "@nestjs/common";

import { AdminModule } from "../admin/admin.module";
import { AuthModule } from "../auth/auth.module";
import { PublicRuntimeModule } from "../public-runtime/public-runtime.module";
import { SiteDeletionCronService } from "./site-deletion-cron.service";
import { SiteDeletionJobsController } from "./site-deletion-jobs.controller";
import { SiteDeletionService } from "./site-deletion.service";

@Module({
  imports: [AdminModule, AuthModule, PublicRuntimeModule],
  controllers: [SiteDeletionJobsController],
  providers: [SiteDeletionService, SiteDeletionCronService],
  exports: [SiteDeletionService],
})
export class SiteDeletionModule {}
