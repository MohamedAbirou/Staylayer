import { Injectable } from "@nestjs/common";
import {
  BillingActionType,
  DeploymentStatus,
  DomainStatus,
  FormDeliveryStatus,
  FormSubmissionStatus,
  OperationalAlertSeverity,
  OperationalAlertStatus,
  Prisma,
  SiteStatus,
  SubscriptionStatus,
  SupportCaseCategory,
  SupportCaseChannel,
  SupportCaseEventType,
  SupportCasePriority,
  SupportCaseStatus,
  TenantStatus,
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { BILLING_PLANS, isBillingPlanKey } from "../billing/billing-plans";

/**
 * Phase 10 — Operator analytics service.
 *
 * Strategy (per `operator-console-docs/06-analytics-metrics-and-observability.md`):
 *   1. Use live queries for correctness now.
 *   2. Bound every series with a small, validated time range (max 90d) so
 *      the database never has to scan unbounded history.
 *   3. Lean on existing indices: `(tenantId, createdAt)` /
 *      `(status, createdAt)` etc. — Phase 10 does not add new indices,
 *      but each query below is shaped to hit one.
 *   4. Every response carries `generatedAt` so the UI can render the
 *      `DataFreshness` indicator without callers tracking it locally.
 *
 * The service is intentionally read-only. There is no mutation surface —
 * analytics is observation, not operation.
 */

// Maximum range we expose. Larger ranges would shift several queries
// from indexed lookups to sequential scans; the SPA caps requests too.
const MAX_RANGE_DAYS = 90;
const DEFAULT_RANGE_DAYS = 30;

export type AnalyticsRangeDays = 7 | 30 | 90;

export function parseRangeDays(value: unknown): AnalyticsRangeDays {
  const candidate =
    typeof value === "string" ? Number.parseInt(value, 10) : value;
  if (candidate === 7 || candidate === 90) return candidate;
  return DEFAULT_RANGE_DAYS;
}

export interface AnalyticsRange {
  days: AnalyticsRangeDays;
  start: Date;
  end: Date;
  buckets: Date[];
}

interface BucketCounter {
  bucketKey: string;
  bucketStartIso: string;
  count: number;
}

@Injectable()
export class OperatorAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Range helpers ────────────────────────────────────────────────

  buildRange(days: AnalyticsRangeDays, now: Date): AnalyticsRange {
    const clampedDays = Math.min(MAX_RANGE_DAYS, Math.max(1, days));
    const end = new Date(now);
    end.setUTCHours(23, 59, 59, 999);
    const start = new Date(end);
    start.setUTCDate(end.getUTCDate() - (clampedDays - 1));
    start.setUTCHours(0, 0, 0, 0);
    const buckets: Date[] = [];
    for (let i = 0; i < clampedDays; i += 1) {
      const bucket = new Date(start);
      bucket.setUTCDate(start.getUTCDate() + i);
      buckets.push(bucket);
    }
    return { days: clampedDays as AnalyticsRangeDays, start, end, buckets };
  }

  private bucketKey(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private newEmptySeries(range: AnalyticsRange): BucketCounter[] {
    return range.buckets.map((bucket) => ({
      bucketKey: this.bucketKey(bucket),
      bucketStartIso: bucket.toISOString(),
      count: 0,
    }));
  }

  private accumulateInto(
    series: BucketCounter[],
    dates: ReadonlyArray<Date>,
  ): BucketCounter[] {
    const index = new Map<string, BucketCounter>(
      series.map((b) => [b.bucketKey, b]),
    );
    for (const date of dates) {
      const key = date.toISOString().slice(0, 10);
      const bucket = index.get(key);
      if (bucket) bucket.count += 1;
    }
    return series;
  }

  private percentile(sortedAsc: number[], p: number): number | null {
    if (sortedAsc.length === 0) return null;
    if (sortedAsc.length === 1) return sortedAsc[0];
    const rank = (p / 100) * (sortedAsc.length - 1);
    const lower = Math.floor(rank);
    const upper = Math.ceil(rank);
    if (lower === upper) return sortedAsc[lower];
    const weight = rank - lower;
    return sortedAsc[lower] * (1 - weight) + sortedAsc[upper] * weight;
  }

  private average(values: number[]): number | null {
    if (values.length === 0) return null;
    return values.reduce((sum, n) => sum + n, 0) / values.length;
  }

  // ─── Business analytics ───────────────────────────────────────────

  async getBusinessAnalytics(days: AnalyticsRangeDays): Promise<{
    generatedAt: string;
    range: { days: number; start: string; end: string };
    tenants: {
      total: number;
      active: number;
      suspended: number;
      archived: number;
      newInRange: number;
      newSeries: Array<{ date: string; count: number }>;
    };
    planMix: Array<{
      planKey: string;
      planName: string;
      tenantCount: number;
      activeCount: number;
      trialCount: number;
      attentionCount: number;
    }>;
    trialFunnel: {
      currentlyTrialing: number;
      convertedInRange: number;
      expiredInRange: number;
      canceledInRange: number;
      conversionRate: number | null;
    };
    churnSeries: Array<{
      date: string;
      canceled: number;
      downgrades: number;
      expansions: number;
    }>;
    paymentFailures: {
      totalFailedInRange: number;
      series: Array<{ date: string; count: number }>;
    };
    revenue: {
      currency: string | null;
      paidLast30Days: number;
      paidPreviousRange: number;
      outstanding: number;
      atRisk: number;
      lastInvoiceSyncedAt: string | null;
      series: Array<{ date: string; amount: number }>;
    };
    supportVolumeByPlan: Array<{
      planKey: string;
      planName: string;
      caseCount: number;
      openCases: number;
    }>;
  }> {
    const now = new Date();
    const range = this.buildRange(days, now);

    const tenantsPromise = this.prisma.tenant.findMany({
      select: {
        id: true,
        status: true,
        createdAt: true,
        subscriptions: {
          orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
          take: 1,
          select: {
            planKey: true,
            status: true,
            currentPeriodEnd: true,
            updatedAt: true,
          },
        },
      },
    });

    const paymentEventsPromise = this.prisma.billingPaymentEvent.findMany({
      where: {
        occurredAt: { gte: range.start, lte: range.end },
        status: { in: ["failed", "failure", "requires_action"] },
      },
      select: { occurredAt: true },
    });

    const recentPaidInvoicesPromise =
      this.prisma.billingInvoiceSnapshot.findMany({
        where: {
          status: "paid",
          providerCreatedAt: { gte: range.start, lte: range.end },
        },
        select: {
          amountPaid: true,
          currency: true,
          providerCreatedAt: true,
        },
      });

    const previousRangeStart = new Date(range.start);
    previousRangeStart.setUTCDate(range.start.getUTCDate() - range.days);
    const previousPaidInvoicesPromise =
      this.prisma.billingInvoiceSnapshot.aggregate({
        where: {
          status: "paid",
          providerCreatedAt: { gte: previousRangeStart, lt: range.start },
        },
        _sum: { amountPaid: true },
      });

    const outstandingInvoicesPromise =
      this.prisma.billingInvoiceSnapshot.aggregate({
        where: {
          status: { in: ["open", "uncollectible"] },
        },
        _sum: { amountRemaining: true },
      });

    const atRiskPromise = this.prisma.subscription.findMany({
      where: { status: { in: ["PAST_DUE", "INACTIVE"] } },
      select: { tenantId: true },
    });

    const lastInvoiceSyncedPromise =
      this.prisma.billingInvoiceSnapshot.findFirst({
        orderBy: { syncedAt: "desc" },
        select: { syncedAt: true },
      });

    const billingActionsPromise = this.prisma.billingActionRequest.findMany({
      where: {
        status: "EXECUTED",
        type: {
          in: [
            BillingActionType.CHANGE_PLAN,
            BillingActionType.CANCEL_AT_PERIOD_END,
          ],
        },
        executedAt: { gte: range.start, lte: range.end, not: null },
      },
      select: {
        type: true,
        executedAt: true,
        beforeSnapshot: true,
        afterSnapshot: true,
      },
    });

    const supportByPlanRowsPromise = this.prisma.supportCase.findMany({
      where: { createdAt: { gte: range.start, lte: range.end } },
      select: {
        status: true,
        tenant: {
          select: {
            subscriptions: {
              orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
              take: 1,
              select: { planKey: true },
            },
          },
        },
      },
    });

    const [
      tenants,
      paymentFailures,
      paidInvoices,
      previousPaidAgg,
      outstandingAgg,
      atRisk,
      lastInvoiceSynced,
      billingActions,
      supportByPlanRows,
    ] = await Promise.all([
      tenantsPromise,
      paymentEventsPromise,
      recentPaidInvoicesPromise,
      previousPaidInvoicesPromise,
      outstandingInvoicesPromise,
      atRiskPromise,
      lastInvoiceSyncedPromise,
      billingActionsPromise,
      supportByPlanRowsPromise,
    ]);

    // Tenant summary + new-tenants series
    const tenantScorecard = {
      total: tenants.length,
      active: 0,
      suspended: 0,
      archived: 0,
      newInRange: 0,
    };
    const newSeries = this.newEmptySeries(range);
    const newSeriesIndex = new Map(newSeries.map((b) => [b.bucketKey, b]));
    for (const tenant of tenants) {
      if (tenant.status === TenantStatus.ACTIVE) tenantScorecard.active += 1;
      else if (tenant.status === TenantStatus.SUSPENDED)
        tenantScorecard.suspended += 1;
      else if (tenant.status === TenantStatus.ARCHIVED)
        tenantScorecard.archived += 1;
      if (tenant.createdAt >= range.start && tenant.createdAt <= range.end) {
        tenantScorecard.newInRange += 1;
        const bucket = newSeriesIndex.get(
          tenant.createdAt.toISOString().slice(0, 10),
        );
        if (bucket) bucket.count += 1;
      }
    }

    // Plan mix
    const planMixMap = new Map<
      string,
      {
        planKey: string;
        planName: string;
        tenantCount: number;
        activeCount: number;
        trialCount: number;
        attentionCount: number;
      }
    >();
    let currentlyTrialing = 0;
    let convertedInRange = 0;
    let expiredInRange = 0;
    let canceledInRange = 0;

    for (const tenant of tenants) {
      const sub = tenant.subscriptions[0] ?? null;
      const planKey = sub?.planKey ?? "free";
      const planName = isBillingPlanKey(planKey)
        ? BILLING_PLANS[planKey].name
        : planKey;
      const entry = planMixMap.get(planKey) ?? {
        planKey,
        planName,
        tenantCount: 0,
        activeCount: 0,
        trialCount: 0,
        attentionCount: 0,
      };
      entry.tenantCount += 1;
      const status = sub?.status ?? SubscriptionStatus.INACTIVE;
      if (status === SubscriptionStatus.ACTIVE) entry.activeCount += 1;
      if (status === SubscriptionStatus.TRIALING) entry.trialCount += 1;
      if (
        status === SubscriptionStatus.PAST_DUE ||
        status === SubscriptionStatus.INACTIVE ||
        tenant.status === TenantStatus.SUSPENDED
      ) {
        entry.attentionCount += 1;
      }
      planMixMap.set(planKey, entry);

      if (status === SubscriptionStatus.TRIALING) currentlyTrialing += 1;
      if (sub && sub.updatedAt >= range.start && sub.updatedAt <= range.end) {
        if (status === SubscriptionStatus.ACTIVE) convertedInRange += 1;
        else if (status === SubscriptionStatus.INACTIVE) expiredInRange += 1;
        else if (status === SubscriptionStatus.CANCELED) canceledInRange += 1;
      }
    }

    // Churn / expansion / downgrade series from BillingActionRequest
    const churnSeries: Array<{
      date: string;
      canceled: number;
      downgrades: number;
      expansions: number;
    }> = range.buckets.map((b) => ({
      date: b.toISOString(),
      canceled: 0,
      downgrades: 0,
      expansions: 0,
    }));
    const churnIndex = new Map(
      churnSeries.map((entry) => [entry.date.slice(0, 10), entry]),
    );

    const planRank = (key: string | null): number => {
      if (!key) return 0;
      const order = ["free", "starter_stay", "boutique_growth", "portfolio"];
      const idx = order.indexOf(key);
      return idx >= 0 ? idx : 0;
    };

    for (const action of billingActions) {
      if (!action.executedAt) continue;
      const key = action.executedAt.toISOString().slice(0, 10);
      const bucket = churnIndex.get(key);
      if (!bucket) continue;
      if (action.type === BillingActionType.CANCEL_AT_PERIOD_END) {
        bucket.canceled += 1;
        continue;
      }
      if (action.type === BillingActionType.CHANGE_PLAN) {
        const before = (action.beforeSnapshot as { planKey?: string } | null)
          ?.planKey;
        const after = (action.afterSnapshot as { planKey?: string } | null)
          ?.planKey;
        const beforeRank = planRank(before ?? null);
        const afterRank = planRank(after ?? null);
        if (afterRank > beforeRank) bucket.expansions += 1;
        else if (afterRank < beforeRank) bucket.downgrades += 1;
      }
    }

    // Payment failures series
    const failureSeries = this.newEmptySeries(range);
    this.accumulateInto(
      failureSeries,
      paymentFailures.map((row) => row.occurredAt),
    );

    // Revenue series + currency selection
    const revenueSeries = range.buckets.map((b) => ({
      date: b.toISOString(),
      amount: 0,
    }));
    const revenueIndex = new Map(
      revenueSeries.map((entry) => [entry.date.slice(0, 10), entry]),
    );
    const currencyCounts = new Map<string, number>();
    let paidLast30Days = 0;
    for (const invoice of paidInvoices) {
      paidLast30Days += invoice.amountPaid;
      const currency = invoice.currency?.toLowerCase() ?? "usd";
      currencyCounts.set(currency, (currencyCounts.get(currency) ?? 0) + 1);
      if (!invoice.providerCreatedAt) continue;
      const key = invoice.providerCreatedAt.toISOString().slice(0, 10);
      const bucket = revenueIndex.get(key);
      if (bucket) bucket.amount += invoice.amountPaid;
    }
    const primaryCurrency =
      Array.from(currencyCounts.entries()).sort(
        (a, b) => b[1] - a[1],
      )[0]?.[0] ?? null;

    // Support volume by plan
    const supportByPlanMap = new Map<
      string,
      {
        planKey: string;
        planName: string;
        caseCount: number;
        openCases: number;
      }
    >();
    for (const row of supportByPlanRows) {
      const planKey = row.tenant.subscriptions[0]?.planKey ?? "free";
      const planName = isBillingPlanKey(planKey)
        ? BILLING_PLANS[planKey].name
        : planKey;
      const entry = supportByPlanMap.get(planKey) ?? {
        planKey,
        planName,
        caseCount: 0,
        openCases: 0,
      };
      entry.caseCount += 1;
      if (
        row.status === SupportCaseStatus.OPEN ||
        row.status === SupportCaseStatus.PENDING_CUSTOMER ||
        row.status === SupportCaseStatus.PENDING_INTERNAL
      ) {
        entry.openCases += 1;
      }
      supportByPlanMap.set(planKey, entry);
    }

    return {
      generatedAt: now.toISOString(),
      range: {
        days: range.days,
        start: range.start.toISOString(),
        end: range.end.toISOString(),
      },
      tenants: {
        total: tenantScorecard.total,
        active: tenantScorecard.active,
        suspended: tenantScorecard.suspended,
        archived: tenantScorecard.archived,
        newInRange: tenantScorecard.newInRange,
        newSeries: newSeries.map((b) => ({
          date: b.bucketStartIso,
          count: b.count,
        })),
      },
      planMix: Array.from(planMixMap.values()).sort(
        (a, b) => b.tenantCount - a.tenantCount,
      ),
      trialFunnel: {
        currentlyTrialing,
        convertedInRange,
        expiredInRange,
        canceledInRange,
        conversionRate:
          convertedInRange + expiredInRange + canceledInRange > 0
            ? Math.round(
                (convertedInRange /
                  (convertedInRange + expiredInRange + canceledInRange)) *
                  100,
              )
            : null,
      },
      churnSeries,
      paymentFailures: {
        totalFailedInRange: paymentFailures.length,
        series: failureSeries.map((b) => ({
          date: b.bucketStartIso,
          count: b.count,
        })),
      },
      revenue: {
        currency: primaryCurrency,
        paidLast30Days,
        paidPreviousRange: previousPaidAgg._sum.amountPaid ?? 0,
        outstanding: outstandingAgg._sum.amountRemaining ?? 0,
        atRisk: new Set(atRisk.map((s) => s.tenantId)).size,
        lastInvoiceSyncedAt: lastInvoiceSynced?.syncedAt?.toISOString() ?? null,
        series: revenueSeries,
      },
      supportVolumeByPlan: Array.from(supportByPlanMap.values()).sort(
        (a, b) => b.caseCount - a.caseCount,
      ),
    };
  }

  // ─── Support analytics ────────────────────────────────────────────

  async getSupportAnalytics(days: AnalyticsRangeDays): Promise<{
    generatedAt: string;
    range: { days: number; start: string; end: string };
    openByPriority: Array<{ priority: SupportCasePriority; count: number }>;
    byCategory: Array<{ category: SupportCaseCategory; count: number }>;
    firstResponse: {
      averageMinutes: number | null;
      p50Minutes: number | null;
      p95Minutes: number | null;
      sample: number;
    };
    resolution: {
      averageMinutes: number | null;
      p50Minutes: number | null;
      p95Minutes: number | null;
      sample: number;
    };
    slaBreaches: {
      firstResponse: number;
      resolution: number;
      totalCreatedInRange: number;
      breachRate: number | null;
    };
    reopen: {
      reopenedInRange: number;
      resolvedInRange: number;
      reopenRate: number | null;
    };
    createdFromAlerts: number;
    handoffsToBilling: number;
    operatorWorkload: Array<{
      operatorId: string | null;
      operatorEmail: string | null;
      openCount: number;
      resolvedInRange: number;
      averageResolutionMinutes: number | null;
    }>;
    volumeSeries: Array<{
      date: string;
      created: number;
      resolved: number;
    }>;
  }> {
    const now = new Date();
    const range = this.buildRange(days, now);

    const [
      openByPriorityRaw,
      byCategoryRaw,
      resolvedCases,
      createdCasesMeta,
      createdCases,
      reopenEvents,
      handoffsToBillingCount,
      workloadAggregates,
    ] = await Promise.all([
      this.prisma.supportCase.groupBy({
        by: ["priority"],
        where: {
          status: {
            in: [
              SupportCaseStatus.OPEN,
              SupportCaseStatus.PENDING_CUSTOMER,
              SupportCaseStatus.PENDING_INTERNAL,
            ],
          },
        },
        _count: { _all: true },
      }),
      this.prisma.supportCase.groupBy({
        by: ["category"],
        where: { createdAt: { gte: range.start, lte: range.end } },
        _count: { _all: true },
      }),
      this.prisma.supportCase.findMany({
        where: {
          createdAt: { gte: range.start, lte: range.end },
          firstResponseAt: { not: null },
        },
        select: {
          createdAt: true,
          firstResponseAt: true,
          resolvedAt: true,
          slaBreachedFirstResponse: true,
          slaBreachedResolution: true,
        },
      }),
      this.prisma.supportCase.count({
        where: { createdAt: { gte: range.start, lte: range.end } },
      }),
      this.prisma.supportCase.findMany({
        where: { createdAt: { gte: range.start, lte: range.end } },
        select: {
          createdAt: true,
          resolvedAt: true,
          channel: true,
          slaBreachedFirstResponse: true,
          slaBreachedResolution: true,
        },
      }),
      this.prisma.supportCaseEvent.count({
        where: {
          type: SupportCaseEventType.REOPENED,
          createdAt: { gte: range.start, lte: range.end },
        },
      }),
      this.prisma.supportCaseHandoff.count({
        where: {
          target: "BILLING",
          createdAt: { gte: range.start, lte: range.end },
        },
      }),
      this.prisma.supportCase.findMany({
        where: {
          OR: [
            {
              status: {
                in: [
                  SupportCaseStatus.OPEN,
                  SupportCaseStatus.PENDING_CUSTOMER,
                  SupportCaseStatus.PENDING_INTERNAL,
                ],
              },
            },
            {
              resolvedAt: { gte: range.start, lte: range.end },
            },
          ],
          assignedOperatorId: { not: null },
        },
        select: {
          assignedOperatorId: true,
          assignedOperator: { select: { email: true } },
          status: true,
          createdAt: true,
          resolvedAt: true,
        },
      }),
    ]);

    // First response & resolution distributions
    const firstResponseMinutes: number[] = [];
    const resolutionMinutes: number[] = [];
    let slaBreachFirst = 0;
    let slaBreachResolution = 0;
    let resolvedInRange = 0;
    let createdFromAlerts = 0;

    for (const supportCase of createdCases) {
      if (supportCase.channel === SupportCaseChannel.SYSTEM_ALERT) {
        createdFromAlerts += 1;
      }
      if (supportCase.slaBreachedFirstResponse) slaBreachFirst += 1;
      if (supportCase.slaBreachedResolution) slaBreachResolution += 1;
    }

    for (const supportCase of resolvedCases) {
      if (supportCase.firstResponseAt) {
        const diffMs =
          supportCase.firstResponseAt.getTime() -
          supportCase.createdAt.getTime();
        if (diffMs >= 0) {
          firstResponseMinutes.push(diffMs / 60000);
        }
      }
      if (
        supportCase.resolvedAt &&
        supportCase.resolvedAt >= range.start &&
        supportCase.resolvedAt <= range.end
      ) {
        const diffMs =
          supportCase.resolvedAt.getTime() - supportCase.createdAt.getTime();
        if (diffMs >= 0) {
          resolutionMinutes.push(diffMs / 60000);
        }
        resolvedInRange += 1;
      }
    }
    firstResponseMinutes.sort((a, b) => a - b);
    resolutionMinutes.sort((a, b) => a - b);

    // Workload per operator (limit to top 20 by activity to keep payload bounded)
    const workloadMap = new Map<
      string,
      {
        operatorId: string;
        operatorEmail: string | null;
        openCount: number;
        resolvedInRange: number;
        resolutionMinutes: number[];
      }
    >();
    for (const row of workloadAggregates) {
      if (!row.assignedOperatorId) continue;
      const entry = workloadMap.get(row.assignedOperatorId) ?? {
        operatorId: row.assignedOperatorId,
        operatorEmail: row.assignedOperator?.email ?? null,
        openCount: 0,
        resolvedInRange: 0,
        resolutionMinutes: [],
      };
      if (
        row.status === SupportCaseStatus.OPEN ||
        row.status === SupportCaseStatus.PENDING_CUSTOMER ||
        row.status === SupportCaseStatus.PENDING_INTERNAL
      ) {
        entry.openCount += 1;
      }
      if (
        row.resolvedAt &&
        row.resolvedAt >= range.start &&
        row.resolvedAt <= range.end
      ) {
        entry.resolvedInRange += 1;
        const diffMs = row.resolvedAt.getTime() - row.createdAt.getTime();
        if (diffMs >= 0) entry.resolutionMinutes.push(diffMs / 60000);
      }
      workloadMap.set(row.assignedOperatorId, entry);
    }

    const operatorWorkload = Array.from(workloadMap.values())
      .map((entry) => ({
        operatorId: entry.operatorId,
        operatorEmail: entry.operatorEmail,
        openCount: entry.openCount,
        resolvedInRange: entry.resolvedInRange,
        averageResolutionMinutes: this.average(entry.resolutionMinutes),
      }))
      .sort(
        (a, b) =>
          b.openCount + b.resolvedInRange - (a.openCount + a.resolvedInRange),
      )
      .slice(0, 20);

    // Volume series: cases created vs resolved per day
    const createdBuckets = this.newEmptySeries(range);
    const resolvedBuckets = this.newEmptySeries(range);
    this.accumulateInto(
      createdBuckets,
      createdCases.map((c) => c.createdAt),
    );
    this.accumulateInto(
      resolvedBuckets,
      resolvedCases
        .filter(
          (c) =>
            c.resolvedAt &&
            c.resolvedAt >= range.start &&
            c.resolvedAt <= range.end,
        )
        .map((c) => c.resolvedAt as Date),
    );
    const volumeSeries = createdBuckets.map((b, idx) => ({
      date: b.bucketStartIso,
      created: b.count,
      resolved: resolvedBuckets[idx].count,
    }));

    return {
      generatedAt: now.toISOString(),
      range: {
        days: range.days,
        start: range.start.toISOString(),
        end: range.end.toISOString(),
      },
      openByPriority: openByPriorityRaw
        .map((row) => ({
          priority: row.priority,
          count: row._count._all,
        }))
        .sort((a, b) => b.count - a.count),
      byCategory: byCategoryRaw
        .map((row) => ({
          category: row.category,
          count: row._count._all,
        }))
        .sort((a, b) => b.count - a.count),
      firstResponse: {
        averageMinutes: this.average(firstResponseMinutes),
        p50Minutes: this.percentile(firstResponseMinutes, 50),
        p95Minutes: this.percentile(firstResponseMinutes, 95),
        sample: firstResponseMinutes.length,
      },
      resolution: {
        averageMinutes: this.average(resolutionMinutes),
        p50Minutes: this.percentile(resolutionMinutes, 50),
        p95Minutes: this.percentile(resolutionMinutes, 95),
        sample: resolutionMinutes.length,
      },
      slaBreaches: {
        firstResponse: slaBreachFirst,
        resolution: slaBreachResolution,
        totalCreatedInRange: createdCasesMeta,
        breachRate:
          createdCasesMeta > 0
            ? Math.round(
                ((slaBreachFirst + slaBreachResolution) /
                  (createdCasesMeta * 2)) *
                  100,
              )
            : null,
      },
      reopen: {
        reopenedInRange: reopenEvents,
        resolvedInRange,
        reopenRate:
          resolvedInRange > 0
            ? Math.round((reopenEvents / resolvedInRange) * 100)
            : null,
      },
      createdFromAlerts,
      handoffsToBilling: handoffsToBillingCount,
      operatorWorkload,
      volumeSeries,
    };
  }

  // ─── Operations analytics ─────────────────────────────────────────

  async getOperationsAnalytics(days: AnalyticsRangeDays): Promise<{
    generatedAt: string;
    range: { days: number; start: string; end: string };
    deployments: {
      totalInRange: number;
      successCount: number;
      failureCount: number;
      successRate: number | null;
      durationMs: {
        averageMs: number | null;
        p50Ms: number | null;
        p95Ms: number | null;
        sample: number;
      };
      series: Array<{ date: string; success: number; failure: number }>;
    };
    domains: {
      total: number;
      active: number;
      sslProvisioning: number;
      pending: number;
      failed: number;
      verificationSuccessRate: number | null;
    };
    forms: {
      totalSubmissionsInRange: number;
      spamCount: number;
      spamRatio: number | null;
      deliverySuccessRate: number | null;
      failedDeliveries: number;
      submissionSeries: Array<{ date: string; received: number; spam: number }>;
      deliverySeries: Array<{
        date: string;
        delivered: number;
        failed: number;
      }>;
    };
    alerts: {
      openCritical: number;
      openWarning: number;
      openByType: Array<{ type: string; count: number }>;
      newInRangeSeries: Array<{ date: string; count: number }>;
    };
    seo: {
      runsInRange: number;
      successRate: number | null;
      alertsCreatedInRange: number;
      criticalIssuesInRange: number;
      averageScore: number | null;
    };
    translations: {
      jobsInRange: number;
      completed: number;
      failed: number;
      averageCharactersPerJob: number | null;
    };
  }> {
    const now = new Date();
    const range = this.buildRange(days, now);

    const [
      deployments,
      domainCounts,
      submissions,
      deliveries,
      openAlerts,
      newAlerts,
      seoRuns,
      translationJobs,
    ] = await Promise.all([
      this.prisma.deployment.findMany({
        where: { createdAt: { gte: range.start, lte: range.end } },
        select: {
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.domain.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
      this.prisma.formSubmission.findMany({
        where: { createdAt: { gte: range.start, lte: range.end } },
        select: { createdAt: true, status: true, spamScore: true },
      }),
      this.prisma.formDelivery.findMany({
        where: { createdAt: { gte: range.start, lte: range.end } },
        select: { createdAt: true, status: true },
      }),
      this.prisma.operationalAlert.groupBy({
        by: ["type", "severity"],
        where: { status: OperationalAlertStatus.OPEN },
        _count: { _all: true },
      }),
      this.prisma.operationalAlert.findMany({
        where: {
          firstTriggeredAt: { gte: range.start, lte: range.end },
        },
        select: { firstTriggeredAt: true },
      }),
      this.prisma.seoAuditRun.findMany({
        where: { startedAt: { gte: range.start, lte: range.end } },
        select: {
          status: true,
          alertsCreated: true,
          averageScore: true,
        },
      }),
      this.prisma.translationJob.findMany({
        where: { createdAt: { gte: range.start, lte: range.end } },
        select: {
          status: true,
          charactersUsed: true,
        },
      }),
    ]);

    // Deployments
    const successStatuses = new Set<DeploymentStatus>([DeploymentStatus.LIVE]);
    const failureStatuses = new Set<DeploymentStatus>([
      DeploymentStatus.FAILED,
    ]);
    const durations: number[] = [];
    let success = 0;
    let failure = 0;
    const successBuckets = this.newEmptySeries(range);
    const failureBuckets = this.newEmptySeries(range);
    const successIdx = new Map(successBuckets.map((b) => [b.bucketKey, b]));
    const failureIdx = new Map(failureBuckets.map((b) => [b.bucketKey, b]));
    for (const d of deployments) {
      const key = d.createdAt.toISOString().slice(0, 10);
      if (successStatuses.has(d.status)) {
        success += 1;
        const bucket = successIdx.get(key);
        if (bucket) bucket.count += 1;
        const diff = d.updatedAt.getTime() - d.createdAt.getTime();
        if (diff > 0 && diff < 60 * 60 * 1000) durations.push(diff);
      } else if (failureStatuses.has(d.status)) {
        failure += 1;
        const bucket = failureIdx.get(key);
        if (bucket) bucket.count += 1;
      }
    }
    durations.sort((a, b) => a - b);
    const totalDeployments = deployments.length;

    // Domains
    let activeDomains = 0;
    let sslDomains = 0;
    let pendingDomains = 0;
    let failedDomains = 0;
    for (const row of domainCounts) {
      const count = row._count._all;
      if (row.status === DomainStatus.ACTIVE) activeDomains += count;
      else if (row.status === DomainStatus.SSL_PROVISIONING)
        sslDomains += count;
      else if (row.status === DomainStatus.FAILED) failedDomains += count;
      else pendingDomains += count;
    }
    const verifiableDomains = activeDomains + failedDomains;
    const verificationSuccessRate =
      verifiableDomains > 0
        ? Math.round((activeDomains / verifiableDomains) * 100)
        : null;

    // Forms
    const submissionBuckets = this.newEmptySeries(range);
    const spamBuckets = this.newEmptySeries(range);
    const submissionIdx = new Map(
      submissionBuckets.map((b) => [b.bucketKey, b]),
    );
    const spamIdx = new Map(spamBuckets.map((b) => [b.bucketKey, b]));
    let spamCount = 0;
    for (const sub of submissions) {
      const key = sub.createdAt.toISOString().slice(0, 10);
      const bucket = submissionIdx.get(key);
      if (bucket) bucket.count += 1;
      if (sub.status === FormSubmissionStatus.SPAM) {
        spamCount += 1;
        const sBucket = spamIdx.get(key);
        if (sBucket) sBucket.count += 1;
      }
    }
    const submissionSeries = submissionBuckets.map((b, idx) => ({
      date: b.bucketStartIso,
      received: b.count,
      spam: spamBuckets[idx].count,
    }));

    const deliveredBuckets = this.newEmptySeries(range);
    const failedDeliveryBuckets = this.newEmptySeries(range);
    const deliveredIdx = new Map(deliveredBuckets.map((b) => [b.bucketKey, b]));
    const failedDeliveryIdx = new Map(
      failedDeliveryBuckets.map((b) => [b.bucketKey, b]),
    );
    let deliveredCount = 0;
    let failedDeliveries = 0;
    let attemptedDeliveries = 0;
    for (const d of deliveries) {
      const key = d.createdAt.toISOString().slice(0, 10);
      if (d.status === FormDeliveryStatus.DELIVERED) {
        deliveredCount += 1;
        attemptedDeliveries += 1;
        const bucket = deliveredIdx.get(key);
        if (bucket) bucket.count += 1;
      } else if (d.status === FormDeliveryStatus.FAILED) {
        failedDeliveries += 1;
        attemptedDeliveries += 1;
        const bucket = failedDeliveryIdx.get(key);
        if (bucket) bucket.count += 1;
      }
    }
    const deliverySeries = deliveredBuckets.map((b, idx) => ({
      date: b.bucketStartIso,
      delivered: b.count,
      failed: failedDeliveryBuckets[idx].count,
    }));

    // Alerts
    let openCritical = 0;
    let openWarning = 0;
    const byTypeMap = new Map<string, number>();
    for (const row of openAlerts) {
      const count = row._count._all;
      if (row.severity === OperationalAlertSeverity.CRITICAL)
        openCritical += count;
      else openWarning += count;
      byTypeMap.set(row.type, (byTypeMap.get(row.type) ?? 0) + count);
    }
    const alertSeries = this.newEmptySeries(range);
    this.accumulateInto(
      alertSeries,
      newAlerts.map((a) => a.firstTriggeredAt),
    );

    // SEO
    let seoSuccess = 0;
    let seoFailures = 0;
    let alertsCreated = 0;
    const seoScores: number[] = [];
    for (const run of seoRuns) {
      if (run.status === "SUCCESS" || run.status === "PARTIAL") seoSuccess += 1;
      else if (run.status === "FAILED") seoFailures += 1;
      alertsCreated += run.alertsCreated;
      if (run.averageScore != null) seoScores.push(run.averageScore);
    }
    const seoTotal = seoSuccess + seoFailures;

    // Translations
    let translationCompleted = 0;
    let translationFailed = 0;
    let translationCharacterSum = 0;
    let translationCharacterSamples = 0;
    for (const job of translationJobs) {
      if (job.status === "COMPLETED") translationCompleted += 1;
      else if (job.status === "FAILED") translationFailed += 1;
      if (job.charactersUsed > 0) {
        translationCharacterSum += job.charactersUsed;
        translationCharacterSamples += 1;
      }
    }

    return {
      generatedAt: now.toISOString(),
      range: {
        days: range.days,
        start: range.start.toISOString(),
        end: range.end.toISOString(),
      },
      deployments: {
        totalInRange: totalDeployments,
        successCount: success,
        failureCount: failure,
        successRate:
          success + failure > 0
            ? Math.round((success / (success + failure)) * 100)
            : null,
        durationMs: {
          averageMs: this.average(durations),
          p50Ms: this.percentile(durations, 50),
          p95Ms: this.percentile(durations, 95),
          sample: durations.length,
        },
        series: successBuckets.map((b, idx) => ({
          date: b.bucketStartIso,
          success: b.count,
          failure: failureBuckets[idx].count,
        })),
      },
      domains: {
        total: activeDomains + sslDomains + pendingDomains + failedDomains,
        active: activeDomains,
        sslProvisioning: sslDomains,
        pending: pendingDomains,
        failed: failedDomains,
        verificationSuccessRate,
      },
      forms: {
        totalSubmissionsInRange: submissions.length,
        spamCount,
        spamRatio:
          submissions.length > 0
            ? Math.round((spamCount / submissions.length) * 100)
            : null,
        deliverySuccessRate:
          attemptedDeliveries > 0
            ? Math.round((deliveredCount / attemptedDeliveries) * 100)
            : null,
        failedDeliveries,
        submissionSeries,
        deliverySeries,
      },
      alerts: {
        openCritical,
        openWarning,
        openByType: Array.from(byTypeMap.entries())
          .map(([type, count]) => ({ type, count }))
          .sort((a, b) => b.count - a.count),
        newInRangeSeries: alertSeries.map((b) => ({
          date: b.bucketStartIso,
          count: b.count,
        })),
      },
      seo: {
        runsInRange: seoRuns.length,
        successRate:
          seoTotal > 0 ? Math.round((seoSuccess / seoTotal) * 100) : null,
        alertsCreatedInRange: alertsCreated,
        criticalIssuesInRange: 0,
        averageScore: this.average(seoScores),
      },
      translations: {
        jobsInRange: translationJobs.length,
        completed: translationCompleted,
        failed: translationFailed,
        averageCharactersPerJob:
          translationCharacterSamples > 0
            ? Math.round(translationCharacterSum / translationCharacterSamples)
            : null,
      },
    };
  }

  // ─── Tenant health ────────────────────────────────────────────────

  async getTenantHealth(params: {
    page: number;
    limit: number;
    minScore?: number;
    maxScore?: number;
    sort?: "score" | "name";
    direction?: "asc" | "desc";
  }): Promise<{
    generatedAt: string;
    data: Array<{
      tenantId: string;
      tenantName: string;
      tenantStatus: TenantStatus;
      planKey: string;
      planName: string;
      subscriptionStatus: SubscriptionStatus;
      healthScore: number;
      bucket: "healthy" | "watch" | "needs_support" | "critical";
      siteCount: number;
      liveSites: number;
      failedSites: number;
      openAlerts: number;
      openSupportCases: number;
      pastDue: boolean;
      reasons: string[];
    }>;
    total: number;
    page: number;
    limit: number;
    distribution: {
      healthy: number;
      watch: number;
      needsSupport: number;
      critical: number;
    };
  }> {
    const now = new Date();
    const page = Math.max(1, params.page);
    const limit = Math.max(1, Math.min(100, params.limit));

    // Load every tenant with the same heavy projection used by the
    // command-center health score. We cap the page server-side and only
    // return the requested slice (after computing scores for every tenant
    // so the distribution histogram is accurate).
    const tenants = await this.prisma.tenant.findMany({
      select: {
        id: true,
        name: true,
        status: true,
        subscriptions: {
          orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
          take: 1,
          select: {
            planKey: true,
            status: true,
            gracePeriodEndsAt: true,
          },
        },
        sites: {
          where: { status: { not: SiteStatus.ARCHIVED } },
          select: {
            id: true,
            deployments: {
              orderBy: [{ createdAt: "desc" }],
              take: 1,
              select: { status: true },
            },
            domains: {
              select: { status: true, isPrimary: true },
            },
            alerts: {
              where: { status: OperationalAlertStatus.OPEN },
              select: { severity: true },
            },
          },
        },
        supportCases: {
          where: {
            status: {
              in: [
                SupportCaseStatus.OPEN,
                SupportCaseStatus.PENDING_CUSTOMER,
                SupportCaseStatus.PENDING_INTERNAL,
              ],
            },
          },
          select: { id: true },
        },
      },
    });

    const distribution = { healthy: 0, watch: 0, needsSupport: 0, critical: 0 };
    type Row = {
      tenantId: string;
      tenantName: string;
      tenantStatus: TenantStatus;
      planKey: string;
      planName: string;
      subscriptionStatus: SubscriptionStatus;
      healthScore: number;
      bucket: "healthy" | "watch" | "needs_support" | "critical";
      siteCount: number;
      liveSites: number;
      failedSites: number;
      openAlerts: number;
      openSupportCases: number;
      pastDue: boolean;
      reasons: string[];
    };

    const rows: Row[] = tenants.map((tenant) => {
      const sub = tenant.subscriptions[0] ?? null;
      const planKey = sub?.planKey ?? "free";
      const planName = isBillingPlanKey(planKey)
        ? BILLING_PLANS[planKey].name
        : planKey;
      const subscriptionStatus = sub?.status ?? SubscriptionStatus.INACTIVE;

      let liveSites = 0;
      let failedSites = 0;
      let openAlerts = 0;
      let criticalAlerts = 0;
      let sitesMissingPrimary = 0;

      for (const site of tenant.sites) {
        const latest = site.deployments[0];
        if (latest?.status === DeploymentStatus.LIVE) liveSites += 1;
        if (latest?.status === DeploymentStatus.FAILED) failedSites += 1;
        const primary = site.domains.find(
          (d) => d.isPrimary && d.status === DomainStatus.ACTIVE,
        );
        if (!primary) sitesMissingPrimary += 1;
        for (const alert of site.alerts) {
          openAlerts += 1;
          if (alert.severity === OperationalAlertSeverity.CRITICAL)
            criticalAlerts += 1;
        }
      }

      const reasons: string[] = [];
      let score = 100;
      if (tenant.status === TenantStatus.SUSPENDED) {
        score -= 50;
        reasons.push("Workspace is suspended");
      }
      if (
        subscriptionStatus === SubscriptionStatus.PAST_DUE ||
        subscriptionStatus === SubscriptionStatus.INACTIVE
      ) {
        score -= 30;
        reasons.push(
          subscriptionStatus === SubscriptionStatus.PAST_DUE
            ? "Billing is past due"
            : "No active subscription",
        );
      }
      if (failedSites > 0) {
        score -= Math.min(20, failedSites * 10);
        reasons.push(
          `${failedSites} failed deployment${failedSites === 1 ? "" : "s"}`,
        );
      }
      if (sitesMissingPrimary > 0) {
        score -= Math.min(15, sitesMissingPrimary * 5);
        reasons.push("Primary domain missing or unverified");
      }
      if (criticalAlerts > 0) {
        score -= Math.min(25, criticalAlerts * 10);
        reasons.push(
          `${criticalAlerts} critical alert${criticalAlerts === 1 ? "" : "s"}`,
        );
      } else if (openAlerts > 0) {
        score -= Math.min(10, openAlerts * 2);
        reasons.push("Open operational alerts");
      }
      if (tenant.supportCases.length > 0) {
        score -= Math.min(10, tenant.supportCases.length * 2);
        reasons.push(
          `${tenant.supportCases.length} open support case${tenant.supportCases.length === 1 ? "" : "s"}`,
        );
      }
      score = Math.max(0, Math.min(100, score));

      let bucket: Row["bucket"];
      if (score >= 90) {
        bucket = "healthy";
        distribution.healthy += 1;
      } else if (score >= 70) {
        bucket = "watch";
        distribution.watch += 1;
      } else if (score >= 40) {
        bucket = "needs_support";
        distribution.needsSupport += 1;
      } else {
        bucket = "critical";
        distribution.critical += 1;
      }

      return {
        tenantId: tenant.id,
        tenantName: tenant.name,
        tenantStatus: tenant.status,
        planKey,
        planName,
        subscriptionStatus,
        healthScore: score,
        bucket,
        siteCount: tenant.sites.length,
        liveSites,
        failedSites,
        openAlerts,
        openSupportCases: tenant.supportCases.length,
        pastDue: subscriptionStatus === SubscriptionStatus.PAST_DUE,
        reasons,
      };
    });

    let filtered = rows;
    if (params.minScore != null) {
      const minScore = params.minScore;
      filtered = filtered.filter((r) => r.healthScore >= minScore);
    }
    if (params.maxScore != null) {
      const maxScore = params.maxScore;
      filtered = filtered.filter((r) => r.healthScore <= maxScore);
    }

    const sortKey = params.sort ?? "score";
    const direction = params.direction ?? (sortKey === "name" ? "asc" : "asc");
    filtered.sort((a, b) => {
      if (sortKey === "name") {
        return direction === "asc"
          ? a.tenantName.localeCompare(b.tenantName)
          : b.tenantName.localeCompare(a.tenantName);
      }
      return direction === "desc"
        ? b.healthScore - a.healthScore
        : a.healthScore - b.healthScore;
    });

    const total = filtered.length;
    const data = filtered.slice((page - 1) * limit, page * limit);

    return {
      generatedAt: now.toISOString(),
      data,
      total,
      page,
      limit,
      distribution,
    };
  }

  // ─── Observability ────────────────────────────────────────────────

  async getObservability(): Promise<{
    generatedAt: string;
    database: {
      reachable: boolean;
      latencyMs: number | null;
    };
    billingWebhooks: {
      provider: string;
      processedLast24h: number;
      pendingLast24h: number;
      failedLast24h: number;
      lastProcessedAt: string | null;
      lastFailureAt: string | null;
      lastFailureType: string | null;
    };
    invoiceSync: {
      lastSyncAt: string | null;
      lastSyncStaleMinutes: number | null;
    };
    deploymentProvider: {
      providers: Array<{
        provider: string;
        liveCount: number;
        failedLast24h: number;
        lastFailureAt: string | null;
      }>;
    };
    formDelivery: {
      pendingTotal: number;
      failedLast24h: number;
      successLast24h: number;
    };
    operationalAlerts: {
      openCritical: number;
      openWarning: number;
      oldestOpenAt: string | null;
    };
    auditLog: {
      eventsLast24h: number;
      lastEventAt: string | null;
    };
  }> {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    let reachable = true;
    let latencyMs: number | null = null;
    try {
      const start = Date.now();
      await this.prisma.$queryRaw<Array<{ ok: number }>>(
        Prisma.sql`SELECT 1 AS ok`,
      );
      latencyMs = Date.now() - start;
    } catch {
      reachable = false;
    }

    const [
      webhooksProcessed,
      webhooksPending,
      webhooksFailedRows,
      lastProcessed,
      lastFailure,
      lastInvoiceSync,
      deploymentLive,
      deploymentFailures,
      formDeliveryPending,
      formDeliveryFailed,
      formDeliverySuccess,
      openAlertsBySeverity,
      oldestOpenAlert,
      auditEventsCount,
      lastAuditEvent,
    ] = await Promise.all([
      this.prisma.billingWebhookEvent.count({
        where: {
          createdAt: { gte: twentyFourHoursAgo },
          processedAt: { not: null },
          errorMessage: null,
        },
      }),
      this.prisma.billingWebhookEvent.count({
        where: {
          createdAt: { gte: twentyFourHoursAgo },
          processedAt: null,
        },
      }),
      this.prisma.billingWebhookEvent.findMany({
        where: {
          createdAt: { gte: twentyFourHoursAgo },
          errorMessage: { not: null },
        },
        select: { eventType: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      }),
      this.prisma.billingWebhookEvent.findFirst({
        where: { processedAt: { not: null } },
        orderBy: { processedAt: "desc" },
        select: { processedAt: true, provider: true },
      }),
      this.prisma.billingWebhookEvent.findFirst({
        where: { errorMessage: { not: null } },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true, eventType: true, provider: true },
      }),
      this.prisma.billingInvoiceSnapshot.findFirst({
        orderBy: { syncedAt: "desc" },
        select: { syncedAt: true },
      }),
      this.prisma.deployment.groupBy({
        by: ["provider"],
        where: { status: DeploymentStatus.LIVE },
        _count: { _all: true },
      }),
      this.prisma.deployment.findMany({
        where: {
          status: DeploymentStatus.FAILED,
          updatedAt: { gte: twentyFourHoursAgo },
        },
        select: { provider: true, updatedAt: true },
      }),
      this.prisma.formDelivery.count({
        where: { status: FormDeliveryStatus.PENDING },
      }),
      this.prisma.formDelivery.count({
        where: {
          status: FormDeliveryStatus.FAILED,
          updatedAt: { gte: twentyFourHoursAgo },
        },
      }),
      this.prisma.formDelivery.count({
        where: {
          status: FormDeliveryStatus.DELIVERED,
          updatedAt: { gte: twentyFourHoursAgo },
        },
      }),
      this.prisma.operationalAlert.groupBy({
        by: ["severity"],
        where: { status: OperationalAlertStatus.OPEN },
        _count: { _all: true },
      }),
      this.prisma.operationalAlert.findFirst({
        where: { status: OperationalAlertStatus.OPEN },
        orderBy: { firstTriggeredAt: "asc" },
        select: { firstTriggeredAt: true },
      }),
      this.prisma.operatorAuditLog.count({
        where: { createdAt: { gte: twentyFourHoursAgo } },
      }),
      this.prisma.operatorAuditLog.findFirst({
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
    ]);

    // Aggregate deployment provider health.
    const providerMap = new Map<
      string,
      {
        provider: string;
        liveCount: number;
        failedLast24h: number;
        lastFailureAt: string | null;
      }
    >();
    for (const row of deploymentLive) {
      const key = row.provider ?? "unknown";
      const entry = providerMap.get(key) ?? {
        provider: key,
        liveCount: 0,
        failedLast24h: 0,
        lastFailureAt: null,
      };
      entry.liveCount += row._count._all;
      providerMap.set(key, entry);
    }
    for (const f of deploymentFailures) {
      const key = f.provider ?? "unknown";
      const entry = providerMap.get(key) ?? {
        provider: key,
        liveCount: 0,
        failedLast24h: 0,
        lastFailureAt: null,
      };
      entry.failedLast24h += 1;
      const iso = f.updatedAt.toISOString();
      if (!entry.lastFailureAt || iso > entry.lastFailureAt) {
        entry.lastFailureAt = iso;
      }
      providerMap.set(key, entry);
    }

    let openCritical = 0;
    let openWarning = 0;
    for (const row of openAlertsBySeverity) {
      if (row.severity === OperationalAlertSeverity.CRITICAL)
        openCritical += row._count._all;
      else openWarning += row._count._all;
    }

    return {
      generatedAt: now.toISOString(),
      database: { reachable, latencyMs },
      billingWebhooks: {
        provider: lastProcessed?.provider ?? "stripe",
        processedLast24h: webhooksProcessed,
        pendingLast24h: webhooksPending,
        failedLast24h: webhooksFailedRows.length,
        lastProcessedAt: lastProcessed?.processedAt?.toISOString() ?? null,
        lastFailureAt: lastFailure?.createdAt?.toISOString() ?? null,
        lastFailureType: lastFailure?.eventType ?? null,
      },
      invoiceSync: {
        lastSyncAt: lastInvoiceSync?.syncedAt?.toISOString() ?? null,
        lastSyncStaleMinutes: lastInvoiceSync?.syncedAt
          ? Math.floor(
              (now.getTime() - lastInvoiceSync.syncedAt.getTime()) / 60000,
            )
          : null,
      },
      deploymentProvider: {
        providers: Array.from(providerMap.values()).sort(
          (a, b) => b.liveCount - a.liveCount,
        ),
      },
      formDelivery: {
        pendingTotal: formDeliveryPending,
        failedLast24h: formDeliveryFailed,
        successLast24h: formDeliverySuccess,
      },
      operationalAlerts: {
        openCritical,
        openWarning,
        oldestOpenAt: oldestOpenAlert?.firstTriggeredAt?.toISOString() ?? null,
      },
      auditLog: {
        eventsLast24h: auditEventsCount,
        lastEventAt: lastAuditEvent?.createdAt?.toISOString() ?? null,
      },
    };
  }
}
