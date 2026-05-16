/**
 * Pure helpers for the Phase E.3 scheduled-audit subsystem. No DB, no IO —
 * exercised directly by unit tests so the scheduler's behaviour is fully
 * deterministic.
 */

import type { SeoAuditScheduleCadence } from "@prisma/client";

export interface ComputeNextRunInput {
  cadence: SeoAuditScheduleCadence;
  /** 0–23 UTC. Clamped if outside range. */
  hourUtc: number;
  /** 0 (Sun) … 6 (Sat). Required when cadence = WEEKLY. */
  dayOfWeek?: number | null;
  /** Reference timestamp; defaults to now in callers. */
  now: Date;
}

/**
 * Returns the next-run timestamp for a schedule, or `null` when cadence is
 * OFF. The returned date is always strictly in the future relative to `now`.
 */
export function computeNextRunAt(input: ComputeNextRunInput): Date | null {
  if (input.cadence === "OFF") return null;

  const hour = clampHour(input.hourUtc);
  const next = new Date(
    Date.UTC(
      input.now.getUTCFullYear(),
      input.now.getUTCMonth(),
      input.now.getUTCDate(),
      hour,
      0,
      0,
      0,
    ),
  );

  if (input.cadence === "DAILY") {
    if (next.getTime() <= input.now.getTime()) {
      next.setUTCDate(next.getUTCDate() + 1);
    }
    return next;
  }

  // WEEKLY
  const target = clampDow(input.dayOfWeek ?? 1); // default Monday
  const currentDow = next.getUTCDay();
  let deltaDays = (target - currentDow + 7) % 7;
  if (deltaDays === 0 && next.getTime() <= input.now.getTime()) {
    deltaDays = 7;
  }
  next.setUTCDate(next.getUTCDate() + deltaDays);
  return next;
}

function clampHour(h: number): number {
  if (!Number.isFinite(h)) return 3;
  return Math.max(0, Math.min(23, Math.trunc(h)));
}

function clampDow(d: number): number {
  if (!Number.isFinite(d)) return 1;
  return ((Math.trunc(d) % 7) + 7) % 7;
}

// ─────────────────────────────────────────────────────────────────────────
// Snapshot diff — emits alerts when a page's audit gets meaningfully worse.
// ─────────────────────────────────────────────────────────────────────────

export interface SnapshotMetrics {
  slug: string;
  locale: string;
  score: number;
  allowsCitation: boolean;
  findingsCount: number;
}

export type AuditAlertReason =
  | "SCORE_DROP"
  | "FELL_BELOW_THRESHOLD"
  | "CRAWLER_BLOCKED"
  | "NEW_FAILING_PAGE";

export interface AuditAlertCandidate {
  slug: string;
  locale: string;
  reason: AuditAlertReason;
  severity: "WARNING" | "CRITICAL";
  message: string;
  currentScore: number;
  previousScore: number | null;
}

/** Minimum score considered "healthy" for citation readiness. */
export const HEALTHY_SCORE_THRESHOLD = 55;
/** A regression must drop at least this many points to alert. */
export const REGRESSION_DROP_THRESHOLD = 10;

/**
 * Diff a new snapshot against the previous snapshot for the same
 * `(slug, locale)`. Returns zero or one alert candidate. Returning multiple
 * conflicting alerts adds noise — we surface the most-severe issue per page.
 */
export function diffSnapshot(
  current: SnapshotMetrics,
  previous: SnapshotMetrics | null,
): AuditAlertCandidate | null {
  // 1. Crawler blockage is the most severe state — page is uncitable.
  if (!current.allowsCitation && (previous?.allowsCitation ?? true)) {
    return {
      slug: current.slug,
      locale: current.locale,
      reason: "CRAWLER_BLOCKED",
      severity: "CRITICAL",
      message: `Page /${current.slug} (${current.locale}) is now blocked from AI citation by robots directives.`,
      currentScore: current.score,
      previousScore: previous?.score ?? null,
    };
  }

  // 2. Crossed below the healthy threshold for the first time.
  if (
    current.score < HEALTHY_SCORE_THRESHOLD &&
    (previous === null || previous.score >= HEALTHY_SCORE_THRESHOLD)
  ) {
    return {
      slug: current.slug,
      locale: current.locale,
      reason: previous === null ? "NEW_FAILING_PAGE" : "FELL_BELOW_THRESHOLD",
      severity: "WARNING",
      message:
        previous === null
          ? `New page /${current.slug} (${current.locale}) scored ${current.score}, below the healthy ${HEALTHY_SCORE_THRESHOLD} threshold.`
          : `Page /${current.slug} (${current.locale}) dropped below ${HEALTHY_SCORE_THRESHOLD} (now ${current.score}, was ${previous.score}).`,
      currentScore: current.score,
      previousScore: previous?.score ?? null,
    };
  }

  // 3. Significant regression even while staying above the threshold.
  if (
    previous !== null &&
    previous.score - current.score >= REGRESSION_DROP_THRESHOLD
  ) {
    return {
      slug: current.slug,
      locale: current.locale,
      reason: "SCORE_DROP",
      severity: "WARNING",
      message: `Page /${current.slug} (${current.locale}) score dropped ${previous.score - current.score} points (${previous.score} → ${current.score}).`,
      currentScore: current.score,
      previousScore: previous.score,
    };
  }

  return null;
}

/**
 * Stable per-page fingerprint used to dedupe `OperationalAlert` rows.
 * Re-running the same audit on the same page will upsert into the existing
 * alert row rather than creating a new one.
 */
export function alertFingerprint(
  candidate: Pick<AuditAlertCandidate, "slug" | "locale" | "reason">,
): string {
  return `seo-audit:${candidate.slug}:${candidate.locale}:${candidate.reason}`;
}
