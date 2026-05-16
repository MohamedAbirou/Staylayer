import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type {
  OperationalAlert,
  Prisma,
  SeoAuditTask,
  SeoAuditTaskPriority,
  SeoAuditTaskStatus,
} from "@prisma/client";
import { NotificationCategory } from "@prisma/client";

import { TransactionalEmailService } from "../../mail/transactional-email.service";
import { NotificationsService } from "../../notifications/notifications.service";
import { PrismaService } from "../../prisma/prisma.service";
import {
  alertSeverityToPriority,
  buildBulkPatch,
  clampLimit,
  MAX_BULK_TASK_IDS,
  MAX_TASKS_PER_PAGE,
  type BulkAuditTaskAction,
  type BulkAuditTaskPayload,
} from "./audit-tasks.helpers";

export interface ListTasksFilters {
  status?: SeoAuditTaskStatus | "ALL";
  assigneeUserId?: string | null;
  /** When true, only unassigned tasks are returned. */
  unassigned?: boolean;
  priority?: SeoAuditTaskPriority;
  slug?: string;
  locale?: string;
  limit?: number;
}

export interface CreateTaskPayload {
  slug: string;
  locale: string;
  title: string;
  description?: string | null;
  priority?: SeoAuditTaskPriority;
  status?: SeoAuditTaskStatus;
  assigneeUserId?: string | null;
}

export interface UpdateTaskPayload {
  title?: string;
  description?: string | null;
  status?: SeoAuditTaskStatus;
  priority?: SeoAuditTaskPriority;
  assigneeUserId?: string | null;
}

export interface TenantAssigneeDto {
  userId: string;
  email: string;
  role: string;
}

const TASK_INCLUDE = {
  assignee: { select: { id: true, email: true } },
  createdBy: { select: { id: true, email: true } },
  sourceAlert: {
    select: { id: true, severity: true, type: true, status: true },
  },
} satisfies Prisma.SeoAuditTaskInclude;

export type SeoAuditTaskWithRefs = Prisma.SeoAuditTaskGetPayload<{
  include: typeof TASK_INCLUDE;
}>;

@Injectable()
export class SeoAuditTasksService {
  private readonly logger = new Logger(SeoAuditTasksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly transactionalEmailService: TransactionalEmailService,
    private readonly configService: ConfigService,
  ) {}

  // ── Reads ──────────────────────────────────────────────────────────────

  async listTasks(
    siteId: string,
    filters: ListTasksFilters = {},
  ): Promise<SeoAuditTaskWithRefs[]> {
    const where: Prisma.SeoAuditTaskWhereInput = { siteId };
    if (filters.status && filters.status !== "ALL") {
      where.status = filters.status;
    }
    if (filters.unassigned) {
      where.assigneeUserId = null;
    } else if (filters.assigneeUserId !== undefined) {
      where.assigneeUserId = filters.assigneeUserId;
    }
    if (filters.priority) where.priority = filters.priority;
    if (filters.slug) where.slug = filters.slug;
    if (filters.locale) where.locale = filters.locale;

    return this.prisma.seoAuditTask.findMany({
      where,
      include: TASK_INCLUDE,
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      take: clampLimit(filters.limit, MAX_TASKS_PER_PAGE, 50),
    });
  }

  async getTask(siteId: string, taskId: string): Promise<SeoAuditTaskWithRefs> {
    const task = await this.prisma.seoAuditTask.findFirst({
      where: { id: taskId, siteId },
      include: TASK_INCLUDE,
    });
    if (!task) throw new NotFoundException("Audit task not found");
    return task;
  }

  async listAssignees(siteId: string): Promise<TenantAssigneeDto[]> {
    const tenantId = await this.resolveTenantId(siteId);
    const memberships = await this.prisma.tenantMembership.findMany({
      where: { tenantId },
      include: { user: { select: { id: true, email: true } } },
      orderBy: [{ role: "asc" }],
    });
    return memberships.map((m) => ({
      userId: m.user.id,
      email: m.user.email,
      role: m.role,
    }));
  }

