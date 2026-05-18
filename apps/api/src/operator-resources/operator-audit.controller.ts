import {
  Controller,
  Get,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import type { Request } from "express";
import { OperatorJwtAuthGuard } from "../auth/operator/guards/operator-jwt-auth.guard";
import { OperatorAuditInterceptor } from "../auth/operator/audit/operator-audit.interceptor";
import { OperatorResourcesService } from "./operator-resources.service";
import { OperatorAuditQueryDto } from "./dto/operator-audit-query.dto";
import {
  OPERATOR_JWT_AUDIENCE,
  type OperatorAuthenticatedRequestUser,
} from "../auth/operator/operator-auth.types";

/**
 * Audit log v1 — combined feed over `operator_audit_logs` (operator
 * mutations) and the legacy per-tenant `audit_logs` table (customer-domain
 * actions). Authorisation is enforced inline against the operator's role
 * bundle so support/finance admins automatically receive their scoped feed
 * without needing distinct endpoints.
 *
 * Why inline (vs `@RequireOperatorPermissions`)?
 *  - The three audit permission keys (`audit.read.{all,support,billing}`)
 *    are intentionally non-overlapping. The granular permission guard
 *    enforces AND semantics, so we cannot express "at least one of these
 *    keys grants access" with a single decorator. Inline scope resolution
 *    keeps the guard-level invariant unchanged and centralises the
 *    role-to-scope mapping in `OperatorResourcesService.resolveAuditScope`.
 */
@Controller("operator/audit")
@UseGuards(OperatorJwtAuthGuard)
@UseInterceptors(OperatorAuditInterceptor)
export class OperatorAuditController {
  constructor(private readonly operatorResources: OperatorResourcesService) {}

  @Get()
  async list(@Req() req: Request, @Query() query: OperatorAuditQueryDto) {
    const user = req.user as OperatorAuthenticatedRequestUser | undefined;
    if (!user || user.aud !== OPERATOR_JWT_AUDIENCE) {
      throw new UnauthorizedException({
        code: "OPERATOR_UNAUTHENTICATED",
        message: "Operator authentication is required",
      });
    }

    return this.operatorResources.listAudit({
      role: user.platformRole,
      scope: query.scope,
      action: query.action,
      tenantId: query.tenantId,
      siteId: query.siteId,
      actorUserId: query.actorUserId,
      page: query.page,
      limit: query.limit,
    });
  }
}
