import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { OnboardingController } from "./onboarding.controller";
import { OnboardingService } from "./onboarding.service";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [OnboardingController],
  providers: [OnboardingService],
  exports: [OnboardingService],
})
export class OnboardingModule {}
