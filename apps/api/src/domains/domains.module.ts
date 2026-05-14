import { Module } from "@nestjs/common";
import { AdminModule } from "../admin/admin.module";
import { BillingModule } from "../billing/billing.module";
import { DeploymentsModule } from "../deployments/deployments.module";
import { PublicRuntimeModule } from "../public-runtime/public-runtime.module";
import { RevalidationModule } from "../revalidation/revalidation.module";
import { AdminDomainsController } from "./admin-domains.controller";
import { DomainVerificationService } from "./domain-verification.service";
import { DomainsController } from "./domains.controller";
import { DomainsService } from "./domains.service";

@Module({
  imports: [
    AdminModule,
    BillingModule,
    DeploymentsModule,
    PublicRuntimeModule,
    RevalidationModule,
  ],
  controllers: [DomainsController, AdminDomainsController],
  providers: [DomainsService, DomainVerificationService],
  exports: [DomainsService],
})
export class DomainsModule {}
