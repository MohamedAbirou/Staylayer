import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import {
  PlatformRole,
  Prisma,
  SupportCaseCategory,
  SupportCaseChannel,
  SupportCaseEventType,
  SupportCasePriority,
  SupportCaseStatus,
  SupportHandoffStatus,
  SupportHandoffTarget,
  SupportLinkedResourceType,
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  OPERATOR_PERMISSIONS,
  hasAllPermissions,
  type OperatorPermissionKey,
} from "../auth/operator/permissions/operator-permissions.registry";

// ─── Types exported to the controller ────────────────────────────────────

export interface SupportActor {
  id: string;
  email: string;
  platformRole: PlatformRole;
  permissions: ReadonlyArray<OperatorPermissionKey>;
}

export type SupportCaseScope = "all" | "billing";

export interface SupportCaseListQuery {
  status?: SupportCaseStatus[];
  priority?: SupportCasePriority[];
  category?: SupportCaseCategory[];
  assignedOperatorId?: string;
  unassigned?: boolean;
  slaBreached?: boolean;
  tenantId?: string;
  siteId?: string;
  tag?: string;
  q?: string;
  page?: number;
  limit?: number;
}

export interface CreateSupportCaseInput {
  tenantId: string;
  siteId?: string;
  requesterUserId?: string;
  requesterEmail?: string;
  subject: string;
  initialMessage?: string;
  channel?: SupportCaseChannel;
  priority?: SupportCasePriority;
  category?: SupportCaseCategory;
  tags?: string[];
  assignedOperatorId?: string;
}

export interface UpdateSupportCaseInput {
  priority?: SupportCasePriority;
  category?: SupportCaseCategory;
  tags?: string[];
}

// ─── SLA matrix ──────────────────────────────────────────────────────────
//
// Conservative defaults. Concrete operational policy is intentionally not
// configurable per-tenant in Phase 5 — the matrix is captured at case
// creation time (`first_response_due_at` / `resolution_due_at` columns) so
// future policy changes do not invalidate historic SLA evidence.

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const SLA_FIRST_RESPONSE_MS: Readonly<Record<SupportCasePriority, number>> = {
  URGENT: 1 * HOUR,
  HIGH: 4 * HOUR,
  NORMAL: 8 * HOUR,
  LOW: 24 * HOUR,
};

const SLA_RESOLUTION_MS: Readonly<Record<SupportCasePriority, number>> = {
  URGENT: 4 * HOUR,
  HIGH: 24 * HOUR,
  NORMAL: 3 * DAY,
  LOW: 7 * DAY,
};

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 25;

// Internal helper signature for the eager-loaded case shape used in detail
// endpoints. Defined inline (instead of via Prisma.validator) to avoid a
// generator round-trip — types are still strongly inferred where needed.

