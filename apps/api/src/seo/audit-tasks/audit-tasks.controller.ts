import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Request } from "express";
import {
  SeoAuditTaskPriority,
  SeoAuditTaskStatus,
  TenantMembershipRole,
} from "@prisma/client";

import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import { WorkspaceScopeGuard } from "../../auth/guards/workspace-scope.guard";
import { MembershipRoles } from "../../auth/decorators/roles.decorator";
import { WorkspaceAccessService } from "../../auth/workspace-access.service";
import { AuthenticatedRequestUser } from "../../auth/auth.types";

import {
  type BulkAuditTaskAction,
  type CreateTaskPayload,
  type UpdateTaskPayload,
  SeoAuditTasksService,
} from "./audit-tasks.service";

const STATUS_VALUES: SeoAuditTaskStatus[] = [
  "OPEN",
  "IN_PROGRESS",
  "RESOLVED",
  "DISMISSED",
];
const PRIORITY_VALUES: SeoAuditTaskPriority[] = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL",
];

interface BulkRequestBody {
  taskIds?: string[];
  action?: {
    kind?: string;
    assigneeUserId?: string | null;
    status?: SeoAuditTaskStatus;
    priority?: SeoAuditTaskPriority;
  };
}

@Controller("seo/audit/tasks")
export class AuditTasksController {
  constructor(
    private readonly service: SeoAuditTasksService,
    private readonly workspaceAccess: WorkspaceAccessService,
  ) {}

  private async ensureSiteAccess(req: Request): Promise<string> {
    return this.workspaceAccess.ensureSiteAccess(
      req as Request & { user: AuthenticatedRequestUser },
    );
  }

