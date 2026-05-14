import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PublicRuntimeModule } from "../public-runtime/public-runtime.module";
import { RevalidationService } from "./revalidation.service";

@Module({
  imports: [ConfigModule, PublicRuntimeModule],
  providers: [RevalidationService],
  exports: [RevalidationService],
})
export class RevalidationModule {}