  async getSummary(siteId: string): Promise<{
    total: number;
    open: number;
    inProgress: number;
    resolved: number;
    dismissed: number;
    unassigned: number;
    criticalOpen: number;
  }> {
    const grouped = await this.prisma.seoAuditTask.groupBy({
      by: ["status"],
      where: { siteId },
      _count: { _all: true },
    });
    const counts: Record<string, number> = {};
    for (const row of grouped) counts[row.status] = row._count._all;

    const [unassigned, criticalOpen] = await Promise.all([
      this.prisma.seoAuditTask.count({
        where: { siteId, assigneeUserId: null, status: { not: "RESOLVED" } },
      }),
      this.prisma.seoAuditTask.count({
        where: {
          siteId,
          priority: "CRITICAL",
          status: { in: ["OPEN", "IN_PROGRESS"] },
        },
      }),
    ]);

    const total =
      (counts.OPEN ?? 0) +
      (counts.IN_PROGRESS ?? 0) +
      (counts.RESOLVED ?? 0) +
      (counts.DISMISSED ?? 0);

    return {
      total,
      open: counts.OPEN ?? 0,
      inProgress: counts.IN_PROGRESS ?? 0,
      resolved: counts.RESOLVED ?? 0,
      dismissed: counts.DISMISSED ?? 0,
      unassigned,
      criticalOpen,
    };
  }

  // ── Writes ─────────────────────────────────────────────────────────────

  async createTask(
    siteId: string,
    createdByUserId: string | null,
    payload: CreateTaskPayload,
  ): Promise<SeoAuditTaskWithRefs> {
    const title = payload.title?.trim();
    const slug = payload.slug?.trim();
    const locale = payload.locale?.trim();
    if (!title) throw new BadRequestException("title is required");
    if (!slug) throw new BadRequestException("slug is required");
    if (!locale) throw new BadRequestException("locale is required");

    if (payload.assigneeUserId) {
      await this.assertTenantMember(siteId, payload.assigneeUserId);
    }

    const task = await this.prisma.seoAuditTask.create({
      data: {
        siteId,
        source: "MANUAL",
        slug,
        locale,
        title,
        description: payload.description ?? null,
        priority: payload.priority ?? "MEDIUM",
        status: payload.status ?? "OPEN",
        assigneeUserId: payload.assigneeUserId ?? null,
        createdByUserId,
      },
      include: TASK_INCLUDE,
    });
    if (task.assigneeUserId) {
      await this.notifyTaskAssignee(siteId, task, createdByUserId);
    }
    return task;
  }

  async updateTask(
    siteId: string,
    taskId: string,
    payload: UpdateTaskPayload,
  ): Promise<SeoAuditTaskWithRefs> {
    const existing = await this.prisma.seoAuditTask.findFirst({
      where: { id: taskId, siteId },
      select: { id: true, assigneeUserId: true },
    });
    if (!existing) throw new NotFoundException("Audit task not found");

    if (payload.assigneeUserId) {
      await this.assertTenantMember(siteId, payload.assigneeUserId);
    }

    const data: Prisma.SeoAuditTaskUpdateInput = {};
    if (payload.title !== undefined) {
      const trimmed = payload.title.trim();
      if (!trimmed) throw new BadRequestException("title cannot be empty");
      data.title = trimmed;
    }
    if (payload.description !== undefined)
      data.description = payload.description;
    if (payload.priority !== undefined) data.priority = payload.priority;
    if (payload.assigneeUserId !== undefined) {
      data.assignee = payload.assigneeUserId
        ? { connect: { id: payload.assigneeUserId } }
        : { disconnect: true };
    }
    if (payload.status !== undefined) {
      data.status = payload.status;
      data.resolvedAt =
        payload.status === "RESOLVED" || payload.status === "DISMISSED"
          ? new Date()
          : null;
    }

    const task = await this.prisma.seoAuditTask.update({
      where: { id: taskId },
      data,
      include: TASK_INCLUDE,
    });
    if (
      payload.assigneeUserId &&
      payload.assigneeUserId !== existing.assigneeUserId
    ) {
      await this.notifyTaskAssignee(siteId, task);
    }
    return task;
  }

  async deleteTask(siteId: string, taskId: string): Promise<void> {
    const result = await this.prisma.seoAuditTask.deleteMany({
      where: { id: taskId, siteId },
    });
    if (result.count === 0) throw new NotFoundException("Audit task not found");
  }

