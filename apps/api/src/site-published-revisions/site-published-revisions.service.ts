import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { SUPPORTED_LOCALES } from "../common/supported-locales";
import { PrismaService } from "../prisma/prisma.service";

type PageSnapshotEntry = {
  slug: string;
  locale: string;
  title: string;
  puckData: Prisma.JsonValue;
  seoTitle: string | null;
  seoDescription: string | null;
  targetKeywords: string | null;
  internalBrief: string | null;
  seoOgImage: string | null;
  seoCanonical: string | null;
  seoNoindex: boolean;
};

type SettingsSnapshotEntry = {
  siteName: string;
  siteSubtitle: string;
  supportEmail: string;
  publicPhone: string;
  whatsAppUrl: string;
  address: string;
  region: string;
  primaryCtaLabel: string;
  defaultInquiryRoutingEmail: string;
  inquiryWebhookUrl: string;
  inquiryWebhookSecret: string;
  logoUrl: string;
  faviconUrl: string;
  seoTitleTemplate: string;
  seoDefaultDesc: string;
  seoOgImage: string;
  seoIndexingEnabled: boolean;
  seoLocaleDefaults: Prisma.JsonValue;
  googleSiteVerify: string;
  bingSiteVerify: string;
  yandexSiteVerify: string;
  pinterestSiteVerify: string;
  gaTrackingId: string;
  gtmContainerId: string;
  clarityId: string;
  twitterHandle: string;
  linkedinUrl: string;
  facebookUrl: string;
  instagramUrl: string;
  youtubeUrl: string;
  tiktokUrl: string;
  pinterestUrl: string;
  defaultLocale: string;
  activeLocales: string[];
};

export type CaptureSnapshotInput = {
  deploymentId?: string | null;
  createdById?: string | null;
  rolledBackFrom?: number | null;
};

export type CaptureSnapshotResult = {
  id: string;
  revision: number;
  createdAt: Date;
};

