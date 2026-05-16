import { BingCrawlIssueSeverity } from "@prisma/client";

import {
  computeCtr,
  formatBingDate,
  mapCrawlIssue,
  mapCrawlIssueSeverity,
  mapPageQueryRows,
  mapPageRows,
  mapQueryRows,
  mapSitemap,
  pickBingPosition,
} from "./bing-webmaster-sync.service";
import { parseBingDate } from "./bing-webmaster-api.service";

describe("Bing sync mappers", () => {
  describe("parseBingDate", () => {
    it("parses Microsoft /Date(ms)/ format", () => {
      const d = parseBingDate("/Date(1717200000000)/");
      expect(d?.getUTCFullYear()).toBe(2024);
      expect(d?.getUTCMonth()).toBe(5); // June
    });
    it("parses ISO strings", () => {
      const d = parseBingDate("2024-06-15T00:00:00Z");
      expect(d?.toISOString()).toBe("2024-06-15T00:00:00.000Z");
    });
    it("returns null for empty/invalid", () => {
      expect(parseBingDate("")).toBeNull();
      expect(parseBingDate(null)).toBeNull();
      expect(parseBingDate("not-a-date")).toBeNull();
    });
  });

  describe("formatBingDate", () => {
    it("formats as YYYY-MM-DD in UTC", () => {
      expect(formatBingDate(new Date("2024-06-15T05:00:00Z"))).toBe(
        "2024-06-15",
      );
    });
  });

  describe("computeCtr", () => {
    it("returns 0 for zero impressions", () => {
      expect(computeCtr(5, 0)).toBe(0);
      expect(computeCtr(0, 0)).toBe(0);
    });
    it("returns clicks/impressions", () => {
      expect(computeCtr(2, 10)).toBe(0.2);
    });
  });

  describe("pickBingPosition", () => {
    it("prefers AvgImpressionPosition", () => {
      expect(
        pickBingPosition({ AvgImpressionPosition: 4.2, AvgClickPosition: 2 }),
      ).toBe(4.2);
    });
    it("falls back to AvgClickPosition", () => {
      expect(pickBingPosition({ AvgClickPosition: 7.5 })).toBe(7.5);
    });
    it("returns 0 when neither is set", () => {
      expect(pickBingPosition({})).toBe(0);
    });
  });

  describe("mapPageRows", () => {
    it("maps Bing page rows into upsert inputs", () => {
      const rows = [
        {
          Date: "/Date(1717200000000)/",
          Page: "https://x.test/foo",
          Clicks: 3,
          Impressions: 30,
          AvgImpressionPosition: 5,
        },
        {
          Date: "2024-06-02T00:00:00Z",
          Page: "https://x.test/bar",
          Clicks: 0,
          Impressions: 0,
        },
      ];
      const out = mapPageRows(rows, "site-1");
      expect(out).toHaveLength(2);
      expect(out[0]).toMatchObject({
        siteId: "site-1",
        page: "https://x.test/foo",
        clicks: 3,
        impressions: 30,
        ctr: 0.1,
        position: 5,
      });
      // dates normalized to UTC midnight
      expect(out[0]?.date.getUTCHours()).toBe(0);
      expect(out[1]?.ctr).toBe(0);
    });

    it("skips rows missing Page or Date", () => {
      const out = mapPageRows(
        [
          { Date: "", Page: "", Clicks: 0, Impressions: 0 } as never,
          { Date: "bad", Page: "x", Clicks: 0, Impressions: 0 } as never,
        ],
        "s",
      );
      expect(out).toHaveLength(0);
    });

    it("returns [] for undefined", () => {
      expect(mapPageRows(undefined, "s")).toEqual([]);
    });
  });

  describe("mapQueryRows", () => {
    it("uses empty string for page sentinel", () => {
      const out = mapQueryRows(
        [
          {
            Date: "2024-06-01T00:00:00Z",
            Query: "best widgets",
            Clicks: 5,
            Impressions: 50,
          },
        ],
        "site-2",
      );
      expect(out).toHaveLength(1);
      expect(out[0]?.page).toBe("");
      expect(out[0]?.query).toBe("best widgets");
      expect(out[0]?.ctr).toBe(0.1);
    });

    it("skips rows without Query", () => {
      const out = mapQueryRows(
        [{ Date: "2024-06-01T00:00:00Z", Query: "" } as never],
        "s",
      );
      expect(out).toHaveLength(0);
    });
  });

  describe("mapPageQueryRows", () => {
    it("captures both page and query dimensions", () => {
      const out = mapPageQueryRows(
        [
          {
            Date: "2024-06-01T00:00:00Z",
            Query: "buy x",
            Page: "https://x.test/p",
            Clicks: 1,
            Impressions: 10,
          },
        ],
        "s",
      );
      expect(out[0]?.page).toBe("https://x.test/p");
      expect(out[0]?.query).toBe("buy x");
    });

    it("uses empty page sentinel when Bing omits Page", () => {
      const out = mapPageQueryRows(
        [
          {
            Date: "2024-06-01T00:00:00Z",
            Query: "q",
            Clicks: 0,
            Impressions: 0,
          } as never,
        ],
        "s",
      );
      expect(out[0]?.page).toBe("");
    });
  });

  describe("mapSitemap", () => {
    it("coerces dates, urlCount, errors, warnings", () => {
      const out = mapSitemap({
        Url: "https://x/sitemap.xml",
        Status: "Submitted",
        LastSubmitted: "/Date(1717200000000)/",
        UrlCount: 12,
        Errors: 1,
        Warnings: 2,
      });
      expect(out.status).toBe("Submitted");
      expect(out.urlCount).toBe(12);
      expect(out.errors).toBe(1);
      expect(out.warnings).toBe(2);
      expect(out.lastSubmitted?.getUTCFullYear()).toBe(2024);
      expect(out.lastDownloaded).toBeNull();
    });

    it("clamps negative numbers to 0", () => {
      const out = mapSitemap({
        Url: "x",
        UrlCount: -5,
        Errors: -1,
        Warnings: -3,
      });
      expect(out.urlCount).toBe(0);
      expect(out.errors).toBe(0);
      expect(out.warnings).toBe(0);
    });
  });

  describe("mapCrawlIssueSeverity", () => {
    it("maps explicit severity strings", () => {
      expect(mapCrawlIssueSeverity("Error", null)).toBe(
        BingCrawlIssueSeverity.ERROR,
      );
      expect(mapCrawlIssueSeverity("Warning", null)).toBe(
        BingCrawlIssueSeverity.WARNING,
      );
      expect(mapCrawlIssueSeverity("Info", null)).toBe(
        BingCrawlIssueSeverity.INFO,
      );
    });
    it("falls back to HTTP code", () => {
      expect(mapCrawlIssueSeverity(undefined, 500)).toBe(
        BingCrawlIssueSeverity.ERROR,
      );
      expect(mapCrawlIssueSeverity(undefined, 404)).toBe(
        BingCrawlIssueSeverity.WARNING,
      );
    });
    it("defaults to WARNING", () => {
      expect(mapCrawlIssueSeverity(undefined, null)).toBe(
        BingCrawlIssueSeverity.WARNING,
      );
    });
  });

  describe("mapCrawlIssue", () => {
    const now = new Date("2024-06-15T00:00:00Z");
    it("requires a URL", () => {
      expect(mapCrawlIssue({ Url: "" } as never, now)).toBeNull();
    });
    it("normalizes missing issue code to UNKNOWN", () => {
      const out = mapCrawlIssue({ Url: "https://x/a" } as never, now);
      expect(out?.issueCode).toBe("UNKNOWN");
    });
    it("defaults timestamps to now", () => {
      const out = mapCrawlIssue(
        { Url: "https://x/a", IssueCode: 42 } as never,
        now,
      );
      expect(out?.firstDetectedAt).toEqual(now);
      expect(out?.lastSeenAt).toEqual(now);
      expect(out?.issueCode).toBe("42");
    });
    it("parses Microsoft dates", () => {
      const out = mapCrawlIssue(
        {
          Url: "https://x/a",
          IssueCode: "404",
          HttpCode: 404,
          FirstDetectedAt: "/Date(1717200000000)/",
          LastSeenAt: "/Date(1717286400000)/",
        } as never,
        now,
      );
      expect(out?.severity).toBe(BingCrawlIssueSeverity.WARNING);
      expect(out?.httpCode).toBe(404);
      expect(out?.firstDetectedAt?.getUTCFullYear()).toBe(2024);
    });
  });
});