  async bulkUpdate(
    siteId: string,
    payload: BulkAuditTaskPayload,
  ): Promise<{ matched: number; affected: number }> {
    const ids = Array.from(new Set(payload.taskIds ?? []));
    if (ids.length === 0) {
      throw new BadRequestException("taskIds must contain at least one id");
    }
    if (ids.length > MAX_BULK_TASK_IDS) {
      throw new BadRequestException(
        `bulk operations are capped at ${MAX_BULK_TASK_IDS} tasks`,
      );
    }

    if (payload.action.kind === "ASSIGN" && payload.action.assigneeUserId) {
      await this.assertTenantMember(siteId, payload.action.assigneeUserId);
    }

    const matchedCount = await this.prisma.seoAuditTask.count({
      where: { id: { in: ids }, siteId },
    });

    if (payload.action.kind === "DELETE") {
      const result = await this.prisma.seoAuditTask.deleteMany({
        where: { id: { in: ids }, siteId },
      });
      return { matched: matchedCount, affected: result.count };
    }

    const patch = buildBulkPatch(payload.action);
    if (!patch) {
      // Should not happen (DELETE handled above).
      return { matched: matchedCount, affected: 0 };
    }

    const result = await this.prisma.seoAuditTask.updateMany({
      where: { id: { in: ids }, siteId },
      data: patch as Prisma.SeoAuditTaskUpdateManyMutationInput,
    });

    if (
      payload.action.kind === "ASSIGN" &&
      payload.action.assigneeUserId &&
      result.count > 0
    ) {
      await this.notifyBulkAssignee(
        siteId,
        payload.action.assigneeUserId,
        result.count,
      );
    }

    return { matched: matchedCount, affected: result.count };
  }

  // ── Auto-create from an alert (called by the runner) ──────────────────

