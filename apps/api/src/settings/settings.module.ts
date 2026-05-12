import { Module } from "@nestjs/common";
import { BillingModule } from "../billing/billing.module";
import { DeploymentsModule } from "../deployments/deployments.module";
import { PublicSettingsController } from "./public-settings.controller";
import { SettingsController } from "./settings.controller";
import { SettingsService } from "./settings.service";

@Module({
  imports: [BillingModule, DeploymentsModule],
  controllers: [SettingsController, PublicSettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
