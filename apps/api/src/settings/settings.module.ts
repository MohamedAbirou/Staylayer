import { Module } from "@nestjs/common";
import { BillingModule } from "../billing/billing.module";
import { PublicSettingsController } from "./public-settings.controller";
import { SettingsController } from "./settings.controller";
import { SettingsService } from "./settings.service";

@Module({
  imports: [BillingModule],
  controllers: [SettingsController, PublicSettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
