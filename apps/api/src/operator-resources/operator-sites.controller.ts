import {
  Controller,
  Get,
  Param,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { OperatorJwtAuthGuard } from "../auth/operator/guards/operator-jwt-auth.guard";
import { OperatorPermissionGuard } from "../auth/operator/permissions/operator-permission.guard";
import { OPERATOR_PERMISSIONS } from "../auth/operator/permissions/operator-permissions.registry";
import { RequireOperatorPermissions } from "../auth/operator/permissions/require-operator-permissions.decorator";
import { OperatorAuditInterceptor } from "../auth/operator/audit/operator-audit.interceptor";
import {
  OperatorResourcesService,
  type SiteDetailResponse,
} from "./operator-resources.service";

/**
 * Site 360 read-only endpoint. Mounted under `/operator/sites/:siteId` so it
 * is reachable from any operator surface (tenant detail, command center,
 * global search). All operator roles with `site.read.all` (Platform Owner,
 * Support Admin, Finance Admin) may read site detail; mutation endpoints
 * (suspend, restore) live in later phases.
 */
@Controller("operator/sites")
@UseGuards(OperatorJwtAuthGuard, OperatorPermissionGuard)
@UseInterceptors(OperatorAuditInterceptor)
export class OperatorSitesController {
  constructor(private readonly operatorResources: OperatorResourcesService) {}

  @Get(":siteId")
  @RequireOperatorPermissions(OPERATOR_PERMISSIONS.SITE_READ_ALL)
  async detail(@Param("siteId") siteId: string): Promise<SiteDetailResponse> {
    return this.operatorResources.getSiteDetail(siteId);
  }
}
