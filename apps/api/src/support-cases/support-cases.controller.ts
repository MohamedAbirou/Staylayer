import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import type { Request } from "express";
import {
  OPERATOR_PERMISSIONS,
  getPermissionsForRole,
} from "../auth/operator/permissions/operator-permissions.registry";
import { OperatorJwtAuthGuard } from "../auth/operator/guards/operator-jwt-auth.guard";
import { OperatorPermissionGuard } from "../auth/operator/permissions/operator-permission.guard";
import { RequireOperatorPermissions } from "../auth/operator/permissions/require-operator-permissions.decorator";
import { OperatorAuditInterceptor } from "../auth/operator/audit/operator-audit.interceptor";
import { OperatorAudit } from "../auth/operator/audit/operator-audit.decorator";
import {
  OPERATOR_JWT_AUDIENCE,
  type OperatorAuthenticatedRequestUser,
} from "../auth/operator/operator-auth.types";
import {
  SupportCasesService,
  type SupportActor,
} from "./support-cases.service";
import {
  AddSupportCaseMessageDto,
  AddSupportCaseNoteDto,
  AssignSupportCaseDto,
  CloseSupportCaseDto,
  CloseSupportCaseHandoffDto,
  CreateSupportCaseDto,
  LinkSupportCaseResourceDto,
  ListSupportCasesQueryDto,
  OpenSupportCaseHandoffDto,
  ReopenSupportCaseDto,
  ResolveSupportCaseDto,
  SetStatusSupportCaseDto,
  UpdateSupportCaseDto,
} from "./dto/support-cases.dto";

/**
 * Phase 5 — support system backend.
 *
 * The controller deliberately exposes a single `/operator/support-cases`
 * surface. All endpoints are guarded by the operator JWT auth guard and the
 * granular permission guard. OR-of-permission read access (SUPPORT vs
 * BILLING scopes) is enforced inside the service rather than via the
 * permission decorator, which is AND-only.
 *
 * Every mutation:
 *  - declares an `@OperatorAudit` row so the action is persisted in
 *    `operator_audit_logs` with the actor, target, and request id.
 *  - declares an `@RequireOperatorPermissions` decorator that captures the
 *    minimal `_ALL` permission required to invoke the route. Service-level
 *    checks add fine-grained BILLING-scope variants for reply/note actions
 *    so finance admins can participate in handed-off cases without
 *    widening the permission registry.
 *  - marks `sensitive: true` for high-impact transitions (assign, status
 *    change, resolve, reopen, close, handoff) so the audit interceptor
 *    enforces a non-empty `reason` on every call.
 */
@Controller("operator/support-cases")
@UseGuards(OperatorJwtAuthGuard)
@UseInterceptors(OperatorAuditInterceptor)
export class SupportCasesController {
  constructor(private readonly service: SupportCasesService) {}

  // ── Queues / list / detail ────────────────────────────────────────────

  @Get()
  async list(@Req() req: Request, @Query() query: ListSupportCasesQueryDto) {
    const actor = this.requireActor(req);
    return this.service.listCases(actor, query);
  }

  @Get("queues/summary")
  async queueSummary(@Req() req: Request) {
    const actor = this.requireActor(req);
    return this.service.queueSummary(actor);
  }

  @Get(":caseId")
  async detail(@Req() req: Request, @Param("caseId") caseId: string) {
    const actor = this.requireActor(req);
    return this.service.getCase(actor, caseId);
  }

  // ── Create ───────────────────────────────────────────────────────────

  @Post()
  @UseGuards(OperatorPermissionGuard)
  @RequireOperatorPermissions(OPERATOR_PERMISSIONS.SUPPORT_CASE_CREATE_ALL)
  @OperatorAudit({
    action: "support_case.create",
    targetType: "support_case",
  })
  async create(@Req() req: Request, @Body() body: CreateSupportCaseDto) {
    const actor = this.requireActor(req);
    return this.service.createCase(actor, body);
  }

  // ── Patch (priority / category / tags) ───────────────────────────────