@Injectable()
export class SitePublishedRevisionsService {
  private readonly logger = new Logger(SitePublishedRevisionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Atomically captures the current published state (pages + settings) of a
   * site into a `SitePublishedRevision` row and increments
   * `Site.publishedRevision`. The new revision number is returned.
   */
  async captureSnapshot(
    siteId: string,
    input: CaptureSnapshotInput = {},
  ): Promise<CaptureSnapshotResult> {
    return this.prisma.$transaction(async (tx) => {
      const site = await tx.site.findUnique({
        where: { id: siteId },
        select: { id: true, publishedRevision: true },
      });

      if (!site) {
        throw new NotFoundException({
          code: "SITE_NOT_FOUND",
          message: "Site not found",
        });
      }

      const pageRows = await tx.page.findMany({
        where: { siteId, published: true, deletedAt: null },
        select: {
          slug: true,
          locale: true,
          title: true,
          puckData: true,
          seoTitle: true,
          seoDescription: true,
          targetKeywords: true,
          internalBrief: true,
          seoOgImage: true,
          seoCanonical: true,
          seoNoindex: true,
        },
        orderBy: [{ slug: "asc" }, { locale: "asc" }],
      });

      const pagesSnapshot: PageSnapshotEntry[] = pageRows.map((page) => ({
        slug: page.slug,
        locale: page.locale,
        title: page.title,
        puckData: page.puckData,
        seoTitle: page.seoTitle,
        seoDescription: page.seoDescription,
        targetKeywords: page.targetKeywords,
        internalBrief: page.internalBrief,
        seoOgImage: page.seoOgImage,
        seoCanonical: page.seoCanonical,
        seoNoindex: page.seoNoindex,
      }));

      const settings = await tx.siteSettings.findUnique({
        where: { siteId },
      });

      const settingsSnapshot: SettingsSnapshotEntry | null = settings
        ? {
            siteName: settings.siteName,
            siteSubtitle: settings.siteSubtitle,
            supportEmail: settings.supportEmail,
            publicPhone: settings.publicPhone,
            whatsAppUrl: settings.whatsAppUrl,
            address: settings.address,
            region: settings.region,
            primaryCtaLabel: settings.primaryCtaLabel,
            defaultInquiryRoutingEmail: settings.defaultInquiryRoutingEmail,
            inquiryWebhookUrl: settings.inquiryWebhookUrl,
            inquiryWebhookSecret: settings.inquiryWebhookSecret,
            logoUrl: settings.logoUrl,
            faviconUrl: settings.faviconUrl,
            seoTitleTemplate: settings.seoTitleTemplate,
            seoDefaultDesc: settings.seoDefaultDesc,
            seoOgImage: settings.seoOgImage,
            seoIndexingEnabled: settings.seoIndexingEnabled,
            seoLocaleDefaults: settings.seoLocaleDefaults,
            googleSiteVerify: settings.googleSiteVerify,
            bingSiteVerify: settings.bingSiteVerify,
            yandexSiteVerify: settings.yandexSiteVerify,
            pinterestSiteVerify: settings.pinterestSiteVerify,
            gaTrackingId: settings.gaTrackingId,
            gtmContainerId: settings.gtmContainerId,
            clarityId: settings.clarityId,
            twitterHandle: settings.twitterHandle,
            linkedinUrl: settings.linkedinUrl,
            facebookUrl: settings.facebookUrl,
            instagramUrl: settings.instagramUrl,
            youtubeUrl: settings.youtubeUrl,
            tiktokUrl: settings.tiktokUrl,
            pinterestUrl: settings.pinterestUrl,
            defaultLocale: settings.defaultLocale,
            activeLocales: settings.activeLocales,
          }
        : null;

      const updated = await tx.site.update({
        where: { id: siteId },
        data: { publishedRevision: { increment: 1 } },
        select: { publishedRevision: true },
      });

      const created = await tx.sitePublishedRevision.create({
        data: {
          siteId,
          revision: updated.publishedRevision,
          pagesSnapshot: pagesSnapshot as unknown as Prisma.InputJsonValue,
          settingsSnapshot:
            settingsSnapshot === null
              ? Prisma.JsonNull
              : (settingsSnapshot as unknown as Prisma.InputJsonValue),
          deploymentId: input.deploymentId ?? null,
          rolledBackFrom: input.rolledBackFrom ?? null,
          createdById: input.createdById ?? null,
        },
        select: { id: true, revision: true, createdAt: true },
      });

      return created;
    });
  }

  async getSnapshotByRevision(siteId: string, revision: number) {
    const snapshot = await this.prisma.sitePublishedRevision.findUnique({
      where: { siteId_revision: { siteId, revision } },
    });
    if (!snapshot) {
      throw new NotFoundException({
        code: "REVISION_NOT_FOUND",
        message: `Published revision ${revision} not found for this site`,
      });
    }
    return snapshot;
  }

  async getSnapshotByDeploymentId(siteId: string, deploymentId: string) {
    return this.prisma.sitePublishedRevision.findFirst({
      where: { siteId, deploymentId },
    });
  }

  /**
   * Restores published content to the state captured in `targetRevision`,
   * then captures a new snapshot reflecting the restored state. The new
   * revision number is returned. Pages and settings are written inside a
   * single transaction so that runtime cache invalidation downstream sees a
   * consistent state.
   */
  async restoreToRevision(
    siteId: string,
    targetRevision: number,
    input: {
      deploymentId?: string | null;
      createdById?: string | null;
    } = {},
  ): Promise<CaptureSnapshotResult> {
    const target = await this.getSnapshotByRevision(siteId, targetRevision);

    return this.prisma.$transaction(
      async (tx) => {
        const pages = this.parsePagesSnapshot(target.pagesSnapshot);
        const settings = this.parseSettingsSnapshot(target.settingsSnapshot);

        const restoredSlugLocaleKeys = new Set(
          pages.map((page) => `${page.slug}::${page.locale}`),
        );

        // Unpublish anything currently published that the target revision did
        // not include. This keeps the published surface exactly equal to the
        // snapshot.
        const currentlyPublished = await tx.page.findMany({
          where: { siteId, published: true, deletedAt: null },
          select: { id: true, slug: true, locale: true },
        });

        const toUnpublishIds = currentlyPublished
          .filter(
            (page) =>
              !restoredSlugLocaleKeys.has(`${page.slug}::${page.locale}`),
          )
          .map((page) => page.id);

        if (toUnpublishIds.length > 0) {
          await tx.page.updateMany({
            where: { id: { in: toUnpublishIds } },
            data: { published: false },
          });
        }

        for (const page of pages) {
          const existing = await tx.page.findUnique({
            where: {
              siteId_slug_locale: {
                siteId,
                slug: page.slug,
                locale: page.locale,
              },
            },
            select: { id: true },
          });

          if (existing) {
            await tx.page.update({
              where: { id: existing.id },
              data: {
                title: page.title,
                puckData: page.puckData as Prisma.InputJsonValue,
                seoTitle: page.seoTitle,
                seoDescription: page.seoDescription,
                targetKeywords: page.targetKeywords,
                internalBrief: page.internalBrief,
                seoOgImage: page.seoOgImage,
                seoCanonical: page.seoCanonical,
                seoNoindex: page.seoNoindex,
                published: true,
                deletedAt: null,
              },
            });
          } else {
            await tx.page.create({
              data: {
                siteId,
                slug: page.slug,
                locale: page.locale,
                title: page.title,
                puckData: page.puckData as Prisma.InputJsonValue,
                seoTitle: page.seoTitle,
                seoDescription: page.seoDescription,
                targetKeywords: page.targetKeywords,
                internalBrief: page.internalBrief,
                seoOgImage: page.seoOgImage,
                seoCanonical: page.seoCanonical,
                seoNoindex: page.seoNoindex,
                published: true,
              },
            });
          }
        }

        if (settings) {
          await tx.siteSettings.upsert({
            where: { siteId },
            update: {
              siteName: settings.siteName,
              siteSubtitle: settings.siteSubtitle,
              supportEmail: settings.supportEmail,
              publicPhone: settings.publicPhone,
              whatsAppUrl: settings.whatsAppUrl,
              address: settings.address,
              region: settings.region,
              primaryCtaLabel: settings.primaryCtaLabel,
              defaultInquiryRoutingEmail: settings.defaultInquiryRoutingEmail,
              inquiryWebhookUrl: settings.inquiryWebhookUrl,
              inquiryWebhookSecret: settings.inquiryWebhookSecret,
              logoUrl: settings.logoUrl,
              faviconUrl: settings.faviconUrl,
              seoTitleTemplate: settings.seoTitleTemplate,
              seoDefaultDesc: settings.seoDefaultDesc,
              seoOgImage: settings.seoOgImage,
              seoIndexingEnabled: settings.seoIndexingEnabled,
              seoLocaleDefaults:
                settings.seoLocaleDefaults as Prisma.InputJsonValue,
              googleSiteVerify: settings.googleSiteVerify,
              bingSiteVerify: settings.bingSiteVerify,
              yandexSiteVerify: settings.yandexSiteVerify,
              pinterestSiteVerify: settings.pinterestSiteVerify,
              gaTrackingId: settings.gaTrackingId,
              gtmContainerId: settings.gtmContainerId,
              clarityId: settings.clarityId,
              twitterHandle: settings.twitterHandle,
              linkedinUrl: settings.linkedinUrl,
              facebookUrl: settings.facebookUrl,
              instagramUrl: settings.instagramUrl,
              youtubeUrl: settings.youtubeUrl,
              tiktokUrl: settings.tiktokUrl,
              pinterestUrl: settings.pinterestUrl,
              defaultLocale: settings.defaultLocale,
              activeLocales: settings.activeLocales,
            },
            create: {
              siteId,
              siteName: settings.siteName,
              siteSubtitle: settings.siteSubtitle,
              supportEmail: settings.supportEmail,
              publicPhone: settings.publicPhone,
              whatsAppUrl: settings.whatsAppUrl,
              address: settings.address,
              region: settings.region,
              primaryCtaLabel: settings.primaryCtaLabel,
              defaultInquiryRoutingEmail: settings.defaultInquiryRoutingEmail,
              inquiryWebhookUrl: settings.inquiryWebhookUrl,
              inquiryWebhookSecret: settings.inquiryWebhookSecret,
              logoUrl: settings.logoUrl,
              faviconUrl: settings.faviconUrl,
              seoTitleTemplate: settings.seoTitleTemplate,
              seoDefaultDesc: settings.seoDefaultDesc,
              seoOgImage: settings.seoOgImage,
              seoIndexingEnabled: settings.seoIndexingEnabled,
              seoLocaleDefaults:
                settings.seoLocaleDefaults as Prisma.InputJsonValue,
              googleSiteVerify: settings.googleSiteVerify,
              bingSiteVerify: settings.bingSiteVerify,
              yandexSiteVerify: settings.yandexSiteVerify,
              pinterestSiteVerify: settings.pinterestSiteVerify,
              gaTrackingId: settings.gaTrackingId,
              gtmContainerId: settings.gtmContainerId,
              clarityId: settings.clarityId,
              twitterHandle: settings.twitterHandle,
              linkedinUrl: settings.linkedinUrl,
              facebookUrl: settings.facebookUrl,
              instagramUrl: settings.instagramUrl,
              youtubeUrl: settings.youtubeUrl,
              tiktokUrl: settings.tiktokUrl,
              pinterestUrl: settings.pinterestUrl,
              defaultLocale: settings.defaultLocale,
              activeLocales: settings.activeLocales,
            },
          });
        }

        // Re-snapshot the restored state so revision history is linear and
        // future rollbacks include the rollback event itself.
        const restoredPages = await tx.page.findMany({
          where: { siteId, published: true, deletedAt: null },
          select: {
            slug: true,
            locale: true,
            title: true,
            puckData: true,
            seoTitle: true,
            seoDescription: true,
            targetKeywords: true,
            internalBrief: true,
            seoOgImage: true,
            seoCanonical: true,
            seoNoindex: true,
          },
          orderBy: [{ slug: "asc" }, { locale: "asc" }],
        });
        const restoredSettings = await tx.siteSettings.findUnique({
          where: { siteId },
        });

        const updatedSite = await tx.site.update({
          where: { id: siteId },
          data: { publishedRevision: { increment: 1 } },
          select: { publishedRevision: true },
        });

        const created = await tx.sitePublishedRevision.create({
          data: {
            siteId,
            revision: updatedSite.publishedRevision,
            pagesSnapshot: restoredPages as unknown as Prisma.InputJsonValue,
            settingsSnapshot: restoredSettings
              ? (restoredSettings as unknown as Prisma.InputJsonValue)
              : Prisma.JsonNull,
            deploymentId: input.deploymentId ?? null,
            rolledBackFrom: targetRevision,
            createdById: input.createdById ?? null,
          },
          select: { id: true, revision: true, createdAt: true },
        });

        return created;
      },
      { timeout: 30_000 },
    );
  }

  private parsePagesSnapshot(value: Prisma.JsonValue): PageSnapshotEntry[] {
    if (!Array.isArray(value)) {
      this.logger.warn(
        "Encountered non-array pagesSnapshot; treating as empty.",
      );
      return [];
    }
    return value.flatMap((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        return [];
      }
      const obj = entry as Record<string, unknown>;
      if (typeof obj.slug !== "string" || typeof obj.locale !== "string") {
        return [];
      }
      return [
        {
          slug: obj.slug,
          locale: obj.locale,
          title: typeof obj.title === "string" ? obj.title : obj.slug,
          puckData: (obj.puckData ?? {}) as Prisma.JsonValue,
          seoTitle: typeof obj.seoTitle === "string" ? obj.seoTitle : null,
          seoDescription:
            typeof obj.seoDescription === "string" ? obj.seoDescription : null,
          targetKeywords:
            typeof obj.targetKeywords === "string"
              ? obj.targetKeywords
              : typeof obj.seoKeywords === "string"
                ? obj.seoKeywords
                : null,
          internalBrief:
            typeof obj.internalBrief === "string" ? obj.internalBrief : null,
          seoOgImage:
            typeof obj.seoOgImage === "string" ? obj.seoOgImage : null,
          seoCanonical:
            typeof obj.seoCanonical === "string" ? obj.seoCanonical : null,
          seoNoindex: obj.seoNoindex === true,
        },
      ];
    });
  }

