/// <reference types="jest" />

import { HostVariant } from "@prisma/client";
import { ConfigService } from "@nestjs/config";
import { HostResolutionService } from "./host-resolution.service";
import { PreviewTokenService } from "./preview-token.service";
import { PrismaService } from "../prisma/prisma.service";
import { PublicRuntimeCacheService } from "./public-runtime.cache.service";

describe("HostResolutionService", () => {
  let service: HostResolutionService;
  let prisma: {
    domain: {
      findMany: jest.Mock;
    };
    site: {
      findFirst: jest.Mock;
    };
  };
  let configService: {
    get: jest.Mock;
  };
  let cacheService: {
    getJson: jest.Mock;
    setJson: jest.Mock;
  };
  let previewTokenService: {
    assertAuthorizedPreview: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      domain: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      site: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };
    configService = {
      get: jest.fn((key: string) => {
        switch (key) {
          case "PLATFORM_ROOT_DOMAIN":
            return "staylayer.com";
          case "MARKETING_APP_ORIGIN":
            return "https://marketing.staylayer.com";
          case "DASHBOARD_APP_ORIGIN":
            return "https://dashboard.staylayer.com";
          default:
            return undefined;
        }
      }),
    };
    cacheService = {
      getJson: jest.fn().mockResolvedValue(null),
      setJson: jest.fn().mockResolvedValue(undefined),
    };
    previewTokenService = {
      assertAuthorizedPreview: jest.fn(),
    };

    service = new HostResolutionService(
      prisma as unknown as PrismaService,
      configService as unknown as ConfigService,
      cacheService as unknown as PublicRuntimeCacheService,
      previewTokenService as unknown as PreviewTokenService,
    );
  });

  it("redirects reserved platform-root traffic to the marketing origin", async () => {
    const result = await service.resolveHost({
      hostname: "staylayer.com",
      pathname: "/pricing",
    });

    expect(result).toEqual({
      action: "redirect",
      location: "https://marketing.staylayer.com/pricing",
      permanent: false,
    });
  });

  it("resolves a platform subdomain to the shared website runtime", async () => {
    prisma.site.findFirst.mockResolvedValue({
      id: "site-1",
      publicSubdomain: "sunset-villa",
      primaryLocale: "en",
      enabledLocales: ["en", "fr"],
      previewTokenVersion: 1,
      settings: {
        defaultLocale: "en",
        activeLocales: ["en", "fr"],
      },
    });

    const result = await service.resolveHost({
      hostname: "sunset-villa.staylayer.com",
      pathname: "/rooms",
    });

    expect(result).toEqual({
      action: "serve",
      siteId: "site-1",
      resolutionSource: "platform_subdomain",
      canonicalHost: "sunset-villa.staylayer.com",
      defaultLocale: "en",
      enabledLocales: ["en", "fr"],
      preview: false,
      cacheTtlSeconds: 60,
      previewTokenVersion: 1,
    });
    expect(cacheService.setJson).toHaveBeenCalled();
  });

  it("redirects custom domains to the canonical active host variant", async () => {
    prisma.domain.findMany.mockResolvedValue([
      {
        host: "brand.com",
        site: {
          id: "site-2",
          preferredHostVariant: HostVariant.WWW,
          primaryLocale: "en",
          enabledLocales: ["en"],
          previewTokenVersion: 1,
          settings: {
            defaultLocale: "en",
            activeLocales: ["en"],
          },
          domains: [
            { host: "brand.com", isPrimary: true },
            { host: "www.brand.com", isPrimary: false },
          ],
        },
      },
    ]);

    const result = await service.resolveHost({
      hostname: "brand.com",
      pathname: "/rooms",
    });

    expect(result).toEqual({
      action: "redirect",
      location: "https://www.brand.com/rooms",
      permanent: true,
    });
  });

  it("marks unknown hosts as not found", async () => {
    const result = await service.resolveHost({
      hostname: "unknown.staylayer.com",
      pathname: "/",
    });

    expect(result).toEqual({ action: "not_found" });
  });

  it("marks a resolved host as preview when the preview token is valid", async () => {
    prisma.site.findFirst.mockResolvedValue({
      id: "site-1",
      publicSubdomain: "sunset-villa",
      primaryLocale: "en",
      enabledLocales: ["en"],
      previewTokenVersion: 4,
      settings: {
        defaultLocale: "en",
        activeLocales: ["en"],
      },
    });

    const result = await service.resolveHost({
      hostname: "sunset-villa.staylayer.com",
      pathname: "/preview",
      previewToken: "preview-token",
    });

    expect(result).toMatchObject({
      action: "serve",
      preview: true,
      siteId: "site-1",
    });
    expect(previewTokenService.assertAuthorizedPreview).toHaveBeenCalledWith({
      token: "preview-token",
      siteId: "site-1",
      hostname: "sunset-villa.staylayer.com",
      pathname: "/preview",
      tokenVersion: 4,
    });
  });
});
