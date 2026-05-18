import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { TenantMembershipRole } from "@prisma/client";
import { Request } from "express";

import { AuthenticatedRequestUser } from "../auth/auth.types";
import { MembershipRoles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { WorkspaceAccessService } from "../auth/workspace-access.service";
import { PermanentDeleteTenantDto } from "../tenant-workspace/dto/permanent-delete-tenant.dto";
import { TenantDeletionService } from "./tenant-deletion.service";

type TenantScopedRequest = Request & {
  user?: AuthenticatedRequestUser;
  query: Record<string, unknown>;
  headers: Record<string, string | string[] | undefined>;
  params: Record<string, string>;
};

/**
 * Tenant-scoped endpoints: impact summary and queue. Both require the actor to
 * be an OWNER of the workspace and survive a normal tenant guard chain.
 */
@Controller("tenants/:tenantId")
@UseGuards(JwtAuthGuard, RolesGuard)
export class TenantDeletionController {
  constructor(
    private readonly tenantDeletionService: TenantDeletionService,
    private readonly workspaceAccessService: WorkspaceAccessService,
  ) {}

  @Get("deletion-impact")
  @MembershipRoles(TenantMembershipRole.OWNER)
  async getImpact(@Param("tenantId") tenantId: string, @Req() req: Request) {
    const resolvedTenantId =
      await this.workspaceAccessService.ensureTenantAccess(
        req as TenantScopedRequest,
        tenantId,
      );
    const user = (req as TenantScopedRequest).user;
    return this.tenantDeletionService.computeDeletionImpact(
      resolvedTenantId,
      user?.sub,
    );
  }

  @Post("permanent-delete")
  @MembershipRoles(TenantMembershipRole.OWNER)
  async queueDelete(
    @Param("tenantId") tenantId: string,
    @Body() dto: PermanentDeleteTenantDto,
    @Req() req: Request,
  ) {
    const resolvedTenantId =
      await this.workspaceAccessService.ensureTenantAccess(
        req as TenantScopedRequest,
        tenantId,
      );
    const user = (req as TenantScopedRequest).user;
    if (!user) {
      throw new Error("Authenticated user missing on request");
    }
    return this.tenantDeletionService.queuePermanentDeletion(
      resolvedTenantId,
      dto,
      user.sub,
    );
  }
}

/**
 * Job-status endpoint. Intentionally NOT tenant-scoped — the underlying
 * tenant (and the actor's membership) may be destroyed mid-poll, after which
 * the regular tenant guard chain would reject the request. We authorize
 * solely by `requestedByUserId === currentUserId` so the original requester
 * can still observe the final COMPLETED state.
 */
@Controller("tenant-deletion-jobs")
@UseGuards(JwtAuthGuard)
export class TenantDeletionJobsController {
  constructor(private readonly tenantDeletionService: TenantDeletionService) {}

  @Get(":jobId")
  async getOne(@Param("jobId") jobId: string, @Req() req: Request) {
    const user = (req as TenantScopedRequest).user;
    if (!user) {
      throw new Error("Authenticated user missing on request");
    }
    return this.tenantDeletionService.getJobForRequester(jobId, user.sub);
  }
}
