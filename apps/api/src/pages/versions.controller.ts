import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { Request } from "express";
import { TenantMembershipRole } from "@prisma/client";
import { VersionsService } from "./versions.service";
import { PageLocaleQueryDto, VersionQueryDto } from "./dto/page-query.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { WorkspaceScopeGuard } from "../auth/guards/workspace-scope.guard";
import { MembershipRoles } from "../auth/decorators/roles.decorator";
import { WorkspaceAccessService } from "../auth/workspace-access.service";
import { AuthenticatedRequestUser } from "../auth/auth.types";

@Controller("pages/:slug/versions")
@UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
export class VersionsController {
  constructor(
    private readonly versionsService: VersionsService,
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
  )
  async listVersions(
    @Param("slug") slug: string,
    @Query() query: VersionQueryDto,
    @Req() req: Request,
  ): Promise<{
    data: { id: string; savedBy: string; note: string | null; savedAt: Date }[];
    total: number;
    page: number;
    limit: number;
  }> {
    const siteId = await this.ensureAuthenticatedSiteAccess(req);
    return this.versionsService.listVersions(
      siteId,
      slug,
      query.locale || "en",
      query.page,
      query.limit,
    );
  }

  @Post(":id/restore")
  @MembershipRoles(TenantMembershipRole.OWNER, TenantMembershipRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async restoreVersion(
    @Param("slug") slug: string,
    @Param("id") versionId: string,
    @Query() query: PageLocaleQueryDto,
    @Req() req: Request,
  ): Promise<Record<string, unknown>> {
    const siteId = await this.ensureAuthenticatedSiteAccess(req);
    const user = req.user as { sub: string };
    return this.versionsService.restoreVersion(
      siteId,
      slug,
      query.locale || "en",
      versionId,
      user.sub,
    );
  }
}
