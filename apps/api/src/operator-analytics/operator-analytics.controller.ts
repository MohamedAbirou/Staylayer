import {
  Controller,
  Get,
  Query,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { OperatorJwtAuthGuard } from "../auth/operator/guards/operator-jwt-auth.guard";
import { OperatorPermissionGuard } from "../auth/operator/permissions/operator-permission.guard";
import { OPERATOR_PERMISSIONS } from "../auth/operator/permissions/operator-permissions.registry";
import { RequireOperatorPermissions } from "../auth/operator/permissions/require-operator-permissions.decorator";
import { OperatorAuditInterceptor } from "../auth/operator/audit/operator-audit.interceptor";
import {
  OperatorAnalyticsService,
  parseRangeDays,
} from "./operator-analytics.service";
import { AnalyticsRangeDto, TenantHealthQueryDto } from "./dto";

/**
 * Phase 10 — Operator analytics surface.
 *
 * Each endpoint is gated by the most-specific permission key so the role
 * bundles do not need to inherit `ANALYTICS_READ_ALL`. `PLATFORM_OWNER`
 * implicitly satisfies every key via the registry's `.all` superset
 * semantics.
 *
 * All endpoints are read-only — no `@OperatorAudit` decorator is attached
 * because the responses do not mutate platform state. The audit interceptor
 * is still installed so failed access attempts (403s) appear in the audit
 * log alongside every other operator request.
 */
@Controller("operator/analytics")
@UseGuards(OperatorJwtAuthGuard, OperatorPermissionGuard)
@UseInterceptors(OperatorAuditInterceptor)
export class OperatorAnalyticsController {
  constructor(private readonly analytics: OperatorAnalyticsService) {}

  @Get("business")
  @RequireOperatorPermissions(OPERATOR_PERMISSIONS.ANALYTICS_READ_BUSINESS)
  async getBusiness(@Query() query: AnalyticsRangeDto) {
    const range = parseRangeDays(query.range);
    return this.analytics.getBusinessAnalytics(range);
  }

  @Get("support")
  @RequireOperatorPermissions(OPERATOR_PERMISSIONS.ANALYTICS_READ_SUPPORT)
  async getSupport(@Query() query: AnalyticsRangeDto) {
    const range = parseRangeDays(query.range);
    return this.analytics.getSupportAnalytics(range);
  }

  @Get("operations")
  @RequireOperatorPermissions(OPERATOR_PERMISSIONS.ANALYTICS_READ_OPERATIONS)
  async getOperations(@Query() query: AnalyticsRangeDto) {
    const range = parseRangeDays(query.range);
    return this.analytics.getOperationsAnalytics(range);
  }

  @Get("tenant-health")
  @RequireOperatorPermissions(OPERATOR_PERMISSIONS.ANALYTICS_READ_ALL)
  async getTenantHealth(@Query() query: TenantHealthQueryDto) {
    return this.analytics.getTenantHealth({
      page: query.page ?? 1,
      limit: query.limit ?? 25,
      minScore: query.minScore,
      maxScore: query.maxScore,
      sort: query.sort,
      direction: query.direction,
    });
  }
}

@Controller("operator/observability")
@UseGuards(OperatorJwtAuthGuard, OperatorPermissionGuard)
@UseInterceptors(OperatorAuditInterceptor)
export class OperatorObservabilityController {
  constructor(private readonly analytics: OperatorAnalyticsService) {}

  @Get()
  @RequireOperatorPermissions(OPERATOR_PERMISSIONS.OBSERVABILITY_READ_ALL)
  async getObservability() {
    return this.analytics.getObservability();
  }
}
