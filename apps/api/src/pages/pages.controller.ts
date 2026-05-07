import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from "@nestjs/common";
import { Request } from "express";
import { TenantMembershipRole } from "@prisma/client";
import { PagesService } from "./pages.service";
import { CreatePageDto } from "./dto/create-page.dto";
import { UpdatePageDto } from "./dto/update-page.dto";
import { DuplicatePageDto } from "./dto/duplicate-page.dto";
import { BulkActionDto } from "./dto/bulk-action.dto";
import {
  PageQueryDto,
  PageLocaleQueryDto,
  PublishedPagesQueryDto,
  SiteScopedQueryDto,
} from "./dto/page-query.dto";
import {
  JwtAuthGuard,
  OptionalJwtAuthGuard,
} from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { WorkspaceScopeGuard } from "../auth/guards/workspace-scope.guard";
import { MembershipRoles } from "../auth/decorators/roles.decorator";
import { WorkspaceAccessService } from "../auth/workspace-access.service";
import { AuthenticatedRequestUser } from "../auth/auth.types";
import { RevalidationService } from "../revalidation/revalidation.service";

@Controller("pages")
export class PagesController {
  constructor(
    private readonly pagesService: PagesService,
    private readonly revalidationService: RevalidationService,
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
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(
    TenantMembershipRole.OWNER,
    TenantMembershipRole.ADMIN,
    TenantMembershipRole.EDITOR,
  )
  async findAll(
    @Query() query: PageQueryDto,
    @Req() req: Request,
  ): Promise<{
    data: Record<string, unknown>[];
    total: number;
    page: number;
    limit: number;
  }> {
    const siteId = await this.ensureAuthenticatedSiteAccess(req);

    return this.pagesService.findAll(siteId, {
      locale: query.locale,
      published: query.published,
      deleted: query.deleted,
      page: query.page,
      limit: query.limit,
      search: query.search,
    });
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(
    TenantMembershipRole.OWNER,
    TenantMembershipRole.ADMIN,
    TenantMembershipRole.EDITOR,
  )
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Query() _query: SiteScopedQueryDto,
    @Body() dto: CreatePageDto,
    @Req() req: Request,
  ): Promise<Record<string, unknown>> {
    const siteId = await this.ensureAuthenticatedSiteAccess(req);
    const user = req.user as { sub: string };

    return this.pagesService.createPage(siteId, dto, user.sub);
  }

  @Get("published")
  async findPublished(
    @Query() query: PublishedPagesQueryDto,
  ): Promise<Array<{ slug: string; locale: string }>> {
    return this.pagesService.findPublishedSlugs(query.siteId, query.locale);
  }

  @Post("bulk/publish")
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(TenantMembershipRole.OWNER, TenantMembershipRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async bulkPublish(
    @Query() _query: SiteScopedQueryDto,
    @Body() dto: BulkActionDto,
    @Req() req: Request,
  ): Promise<{ message: string; count: number }> {
    const siteId = await this.ensureAuthenticatedSiteAccess(req);
    const result = await this.pagesService.bulkPublish(siteId, dto.pages);

    for (const page of dto.pages) {
      await this.revalidationService.revalidatePage(siteId, page.slug);
    }

    return result;
  }

  @Post("bulk/unpublish")
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(TenantMembershipRole.OWNER, TenantMembershipRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async bulkUnpublish(
    @Query() _query: SiteScopedQueryDto,
    @Body() dto: BulkActionDto,
    @Req() req: Request,
  ): Promise<{ message: string; count: number }> {
    const siteId = await this.ensureAuthenticatedSiteAccess(req);
    const result = await this.pagesService.bulkUnpublish(siteId, dto.pages);

    for (const page of dto.pages) {
      await this.revalidationService.revalidatePage(siteId, page.slug);
    }

    return result;
  }

  @Post("bulk/delete")
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(TenantMembershipRole.OWNER, TenantMembershipRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async bulkDelete(
    @Query() _query: SiteScopedQueryDto,
    @Body() dto: BulkActionDto,
    @Req() req: Request,
  ): Promise<{ message: string; count: number }> {
    const siteId = await this.ensureAuthenticatedSiteAccess(req);
    return this.pagesService.bulkDelete(siteId, dto.pages);
  }

  @Post("bulk/restore")
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(TenantMembershipRole.OWNER, TenantMembershipRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async bulkRestore(
    @Query() _query: SiteScopedQueryDto,
    @Body() dto: BulkActionDto,
    @Req() req: Request,
  ): Promise<{ message: string; count: number }> {
    const siteId = await this.ensureAuthenticatedSiteAccess(req);
    return this.pagesService.bulkRestore(siteId, dto.pages);
  }

  @Post("bulk/permanent-delete")
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(TenantMembershipRole.OWNER)
  @HttpCode(HttpStatus.OK)
  async bulkPermanentlyDelete(
    @Query() _query: SiteScopedQueryDto,
    @Body() dto: BulkActionDto,
    @Req() req: Request,
  ): Promise<{ message: string; count: number }> {
    const siteId = await this.ensureAuthenticatedSiteAccess(req);
    return this.pagesService.bulkPermanentlyDelete(siteId, dto.pages);
  }

  @Get(":slug")
  @UseGuards(OptionalJwtAuthGuard)
  async findOne(
    @Param("slug") slug: string,
    @Query() query: PageLocaleQueryDto,
    @Req() req: Request,
  ): Promise<Record<string, unknown>> {
    const request = req as Request & {
      user?: AuthenticatedRequestUser;
    };
    const isAuthenticated = !!request.user;

    if (query.published === true && !isAuthenticated) {
      return this.pagesService.findBySlug(
        query.siteId,
        slug,
        query.locale || "en",
        true,
      );
    }

    if (isAuthenticated) {
      const siteId = await this.ensureAuthenticatedSiteAccess(req);
      return this.pagesService.findBySlug(
        siteId,
        slug,
        query.locale || "en",
        query.published === true,
      );
    }

    throw new UnauthorizedException();
  }

  @Put(":slug")
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(
    TenantMembershipRole.OWNER,
    TenantMembershipRole.ADMIN,
    TenantMembershipRole.EDITOR,
  )
  async update(
    @Param("slug") slug: string,
    @Query() query: PageLocaleQueryDto,
    @Body() dto: UpdatePageDto,
    @Req() req: Request,
  ): Promise<Record<string, unknown>> {
    const siteId = await this.ensureAuthenticatedSiteAccess(req);
    const user = req.user as { sub: string };

    return this.pagesService.updatePage(
      siteId,
      slug,
      query.locale || "en",
      dto,
      user.sub,
    );
  }

  @Delete(":slug")
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(TenantMembershipRole.OWNER, TenantMembershipRole.ADMIN)
  async remove(
    @Param("slug") slug: string,
    @Query() query: PageLocaleQueryDto,
    @Req() req: Request,
  ): Promise<{ message: string }> {
    const siteId = await this.ensureAuthenticatedSiteAccess(req);
    return this.pagesService.deletePage(siteId, slug, query.locale || "en");
  }

  @Post(":slug/publish")
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(TenantMembershipRole.OWNER, TenantMembershipRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async publish(
    @Param("slug") slug: string,
    @Query() query: PageLocaleQueryDto,
    @Req() req: Request,
  ): Promise<{ message: string; slug: string; locale: string }> {
    const siteId = await this.ensureAuthenticatedSiteAccess(req);
    const result = await this.pagesService.publishPage(
      siteId,
      slug,
      query.locale || "en",
    );

    await this.revalidationService.revalidatePage(siteId, slug);
    return result;
  }

  @Post(":slug/unpublish")
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(TenantMembershipRole.OWNER, TenantMembershipRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async unpublish(
    @Param("slug") slug: string,
    @Query() query: PageLocaleQueryDto,
    @Req() req: Request,
  ): Promise<{ message: string; slug: string; locale: string }> {
    const siteId = await this.ensureAuthenticatedSiteAccess(req);
    const result = await this.pagesService.unpublishPage(
      siteId,
      slug,
      query.locale || "en",
    );

    await this.revalidationService.revalidatePage(siteId, slug);
    return result;
  }

  @Post(":slug/restore")
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(TenantMembershipRole.OWNER, TenantMembershipRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async restore(
    @Param("slug") slug: string,
    @Query() query: PageLocaleQueryDto,
    @Req() req: Request,
  ): Promise<{ message: string; slug: string; locale: string }> {
    const siteId = await this.ensureAuthenticatedSiteAccess(req);
    return this.pagesService.restorePage(siteId, slug, query.locale || "en");
  }

  @Delete(":slug/permanent")
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(TenantMembershipRole.OWNER)
  async permanentlyRemove(
    @Param("slug") slug: string,
    @Query() query: PageLocaleQueryDto,
    @Req() req: Request,
  ): Promise<{ message: string }> {
    const siteId = await this.ensureAuthenticatedSiteAccess(req);
    return this.pagesService.permanentlyDeletePage(
      siteId,
      slug,
      query.locale || "en",
    );
  }

  @Post(":slug/duplicate")
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(
    TenantMembershipRole.OWNER,
    TenantMembershipRole.ADMIN,
    TenantMembershipRole.EDITOR,
  )
  @HttpCode(HttpStatus.CREATED)
  async duplicate(
    @Param("slug") slug: string,
    @Query() query: PageLocaleQueryDto,
    @Body() dto: DuplicatePageDto,
    @Req() req: Request,
  ): Promise<Record<string, unknown>> {
    const siteId = await this.ensureAuthenticatedSiteAccess(req);
    const user = req.user as { sub: string };

    return this.pagesService.duplicatePage(
      siteId,
      slug,
      query.locale || "en",
      dto.newSlug,
      dto.newTitle,
      dto.newLocale || query.locale || "en",
      user.sub,
    );
  }

  @Get(":slug/preview")
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(
    TenantMembershipRole.OWNER,
    TenantMembershipRole.ADMIN,
    TenantMembershipRole.EDITOR,
  )
  async preview(
    @Param("slug") slug: string,
    @Query() query: PageLocaleQueryDto,
    @Req() req: Request,
  ): Promise<Record<string, unknown>> {
    const siteId = await this.ensureAuthenticatedSiteAccess(req);
    return this.pagesService.getPreviewData(siteId, slug, query.locale || "en");
  }
}
