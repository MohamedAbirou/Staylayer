import { Injectable, NotFoundException } from "@nestjs/common";
import type { OperationalAlert, SeoAuditRun } from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";

/** Read-side service for run history, snapshot history, and alerts. */
@Injectable()
export class SeoAuditQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async listRuns(siteId: string, limit = 20): Promise<SeoAuditRun[]> {
    const take = clampLimit(limit, 50);
    return this.prisma.seoAuditRun.findMany({
      where: { siteId },
      orderBy: { startedAt: "desc" },
      take,
    });
  }

  async getRun(siteId: string, runId: string) {
    const run = await this.prisma.seoAuditRun.findFirst({
      where: { id: runId, siteId },
      include: {
        snapshots: {
          orderBy: [{ score: "asc" }, { slug: "asc" }],
        },
      },
    });
    if (!run) throw new NotFoundException("Audit run not found");
    return run;
  }

  async getHistory(siteId: string, slug: string, locale: string, limit = 30) {
    const take = clampLimit(limit, 90);
    const rows = await this.prisma.seoAuditSnapshot.findMany({
      where: { siteId, slug, locale },
      orderBy: { recordedAt: "desc" },
      take,
    });
    // Return oldest → newest so the dashboard sparkline reads left-to-right.
    return rows.reverse();
  }

  async listAlerts(
    siteId: string,
    status: "OPEN" | "RESOLVED" | "ALL" = "OPEN",
  ): Promise<OperationalAlert[]> {
    return this.prisma.operationalAlert.findMany({
      where: {
        siteId,
        type: { in: ["SEO_AUDIT_REGRESSION", "SEO_AUDIT_CRITICAL"] },
        ...(status === "ALL" ? {} : { status }),
      },
      orderBy: [{ severity: "desc" }, { lastTriggeredAt: "desc" }],
      take: 100,
    });
  }

  async dismissAlert(
    siteId: string,
    alertId: string,
  ): Promise<OperationalAlert> {
    const alert = await this.prisma.operationalAlert.findFirst({
      where: { id: alertId, siteId },
    });
    if (!alert) throw new NotFoundException("Alert not found");
    return this.prisma.operationalAlert.update({
      where: { id: alertId },
      data: { status: "RESOLVED", resolvedAt: new Date() },
    });
  }
}

function clampLimit(value: number, max: number): number {
  if (!Number.isFinite(value)) return Math.min(20, max);
  return Math.max(1, Math.min(max, Math.trunc(value)));
}
