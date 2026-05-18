import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { Request } from "express";

import {
  OPERATOR_JWT_AUDIENCE,
  type OperatorAuthenticatedRequestUser,
} from "../auth/operator/operator-auth.types";
import { OperatorJwtAuthGuard } from "../auth/operator/guards/operator-jwt-auth.guard";
import { OperatorPermissionGuard } from "../auth/operator/permissions/operator-permission.guard";
import { RequireOperatorPermissions } from "../auth/operator/permissions/require-operator-permissions.decorator";
import { OPERATOR_PERMISSIONS } from "../auth/operator/permissions/operator-permissions.registry";
import { OperatorAuditInterceptor } from "../auth/operator/audit/operator-audit.interceptor";
import { OperatorAudit } from "../auth/operator/audit/operator-audit.decorator";

import {
  OperatorUserCreateDto,
  OperatorUserPasswordResetDto,
  OperatorUserReasonDto,
  OperatorUserRevokeDto,
  OperatorUserUpdateDto,
  OperatorUsersListQueryDto,
} from "./dto/operator-users.dto";
import { OperatorUsersService } from "./operator-users.service";

function requireActor(req: Request): OperatorAuthenticatedRequestUser {
  const user = req.user as OperatorAuthenticatedRequestUser | undefined;
  if (!user || user.aud !== OPERATOR_JWT_AUDIENCE) {
    throw new UnauthorizedException({
      code: "OPERATOR_AUTH_REQUIRED",
      message: "Operator authentication required",
    });
  }
  return user;
}

/**
 * Phase 11 — Operator user / permission management surface.
 *
 * Lives under `/operator/users` so it stays inside the operator JWT audience
 * (separate from the customer-facing `/users` controller). Every mutation is
 * permission-checked AND wrapped by `OperatorAuditInterceptor` with
 * `sensitive: true`, which enforces a non-empty `reason` in the request body
 * before the handler runs.
 */
@Controller("operator/users")
@UseGuards(OperatorJwtAuthGuard, OperatorPermissionGuard)
@UseInterceptors(OperatorAuditInterceptor)
export class OperatorUsersController {
  constructor(private readonly service: OperatorUsersService) {}

  // ── Reads ─────────────────────────────────────────────────────────

  @Get()
  @RequireOperatorPermissions(OPERATOR_PERMISSIONS.OPERATOR_USER_READ_ALL)
  async list(@Query() query: OperatorUsersListQueryDto) {
    return this.service.list({
      page: query.page,
      limit: query.limit,
      q: query.q,
      platformRole: query.platformRole,
      lockedOnly: query.lockedOnly,
    });
  }

  /**
   * Catalog of permission keys per role bundle. Used by the frontend
   * Permissions page (`/permissions`) and the role-change preview UI.
   * Placed BEFORE `/:operatorUserId` so it does not get shadowed.
   */
  @Get("role-bundles")
  @RequireOperatorPermissions(OPERATOR_PERMISSIONS.PERMISSION_MANAGE_ALL)
  async roleBundles() {
    return this.service.getRoleBundles();
  }

  @Get(":operatorUserId")
  @RequireOperatorPermissions(OPERATOR_PERMISSIONS.OPERATOR_USER_READ_ALL)
  async detail(@Param("operatorUserId") operatorUserId: string) {
    return this.service.detail(operatorUserId);
  }

  // ── Mutations ─────────────────────────────────────────────────────

  @Post()
  @HttpCode(201)
  @RequireOperatorPermissions(OPERATOR_PERMISSIONS.OPERATOR_USER_MANAGE_ALL)
  @OperatorAudit({
    action: "operator_user.create",
    targetType: "operator_user",
    sensitive: true,
  })
  async create(@Req() req: Request, @Body() body: OperatorUserCreateDto) {
    const actor = requireActor(req);
    return this.service.create({
      actorId: actor.id,
      actorRole: actor.platformRole,
      email: body.email,
      password: body.password,
      platformRole: body.platformRole,
    });
  }

  @Patch(":operatorUserId")
  @RequireOperatorPermissions(OPERATOR_PERMISSIONS.OPERATOR_USER_MANAGE_ALL)
  @OperatorAudit({
    action: "operator_user.update",
    targetType: "operator_user",
    targetIdParam: "operatorUserId",
    sensitive: true,
  })
  async update(
    @Req() req: Request,
    @Param("operatorUserId") operatorUserId: string,
    @Body() body: OperatorUserUpdateDto,
  ) {
    const actor = requireActor(req);
    return this.service.update({
      actorId: actor.id,
      actorRole: actor.platformRole,
      operatorUserId,
      email: body.email,
      platformRole: body.platformRole,
    });
  }

  @Post(":operatorUserId/password-reset")
  @HttpCode(200)
  @RequireOperatorPermissions(OPERATOR_PERMISSIONS.OPERATOR_USER_MANAGE_ALL)
  @OperatorAudit({
    action: "operator_user.password_reset",
    targetType: "operator_user",
    targetIdParam: "operatorUserId",
    sensitive: true,
  })
  async resetPassword(
    @Req() req: Request,
    @Param("operatorUserId") operatorUserId: string,
    @Body() body: OperatorUserPasswordResetDto,
  ) {
    const actor = requireActor(req);
    return this.service.resetPassword({
      actorId: actor.id,
      operatorUserId,
      newPassword: body.password,
    });
  }

  @Post(":operatorUserId/unlock")
  @HttpCode(200)
  @RequireOperatorPermissions(OPERATOR_PERMISSIONS.OPERATOR_USER_MANAGE_ALL)
  @OperatorAudit({
    action: "operator_user.unlock",
    targetType: "operator_user",
    targetIdParam: "operatorUserId",
    sensitive: true,
  })
  async unlock(
    @Req() req: Request,
    @Param("operatorUserId") operatorUserId: string,
    @Body() _body: OperatorUserReasonDto,
  ) {
    const actor = requireActor(req);
    return this.service.unlock({ actorId: actor.id, operatorUserId });
  }

  @Post(":operatorUserId/revoke-sessions")
  @HttpCode(200)
  @RequireOperatorPermissions(OPERATOR_PERMISSIONS.OPERATOR_USER_MANAGE_ALL)
  @OperatorAudit({
    action: "operator_user.revoke_sessions",
    targetType: "operator_user",
    targetIdParam: "operatorUserId",
    sensitive: true,
  })
  async revokeSessions(
    @Req() req: Request,
    @Param("operatorUserId") operatorUserId: string,
    @Body() body: OperatorUserRevokeDto,
  ) {
    const actor = requireActor(req);
    return this.service.revokeSessions({
      actorId: actor.id,
      operatorUserId,
      reason: body.reason,
    });
  }

  @Delete(":operatorUserId")
  @RequireOperatorPermissions(OPERATOR_PERMISSIONS.OPERATOR_USER_MANAGE_ALL)
  @OperatorAudit({
    action: "operator_user.revoke",
    targetType: "operator_user",
    targetIdParam: "operatorUserId",
    sensitive: true,
  })
  async revoke(
    @Req() req: Request,
    @Param("operatorUserId") operatorUserId: string,
    @Body() _body: OperatorUserReasonDto,
  ) {
    const actor = requireActor(req);
    return this.service.revoke({
      actorId: actor.id,
      actorRole: actor.platformRole,
      operatorUserId,
    });
  }
}