  private getUserId(req: Request): string | null {
    return (
      (req as Request & { user?: AuthenticatedRequestUser }).user?.sub ?? null
    );
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(
    TenantMembershipRole.OWNER,
    TenantMembershipRole.ADMIN,
    TenantMembershipRole.EDITOR,
  )
  async list(
    @Req() req: Request,
    @Query("siteId") _siteId: string,
    @Query("status") status?: string,
    @Query("priority") priority?: string,
    @Query("assigneeUserId") assigneeUserId?: string,
    @Query("unassigned") unassigned?: string,
    @Query("slug") slug?: string,
    @Query("locale") locale?: string,
    @Query("limit") limit?: string,
  ) {
    const siteId = await this.ensureSiteAccess(req);
    return this.service.listTasks(siteId, {
      status: this.parseStatus(status, true),
      priority: this.parsePriority(priority),
      assigneeUserId: assigneeUserId || undefined,
      unassigned: parseBool(unassigned),
      slug: slug || undefined,
      locale: locale || undefined,
      limit: limit ? Number.parseInt(limit, 10) : undefined,
    });
  }

  @Get("summary")
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(
    TenantMembershipRole.OWNER,
    TenantMembershipRole.ADMIN,
    TenantMembershipRole.EDITOR,
  )
  async summary(@Req() req: Request, @Query("siteId") _siteId: string) {
    const siteId = await this.ensureSiteAccess(req);
    return this.service.getSummary(siteId);
  }

  @Get("assignees")
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(
    TenantMembershipRole.OWNER,
    TenantMembershipRole.ADMIN,
    TenantMembershipRole.EDITOR,
  )
  async assignees(@Req() req: Request, @Query("siteId") _siteId: string) {
    const siteId = await this.ensureSiteAccess(req);
    return this.service.listAssignees(siteId);
  }

  @Get(":taskId")
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(
    TenantMembershipRole.OWNER,
    TenantMembershipRole.ADMIN,
    TenantMembershipRole.EDITOR,
  )
  async getOne(
    @Req() req: Request,
    @Query("siteId") _siteId: string,
    @Param("taskId") taskId: string,
  ) {
    const siteId = await this.ensureSiteAccess(req);
    return this.service.getTask(siteId, taskId);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(
    TenantMembershipRole.OWNER,
    TenantMembershipRole.ADMIN,
    TenantMembershipRole.EDITOR,
  )
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Req() req: Request,
    @Query("siteId") _siteId: string,
    @Body() body: CreateTaskPayload,
  ) {
    const siteId = await this.ensureSiteAccess(req);
    if (body.priority && !PRIORITY_VALUES.includes(body.priority)) {
      throw new BadRequestException("priority is invalid");
    }
    if (body.status && !STATUS_VALUES.includes(body.status)) {
      throw new BadRequestException("status is invalid");
    }
    return this.service.createTask(siteId, this.getUserId(req), body);
  }

  @Patch(":taskId")
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(
    TenantMembershipRole.OWNER,
    TenantMembershipRole.ADMIN,
    TenantMembershipRole.EDITOR,
  )
  async update(
    @Req() req: Request,
    @Query("siteId") _siteId: string,
    @Param("taskId") taskId: string,
    @Body() body: UpdateTaskPayload,
  ) {
    const siteId = await this.ensureSiteAccess(req);
    if (body.priority && !PRIORITY_VALUES.includes(body.priority)) {
      throw new BadRequestException("priority is invalid");
    }
    if (body.status && !STATUS_VALUES.includes(body.status)) {
      throw new BadRequestException("status is invalid");
    }
    return this.service.updateTask(siteId, taskId, body);
  }

  @Delete(":taskId")
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(TenantMembershipRole.OWNER, TenantMembershipRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Req() req: Request,
    @Query("siteId") _siteId: string,
    @Param("taskId") taskId: string,
  ) {
    const siteId = await this.ensureSiteAccess(req);
    await this.service.deleteTask(siteId, taskId);
  }

  @Post("bulk")
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(TenantMembershipRole.OWNER, TenantMembershipRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async bulk(
    @Req() req: Request,
    @Query("siteId") _siteId: string,
    @Body() body: BulkRequestBody,
  ) {
    const siteId = await this.ensureSiteAccess(req);
    const action = this.parseBulkAction(body.action);
    return this.service.bulkUpdate(siteId, {
      taskIds: Array.isArray(body.taskIds) ? body.taskIds : [],
      action,
    });
  }

  // ── Parsing helpers ────────────────────────────────────────────────────

  private parseStatus(
    value: string | undefined,
    allowAll: boolean,
  ): SeoAuditTaskStatus | "ALL" | undefined {
    if (!value) return undefined;
    const upper = value.toUpperCase();
    if (allowAll && upper === "ALL") return "ALL";
    if ((STATUS_VALUES as string[]).includes(upper)) {
      return upper as SeoAuditTaskStatus;
    }
    throw new BadRequestException(
      `status must be one of ${STATUS_VALUES.join(", ")}`,
    );
  }

  private parsePriority(
    value: string | undefined,
  ): SeoAuditTaskPriority | undefined {
    if (!value) return undefined;
    const upper = value.toUpperCase();
    if ((PRIORITY_VALUES as string[]).includes(upper)) {
      return upper as SeoAuditTaskPriority;
    }
    throw new BadRequestException(
      `priority must be one of ${PRIORITY_VALUES.join(", ")}`,
    );
  }

  private parseBulkAction(
    raw: BulkRequestBody["action"] | undefined,
  ): BulkAuditTaskAction {
    if (!raw || typeof raw.kind !== "string") {
      throw new BadRequestException("action.kind is required");
    }
    const kind = raw.kind.toUpperCase();
    switch (kind) {
      case "ASSIGN":
        if (
          raw.assigneeUserId !== null &&
          (raw.assigneeUserId === undefined ||
            typeof raw.assigneeUserId !== "string")
        ) {
          throw new BadRequestException(
            "action.assigneeUserId is required (string or null)",
          );
        }
        return { kind: "ASSIGN", assigneeUserId: raw.assigneeUserId ?? null };
      case "STATUS": {
        const status = this.parseStatus(raw.status, false);
        if (!status || status === "ALL") {
          throw new BadRequestException("action.status is required");
        }
        return { kind: "STATUS", status };
      }
      case "PRIORITY": {
        const priority = this.parsePriority(raw.priority);
        if (!priority) {
          throw new BadRequestException("action.priority is required");
        }
        return { kind: "PRIORITY", priority };
      }
      case "DELETE":
        return { kind: "DELETE" };
      default:
        throw new BadRequestException(
          "action.kind must be ASSIGN, STATUS, PRIORITY, or DELETE",
        );
    }
  }
}

function parseBool(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  return value === "true" || value === "1";
}
