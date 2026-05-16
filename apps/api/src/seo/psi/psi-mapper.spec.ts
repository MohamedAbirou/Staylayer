import { parseCruxRecord, parseLighthouseResult } from "./psi-mapper";

describe("psi-mapper", () => {
  describe("parseLighthouseResult", () => {
    it("returns nulls for empty result", () => {
      const parsed = parseLighthouseResult(null);
      expect(parsed.performanceScore).toBeNull();
      expect(parsed.largestContentfulPaintMs).toBeNull();
      expect(parsed.lighthouseVersion).toBeNull();
      expect(parsed.fetchTime).toBeNull();
    });

    it("extracts category scores and core web vitals from a Lighthouse payload", () => {
      const fetchTime = "2024-06-01T12:00:00.000Z";
      const parsed = parseLighthouseResult({
        lighthouseVersion: "12.1.0",
        fetchTime,
        finalUrl: "https://example.com/",
        environment: { hostUserAgent: "Mozilla/5.0 PSI" },
        categories: {
          performance: { score: 0.93 },
          accessibility: { score: 0.88 },
          "best-practices": { score: 1 },
          seo: { score: 0.91 },
        },
        audits: {
          "largest-contentful-paint": { numericValue: 2100.5 },
          "first-contentful-paint": { numericValue: 800 },
          "cumulative-layout-shift": { numericValue: 0.05 },
          "total-blocking-time": { numericValue: 120 },
          "interaction-to-next-paint": { numericValue: 180 },
          "speed-index": { numericValue: 1500 },
          interactive: { numericValue: 2400 },
          "total-byte-weight": { numericValue: 540000.7 },
          "network-requests": {
            details: { items: [{}, {}, {}] },
          },
        },
      });

      expect(parsed.performanceScore).toBe(0.93);
      expect(parsed.accessibilityScore).toBe(0.88);
      expect(parsed.bestPracticesScore).toBe(1);
      expect(parsed.seoScore).toBe(0.91);
      expect(parsed.largestContentfulPaintMs).toBeCloseTo(2100.5);
      expect(parsed.firstContentfulPaintMs).toBe(800);
      expect(parsed.cumulativeLayoutShift).toBeCloseTo(0.05);
      expect(parsed.totalBlockingTimeMs).toBe(120);
      expect(parsed.interactionToNextPaintMs).toBe(180);
      expect(parsed.speedIndexMs).toBe(1500);
      expect(parsed.timeToInteractiveMs).toBe(2400);
      expect(parsed.lighthouseVersion).toBe("12.1.0");
      expect(parsed.userAgent).toBe("Mozilla/5.0 PSI");
      expect(parsed.fetchTime?.toISOString()).toBe(fetchTime);
      expect(parsed.finalUrl).toBe("https://example.com/");
      expect(parsed.totalByteWeight).toBe(540001);
      expect(parsed.numRequests).toBe(3);
    });

    it("falls back to experimental INP audit when stable id is missing", () => {
      const parsed = parseLighthouseResult({
        audits: {
          "experimental-interaction-to-next-paint": { numericValue: 250 },
        },
      });
      expect(parsed.interactionToNextPaintMs).toBe(250);
    });

    it("ignores invalid fetchTime", () => {
      const parsed = parseLighthouseResult({ fetchTime: "not-a-date" });
      expect(parsed.fetchTime).toBeNull();
    });
  });

  describe("parseCruxRecord", () => {
    it("returns nulls for empty record", () => {
      const parsed = parseCruxRecord(null);
      expect(parsed.lcpP75Ms).toBeNull();
      expect(parsed.collectionPeriodStart).toBeNull();
    });

    it("extracts p75 metrics and collection period", () => {
      const parsed = parseCruxRecord({
        metrics: {
          largest_contentful_paint: { percentiles: { p75: 2400 } },
          first_contentful_paint: { percentiles: { p75: 1800 } },
          cumulative_layout_shift: { percentiles: { p75: "0.07" } },
          interaction_to_next_paint: { percentiles: { p75: 210 } },
          experimental_time_to_first_byte: { percentiles: { p75: 600 } },
          first_input_delay: { percentiles: { p75: 45 } },
        },
        collectionPeriod: {
          firstDate: { year: 2024, month: 5, day: 1 },
          lastDate: { year: 2024, month: 5, day: 28 },
        },
      });

      expect(parsed.lcpP75Ms).toBe(2400);
      expect(parsed.fcpP75Ms).toBe(1800);
      expect(parsed.clsP75).toBeCloseTo(0.07);
      expect(parsed.inpP75Ms).toBe(210);
      expect(parsed.ttfbP75Ms).toBe(600);
      expect(parsed.fidP75Ms).toBe(45);
      expect(parsed.collectionPeriodStart?.toISOString()).toBe(
        "2024-05-01T00:00:00.000Z",
      );
      expect(parsed.collectionPeriodEnd?.toISOString()).toBe(
        "2024-05-28T00:00:00.000Z",
      );
    });

    it("ignores non-numeric p75 strings", () => {
      const parsed = parseCruxRecord({
        metrics: {
          largest_contentful_paint: { percentiles: { p75: "n/a" } },
        },
      });
      expect(parsed.lcpP75Ms).toBeNull();
    });
  });
});