  @Patch(":caseId")
  @UseGuards(OperatorPermissionGuard)
  @RequireOperatorPermissions(OPERATOR_PERMISSIONS.SUPPORT_CASE_ASSIGN_ALL)
  @OperatorAudit({
    action: "support_case.update",
    targetType: "support_case",
    targetIdParam: "caseId",
  })
  async update(
    @Req() req: Request,
    @Param("caseId") caseId: string,
    @Body() body: UpdateSupportCaseDto,
  ) {
    const actor = this.requireActor(req);
    if (!body.priority && !body.category && !body.tags) {
      throw new BadRequestException({
        code: "SUPPORT_CASE_UPDATE_EMPTY",
        message:
          "Provide at least one of: priority, category, tags. Use the dedicated assign/status endpoints for those fields.",
      });
    }
    return this.service.updateCase(actor, caseId, {
      priority: body.priority,
      category: body.category,
      tags: body.tags,
    });
  }

  // ── Assign ───────────────────────────────────────────────────────────

  @Post(":caseId/assign")
  @UseGuards(OperatorPermissionGuard)
  @RequireOperatorPermissions(OPERATOR_PERMISSIONS.SUPPORT_CASE_ASSIGN_ALL)
  @OperatorAudit({
    action: "support_case.assign",
    targetType: "support_case",
    targetIdParam: "caseId",
    sensitive: true,
  })
  async assign(
    @Req() req: Request,
    @Param("caseId") caseId: string,
    @Body() body: AssignSupportCaseDto,
  ) {
    const actor = this.requireActor(req);
    return this.service.assignCase(
      actor,
      caseId,
      body.assigneeUserId ?? null,
      body.reason,
    );
  }

  // ── Status ────────────────────────────────────────────────────────────

  @Post(":caseId/status")
  @UseGuards(OperatorPermissionGuard)
  @RequireOperatorPermissions(OPERATOR_PERMISSIONS.SUPPORT_CASE_ASSIGN_ALL)
  @OperatorAudit({
    action: "support_case.status",
    targetType: "support_case",
    targetIdParam: "caseId",
    sensitive: true,
  })
  async setStatus(
    @Req() req: Request,
    @Param("caseId") caseId: string,
    @Body() body: SetStatusSupportCaseDto,
  ) {
    const actor = this.requireActor(req);
    return this.service.setStatus(
      actor,
      caseId,
      body.status,
      body.reason ?? null,
    );
  }

  @Post(":caseId/resolve")
  @UseGuards(OperatorPermissionGuard)
  @RequireOperatorPermissions(OPERATOR_PERMISSIONS.SUPPORT_CASE_RESOLVE_ALL)
  @OperatorAudit({
    action: "support_case.resolve",
    targetType: "support_case",
    targetIdParam: "caseId",
    sensitive: true,
  })
  async resolve(
    @Req() req: Request,
    @Param("caseId") caseId: string,
    @Body() body: ResolveSupportCaseDto,
  ) {
    const actor = this.requireActor(req);
    return this.service.resolveCase(
      actor,
      caseId,
      body.reason,
      body.closingMessage,
    );
  }

  @Post(":caseId/reopen")
  @UseGuards(OperatorPermissionGuard)
  @RequireOperatorPermissions(OPERATOR_PERMISSIONS.SUPPORT_CASE_RESOLVE_ALL)
  @OperatorAudit({
    action: "support_case.reopen",
    targetType: "support_case",
    targetIdParam: "caseId",
    sensitive: true,
  })
  async reopen(
    @Req() req: Request,
    @Param("caseId") caseId: string,
    @Body() body: ReopenSupportCaseDto,
  ) {
    const actor = this.requireActor(req);
    return this.service.reopenCase(actor, caseId, body.reason);
  }

  @Post(":caseId/close")
  @UseGuards(OperatorPermissionGuard)
  @RequireOperatorPermissions(OPERATOR_PERMISSIONS.SUPPORT_CASE_RESOLVE_ALL)
  @OperatorAudit({
    action: "support_case.close",
    targetType: "support_case",
    targetIdParam: "caseId",
    sensitive: true,
  })
  async close(
    @Req() req: Request,
    @Param("caseId") caseId: string,
    @Body() body: CloseSupportCaseDto,
  ) {
    const actor = this.requireActor(req);
    return this.service.closeCase(actor, caseId, body.reason);
  }

  // ── Messages and notes (OR-of-perms; service does the BILLING check) ─

  @Post(":caseId/messages")
  @OperatorAudit({
    action: "support_case.reply",
    targetType: "support_case",
    targetIdParam: "caseId",
  })
  async addMessage(
    @Req() req: Request,
    @Param("caseId") caseId: string,
    @Body() body: AddSupportCaseMessageDto,
  ) {
    const actor = this.requireActor(req);
    return this.service.addMessage(actor, caseId, body.body);
  }

