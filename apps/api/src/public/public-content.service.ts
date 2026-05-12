import { Injectable } from "@nestjs/common";
import {
  DeploymentStatus,
  DomainStatus,
  SiteStatus,
  SiteType,
  TenantStatus,
} from "@prisma/client";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { MARKETING_CONTENT } from "./marketing-content.registry";

type ShowcaseSiteRecord = {
  id: string;
  siteType: SiteType;
  primaryLocale: string;
  enabledLocales: string[];
  pages: Array<{ id: string }>;
  domains: Array<{ id: string }>;
  deployments: Array<{ id: string }>;
};

@Injectable()
export class PublicContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async getContent() {
    const contactEmail = this.resolveContactEmail();

    return {
      ...MARKETING_CONTENT,
      generatedAt: new Date().toISOString(),
      showcase: await this.listShowcaseStories(),
      contact: {
        ...MARKETING_CONTENT.contact,
        contactEmail,
        contactEmailConfigured: Boolean(contactEmail),
      },
    };
  }

  private async listShowcaseStories() {
    const sites = await this.prisma.site.findMany({
      where: {
        status: SiteStatus.ACTIVE,
        tenant: {
          status: TenantStatus.ACTIVE,
        },
        pages: {
          some: {
            published: true,
            deletedAt: null,
          },
        },
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 6,
      select: {
        id: true,
        siteType: true,
        primaryLocale: true,
        enabledLocales: true,
        pages: {
          where: {
            published: true,
            deletedAt: null,
          },
          select: {
            id: true,
          },
        },
        domains: {
          where: {
            status: DomainStatus.ACTIVE,
          },
          select: {
            id: true,
          },
        },
        deployments: {
          where: {
            status: DeploymentStatus.LIVE,
          },
          select: {
            id: true,
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
        },
      },
    });

    if (sites.length === 0) {
      return MARKETING_CONTENT.showcase;
    }

    return sites.map((site, index) => this.toShowcaseStory(site, index));
  }

  private toShowcaseStory(site: ShowcaseSiteRecord, index: number) {
    const localeFootprint = Array.from(
      new Set([site.primaryLocale, ...site.enabledLocales].filter(Boolean)),
    );
    const publishedPageCount = site.pages.length;
    const liveDomainCount = site.domains.length;
    const hasLiveDeployment = site.deployments.length > 0;

    return {
      id: site.id,
      title: this.buildShowcaseTitle(site.siteType),
      category: this.formatSiteType(site.siteType),
      localeFootprint,
      summary: this.buildSummary({
        siteType: site.siteType,
        publishedPageCount,
        localeCount: localeFootprint.length,
        liveDomainCount,
      }),
      highlights: [
        `${publishedPageCount} published ${publishedPageCount === 1 ? "page" : "pages"}`,
        `${localeFootprint.length} ${localeFootprint.length === 1 ? "guest language" : "guest languages"}`,
        liveDomainCount > 0
          ? `${liveDomainCount} active ${liveDomainCount === 1 ? "domain" : "domains"}`
          : "Launch-ready domain setup",
      ],
      proof: hasLiveDeployment
        ? "Published pages, live deployment, and guest-ready domain setup confirmed on the platform."
        : "Published pages and launch-ready site structure confirmed on the platform.",
      privacy:
        index % 2 === 0
          ? "Brand name and domain are withheld by design."
          : "We hide identifying details while showing the real build footprint.",
    };
  }

  private buildShowcaseTitle(siteType: SiteType) {
    switch (siteType) {
      case SiteType.VACATION_RENTAL:
        return "Private villa brand";
      case SiteType.BOUTIQUE_HOTEL:
        return "Boutique hotel brand";
      case SiteType.BNB:
        return "Owner-led B&B brand";
      case SiteType.GLAMPING:
        return "Glamping retreat brand";
      case SiteType.GUEST_HOUSE:
        return "Guest house brand";
      default:
        return "Hospitality brand";
    }
  }

  private formatSiteType(siteType: SiteType) {
    switch (siteType) {
      case SiteType.VACATION_RENTAL:
        return "Vacation rental";
      case SiteType.BOUTIQUE_HOTEL:
        return "Boutique hotel";
      case SiteType.BNB:
        return "Bed and breakfast";
      case SiteType.GLAMPING:
        return "Glamping";
      case SiteType.GUEST_HOUSE:
        return "Guest house";
      default:
        return "Hospitality";
    }
  }

  private buildSummary(params: {
    siteType: SiteType;
    publishedPageCount: number;
    localeCount: number;
    liveDomainCount: number;
  }) {
    const category = this.formatSiteType(params.siteType).toLowerCase();
    const domainPhrase =
      params.liveDomainCount > 0
        ? `${params.liveDomainCount} active ${params.liveDomainCount === 1 ? "domain" : "domains"}`
        : "launch-ready domain setup";

    return `A ${category} website with ${params.publishedPageCount} published ${params.publishedPageCount === 1 ? "page" : "pages"}, ${params.localeCount} ${params.localeCount === 1 ? "guest language" : "guest languages"}, and ${domainPhrase}.`;
  }

  private resolveContactEmail() {
    return (
      this.configService.get<string>("MARKETING_CONTACT_EMAIL")?.trim() ||
      this.configService.get<string>("SMTP_USER")?.trim() ||
      null
    );
  }
}
