import { formatGscDate, mapPageRows, mapQueryRows, mapSitemap } from "./search-console-sync.service";

describe("search-console mappers", () => {
  describe("mapPageRows", () => {
    it("returns [] for undefined/empty input", () => {
      expect(mapPageRows(undefined, "s")).toEqual([]);
      expect(mapPageRows([], "s")).toEqual([]);
    });

    it("maps date+page rows to upsert inputs", () => {
      const rows = mapPageRows(
        [
          {
            keys: ["2026-05-01", "https://example.com/"],
            clicks: 12,
            impressions: 100,
            ctr: 0.12,
            position: 5.3,
          },
          {
            keys: ["2026-05-02", "https://example.com/about"],
            clicks: 0.6,
            impressions: 2.4,
            ctr: 0.25,
            position: 4.1,
          },
        ],
        "site-1",
      );
      expect(rows).toHaveLength(2);
      expect(rows[0]).toMatchObject({
        siteId: "site-1",
        page: "https://example.com/",
        clicks: 12,
        impressions: 100,
        ctr: 0.12,
        position: 5.3,
      });
      expect(rows[0].date.toISOString()).toBe("2026-05-01T00:00:00.000Z");
      // Verify rounding of fractional clicks/impressions
      expect(rows[1].clicks).toBe(1);
      expect(rows[1].impressions).toBe(2);
    });

    it("drops rows missing date or page key", () => {
      const rows = mapPageRows(
        [
          { keys: [], clicks: 0, impressions: 0, ctr: 0, position: 0 },
          {
            keys: ["2026-05-01"],
            clicks: 1,
            impressions: 1,
            ctr: 1,
            position: 1,
          },
        ],
        "site-1",
      );
      expect(rows).toEqual([]);
    });
  });

  describe("mapQueryRows", () => {
    it("captures optional page key", () => {
      const rows = mapQueryRows(
        [
          {
            keys: ["2026-05-01", "best villas", "https://example.com/"],
            clicks: 4,
            impressions: 50,
            ctr: 0.08,
            position: 6.4,
          },
          {
            keys: ["2026-05-01", "no-page-query"],
            clicks: 2,
            impressions: 30,
            ctr: 0.066,
            position: 9.0,
          },
        ],
        "site-1",
      );
      expect(rows).toHaveLength(2);
      expect(rows[0].query).toBe("best villas");
      expect(rows[0].page).toBe("https://example.com/");
      expect(rows[1].page).toBeNull();
    });
  });

  describe("mapSitemap", () => {
    it("parses ISO timestamps and numeric counts", () => {
      const mapped = mapSitemap({
        path: "https://example.com/sitemap.xml",
        type: "sitemap",
        isPending: false,
        isSitemapsIndex: true,
        lastSubmitted: "2026-05-01T12:00:00Z",
        lastDownloaded: "2026-05-02T01:30:00Z",
        errors: "0",
        warnings: "3",
        contents: [{ type: "web", submitted: "120", indexed: "100" }],
      } as unknown as Parameters<typeof mapSitemap>[0]);
      expect(mapped.errors).toBe(0);
      expect(mapped.warnings).toBe(3);
      expect(mapped.isSitemapsIndex).toBe(true);
      expect(mapped.lastSubmitted?.toISOString()).toBe("2026-05-01T12:00:00.000Z");
      expect(mapped.contents).toBeDefined();
    });

    it("handles minimal sitemap with no timestamps", () => {
      const mapped = mapSitemap({ path: "x" } as unknown as Parameters<typeof mapSitemap>[0]);
      expect(mapped.lastSubmitted).toBeNull();
      expect(mapped.lastDownloaded).toBeNull();
      expect(mapped.contents).toBeNull();
      expect(mapped.isPending).toBe(false);
    });
  });

  describe("formatGscDate", () => {
    it("formats UTC YYYY-MM-DD", () => {
      expect(formatGscDate(new Date("2026-01-05T23:00:00Z"))).toBe("2026-01-05");
      expect(formatGscDate(new Date("2026-12-31T23:59:59Z"))).toBe("2026-12-31");
    });
  });
});
