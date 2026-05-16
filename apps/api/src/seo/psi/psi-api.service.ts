import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

/**
 * Open interface for performance audit providers. PageSpeed Insights is the
 * first implementation; future providers (WebPageTest, custom Lighthouse
 * runners, …) plug in by implementing this shape and being registered on
 * the SEO module.
 */
export interface PerformanceProviderClient {
  readonly providerName: string;
  isConfigured(): boolean;
  runAudit(input: RunAuditInput): Promise<ProviderAuditResult>;
  fetchCruxRecord?(input: CruxQueryInput): Promise<CruxRecordResult>;
}

export type PsiStrategyInput = "MOBILE" | "DESKTOP";
export type CruxFormFactorInput = "PHONE" | "DESKTOP" | "TABLET" | "ALL";

export interface RunAuditInput {
  url: string;
  strategy: PsiStrategyInput;
  categories?: ReadonlyArray<
    "performance" | "accessibility" | "best-practices" | "seo" | "pwa"
  >;
  locale?: string;
}

export interface ProviderAuditResult {
  rawResponse: unknown;
  lighthouseResult: Record<string, unknown> | null;
  loadingExperience: Record<string, unknown> | null;
  originLoadingExperience: Record<string, unknown> | null;
}

export interface CruxQueryInput {
  url?: string;
  origin?: string;
  formFactor?: CruxFormFactorInput;
}

export interface CruxRecordResult {
  record: Record<string, unknown> | null;
  notFound: boolean;
}

export class PerformanceProviderError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly providerCode?: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "PerformanceProviderError";
  }
}

const DEFAULT_CATEGORIES: ReadonlyArray<
  "performance" | "accessibility" | "best-practices" | "seo" | "pwa"
> = ["performance", "accessibility", "best-practices", "seo"];

const PSI_ENDPOINT =
  "https://pagespeedonline.googleapis.com/pagespeedonline/v5/runPagespeed";
const CRUX_ENDPOINT =
  "https://chromeuxreport.googleapis.com/v1/records:queryRecord";

@Injectable()
export class PageSpeedInsightsClient implements PerformanceProviderClient {
  readonly providerName = "google_pagespeed_insights";

  private readonly logger = new Logger(PageSpeedInsightsClient.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.config.get<string>("PSI_API_KEY"));
  }

  private getApiKey(): string {
    const key = this.config.get<string>("PSI_API_KEY");
    if (!key) {
      throw new PerformanceProviderError(
        "PSI_API_KEY is not configured",
        503,
        "PSI_NOT_CONFIGURED",
      );
    }
    return key;
  }

  async runAudit(input: RunAuditInput): Promise<ProviderAuditResult> {
    const apiKey = this.getApiKey();
    const url = new URL(PSI_ENDPOINT);
    url.searchParams.set("url", input.url);
    url.searchParams.set("strategy", input.strategy.toLowerCase());
    url.searchParams.set("key", apiKey);
    for (const category of input.categories ?? DEFAULT_CATEGORIES) {
      url.searchParams.append("category", category);
    }
    if (input.locale) {
      url.searchParams.set("locale", input.locale);
    }

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      const errorBody = await this.readErrorBody(response);
      this.logger.warn(
        `PSI audit failed for ${input.url} (${input.strategy}): ${response.status} ${errorBody.message}`,
      );
      throw new PerformanceProviderError(
        errorBody.message,
        response.status,
        errorBody.code,
        errorBody.raw,
      );
    }

    const payload = (await response.json()) as Record<string, unknown>;
    return {
      rawResponse: payload,
      lighthouseResult:
        (payload.lighthouseResult as Record<string, unknown> | undefined) ??
        null,
      loadingExperience:
        (payload.loadingExperience as Record<string, unknown> | undefined) ??
        null,
      originLoadingExperience:
        (payload.originLoadingExperience as
          | Record<string, unknown>
          | undefined) ?? null,
    };
  }

  async fetchCruxRecord(input: CruxQueryInput): Promise<CruxRecordResult> {
    if (!input.url && !input.origin) {
      throw new PerformanceProviderError(
        "CrUX query requires either url or origin",
        400,
        "CRUX_INVALID_QUERY",
      );
    }

    const apiKey = this.getApiKey();
    const body: Record<string, unknown> = {};
    if (input.url) body.url = input.url;
    if (input.origin) body.origin = input.origin;
    if (input.formFactor && input.formFactor !== "ALL") {
      body.formFactor = input.formFactor;
    }

    const response = await fetch(`${CRUX_ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });

    if (response.status === 404) {
      return { record: null, notFound: true };
    }

    if (!response.ok) {
      const errorBody = await this.readErrorBody(response);
      throw new PerformanceProviderError(
        errorBody.message,
        response.status,
        errorBody.code,
        errorBody.raw,
      );
    }

    const payload = (await response.json()) as Record<string, unknown>;
    const record =
      (payload.record as Record<string, unknown> | undefined) ?? null;
    return { record, notFound: false };
  }

  private async readErrorBody(response: Response): Promise<{
    message: string;
    code?: string;
    raw: unknown;
  }> {
    try {
      const text = await response.text();
      if (!text) {
        return {
          message: `HTTP ${response.status} ${response.statusText}`.trim(),
          raw: null,
        };
      }
      try {
        const json = JSON.parse(text) as {
          error?: {
            message?: string;
            status?: string;
            errors?: Array<{ reason?: string }>;
          };
        };
        const errorBlock = json.error;
        const reason = errorBlock?.errors?.[0]?.reason;
        return {
          message:
            errorBlock?.message ??
            `HTTP ${response.status} ${response.statusText}`.trim(),
          code: errorBlock?.status ?? reason,
          raw: json,
        };
      } catch {
        return {
          message: text.slice(0, 500),
          raw: text,
        };
      }
    } catch {
      return {
        message: `HTTP ${response.status} ${response.statusText}`.trim(),
        raw: null,
      };
    }
  }
}
