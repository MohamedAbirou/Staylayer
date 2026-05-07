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
import { DomainStatus, PlatformRole } from "@prisma/client";
import { Request } from "express";
import { AdminService } from "../admin/admin.service";
import { AuthenticatedRequestUser } from "../auth/auth.types";
import { PlatformRoles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { DomainsService } from "./domains.service";
import { AdminDomainsQueryDto } from "./dto/domain-query.dto";

@Controller("admin/domains")
@UseGuards(JwtAuthGuard, RolesGuard)
@PlatformRoles(
  PlatformRole.PLATFORM_OWNER,
  PlatformRole.SUPPORT_ADMIN,
  PlatformRole.FINANCE_ADMIN,
)
export class AdminDomainsController {
  constructor(
    private readonly domainsService: DomainsService,
    private readonly adminService: AdminService,
  ) {}

  @Get()
  async list(@Query() query: AdminDomainsQueryDto) {
    const statuses = this.resolveStatuses(query);

    return this.domainsService.adminList({
      statuses,
      page: query.page,
      limit: query.limit,
    });
  }

  @Post(":id/retry-verification")
  @HttpCode(HttpStatus.OK)
  @PlatformRoles(PlatformRole.PLATFORM_OWNER, PlatformRole.SUPPORT_ADMIN)
  async retryVerification(@Param("id") id: string, @Req() req: Request) {
    const domain = await this.domainsService.adminRetryVerification(id);
    const user = req.user as AuthenticatedRequestUser | undefined;

    await this.adminService.createAuditLogForSite({
      siteId: domain.siteId,
      actorUserId: user?.sub ?? null,
      action: "domain.retry_verification",
      targetType: "domain",
      targetId: domain.id,
      metadata: {
        domain: domain.domain,
      },
    });

    return domain;
  }

  private resolveStatuses(
    query: AdminDomainsQueryDto,
  ): DomainStatus[] | undefined {
    if (query.verificationStatus === "UNVERIFIED") {
      return [DomainStatus.PENDING];
    }

    if (query.verificationStatus === "PENDING") {
      return [DomainStatus.DNS_REQUIRED, DomainStatus.VERIFYING];
    }

    if (query.verificationStatus === "VERIFIED") {
      return [DomainStatus.ACTIVE];
    }

    if (query.verificationStatus === "FAILED") {
      return [DomainStatus.FAILED];
    }

    if (query.status && query.status in DomainStatus) {
      return [query.status as DomainStatus];
    }

    return undefined;
  }
}
