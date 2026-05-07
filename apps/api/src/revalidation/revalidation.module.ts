import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { DeploymentsModule } from "../deployments/deployments.module";
import { RevalidationService } from "./revalidation.service";

@Module({
  imports: [ConfigModule, DeploymentsModule],
  providers: [RevalidationService],
  exports: [RevalidationService],
})
export class RevalidationModule {}
