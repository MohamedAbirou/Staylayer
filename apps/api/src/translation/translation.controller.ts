import {
  Controller,
  Get,
  Post,
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
import { TranslationService } from "./translation.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { WorkspaceScopeGuard } from "../auth/guards/workspace-scope.guard";
import { MembershipRoles } from "../auth/decorators/roles.decorator";
import { WorkspaceAccessService } from "../auth/workspace-access.service";
import { AuthenticatedRequestUser } from "../auth/auth.types";
import {
  AddTranslationGlossaryTermDto,
  CreateTranslationJobDto,
  TranslationGlossaryPreviewQueryDto,
} from "./dto/translation-locale.dto";

@Controller("translation")
@UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
export class TranslationController {
  constructor(
    private readonly translationService: TranslationService,
    private readonly workspaceAccessService: WorkspaceAccessService,
  ) {}

  private async ensureSiteAccess(req: Request): Promise<string> {
    return this.workspaceAccessService.ensureSiteAccess(
      req as Request & { user: AuthenticatedRequestUser },
    );
  }

  private getUser(req: Request): AuthenticatedRequestUser {
    return (req as Request & { user: AuthenticatedRequestUser }).user;
  }

  // ── Jobs ────────────────────────────────────────────────────────────────────

  @Post("jobs")
  @MembershipRoles(
    TenantMembershipRole.OWNER,
    TenantMembershipRole.ADMIN,
    TenantMembershipRole.EDITOR,
  )
  async createJob(
    @Req() req: Request,
    @Query("siteId") siteId: string,
    @Body() body: CreateTranslationJobDto,
  ) {
    await this.ensureSiteAccess(req);
    const user = this.getUser(req);
    return this.translationService.createJob({
      tenantId: user.activeTenantId!,
      siteId,
      sourceLocale: body.sourceLocale,
      targetLocale: body.targetLocale,
      pageIds: body.pageIds,
      publishedOnly: body.publishedOnly,
      overwrite: body.overwrite,
      autoPublish: body.autoPublish,
      createdBy: user.sub,
    });
  }

  @Get("jobs")
  @MembershipRoles(
    TenantMembershipRole.OWNER,
    TenantMembershipRole.ADMIN,
    TenantMembershipRole.EDITOR,
  )
  async listJobs(
    @Req() req: Request,
    @Query("siteId") siteId: string,
    @Query("limit") limit?: string,
    @Query("cursor") cursor?: string,
  ) {
    await this.ensureSiteAccess(req);
    const user = this.getUser(req);
    return this.translationService.listJobs(user.activeTenantId!, siteId, {
      limit: limit ? parseInt(limit, 10) : undefined,
      cursor,
    });
  }

  @Get("jobs/:jobId")
  @MembershipRoles(
    TenantMembershipRole.OWNER,
    TenantMembershipRole.ADMIN,
    TenantMembershipRole.EDITOR,
  )
  async getJob(@Req() req: Request, @Param("jobId") jobId: string) {
    await this.ensureSiteAccess(req);
    const user = this.getUser(req);
    return this.translationService.getJob(user.activeTenantId!, jobId);
  }

  @Post("jobs/:jobId/approve")
  @HttpCode(HttpStatus.OK)
  @MembershipRoles(TenantMembershipRole.OWNER, TenantMembershipRole.ADMIN)
  async approveJob(@Req() req: Request, @Param("jobId") jobId: string) {
    await this.ensureSiteAccess(req);
    const user = this.getUser(req);
    return this.translationService.approveJob(user.activeTenantId!, jobId);
  }

  @Post("jobs/:jobId/retry")
  @HttpCode(HttpStatus.OK)
  @MembershipRoles(
    TenantMembershipRole.OWNER,
    TenantMembershipRole.ADMIN,
    TenantMembershipRole.EDITOR,
  )
  async retryJob(@Req() req: Request, @Param("jobId") jobId: string) {
    await this.ensureSiteAccess(req);
    const user = this.getUser(req);
    return this.translationService.retryJob(user.activeTenantId!, jobId);
  }

  // ── Locale completeness ─────────────────────────────────────────────────────

  @Get("locale-completeness")
  @MembershipRoles(
    TenantMembershipRole.OWNER,
    TenantMembershipRole.ADMIN,
    TenantMembershipRole.EDITOR,
  )
  async getLocaleCompleteness(
    @Req() req: Request,
    @Query("siteId") siteId: string,
  ) {
    await this.ensureSiteAccess(req);
    return this.translationService.getLocaleCompleteness(siteId);
  }

  @Get("glossary-preview")
  @MembershipRoles(
    TenantMembershipRole.OWNER,
    TenantMembershipRole.ADMIN,
    TenantMembershipRole.EDITOR,
  )
  async getGlossaryPreview(
    @Req() req: Request,
    @Query("siteId") siteId: string,
    @Query() query: TranslationGlossaryPreviewQueryDto,
  ) {
    await this.ensureSiteAccess(req);
    const user = this.getUser(req);
    return this.translationService.getGlossaryPreview(
      user.activeTenantId!,
      siteId,
      query.sourceLocale,
      query.targetLocale,
    );
  }

  // ── Glossary ────────────────────────────────────────────────────────────────

  @Get("glossaries")
  @MembershipRoles(
    TenantMembershipRole.OWNER,
    TenantMembershipRole.ADMIN,
    TenantMembershipRole.EDITOR,
  )
  async listGlossaries(@Req() req: Request, @Query("siteId") siteId?: string) {
    const user = this.getUser(req);
    return this.translationService.listGlossaries(user.activeTenantId!, siteId);
  }

  @Post("glossaries")
  @MembershipRoles(TenantMembershipRole.OWNER, TenantMembershipRole.ADMIN)
  async createGlossary(
    @Req() req: Request,
    @Body() body: { name: string; siteId?: string },
  ) {
    const user = this.getUser(req);
    return this.translationService.createGlossary(user.activeTenantId!, body);
  }

  @Delete("glossaries/:glossaryId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @MembershipRoles(TenantMembershipRole.OWNER, TenantMembershipRole.ADMIN)
  async deleteGlossary(
    @Req() req: Request,
    @Param("glossaryId") glossaryId: string,
  ) {
    const user = this.getUser(req);
    await this.translationService.deleteGlossary(
      user.activeTenantId!,
      glossaryId,
    );
  }

  @Post("glossaries/:glossaryId/terms")
  @MembershipRoles(
    TenantMembershipRole.OWNER,
    TenantMembershipRole.ADMIN,
    TenantMembershipRole.EDITOR,
  )
  async addGlossaryTerm(
    @Req() req: Request,
    @Param("glossaryId") glossaryId: string,
    @Body() body: AddTranslationGlossaryTermDto,
  ) {
    const user = this.getUser(req);
    return this.translationService.addGlossaryTerm(
      user.activeTenantId!,
      glossaryId,
      body,
    );
  }

  @Delete("glossary-terms/:termId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @MembershipRoles(TenantMembershipRole.OWNER, TenantMembershipRole.ADMIN)
  async removeGlossaryTerm(
    @Req() req: Request,
    @Param("termId") termId: string,
  ) {
    const user = this.getUser(req);
    await this.translationService.removeGlossaryTerm(
      user.activeTenantId!,
      termId,
    );
  }
}
