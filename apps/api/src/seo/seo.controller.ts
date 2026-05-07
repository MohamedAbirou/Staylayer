import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { Request } from "express";
import { TenantMembershipRole } from "@prisma/client";
import { SeoService } from "./seo.service";
import { JwtAuthGuard, OptionalJwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { WorkspaceScopeGuard } from "../auth/guards/workspace-scope.guard";
import { MembershipRoles } from "../auth/decorators/roles.decorator";
import { WorkspaceAccessService } from "../auth/workspace-access.service";
import { AuthenticatedRequestUser } from "../auth/auth.types";

@Controller("seo")
export class SeoController {
  constructor(
    private readonly seoService: SeoService,
    private readonly workspaceAccessService: WorkspaceAccessService,
  ) {}

  private async ensureSiteAccess(req: Request): Promise<string> {
    return this.workspaceAccessService.ensureSiteAccess(
      req as Request & { user: AuthenticatedRequestUser },
    );
  }

  // ── Redirects ─────────────────────────────────────────────────────────────

  @Get("redirects")
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(
    TenantMembershipRole.OWNER,
    TenantMembershipRole.ADMIN,
    TenantMembershipRole.EDITOR,
  )
  async listRedirects(@Req() req: Request, @Query("siteId") siteId: string) {
    await this.ensureSiteAccess(req);
    return this.seoService.listRedirects(siteId);
  }

  @Post("redirects")
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(TenantMembershipRole.OWNER, TenantMembershipRole.ADMIN)
  async createRedirect(
    @Req() req: Request,
    @Query("siteId") siteId: string,
    @Body()
    body: {
      fromPath: string;
      toPath: string;
      statusCode?: number;
      locale?: string;
      reason?: string;
      permanent?: boolean;
    },
  ) {
    await this.ensureSiteAccess(req);
    return this.seoService.createRedirect({ siteId, ...body });
  }

  @Patch("redirects/:id/toggle")
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(TenantMembershipRole.OWNER, TenantMembershipRole.ADMIN)
  async toggleRedirect(
    @Req() req: Request,
    @Query("siteId") siteId: string,
    @Param("id") id: string,
    @Body() body: { enabled: boolean },
  ) {
    await this.ensureSiteAccess(req);
    return this.seoService.toggleRedirect(siteId, id, body.enabled);
  }

  @Delete("redirects/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(TenantMembershipRole.OWNER, TenantMembershipRole.ADMIN)
  async deleteRedirect(
    @Req() req: Request,
    @Query("siteId") siteId: string,
    @Param("id") id: string,
  ) {
    await this.ensureSiteAccess(req);
    await this.seoService.deleteRedirect(siteId, id);
  }

  // Public resolve endpoint (used by website at runtime)
  @Get("redirects/resolve")
  @UseGuards(OptionalJwtAuthGuard)
  async resolveRedirect(
    @Query("siteId") siteId: string,
    @Query("path") path: string,
    @Query("locale") locale?: string,
  ) {
    const result = await this.seoService.resolveRedirect(siteId, path, locale);
    return result ?? { redirect: null };
  }

  // ── SEO Validation ────────────────────────────────────────────────────────

  @Get("validate")
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(
    TenantMembershipRole.OWNER,
    TenantMembershipRole.ADMIN,
    TenantMembershipRole.EDITOR,
  )
  async validateSeo(
    @Req() req: Request,
    @Query("siteId") siteId: string,
    @Query("slug") slug: string,
    @Query("locale") locale: string,
  ) {
    await this.ensureSiteAccess(req);
    return this.seoService.validatePageSeo(siteId, slug, locale ?? "en");
  }

  // ── Structured Data ───────────────────────────────────────────────────────

  @Get("structured-data")
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(
    TenantMembershipRole.OWNER,
    TenantMembershipRole.ADMIN,
    TenantMembershipRole.EDITOR,
  )
  async getStructuredData(@Req() req: Request, @Query("siteId") siteId: string) {
    await this.ensureSiteAccess(req);
    return this.seoService.getStructuredData(siteId);
  }

  @Post("structured-data")
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(TenantMembershipRole.OWNER, TenantMembershipRole.ADMIN)
  async upsertStructuredData(
    @Req() req: Request,
    @Query("siteId") siteId: string,
    @Body() body: Record<string, unknown>,
  ) {
    await this.ensureSiteAccess(req);
    return this.seoService.upsertStructuredData(siteId, body);
  }

  // Public JSON-LD endpoint (used by website for rendering)
  @Get("structured-data/json-ld")
  @UseGuards(OptionalJwtAuthGuard)
  async getJsonLd(@Query("siteId") siteId: string) {
    return this.seoService.generateJsonLd(siteId);
  }
}
