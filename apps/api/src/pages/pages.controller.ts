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
import { Role } from "@prisma/client";
import { PagesService } from "./pages.service";
import { CreatePageDto } from "./dto/create-page.dto";
import { UpdatePageDto } from "./dto/update-page.dto";
import { DuplicatePageDto } from "./dto/duplicate-page.dto";
import { BulkActionDto } from "./dto/bulk-action.dto";
import {
  PageQueryDto,
  PageLocaleQueryDto,
  SiteScopedQueryDto,
} from "./dto/page-query.dto";
import {
  JwtAuthGuard,
  OptionalJwtAuthGuard,
} from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { RevalidationService } from "../revalidation/revalidation.service";

@Controller("pages")
export class PagesController {
  constructor(
    private readonly pagesService: PagesService,
    private readonly revalidationService: RevalidationService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async findAll(@Query() query: PageQueryDto): Promise<{
    data: Record<string, unknown>[];
    total: number;
    page: number;
    limit: number;
  }> {
    return this.pagesService.findAll(query.siteId, {
      locale: query.locale,
      published: query.published,
      deleted: query.deleted,
      page: query.page,
      limit: query.limit,
      search: query.search,
    });
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Query() query: SiteScopedQueryDto,
    @Body() dto: CreatePageDto,
    @Req() req: Request,
  ): Promise<Record<string, unknown>> {
    const user = req.user as { sub: string };
    return this.pagesService.createPage(query.siteId, dto, user.sub);
  }

  // ─── Bulk operations (MUST be before :slug routes) ───────

  @Post("bulk/publish")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async bulkPublish(
    @Query() query: SiteScopedQueryDto,
    @Body() dto: BulkActionDto,
  ): Promise<{ message: string; count: number }> {
    const result = await this.pagesService.bulkPublish(query.siteId, dto.pages);
    for (const p of dto.pages) {
      await this.revalidationService.revalidatePage(p.slug);
    }
    return result;
  }

  @Post("bulk/unpublish")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async bulkUnpublish(
    @Query() query: SiteScopedQueryDto,
    @Body() dto: BulkActionDto,
  ): Promise<{ message: string; count: number }> {
    const result = await this.pagesService.bulkUnpublish(
      query.siteId,
      dto.pages,
    );
    for (const p of dto.pages) {
      await this.revalidationService.revalidatePage(p.slug);
    }
    return result;
  }

  @Post("bulk/delete")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async bulkDelete(
    @Query() query: SiteScopedQueryDto,
    @Body() dto: BulkActionDto,
  ): Promise<{ message: string; count: number }> {
    return this.pagesService.bulkDelete(query.siteId, dto.pages);
  }

  @Post("bulk/restore")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async bulkRestore(
    @Query() query: SiteScopedQueryDto,
    @Body() dto: BulkActionDto,
  ): Promise<{ message: string; count: number }> {
    return this.pagesService.bulkRestore(query.siteId, dto.pages);
  }

  @Post("bulk/permanent-delete")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async bulkPermanentlyDelete(
    @Query() query: SiteScopedQueryDto,
    @Body() dto: BulkActionDto,
  ): Promise<{ message: string; count: number }> {
    return this.pagesService.bulkPermanentlyDelete(query.siteId, dto.pages);
  }

  // ─── Single page parameterised routes ────────────────────

  @Get(":slug")
  @UseGuards(OptionalJwtAuthGuard)
  async findOne(
    @Param("slug") slug: string,
    @Query() query: PageLocaleQueryDto,
    @Req() req: Request,
  ): Promise<Record<string, unknown>> {
    const isAuthenticated = !!(req as Request & { user?: unknown }).user;

    if (query.published === true && !isAuthenticated) {
      return this.pagesService.findBySlug(
        query.siteId,
        slug,
        query.locale || "en",
        true,
      );
    }

    if (isAuthenticated) {
      return this.pagesService.findBySlug(
        query.siteId,
        slug,
        query.locale || "en",
        query.published === true,
      );
    }

    throw new UnauthorizedException();
  }

  @Put(":slug")
  @UseGuards(JwtAuthGuard)
  async update(
    @Param("slug") slug: string,
    @Query() query: PageLocaleQueryDto,
    @Body() dto: UpdatePageDto,
    @Req() req: Request,
  ): Promise<Record<string, unknown>> {
    const user = req.user as { sub: string };
    return this.pagesService.updatePage(
      query.siteId,
      slug,
      query.locale || "en",
      dto,
      user.sub,
    );
  }

  @Delete(":slug")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  async remove(
    @Param("slug") slug: string,
    @Query() query: PageLocaleQueryDto,
  ): Promise<{ message: string }> {
    return this.pagesService.deletePage(
      query.siteId,
      slug,
      query.locale || "en",
    );
  }

  @Post(":slug/publish")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async publish(
    @Param("slug") slug: string,
    @Query() query: PageLocaleQueryDto,
  ): Promise<{ message: string; slug: string; locale: string }> {
    const result = await this.pagesService.publishPage(
      query.siteId,
      slug,
      query.locale || "en",
    );
    await this.revalidationService.revalidatePage(slug);
    return result;
  }

  @Post(":slug/unpublish")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async unpublish(
    @Param("slug") slug: string,
    @Query() query: PageLocaleQueryDto,
  ): Promise<{ message: string; slug: string; locale: string }> {
    const result = await this.pagesService.unpublishPage(
      query.siteId,
      slug,
      query.locale || "en",
    );
    await this.revalidationService.revalidatePage(slug);
    return result;
  }

  @Post(":slug/restore")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async restore(
    @Param("slug") slug: string,
    @Query() query: PageLocaleQueryDto,
  ): Promise<{ message: string; slug: string; locale: string }> {
    return this.pagesService.restorePage(
      query.siteId,
      slug,
      query.locale || "en",
    );
  }

  @Delete(":slug/permanent")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  async permanentlyRemove(
    @Param("slug") slug: string,
    @Query() query: PageLocaleQueryDto,
  ): Promise<{ message: string }> {
    return this.pagesService.permanentlyDeletePage(
      query.siteId,
      slug,
      query.locale || "en",
    );
  }

  @Post(":slug/duplicate")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async duplicate(
    @Param("slug") slug: string,
    @Query() query: PageLocaleQueryDto,
    @Body() dto: DuplicatePageDto,
    @Req() req: Request,
  ): Promise<Record<string, unknown>> {
    const user = req.user as { sub: string };
    return this.pagesService.duplicatePage(
      query.siteId,
      slug,
      query.locale || "en",
      dto.newSlug,
      dto.newTitle,
      dto.newLocale || query.locale || "en",
      user.sub,
    );
  }

  @Get(":slug/preview")
  @UseGuards(JwtAuthGuard)
  async preview(
    @Param("slug") slug: string,
    @Query() query: PageLocaleQueryDto,
  ): Promise<Record<string, unknown>> {
    return this.pagesService.getPreviewData(
      query.siteId,
      slug,
      query.locale || "en",
    );
  }
}