  @Post(":caseId/notes")
  @OperatorAudit({
    action: "support_case.note",
    targetType: "support_case",
    targetIdParam: "caseId",
  })
  async addNote(
    @Req() req: Request,
    @Param("caseId") caseId: string,
    @Body() body: AddSupportCaseNoteDto,
  ) {
    const actor = this.requireActor(req);
    return this.service.addNote(actor, caseId, body.body);
  }

  // ── Linked resources ─────────────────────────────────────────────────

  @Post(":caseId/resources")
  @UseGuards(OperatorPermissionGuard)
  @RequireOperatorPermissions(OPERATOR_PERMISSIONS.SUPPORT_CASE_ASSIGN_ALL)
  @OperatorAudit({
    action: "support_case.resource.link",
    targetType: "support_case",
    targetIdParam: "caseId",
  })
  async linkResource(
    @Req() req: Request,
    @Param("caseId") caseId: string,
    @Body() body: LinkSupportCaseResourceDto,
  ) {
    const actor = this.requireActor(req);
    return this.service.linkResource(
      actor,
      caseId,
      body.resourceType,
      body.resourceId,
      body.label,
    );
  }

  @Delete(":caseId/resources/:linkId")
  @UseGuards(OperatorPermissionGuard)
  @RequireOperatorPermissions(OPERATOR_PERMISSIONS.SUPPORT_CASE_ASSIGN_ALL)
  @OperatorAudit({
    action: "support_case.resource.unlink",
    targetType: "support_case",
    targetIdParam: "caseId",
  })
  async unlinkResource(
    @Req() req: Request,
    @Param("caseId") caseId: string,
    @Param("linkId") linkId: string,
  ) {
    const actor = this.requireActor(req);
    return this.service.unlinkResource(actor, caseId, linkId);
  }

  // ── Handoffs ─────────────────────────────────────────────────────────

  @Post(":caseId/handoffs")
  @UseGuards(OperatorPermissionGuard)
  @RequireOperatorPermissions(OPERATOR_PERMISSIONS.SUPPORT_CASE_TRANSFER_ALL)
  @OperatorAudit({
    action: "support_case.handoff.open",
    targetType: "support_case",
    targetIdParam: "caseId",
    sensitive: true,
  })
  async openHandoff(
    @Req() req: Request,
    @Param("caseId") caseId: string,
    @Body() body: OpenSupportCaseHandoffDto,
  ) {
    const actor = this.requireActor(req);
    return this.service.openHandoff(actor, caseId, body.target, body.reason);
  }

  @Post(":caseId/handoffs/:handoffId/acknowledge")
  @OperatorAudit({
    action: "support_case.handoff.acknowledge",
    targetType: "support_case",
    targetIdParam: "caseId",
  })
  async acknowledgeHandoff(
    @Req() req: Request,
    @Param("caseId") caseId: string,
    @Param("handoffId") handoffId: string,
  ) {
    const actor = this.requireActor(req);
    return this.service.acknowledgeHandoff(actor, caseId, handoffId);
  }

  @Post(":caseId/handoffs/:handoffId/close")
  @UseGuards(OperatorPermissionGuard)
  @RequireOperatorPermissions(OPERATOR_PERMISSIONS.SUPPORT_CASE_TRANSFER_ALL)
  @OperatorAudit({
    action: "support_case.handoff.close",
    targetType: "support_case",
    targetIdParam: "caseId",
    sensitive: true,
  })
  async closeHandoff(
    @Req() req: Request,
    @Param("caseId") caseId: string,
    @Param("handoffId") handoffId: string,
    @Body() body: CloseSupportCaseHandoffDto,
  ) {
    const actor = this.requireActor(req);
    return this.service.closeHandoff(actor, caseId, handoffId, body.reason);
  }

  // ─── Internal helpers ─────────────────────────────────────────────────

  private requireActor(req: Request): SupportActor {
    const user = req.user as OperatorAuthenticatedRequestUser | undefined;
    if (!user || user.aud !== OPERATOR_JWT_AUDIENCE) {
      throw new UnauthorizedException({
        code: "OPERATOR_UNAUTHENTICATED",
        message: "Operator authentication is required.",
      });
    }
    return {
      id: user.id,
      email: user.email,
      platformRole: user.platformRole,
      permissions: getPermissionsForRole(user.platformRole),
    };
  }
}
