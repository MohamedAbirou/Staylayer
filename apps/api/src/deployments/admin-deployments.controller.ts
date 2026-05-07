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
import { PlatformRole } from "@prisma/client";
import { Request } from "express";
import { AdminService } from "../admin/admin.service";
import { AuthenticatedRequestUser } from "../auth/auth.types";
import { PlatformRoles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { DeploymentsService } from "./deployments.service";
import { AdminDeploymentsQueryDto } from "./dto/admin-deployments-query.dto";

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
