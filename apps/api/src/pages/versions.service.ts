import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Prisma } from "@prisma/client";

@Injectable()
export class VersionsService {
  constructor(private readonly prisma: PrismaService) {}

  async listVersions(
    siteId: string,
    slug: string,
    locale: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<{
    data: { id: string; savedBy: string; note: string | null; savedAt: Date }[];
    total: number;
    page: number;
    limit: number;
  }> {
    const pageRecord = await this.prisma.page.findUnique({
      where: this.pageWhereUnique(siteId, slug, locale),
    });

    if (!pageRecord) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Page not found",
      });
    }

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.pageVersion.findMany({
        where: { pageId: pageRecord.id },
        skip,
        take: limit,
        select: {
          id: true,
          savedBy: true,
          note: true,
          savedAt: true,
        },
        orderBy: { savedAt: "desc" },
      }),
      this.prisma.pageVersion.count({
        where: { pageId: pageRecord.id },
      }),
    ]);

    return { data, total, page, limit };
  }

  async restoreVersion(
    siteId: string,
    slug: string,
    locale: string,
    versionId: string,
    userId: string,
  ): Promise<Record<string, unknown>> {
    const pageRecord = await this.prisma.page.findUnique({
      where: this.pageWhereUnique(siteId, slug, locale),
    });

    if (!pageRecord) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Page not found",
      });
    }

    const version = await this.prisma.pageVersion.findFirst({
      where: { id: versionId, pageId: pageRecord.id },
    });

    if (!version) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Version not found",
      });
    }

    // Restore puckData to the page
    const updated = await this.prisma.page.update({
      where: this.pageWhereUnique(siteId, slug, locale),
      data: {
        puckData: version.puckData as Prisma.InputJsonValue,
      },
    });

    // Create a new version with restore note
    await this.prisma.pageVersion.create({
      data: {
        pageId: pageRecord.id,
        puckData: version.puckData as Prisma.InputJsonValue,
        savedBy: userId,
        note: `Restored from version ${versionId}`,
      },
    });

    return updated as unknown as Record<string, unknown>;
  }

  private pageWhereUnique(
    siteId: string,
    slug: string,
    locale: string,
  ): Prisma.PageWhereUniqueInput {
    return { siteId_slug_locale: { siteId, slug, locale } };
  }
}
