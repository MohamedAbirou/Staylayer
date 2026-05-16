import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
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

import { AiCitationService } from "./ai-citation.service";

@Controller("seo/ai-citation")
export class AiCitationController {
  constructor(
    private readonly aiCitationService: AiCitationService,
    private readonly workspaceAccessService: WorkspaceAccessService,
  ) {}

  private async ensureSiteAccess(req: Request): Promise<string> {
    return this.workspaceAccessService.ensureSiteAccess(
      req as Request & { user: AuthenticatedRequestUser },
    );
  }

  @Get("overview")
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(
    TenantMembershipRole.OWNER,
    TenantMembershipRole.ADMIN,
    TenantMembershipRole.EDITOR,
  )
  async overview(@Req() req: Request, @Query("siteId") _siteId: string) {
    const siteId = await this.ensureSiteAccess(req);
    return this.aiCitationService.getOverview(siteId);
  }

  @Get("report")
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(
    TenantMembershipRole.OWNER,
    TenantMembershipRole.ADMIN,
    TenantMembershipRole.EDITOR,
  )
  async report(
    @Req() req: Request,
    @Query("siteId") _siteId: string,
    @Query("slug") slug: string,
    @Query("locale") locale: string,
  ) {
    const siteId = await this.ensureSiteAccess(req);
    if (!slug) throw new BadRequestException("slug is required");
    if (!locale) throw new BadRequestException("locale is required");
    return this.aiCitationService.getReport(siteId, slug, locale);
  }

  @Post("analyze")
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(TenantMembershipRole.OWNER, TenantMembershipRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async analyze(
    @Req() req: Request,
    @Query("siteId") _siteId: string,
    @Query("slug") slug: string,
    @Query("locale") locale: string,
  ) {
    const siteId = await this.ensureSiteAccess(req);
    if (!slug) throw new BadRequestException("slug is required");
    if (!locale) throw new BadRequestException("locale is required");
    return this.aiCitationService.analyzePage(siteId, slug, locale);
  }
}
