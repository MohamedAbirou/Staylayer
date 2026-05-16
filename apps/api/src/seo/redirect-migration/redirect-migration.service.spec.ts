import { Test } from "@nestjs/testing";
import { SearchEngineSubmissionTarget } from "@prisma/client";
import { RedirectMigrationService } from "./redirect-migration.service";
import { PrismaService } from "../../prisma/prisma.service";
import { IndexNowService } from "../indexnow/indexnow.service";
import { RobotsService } from "../robots/robots.service";

describe("RedirectMigrationService", () => {
  let service: RedirectMigrationService;
  let prisma: {
    redirect: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
  };
  let indexNow: { submitAuto: jest.Mock };
  let robots: { resolveCanonicalHost: jest.Mock };

  beforeEach(async () => {
    prisma = {
      redirect: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    };
    indexNow = { submitAuto: jest.fn().mockResolvedValue(undefined) };
    robots = {
      resolveCanonicalHost: jest.fn().mockResolvedValue("example.com"),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        RedirectMigrationService,
        { provide: PrismaService, useValue: prisma },
        { provide: IndexNowService, useValue: indexNow },
        { provide: RobotsService, useValue: robots },
      ],
    }).compile();
    service = moduleRef.get(RedirectMigrationService);
  });

  describe("recordSlugChange", () => {
    test("creates a new redirect when none exists", async () => {
      prisma.redirect.findFirst.mockResolvedValue(null);
      prisma.redirect.updateMany.mockResolvedValue({ count: 0 });

      await service.recordSlugChange({
        siteId: "site-1",
        oldSlug: "old",
        newSlug: "new",
        locale: "en",
      });

      expect(prisma.redirect.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          siteId: "site-1",
          fromPath: "/old",
          toPath: "/new",
          statusCode: 301,
          permanent: true,
          locale: "en",
          enabled: true,
          source: "SLUG_CHANGE",
        }),
      });
      expect(indexNow.submitAuto).toHaveBeenCalledWith({
        siteId: "site-1",
        urls: ["https://example.com/old", "https://example.com/new"],
        target: SearchEngineSubmissionTarget.INDEXNOW_AUTO_REDIRECT_CREATE,
      });
    });

    test("idempotent: updates existing redirect instead of creating", async () => {
      prisma.redirect.findFirst.mockResolvedValue({ id: "r-1" });
      prisma.redirect.updateMany.mockResolvedValue({ count: 0 });

      await service.recordSlugChange({
        siteId: "site-1",
        oldSlug: "old",
        newSlug: "new",
        locale: "en",
      });

      expect(prisma.redirect.update).toHaveBeenCalledWith({
        where: { id: "r-1" },
        data: expect.objectContaining({
          toPath: "/new",
          enabled: true,
          source: "SLUG_CHANGE",
        }),
      });
      expect(prisma.redirect.create).not.toHaveBeenCalled();
    });

    test("re-targets stale SLUG_CHANGE rules pointing at old slug", async () => {
      prisma.redirect.findFirst.mockResolvedValue(null);
      prisma.redirect.updateMany.mockResolvedValue({ count: 2 });

      await service.recordSlugChange({
        siteId: "site-1",
        oldSlug: "old",
        newSlug: "new",
        locale: "en",
      });

      expect(prisma.redirect.updateMany).toHaveBeenCalledWith({
        where: {
          siteId: "site-1",
          toPath: "/old",
          source: "SLUG_CHANGE",
          locale: "en",
        },
        data: { toPath: "/new" },
      });
    });

    test("no-ops when oldSlug === newSlug", async () => {
      await service.recordSlugChange({
        siteId: "site-1",
        oldSlug: "same",
        newSlug: "same",
        locale: "en",
      });
      expect(prisma.redirect.create).not.toHaveBeenCalled();
      expect(prisma.redirect.update).not.toHaveBeenCalled();
    });

    test("swallows errors so the parent rename can succeed", async () => {
      prisma.redirect.findFirst.mockRejectedValue(new Error("db down"));
      await expect(
        service.recordSlugChange({
          siteId: "site-1",
          oldSlug: "old",
          newSlug: "new",
          locale: "en",
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe("importCsv", () => {
    test("rejects empty payload", async () => {
      await expect(service.importCsv("s1", "")).rejects.toThrow(/empty/i);
    });

    test("strict mode bails when parser reports errors", async () => {
      const summary = await service.importCsv(
        "s1",
        "from,to,status\n/a,/b,418",
        "strict",
      );
      expect(summary.failed).toBeGreaterThan(0);
      expect(summary.created).toBe(0);
    });

    test("skip mode leaves existing rules untouched", async () => {
      prisma.redirect.findMany.mockResolvedValue([
        { id: "x", fromPath: "/a", locale: null },
      ]);
      const summary = await service.importCsv("s1", "from,to\n/a,/b", "skip");
      expect(summary.skipped).toBe(1);
      expect(prisma.redirect.update).not.toHaveBeenCalled();
      expect(prisma.redirect.create).not.toHaveBeenCalled();
    });

    test("overwrite mode updates existing rules", async () => {
      prisma.redirect.findMany.mockResolvedValue([
        { id: "x", fromPath: "/a", locale: null },
      ]);
      prisma.redirect.update.mockResolvedValue({});
      const summary = await service.importCsv(
        "s1",
        "from,to\n/a,/b-new",
        "overwrite",
      );
      expect(summary.updated).toBe(1);
      expect(prisma.redirect.update).toHaveBeenCalled();
    });
  });
});
