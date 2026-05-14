import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AdminModule } from "../admin/admin.module";
import { SitePublishedRevisionsModule } from "../site-published-revisions/site-published-revisions.module";
import { DEPLOYMENT_PROVIDER } from "./deployment-provider.port";
import { AdminDeploymentsController } from "./admin-deployments.controller";
import { DeploymentsController } from "./deployments.controller";
import { DeploymentEnvironmentService } from "./deployment-environment.service";
import { DeploymentsService } from "./deployments.service";
import { VercelDeploymentProvider } from "./vercel-deployment.provider";

@Module({
  imports: [ConfigModule, AdminModule, SitePublishedRevisionsModule],
  controllers: [DeploymentsController, AdminDeploymentsController],
  providers: [
    DeploymentEnvironmentService,
    DeploymentsService,
    VercelDeploymentProvider,
    {
      provide: DEPLOYMENT_PROVIDER,
      useExisting: VercelDeploymentProvider,
    },
  ],
  exports: [DeploymentsService, DEPLOYMENT_PROVIDER],
})
export class DeploymentsModule {}
