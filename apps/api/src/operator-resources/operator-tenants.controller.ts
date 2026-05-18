import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import type { Request } from "express";
import { TenantStatus } from "@prisma/client";
import { OperatorJwtAuthGuard } from "../auth/operator/guards/operator-jwt-auth.guard";
import { OperatorPermissionGuard } from "../auth/operator/permissions/operator-permission.guard";
import { OPERATOR_PERMISSIONS } from "../auth/operator/permissions/operator-permissions.registry";
import { RequireOperatorPermissions } from "../auth/operator/permissions/require-operator-permissions.decorator";
import { OperatorAuditInterceptor } from "../auth/operator/audit/operator-audit.interceptor";
import { AdminService } from "../admin/admin.service";
import {
  OperatorResourcesService,
  type TenantDetailResponse,
} from "./operator-resources.service";
import { OperatorTenantsQueryDto } from "./dto/operator-tenants-query.dto";
import type { OperatorAuthenticatedRequestUser } from "../auth/operator/operator-auth.types";

/**
 * Operator tenants list + Tenant 360 detail endpoints. All endpoints are
 * read-only in Phase 4 — mutations (suspend/reactivate) remain on the
 * admin module for now and will be migrated under the operator surface in
 * later phases together with their permission decorators.
 */
@Controller("operator/tenants")
@UseGuards(OperatorJwtAuthGuard, OperatorPermissionGuard)
@UseInterceptors(OperatorAuditInterceptor)
export class OperatorTenantsController {
  constructor(
    private readonly adminService: AdminService,
    private readonly operatorResources: OperatorResourcesService,
  ) {}

  @Get()
  @RequireOperatorPermissions(OPERATOR_PERMISSIONS.TENANT_LIST_ALL)
  async list(@Query() query: OperatorTenantsQueryDto) {
    const status =
      query.status && Object.values(TenantStatus).includes(query.status)
        ? query.status
        : undefined;

    // When the operator supplied a free-text search term, we use the
    // dedicated tenant search routine which is case-insensitive and bounded
    // to the requested limit. Otherwise we fall back to the existing
    // paginated list to keep the response shape compatible.
    if (query.q && query.q.length >= 2) {
      const data = await this.operatorResources.listTenantSearch({
        q: query.q,
        limit: query.limit ?? 20,
      });
      return {
        data: data.map((row) => ({
          id: row.id,
          slug: row.slug,
          name: row.name,
          status: row.status,
          planKey: null,
          siteCount: row.siteCount,
          memberCount: 0,
          createdAt: new Date(0).toISOString(),
        })),
        total: data.length,
        page: 1,
        limit: query.limit ?? 20,
        searchTerm: query.q,
      };
    }

    return this.adminService.listTenants({
      status,
      page: query.page,
      limit: query.limit,
    });
  }

  @Get(":tenantId")
  @RequireOperatorPermissions(OPERATOR_PERMISSIONS.TENANT_READ_ALL)
  async detail(
    @Param("tenantId") tenantId: string,
    @Req() req: Request,
  ): Promise<TenantDetailResponse> {
    // Finance also needs read access to tenant detail for billing context;
    // they hit `/operator/tenants/:id/billing` below. The main detail
    // endpoint requires the broader read.all permission.
    const _user = req.user as OperatorAuthenticatedRequestUser;
    void _user;
    return this.operatorResources.getTenantDetail({
      tenantId,
      includeBilling: true,
    });
  }

  /**
   * Billing-scoped tenant 360. Returns the same shape as the full detail
   * endpoint but is reachable with the finance-scoped read key.
   */
  @Get(":tenantId/billing")
  @RequireOperatorPermissions(OPERATOR_PERMISSIONS.TENANT_READ_BILLING)
  async detailBilling(
    @Param("tenantId") tenantId: string,
  ): Promise<TenantDetailResponse> {
    return this.operatorResources.getTenantDetail({
      tenantId,
      includeBilling: true,
    });
  }
}
