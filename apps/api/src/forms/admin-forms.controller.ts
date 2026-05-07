import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { PlatformRole } from "@prisma/client";
import { PlatformRoles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { FormsService } from "./forms.service";
import { AdminFormsQueryDto } from "./dto/submission-query.dto";

@Controller("admin/forms")
@UseGuards(JwtAuthGuard, RolesGuard)
@PlatformRoles(
  PlatformRole.PLATFORM_OWNER,
  PlatformRole.SUPPORT_ADMIN,
  PlatformRole.FINANCE_ADMIN,
)
export class AdminFormsController {
  constructor(private readonly formsService: FormsService) {}

  @Get("summary")
  async summary(@Query() query: AdminFormsQueryDto) {
    return this.formsService.getAdminSummary({
      page: query.page,
      limit: query.limit,
    });
  }
}
