import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { TenantStatus, PlatformRole } from "@prisma/client";
import { Request } from "express";
import { AuthenticatedRequestUser } from "../auth/auth.types";
import { PlatformRoles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { AdminTenantsQueryDto } from "./dto/admin-tenants-query.dto";
import { AdminService } from "./admin.service";

@Controller("admin/tenants")
@UseGuards(JwtAuthGuard, RolesGuard)
@PlatformRoles(
  PlatformRole.PLATFORM_OWNER,
  PlatformRole.SUPPORT_ADMIN,
  PlatformRole.FINANCE_ADMIN,
)
export class AdminTenantsController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  async list(@Query() query: AdminTenantsQueryDto) {
    const status =
      query.status && query.status in TenantStatus
        ? (query.status as TenantStatus)
        : undefined;

    return this.adminService.listTenants({
      status,
      page: query.page,
      limit: query.limit,
    });
  }

  @Post(":tenantId/suspend")
  @HttpCode(HttpStatus.OK)
  @PlatformRoles(PlatformRole.PLATFORM_OWNER)
  async suspend(@Param("tenantId") tenantId: string, @Req() req: Request) {
    const user = req.user as AuthenticatedRequestUser | undefined;

    await this.adminService.updateTenantStatus({
      tenantId,
      nextStatus: TenantStatus.SUSPENDED,
      actorUserId: user?.sub ?? null,
    });
  }

  @Post(":tenantId/reactivate")
  @HttpCode(HttpStatus.OK)
  @PlatformRoles(PlatformRole.PLATFORM_OWNER)
  async reactivate(@Param("tenantId") tenantId: string, @Req() req: Request) {
    const user = req.user as AuthenticatedRequestUser | undefined;

    await this.adminService.updateTenantStatus({
      tenantId,
      nextStatus: TenantStatus.ACTIVE,
      actorUserId: user?.sub ?? null,
    });
  }
}
