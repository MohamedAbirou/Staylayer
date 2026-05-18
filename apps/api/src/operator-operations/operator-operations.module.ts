import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { OperatorAuthModule } from "../auth/operator/operator-auth.module";
import { DeploymentsModule } from "../deployments/deployments.module";
import { DomainsModule } from "../domains/domains.module";
import { FormsModule } from "../forms/forms.module";
import { SeoModule } from "../seo/seo.module";
import { TranslationModule } from "../translation/translation.module";
import { OperatorOperationsController } from "./operator-operations.controller";
import { OperatorOperationsService } from "./operator-operations.service";

/**
 * Phase 9 — Operations Modules backend.
 *
 * The operator console surface for customer-facing operational data:
 * deployments, domains, form submissions/deliveries, operational alerts,
 * SEO submissions, translation jobs/glossaries, and notifications.
 *
 * All endpoints live under `/operator/operations/*` and reuse the same
 * isolated operator auth (JWT guard, permission guard, audit interceptor)
 * provided by `OperatorAuthModule`. Underlying tenant services are reused
 * for write paths (`DeploymentsService`, `DomainsService`,
 * `SubmissionOperationsService`, `IndexNowService`, `TranslationService`)
 * so we never duplicate provider integrations or billing checks.
 */
@Module({
  imports: [
    PrismaModule,
    OperatorAuthModule,
    DeploymentsModule,
    DomainsModule,
    FormsModule,
    SeoModule,
    TranslationModule,
  ],
  controllers: [OperatorOperationsController],
  providers: [OperatorOperationsService],
  exports: [OperatorOperationsService],
})
export class OperatorOperationsModule {}
