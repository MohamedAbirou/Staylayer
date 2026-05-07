import {
  Controller,
  Get,
  Patch,
  Body,
  UseGuards,
  Req,
  Query,
} from "@nestjs/common";
import { Request } from "express";
import { TenantMembershipRole } from "@prisma/client";
import { SettingsService } from "./settings.service";
import { UpdateSettingsDto } from "./dto/update-settings.dto";
import { SiteSettingsQueryDto } from "./dto/site-settings-query.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { WorkspaceScopeGuard } from "../auth/guards/workspace-scope.guard";
import { MembershipRoles } from "../auth/decorators/roles.decorator";
import { WorkspaceAccessService } from "../auth/workspace-access.service";
import { AuthenticatedRequestUser } from "../auth/auth.types";

@Controller("settings")
@UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
export class SettingsController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly workspaceAccessService: WorkspaceAccessService,
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

  @Get()
  @MembershipRoles(
    TenantMembershipRole.OWNER,
    TenantMembershipRole.ADMIN,
    TenantMembershipRole.EDITOR,
    TenantMembershipRole.BILLING,
  )
  async get(@Query() _query: SiteSettingsQueryDto, @Req() req: Request) {
    const siteId = await this.ensureAuthenticatedSiteAccess(req);
    return this.settingsService.get(siteId);
  }

  @Get("readiness")
  @MembershipRoles(
    TenantMembershipRole.OWNER,
    TenantMembershipRole.ADMIN,
    TenantMembershipRole.EDITOR,
    TenantMembershipRole.BILLING,
  )
  async getReadiness(
    @Query() _query: SiteSettingsQueryDto,
    @Req() req: Request,
  ) {
    const siteId = await this.ensureAuthenticatedSiteAccess(req);
    return this.settingsService.getReadiness(siteId);
  }

  @Patch()
  @MembershipRoles(TenantMembershipRole.OWNER, TenantMembershipRole.ADMIN)
  async update(
    @Query() _query: SiteSettingsQueryDto,
    @Body() dto: UpdateSettingsDto,
    @Req() req: Request,
  ) {
    const siteId = await this.ensureAuthenticatedSiteAccess(req);
    const user = req.user as { email?: string };
    return this.settingsService.update(siteId, dto, user?.email);
  }
}
