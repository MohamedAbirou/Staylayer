import { Controller, Get, UseGuards } from "@nestjs/common";
import { PlatformRole } from "@prisma/client";
import { PlatformRoles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { AdminService } from "./admin.service";

@Controller("admin/overview")
@UseGuards(JwtAuthGuard, RolesGuard)
@PlatformRoles(
  PlatformRole.PLATFORM_OWNER,
  PlatformRole.SUPPORT_ADMIN,
  PlatformRole.FINANCE_ADMIN,
)
export class AdminOverviewController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  async getOverview() {
    return this.adminService.getOverview();
  }
}
