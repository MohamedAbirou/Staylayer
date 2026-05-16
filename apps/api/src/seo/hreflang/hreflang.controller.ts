import {
  Body,
  Controller,
  Get,
  Param,
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

import { HreflangScanService } from "./hreflang.service";
import {
  BulkCreateStubsDto,
  ListHreflangIssuesQueryDto,
  ListHreflangScansQueryDto,
} from "./dto/hreflang.dto";

@Controller("seo/hreflang")
export class HreflangController {
  constructor(
    private readonly service: HreflangScanService,
    private readonly workspaceAccessService: WorkspaceAccessService,
  ) {}

  private async siteFromReq(req: Request): Promise<string> {
    return this.workspaceAccessService.ensureSiteAccess(
      req as Request & { user: AuthenticatedRequestUser },
    );
  }

  private actor(req: Request): string | null {
    const user = (req as Request & { user?: AuthenticatedRequestUser }).user;
    return user?.sub ?? user?.email ?? null;
  }

  @Post("scans")
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(
    TenantMembershipRole.OWNER,
    TenantMembershipRole.ADMIN,
    TenantMembershipRole.EDITOR,
  )
  async runScan(@Req() req: Request, @Query("siteId") _s?: string) {
    const siteId = await this.siteFromReq(req);
    return this.service.runScan(siteId, {
      triggeredBy: this.actor(req),
    });
  }

  @Get("scans")
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(
    TenantMembershipRole.OWNER,
    TenantMembershipRole.ADMIN,
    TenantMembershipRole.EDITOR,
  )
  async listScans(
    @Req() req: Request,
    @Query("siteId") _s: string,
    @Query() query: ListHreflangScansQueryDto,
  ) {
    const siteId = await this.siteFromReq(req);
    return this.service.listScans(siteId, query.limit ?? 25);
  }

  @Get("scans/latest")
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(
    TenantMembershipRole.OWNER,
    TenantMembershipRole.ADMIN,
    TenantMembershipRole.EDITOR,
  )
  async latest(@Req() req: Request, @Query("siteId") _s?: string) {
    const siteId = await this.siteFromReq(req);
    return this.service.getLatestScan(siteId);
  }

  @Get("scans/:id")
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(
    TenantMembershipRole.OWNER,
    TenantMembershipRole.ADMIN,
    TenantMembershipRole.EDITOR,
  )
  async getScan(
    @Req() req: Request,
    @Query("siteId") _s: string,
    @Param("id") id: string,
  ) {
    const siteId = await this.siteFromReq(req);
    return this.service.getScan(siteId, id);
  }

  @Get("issues")
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(
    TenantMembershipRole.OWNER,
    TenantMembershipRole.ADMIN,
    TenantMembershipRole.EDITOR,
  )
  async listIssues(
    @Req() req: Request,
    @Query("siteId") _s: string,
    @Query() query: ListHreflangIssuesQueryDto,
  ) {
    const siteId = await this.siteFromReq(req);
    return this.service.listIssues(siteId, {
      scanId: query.scanId,
      type: query.type,
      severity: query.severity,
      slug: query.slug,
      includeDismissed: query.includeDismissed,
      limit: query.limit,
      cursor: query.cursor,
    });
  }

  @Post("issues/:id/dismiss")
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(
    TenantMembershipRole.OWNER,
    TenantMembershipRole.ADMIN,
    TenantMembershipRole.EDITOR,
  )
  async dismissIssue(
    @Req() req: Request,
    @Query("siteId") _s: string,
    @Param("id") id: string,
  ) {
    const siteId = await this.siteFromReq(req);
    return this.service.dismissIssue(siteId, id, this.actor(req));
  }

  @Post("issues/:id/undismiss")
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(
    TenantMembershipRole.OWNER,
    TenantMembershipRole.ADMIN,
    TenantMembershipRole.EDITOR,
  )
  async undismissIssue(
    @Req() req: Request,
    @Query("siteId") _s: string,
    @Param("id") id: string,
  ) {
    const siteId = await this.siteFromReq(req);
    return this.service.undismissIssue(siteId, id);
  }

  @Post("bulk/create-stubs")
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(
    TenantMembershipRole.OWNER,
    TenantMembershipRole.ADMIN,
    TenantMembershipRole.EDITOR,
  )
  async bulkCreateStubs(
    @Req() req: Request,
    @Query("siteId") _s: string,
    @Body() body: BulkCreateStubsDto,
  ) {
    const siteId = await this.siteFromReq(req);
    return this.service.bulkCreateStubs(siteId, {
      pairs: body.pairs,
      triggeredBy: this.actor(req),
    });
  }
}
