import { Module } from "@nestjs/common";
import { AdminModule } from "../admin/admin.module";
import { BillingModule } from "../billing/billing.module";
import { AdminFormsController } from "./admin-forms.controller";
import { FormEmailRendererService } from "./form-email-renderer.service";
import { FormStudioController } from "./form-studio.controller";
import { FormsController } from "./forms.controller";
import { FormsService } from "./forms.service";
import { PublicFormsController } from "./public-forms.controller";
import { PublicSubmissionsController } from "./public-submissions.controller";
import { SubmissionOperationsService } from "./submission-operations.service";

@Module({
  imports: [AdminModule, BillingModule],
  controllers: [
    PublicSubmissionsController,
    PublicFormsController,
    FormsController,
    FormStudioController,
    AdminFormsController,
  ],
  providers: [
    FormsService,
    FormEmailRendererService,
    SubmissionOperationsService,
  ],
  exports: [FormsService],
})
export class FormsModule {}
