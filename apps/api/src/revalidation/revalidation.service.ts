import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { DeploymentsService } from "../deployments/deployments.service";

const FALLBACK_LOCALES = ["en"];

@Injectable()
export class RevalidationService {
  private readonly logger = new Logger(RevalidationService.name);
  private readonly revalidationUrl: string | undefined;
  private readonly revalidateSecret: string | undefined;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly deploymentsService: DeploymentsService,
  ) {
    this.revalidationUrl = this.configService.get<string>("REVALIDATION_URL");
    this.revalidateSecret = this.configService.get<string>("REVALIDATE_SECRET");
  }

  async revalidatePage(siteId: string, slug: string): Promise<void> {
    const targetUrl = await this.resolveRevalidationTarget(siteId);
    if (!targetUrl) {
      this.logger.warn(
        `No revalidation target is configured for site ${siteId} — skipping ISR revalidation`,
      );
      return;
    }

    const locales = await this.resolveLocales(siteId);

    const results = await Promise.allSettled(
      locales.map((locale) =>
        this.triggerRevalidation(targetUrl, slug, locale),
      ),
    );

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const locale = locales[i];
      if (result.status === "rejected") {
        this.logger.error(
          `Failed to revalidate ${targetUrl} for /${locale}/${slug}: ${result.reason}`,
        );
      } else {
        this.logger.log(`Revalidated ${targetUrl} for /${locale}/${slug}`);
      }
    }
  }

  private async triggerRevalidation(
    targetUrl: string,
    slug: string,
    locale: string,
  ): Promise<void> {
    const response = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-revalidate-secret": this.revalidateSecret || "",
      },
      body: JSON.stringify({ slug, locale }),
    });

    if (!response.ok) {
      throw new Error(
        `Revalidation failed for /${locale}/${slug}: ${response.status} ${response.statusText}`,
      );
    }
  }

  private async resolveRevalidationTarget(
    siteId: string,
  ): Promise<string | null> {
    const siteTarget =
      await this.deploymentsService.getSiteRevalidationTarget(siteId);

    if (siteTarget?.revalidationUrl) {
      return siteTarget.revalidationUrl;
    }

    return this.revalidationUrl ?? null;
  }

  private async resolveLocales(siteId: string): Promise<string[]> {
    const site = await this.prisma.site.findUnique({
      where: { id: siteId },
      select: {
        primaryLocale: true,
        enabledLocales: true,
      },
    });

    if (!site) {
      return FALLBACK_LOCALES;
    }

    return Array.from(
      new Set([site.primaryLocale, ...site.enabledLocales].filter(Boolean)),
    );
  }
}
