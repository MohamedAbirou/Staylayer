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
import { TenantMembershipRole } from "@prisma/client";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { MembershipRoles } from "../auth/decorators/roles.decorator";
import { AuthenticatedRequestUser } from "../auth/auth.types";
import { WorkspaceAccessService } from "../auth/workspace-access.service";
import { BillingService } from "./billing.service";
import { CreateCheckoutSessionDto } from "./dto/create-checkout-session.dto";
import { CreatePortalSessionDto } from "./dto/create-portal-session.dto";
import { BILLING_PLANS, isBillingPlanKey } from "./billing-plans";

@Controller("tenants/:tenantId/billing")
@UseGuards(JwtAuthGuard, RolesGuard)
@MembershipRoles(TenantMembershipRole.OWNER, TenantMembershipRole.BILLING)
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
    private readonly workspaceAccessService: WorkspaceAccessService,
  ) {}

  @Get("plan")
  async getPlan(@Param("tenantId") tenantId: string, @Req() req: Request) {
    const resolvedTenantId =
      await this.workspaceAccessService.ensureTenantAccess(
        req as Request & {
          user?: AuthenticatedRequestUser;
          query: Record<string, unknown>;
          headers: Record<string, string | string[] | undefined>;
          params: Record<string, string>;
        },
        tenantId,
      );
    const snapshot =
      await this.billingService.getTenantPlanSnapshot(resolvedTenantId);

    return {
      planId: snapshot.planKey,
      planKey: snapshot.planKey,
      planName: snapshot.planName,
      description: snapshot.description,
      status: snapshot.status,
      renewsAt: snapshot.renewsAt?.toISOString() ?? null,
      currentPeriodStart: snapshot.currentPeriodStart?.toISOString() ?? null,
      gracePeriodEndsAt: snapshot.gracePeriodEndsAt?.toISOString() ?? null,
      limits: snapshot.limits,
      usage: snapshot.usage,
      provider: snapshot.provider,
      providerCustomerId: snapshot.providerCustomerId,
      providerSubscriptionId: snapshot.providerSubscriptionId,
      cancelAtPeriodEnd: snapshot.cancelAtPeriodEnd,
      actions: snapshot.actions,
      lastWebhookAt: snapshot.lastWebhookAt?.toISOString() ?? null,
      source: snapshot.source,
      subscriptionId: snapshot.subscriptionId,
      isFreePlan: snapshot.isFreePlan,
    };
  }

  @Get("plans")
  listPlans() {
    return Object.values(BILLING_PLANS).map((plan) => ({
      key: plan.key,
      name: plan.name,
      description: plan.description,
      isFree: plan.isFree,
      limits: plan.limits,
    }));
  }

  @Post("checkout-session")
  async createCheckoutSession(
    @Param("tenantId") tenantId: string,
    @Body() dto: CreateCheckoutSessionDto,
    @Req() req: Request,
  ) {
    const resolvedTenantId =
      await this.workspaceAccessService.ensureTenantAccess(
        req as Request & {
          user?: AuthenticatedRequestUser;
          query: Record<string, unknown>;
          headers: Record<string, string | string[] | undefined>;
          params: Record<string, string>;
        },
        tenantId,
      );

    if (!isBillingPlanKey(dto.planKey)) {
      throw new BadRequestException({
        code: "UNKNOWN_PLAN_KEY",
        message: `Unsupported billing plan '${dto.planKey}'`,
      });
    }

    const user = req.user as AuthenticatedRequestUser;

    return this.billingService.createCheckoutSession(
      resolvedTenantId,
      dto.planKey,
      user,
      {
        successUrl: dto.successUrl,
        cancelUrl: dto.cancelUrl,
      },
    );
  }

  @Post("portal-session")
  async createPortalSession(
    @Param("tenantId") tenantId: string,
    @Body() dto: CreatePortalSessionDto,
    @Req() req: Request,
  ) {
    const resolvedTenantId =
      await this.workspaceAccessService.ensureTenantAccess(
        req as Request & {
          user?: AuthenticatedRequestUser;
          query: Record<string, unknown>;
          headers: Record<string, string | string[] | undefined>;
          params: Record<string, string>;
        },
        tenantId,
      );

    return this.billingService.createPortalSession(
      resolvedTenantId,
      dto.returnUrl,
    );
  }
}
