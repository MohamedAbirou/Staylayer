import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { PlatformRole } from "@prisma/client";
import { PlatformRoles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { BillingService } from "./billing.service";
import { AdminSubscriptionsQueryDto } from "./dto/admin-subscriptions-query.dto";

@Controller("admin/subscriptions")
@UseGuards(JwtAuthGuard, RolesGuard)
@PlatformRoles(
  PlatformRole.PLATFORM_OWNER,
  PlatformRole.SUPPORT_ADMIN,
  PlatformRole.FINANCE_ADMIN,
)
export class AdminSubscriptionsController {
  constructor(private readonly billingService: BillingService) {}

  @Get()
  async findAll(@Query() query: AdminSubscriptionsQueryDto) {
    const result = await this.billingService.listAdminSubscriptions({
      status: query.status,
      page: query.page,
      limit: query.limit,
    });

    return {
      data: result.data,
      total: result.total,
    };
  }
}
