import {
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Request } from "express";
import { TenantMembershipRole } from "@prisma/client";

import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import { WorkspaceScopeGuard } from "../../auth/guards/workspace-scope.guard";
import { MembershipRoles } from "../../auth/decorators/roles.decorator";
import { WorkspaceAccessService } from "../../auth/workspace-access.service";
import { AuthenticatedRequestUser } from "../../auth/auth.types";

import { ImageAuditService } from "./image-audit.service";

@Controller("seo/images")
export class ImageAuditController {
  constructor(
    private readonly imageAuditService: ImageAuditService,
    private readonly workspaceAccessService: WorkspaceAccessService,
  ) {}

  private async ensureSiteAccess(req: Request): Promise<string> {
    return this.workspaceAccessService.ensureSiteAccess(
      req as Request & { user: AuthenticatedRequestUser },
    );
  }

  /** Job-level rollups (summary card on the dashboard Images tab). */
  @Get("jobs/:jobId/summary")
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(
    TenantMembershipRole.OWNER,
    TenantMembershipRole.ADMIN,
    TenantMembershipRole.EDITOR,
  )
  async jobSummary(
    @Req() req: Request,
    @Query("siteId") _siteId: string,
    @Param("jobId") jobId: string,
  ) {
    const siteId = await this.ensureSiteAccess(req);
    return this.imageAuditService.getJobSummary(siteId, jobId);
  }

  /** Paginated list of pages with image issues, worst first. */
  @Get("jobs/:jobId/pages")
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(
    TenantMembershipRole.OWNER,
    TenantMembershipRole.ADMIN,
    TenantMembershipRole.EDITOR,
  )
  async listPages(
    @Req() req: Request,
    @Query("siteId") _siteId: string,
    @Param("jobId") jobId: string,
    @Query("cursor") cursor?: string,
    @Query("limit", new DefaultValuePipe(50), ParseIntPipe) limit?: number,
  ) {
    const siteId = await this.ensureSiteAccess(req);
    return this.imageAuditService.listPagesWithImageIssues(siteId, jobId, {
      cursor,
      limit,
    });
  }

  /** Per-page drill-down: every image with its findings. */
  @Get("jobs/:jobId/results/:resultId/findings")
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(
    TenantMembershipRole.OWNER,
    TenantMembershipRole.ADMIN,
    TenantMembershipRole.EDITOR,
  )
  async listPageFindings(
    @Req() req: Request,
    @Query("siteId") _siteId: string,
    @Param("jobId") jobId: string,
    @Param("resultId") resultId: string,
    @Query("limit", new DefaultValuePipe(100), ParseIntPipe) limit?: number,
  ) {
    const siteId = await this.ensureSiteAccess(req);
    return this.imageAuditService.listPageImageFindings(
      siteId,
      jobId,
      resultId,
      { limit },
    );
  }
}
