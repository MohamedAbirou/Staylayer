import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Request } from "express";
import { DeploymentStatus, TenantMembershipRole } from "@prisma/client";
import { AdminService } from "../admin/admin.service";
import { AuthenticatedRequestUser } from "../auth/auth.types";
import { MembershipRoles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { WorkspaceScopeGuard } from "../auth/guards/workspace-scope.guard";
import { WorkspaceAccessService } from "../auth/workspace-access.service";
import {
  CustomerSiteDeployment,
  DeploymentsService,
} from "./deployments.service";
import { SiteDeploymentQueryDto } from "./dto/site-deployment-query.dto";

type SiteDeploymentResponse = {
  id: string;
  siteId: string;
  status: DeploymentStatus;
  url: string | null;
  providerUrl: string | null;
  errorMessage: string | null;
  providerDeployId: string | null;
  createdAt: string;
  updatedAt: string;
};

function serializeSiteDeployment(
  deployment: CustomerSiteDeployment,
): SiteDeploymentResponse {
  return {
    id: deployment.id,
    siteId: deployment.siteId,
    status: deployment.status,
    url: deployment.url,
    providerUrl: deployment.providerUrl,
    errorMessage: deployment.errorMessage,
    providerDeployId: deployment.providerDeployId,
    createdAt: deployment.createdAt.toISOString(),
    updatedAt: deployment.updatedAt.toISOString(),
  };
}

@Controller("deployments")
@UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
export class DeploymentsController {
  constructor(
    private readonly deploymentsService: DeploymentsService,
    private readonly workspaceAccessService: WorkspaceAccessService,
    private readonly adminService: AdminService,
  ) {}

  private async ensureAuthenticatedSiteAccess(req: Request): Promise<string> {
    return this.workspaceAccessService.ensureSiteAccess(
      req as Request & {
        user?: AuthenticatedRequestUser;
        query: Record<string, unknown>;
        headers: Record<string, string | string[] | undefined>;
      },
    );
  }

  @Get("latest")
  @MembershipRoles(
    TenantMembershipRole.OWNER,
    TenantMembershipRole.ADMIN,
    TenantMembershipRole.EDITOR,
    TenantMembershipRole.BILLING,
  )
  async getLatest(
    @Query() _query: SiteDeploymentQueryDto,
    @Req() req: Request,
  ): Promise<SiteDeploymentResponse | null> {
    const siteId = await this.ensureAuthenticatedSiteAccess(req);
    const deployment =
      await this.deploymentsService.getLatestSiteDeployment(siteId);

    if (!deployment) {
      return null;
    }

    const customerDeployment =
      await this.deploymentsService.resolveCustomerSiteDeployment(
        siteId,
        deployment,
      );

    return serializeSiteDeployment(customerDeployment);
  }

  @Get()
  @MembershipRoles(
    TenantMembershipRole.OWNER,
    TenantMembershipRole.ADMIN,
    TenantMembershipRole.EDITOR,
    TenantMembershipRole.BILLING,
  )
  async list(@Query() query: SiteDeploymentQueryDto, @Req() req: Request) {
    const siteId = await this.ensureAuthenticatedSiteAccess(req);
    const deployments = await this.deploymentsService.listSiteDeployments(
      siteId,
      query.limit,
    );
    const customerDeployments =
      await this.deploymentsService.resolveCustomerSiteDeployments(
        siteId,
        deployments,
      );

    return customerDeployments.map(serializeSiteDeployment);
  }

  @Post("provision")
  @MembershipRoles(TenantMembershipRole.OWNER, TenantMembershipRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async provision(
    @Query() _query: SiteDeploymentQueryDto,
    @Req() req: Request,
  ) {
    const siteId = await this.ensureAuthenticatedSiteAccess(req);
    const deployment = await this.deploymentsService.provisionSite(siteId);
    const user = req.user as AuthenticatedRequestUser | undefined;

    await this.adminService.createAuditLogForSite({
      siteId,
      actorUserId: user?.sub ?? null,
      action: "deployment.provision_requested",
      targetType: "deployment",
      targetId: deployment.id,
      metadata: {
        status: deployment.status,
      },
    });

    return serializeSiteDeployment(
      await this.deploymentsService.resolveCustomerSiteDeployment(
        siteId,
        deployment,
      ),
    );
  }

  @Post(":id/retry")
  @MembershipRoles(TenantMembershipRole.OWNER, TenantMembershipRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async retry(
    @Param("id") id: string,
    @Query() _query: SiteDeploymentQueryDto,
    @Req() req: Request,
  ) {
    const siteId = await this.ensureAuthenticatedSiteAccess(req);
    const deployment = await this.deploymentsService.retrySiteDeployment(
      siteId,
      id,
    );
    const user = req.user as AuthenticatedRequestUser | undefined;

    await this.adminService.createAuditLogForSite({
      siteId,
      actorUserId: user?.sub ?? null,
      action: "deployment.retry_requested",
      targetType: "deployment",
      targetId: deployment.id,
      metadata: {
        retryOfDeploymentId: id,
      },
    });

    return serializeSiteDeployment(
      await this.deploymentsService.resolveCustomerSiteDeployment(
        siteId,
        deployment,
      ),
    );
  }
}
