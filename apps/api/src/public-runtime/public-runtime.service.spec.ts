/// <reference types="jest" />

import { HostVariant } from "@prisma/client";
import { ConfigService } from "@nestjs/config";
import { FormsService } from "../forms/forms.service";
import { PrismaService } from "../prisma/prisma.service";
import { SeoService } from "../seo/seo.service";
import { HostResolutionService } from "./host-resolution.service";
import { PreviewTokenService } from "./preview-token.service";
import { PublicRuntimeCacheService } from "./public-runtime.cache.service";
import { PublicRuntimeService } from "./public-runtime.service";

describe("PublicRuntimeService", () => {
  let service: PublicRuntimeService;
  let configService: {
    get: jest.Mock;
  };
  let prisma: {
    site: {
      findUnique: jest.Mock;
    };
    page: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
    };
  };
  let formsService: {
    resolvePublicForm: jest.Mock;
  };
  let seoService: {
    resolveRedirect: jest.Mock;
    generateJsonLd: jest.Mock;
    getEnabledSchemas: jest.Mock;
    generatePageTypeJsonLd: jest.Mock;
  };
  let cacheService: {
    getJson: jest.Mock;
    setJson: jest.Mock;
  };
  let hostResolutionService: {
    resolveHost: jest.Mock;
  };
  let previewTokenService: {
    createToken: jest.Mock;
  };

  beforeEach(() => {
    configService = {
      get: jest.fn((key: string) => {
        switch (key) {
          case "WEBSITE_RUNTIME_SECRET":
            return "runtime-secret";
          case "PLATFORM_ROOT_DOMAIN":
            return "staylayer.com";
          default:
            return undefined;
        }
      }),
    };
    prisma = {
      site: {
        findUnique: jest.fn(),
      },
      page: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
    };
    formsService = {
      resolvePublicForm: jest.fn(
        async (_siteId: string, params: { formKey?: string }) => ({
          id: params.formKey ? `form:${params.formKey}` : "form:default",
          key: params.formKey ?? "contact-primary",
          name: params.formKey
            ? `Form ${params.formKey}`
            : "Primary inquiry form",
          description: "Runtime form",
          formType: "CONTACT",
          assignment: null,
          schemaVersion: null,
          fields: [],
        }),
      ),
    };
    seoService = {
      resolveRedirect: jest.fn().mockResolvedValue(null),
      generateJsonLd: jest.fn().mockResolvedValue({
        "@context": "https://schema.org",
        "@type": "Hotel",
        name: "Sunset Villa",
      }),
      getEnabledSchemas: jest
        .fn()
        .mockResolvedValue(["BreadcrumbList", "FAQPage", "WebSite"]),
      generatePageTypeJsonLd: jest.fn().mockResolvedValue([]),
    };
    cacheService = {
      getJson: jest.fn().mockResolvedValue(null),
      setJson: jest.fn().mockResolvedValue(undefined),
    };
    hostResolutionService = {
      resolveHost: jest.fn(),
    };
    previewTokenService = {
      createToken: jest.fn().mockReturnValue({
        token: "preview-token",
        expiresAt: "2026-05-13T12:10:00.000Z",
      }),
    };

    service = new PublicRuntimeService(
      configService as unknown as ConfigService,
      prisma as unknown as PrismaService,
      formsService as unknown as FormsService,
      seoService as unknown as SeoService,
      cacheService as unknown as PublicRuntimeCacheService,
      hostResolutionService as unknown as HostResolutionService,
      previewTokenService as unknown as PreviewTokenService,
    );
  });

  it("assembles a host-aware runtime page payload with forms and structured data", async () => {
    hostResolutionService.resolveHost.mockResolvedValue({
      action: "serve",
      siteId: "site-1",
      resolutionSource: "platform_subdomain",
      canonicalHost: "sunset-villa.staylayer.com",
      defaultLocale: "en",
      enabledLocales: ["en"],
      preview: false,
      cacheTtlSeconds: 60,
      previewTokenVersion: 1,
    });
    prisma.site.findUnique.mockResolvedValue({
      id: "site-1",
      name: "Sunset Villa",
      publicSubdomain: "sunset-villa",
      publishedRevision: 1,
      previewTokenVersion: 1,
      primaryLocale: "en",
      enabledLocales: ["en"],
      settings: {
        siteName: "Sunset Villa",
        logoUrl: "https://cdn.example.com/logo.png",
        faviconUrl: "https://cdn.example.com/favicon.png",
        defaultLocale: "en",
        activeLocales: ["en"],
        seoTitleTemplate: "%s | Sunset Villa",
        seoDefaultDesc: "Stay in a private coastal villa.",
        seoOgImage: "https://cdn.example.com/og.png",
        seoIndexingEnabled: true,
        gaTrackingId: "G-123",
        gtmContainerId: "GTM-123",
        clarityId: "clarity-123",
      },
    });
    prisma.page.findFirst.mockResolvedValue({
      id: "page-1",
      slug: "home",
      locale: "en",
      title: "Welcome",
      puckData: {
        content: [
          {
            type: "ContactSection",
            props: { formKey: "contact-primary" },
          },
          {
            type: "ContactSection",
            props: { formKey: "" },
          },
        ],
      },
      seoTitle: null,
      seoDescription: null,
      seoOgImage: null,
      seoNoindex: false,
      updatedAt: new Date("2026-05-13T12:00:00.000Z"),
    });
    prisma.page.findMany
      .mockResolvedValueOnce([{ locale: "en" }, { locale: "de" }])
      .mockResolvedValueOnce([
        { slug: "home", title: "Welcome" },
        { slug: "rooms", title: "Rooms" },
      ]);

    const payload = await service.getPagePayload({
      hostname: "sunset-villa.staylayer.com",
      pathname: "/",
    });

    expect(payload).toMatchObject({
      site: {
        id: "site-1",
        canonicalHost: "sunset-villa.staylayer.com",
        indexingEnabled: true,
        analytics: {
          gaTrackingId: "G-123",
          gtmContainerId: "GTM-123",
          clarityId: "clarity-123",
        },
      },
      page: {
        id: "page-1",
        slug: "",
        locale: "en",
        availableLocales: ["en", "de"],
        seo: {
          title: "Welcome | Sunset Villa",
          description: "Stay in a private coastal villa.",
          canonicalUrl: "https://sunset-villa.staylayer.com",
          ogImage: "https://cdn.example.com/og.png",
          noindex: false,
        },
      },
      forms: {
        byKey: {
          "": expect.objectContaining({
            action: "/api/forms/submit",
          }),
          "contact-primary": expect.objectContaining({
            key: "contact-primary",
            action: "/api/forms/submit",
          }),
        },
      },
      cache: {
        siteTag: "site:site-1",
        pageTag: "page:site-1:/",
      },
    });
    expect(payload.structuredData).toHaveLength(3);
    expect(cacheService.setJson).toHaveBeenCalled();
  });

  it("returns a redirect payload when a host-scoped redirect matches the request path", async () => {
    hostResolutionService.resolveHost.mockResolvedValue({
      action: "serve",
      siteId: "site-1",
      resolutionSource: "custom_domain",
      canonicalHost: "brand.com",
      defaultLocale: "en",
      enabledLocales: ["en"],
      preview: false,
      cacheTtlSeconds: 60,
      previewTokenVersion: 1,
    });
    prisma.site.findUnique.mockResolvedValue({
      id: "site-1",
      name: "Sunset Villa",
      publicSubdomain: null,
      publishedRevision: 1,
      previewTokenVersion: 1,
      primaryLocale: "en",
      enabledLocales: ["en"],
      settings: {
        siteName: "Sunset Villa",
        logoUrl: "",
        faviconUrl: "",
        defaultLocale: "en",
        activeLocales: ["en"],
        seoTitleTemplate: "%s | Sunset Villa",
        seoDefaultDesc: "",
        seoOgImage: "",
        seoIndexingEnabled: true,
        gaTrackingId: "",
        gtmContainerId: "",
        clarityId: "",
      },
    });
    seoService.resolveRedirect.mockResolvedValue({
      toPath: "/book",
      permanent: true,
    });

    const payload = await service.getPagePayload({
      hostname: "brand.com",
      pathname: "/contact",
    });

    expect(payload).toMatchObject({
      page: null,
      redirect: {
        location: "https://brand.com/book",
        permanent: true,
      },
    });
    expect(prisma.page.findFirst).not.toHaveBeenCalled();
  });

  it("builds a signed preview link against the site canonical host", async () => {
    prisma.site.findUnique.mockResolvedValue({
      id: "site-1",
      publicSubdomain: "sunset-villa",
      preferredHostVariant: HostVariant.APEX,
      previewTokenVersion: 2,
      domains: [],
    });

    const previewLink = await service.createPreviewLink({
      siteId: "site-1",
      actorId: "user-1",
      requestedPathname: "/rooms",
    });

    expect(previewTokenService.createToken).toHaveBeenCalledWith({
      siteId: "site-1",
      actorId: "user-1",
      host: "sunset-villa.staylayer.com",
      pathPrefix: "/rooms",
      tokenVersion: 2,
      expiresInSeconds: 600,
    });
    expect(previewLink).toMatchObject({
      siteId: "site-1",
      host: "sunset-villa.staylayer.com",
      pathname: "/rooms",
      token: "preview-token",
      url: "https://sunset-villa.staylayer.com/api/preview?token=preview-token&path=%2Frooms",
    });
  });
});
