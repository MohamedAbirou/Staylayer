import {
  Body,
  Controller,
  Get,
  Put,
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

import {
  TestRobotsRuleDto,
  UpdateRobotsSettingsDto,
} from "./dto/update-robots-settings.dto";
import { RobotsService } from "./robots.service";

@Controller("seo/robots")
export class RobotsController {
  constructor(
    private readonly robotsService: RobotsService,
    private readonly workspaceAccessService: WorkspaceAccessService,
  ) {}

  private async ensureSiteAccess(req: Request): Promise<string> {
    return this.workspaceAccessService.ensureSiteAccess(
      req as Request & { user: AuthenticatedRequestUser },
    );
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(
    TenantMembershipRole.OWNER,
    TenantMembershipRole.ADMIN,
    TenantMembershipRole.EDITOR,
  )
  async getSettings(@Req() req: Request, @Query("siteId") siteId: string) {
    const authorizedSiteId = await this.ensureSiteAccess(req);
    return this.robotsService.getSettings(authorizedSiteId || siteId);
  }

  @Put()
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(TenantMembershipRole.OWNER, TenantMembershipRole.ADMIN)
  async updateSettings(
    @Req() req: Request,
    @Query("siteId") siteId: string,
    @Body() body: UpdateRobotsSettingsDto,
  ) {
    const authorizedSiteId = await this.ensureSiteAccess(req);
    const user = (req as Request & { user?: AuthenticatedRequestUser }).user;
    return this.robotsService.updateSettings(authorizedSiteId || siteId, {
      ...body,
      updatedBy: user?.sub ?? user?.email,
    });
  }

  @Get("preview")
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(
    TenantMembershipRole.OWNER,
    TenantMembershipRole.ADMIN,
    TenantMembershipRole.EDITOR,
  )
  async preview(@Req() req: Request, @Query("siteId") siteId: string) {
    const authorizedSiteId = await this.ensureSiteAccess(req);
    return this.robotsService.previewRobotsTxt(authorizedSiteId || siteId);
  }

  @Get("validate")
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(
    TenantMembershipRole.OWNER,
    TenantMembershipRole.ADMIN,
    TenantMembershipRole.EDITOR,
  )
  async validate(@Req() req: Request, @Query("siteId") siteId: string) {
    const authorizedSiteId = await this.ensureSiteAccess(req);
    return this.robotsService.validateForSite(authorizedSiteId || siteId);
  }

  @Post("test")
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(
    TenantMembershipRole.OWNER,
    TenantMembershipRole.ADMIN,
    TenantMembershipRole.EDITOR,
  )
  async test(
    @Req() req: Request,
    @Query("siteId") siteId: string,
    @Body() body: TestRobotsRuleDto,
  ) {
    const authorizedSiteId = await this.ensureSiteAccess(req);
    return this.robotsService.testForSite(authorizedSiteId || siteId, body);
  }
}
