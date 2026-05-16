import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Header,
  Param,
  Query,
  UseGuards,
  Req,
  Res,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { Request, Response } from "express";
import { TenantMembershipRole } from "@prisma/client";
import { SeoService } from "./seo.service";
import {
  JwtAuthGuard,
  OptionalJwtAuthGuard,
} from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { WorkspaceScopeGuard } from "../auth/guards/workspace-scope.guard";
import { MembershipRoles } from "../auth/decorators/roles.decorator";
import { WorkspaceAccessService } from "../auth/workspace-access.service";
import { AuthenticatedRequestUser } from "../auth/auth.types";
import {
  RedirectMigrationService,
  type ImportMode,
} from "./redirect-migration/redirect-migration.service";

@Controller("seo")
export class SeoController {
  constructor(
    private readonly seoService: SeoService,
    private readonly workspaceAccessService: WorkspaceAccessService,
    private readonly redirectMigrationService: RedirectMigrationService,
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

  // ── Redirect Migration Suite (Phase E.1) ──────────────────────────────────

  @Get("redirects/analysis")
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(
    TenantMembershipRole.OWNER,
    TenantMembershipRole.ADMIN,
    TenantMembershipRole.EDITOR,
  )
  async analyzeRedirects(@Req() req: Request) {
    const siteId = await this.ensureSiteAccess(req);
    return this.redirectMigrationService.analyze(siteId);
  }

  @Get("redirects/export")
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(
    TenantMembershipRole.OWNER,
    TenantMembershipRole.ADMIN,
    TenantMembershipRole.EDITOR,
  )
  @Header("Content-Type", "text/csv; charset=utf-8")
  @Header("Content-Disposition", 'attachment; filename="redirects.csv"')
  async exportRedirects(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<string> {
    const siteId = await this.ensureSiteAccess(req);
    const csv = await this.redirectMigrationService.exportCsv(siteId);
    res.setHeader("Cache-Control", "no-store");
    return csv;
  }

  @Post("redirects/import")
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(TenantMembershipRole.OWNER, TenantMembershipRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async importRedirects(
    @Req() req: Request,
    @Body() body: { csv?: string; mode?: ImportMode },
  ) {
    const siteId = await this.ensureSiteAccess(req);
    const mode: ImportMode =
      body.mode === "overwrite" || body.mode === "strict" ? body.mode : "skip";
    return this.redirectMigrationService.importCsv(
      siteId,
      body.csv ?? "",
      mode,
    );
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
  async getStructuredData(
    @Req() req: Request,
    @Query("siteId") siteId: string,
  ) {
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
