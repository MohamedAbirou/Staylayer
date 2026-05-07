import { Injectable, NotFoundException } from "@nestjs/common";
import {
  DeploymentStatus,
  DomainStatus,
  FormDeliveryStatus,
  OperationalAlertSeverity,
  OperationalAlertStatus,
  OperationalAlertType,
  Prisma,
  SiteStatus,
  SubscriptionStatus,
  TenantStatus,
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  BILLING_DEFAULT_TRIAL_DAYS,
  getBillingPlan,
  isBillingPlanKey,
} from "../billing/billing-plans";
import { BillingPublicStatus } from "../billing/billing.types";

type AuditMetadata = Record<string, unknown> | null | undefined;

type AdminCommercialSnapshot = {
  planKey: string;
  planName: string;
  status: BillingPublicStatus;
  renewsAt: string | null;
  gracePeriodEndsAt: string | null;
  source: "stripe" | "default_trial";
  needsAttention: boolean;
  trialEndingSoon: boolean;
};

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(): Promise<{
    generatedAt: string;
    scorecards: {
      tenants: {
        total: number;
        active: number;
        suspended: number;
        archived: number;
        newLast30Days: number;
      };
      billing: {
        active: number;
        trialing: number;
        pastDue: number;
        canceled: number;
        inactive: number;
      };
      deployments: {
        liveSites: number;
        buildingSites: number;
        failedSites: number;
        pendingSites: number;
        unprovisionedSites: number;
        liveRate: number;
      };
      domains: {
        activeDomains: number;
        pendingDomains: number;
        failedDomains: number;
        sslProvisioningDomains: number;
        sitesMissingPrimaryDomain: number;
      };
      operations: {
        openAlerts: number;
        criticalAlerts: number;
        submissionsLast30Days: number;
        failedDeliveriesLast30Days: number;
      };
    };
    planMix: Array<{
      planKey: string;
      planName: string;
      tenantCount: number;
      activeCount: number;
      trialCount: number;
      attentionCount: number;
    }>;
    tenantHealth: Array<{
      tenantId: string;
      tenantName: string;
      tenantStatus: TenantStatus;
      planName: string;
      billingStatus: BillingPublicStatus;
      healthScore: number;
      siteCount: number;
      liveSites: number;
      failedSites: number;
      sitesMissingPrimaryDomain: number;
      openAlerts: number;
      reasons: string[];
    }>;
    queues: {
      billingAttention: Array<{
        tenantId: string;
        tenantName: string;
        planName: string;
        billingStatus: BillingPublicStatus;
        renewsAt: string | null;
        reason: string;
      }>;
      deploymentFailures: Array<{
        deploymentId: string;
        tenantId: string;
        tenantName: string;
        siteId: string;
        siteName: string;
        status: DeploymentStatus;
        errorMessage: string | null;
        updatedAt: string;
      }>;
      domainIssues: Array<{
        domainId: string;
        tenantId: string;
        tenantName: string;
        siteId: string;
        siteName: string;
        hostname: string;
        status: DomainStatus;
        lastError: string | null;
        lastCheckedAt: string | null;
      }>;
      formAlerts: Array<{
        tenantId: string;
        tenantName: string;
        siteId: string;
        siteName: string;
        critical: boolean;
        alertTypes: OperationalAlertType[];
        messages: string[];
        lastTriggeredAt: string | null;
      }>;
      recentAudit: Array<{
        id: string;
        actorId: string;
        actorEmail: string;
        action: string;
        targetType: string | null;
        targetId: string | null;
        meta: Record<string, unknown> | null;
        createdAt: string;
      }>;
    };
  }> {
    const now = new Date();
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [tenants, submissionsLast30Days, failedDeliveriesLast30Days, audit] =
      await Promise.all([
        this.prisma.tenant.findMany({
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            name: true,
            status: true,
            createdAt: true,
            subscriptions: {
              orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
              take: 1,
              select: {
                planKey: true,
                status: true,
                currentPeriodEnd: true,
                gracePeriodEndsAt: true,
              },
            },
            sites: {
              where: {
                status: { not: SiteStatus.ARCHIVED },
              },
              select: {
                id: true,
                name: true,
                deployments: {
                  orderBy: [{ createdAt: "desc" }],
                  take: 1,
                  select: {
                    id: true,
                    status: true,
                    errorMessage: true,
                    updatedAt: true,
                  },
                },
                domains: {
                  select: {
                    id: true,
                    host: true,
                    status: true,
                    isPrimary: true,
                    lastError: true,
                    lastCheckedAt: true,
                  },
                },
                alerts: {
                  where: {
                    status: OperationalAlertStatus.OPEN,
                  },
                  select: {
                    type: true,
                    severity: true,
                    message: true,
                    lastTriggeredAt: true,
                  },
                },
              },
            },
          },
        }),
        this.prisma.formSubmission.count({
          where: {
            createdAt: { gte: last30Days },
            site: {
              status: { not: SiteStatus.ARCHIVED },
            },
          },
        }),
        this.prisma.formDelivery.count({
          where: {
            status: FormDeliveryStatus.FAILED,
            createdAt: { gte: last30Days },
            site: {
              status: { not: SiteStatus.ARCHIVED },
            },
          },
        }),
        this.listAuditLog({ limit: 8 }),
      ]);

    const scorecards = {
      tenants: {
        total: tenants.length,
        active: 0,
        suspended: 0,
        archived: 0,
        newLast30Days: 0,
      },
      billing: {
        active: 0,
        trialing: 0,
        pastDue: 0,
        canceled: 0,
        inactive: 0,
      },
      deployments: {
        liveSites: 0,
        buildingSites: 0,
        failedSites: 0,
        pendingSites: 0,
        unprovisionedSites: 0,
        liveRate: 0,
      },
      domains: {
        activeDomains: 0,
        pendingDomains: 0,
        failedDomains: 0,
        sslProvisioningDomains: 0,
        sitesMissingPrimaryDomain: 0,
      },
      operations: {
        openAlerts: 0,
        criticalAlerts: 0,
        submissionsLast30Days,
        failedDeliveriesLast30Days,
      },
    };

    const planMix = new Map<
      string,
      {
        planKey: string;
        planName: string;
        tenantCount: number;
        activeCount: number;
        trialCount: number;
        attentionCount: number;
      }
    >();
    const billingAttention: Array<{
      tenantId: string;
      tenantName: string;
      planName: string;
      billingStatus: BillingPublicStatus;
      renewsAt: string | null;
      reason: string;
    }> = [];
    const deploymentFailures: Array<{
      deploymentId: string;
      tenantId: string;
      tenantName: string;
      siteId: string;
      siteName: string;
      status: DeploymentStatus;
      errorMessage: string | null;
      updatedAt: string;
    }> = [];
    const domainIssues: Array<{
      domainId: string;
      tenantId: string;
      tenantName: string;
      siteId: string;
      siteName: string;
      hostname: string;
      status: DomainStatus;
      lastError: string | null;
      lastCheckedAt: string | null;
    }> = [];
    const formAlerts: Array<{
      tenantId: string;
      tenantName: string;
      siteId: string;
      siteName: string;
      critical: boolean;
      alertTypes: OperationalAlertType[];
      messages: string[];
      lastTriggeredAt: string | null;
    }> = [];
    const tenantHealth: Array<{
      tenantId: string;
      tenantName: string;
      tenantStatus: TenantStatus;
      planName: string;
      billingStatus: BillingPublicStatus;
      healthScore: number;
      siteCount: number;
      liveSites: number;
      failedSites: number;
      sitesMissingPrimaryDomain: number;
      openAlerts: number;
      reasons: string[];
    }> = [];

    for (const tenant of tenants) {
      scorecards.tenants[
        tenant.status.toLowerCase() as "active" | "suspended" | "archived"
      ] += 1;
      if (tenant.createdAt >= last30Days) {
        scorecards.tenants.newLast30Days += 1;
      }

      const commercial = this.buildCommercialSnapshot(
        tenant.createdAt,
        tenant.subscriptions[0] ?? null,
        now,
      );
      scorecards.billing[this.toBillingBucket(commercial.status)] += 1;

      const planEntry = planMix.get(commercial.planKey) ?? {
        planKey: commercial.planKey,
        planName: commercial.planName,
        tenantCount: 0,
        activeCount: 0,
        trialCount: 0,
        attentionCount: 0,
      };
      planEntry.tenantCount += 1;
      if (commercial.status === "active") {
        planEntry.activeCount += 1;
      }
      if (commercial.status === "trialing") {
        planEntry.trialCount += 1;
      }
      if (commercial.needsAttention || commercial.trialEndingSoon) {
        planEntry.attentionCount += 1;
      }
      planMix.set(commercial.planKey, planEntry);

      if (commercial.needsAttention || commercial.trialEndingSoon) {
        billingAttention.push({
          tenantId: tenant.id,
          tenantName: tenant.name,
          planName: commercial.planName,
          billingStatus: commercial.status,
          renewsAt: commercial.renewsAt,
          reason: commercial.trialEndingSoon
            ? "Trial window closes within 7 days"
            : commercial.status === "past_due"
              ? "Billing recovery required"
              : commercial.status === "inactive"
                ? "Trial expired without a paid subscription"
                : "Subscription is no longer in good standing",
        });
      }

      let liveSites = 0;
      let failedSites = 0;
      let buildingSites = 0;
      let pendingSites = 0;
      let sitesMissingPrimaryDomain = 0;
      let tenantOpenAlerts = 0;
      let tenantCriticalAlerts = 0;
      const reasons: string[] = [];

      for (const site of tenant.sites) {
        const latestDeployment = site.deployments[0] ?? null;
        if (!latestDeployment) {
          scorecards.deployments.unprovisionedSites += 1;
          pendingSites += 1;
        } else if (latestDeployment.status === DeploymentStatus.LIVE) {
          scorecards.deployments.liveSites += 1;
          liveSites += 1;
        } else if (latestDeployment.status === DeploymentStatus.FAILED) {
          scorecards.deployments.failedSites += 1;
          failedSites += 1;
          deploymentFailures.push({
            deploymentId: latestDeployment.id,
            tenantId: tenant.id,
            tenantName: tenant.name,
            siteId: site.id,
            siteName: site.name,
            status: latestDeployment.status,
            errorMessage: latestDeployment.errorMessage,
            updatedAt: latestDeployment.updatedAt.toISOString(),
          });
        } else if (latestDeployment.status === DeploymentStatus.PENDING) {
          scorecards.deployments.pendingSites += 1;
          pendingSites += 1;
        } else {
          scorecards.deployments.buildingSites += 1;
          buildingSites += 1;
        }

        const activePrimaryDomain = site.domains.find(
          (domain) => domain.isPrimary && domain.status === DomainStatus.ACTIVE,
        );

        if (!activePrimaryDomain) {
          scorecards.domains.sitesMissingPrimaryDomain += 1;
          sitesMissingPrimaryDomain += 1;
        }

        for (const domain of site.domains) {
          if (domain.status === DomainStatus.ACTIVE) {
            scorecards.domains.activeDomains += 1;
          } else if (domain.status === DomainStatus.SSL_PROVISIONING) {
            scorecards.domains.sslProvisioningDomains += 1;
            domainIssues.push({
              domainId: domain.id,
              tenantId: tenant.id,
              tenantName: tenant.name,
              siteId: site.id,
              siteName: site.name,
              hostname: domain.host,
              status: domain.status,
              lastError: domain.lastError,
              lastCheckedAt: domain.lastCheckedAt?.toISOString() ?? null,
            });
          } else if (domain.status === DomainStatus.FAILED) {
            scorecards.domains.failedDomains += 1;
            domainIssues.push({
              domainId: domain.id,
              tenantId: tenant.id,
              tenantName: tenant.name,
              siteId: site.id,
              siteName: site.name,
              hostname: domain.host,
              status: domain.status,
              lastError: domain.lastError,
              lastCheckedAt: domain.lastCheckedAt?.toISOString() ?? null,
            });
          } else {
            scorecards.domains.pendingDomains += 1;
            domainIssues.push({
              domainId: domain.id,
              tenantId: tenant.id,
              tenantName: tenant.name,
              siteId: site.id,
              siteName: site.name,
              hostname: domain.host,
              status: domain.status,
              lastError: domain.lastError,
              lastCheckedAt: domain.lastCheckedAt?.toISOString() ?? null,
            });
          }
        }

        const openSiteAlerts = site.alerts;
        tenantOpenAlerts += openSiteAlerts.length;
        tenantCriticalAlerts += openSiteAlerts.filter(
          (alert) => alert.severity === OperationalAlertSeverity.CRITICAL,
        ).length;
        scorecards.operations.openAlerts += openSiteAlerts.length;
        scorecards.operations.criticalAlerts += openSiteAlerts.filter(
          (alert) => alert.severity === OperationalAlertSeverity.CRITICAL,
        ).length;

        const formSiteAlerts = openSiteAlerts.filter(
          (alert) =>
            alert.type === OperationalAlertType.FORM_DELIVERY_FAILURE ||
            alert.type === OperationalAlertType.SUBMISSION_SPIKE,
        );

        if (formSiteAlerts.length > 0) {
          formAlerts.push({
            tenantId: tenant.id,
            tenantName: tenant.name,
            siteId: site.id,
            siteName: site.name,
            critical: formSiteAlerts.some(
              (alert) => alert.severity === OperationalAlertSeverity.CRITICAL,
            ),
            alertTypes: formSiteAlerts.map((alert) => alert.type),
            messages: formSiteAlerts.map((alert) => alert.message),
            lastTriggeredAt:
              formSiteAlerts
                .map((alert) => alert.lastTriggeredAt)
                .sort((left, right) => right.getTime() - left.getTime())[0]
                ?.toISOString() ?? null,
          });
        }
      }

      if (tenant.status === TenantStatus.SUSPENDED) {
        reasons.push("Workspace access is suspended");
      }
      if (commercial.status === "past_due") {
        reasons.push("Billing is past due");
      }
      if (
        commercial.status === "canceled" ||
        commercial.status === "inactive"
      ) {
        reasons.push("Publishing is blocked by billing state");
      }
      if (commercial.trialEndingSoon) {
        reasons.push("Trial window closes soon");
      }
      if (failedSites > 0) {
        reasons.push("At least one site has a failed deployment");
      }
      if (sitesMissingPrimaryDomain > 0) {
        reasons.push("Primary production domain is missing or unverified");
      }
      if (tenantCriticalAlerts > 0) {
        reasons.push("Critical operational alerts are open");
      } else if (tenantOpenAlerts > 0) {
        reasons.push("Operational alerts require review");
      }

      tenantHealth.push({
        tenantId: tenant.id,
        tenantName: tenant.name,
        tenantStatus: tenant.status,
        planName: commercial.planName,
        billingStatus: commercial.status,
        healthScore: this.computeHealthScore({
          tenantStatus: tenant.status,
          billingStatus: commercial.status,
          trialEndingSoon: commercial.trialEndingSoon,
          failedSites,
          pendingSites,
          sitesMissingPrimaryDomain,
          openAlerts: tenantOpenAlerts,
          criticalAlerts: tenantCriticalAlerts,
        }),
        siteCount: tenant.sites.length,
        liveSites,
        failedSites,
        sitesMissingPrimaryDomain,
        openAlerts: tenantOpenAlerts,
        reasons,
      });
    }

    const trackedSites =
      scorecards.deployments.liveSites +
      scorecards.deployments.buildingSites +
      scorecards.deployments.failedSites +
      scorecards.deployments.pendingSites;
    scorecards.deployments.liveRate = trackedSites
      ? Math.round((scorecards.deployments.liveSites / trackedSites) * 100)
      : 0;

    return {
      generatedAt: now.toISOString(),
      scorecards,
      planMix: Array.from(planMix.values()).sort(
        (left, right) => right.tenantCount - left.tenantCount,
      ),
      tenantHealth: tenantHealth
        .sort((left, right) => left.healthScore - right.healthScore)
        .slice(0, 8),
      queues: {
        billingAttention: billingAttention
          .sort((left, right) =>
            (left.renewsAt ?? "").localeCompare(right.renewsAt ?? ""),
          )
          .slice(0, 8),
        deploymentFailures: deploymentFailures
          .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
          .slice(0, 8),
        domainIssues: domainIssues
          .sort(
            (left, right) =>
              this.domainSeverity(right.status) -
              this.domainSeverity(left.status),
          )
          .slice(0, 8),
        formAlerts: formAlerts
          .sort(
            (left, right) =>
              Number(right.critical) - Number(left.critical) ||
              (right.lastTriggeredAt ?? "").localeCompare(
                left.lastTriggeredAt ?? "",
              ),
          )
          .slice(0, 8),
        recentAudit: audit.data,
      },
    };
  }

  async listTenants(params: {
    status?: TenantStatus;
    page?: number;
    limit?: number;
  }): Promise<{
    data: Array<{
      id: string;
      slug: string;
      name: string;
      status: TenantStatus;
      planKey: string | null;
      siteCount: number;
      memberCount: number;
      createdAt: string;
    }>;
    total: number;
    page: number;
    limit: number;
  }> {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.max(1, Math.min(100, params.limit ?? 20));
    const skip = (page - 1) * limit;
    const where: Prisma.TenantWhereInput = params.status
      ? { status: params.status }
      : {};

    const [rows, total] = await Promise.all([
      this.prisma.tenant.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          slug: true,
          name: true,
          status: true,
          createdAt: true,
          subscriptions: {
            select: { planKey: true },
            orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
            take: 1,
          },
          _count: {
            select: {
              memberships: true,
              sites: true,
            },
          },
        },
      }),
      this.prisma.tenant.count({ where }),
    ]);

    return {
      data: rows.map((row) => ({
        id: row.id,
        slug: row.slug,
        name: row.name,
        status: row.status,
        planKey: row.subscriptions[0]?.planKey ?? null,
        siteCount: row._count.sites,
        memberCount: row._count.memberships,
        createdAt: row.createdAt.toISOString(),
      })),
      total,
      page,
      limit,
    };
  }

  async updateTenantStatus(params: {
    tenantId: string;
    nextStatus: TenantStatus;
    actorUserId?: string | null;
  }): Promise<void> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: params.tenantId },
      select: {
        id: true,
        name: true,
        status: true,
      },
    });

    if (!tenant) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Tenant not found",
      });
    }

    if (tenant.status !== params.nextStatus) {
      await this.prisma.tenant.update({
        where: { id: tenant.id },
        data: { status: params.nextStatus },
      });
    }

    await this.createAuditLog({
      tenantId: tenant.id,
      actorUserId: params.actorUserId ?? null,
      action:
        params.nextStatus === TenantStatus.SUSPENDED
          ? "tenant.suspended"
          : "tenant.reactivated",
      targetType: "tenant",
      targetId: tenant.id,
      metadata: {
        tenantName: tenant.name,
        previousStatus: tenant.status,
        nextStatus: params.nextStatus,
      },
    });
  }

  async listAuditLog(params: { page?: number; limit?: number }): Promise<{
    data: Array<{
      id: string;
      actorId: string;
      actorEmail: string;
      action: string;
      targetType: string | null;
      targetId: string | null;
      meta: Record<string, unknown> | null;
      createdAt: string;
    }>;
    total: number;
    page: number;
    limit: number;
  }> {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.max(1, Math.min(100, params.limit ?? 50));
    const skip = (page - 1) * limit;

    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      this.prisma.auditLog.count(),
    ]);

    const actorIds = rows
      .map((row) => row.actorUserId)
      .filter((actorId): actorId is string => !!actorId);

    const actors = actorIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: [...new Set(actorIds)] } },
          select: { id: true, email: true },
        })
      : [];
    const emailByActorId = new Map(
      actors.map((actor) => [actor.id, actor.email]),
    );

    return {
      data: rows.map((row) => ({
        id: row.id,
        actorId: row.actorUserId ?? "system",
        actorEmail: row.actorUserId
          ? (emailByActorId.get(row.actorUserId) ?? "Unknown user")
          : "System",
        action: row.action,
        targetType: row.targetType,
        targetId: row.targetId,
        meta: this.toAuditMetadata(row.metadata),
        createdAt: row.createdAt.toISOString(),
      })),
      total,
      page,
      limit,
    };
  }

  async createAuditLogForSite(params: {
    siteId: string;
    actorUserId?: string | null;
    action: string;
    targetType?: string | null;
    targetId?: string | null;
    metadata?: AuditMetadata;
  }): Promise<void> {
    const site = await this.prisma.site.findUnique({
      where: { id: params.siteId },
      select: { id: true, tenantId: true },
    });

    if (!site) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Site not found",
      });
    }

    await this.createAuditLog({
      tenantId: site.tenantId,
      siteId: site.id,
      actorUserId: params.actorUserId ?? null,
      action: params.action,
      targetType: params.targetType ?? null,
      targetId: params.targetId ?? null,
      metadata: params.metadata,
    });
  }

  async createAuditLogForTenant(params: {
    tenantId: string;
    actorUserId?: string | null;
    action: string;
    targetType?: string | null;
    targetId?: string | null;
    metadata?: AuditMetadata;
  }): Promise<void> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: params.tenantId },
      select: { id: true },
    });

    if (!tenant) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Tenant not found",
      });
    }

    await this.createAuditLog({
      tenantId: tenant.id,
      actorUserId: params.actorUserId ?? null,
      action: params.action,
      targetType: params.targetType ?? null,
      targetId: params.targetId ?? null,
      metadata: params.metadata,
    });
  }

  private async createAuditLog(params: {
    tenantId: string;
    siteId?: string | null;
    actorUserId?: string | null;
    action: string;
    targetType?: string | null;
    targetId?: string | null;
    metadata?: AuditMetadata;
  }): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        tenantId: params.tenantId,
        siteId: params.siteId ?? null,
        actorUserId: params.actorUserId ?? null,
        action: params.action,
        targetType: params.targetType ?? null,
        targetId: params.targetId ?? null,
        metadata:
          params.metadata === undefined
            ? undefined
            : params.metadata === null
              ? Prisma.DbNull
              : (params.metadata as Prisma.InputJsonValue),
      },
    });
  }

  private toAuditMetadata(
    value: Prisma.JsonValue | null,
  ): Record<string, unknown> | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }

    return value as Record<string, unknown>;
  }

  private buildCommercialSnapshot(
    tenantCreatedAt: Date,
    subscription: {
      planKey: string;
      status: SubscriptionStatus;
      currentPeriodEnd: Date | null;
      gracePeriodEndsAt: Date | null;
    } | null,
    now: Date,
  ): AdminCommercialSnapshot {
    if (subscription && isBillingPlanKey(subscription.planKey)) {
      const plan = getBillingPlan(subscription.planKey);
      const status = this.toPublicStatus(subscription.status);
      const renewsAt = subscription.currentPeriodEnd?.toISOString() ?? null;
      const gracePeriodEndsAt =
        subscription.gracePeriodEndsAt?.toISOString() ?? null;

      return {
        planKey: plan.key,
        planName: plan.name,
        status,
        renewsAt,
        gracePeriodEndsAt,
        source: "stripe",
        needsAttention: ["past_due", "canceled", "inactive"].includes(status),
        trialEndingSoon:
          status === "trialing" &&
          subscription.currentPeriodEnd !== null &&
          subscription.currentPeriodEnd.getTime() - now.getTime() <=
            7 * 24 * 60 * 60 * 1000,
      };
    }

    const trialPlan = getBillingPlan("starter_stay");
    const renewsAt = new Date(tenantCreatedAt);
    renewsAt.setUTCDate(renewsAt.getUTCDate() + BILLING_DEFAULT_TRIAL_DAYS);
    const status: BillingPublicStatus =
      renewsAt > now ? "trialing" : "inactive";

    return {
      planKey: trialPlan.key,
      planName: trialPlan.name,
      status,
      renewsAt: renewsAt.toISOString(),
      gracePeriodEndsAt: null,
      source: "default_trial",
      needsAttention: status === "inactive",
      trialEndingSoon:
        status === "trialing" &&
        renewsAt.getTime() - now.getTime() <= 7 * 24 * 60 * 60 * 1000,
    };
  }

  private toPublicStatus(status: SubscriptionStatus): BillingPublicStatus {
    switch (status) {
      case SubscriptionStatus.ACTIVE:
        return "active";
      case SubscriptionStatus.TRIALING:
        return "trialing";
      case SubscriptionStatus.PAST_DUE:
        return "past_due";
      case SubscriptionStatus.CANCELED:
        return "canceled";
      case SubscriptionStatus.INACTIVE:
      default:
        return "inactive";
    }
  }

  private toBillingBucket(
    status: BillingPublicStatus,
  ): "active" | "trialing" | "pastDue" | "canceled" | "inactive" {
    if (status === "past_due") {
      return "pastDue";
    }

    return status;
  }

  private computeHealthScore(params: {
    tenantStatus: TenantStatus;
    billingStatus: BillingPublicStatus;
    trialEndingSoon: boolean;
    failedSites: number;
    pendingSites: number;
    sitesMissingPrimaryDomain: number;
    openAlerts: number;
    criticalAlerts: number;
  }): number {
    let score = 100;

    if (params.tenantStatus === TenantStatus.SUSPENDED) {
      score -= 45;
    }

    if (params.billingStatus === "past_due") {
      score -= 25;
    }

    if (
      params.billingStatus === "canceled" ||
      params.billingStatus === "inactive"
    ) {
      score -= 40;
    }

    if (params.trialEndingSoon) {
      score -= 10;
    }

    score -= Math.min(params.failedSites * 20, 30);
    score -= Math.min(params.pendingSites * 5, 15);
    score -= Math.min(params.sitesMissingPrimaryDomain * 10, 20);
    score -= Math.min(params.openAlerts * 4, 12);
    score -= Math.min(params.criticalAlerts * 10, 20);

    return Math.max(0, score);
  }

  private domainSeverity(status: DomainStatus): number {
    switch (status) {
      case DomainStatus.FAILED:
        return 5;
      case DomainStatus.DNS_REQUIRED:
        return 4;
      case DomainStatus.PROVIDER_ATTACH_PENDING:
        return 3;
      case DomainStatus.SSL_PROVISIONING:
        return 2;
      case DomainStatus.VERIFYING:
        return 1;
      case DomainStatus.PENDING:
      case DomainStatus.ACTIVE:
      default:
        return 0;
    }
  }
}
