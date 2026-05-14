import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
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
import {
  DeploymentEnvironmentService,
  SiteDeploymentEnvironmentCatalog,
  SiteDeploymentEnvironmentVariableDto,
} from "./deployment-environment.service";
import { UpsertDeploymentEnvironmentVariableDto } from "./dto/upsert-deployment-environment-variable.dto";
import { SiteDeploymentQueryDto } from "./dto/site-deployment-query.dto";

type SiteDeploymentTimelinePhaseResponse = {
  key: string;
  label: string;
  status: "pending" | "active" | "completed" | "failed";
  startedAt: string | null;
  completedAt: string | null;
  summary: string | null;
};

type SiteDeploymentLogResponse = {
  id: string;
  createdAt: string;
  text: string;
  phaseKey: string | null;
  level: "info" | "warning" | "error";
};

type SiteDeploymentEnvironmentVariableResponse = {
  id: string;
  key: string;
  type: "plain" | "encrypted";
  description: string | null;
  targets: string[];
  editable: boolean;
  source: "customer" | "operator";
  isValueSet: boolean;
  value: string | null;
  valuePreview: string | null;
  updatedAt: string | null;
};

type SiteDeploymentEnvironmentCatalogResponse = {
  customerEditable: SiteDeploymentEnvironmentVariableResponse[];
  operatorManaged: SiteDeploymentEnvironmentVariableResponse[];
};

type SiteDeploymentResponse = {
  id: string;
  siteId: string;
  status: DeploymentStatus;
  url: string | null;
  providerUrl: string | null;
  errorMessage: string | null;
  providerDeployId: string | null;
  timeline: SiteDeploymentTimelinePhaseResponse[];
  recentLogs: SiteDeploymentLogResponse[];
  createdAt: string;
  updatedAt: string;
  sharedRuntime: boolean;
  publishedRevision: number | null;
  publishedAt: string | null;
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
    timeline: deployment.timeline.map((phase) => ({
      key: phase.key,
      label: phase.label,
      status: phase.status,
      startedAt: phase.startedAt ?? null,
      completedAt: phase.completedAt ?? null,
      summary: phase.summary ?? null,
    })),
    recentLogs: deployment.recentLogs.map((entry) => ({
      id: entry.id,
      createdAt: entry.createdAt,
      text: entry.text,
      phaseKey: entry.phaseKey ?? null,
      level: entry.level,
    })),
    createdAt: deployment.createdAt.toISOString(),
    updatedAt: deployment.updatedAt.toISOString(),
    sharedRuntime: deployment.sharedRuntime,
    publishedRevision: deployment.publishedRevision,
    publishedAt: deployment.publishedAt,
  };
}

function serializeEnvironmentVariable(
  variable: SiteDeploymentEnvironmentVariableDto,
): SiteDeploymentEnvironmentVariableResponse {
  return {
    id: variable.id,
    key: variable.key,
    type: variable.type,
    description: variable.description,
    targets: variable.targets,
    editable: variable.editable,
    source: variable.source,
    isValueSet: variable.isValueSet,
    value: variable.value,
    valuePreview: variable.valuePreview,
    updatedAt: variable.updatedAt,
  };
}

function serializeEnvironmentCatalog(
  catalog: SiteDeploymentEnvironmentCatalog,
): SiteDeploymentEnvironmentCatalogResponse {
  return {
    customerEditable: catalog.customerEditable.map(
      serializeEnvironmentVariable,
    ),
    operatorManaged: catalog.operatorManaged.map(serializeEnvironmentVariable),
  };
}

@Controller("deployments")
@UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
export class DeploymentsController {
  constructor(
    private readonly deploymentsService: DeploymentsService,
    private readonly deploymentEnvironmentService: DeploymentEnvironmentService,
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

  @Get("environment")
  @MembershipRoles(
    TenantMembershipRole.OWNER,
    TenantMembershipRole.ADMIN,
    TenantMembershipRole.EDITOR,
    TenantMembershipRole.BILLING,
  )
  async listEnvironment(
    @Query() _query: SiteDeploymentQueryDto,
    @Req() req: Request,
  ): Promise<SiteDeploymentEnvironmentCatalogResponse> {
    const siteId = await this.ensureAuthenticatedSiteAccess(req);

    return serializeEnvironmentCatalog(
      await this.deploymentEnvironmentService.listForSite(siteId),
    );
  }

  @Put("environment")
  @MembershipRoles(TenantMembershipRole.OWNER, TenantMembershipRole.ADMIN)
  async upsertEnvironmentVariable(
    @Query() _query: SiteDeploymentQueryDto,
    @Body() dto: UpsertDeploymentEnvironmentVariableDto,
    @Req() req: Request,
  ): Promise<SiteDeploymentEnvironmentVariableResponse> {
    const siteId = await this.ensureAuthenticatedSiteAccess(req);
    const user = req.user as AuthenticatedRequestUser | undefined;
    const variable =
      await this.deploymentEnvironmentService.upsertCustomerVariable(
        siteId,
        dto,
        user?.sub ?? null,
      );

    await this.adminService.createAuditLogForSite({
      siteId,
      actorUserId: user?.sub ?? null,
      action: "deployment.environment_upserted",
      targetType: "deployment_environment_variable",
      targetId: variable.id,
      metadata: {
        key: variable.key,
        type: variable.type,
      },
    });

    return serializeEnvironmentVariable(variable);
  }

  @Delete("environment/:id")
  @MembershipRoles(TenantMembershipRole.OWNER, TenantMembershipRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeEnvironmentVariable(
    @Param("id") id: string,
    @Query() _query: SiteDeploymentQueryDto,
    @Req() req: Request,
  ): Promise<void> {
    const siteId = await this.ensureAuthenticatedSiteAccess(req);
    const user = req.user as AuthenticatedRequestUser | undefined;

    await this.deploymentEnvironmentService.removeCustomerVariable(siteId, id);
    await this.adminService.createAuditLogForSite({
      siteId,
      actorUserId: user?.sub ?? null,
      action: "deployment.environment_removed",
      targetType: "deployment_environment_variable",
      targetId: id,
      metadata: null,
    });
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

  @Post(":id/rollback")
  @MembershipRoles(TenantMembershipRole.OWNER, TenantMembershipRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async rollback(
    @Param("id") id: string,
    @Query() _query: SiteDeploymentQueryDto,
    @Req() req: Request,
  ) {
    const siteId = await this.ensureAuthenticatedSiteAccess(req);
    const deployment = await this.deploymentsService.rollbackSiteDeployment(
      siteId,
      id,
    );
    const user = req.user as AuthenticatedRequestUser | undefined;

    await this.adminService.createAuditLogForSite({
      siteId,
      actorUserId: user?.sub ?? null,
      action: "deployment.rollback_requested",
      targetType: "deployment",
      targetId: deployment.id,
      metadata: {
        rollbackTargetDeploymentId: id,
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
