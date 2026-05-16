import {
  alertFingerprint,
  computeNextRunAt,
  diffSnapshot,
  HEALTHY_SCORE_THRESHOLD,
  REGRESSION_DROP_THRESHOLD,
  type SnapshotMetrics,
} from "./scheduled-audits.helpers";

describe("computeNextRunAt", () => {
  it("returns null when cadence is OFF", () => {
    expect(
      computeNextRunAt({
        cadence: "OFF",
        hourUtc: 3,
        now: new Date("2026-05-15T00:00:00Z"),
      }),
    ).toBeNull();
  });

  it("DAILY: returns today's hour when still in the future", () => {
    const now = new Date("2026-05-15T01:30:00Z");
    const next = computeNextRunAt({ cadence: "DAILY", hourUtc: 3, now });
    expect(next?.toISOString()).toBe("2026-05-15T03:00:00.000Z");
  });

  it("DAILY: rolls to next day when target hour has already passed", () => {
    const now = new Date("2026-05-15T05:00:00Z");
    const next = computeNextRunAt({ cadence: "DAILY", hourUtc: 3, now });
    expect(next?.toISOString()).toBe("2026-05-16T03:00:00.000Z");
  });

  it("WEEKLY: targets the configured dayOfWeek", () => {
    // 2026-05-15 = Friday (UTC). Targeting Monday (1) → 2026-05-18.
    const now = new Date("2026-05-15T12:00:00Z");
    const next = computeNextRunAt({
      cadence: "WEEKLY",
      hourUtc: 3,
      dayOfWeek: 1,
      now,
    });
    expect(next?.toISOString()).toBe("2026-05-18T03:00:00.000Z");
  });

  it("WEEKLY: same-day-of-week before hourUtc fires today", () => {
    // 2026-05-18 = Monday (1) at 01:00 → fires today 03:00.
    const now = new Date("2026-05-18T01:00:00Z");
    const next = computeNextRunAt({
      cadence: "WEEKLY",
      hourUtc: 3,
      dayOfWeek: 1,
      now,
    });
    expect(next?.toISOString()).toBe("2026-05-18T03:00:00.000Z");
  });

  it("WEEKLY: same-day-of-week after hourUtc rolls a full week", () => {
    const now = new Date("2026-05-18T04:00:00Z");
    const next = computeNextRunAt({
      cadence: "WEEKLY",
      hourUtc: 3,
      dayOfWeek: 1,
      now,
    });
    expect(next?.toISOString()).toBe("2026-05-25T03:00:00.000Z");
  });

  it("clamps out-of-range hour and dayOfWeek values", () => {
    const now = new Date("2026-05-15T00:00:00Z");
    const dailyTooLarge = computeNextRunAt({
      cadence: "DAILY",
      hourUtc: 99,
      now,
    });
    expect(dailyTooLarge?.getUTCHours()).toBe(23);

    const weeklyNeg = computeNextRunAt({
      cadence: "WEEKLY",
      hourUtc: 3,
      dayOfWeek: -1, // → 6 (Saturday)
      now,
    });
    expect(weeklyNeg?.getUTCDay()).toBe(6);
  });
});

describe("diffSnapshot", () => {
  const base: SnapshotMetrics = {
    slug: "about",
    locale: "en",
    score: 80,
    allowsCitation: true,
    findingsCount: 2,
  };

  it("returns null when nothing meaningful changed", () => {
    expect(diffSnapshot(base, { ...base, score: 78 })).toBeNull();
  });

  it("flags CRAWLER_BLOCKED as critical when allowsCitation flips off", () => {
    const alert = diffSnapshot(
      { ...base, allowsCitation: false, score: 40 },
      base,
    );
    expect(alert?.reason).toBe("CRAWLER_BLOCKED");
    expect(alert?.severity).toBe("CRITICAL");
  });

  it("does not re-fire CRAWLER_BLOCKED when previous run was already blocked", () => {
    const previous = { ...base, allowsCitation: false };
    const alert = diffSnapshot({ ...base, allowsCitation: false }, previous);
    expect(alert).toBeNull();
  });

  it("flags FELL_BELOW_THRESHOLD when score crosses 55 downward", () => {
    const alert = diffSnapshot({ ...base, score: 50 }, { ...base, score: 60 });
    expect(alert?.reason).toBe("FELL_BELOW_THRESHOLD");
    expect(alert?.severity).toBe("WARNING");
  });

  it("flags NEW_FAILING_PAGE when no previous snapshot and score is unhealthy", () => {
    const alert = diffSnapshot(
      { ...base, score: HEALTHY_SCORE_THRESHOLD - 1 },
      null,
    );
    expect(alert?.reason).toBe("NEW_FAILING_PAGE");
  });

  it("ignores brand-new pages above the threshold", () => {
    expect(diffSnapshot(base, null)).toBeNull();
  });

  it("flags SCORE_DROP when delta ≥ threshold but still healthy", () => {
    const previous = { ...base, score: 90 };
    const current = { ...base, score: 90 - REGRESSION_DROP_THRESHOLD };
    const alert = diffSnapshot(current, previous);
    expect(alert?.reason).toBe("SCORE_DROP");
    expect(alert?.message).toContain(`${REGRESSION_DROP_THRESHOLD} points`);
  });

  it("does not flag SCORE_DROP under the threshold delta", () => {
    expect(
      diffSnapshot({ ...base, score: 82 }, { ...base, score: 90 }),
    ).toBeNull();
  });
});

describe("alertFingerprint", () => {
  it("includes slug, locale, and reason", () => {
    expect(
      alertFingerprint({ slug: "blog/x", locale: "en", reason: "SCORE_DROP" }),
    ).toBe("seo-audit:blog/x:en:SCORE_DROP");
  });
});