  private parseSettingsSnapshot(
    value: Prisma.JsonValue | null,
  ): SettingsSnapshotEntry | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }
    const obj = value as Record<string, unknown>;
    const asString = (v: unknown, fallback = "") =>
      typeof v === "string" ? v : fallback;
    const asBool = (v: unknown, fallback: boolean) =>
      typeof v === "boolean" ? v : fallback;
    const asStringArray = (v: unknown): string[] =>
      Array.isArray(v)
        ? v.filter((x): x is string => typeof x === "string")
        : [];

    return {
      siteName: asString(obj.siteName, "StayLayer CMS"),
      siteSubtitle: asString(obj.siteSubtitle),
      supportEmail: asString(obj.supportEmail),
      publicPhone: asString(obj.publicPhone),
      whatsAppUrl: asString(obj.whatsAppUrl),
      address: asString(obj.address),
      region: asString(obj.region),
      primaryCtaLabel: asString(obj.primaryCtaLabel, "Send inquiry"),
      defaultInquiryRoutingEmail: asString(obj.defaultInquiryRoutingEmail),
      inquiryWebhookUrl: asString(obj.inquiryWebhookUrl),
      inquiryWebhookSecret: asString(obj.inquiryWebhookSecret),
      logoUrl: asString(obj.logoUrl),
      faviconUrl: asString(obj.faviconUrl),
      seoTitleTemplate: asString(obj.seoTitleTemplate, "%s | StayLayer"),
      seoDefaultDesc: asString(obj.seoDefaultDesc),
      seoOgImage: asString(obj.seoOgImage),
      seoIndexingEnabled: asBool(obj.seoIndexingEnabled, true),
      seoLocaleDefaults: (obj.seoLocaleDefaults ?? {}) as Prisma.JsonValue,
      googleSiteVerify: asString(obj.googleSiteVerify),
      bingSiteVerify: asString(obj.bingSiteVerify),
      yandexSiteVerify: asString(obj.yandexSiteVerify),
      pinterestSiteVerify: asString(obj.pinterestSiteVerify),
      gaTrackingId: asString(obj.gaTrackingId),
      gtmContainerId: asString(obj.gtmContainerId),
      clarityId: asString(obj.clarityId),
      twitterHandle: asString(obj.twitterHandle),
      linkedinUrl: asString(obj.linkedinUrl),
      facebookUrl: asString(obj.facebookUrl),
      instagramUrl: asString(obj.instagramUrl),
      youtubeUrl: asString(obj.youtubeUrl),
      tiktokUrl: asString(obj.tiktokUrl),
      pinterestUrl: asString(obj.pinterestUrl),
      defaultLocale: asString(obj.defaultLocale, "en"),
      activeLocales:
        asStringArray(obj.activeLocales).length > 0
          ? asStringArray(obj.activeLocales)
          : [...SUPPORTED_LOCALES],
    };
  }
}
