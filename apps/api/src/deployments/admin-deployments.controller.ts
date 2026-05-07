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
import { PlatformRole } from "@prisma/client";
import { Request } from "express";
import { AdminService } from "../admin/admin.service";
import { AuthenticatedRequestUser } from "../auth/auth.types";
import { PlatformRoles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { DeploymentsService } from "./deployments.service";
import {
  DeploymentEnvironmentService,
  SiteDeploymentEnvironmentCatalog,
  SiteDeploymentEnvironmentVariableDto,
} from "./deployment-environment.service";
import { AdminDeploymentsQueryDto } from "./dto/admin-deployments-query.dto";
import { UpsertDeploymentEnvironmentVariableDto } from "./dto/upsert-deployment-environment-variable.dto";

@Controller("admin/deployments")
@UseGuards(JwtAuthGuard, RolesGuard)
@PlatformRoles(
  PlatformRole.PLATFORM_OWNER,
  PlatformRole.SUPPORT_ADMIN,
  PlatformRole.FINANCE_ADMIN,
)
export class AdminDeploymentsController {
  constructor(
    private readonly deploymentsService: DeploymentsService,
    private readonly deploymentEnvironmentService: DeploymentEnvironmentService,
    private readonly adminService: AdminService,
  ) {}

  @Get()
  async findAll(@Query() query: AdminDeploymentsQueryDto) {
    return this.deploymentsService.listAdminDeployments({
      status: query.status,
      page: query.page,
      limit: query.limit,
    });
  }

  @Get(":id")
  async findOne(@Param("id") id: string) {
    return this.deploymentsService.getDeploymentById(id);
  }

  @Get("sites/:siteId/environment")
  async listSiteEnvironment(
    @Param("siteId") siteId: string,
  ): Promise<SiteDeploymentEnvironmentCatalog> {
    return this.deploymentEnvironmentService.listForSite(siteId);
  }

  @Put("sites/:siteId/environment")
  @PlatformRoles(PlatformRole.PLATFORM_OWNER, PlatformRole.SUPPORT_ADMIN)
  async upsertSiteEnvironmentVariable(
    @Param("siteId") siteId: string,
    @Body() dto: UpsertDeploymentEnvironmentVariableDto,
    @Req() req: Request,
  ): Promise<SiteDeploymentEnvironmentVariableDto> {
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
      action: "deployment.environment_upserted_by_operator",
      targetType: "deployment_environment_variable",
      targetId: variable.id,
      metadata: {
        key: variable.key,
        type: variable.type,
      },
    });

    return variable;
  }

  @Delete("sites/:siteId/environment/:variableId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @PlatformRoles(PlatformRole.PLATFORM_OWNER, PlatformRole.SUPPORT_ADMIN)
  async removeSiteEnvironmentVariable(
    @Param("siteId") siteId: string,
    @Param("variableId") variableId: string,
    @Req() req: Request,
  ): Promise<void> {
    const user = req.user as AuthenticatedRequestUser | undefined;

    await this.deploymentEnvironmentService.removeCustomerVariable(
      siteId,
      variableId,
    );
    await this.adminService.createAuditLogForSite({
      siteId,
      actorUserId: user?.sub ?? null,
      action: "deployment.environment_removed_by_operator",
      targetType: "deployment_environment_variable",
      targetId: variableId,
      metadata: null,
    });
  }

  @Post(":id/retry")
  @HttpCode(HttpStatus.OK)
  @PlatformRoles(PlatformRole.PLATFORM_OWNER, PlatformRole.SUPPORT_ADMIN)
  async retry(@Param("id") id: string, @Req() req: Request) {
    const deployment = await this.deploymentsService.retryDeployment(id);
    const user = req.user as AuthenticatedRequestUser | undefined;

    await this.adminService.createAuditLogForSite({
      siteId: deployment.siteId,
      actorUserId: user?.sub ?? null,
      action: "deployment.retry_requested",
      targetType: "deployment",
      targetId: deployment.id,
      metadata: {
        retryOfDeploymentId: id,
      },
    });

    return deployment;
  }
}
