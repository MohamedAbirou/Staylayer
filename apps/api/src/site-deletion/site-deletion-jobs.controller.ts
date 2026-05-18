import { Controller, Get, Param, Req, UseGuards } from "@nestjs/common";
import { TenantMembershipRole } from "@prisma/client";
import { Request } from "express";

import { AuthenticatedRequestUser } from "../auth/auth.types";
import { MembershipRoles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { WorkspaceAccessService } from "../auth/workspace-access.service";
import { SiteDeletionService } from "./site-deletion.service";

@Controller("tenants/:tenantId/site-deletion-jobs")
@UseGuards(JwtAuthGuard, RolesGuard)
@MembershipRoles(TenantMembershipRole.OWNER, TenantMembershipRole.ADMIN)
export class SiteDeletionJobsController {
  constructor(
    private readonly siteDeletionService: SiteDeletionService,
    private readonly workspaceAccessService: WorkspaceAccessService,
  ) {}

  @Get()
  async list(@Param("tenantId") tenantId: string, @Req() req: Request) {
    const resolvedTenantId =
      await this.workspaceAccessService.ensureTenantAccess(
        req as Request & {
          user?: AuthenticatedRequestUser;
          query: Record<string, unknown>;
          headers: Record<string, string | string[] | undefined>;
          params: Record<string, string>;
        },
        tenantId,
      );

    return this.siteDeletionService.listJobs(resolvedTenantId);
  }

  @Get(":jobId")
  async getOne(
    @Param("tenantId") tenantId: string,
    @Param("jobId") jobId: string,
    @Req() req: Request,
  ) {
    const resolvedTenantId =
      await this.workspaceAccessService.ensureTenantAccess(
        req as Request & {
          user?: AuthenticatedRequestUser;
          query: Record<string, unknown>;
          headers: Record<string, string | string[] | undefined>;
          params: Record<string, string>;
        },
        tenantId,
      );

    return this.siteDeletionService.getJob(resolvedTenantId, jobId);
  }
}
