import { Controller, Get, Query, Req, UseGuards } from "@nestjs/common";
import { Request } from "express";
import { TenantMembershipRole } from "@prisma/client";

import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import { WorkspaceScopeGuard } from "../../auth/guards/workspace-scope.guard";
import { MembershipRoles } from "../../auth/decorators/roles.decorator";
import { WorkspaceAccessService } from "../../auth/workspace-access.service";
import { AuthenticatedRequestUser } from "../../auth/auth.types";

import { SitemapService } from "./sitemap.service";

@Controller("seo/sitemap")
export class SitemapController {
  constructor(
    private readonly sitemapService: SitemapService,
    private readonly workspaceAccessService: WorkspaceAccessService,
  ) {}

  @Get("preview")
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(
    TenantMembershipRole.OWNER,
    TenantMembershipRole.ADMIN,
    TenantMembershipRole.EDITOR,
  )
  async preview(@Req() req: Request, @Query("siteId") _siteId: string) {
    const siteId = await this.workspaceAccessService.ensureSiteAccess(
      req as Request & { user: AuthenticatedRequestUser },
    );
    return this.sitemapService.preview(siteId);
  }
}
