import {
  ConflictException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { BillingService } from "../billing/billing.service";
import { CreatePageDto } from "./dto/create-page.dto";
import { UpdatePageDto } from "./dto/update-page.dto";

const MAX_PUCK_DATA_SIZE = 5 * 1024 * 1024; // 5 MB

@Injectable()
export class PagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly billingService: BillingService,
  ) {}

  async createPage(
    siteId: string,
    dto: CreatePageDto,
    userId: string,
  ): Promise<Record<string, unknown>> {
    this.validatePuckDataSize(dto.puckData);

    const existing = await this.prisma.page.findUnique({
      where: this.pageWhereUnique(siteId, dto.slug, dto.locale),
    });

    if (existing) {
      throw new ConflictException({
        code: "CONFLICT",
        message: `Page with slug '${dto.slug}' and locale '${dto.locale}' already exists`,
      });
    }

    await this.billingService.assertCanIncreasePageCount(siteId, 1);

    if (dto.published === true) {
      await this.billingService.assertCanPublishSite(siteId);
    }

    const page = await this.prisma.page.create({
      data: {
        siteId,
        slug: dto.slug,
        locale: dto.locale,
        title: dto.title,
        puckData: dto.puckData as unknown as Prisma.InputJsonValue,
        seoTitle: dto.seoTitle,
        seoDescription: dto.seoDescription,
        seoKeywords: dto.seoKeywords,
        seoOgImage: dto.seoOgImage,
        seoCanonical: dto.seoCanonical,
        seoNoindex: dto.seoNoindex ?? false,
        published: dto.published ?? false,
      },
    });

    // Create initial version
    await this.prisma.pageVersion.create({
      data: {
        pageId: page.id,
        puckData: dto.puckData as unknown as Prisma.InputJsonValue,
        savedBy: userId,
        note: "Initial version",
      },
    });

    return page as unknown as Record<string, unknown>;
  }

  async findAll(
    siteId: string,
    filters: {
      locale?: string;
      published?: boolean;
      page?: number;
      limit?: number;
      search?: string;
      deleted?: boolean;
    },
  ): Promise<{
    data: Record<string, unknown>[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const skip = (page - 1) * limit;

    const where: Prisma.PageWhereInput = { siteId };
    if (filters.locale) where.locale = filters.locale;
    if (filters.published !== undefined) where.published = filters.published;
    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: "insensitive" } },
        { slug: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    // Soft-delete filter: by default exclude deleted pages
    if (filters.deleted === true) {
      where.deletedAt = { not: null };
    } else {
      where.deletedAt = null;
    }

    const [data, total] = await Promise.all([
      this.prisma.page.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          slug: true,
          locale: true,
          title: true,
          published: true,
          seoTitle: true,
          seoDescription: true,
          seoKeywords: true,
          seoOgImage: true,
          seoNoindex: true,
          deletedAt: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: "desc" },
      }),
      this.prisma.page.count({ where }),
    ]);

    return {
      data: data as unknown as Record<string, unknown>[],
      total,
      page,
      limit,
    };
  }

  async findBySlug(
    siteId: string,
    slug: string,
    locale: string = "en",
    publishedOnly: boolean = false,
  ): Promise<Record<string, unknown>> {
    const where: Prisma.PageWhereInput = {
      siteId,
      slug,
      locale,
      deletedAt: null,
    };
    if (publishedOnly) where.published = true;

    const page = await this.prisma.page.findFirst({ where });

    if (!page) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Page not found",
      });
    }

    return page as unknown as Record<string, unknown>;
  }

  async findPublishedSlugs(
    siteId: string,
    locale?: string,
  ): Promise<Array<{ slug: string; locale: string }>> {
    return this.prisma.page.findMany({
      where: {
        siteId,
        locale,
        published: true,
        deletedAt: null,
      },
      select: {
        slug: true,
        locale: true,
      },
      orderBy: [{ slug: "asc" }, { locale: "asc" }],
    });
  }

  async updatePage(
    siteId: string,
    slug: string,
    locale: string,
    dto: UpdatePageDto,
    userId: string,
  ): Promise<Record<string, unknown>> {
    if (dto.puckData) {
      this.validatePuckDataSize(dto.puckData);
    }

    const page = await this.prisma.page.findUnique({
      where: this.pageWhereUnique(siteId, slug, locale),
    });

    if (!page) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Page not found",
      });
    }

    if (dto.published === true && !page.published) {
      await this.billingService.assertCanPublishSite(siteId);
    }

    const updateData: Prisma.PageUpdateInput = {};
    if (dto.title !== undefined) updateData.title = dto.title;
    if (dto.puckData !== undefined)
      updateData.puckData = dto.puckData as unknown as Prisma.InputJsonValue;
    if (dto.seoTitle !== undefined) updateData.seoTitle = dto.seoTitle;
    if (dto.seoDescription !== undefined)
      updateData.seoDescription = dto.seoDescription;
    if (dto.seoKeywords !== undefined) updateData.seoKeywords = dto.seoKeywords;
    if (dto.seoOgImage !== undefined) updateData.seoOgImage = dto.seoOgImage;
    if (dto.seoCanonical !== undefined)
      updateData.seoCanonical = dto.seoCanonical;
    if (dto.seoNoindex !== undefined) updateData.seoNoindex = dto.seoNoindex;
    if (dto.published !== undefined) updateData.published = dto.published;

    const updated = await this.prisma.page.update({
      where: this.pageWhereUnique(siteId, slug, locale),
      data: updateData,
    });

    // Create a version snapshot on every save
    await this.prisma.pageVersion.create({
      data: {
        pageId: updated.id,
        puckData: (dto.puckData ||
          page.puckData) as unknown as Prisma.InputJsonValue,
        savedBy: userId,
      },
    });

    return updated as unknown as Record<string, unknown>;
  }

  async deletePage(
    siteId: string,
    slug: string,
    locale: string,
  ): Promise<{ message: string }> {
    const page = await this.prisma.page.findUnique({
      where: this.pageWhereUnique(siteId, slug, locale),
    });

    if (!page) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Page not found",
      });
    }

    // Soft delete: set deletedAt timestamp, unpublish
    await this.prisma.page.update({
      where: this.pageWhereUnique(siteId, slug, locale),
      data: { deletedAt: new Date(), published: false },
    });

    return { message: "Page moved to trash" };
  }

  async restorePage(
    siteId: string,
    slug: string,
    locale: string,
  ): Promise<{ message: string; slug: string; locale: string }> {
    const page = await this.prisma.page.findUnique({
      where: this.pageWhereUnique(siteId, slug, locale),
    });

    if (!page) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Page not found",
      });
    }

    if (!page.deletedAt) {
      return { message: "Page is not deleted", slug, locale };
    }

    await this.billingService.assertCanIncreasePageCount(siteId, 1);

    await this.prisma.page.update({
      where: this.pageWhereUnique(siteId, slug, locale),
      data: { deletedAt: null },
    });

    return { message: "Page restored", slug, locale };
  }

  async permanentlyDeletePage(
    siteId: string,
    slug: string,
    locale: string,
  ): Promise<{ message: string }> {
    const page = await this.prisma.page.findUnique({
      where: this.pageWhereUnique(siteId, slug, locale),
    });

    if (!page) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Page not found",
      });
    }

    await this.prisma.page.delete({
      where: this.pageWhereUnique(siteId, slug, locale),
    });

    return { message: "Page permanently deleted" };
  }

  // ─── Bulk operations ─────────────────────────────────────

  async bulkPublish(
    siteId: string,
    pages: { slug: string; locale: string }[],
  ): Promise<{ message: string; count: number }> {
    await this.billingService.assertCanPublishSite(siteId);

    const result = await this.prisma.page.updateMany({
      where: {
        siteId,
        deletedAt: null,
        OR: pages.map((p) => ({
          slug: p.slug,
          locale: p.locale,
        })),
      },
      data: { published: true },
    });

    return { message: "Pages published", count: result.count };
  }

  async bulkUnpublish(
    siteId: string,
    pages: { slug: string; locale: string }[],
  ): Promise<{ message: string; count: number }> {
    const result = await this.prisma.page.updateMany({
      where: {
        siteId,
        deletedAt: null,
        OR: pages.map((p) => ({
          slug: p.slug,
          locale: p.locale,
        })),
      },
      data: { published: false },
    });

    return { message: "Pages unpublished", count: result.count };
  }

  async bulkDelete(
    siteId: string,
    pages: { slug: string; locale: string }[],
  ): Promise<{ message: string; count: number }> {
    const result = await this.prisma.page.updateMany({
      where: {
        siteId,
        deletedAt: null,
        OR: pages.map((p) => ({
          slug: p.slug,
          locale: p.locale,
        })),
      },
      data: { deletedAt: new Date(), published: false },
    });

    return { message: "Pages moved to trash", count: result.count };
  }

  async bulkRestore(
    siteId: string,
    pages: { slug: string; locale: string }[],
  ): Promise<{ message: string; count: number }> {
    const restoreCount = await this.prisma.page.count({
      where: {
        siteId,
        deletedAt: { not: null },
        OR: pages.map((page) => ({
          slug: page.slug,
          locale: page.locale,
        })),
      },
    });

    await this.billingService.assertCanIncreasePageCount(siteId, restoreCount);

    const result = await this.prisma.page.updateMany({
      where: {
        siteId,
        deletedAt: { not: null },
        OR: pages.map((p) => ({
          slug: p.slug,
          locale: p.locale,
        })),
      },
      data: { deletedAt: null },
    });

    return { message: "Pages restored", count: result.count };
  }

  async bulkPermanentlyDelete(
    siteId: string,
    pages: { slug: string; locale: string }[],
  ): Promise<{ message: string; count: number }> {
    const result = await this.prisma.page.deleteMany({
      where: {
        siteId,
        OR: pages.map((p) => ({
          slug: p.slug,
          locale: p.locale,
        })),
      },
    });

    return { message: "Pages permanently deleted", count: result.count };
  }

  async publishPage(
    siteId: string,
    slug: string,
    locale: string,
  ): Promise<{ message: string; slug: string; locale: string }> {
    await this.billingService.assertCanPublishSite(siteId);

    const page = await this.prisma.page.findUnique({
      where: this.pageWhereUnique(siteId, slug, locale),
    });

    if (!page) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Page not found",
      });
    }

    await this.prisma.page.update({
      where: this.pageWhereUnique(siteId, slug, locale),
      data: { published: true },
    });

    return { message: "Page published", slug, locale };
  }

  async unpublishPage(
    siteId: string,
    slug: string,
    locale: string,
  ): Promise<{ message: string; slug: string; locale: string }> {
    const page = await this.prisma.page.findUnique({
      where: this.pageWhereUnique(siteId, slug, locale),
    });

    if (!page) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Page not found",
      });
    }

    await this.prisma.page.update({
      where: this.pageWhereUnique(siteId, slug, locale),
      data: { published: false },
    });

    return { message: "Page unpublished", slug, locale };
  }

  async getPreviewData(
    siteId: string,
    slug: string,
    locale: string,
  ): Promise<Record<string, unknown>> {
    const page = await this.prisma.page.findUnique({
      where: this.pageWhereUnique(siteId, slug, locale),
      select: {
        slug: true,
        locale: true,
        title: true,
        puckData: true,
        published: true,
      },
    });

    if (!page) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Page not found",
      });
    }

    return page as unknown as Record<string, unknown>;
  }

  async duplicatePage(
    siteId: string,
    slug: string,
    locale: string,
    newSlug: string,
    newTitle: string,
    newLocale: string,
    userId: string,
  ): Promise<Record<string, unknown>> {
    const source = await this.prisma.page.findUnique({
      where: this.pageWhereUnique(siteId, slug, locale),
    });

    if (!source) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Source page not found",
      });
    }

    const existing = await this.prisma.page.findUnique({
      where: this.pageWhereUnique(siteId, newSlug, newLocale),
    });

    if (existing) {
      throw new ConflictException({
        code: "CONFLICT",
        message: `Page with slug '${newSlug}' and locale '${newLocale}' already exists`,
      });
    }

    await this.billingService.assertCanIncreasePageCount(siteId, 1);

    const puckData = source.puckData as unknown as Record<string, unknown>;
    this.validatePuckDataSize(puckData);

    const newPage = await this.prisma.page.create({
      data: {
        siteId,
        slug: newSlug,
        locale: newLocale,
        title: newTitle,
        puckData: source.puckData as unknown as Prisma.InputJsonValue,
        seoTitle: source.seoTitle,
        seoDescription: source.seoDescription,
        seoKeywords: source.seoKeywords,
        published: false,
      },
    });

    await this.prisma.pageVersion.create({
      data: {
        pageId: newPage.id,
        puckData: source.puckData as unknown as Prisma.InputJsonValue,
        savedBy: userId,
        note: `Duplicated from '${slug}' (${locale})`,
      },
    });

    return newPage as unknown as Record<string, unknown>;
  }

  private pageWhereUnique(
    siteId: string,
    slug: string,
    locale: string,
  ): Prisma.PageWhereUniqueInput {
    return { siteId_slug_locale: { siteId, slug, locale } };
  }

  private validatePuckDataSize(puckData: Record<string, unknown>): void {
    const size = Buffer.byteLength(JSON.stringify(puckData), "utf8");
    if (size > MAX_PUCK_DATA_SIZE) {
      throw new PayloadTooLargeException({
        code: "PAYLOAD_TOO_LARGE",
        message: "puckData exceeds 5MB limit",
      });
    }
  }
}
