import { Module } from "@nestjs/common";
import { TranslationController } from "./translation.controller";
import { TranslationService } from "./translation.service";
import { DeepLService } from "./deepl.service";
import { PrismaModule } from "../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { BillingModule } from "../billing/billing.module";
import { RevalidationModule } from "../revalidation/revalidation.module";

@Module({
  imports: [PrismaModule, AuthModule, BillingModule, RevalidationModule],
  controllers: [TranslationController],
  providers: [TranslationService, DeepLService],
  exports: [TranslationService],
})
export class TranslationModule {}
