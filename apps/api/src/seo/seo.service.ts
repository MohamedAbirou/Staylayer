import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Prisma } from "@prisma/client";

// ── Redirect Management ─────────────────────────────────────────────────────

export interface CreateRedirectInput {
  siteId: string;
  fromPath: string;
  toPath: string;
  statusCode?: number;
  locale?: string;
  reason?: string;
  permanent?: boolean;
}

export interface RedirectDto {
  id: string;
  siteId: string;
  fromPath: string;
  toPath: string;
  statusCode: number;
  locale: string | null;
  reason: string | null;
  permanent: boolean;
  enabled: boolean;
  createdAt: string;
}

// ── SEO Validation ──────────────────────────────────────────────────────────

export type SeoIssueSeverity = "error" | "warning" | "info";

export interface SeoIssue {
  field: string;
  severity: SeoIssueSeverity;
  message: string;
  suggestion?: string;
}

export interface SeoValidationResult {
  score: number;
  issues: SeoIssue[];
  pass: boolean;
}

// ── Structured Data ─────────────────────────────────────────────────────────

export interface StructuredDataDto {
  id: string;
  siteId: string;
  businessType: string;
  businessName: string | null;
  description: string | null;
  streetAddress: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  country: string | null;
  telephone: string | null;
  email: string | null;
  starRating: number | null;
  priceRange: string | null;
  checkInTime: string | null;
  checkOutTime: string | null;
  amenities: string[] | null;
  roomCount: number | null;
  latitude: number | null;
  longitude: number | null;
  imageUrl: string | null;
  enabledSchemas: string[] | null;
  roomTypes: StructuredRoomType[] | null;
  offers: StructuredOffer[] | null;
}

export interface StructuredRoomType {
  name: string;
  description?: string;
  occupancy?: number | null;
  bedType?: string;
  imageUrl?: string;
}

export interface StructuredOffer {
  name: string;
  description?: string;
  price?: string;
  priceCurrency?: string;
  url?: string;
  availability?: string;
}

const DEFAULT_ENABLED_SCHEMAS = ["HospitalityBusiness", "BreadcrumbList"];
const MANAGED_SCHEMA_TYPES = new Set([
  "HospitalityBusiness",
  "BreadcrumbList",
  "FAQPage",
  "HotelRoom",
  "Offer",
]);

const GENERIC_CONTENT_PATTERNS = [
  /what is this product/i,
  /description of your product or service/i,
  /everything you need to know about our platform/i,
  /14-day free trial/i,
  /cancel your subscription/i,
  /onboarding & setup guidance/i,
  /feature walkthroughs/i,
  /partnership opportunities/i,
  /general support/i,
  /have a question about staylayer/i,
  /example page title/i,
  /lorem ipsum/i,
];

