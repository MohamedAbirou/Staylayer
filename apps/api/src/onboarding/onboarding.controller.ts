import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Request } from "express";
import { OnboardingMilestoneKey, TenantMembershipRole } from "@prisma/client";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { MembershipRoles } from "../auth/decorators/roles.decorator";
import { WorkspaceAccessService } from "../auth/workspace-access.service";
import { AuthenticatedRequestUser } from "../auth/auth.types";
import { OnboardingService } from "./onboarding.service";

type ScopedRequest = Request & {
  user?: AuthenticatedRequestUser;
  query: Record<string, unknown>;
  headers: Record<string, string | string[] | undefined>;
  params: Record<string, string>;
};

@Controller("tenants/:tenantId/onboarding")
@UseGuards(JwtAuthGuard, RolesGuard)
@MembershipRoles(
  TenantMembershipRole.OWNER,
  TenantMembershipRole.ADMIN,
  TenantMembershipRole.EDITOR,
  TenantMembershipRole.BILLING,
)
export class OnboardingController {
  constructor(
    private readonly onboardingService: OnboardingService,
    private readonly workspaceAccess: WorkspaceAccessService,
  ) {}

  @Get()
  async getSnapshot(
    @Param("tenantId") tenantId: string,
    @Req() req: Request,
  ) {
    const resolved = await this.workspaceAccess.ensureTenantAccess(
      req as ScopedRequest,
      tenantId,
    );
    return this.onboardingService.getSnapshot(resolved);
  }

  @Post("milestones")
  async markMilestone(
    @Param("tenantId") tenantId: string,
    @Body() body: { milestone?: string },
    @Req() req: Request,
  ) {
    const resolved = await this.workspaceAccess.ensureTenantAccess(
      req as ScopedRequest,
      tenantId,
    );
    const candidate = body.milestone;
    const validValues = Object.values(OnboardingMilestoneKey) as string[];
    if (!candidate || !validValues.includes(candidate)) {
      throw new BadRequestException({
        code: "INVALID_MILESTONE",
        message: "Unknown onboarding milestone",
      });
    }
    return this.onboardingService.markMilestone(
      resolved,
      candidate as OnboardingMilestoneKey,
    );
  }
}