  async upsertTaskForAlert(
    alert: Pick<
      OperationalAlert,
      "id" | "siteId" | "severity" | "message" | "metadata"
    >,
  ): Promise<SeoAuditTask> {
    const metadata = (alert.metadata ?? {}) as {
      slug?: string;
      locale?: string;
      reason?: string;
    };
    const slug = metadata.slug ?? "(unknown)";
    const locale = metadata.locale ?? "und";
    const priority = alertSeverityToPriority(alert.severity);
    const reason = metadata.reason ?? "AUDIT";

    const existing = await this.prisma.seoAuditTask.findUnique({
      where: { sourceAlertId: alert.id },
    });

    if (existing) {
      // Refresh priority + reopen if it had been auto-resolved but the alert
      // re-fired. Leave assignee/status untouched if user has taken action.
      const shouldReopen =
        existing.status === "RESOLVED" || existing.status === "DISMISSED";
      return this.prisma.seoAuditTask.update({
        where: { id: existing.id },
        data: {
          priority,
          status: shouldReopen ? "OPEN" : existing.status,
          resolvedAt: shouldReopen ? null : existing.resolvedAt,
          // Always keep title in sync with the latest alert wording.
          title: alert.message,
        },
      });
    }

    return this.prisma.seoAuditTask.create({
      data: {
        siteId: alert.siteId,
        sourceAlertId: alert.id,
        source: "ALERT",
        slug,
        locale,
        title: alert.message,
        description: `Auto-created from alert (${reason}).`,
        priority,
        status: "OPEN",
      },
    });
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  private async resolveTenantId(siteId: string): Promise<string> {
    const site = await this.prisma.site.findUnique({
      where: { id: siteId },
      select: { tenantId: true },
    });
    if (!site) throw new NotFoundException("Site not found");
    return site.tenantId;
  }

  private async assertTenantMember(
    siteId: string,
    userId: string,
  ): Promise<{ tenantId: string; email: string | null }> {
    const tenantId = await this.resolveTenantId(siteId);
    const membership = await this.prisma.tenantMembership.findUnique({
      where: { tenantId_userId: { tenantId, userId } },
      select: { id: true, user: { select: { email: true } } },
    });
    if (!membership) {
      throw new ForbiddenException(
        "Assignee must be a member of the site's workspace",
      );
    }
    return { tenantId, email: membership.user?.email ?? null };
  }

  private async notifyTaskAssignee(
    siteId: string,
    task: Pick<
      SeoAuditTaskWithRefs,
      "id" | "title" | "slug" | "locale" | "priority" | "assigneeUserId"
    >,
    actorUserId?: string | null,
  ): Promise<void> {
    if (!task.assigneeUserId || task.assigneeUserId === actorUserId) return;

    try {
      const member = await this.assertTenantMember(siteId, task.assigneeUserId);
      await this.notificationsService.create({
        tenantId: member.tenantId,
        siteId,
        userId: task.assigneeUserId,
        category: NotificationCategory.SYSTEM,
        title: `SEO task assigned: ${task.title}`,
        body: `A ${task.priority.toLowerCase()} priority SEO task for ${this.formatSlug(task.slug)} (${task.locale}) was assigned to you.`,
        actionUrl: "/seo?tab=audit-tasks",
        metadata: {
          taskId: task.id,
          slug: task.slug,
          locale: task.locale,
          priority: task.priority,
        },
      });

      if (member.email && this.transactionalEmailService.isConfigured()) {
        const url = `${this.getDashboardBaseUrl()}/seo?tab=audit-tasks`;
        await this.transactionalEmailService.send({
          to: member.email,
          subject: `SEO task assigned: ${task.title}`,
          text: this.buildTaskAssignmentText({
            title: task.title,
            slug: task.slug,
            locale: task.locale,
            priority: task.priority,
            url,
          }),
          html: this.buildTaskAssignmentHtml({
            title: task.title,
            slug: task.slug,
            locale: task.locale,
            priority: task.priority,
            url,
          }),
        });
      }
    } catch (err) {
      this.logger.warn(
        `Failed to notify SEO task assignee ${task.assigneeUserId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  private async notifyBulkAssignee(
    siteId: string,
    assigneeUserId: string,
    count: number,
  ): Promise<void> {
    try {
      const member = await this.assertTenantMember(siteId, assigneeUserId);
      await this.notificationsService.create({
        tenantId: member.tenantId,
        siteId,
        userId: assigneeUserId,
        category: NotificationCategory.SYSTEM,
        title: `${count} SEO task${count === 1 ? "" : "s"} assigned to you`,
        body: `Open the SEO audit task board to review your newly assigned work.`,
        actionUrl: "/seo?tab=audit-tasks",
        metadata: { count },
      });

      if (member.email && this.transactionalEmailService.isConfigured()) {
        const url = `${this.getDashboardBaseUrl()}/seo?tab=audit-tasks`;
        await this.transactionalEmailService.send({
          to: member.email,
          subject: `${count} SEO task${count === 1 ? "" : "s"} assigned to you`,
          text: [
            `${count} SEO task${count === 1 ? "" : "s"} assigned to you`,
            "",
            "Open the SEO audit task board to review them:",
            url,
          ].join("\n"),
          html: this.buildTaskAssignmentHtml({
            title: `${count} SEO task${count === 1 ? "" : "s"}`,
            slug: "audit-tasks",
            locale: "all",
            priority: "MEDIUM",
            url,
          }),
        });
      }
    } catch (err) {
      this.logger.warn(
        `Failed to notify bulk SEO task assignee ${assigneeUserId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  private buildTaskAssignmentText(input: {
    title: string;
    slug: string;
    locale: string;
    priority: SeoAuditTaskPriority;
    url: string;
  }): string {
    return [
      "A StayLayer SEO audit task was assigned to you.",
      "",
      input.title,
      `Page: ${this.formatSlug(input.slug)} (${input.locale})`,
      `Priority: ${input.priority.toLowerCase()}`,
      "",
      "Open the task board:",
      input.url,
    ].join("\n");
  }

  private buildTaskAssignmentHtml(input: {
    title: string;
    slug: string;
    locale: string;
    priority: SeoAuditTaskPriority;
    url: string;
  }): string {
    const body = `${input.title} for ${this.formatSlug(input.slug)} (${input.locale}) was assigned to you with ${input.priority.toLowerCase()} priority.`;
    return [
      "<!doctype html>",
      '<html><body style="margin:0;padding:24px;background:#f7f2eb;font-family:Arial,sans-serif;color:#102a36;">',
      '<div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:20px;padding:32px;border:1px solid rgba(26,72,112,0.12);">',
      '<p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#E07038;">SEO task</p>',
      `<h1 style="margin:0 0 16px;font-size:28px;line-height:1.2;color:#0D2840;">${this.escapeHtml(input.title)}</h1>`,
      `<p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#102a36;">${this.escapeHtml(body)}</p>`,
      `<a href="${this.escapeHtml(input.url)}" style="display:inline-block;border-radius:999px;background:#0D2840;color:#ffffff;padding:14px 22px;text-decoration:none;font-weight:700;">Open task board</a>`,
      "</div></body></html>",
    ].join("");
  }

  private getDashboardBaseUrl(): string {
    return (
      this.configService
        .get<string>("DASHBOARD_APP_URL")
        ?.trim()
        .replace(/\/$/, "") || "http://localhost:5173"
    );
  }

  private formatSlug(slug: string): string {
    return slug.startsWith("/") ? slug : `/${slug}`;
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
}

export { type BulkAuditTaskAction };
