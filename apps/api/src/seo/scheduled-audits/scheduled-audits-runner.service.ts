import { Injectable, Logger } from "@nestjs/common";
import type { Prisma, SeoAuditRun } from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";
import { AiCitationService } from "../ai-citation/ai-citation.service";
import { SeoAuditTasksService } from "../audit-tasks/audit-tasks.service";
import {
  alertFingerprint,
  diffSnapshot,
  type AuditAlertCandidate,
  type SnapshotMetrics,
} from "./scheduled-audits.helpers";
import { SeoAuditScheduleService } from "./scheduled-audits-schedule.service";

const PAGES_PER_RUN_LIMIT = 200;

export interface RunAuditOptions {
  kind: "SCHEDULED" | "MANUAL";
  triggeredBy?: string;
}

@Injectable()
export class SeoAuditRunnerService {
  private readonly logger = new Logger(SeoAuditRunnerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiCitation: AiCitationService,
    private readonly scheduleService: SeoAuditScheduleService,
    private readonly tasksService: SeoAuditTasksService,
  ) {}

  /**
   * Execute an audit run against every published, non-deleted page for a
   * site. For each page we:
   *   1. Run the AI-citation analyzer (which also persists the latest row).
   *   2. Append a `SeoAuditSnapshot` row for history.
   *   3. Diff against the previous snapshot and upsert an OperationalAlert
   *      when a regression is detected.
   */
  async runAudit(
    siteId: string,
    options: RunAuditOptions,
  ): Promise<SeoAuditRun> {
    const startedAt = new Date();
    const run = await this.prisma.seoAuditRun.create({
      data: {
        siteId,
        kind: options.kind,
        status: "RUNNING",
        startedAt,
        triggeredBy: options.triggeredBy ?? null,
      },
    });

    const pages = await this.prisma.page.findMany({
      where: { siteId, deletedAt: null, published: true },
      select: { slug: true, locale: true },
      take: PAGES_PER_RUN_LIMIT,
      orderBy: [{ slug: "asc" }, { locale: "asc" }],
    });

    let pagesAudited = 0;
    let alertsCreated = 0;
    let totalScore = 0;
    let firstError: string | null = null;
    let failures = 0;

    for (const page of pages) {
      try {
        const result = await this.aiCitation.analyzePage(
          siteId,
          page.slug,
          page.locale,
        );
        const findingsCount = result.findings.length;
        const allowsCitation = result.signals.robots.allowsCitation;

        const previousSnapshot = await this.prisma.seoAuditSnapshot.findFirst({
          where: { siteId, slug: page.slug, locale: page.locale },
          orderBy: { recordedAt: "desc" },
        });

        await this.prisma.seoAuditSnapshot.create({
          data: {
            runId: run.id,
            siteId,
            slug: page.slug,
            locale: page.locale,
            score: result.score,
            grade: result.grade,
            entityFactCount: result.signals.entityFacts.count,
            answerReadyCount: result.signals.answerReady.count,
            findingsCount,
            allowsCitation,
          },
        });

        const currentMetrics: SnapshotMetrics = {
          slug: page.slug,
          locale: page.locale,
          score: result.score,
          allowsCitation,
          findingsCount,
        };
        const previousMetrics: SnapshotMetrics | null = previousSnapshot
          ? {
              slug: previousSnapshot.slug,
              locale: previousSnapshot.locale,
              score: previousSnapshot.score,
              allowsCitation: previousSnapshot.allowsCitation,
              findingsCount: previousSnapshot.findingsCount,
            }
          : null;

        const candidate = diffSnapshot(currentMetrics, previousMetrics);
        if (candidate) {
          await this.upsertAlert(siteId, run.id, candidate);
          alertsCreated += 1;
        }

        pagesAudited += 1;
        totalScore += result.score;
      } catch (err) {
        failures += 1;
        const message = err instanceof Error ? err.message : String(err);
        if (!firstError) firstError = message;
        this.logger.warn(
          `Audit failed for site=${siteId} page=${page.slug}/${page.locale}: ${message}`,
        );
      }
    }

    const finishedAt = new Date();
    const durationMs = finishedAt.getTime() - startedAt.getTime();
    const averageScore =
      pagesAudited > 0 ? Math.round(totalScore / pagesAudited) : null;
    const status =
      failures === 0 ? "SUCCESS" : pagesAudited === 0 ? "FAILED" : "PARTIAL";

    const updated = await this.prisma.seoAuditRun.update({
      where: { id: run.id },
      data: {
        status,
        finishedAt,
        durationMs,
        pagesAudited,
        alertsCreated,
        averageScore,
        error: firstError,
      },
    });

    await this.scheduleService.markRan(siteId, finishedAt).catch(() => null);

    return updated;
  }

  private async upsertAlert(
    siteId: string,
    runId: string,
    candidate: AuditAlertCandidate,
  ): Promise<void> {
    const fingerprint = alertFingerprint(candidate);
    const type =
      candidate.severity === "CRITICAL"
        ? "SEO_AUDIT_CRITICAL"
        : "SEO_AUDIT_REGRESSION";
    const metadata: Prisma.InputJsonValue = {
      runId,
      slug: candidate.slug,
      locale: candidate.locale,
      reason: candidate.reason,
      currentScore: candidate.currentScore,
      previousScore: candidate.previousScore,
    };

    const alert = await this.prisma.operationalAlert.upsert({
      where: {
        siteId_type_fingerprint: { siteId, type, fingerprint },
      },
      create: {
        siteId,
        type,
        severity: candidate.severity,
        status: "OPEN",
        fingerprint,
        message: candidate.message,
        metadata,
      },
      update: {
        message: candidate.message,
        severity: candidate.severity,
        status: "OPEN",
        lastTriggeredAt: new Date(),
        resolvedAt: null,
        metadata,
      },
    });

    // Surface the alert as a triage-ready audit task (Phase E.4). Failures
    // here must not break the run.
    try {
      await this.tasksService.upsertTaskForAlert(alert);
    } catch (err) {
      this.logger.warn(
        `Failed to upsert audit task for alert ${alert.id}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}