@Injectable()
export class SeoService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Redirects ─────────────────────────────────────────────────────────────

  async createRedirect(input: CreateRedirectInput): Promise<RedirectDto> {
    const normalizedFrom = this.normalizePath(input.fromPath);
    const normalizedTo = this.normalizePath(input.toPath);

    if (normalizedFrom === normalizedTo) {
      throw new BadRequestException(
        "Source and destination paths cannot be the same",
      );
    }

    const redirect = await this.prisma.redirect.create({
      data: {
        siteId: input.siteId,
        fromPath: normalizedFrom,
        toPath: normalizedTo,
        statusCode: input.statusCode ?? (input.permanent !== false ? 301 : 302),
        locale: input.locale ?? null,
        reason: input.reason ?? null,
        permanent: input.permanent ?? true,
        enabled: true,
      },
    });

    return this.redirectToDto(redirect);
  }

  async listRedirects(siteId: string): Promise<RedirectDto[]> {
    const redirects = await this.prisma.redirect.findMany({
      where: { siteId },
      orderBy: { createdAt: "desc" },
    });
    return redirects.map((r) => this.redirectToDto(r));
  }

  async resolveRedirect(
    siteId: string,
    path: string,
    locale?: string,
  ): Promise<RedirectDto | null> {
    const normalized = this.normalizePath(path);
    const redirect = await this.prisma.redirect.findFirst({
      where: {
        siteId,
        fromPath: normalized,
        enabled: true,
        ...(locale ? { OR: [{ locale }, { locale: null }] } : {}),
      },
      orderBy: { locale: "desc" },
    });
    return redirect ? this.redirectToDto(redirect) : null;
  }

  async toggleRedirect(
    siteId: string,
    redirectId: string,
    enabled: boolean,
  ): Promise<RedirectDto> {
    const existing = await this.prisma.redirect.findFirst({
      where: { id: redirectId, siteId },
    });
    if (!existing) throw new NotFoundException("Redirect not found");

    const updated = await this.prisma.redirect.update({
      where: { id: redirectId },
      data: { enabled },
    });
    return this.redirectToDto(updated);
  }

  async deleteRedirect(siteId: string, redirectId: string): Promise<void> {
    const existing = await this.prisma.redirect.findFirst({
      where: { id: redirectId, siteId },
    });
    if (!existing) throw new NotFoundException("Redirect not found");
    await this.prisma.redirect.delete({ where: { id: redirectId } });
  }

  // ── SEO Validation ────────────────────────────────────────────────────────

  async validatePageSeo(
    siteId: string,
    slug: string,
    locale: string,
  ): Promise<SeoValidationResult> {
    const page = await this.prisma.page.findFirst({
      where: { siteId, slug, locale, deletedAt: null },
    });
    if (!page) throw new NotFoundException("Page not found");

    const site = await this.prisma.site.findUnique({
      where: { id: siteId },
      select: {
        name: true,
        settings: {
          select: {
            siteName: true,
          },
        },
      },
    });

    const issues: SeoIssue[] = [];

    if (!page.title || page.title.trim().length === 0) {
      issues.push({
        field: "title",
        severity: "error",
        message: "Page title is missing",
        suggestion: "Add a descriptive title for this page",
      });
    }

    if (page.seoTitle) {
      if (page.seoTitle.length < 30) {
        issues.push({
          field: "seoTitle",
          severity: "warning",
          message: `SEO title is too short (${page.seoTitle.length} chars)`,
          suggestion: "Aim for 50-60 characters for optimal search display",
        });
      } else if (page.seoTitle.length > 60) {
        issues.push({
          field: "seoTitle",
          severity: "warning",
          message: `SEO title may be truncated (${page.seoTitle.length} chars)`,
          suggestion:
            "Keep under 60 characters to avoid truncation in search results",
        });
      }
    } else {
      issues.push({
        field: "seoTitle",
        severity: "warning",
        message: "SEO title is not set (page title will be used)",
        suggestion:
          "Set a custom SEO title for better search result appearance",
      });
    }

    if (page.seoDescription) {
      if (page.seoDescription.length < 70) {
        issues.push({
          field: "seoDescription",
          severity: "warning",
          message: `Meta description is too short (${page.seoDescription.length} chars)`,
          suggestion: "Aim for 150-160 characters for optimal search display",
        });
      } else if (page.seoDescription.length > 160) {
        issues.push({
          field: "seoDescription",
          severity: "info",
          message: `Meta description may be truncated (${page.seoDescription.length} chars)`,
          suggestion: "Keep under 160 characters for clean display",
        });
      }
    } else {
      issues.push({
        field: "seoDescription",
        severity: "warning",
        message: "Meta description is not set",
        suggestion:
          "Add a compelling description to improve click-through rates",
      });
    }

    if (!page.seoOgImage && page.published) {
      issues.push({
        field: "seoOgImage",
        severity: "warning",
        message: "OG image is not set",
        suggestion: "Add a social sharing image (1200x630px recommended)",
      });
    }

    if (page.seoNoindex && page.published) {
      issues.push({
        field: "seoNoindex",
        severity: "info",
        message: "This page is marked as noindex but is published",
        suggestion:
          "Ensure this is intentional — noindex pages won't appear in search",
      });
    }

    const duplicate = await this.prisma.page.findFirst({
      where: {
        siteId,
        slug,
        locale,
        deletedAt: null,
        id: { not: page.id },
      },
    });
    if (duplicate) {
      issues.push({
        field: "slug",
        severity: "error",
        message: "Duplicate slug detected for this locale",
        suggestion: "Each locale can only have one page per slug",
      });
    }

    issues.push(
      ...this.findContentQualityIssues(
        page.puckData,
        site?.settings?.siteName || site?.name || "",
      ),
    );

    const score = this.calculateSeoScore(issues, page);

    return {
      score,
      issues,
      pass: !issues.some((i) => i.severity === "error"),
    };
  }

  // ── Structured Data ───────────────────────────────────────────────────────

  async getStructuredData(siteId: string): Promise<StructuredDataDto | null> {
    const data = await this.prisma.siteStructuredData.findUnique({
      where: { siteId },
    });
    return data ? this.structuredDataToDto(data) : null;
  }

  async upsertStructuredData(
    siteId: string,
    input: Partial<Omit<StructuredDataDto, "id" | "siteId">>,
  ): Promise<StructuredDataDto> {
    const enabledSchemas = input.enabledSchemas
      ? this.normalizeEnabledSchemas(input.enabledSchemas)
      : undefined;
    const amenities =
      input.amenities !== undefined
        ? this.normalizeStringArray(input.amenities)
        : undefined;
    const roomTypes =
      input.roomTypes !== undefined
        ? this.normalizeRoomTypes(input.roomTypes)
        : undefined;
    const offers =
      input.offers !== undefined
        ? this.normalizeOffers(input.offers)
        : undefined;

    const data = await this.prisma.siteStructuredData.upsert({
      where: { siteId },
      create: {
        siteId,
        businessType: input.businessType ?? "Hotel",
        businessName: input.businessName ?? null,
        description: input.description ?? null,
        streetAddress: input.streetAddress ?? null,
        city: input.city ?? null,
        region: input.region ?? null,
        postalCode: input.postalCode ?? null,
        country: input.country ?? null,
        telephone: input.telephone ?? null,
        email: input.email ?? null,
        starRating: input.starRating ?? null,
        priceRange: input.priceRange ?? null,
        checkInTime: input.checkInTime ?? null,
        checkOutTime: input.checkOutTime ?? null,
        amenities: amenities ?? undefined,
        roomCount: input.roomCount ?? null,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        imageUrl: input.imageUrl ?? null,
        enabledSchemas: enabledSchemas ?? DEFAULT_ENABLED_SCHEMAS,
        roomTypes: (roomTypes ?? undefined) as unknown as Prisma.InputJsonValue,
        offers: (offers ?? undefined) as unknown as Prisma.InputJsonValue,
      },
      update: {
        ...(input.businessType !== undefined
          ? { businessType: input.businessType }
          : {}),
        ...(input.businessName !== undefined
          ? { businessName: input.businessName }
          : {}),
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
        ...(input.streetAddress !== undefined
          ? { streetAddress: input.streetAddress }
          : {}),
        ...(input.city !== undefined ? { city: input.city } : {}),
        ...(input.region !== undefined ? { region: input.region } : {}),
        ...(input.postalCode !== undefined
          ? { postalCode: input.postalCode }
          : {}),
        ...(input.country !== undefined ? { country: input.country } : {}),
        ...(input.telephone !== undefined
          ? { telephone: input.telephone }
          : {}),
        ...(input.email !== undefined ? { email: input.email } : {}),
        ...(input.starRating !== undefined
          ? { starRating: input.starRating }
          : {}),
        ...(input.priceRange !== undefined
          ? { priceRange: input.priceRange }
          : {}),
        ...(input.checkInTime !== undefined
          ? { checkInTime: input.checkInTime }
          : {}),
        ...(input.checkOutTime !== undefined
          ? { checkOutTime: input.checkOutTime }
          : {}),
        ...(input.amenities !== undefined
          ? {
              amenities: amenities !== null ? amenities : Prisma.DbNull,
            }
          : {}),
        ...(input.roomCount !== undefined
          ? { roomCount: input.roomCount }
          : {}),
        ...(input.latitude !== undefined ? { latitude: input.latitude } : {}),
        ...(input.longitude !== undefined
          ? { longitude: input.longitude }
          : {}),
        ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl } : {}),
        ...(input.enabledSchemas !== undefined
          ? {
              enabledSchemas:
                enabledSchemas && enabledSchemas.length > 0
                  ? enabledSchemas
                  : DEFAULT_ENABLED_SCHEMAS,
            }
          : {}),
        ...(input.roomTypes !== undefined
          ? {
              roomTypes:
                roomTypes !== null
                  ? (roomTypes as unknown as Prisma.InputJsonValue)
                  : Prisma.DbNull,
            }
          : {}),
        ...(input.offers !== undefined
          ? {
              offers:
                offers !== null
                  ? (offers as unknown as Prisma.InputJsonValue)
                  : Prisma.DbNull,
            }
          : {}),
      },
    });
    return this.structuredDataToDto(data);
  }

  async generateJsonLd(
    siteId: string,
  ): Promise<Record<string, unknown> | null> {
    const data = await this.prisma.siteStructuredData.findUnique({
      where: { siteId },
    });
    if (!data) return null;

    if (!this.schemaEnabled(data.enabledSchemas, "HospitalityBusiness")) {
      return null;
    }

    const jsonLd: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@type": data.businessType,
    };

    if (data.businessName) jsonLd.name = data.businessName;
    if (data.description) jsonLd.description = data.description;
    if (data.imageUrl) jsonLd.image = data.imageUrl;
    if (data.telephone) jsonLd.telephone = data.telephone;
    if (data.email) jsonLd.email = data.email;
    if (data.priceRange) jsonLd.priceRange = data.priceRange;
    if (data.starRating) {
      jsonLd.starRating = {
        "@type": "Rating",
        ratingValue: data.starRating,
      };
    }
    if (data.roomCount) {
      jsonLd.numberOfRooms = data.roomCount;
    }

    if (data.streetAddress || data.city || data.country) {
      jsonLd.address = {
        "@type": "PostalAddress",
        ...(data.streetAddress ? { streetAddress: data.streetAddress } : {}),
        ...(data.city ? { addressLocality: data.city } : {}),
        ...(data.region ? { addressRegion: data.region } : {}),
        ...(data.postalCode ? { postalCode: data.postalCode } : {}),
        ...(data.country ? { addressCountry: data.country } : {}),
      };
    }

    if (data.latitude && data.longitude) {
      jsonLd.geo = {
        "@type": "GeoCoordinates",
        latitude: data.latitude,
        longitude: data.longitude,
      };
    }

    if (data.checkInTime || data.checkOutTime) {
      if (data.checkInTime) jsonLd.checkinTime = data.checkInTime;
      if (data.checkOutTime) jsonLd.checkoutTime = data.checkOutTime;
    }

    if (data.amenities && Array.isArray(data.amenities)) {
      jsonLd.amenityFeature = (data.amenities as string[]).map((name) => ({
        "@type": "LocationFeatureSpecification",
        name,
        value: true,
      }));
    }

    return jsonLd;
  }

  async getEnabledSchemas(siteId: string): Promise<string[]> {
    const data = await this.prisma.siteStructuredData.findUnique({
      where: { siteId },
      select: { enabledSchemas: true },
    });

    return this.normalizeEnabledSchemas(data?.enabledSchemas ?? null);
  }

  async generatePageTypeJsonLd(
    siteId: string,
    input: {
      hostname: string;
      pathname: string;
      puckData: Record<string, unknown>;
    },
  ): Promise<Record<string, unknown>[]> {
    const data = await this.prisma.siteStructuredData.findUnique({
      where: { siteId },
      select: {
        enabledSchemas: true,
        roomTypes: true,
        offers: true,
      },
    });

    const enabledSchemas = this.normalizeEnabledSchemas(
      data?.enabledSchemas ?? null,
    );
    const entries: Record<string, unknown>[] = [];

    if (enabledSchemas.includes("FAQPage")) {
      const faqItems = this.extractFaqItems(input.puckData);
      if (faqItems.length > 0) {
        entries.push({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faqItems.map((item) => ({
            "@type": "Question",
            name: item.question,
            acceptedAnswer: {
              "@type": "Answer",
              text: item.answer,
            },
          })),
        });
      }
    }

    if (enabledSchemas.includes("HotelRoom")) {
      for (const room of this.normalizeRoomTypes(data?.roomTypes ?? null) ??
        []) {
        const roomJsonLd: Record<string, unknown> = {
          "@context": "https://schema.org",
          "@type": "HotelRoom",
          name: room.name,
        };
        if (room.description) roomJsonLd.description = room.description;
        if (room.bedType) roomJsonLd.bed = room.bedType;
        if (room.imageUrl) roomJsonLd.image = room.imageUrl;
        if (room.occupancy) {
          roomJsonLd.occupancy = {
            "@type": "QuantitativeValue",
            value: room.occupancy,
          };
        }
        entries.push(roomJsonLd);
      }
    }

    if (enabledSchemas.includes("Offer")) {
      for (const offer of this.normalizeOffers(data?.offers ?? null) ?? []) {
        const offerJsonLd: Record<string, unknown> = {
          "@context": "https://schema.org",
          "@type": "Offer",
          name: offer.name,
          url: offer.url || this.absoluteUrl(input.hostname, input.pathname),
        };
        if (offer.description) offerJsonLd.description = offer.description;
        if (offer.price) offerJsonLd.price = offer.price;
        if (offer.priceCurrency) {
          offerJsonLd.priceCurrency = offer.priceCurrency;
        }
        if (offer.availability) {
          offerJsonLd.availability = `https://schema.org/${offer.availability}`;
        }
        entries.push(offerJsonLd);
      }
    }

    return entries;
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private normalizeEnabledSchemas(value: unknown): string[] {
    const schemas = Array.isArray(value) ? value : DEFAULT_ENABLED_SCHEMAS;
    const normalized = schemas
      .filter((schema): schema is string => typeof schema === "string")
      .filter((schema) => MANAGED_SCHEMA_TYPES.has(schema));

    return normalized.length > 0
      ? Array.from(new Set(normalized))
      : DEFAULT_ENABLED_SCHEMAS;
  }

  private schemaEnabled(value: unknown, schema: string): boolean {
    return this.normalizeEnabledSchemas(value).includes(schema);
  }

  private normalizeStringArray(value: unknown): string[] | null {
    if (value === null) return null;
    if (!Array.isArray(value)) return [];

    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 50);
  }

  private normalizeRoomTypes(value: unknown): StructuredRoomType[] | null {
    if (value === null) return null;
    if (!Array.isArray(value)) return [];

    return value
      .filter((item): item is Record<string, unknown> =>
        Boolean(item && typeof item === "object" && !Array.isArray(item)),
      )
      .map((item) => ({
        name: this.toCleanString(item.name),
        description: this.toCleanString(item.description),
        occupancy: this.toPositiveInt(item.occupancy),
        bedType: this.toCleanString(item.bedType),
        imageUrl: this.toCleanString(item.imageUrl),
      }))
      .filter((item) => Boolean(item.name))
      .slice(0, 25);
  }

  private normalizeOffers(value: unknown): StructuredOffer[] | null {
    if (value === null) return null;
    if (!Array.isArray(value)) return [];

    return value
      .filter((item): item is Record<string, unknown> =>
        Boolean(item && typeof item === "object" && !Array.isArray(item)),
      )
      .map((item) => ({
        name: this.toCleanString(item.name),
        description: this.toCleanString(item.description),
        price: this.toCleanString(item.price),
        priceCurrency: this.toCleanString(item.priceCurrency),
        url: this.toCleanString(item.url),
        availability: this.toCleanString(item.availability),
      }))
      .filter((item) => Boolean(item.name))
      .slice(0, 25);
  }

  private extractFaqItems(
    puckData: Record<string, unknown>,
  ): Array<{ question: string; answer: string }> {
    const items: Array<{ question: string; answer: string }> = [];

    const visit = (value: unknown) => {
      if (!value || typeof value !== "object") return;

      if (Array.isArray(value)) {
        value.forEach(visit);
        return;
      }

      const record = value as Record<string, unknown>;
      const props =
        record.props && typeof record.props === "object"
          ? (record.props as Record<string, unknown>)
          : record;

      if (record.type === "FAQ" && Array.isArray(props.items)) {
        for (const item of props.items) {
          if (!item || typeof item !== "object" || Array.isArray(item)) {
            continue;
          }

          const faq = item as Record<string, unknown>;
          const question = this.toCleanString(faq.question);
          const answer = this.toCleanString(faq.answer);
          if (question && answer) {
            items.push({ question, answer });
          }
        }
      }

      Object.values(record).forEach(visit);
    };

    visit(puckData);
    return items.slice(0, 50);
  }

  private findContentQualityIssues(
    puckData: unknown,
    siteName: string,
  ): SeoIssue[] {
    const text = this.extractText(puckData).join("\n");
    const issues: SeoIssue[] = [];

    if (!text.trim()) {
      issues.push({
        field: "content",
        severity: "warning",
        message: "Page content appears to be empty",
        suggestion:
          "Add customer-specific copy before relying on this page for organic search.",
      });
      return issues;
    }

    if (GENERIC_CONTENT_PATTERNS.some((pattern) => pattern.test(text))) {
      issues.push({
        field: "content",
        severity: "warning",
        message: "Page content still contains generic demo copy",
        suggestion:
          "Replace placeholder FAQ, contact, or product copy with property-specific content.",
      });
    }

    if (/staylayer/i.test(text) && siteName && !/staylayer/i.test(siteName)) {
      issues.push({
        field: "content",
        severity: "warning",
        message: "Page content mentions StayLayer on a customer site",
        suggestion:
          "Replace platform references with the customer brand, destination, and direct-booking value proposition.",
      });
    }

    return issues;
  }

  private extractText(value: unknown): string[] {
    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed ? [trimmed] : [];
    }

    if (!value || typeof value !== "object") {
      return [];
    }

    if (Array.isArray(value)) {
      return value.flatMap((item) => this.extractText(item));
    }

    return Object.values(value as Record<string, unknown>).flatMap((item) =>
      this.extractText(item),
    );
  }

  private toCleanString(value: unknown): string {
    return typeof value === "string" ? value.trim() : "";
  }

  private toPositiveInt(value: unknown): number | null {
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }

  private absoluteUrl(hostname: string, pathname: string): string {
    const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
    return `https://${hostname}${normalizedPath}`;
  }

  private normalizePath(path: string): string {
    let p = path.trim();
    if (!p.startsWith("/")) p = "/" + p;
    if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
    return p.toLowerCase();
  }

  private calculateSeoScore(
    issues: SeoIssue[],
    page: {
      seoTitle: string | null;
      seoDescription: string | null;
      seoOgImage: string | null;
      published: boolean;
    },
  ): number {
    let score = 100;
    for (const issue of issues) {
      if (issue.severity === "error") score -= 25;
      else if (issue.severity === "warning") score -= 10;
      else score -= 3;
    }
    if (
      page.seoTitle &&
      page.seoTitle.length >= 30 &&
      page.seoTitle.length <= 60
    )
      score += 5;
    if (
      page.seoDescription &&
      page.seoDescription.length >= 120 &&
      page.seoDescription.length <= 160
    )
      score += 5;
    if (page.seoOgImage) score += 5;
    return Math.max(0, Math.min(100, score));
  }

  private redirectToDto(r: {
    id: string;
    siteId: string;
    fromPath: string;
    toPath: string;
    statusCode: number;
    locale: string | null;
    reason: string | null;
    permanent: boolean;
    enabled: boolean;
    createdAt: Date;
  }): RedirectDto {
    return {
      id: r.id,
      siteId: r.siteId,
      fromPath: r.fromPath,
      toPath: r.toPath,
      statusCode: r.statusCode,
      locale: r.locale,
      reason: r.reason,
      permanent: r.permanent,
      enabled: r.enabled,
      createdAt: r.createdAt.toISOString(),
    };
  }

  private structuredDataToDto(d: {
    id: string;
    siteId: string;
    businessType: string;
    businessName: string | null;
    description: string | null;
    streetAddress: string | null;
    city: string | null;
    region: string | null;
    postalCode: string | null;
    country: string | null;
    telephone: string | null;
    email: string | null;
    starRating: number | null;
    priceRange: string | null;
    checkInTime: string | null;
    checkOutTime: string | null;
    amenities: unknown;
    roomCount: number | null;
    latitude: number | null;
    longitude: number | null;
    imageUrl: string | null;
    enabledSchemas: string[];
    roomTypes: unknown;
    offers: unknown;
  }): StructuredDataDto {
    return {
      id: d.id,
      siteId: d.siteId,
      businessType: d.businessType,
      businessName: d.businessName,
      description: d.description,
      streetAddress: d.streetAddress,
      city: d.city,
      region: d.region,
      postalCode: d.postalCode,
      country: d.country,
      telephone: d.telephone,
      email: d.email,
      starRating: d.starRating,
      priceRange: d.priceRange,
      checkInTime: d.checkInTime,
      checkOutTime: d.checkOutTime,
      amenities: Array.isArray(d.amenities) ? (d.amenities as string[]) : null,
      roomCount: d.roomCount,
      latitude: d.latitude,
      longitude: d.longitude,
      imageUrl: d.imageUrl,
      enabledSchemas: this.normalizeEnabledSchemas(d.enabledSchemas),
      roomTypes: this.normalizeRoomTypes(d.roomTypes),
      offers: this.normalizeOffers(d.offers),
    };
  }
}
