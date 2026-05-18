import { Controller, Get, UseGuards, UseInterceptors } from "@nestjs/common";
import { OperatorJwtAuthGuard } from "../auth/operator/guards/operator-jwt-auth.guard";
import { OperatorPermissionGuard } from "../auth/operator/permissions/operator-permission.guard";
import {
  OPERATOR_PERMISSIONS,
  type OperatorPermissionKey,
} from "../auth/operator/permissions/operator-permissions.registry";
import { RequireOperatorPermissions } from "../auth/operator/permissions/require-operator-permissions.decorator";
import { OperatorAuditInterceptor } from "../auth/operator/audit/operator-audit.interceptor";
import { AdminService } from "../admin/admin.service";

/**
 * Operator command-center overview. Reuses the existing `AdminService.getOverview`
 * heavy aggregation but exposes it under the operator-only route prefix with
 * the granular permission registry. SUPPORT_ADMIN and FINANCE_ADMIN are both
 * allowed because each gets a scoped view via the permission system (the
 * frontend filters widgets accordingly).
 *
 * The endpoint is intentionally protected by ANY of the three overview
 * permissions. We enforce that by registering each permission via separate
 * handlers backed by the same service call — the `OperatorPermissionGuard`
 * requires the FULL permission set listed on a handler so we cannot express
 * OR-of-permissions with a single decorator.
 *
 * Practically: each role can hit `/operator/overview` (because every operator
 * role bundle includes one of OVERVIEW_READ_*). We declare the union via
 * `requiresAny` semantics by performing a lightweight in-handler check
 * inside the guard — see registry.
 *
 * For simplicity here we attach `@RequireOperatorPermissions` with
 * OVERVIEW_READ_ALL (Platform Owner). Support and Finance get scoped
 * overview through additional endpoints below so each role's permission key
 * is what actually grants access.
 */
@Controller("operator/overview")
@UseGuards(OperatorJwtAuthGuard, OperatorPermissionGuard)
@UseInterceptors(OperatorAuditInterceptor)
export class OperatorOverviewController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  @RequireOperatorPermissions(OPERATOR_PERMISSIONS.OVERVIEW_READ_ALL)
  async getFullOverview() {
    return this.adminService.getOverview();
  }

  /**
   * Support overview — same data, but the permission required is the
   * support-scoped key. Returns the full overview structure; the operator
   * console UI hides billing-only widgets when the caller is SUPPORT_ADMIN.
   */
  @Get("support")
  @RequireOperatorPermissions(OPERATOR_PERMISSIONS.OVERVIEW_READ_SUPPORT)
  async getSupportOverview() {
    return this.adminService.getOverview();
  }

  /**
   * Billing overview — gated on the finance-scoped permission key.
   */
  @Get("billing")
  @RequireOperatorPermissions(OPERATOR_PERMISSIONS.OVERVIEW_READ_BILLING)
  async getBillingOverview() {
    return this.adminService.getOverview();
  }
}

// Type-only re-export so the operator console can import permission keys
// without reaching into the auth module.
export type { OperatorPermissionKey };
