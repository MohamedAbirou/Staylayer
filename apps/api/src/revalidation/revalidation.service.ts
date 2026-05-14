import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PublicRuntimeService } from "../public-runtime/public-runtime.service";
import { pathnameToCanonicalPath } from "../public-runtime/public-runtime.util";

@Injectable()
export class RevalidationService {
  private readonly logger = new Logger(RevalidationService.name);
  private readonly revalidationUrl: string | null;
  private readonly runtimeSecret: string | null;

  constructor(
    private readonly configService: ConfigService,
    private readonly publicRuntimeService: PublicRuntimeService,
  ) {
    this.revalidationUrl = this.resolveRevalidationUrl();
    this.runtimeSecret =
      this.toNullableString(
        this.configService.get<string>("WEBSITE_RUNTIME_SECRET"),
      ) ??
      this.toNullableString(
        this.configService.get<string>("REVALIDATE_SECRET"),
      );
  }

  async revalidatePage(siteId: string, slug: string): Promise<void> {
    await this.revalidateSite(siteId, {
      paths: [this.slugToPathname(slug)],
    });
  }

  async revalidateSite(
    siteId: string,
    input: { paths?: string[] } = {},
  ): Promise<void> {
    const targetUrl = this.revalidationUrl;
    if (!targetUrl) {
      this.logger.warn(
        `No shared website revalidation target is configured for site ${siteId} — skipping runtime revalidation`,
      );
      return;
    }

    if (!this.runtimeSecret) {
      this.logger.warn(
        `No runtime secret is configured for site ${siteId} — skipping runtime revalidation`,
      );
      return;
    }

    const hosts = Array.from(
      new Set(await this.publicRuntimeService.listSiteHosts(siteId)),
    );

    if (hosts.length === 0) {
      this.logger.warn(
        `No public hosts are configured for site ${siteId} — skipping runtime revalidation`,
      );
      return;
    }

    const paths = Array.from(
      new Set((input.paths ?? []).map((path) => pathnameToCanonicalPath(path))),
    );

    await this.triggerRevalidation(targetUrl, {
      siteId,
      hosts,
      paths,
    });

    this.logger.log(
      `Revalidated shared runtime for site ${siteId} across ${hosts.length} host(s)${paths.length > 0 ? ` and ${paths.length} path(s)` : ""}`,
    );
  }

  private async triggerRevalidation(
    targetUrl: string,
    payload: {
      siteId: string;
      hosts: string[];
      paths: string[];
    },
  ): Promise<void> {
    const response = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-website-runtime-secret": this.runtimeSecret || "",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(
        `Runtime revalidation failed: ${response.status} ${response.statusText}`,
      );
    }
  }

  private slugToPathname(slug: string): string {
    const normalizedSlug = String(slug || "home")
      .trim()
      .toLowerCase();
    return pathnameToCanonicalPath(
      normalizedSlug === "home" ? "/" : `/${normalizedSlug}`,
    );
  }

  private resolveRevalidationUrl(): string | null {
    const websiteOrigin = this.toNullableString(
      this.configService.get<string>("WEBSITE_APP_ORIGIN"),
    );

    if (websiteOrigin) {
      try {
        return new URL("/api/revalidate", websiteOrigin).toString();
      } catch {
        this.logger.warn(
          `WEBSITE_APP_ORIGIN is invalid for runtime revalidation: ${websiteOrigin}`,
        );
      }
    }

    return this.toNullableString(
      this.configService.get<string>("REVALIDATION_URL"),
    );
  }

  private toNullableString(value: string | null | undefined): string | null {
    const normalized = String(value ?? "").trim();
    return normalized.length > 0 ? normalized : null;
  }
}
