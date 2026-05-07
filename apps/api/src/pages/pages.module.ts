import { Module } from "@nestjs/common";
import { PagesService } from "./pages.service";
import { VersionsService } from "./versions.service";
import { PagesController } from "./pages.controller";
import { VersionsController } from "./versions.controller";
import { RevalidationModule } from "../revalidation/revalidation.module";
import { BillingModule } from "../billing/billing.module";

@Module({
  imports: [RevalidationModule, BillingModule],
  providers: [PagesService, VersionsService],
  controllers: [PagesController, VersionsController],
  exports: [PagesService],
})
export class PagesModule {}