@Injectable()
export class SupportCasesService {
  private readonly logger = new Logger(SupportCasesService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Scope helpers ────────────────────────────────────────────────────

  /**
   * Resolves the read scope for the actor. Throws `ForbiddenException` when
   * the operator has no support-case read permission at all (defensive: the
   * controller already guards this, but the service is the canonical
   * authority for cross-role list endpoints).
   */
  resolveReadScope(actor: SupportActor): SupportCaseScope {
    if (
      hasAllPermissions(actor.permissions, [
        OPERATOR_PERMISSIONS.SUPPORT_CASE_READ_ALL,
      ])
    ) {
      return "all";
    }
    if (
      hasAllPermissions(actor.permissions, [
        OPERATOR_PERMISSIONS.SUPPORT_CASE_READ_BILLING,
      ])
    ) {
      return "billing";
    }
    throw new ForbiddenException({
      code: "OPERATOR_SUPPORT_SCOPE_DENIED",
      message: "Actor has no support case read permission.",
    });
  }

  private isBillingScopedCase(c: {
    category: SupportCaseCategory;
    handoffs?: { target: SupportHandoffTarget; status: SupportHandoffStatus }[];
  }): boolean {
    if (c.category === SupportCaseCategory.BILLING) return true;
    if (!c.handoffs) return false;
    return c.handoffs.some(
      (h) =>
        h.target === SupportHandoffTarget.BILLING &&
        h.status !== SupportHandoffStatus.CLOSED,
    );
  }

  // ─── List / queues ────────────────────────────────────────────────────

  async listCases(actor: SupportActor, query: SupportCaseListQuery) {
    const scope = this.resolveReadScope(actor);
    const where = this.buildListWhere(scope, query);
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, query.limit ?? DEFAULT_LIMIT),
    );
    const skip = (page - 1) * limit;

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.supportCase.count({ where }),
      this.prisma.supportCase.findMany({
        where,
        orderBy: [
          // Urgent items first, then most-recent activity.
          { priority: "desc" },
          { lastActivityAt: "desc" },
        ],
        skip,
        take: limit,
        select: this.listSelect,
      }),
    ]);

    return {
      data: rows.map((row) => this.formatListRow(row)),
      total,
      page,
      limit,
      scope,
    };
  }

  async queueSummary(actor: SupportActor) {
    const scope = this.resolveReadScope(actor);
    const baseWhere = this.buildScopeOnlyWhere(scope);

    const [
      byStatus,
      byPriority,
      unassigned,
      assignedToMe,
      breachedFirstResponse,
      breachedResolution,
      total,
    ] = await this.prisma.$transaction([
      this.prisma.supportCase.groupBy({
        by: ["status"],
        _count: { _all: true },
        where: baseWhere,
        orderBy: { status: "asc" },
      }),
      this.prisma.supportCase.groupBy({
        by: ["priority"],
        _count: { _all: true },
        orderBy: { priority: "asc" },
        where: {
          ...baseWhere,
          status: {
            in: [
              SupportCaseStatus.OPEN,
              SupportCaseStatus.PENDING_CUSTOMER,
              SupportCaseStatus.PENDING_INTERNAL,
            ],
          },
        },
      }),
      this.prisma.supportCase.count({
        where: {
          ...baseWhere,
          assignedOperatorId: null,
          status: {
            in: [
              SupportCaseStatus.OPEN,
              SupportCaseStatus.PENDING_CUSTOMER,
              SupportCaseStatus.PENDING_INTERNAL,
            ],
          },
        },
      }),
      this.prisma.supportCase.count({
        where: {
          ...baseWhere,
          assignedOperatorId: actor.id,
          status: {
            in: [
              SupportCaseStatus.OPEN,
              SupportCaseStatus.PENDING_CUSTOMER,
              SupportCaseStatus.PENDING_INTERNAL,
            ],
          },
        },
      }),
      this.prisma.supportCase.count({
        where: { ...baseWhere, slaBreachedFirstResponse: true },
      }),
      this.prisma.supportCase.count({
        where: { ...baseWhere, slaBreachedResolution: true },
      }),
      this.prisma.supportCase.count({ where: baseWhere }),
    ]);

    return {
      scope,
      total,
      assignedToMe,
      unassigned,
      slaBreachedFirstResponse: breachedFirstResponse,
      slaBreachedResolution: breachedResolution,
      byStatus: byStatus.reduce<Record<SupportCaseStatus, number>>(
        (acc, row) => {
          acc[row.status] =
            (row._count as { _all: number } | undefined)?._all ?? 0;
          return acc;
        },
        {
          OPEN: 0,
          PENDING_CUSTOMER: 0,
          PENDING_INTERNAL: 0,
          RESOLVED: 0,
          CLOSED: 0,
        },
      ),
      byPriority: byPriority.reduce<Record<SupportCasePriority, number>>(
        (acc, row) => {
          acc[row.priority] =
            (row._count as { _all: number } | undefined)?._all ?? 0;
          return acc;
        },
        { URGENT: 0, HIGH: 0, NORMAL: 0, LOW: 0 },
      ),
    };
  }

  // ─── Detail ───────────────────────────────────────────────────────────

  async getCase(actor: SupportActor, caseId: string) {
    const detail = await this.prisma.supportCase.findUnique({
      where: { id: caseId },
      select: this.detailSelect,
    });
    if (!detail) {
      throw new NotFoundException({
        code: "SUPPORT_CASE_NOT_FOUND",
        message: "Support case not found.",
      });
    }
    this.assertReadable(actor, detail);
    return this.formatDetail(detail);
  }

  // ─── Create ───────────────────────────────────────────────────────────

  async createCase(actor: SupportActor, input: CreateSupportCaseInput) {
    if (
      !hasAllPermissions(actor.permissions, [
        OPERATOR_PERMISSIONS.SUPPORT_CASE_CREATE_ALL,
      ])
    ) {
      throw new ForbiddenException({
        code: "OPERATOR_SUPPORT_CREATE_DENIED",
        message: "Missing support_case.create.all permission.",
      });
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: input.tenantId },
      select: { id: true },
    });
    if (!tenant) {
      throw new BadRequestException({
        code: "SUPPORT_CASE_TENANT_INVALID",
        message: "Referenced tenant does not exist.",
      });
    }

    if (input.siteId) {
      const site = await this.prisma.site.findUnique({
        where: { id: input.siteId },
        select: { id: true, tenantId: true },
      });
      if (!site || site.tenantId !== input.tenantId) {
        throw new BadRequestException({
          code: "SUPPORT_CASE_SITE_INVALID",
          message: "Referenced site does not belong to the given tenant.",
        });
      }
    }

    if (input.requesterUserId) {
      const user = await this.prisma.user.findUnique({
        where: { id: input.requesterUserId },
        select: { id: true },
      });
      if (!user) {
        throw new BadRequestException({
          code: "SUPPORT_CASE_REQUESTER_INVALID",
          message: "Referenced requester user does not exist.",
        });
      }
    }

    if (input.assignedOperatorId) {
      await this.assertIsOperatorUser(input.assignedOperatorId);
    }

    const priority = input.priority ?? SupportCasePriority.NORMAL;
    const category = input.category ?? SupportCaseCategory.OTHER;
    const now = new Date();
    const firstResponseDueAt = new Date(
      now.getTime() + SLA_FIRST_RESPONSE_MS[priority],
    );
    const resolutionDueAt = new Date(
      now.getTime() + SLA_RESOLUTION_MS[priority],
    );

    const created = await this.prisma.$transaction(async (tx) => {
      const supportCase = await tx.supportCase.create({
        data: {
          tenantId: input.tenantId,
          siteId: input.siteId ?? null,
          requesterUserId: input.requesterUserId ?? null,
          requesterEmail: input.requesterEmail ?? null,
          subject: input.subject,
          channel: input.channel ?? SupportCaseChannel.MANUAL,
          priority,
          category,
          tags: input.tags ?? [],
          assignedOperatorId: input.assignedOperatorId ?? null,
          createdByOperatorId: actor.id,
          firstResponseDueAt,
          resolutionDueAt,
          lastActivityAt: now,
        },
        select: { id: true },
      });

      await tx.supportCaseEvent.create({
        data: {
          caseId: supportCase.id,
          type: SupportCaseEventType.CREATED,
          actorUserId: actor.id,
          message: `Case opened via ${input.channel ?? SupportCaseChannel.MANUAL}`,
        },
      });

      if (input.assignedOperatorId) {
        await tx.supportCaseAssignment.create({
          data: {
            caseId: supportCase.id,
            fromUserId: null,
            toUserId: input.assignedOperatorId,
            changedByUserId: actor.id,
            reason: "initial assignment",
          },
        });
        await tx.supportCaseEvent.create({
          data: {
            caseId: supportCase.id,
            type: SupportCaseEventType.ASSIGNMENT_CHANGED,
            actorUserId: actor.id,
            fromValue: null,
            toValue: input.assignedOperatorId,
          },
        });
      }

      if (input.initialMessage && input.initialMessage.trim().length > 0) {
        await tx.supportCaseMessage.create({
          data: {
            caseId: supportCase.id,
            authorUserId: actor.id,
            authorIsOperator: true,
            body: input.initialMessage,
          },
        });
        await tx.supportCaseEvent.create({
          data: {
            caseId: supportCase.id,
            type: SupportCaseEventType.MESSAGE_ADDED,
            actorUserId: actor.id,
          },
        });
        await tx.supportCase.update({
          where: { id: supportCase.id },
          data: { firstResponseAt: now, lastActivityAt: now },
        });
      }

      return supportCase;
    });

    return this.getCase(actor, created.id);
  }

  // ─── Update ───────────────────────────────────────────────────────────

  async updateCase(
    actor: SupportActor,
    caseId: string,
    patch: UpdateSupportCaseInput,
  ) {
    if (
      !hasAllPermissions(actor.permissions, [
        OPERATOR_PERMISSIONS.SUPPORT_CASE_ASSIGN_ALL,
      ])
    ) {
      throw new ForbiddenException({
        code: "OPERATOR_SUPPORT_UPDATE_DENIED",
        message: "Missing support_case.assign.all permission.",
      });
    }
    const existing = await this.requireCaseForWrite(actor, caseId);

    const events: Prisma.SupportCaseEventCreateManyInput[] = [];
    const data: Prisma.SupportCaseUpdateInput = {};

    if (patch.priority && patch.priority !== existing.priority) {
      data.priority = patch.priority;
      // Refresh SLA targets from new priority but only push out, never in.
      const now = Date.now();
      const newFirstResponseDue = new Date(
        now + SLA_FIRST_RESPONSE_MS[patch.priority],
      );
      const newResolutionDue = new Date(
        now + SLA_RESOLUTION_MS[patch.priority],
      );
      if (
        !existing.firstResponseAt &&
        existing.firstResponseDueAt &&
        newFirstResponseDue > existing.firstResponseDueAt
      ) {
        data.firstResponseDueAt = newFirstResponseDue;
      }
      if (
        !existing.resolvedAt &&
        existing.resolutionDueAt &&
        newResolutionDue > existing.resolutionDueAt
      ) {
        data.resolutionDueAt = newResolutionDue;
      }
      events.push({
        caseId,
        type: SupportCaseEventType.PRIORITY_CHANGED,
        actorUserId: actor.id,
        fromValue: existing.priority,
        toValue: patch.priority,
      });
    }

    if (patch.category && patch.category !== existing.category) {
      data.category = patch.category;
      events.push({
        caseId,
        type: SupportCaseEventType.CATEGORY_CHANGED,
        actorUserId: actor.id,
        fromValue: existing.category,
        toValue: patch.category,
      });
    }

    if (patch.tags) {
      const next = patch.tags;
      const prev = existing.tags;
      const changed =
        next.length !== prev.length || next.some((t) => !prev.includes(t));
      if (changed) {
        data.tags = { set: next };
        events.push({
          caseId,
          type: SupportCaseEventType.TAGS_UPDATED,
          actorUserId: actor.id,
          fromValue: prev.join(","),
          toValue: next.join(","),
        });
      }
    }

    if (Object.keys(data).length === 0) {
      return this.getCase(actor, caseId);
    }

    data.lastActivityAt = new Date();

    await this.prisma.$transaction([
      this.prisma.supportCase.update({ where: { id: caseId }, data }),
      ...(events.length
        ? [this.prisma.supportCaseEvent.createMany({ data: events })]
        : []),
    ]);

    return this.getCase(actor, caseId);
  }

  // ─── Assign ───────────────────────────────────────────────────────────

  async assignCase(
    actor: SupportActor,
    caseId: string,
    assigneeUserId: string | null,
    reason: string,
  ) {
    if (
      !hasAllPermissions(actor.permissions, [
        OPERATOR_PERMISSIONS.SUPPORT_CASE_ASSIGN_ALL,
      ])
    ) {
      throw new ForbiddenException({
        code: "OPERATOR_SUPPORT_ASSIGN_DENIED",
        message: "Missing support_case.assign.all permission.",
      });
    }
    const existing = await this.requireCaseForWrite(actor, caseId);

    if (assigneeUserId) {
      await this.assertIsOperatorUser(assigneeUserId);
    }
    if (existing.assignedOperatorId === assigneeUserId) {
      return this.getCase(actor, caseId);
    }

    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.supportCase.update({
        where: { id: caseId },
        data: {
          assignedOperatorId: assigneeUserId,
          lastActivityAt: now,
        },
      }),
      this.prisma.supportCaseAssignment.create({
        data: {
          caseId,
          fromUserId: existing.assignedOperatorId,
          toUserId: assigneeUserId,
          changedByUserId: actor.id,
          reason,
        },
      }),
      this.prisma.supportCaseEvent.create({
        data: {
          caseId,
          type: SupportCaseEventType.ASSIGNMENT_CHANGED,
          actorUserId: actor.id,
          fromValue: existing.assignedOperatorId,
          toValue: assigneeUserId,
          message: reason,
        },
      }),
    ]);

    return this.getCase(actor, caseId);
  }

  // ─── Messages ─────────────────────────────────────────────────────────

  async addMessage(actor: SupportActor, caseId: string, body: string) {
    const existing = await this.requireCaseForWrite(actor, caseId);
    this.assertReplyAllowed(actor, existing);

    if (
      existing.status === SupportCaseStatus.CLOSED ||
      existing.status === SupportCaseStatus.RESOLVED
    ) {
      throw new BadRequestException({
        code: "SUPPORT_CASE_NOT_REPLYABLE",
        message:
          "Replies cannot be added to a resolved or closed case. Reopen the case first.",
      });
    }

    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.supportCaseMessage.create({
        data: {
          caseId,
          authorUserId: actor.id,
          authorIsOperator: true,
          body,
        },
      }),
      this.prisma.supportCaseEvent.create({
        data: {
          caseId,
          type: SupportCaseEventType.MESSAGE_ADDED,
          actorUserId: actor.id,
        },
      }),
      this.prisma.supportCase.update({
        where: { id: caseId },
        data: {
          lastActivityAt: now,
          firstResponseAt: existing.firstResponseAt ?? now,
          // If we are responding after the SLA deadline, record the breach.
          slaBreachedFirstResponse:
            existing.slaBreachedFirstResponse ||
            (!existing.firstResponseAt &&
              !!existing.firstResponseDueAt &&
              existing.firstResponseDueAt < now),
        },
      }),
    ]);

    return this.getCase(actor, caseId);
  }

  // ─── Notes ────────────────────────────────────────────────────────────

  async addNote(actor: SupportActor, caseId: string, body: string) {
    const existing = await this.requireCaseForWrite(actor, caseId);
    this.assertNoteAllowed(actor, existing);

    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.supportCaseNote.create({
        data: {
          caseId,
          authorUserId: actor.id,
          body,
        },
      }),
      this.prisma.supportCaseEvent.create({
        data: {
          caseId,
          type: SupportCaseEventType.NOTE_ADDED,
          actorUserId: actor.id,
        },
      }),
      this.prisma.supportCase.update({
        where: { id: caseId },
        data: { lastActivityAt: now },
      }),
    ]);

    return this.getCase(actor, caseId);
  }

  // ─── Status transitions ───────────────────────────────────────────────

  async setStatus(
    actor: SupportActor,
    caseId: string,
    target: Extract<
      SupportCaseStatus,
      "OPEN" | "PENDING_CUSTOMER" | "PENDING_INTERNAL"
    >,
    reason: string | null,
  ) {
    if (
      !hasAllPermissions(actor.permissions, [
        OPERATOR_PERMISSIONS.SUPPORT_CASE_ASSIGN_ALL,
      ])
    ) {
      throw new ForbiddenException({
        code: "OPERATOR_SUPPORT_STATUS_DENIED",
        message: "Missing support_case.assign.all permission.",
      });
    }
    const existing = await this.requireCaseForWrite(actor, caseId);
    if (
      existing.status === SupportCaseStatus.RESOLVED ||
      existing.status === SupportCaseStatus.CLOSED
    ) {
      throw new BadRequestException({
        code: "SUPPORT_CASE_NOT_REOPENABLE_VIA_STATUS",
        message:
          "Use the reopen endpoint to move a resolved or closed case back to an active state.",
      });
    }
    if (existing.status === target) {
      return this.getCase(actor, caseId);
    }

    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.supportCase.update({
        where: { id: caseId },
        data: { status: target, lastActivityAt: now },
      }),
      this.prisma.supportCaseEvent.create({
        data: {
          caseId,
          type: SupportCaseEventType.STATUS_CHANGED,
          actorUserId: actor.id,
          fromValue: existing.status,
          toValue: target,
          message: reason ?? undefined,
        },
      }),
    ]);

    return this.getCase(actor, caseId);
  }

  async resolveCase(
    actor: SupportActor,
    caseId: string,
    reason: string,
    closingMessage: string | undefined,
  ) {
    if (
      !hasAllPermissions(actor.permissions, [
        OPERATOR_PERMISSIONS.SUPPORT_CASE_RESOLVE_ALL,
      ])
    ) {
      throw new ForbiddenException({
        code: "OPERATOR_SUPPORT_RESOLVE_DENIED",
        message: "Missing support_case.resolve.all permission.",
      });
    }
    const existing = await this.requireCaseForWrite(actor, caseId);
    if (
      existing.status === SupportCaseStatus.RESOLVED ||
      existing.status === SupportCaseStatus.CLOSED
    ) {
      throw new BadRequestException({
        code: "SUPPORT_CASE_ALREADY_RESOLVED",
        message: "Case is already resolved or closed.",
      });
    }

    const now = new Date();
    const slaBreachedResolution =
      existing.slaBreachedResolution ||
      (!!existing.resolutionDueAt && existing.resolutionDueAt < now);

    await this.prisma.$transaction(async (tx) => {
      if (closingMessage && closingMessage.trim().length > 0) {
        await tx.supportCaseMessage.create({
          data: {
            caseId,
            authorUserId: actor.id,
            authorIsOperator: true,
            body: closingMessage,
          },
        });
        await tx.supportCaseEvent.create({
          data: {
            caseId,
            type: SupportCaseEventType.MESSAGE_ADDED,
            actorUserId: actor.id,
          },
        });
      }
      await tx.supportCase.update({
        where: { id: caseId },
        data: {
          status: SupportCaseStatus.RESOLVED,
          resolvedAt: now,
          lastActivityAt: now,
          slaBreachedResolution,
          firstResponseAt: existing.firstResponseAt ?? now,
        },
      });
      await tx.supportCaseEvent.create({
        data: {
          caseId,
          type: SupportCaseEventType.RESOLVED,
          actorUserId: actor.id,
          fromValue: existing.status,
          toValue: SupportCaseStatus.RESOLVED,
          message: reason,
        },
      });
    });

    return this.getCase(actor, caseId);
  }

  async reopenCase(actor: SupportActor, caseId: string, reason: string) {
    if (
      !hasAllPermissions(actor.permissions, [
        OPERATOR_PERMISSIONS.SUPPORT_CASE_RESOLVE_ALL,
      ])
    ) {
      throw new ForbiddenException({
        code: "OPERATOR_SUPPORT_REOPEN_DENIED",
        message: "Missing support_case.resolve.all permission.",
      });
    }
    const existing = await this.requireCaseForWrite(actor, caseId);
    if (
      existing.status !== SupportCaseStatus.RESOLVED &&
      existing.status !== SupportCaseStatus.CLOSED
    ) {
      throw new BadRequestException({
        code: "SUPPORT_CASE_NOT_REOPENABLE",
        message: "Only resolved or closed cases can be reopened.",
      });
    }

    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.supportCase.update({
        where: { id: caseId },
        data: {
          status: SupportCaseStatus.OPEN,
          resolvedAt: null,
          closedAt: null,
          lastActivityAt: now,
        },
      }),
      this.prisma.supportCaseEvent.create({
        data: {
          caseId,
          type: SupportCaseEventType.REOPENED,
          actorUserId: actor.id,
          fromValue: existing.status,
          toValue: SupportCaseStatus.OPEN,
          message: reason,
        },
      }),
    ]);

    return this.getCase(actor, caseId);
  }

  async closeCase(actor: SupportActor, caseId: string, reason: string) {
    if (
      !hasAllPermissions(actor.permissions, [
        OPERATOR_PERMISSIONS.SUPPORT_CASE_RESOLVE_ALL,
      ])
    ) {
      throw new ForbiddenException({
        code: "OPERATOR_SUPPORT_CLOSE_DENIED",
        message: "Missing support_case.resolve.all permission.",
      });
    }
    const existing = await this.requireCaseForWrite(actor, caseId);
    if (existing.status === SupportCaseStatus.CLOSED) {
      throw new BadRequestException({
        code: "SUPPORT_CASE_ALREADY_CLOSED",
        message: "Case is already closed.",
      });
    }

    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.supportCase.update({
        where: { id: caseId },
        data: {
          status: SupportCaseStatus.CLOSED,
          closedAt: now,
          resolvedAt: existing.resolvedAt ?? now,
          lastActivityAt: now,
        },
      }),
      this.prisma.supportCaseEvent.create({
        data: {
          caseId,
          type: SupportCaseEventType.CLOSED,
          actorUserId: actor.id,
          fromValue: existing.status,
          toValue: SupportCaseStatus.CLOSED,
          message: reason,
        },
      }),
    ]);

    return this.getCase(actor, caseId);
  }

  // ─── Linked resources ─────────────────────────────────────────────────

  async linkResource(
    actor: SupportActor,
    caseId: string,
    resourceType: SupportLinkedResourceType,
    resourceId: string,
    label: string | undefined,
  ) {
    if (
      !hasAllPermissions(actor.permissions, [
        OPERATOR_PERMISSIONS.SUPPORT_CASE_ASSIGN_ALL,
      ])
    ) {
      throw new ForbiddenException({
        code: "OPERATOR_SUPPORT_LINK_DENIED",
        message: "Missing support_case.assign.all permission.",
      });
    }
    await this.requireCaseForWrite(actor, caseId);
    await this.assertResourceExists(resourceType, resourceId);

    const now = new Date();
    try {
      await this.prisma.$transaction([
        this.prisma.supportCaseLinkedResource.create({
          data: {
            caseId,
            resourceType,
            resourceId,
            label: label ?? null,
            createdByUserId: actor.id,
          },
        }),
        this.prisma.supportCaseEvent.create({
          data: {
            caseId,
            type: SupportCaseEventType.RESOURCE_LINKED,
            actorUserId: actor.id,
            toValue: `${resourceType}:${resourceId}`,
            message: label ?? undefined,
          },
        }),
        this.prisma.supportCase.update({
          where: { id: caseId },
          data: { lastActivityAt: now },
        }),
      ]);
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        throw new BadRequestException({
          code: "SUPPORT_CASE_RESOURCE_ALREADY_LINKED",
          message: "Resource is already linked to this case.",
        });
      }
      throw err;
    }

    return this.getCase(actor, caseId);
  }

  async unlinkResource(actor: SupportActor, caseId: string, linkId: string) {
    if (
      !hasAllPermissions(actor.permissions, [
        OPERATOR_PERMISSIONS.SUPPORT_CASE_ASSIGN_ALL,
      ])
    ) {
      throw new ForbiddenException({
        code: "OPERATOR_SUPPORT_UNLINK_DENIED",
        message: "Missing support_case.assign.all permission.",
      });
    }
    await this.requireCaseForWrite(actor, caseId);
    const link = await this.prisma.supportCaseLinkedResource.findUnique({
      where: { id: linkId },
      select: { id: true, caseId: true, resourceType: true, resourceId: true },
    });
    if (!link || link.caseId !== caseId) {
      throw new NotFoundException({
        code: "SUPPORT_CASE_LINK_NOT_FOUND",
        message: "Linked resource not found on this case.",
      });
    }

    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.supportCaseLinkedResource.delete({ where: { id: linkId } }),
      this.prisma.supportCaseEvent.create({
        data: {
          caseId,
          type: SupportCaseEventType.RESOURCE_UNLINKED,
          actorUserId: actor.id,
          fromValue: `${link.resourceType}:${link.resourceId}`,
        },
      }),
      this.prisma.supportCase.update({
        where: { id: caseId },
        data: { lastActivityAt: now },
      }),
    ]);

    return this.getCase(actor, caseId);
  }

  // ─── Handoffs ─────────────────────────────────────────────────────────

  async openHandoff(
    actor: SupportActor,
    caseId: string,
    target: SupportHandoffTarget,
    reason: string,
  ) {
    if (
      !hasAllPermissions(actor.permissions, [
        OPERATOR_PERMISSIONS.SUPPORT_CASE_TRANSFER_ALL,
      ])
    ) {
      throw new ForbiddenException({
        code: "OPERATOR_SUPPORT_HANDOFF_DENIED",
        message: "Missing support_case.transfer.all permission.",
      });
    }
    await this.requireCaseForWrite(actor, caseId);

    const existingOpen = await this.prisma.supportCaseHandoff.findFirst({
      where: {
        caseId,
        target,
        status: {
          in: [SupportHandoffStatus.OPEN, SupportHandoffStatus.ACKNOWLEDGED],
        },
      },
      select: { id: true },
    });
    if (existingOpen) {
      throw new BadRequestException({
        code: "SUPPORT_CASE_HANDOFF_ALREADY_OPEN",
        message: "A handoff to this target is already open.",
      });
    }

    const now = new Date();
    const handoff = await this.prisma.$transaction(async (tx) => {
      const created = await tx.supportCaseHandoff.create({
        data: {
          caseId,
          target,
          reason,
          openedByUserId: actor.id,
        },
        select: { id: true },
      });
      await tx.supportCaseEvent.create({
        data: {
          caseId,
          type: SupportCaseEventType.HANDOFF_OPENED,
          actorUserId: actor.id,
          toValue: target,
          message: reason,
        },
      });
      await tx.supportCase.update({
        where: { id: caseId },
        data: { lastActivityAt: now },
      });
      return created;
    });

    const detail = await this.getCase(actor, caseId);
    return { case: detail, handoffId: handoff.id };
  }

  async acknowledgeHandoff(
    actor: SupportActor,
    caseId: string,
    handoffId: string,
  ) {
    await this.requireCaseForWrite(actor, caseId);
    const handoff = await this.prisma.supportCaseHandoff.findUnique({
      where: { id: handoffId },
      select: { id: true, caseId: true, status: true, target: true },
    });
    if (!handoff || handoff.caseId !== caseId) {
      throw new NotFoundException({
        code: "SUPPORT_CASE_HANDOFF_NOT_FOUND",
        message: "Handoff not found on this case.",
      });
    }
    if (handoff.status !== SupportHandoffStatus.OPEN) {
      throw new BadRequestException({
        code: "SUPPORT_CASE_HANDOFF_NOT_OPEN",
        message: "Only OPEN handoffs can be acknowledged.",
      });
    }
    // The acknowledger must hold the target queue's read permission so this
    // is a meaningful, scoped acknowledgement.
    this.assertHandoffAcknowledger(actor, handoff.target);

    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.supportCaseHandoff.update({
        where: { id: handoffId },
        data: {
          status: SupportHandoffStatus.ACKNOWLEDGED,
          acknowledgedAt: now,
        },
      }),
      this.prisma.supportCaseEvent.create({
        data: {
          caseId,
          type: SupportCaseEventType.HANDOFF_ACKNOWLEDGED,
          actorUserId: actor.id,
          toValue: handoff.target,
        },
      }),
      this.prisma.supportCase.update({
        where: { id: caseId },
        data: { lastActivityAt: now },
      }),
    ]);
    return this.getCase(actor, caseId);
  }

  async closeHandoff(
    actor: SupportActor,
    caseId: string,
    handoffId: string,
    reason: string,
  ) {
    if (
      !hasAllPermissions(actor.permissions, [
        OPERATOR_PERMISSIONS.SUPPORT_CASE_TRANSFER_ALL,
      ])
    ) {
      throw new ForbiddenException({
        code: "OPERATOR_SUPPORT_HANDOFF_CLOSE_DENIED",
        message: "Missing support_case.transfer.all permission.",
      });
    }
    await this.requireCaseForWrite(actor, caseId);
    const handoff = await this.prisma.supportCaseHandoff.findUnique({
      where: { id: handoffId },
      select: { id: true, caseId: true, status: true, target: true },
    });
    if (!handoff || handoff.caseId !== caseId) {
      throw new NotFoundException({
        code: "SUPPORT_CASE_HANDOFF_NOT_FOUND",
        message: "Handoff not found on this case.",
      });
    }
    if (handoff.status === SupportHandoffStatus.CLOSED) {
      throw new BadRequestException({
        code: "SUPPORT_CASE_HANDOFF_ALREADY_CLOSED",
        message: "Handoff is already closed.",
      });
    }

    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.supportCaseHandoff.update({
        where: { id: handoffId },
        data: {
          status: SupportHandoffStatus.CLOSED,
          closedAt: now,
          closedByUserId: actor.id,
        },
      }),
      this.prisma.supportCaseEvent.create({
        data: {
          caseId,
          type: SupportCaseEventType.HANDOFF_CLOSED,
          actorUserId: actor.id,
          fromValue: handoff.target,
          message: reason,
        },
      }),
      this.prisma.supportCase.update({
        where: { id: caseId },
        data: { lastActivityAt: now },
      }),
    ]);
    return this.getCase(actor, caseId);
  }

  // ─── Scope / permission internals ─────────────────────────────────────

  /**
   * Returns the case for write operations, applying the same visibility
   * rules as read scope plus a generic "case is open" gate for mutations
   * (state-machine specific gates remain in the individual lifecycle
   * methods to keep error messages precise).
   */
  private async requireCaseForWrite(actor: SupportActor, caseId: string) {
    const c = await this.prisma.supportCase.findUnique({
      where: { id: caseId },
      select: {
        id: true,
        status: true,
        priority: true,
        category: true,
        tags: true,
        assignedOperatorId: true,
        firstResponseAt: true,
        firstResponseDueAt: true,
        resolvedAt: true,
        resolutionDueAt: true,
        slaBreachedFirstResponse: true,
        slaBreachedResolution: true,
        tenantId: true,
        siteId: true,
        handoffs: {
          select: { target: true, status: true },
        },
      },
    });
    if (!c) {
      throw new NotFoundException({
        code: "SUPPORT_CASE_NOT_FOUND",
        message: "Support case not found.",
      });
    }
    this.assertReadable(actor, c);
    return c;
  }

  private assertReadable(
    actor: SupportActor,
    c: {
      category: SupportCaseCategory;
      handoffs?: {
        target: SupportHandoffTarget;
        status: SupportHandoffStatus;
      }[];
    },
  ) {
    const canAll = hasAllPermissions(actor.permissions, [
      OPERATOR_PERMISSIONS.SUPPORT_CASE_READ_ALL,
    ]);
    if (canAll) return;
    const canBilling = hasAllPermissions(actor.permissions, [
      OPERATOR_PERMISSIONS.SUPPORT_CASE_READ_BILLING,
    ]);
    if (canBilling && this.isBillingScopedCase(c)) return;
    throw new ForbiddenException({
      code: "OPERATOR_SUPPORT_CASE_FORBIDDEN",
      message: "Actor does not have access to this support case.",
    });
  }

  private assertReplyAllowed(
    actor: SupportActor,
    c: {
      category: SupportCaseCategory;
      handoffs?: {
        target: SupportHandoffTarget;
        status: SupportHandoffStatus;
      }[];
    },
  ) {
    if (
      hasAllPermissions(actor.permissions, [
        OPERATOR_PERMISSIONS.SUPPORT_CASE_REPLY_ALL,
      ])
    ) {
      return;
    }
    if (
      hasAllPermissions(actor.permissions, [
        OPERATOR_PERMISSIONS.SUPPORT_CASE_REPLY_BILLING,
      ]) &&
      this.isBillingScopedCase(c)
    ) {
      return;
    }
    throw new ForbiddenException({
      code: "OPERATOR_SUPPORT_REPLY_DENIED",
      message: "Actor cannot reply to this support case.",
    });
  }

  private assertNoteAllowed(
    actor: SupportActor,
    c: {
      category: SupportCaseCategory;
      handoffs?: {
        target: SupportHandoffTarget;
        status: SupportHandoffStatus;
      }[];
    },
  ) {
    if (
      hasAllPermissions(actor.permissions, [
        OPERATOR_PERMISSIONS.SUPPORT_CASE_NOTE_ALL,
      ])
    ) {
      return;
    }
    if (
      hasAllPermissions(actor.permissions, [
        OPERATOR_PERMISSIONS.SUPPORT_CASE_NOTE_BILLING,
      ]) &&
      this.isBillingScopedCase(c)
    ) {
      return;
    }
    throw new ForbiddenException({
      code: "OPERATOR_SUPPORT_NOTE_DENIED",
      message: "Actor cannot add internal notes to this support case.",
    });
  }

  private assertHandoffAcknowledger(
    actor: SupportActor,
    target: SupportHandoffTarget,
  ) {
    switch (target) {
      case SupportHandoffTarget.BILLING:
        if (
          hasAllPermissions(actor.permissions, [
            OPERATOR_PERMISSIONS.SUPPORT_CASE_READ_BILLING,
          ]) ||
          hasAllPermissions(actor.permissions, [
            OPERATOR_PERMISSIONS.SUPPORT_CASE_READ_ALL,
          ])
        ) {
          return;
        }
        break;
      case SupportHandoffTarget.SUPPORT:
      case SupportHandoffTarget.PLATFORM_OWNER:
        if (
          hasAllPermissions(actor.permissions, [
            OPERATOR_PERMISSIONS.SUPPORT_CASE_READ_ALL,
          ])
        ) {
          return;
        }
        break;
    }
    throw new ForbiddenException({
      code: "OPERATOR_SUPPORT_HANDOFF_ACK_DENIED",
      message: "Actor cannot acknowledge a handoff for this queue.",
    });
  }

  private async assertIsOperatorUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, platformRole: true },
    });
    if (!user || !user.platformRole) {
      throw new BadRequestException({
        code: "SUPPORT_CASE_ASSIGNEE_NOT_OPERATOR",
        message: "Assignee must be an operator (platformRole != null).",
      });
    }
  }

  private async assertResourceExists(
    type: SupportLinkedResourceType,
    id: string,
  ): Promise<void> {
    switch (type) {
      case SupportLinkedResourceType.TENANT: {
        const exists = await this.prisma.tenant.findUnique({
          where: { id },
          select: { id: true },
        });
        if (!exists) throw this.linkedNotFound("tenant");
        return;
      }
      case SupportLinkedResourceType.SITE: {
        const exists = await this.prisma.site.findUnique({
          where: { id },
          select: { id: true },
        });
        if (!exists) throw this.linkedNotFound("site");
        return;
      }
      case SupportLinkedResourceType.DEPLOYMENT: {
        const exists = await this.prisma.deployment.findUnique({
          where: { id },
          select: { id: true },
        });
        if (!exists) throw this.linkedNotFound("deployment");
        return;
      }
      case SupportLinkedResourceType.DOMAIN: {
        const exists = await this.prisma.domain.findUnique({
          where: { id },
          select: { id: true },
        });
        if (!exists) throw this.linkedNotFound("domain");
        return;
      }
      case SupportLinkedResourceType.FORM_DEFINITION: {
        const exists = await this.prisma.formDefinition.findUnique({
          where: { id },
          select: { id: true },
        });
        if (!exists) throw this.linkedNotFound("form definition");
        return;
      }
      case SupportLinkedResourceType.FORM_SUBMISSION: {
        const exists = await this.prisma.formSubmission.findUnique({
          where: { id },
          select: { id: true },
        });
        if (!exists) throw this.linkedNotFound("form submission");
        return;
      }
      case SupportLinkedResourceType.SUBSCRIPTION: {
        const exists = await this.prisma.subscription.findUnique({
          where: { id },
          select: { id: true },
        });
        if (!exists) throw this.linkedNotFound("subscription");
        return;
      }
      case SupportLinkedResourceType.OPERATIONAL_ALERT: {
        const exists = await this.prisma.operationalAlert.findUnique({
          where: { id },
          select: { id: true },
        });
        if (!exists) throw this.linkedNotFound("operational alert");
        return;
      }
      case SupportLinkedResourceType.USER: {
        const exists = await this.prisma.user.findUnique({
          where: { id },
          select: { id: true },
        });
        if (!exists) throw this.linkedNotFound("user");
        return;
      }
      default: {
        // exhaustiveness — TypeScript will catch missing branches.
        const _exhaustive: never = type;
        void _exhaustive;
        throw new BadRequestException({
          code: "SUPPORT_CASE_RESOURCE_TYPE_UNSUPPORTED",
          message: "Unsupported linked resource type.",
        });
      }
    }
  }

  private linkedNotFound(label: string): BadRequestException {
    return new BadRequestException({
      code: "SUPPORT_CASE_LINKED_RESOURCE_NOT_FOUND",
      message: `Referenced ${label} does not exist.`,
    });
  }

  // ─── Where clauses ────────────────────────────────────────────────────

  private buildScopeOnlyWhere(
    scope: SupportCaseScope,
  ): Prisma.SupportCaseWhereInput {
    if (scope === "all") return {};
    return {
      OR: [
        { category: SupportCaseCategory.BILLING },
        {
          handoffs: {
            some: {
              target: SupportHandoffTarget.BILLING,
              status: {
                in: [
                  SupportHandoffStatus.OPEN,
                  SupportHandoffStatus.ACKNOWLEDGED,
                ],
              },
            },
          },
        },
      ],
    };
  }

  private buildListWhere(
    scope: SupportCaseScope,
    query: SupportCaseListQuery,
  ): Prisma.SupportCaseWhereInput {
    const where: Prisma.SupportCaseWhereInput = this.buildScopeOnlyWhere(scope);
    const and: Prisma.SupportCaseWhereInput[] = [];
    if (query.status?.length) and.push({ status: { in: query.status } });
    if (query.priority?.length) and.push({ priority: { in: query.priority } });
    if (query.category?.length) and.push({ category: { in: query.category } });
    if (query.tenantId) and.push({ tenantId: query.tenantId });
    if (query.siteId) and.push({ siteId: query.siteId });
    if (query.tag) and.push({ tags: { has: query.tag } });
    if (query.assignedOperatorId)
      and.push({ assignedOperatorId: query.assignedOperatorId });
    if (query.unassigned === true) and.push({ assignedOperatorId: null });
    if (query.unassigned === false)
      and.push({ assignedOperatorId: { not: null } });
    if (query.slaBreached === true) {
      and.push({
        OR: [
          { slaBreachedFirstResponse: true },
          { slaBreachedResolution: true },
        ],
      });
    }
    if (query.q) {
      and.push({
        OR: [
          { subject: { contains: query.q, mode: "insensitive" } },
          { requesterEmail: { contains: query.q, mode: "insensitive" } },
        ],
      });
    }
    if (and.length === 0) return where;
    return { AND: [where, ...and] };
  }

  // ─── Select / format helpers ──────────────────────────────────────────

  private readonly listSelect = {
    id: true,
    number: true,
    tenantId: true,
    siteId: true,
    subject: true,
    status: true,
    priority: true,
    category: true,
    channel: true,
    tags: true,
    assignedOperatorId: true,
    requesterEmail: true,
    firstResponseDueAt: true,
    resolutionDueAt: true,
    slaBreachedFirstResponse: true,
    slaBreachedResolution: true,
    lastActivityAt: true,
    createdAt: true,
    tenant: { select: { id: true, slug: true, name: true } },
    site: { select: { id: true, slug: true, name: true } },
    assignedOperator: { select: { id: true, email: true } },
  } satisfies Prisma.SupportCaseSelect;

  private readonly detailSelect = {
    ...this.listSelect,
    requesterUserId: true,
    requesterEmail: true,
    createdByOperatorId: true,
    firstResponseAt: true,
    resolvedAt: true,
    closedAt: true,
    metadata: true,
    updatedAt: true,
    createdByOperator: { select: { id: true, email: true } },
    requesterUser: { select: { id: true, email: true } },
    messages: {
      orderBy: { createdAt: "asc" },
      take: 200,
      select: {
        id: true,
        body: true,
        authorIsOperator: true,
        authorUserId: true,
        createdAt: true,
        author: { select: { id: true, email: true } },
      },
    },
    notes: {
      orderBy: { createdAt: "asc" },
      take: 200,
      select: {
        id: true,
        body: true,
        authorUserId: true,
        createdAt: true,
        author: { select: { id: true, email: true } },
      },
    },
    events: {
      orderBy: { createdAt: "asc" },
      take: 500,
      select: {
        id: true,
        type: true,
        actorUserId: true,
        fromValue: true,
        toValue: true,
        message: true,
        metadata: true,
        createdAt: true,
        actor: { select: { id: true, email: true } },
      },
    },
    assignments: {
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        fromUserId: true,
        toUserId: true,
        changedByUserId: true,
        reason: true,
        createdAt: true,
      },
    },
    linkedResources: {
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        resourceType: true,
        resourceId: true,
        label: true,
        createdByUserId: true,
        createdAt: true,
      },
    },
    handoffs: {
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        target: true,
        status: true,
        reason: true,
        openedByUserId: true,
        closedByUserId: true,
        acknowledgedAt: true,
        closedAt: true,
        createdAt: true,
      },
    },
  } satisfies Prisma.SupportCaseSelect;

  private formatListRow(
    row: Prisma.SupportCaseGetPayload<{
      select: SupportCasesService["listSelect"];
    }>,
  ) {
    return {
      ...row,
      firstResponseDueAt: row.firstResponseDueAt?.toISOString() ?? null,
      resolutionDueAt: row.resolutionDueAt?.toISOString() ?? null,
      lastActivityAt: row.lastActivityAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
    };
  }

  private formatDetail(
    row: Prisma.SupportCaseGetPayload<{
      select: SupportCasesService["detailSelect"];
    }>,
  ) {
    return {
      ...row,
      firstResponseDueAt: row.firstResponseDueAt?.toISOString() ?? null,
      resolutionDueAt: row.resolutionDueAt?.toISOString() ?? null,
      firstResponseAt: row.firstResponseAt?.toISOString() ?? null,
      resolvedAt: row.resolvedAt?.toISOString() ?? null,
      closedAt: row.closedAt?.toISOString() ?? null,
      lastActivityAt: row.lastActivityAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      messages: row.messages.map((m) => ({
        ...m,
        createdAt: m.createdAt.toISOString(),
      })),
      notes: row.notes.map((n) => ({
        ...n,
        createdAt: n.createdAt.toISOString(),
      })),
      events: row.events.map((e) => ({
        ...e,
        createdAt: e.createdAt.toISOString(),
      })),
      assignments: row.assignments.map((a) => ({
        ...a,
        createdAt: a.createdAt.toISOString(),
      })),
      linkedResources: row.linkedResources.map((l) => ({
        ...l,
        createdAt: l.createdAt.toISOString(),
      })),
      handoffs: row.handoffs.map((h) => ({
        ...h,
        createdAt: h.createdAt.toISOString(),
        acknowledgedAt: h.acknowledgedAt?.toISOString() ?? null,
        closedAt: h.closedAt?.toISOString() ?? null,
      })),
    };
  }

  /**
   * Best-effort SLA reconciliation. Intended to be invoked by a future cron;
   * exposed now so a background job can be wired without re-shaping the
   * service contract. Returns the number of cases newly flagged as
   * breached. Read-only on cases not yet breached.
   */
  async reconcileSlaBreaches(now: Date = new Date()): Promise<number> {
    const result = await this.prisma.$transaction(async (tx) => {
      const candidates = await tx.supportCase.findMany({
        where: {
          OR: [
            {
              slaBreachedFirstResponse: false,
              firstResponseAt: null,
              firstResponseDueAt: { lt: now },
            },
            {
              slaBreachedResolution: false,
              resolvedAt: null,
              resolutionDueAt: { lt: now },
            },
          ],
        },
        select: {
          id: true,
          slaBreachedFirstResponse: true,
          slaBreachedResolution: true,
          firstResponseAt: true,
          firstResponseDueAt: true,
          resolvedAt: true,
          resolutionDueAt: true,
        },
        take: 500,
      });
      let count = 0;
      for (const c of candidates) {
        const breachFirstResponse =
          !c.slaBreachedFirstResponse &&
          !c.firstResponseAt &&
          !!c.firstResponseDueAt &&
          c.firstResponseDueAt < now;
        const breachResolution =
          !c.slaBreachedResolution &&
          !c.resolvedAt &&
          !!c.resolutionDueAt &&
          c.resolutionDueAt < now;
        if (!breachFirstResponse && !breachResolution) continue;
        await tx.supportCase.update({
          where: { id: c.id },
          data: {
            slaBreachedFirstResponse:
              c.slaBreachedFirstResponse || breachFirstResponse,
            slaBreachedResolution: c.slaBreachedResolution || breachResolution,
          },
        });
        await tx.supportCaseEvent.create({
          data: {
            caseId: c.id,
            type: SupportCaseEventType.SLA_BREACHED,
            message: breachFirstResponse
              ? breachResolution
                ? "first-response and resolution SLA breached"
                : "first-response SLA breached"
              : "resolution SLA breached",
          },
        });
        count += 1;
      }
      return count;
    });
    if (result > 0) {
      this.logger.warn(
        JSON.stringify({
          event: "support_case_sla_breach_flagged",
          count: result,
        }),
      );
    }
    return result;
  }
}
