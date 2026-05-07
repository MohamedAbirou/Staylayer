import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { PlatformRole } from "@prisma/client";
import { PlatformRoles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { AdminAuditQueryDto } from "./dto/admin-audit-query.dto";
import { AdminService } from "./admin.service";

@Controller("admin/audit")
@UseGuards(JwtAuthGuard, RolesGuard)
@PlatformRoles(
  PlatformRole.PLATFORM_OWNER,
  PlatformRole.SUPPORT_ADMIN,
  PlatformRole.FINANCE_ADMIN,
)
export class AdminAuditController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  async list(@Query() query: AdminAuditQueryDto) {
    return this.adminService.listAuditLog({
      page: query.page,
      limit: query.limit,
    });
  }
}
