import { Module } from "@nestjs/common";
import { TranslationController } from "./translation.controller";
import { TranslationService } from "./translation.service";
import { DeepLService } from "./deepl.service";
import { PrismaModule } from "../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { BillingModule } from "../billing/billing.module";

@Module({
  imports: [PrismaModule, AuthModule, BillingModule],
  controllers: [TranslationController],
  providers: [TranslationService, DeepLService],
  exports: [TranslationService],
})
export class TranslationModule {}
