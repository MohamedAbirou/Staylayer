import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  NotificationCategory,
  Prisma,
  SiteDeletionJobStatus,
  SiteStatus,
  SubscriptionStatus,
  TenantDeletionJobStatus,
  TenantMembershipRole,
} from "@prisma/client";

import { AdminService } from "../admin/admin.service";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import { UsersService } from "../users/users.service";
import {
  getConfiguredPlatformRootDomain,
  isUsablePlatformRootDomain,
} from "../public-runtime/platform-root-domain";
import { PublicRuntimeCacheService } from "../public-runtime/public-runtime.cache.service";
import {
  companionHost,
  normalizeHostname,
} from "../public-runtime/public-runtime.util";
import { PermanentDeleteTenantDto } from "../tenant-workspace/dto/permanent-delete-tenant.dto";

export type TenantDeletionImpactRiskFlag =
  | "HAS_OTHER_MEMBERS"
  | "HAS_ACTIVE_SITES"
  | "HAS_ARCHIVED_SITES"
  | "HAS_ACTIVE_SUBSCRIPTION"
  | "HAS_PROVIDER_RESOURCES"
  | "HAS_CONNECTED_DOMAINS"
  | "HAS_FORM_SUBMISSIONS"
  | "HAS_ACTIVE_INTEGRATIONS";

export interface TenantDeletionProviderResource {
  siteId: string;
  siteName: string;
  deploymentId: string;
  provider: string | null;
  providerProjectId: string | null;
  providerDeployId: string | null;
}

export interface TenantDeletionSubscriptionSummary {
  id: string;
  provider: string;
  planKey: string;
  status: SubscriptionStatus;
  providerCustomerId: string | null;
  providerSubscriptionId: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

export interface TenantDeletionImpactSummary {
  tenantId: string;
  name: string;
  slug: string;
  counts: {
    members: number;
    owners: number;
    pendingInvitations: number;
    activeSites: number;
    archivedSites: number;
    totalSites: number;
    pages: number;
    deployments: number;
    connectedDomains: number;
    formSubmissions: number;
    formDeliveries: number;
    auditLogs: number;
    siteDeletionJobs: number;
    translationJobs: number;
    notifications: number;
  };
  integrations: {
    searchConsoleConnections: number;
    bingConnections: number;
    scheduledAuditsEnabled: number;
  };
  providerResources: TenantDeletionProviderResource[];
  activeSubscriptions: TenantDeletionSubscriptionSummary[];
  riskFlags: TenantDeletionImpactRiskFlag[];
  blockingReasons: string[];
  /**
   * Computed only when an `actorUserId` is passed to `computeDeletionImpact`.
   * Drives the dashboard’s “Also delete my account” checkbox — the option is
   * only offered when this is `false` (i.e. this is the actor's last
   * workspace).
   */
  actorHasOtherMemberships?: boolean;
}

export interface TenantDeletionJobSummary {
  id: string;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  status: TenantDeletionJobStatus;
  progress: number;
  totalSteps: number;
  currentStep: string | null;
  requestedByUserId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface DeletionStepResult {
  step: string;
  deleted: number;
}

@Injectable()
export class TenantDeletionService {
  private readonly logger = new Logger(TenantDeletionService.name);

  private static readonly STEPS: string[] = [
    "snapshot_hosts",
    "delete_per_site_non_fk_rows",
    "delete_tenant_non_fk_rows",
    "delete_tenant_cascade",
    "bust_runtime_cache",
    "delete_actor_user",
  ];

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly adminService: AdminService,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
    @Optional()
    private readonly publicRuntimeCacheService?: PublicRuntimeCacheService,
  ) {}

  // ─── Impact summary ───────────────────────────────────────

  async computeDeletionImpact(
    tenantId: string,
    actorUserId?: string,
  ): Promise<TenantDeletionImpactSummary> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, slug: true },
    });

    if (!tenant) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Workspace not found",
      });
    }

    const siteRows = await this.prisma.site.findMany({
      where: { tenantId },
      select: { id: true, name: true, status: true },
    });
    const siteIds = siteRows.map((s) => s.id);
    const siteNameById = new Map(siteRows.map((s) => [s.id, s.name]));

    const [
      members,
      owners,
      pendingInvitations,
      pages,
      deployments,
      connectedDomains,
      formSubmissions,
      formDeliveries,
      auditLogs,
      siteDeletionJobs,
      translationJobs,
      notifications,
      searchConsoleConnections,
      bingConnections,
      scheduledAuditEnabledRows,
      deploymentProviderRows,
      activeSubscriptions,
    ] = await Promise.all([
      this.prisma.tenantMembership.count({ where: { tenantId } }),
      this.prisma.tenantMembership.count({
        where: { tenantId, role: TenantMembershipRole.OWNER },
      }),
      this.prisma.workspaceInvitation.count({
        where: { tenantId, acceptedAt: null, revokedAt: null },
      }),
      siteIds.length === 0
        ? Promise.resolve(0)
        : this.prisma.page.count({
            where: { siteId: { in: siteIds }, deletedAt: null },
          }),
      siteIds.length === 0
        ? Promise.resolve(0)
        : this.prisma.deployment.count({ where: { siteId: { in: siteIds } } }),
      siteIds.length === 0
        ? Promise.resolve(0)
        : this.prisma.domain.count({ where: { siteId: { in: siteIds } } }),
      siteIds.length === 0
        ? Promise.resolve(0)
        : this.prisma.formSubmission.count({
            where: { siteId: { in: siteIds } },
          }),
      siteIds.length === 0
        ? Promise.resolve(0)
        : this.prisma.formDelivery.count({
            where: { siteId: { in: siteIds } },
          }),
      this.prisma.auditLog.count({ where: { tenantId } }),
      this.prisma.siteDeletionJob.count({ where: { tenantId } }),
      siteIds.length === 0
        ? Promise.resolve(0)
        : this.prisma.translationJob.count({
            where: { siteId: { in: siteIds } },
          }),
      this.prisma.notification.count({ where: { tenantId } }),
      siteIds.length === 0
        ? Promise.resolve(0)
        : this.prisma.searchConsoleConnection.count({
            where: { siteId: { in: siteIds } },
          }),
      siteIds.length === 0
        ? Promise.resolve(0)
        : this.prisma.bingWebmasterConnection.count({
            where: { siteId: { in: siteIds } },
          }),
      siteIds.length === 0
        ? Promise.resolve(0)
        : this.prisma.seoAuditSchedule.count({
            where: { siteId: { in: siteIds }, enabled: true },
          }),
      siteIds.length === 0
        ? Promise.resolve(
            [] as Array<{
              id: string;
              siteId: string;
              provider: string | null;
              providerProjectId: string | null;
              providerDeployId: string | null;
            }>,
          )
        : this.prisma.deployment.findMany({
            where: {
              siteId: { in: siteIds },
              OR: [
                { providerProjectId: { not: null } },
                { providerDeployId: { not: null } },
              ],
            },
            select: {
              id: true,
              siteId: true,
              provider: true,
              providerProjectId: true,
              providerDeployId: true,
            },
            orderBy: { createdAt: "desc" },
          }),
      this.prisma.subscription.findMany({
        where: {
          tenantId,
          status: {
            in: [
              SubscriptionStatus.ACTIVE,
              SubscriptionStatus.TRIALING,
              SubscriptionStatus.PAST_DUE,
            ],
          },
        },
        select: {
          id: true,
          provider: true,
          planKey: true,
          status: true,
          providerCustomerId: true,
          providerSubscriptionId: true,
          currentPeriodEnd: true,
          cancelAtPeriodEnd: true,
        },
      }),
    ]);

    const activeSites = siteRows.filter(
      (s) => s.status !== SiteStatus.ARCHIVED,
    ).length;
    const archivedSites = siteRows.filter(
      (s) => s.status === SiteStatus.ARCHIVED,
    ).length;

    const providerResources: TenantDeletionProviderResource[] =
      deploymentProviderRows.map((row) => ({
        siteId: row.siteId,
        siteName: siteNameById.get(row.siteId) ?? "",
        deploymentId: row.id,
        provider: row.provider,
        providerProjectId: row.providerProjectId,
        providerDeployId: row.providerDeployId,
      }));

    const subscriptionSummaries: TenantDeletionSubscriptionSummary[] =
      activeSubscriptions.map((sub) => ({
        id: sub.id,
        provider: sub.provider,
        planKey: sub.planKey,
        status: sub.status,
        providerCustomerId: sub.providerCustomerId,
        providerSubscriptionId: sub.providerSubscriptionId,
        currentPeriodEnd: sub.currentPeriodEnd
          ? sub.currentPeriodEnd.toISOString()
          : null,
        cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      }));

    const riskFlags: TenantDeletionImpactRiskFlag[] = [];
    if (members > 1) riskFlags.push("HAS_OTHER_MEMBERS");
    if (activeSites > 0) riskFlags.push("HAS_ACTIVE_SITES");
    if (archivedSites > 0) riskFlags.push("HAS_ARCHIVED_SITES");
    if (subscriptionSummaries.length > 0)
      riskFlags.push("HAS_ACTIVE_SUBSCRIPTION");
    if (providerResources.length > 0) riskFlags.push("HAS_PROVIDER_RESOURCES");
    if (connectedDomains > 0) riskFlags.push("HAS_CONNECTED_DOMAINS");
    if (formSubmissions > 0) riskFlags.push("HAS_FORM_SUBMISSIONS");
    if (
      searchConsoleConnections > 0 ||
      bingConnections > 0 ||
      scheduledAuditEnabledRows > 0
    ) {
      riskFlags.push("HAS_ACTIVE_INTEGRATIONS");
    }

    const blockingReasons: string[] = [];
    // No hard blockers — owners may delete a workspace at any state. Active
    // sites / subscriptions / domains are surfaced via riskFlags + required
    // acknowledgements instead.

    let actorHasOtherMemberships: boolean | undefined;
    if (actorUserId) {
      const otherCount = await this.prisma.tenantMembership.count({
        where: { userId: actorUserId, tenantId: { not: tenantId } },
      });
      actorHasOtherMemberships = otherCount > 0;
    }

    return {
      tenantId: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      counts: {
        members,
        owners,
        pendingInvitations,
        activeSites,
        archivedSites,
        totalSites: siteRows.length,
        pages,
        deployments,
        connectedDomains,
        formSubmissions,
        formDeliveries,
        auditLogs,
        siteDeletionJobs,
        translationJobs,
        notifications,
      },
      integrations: {
        searchConsoleConnections,
        bingConnections,
        scheduledAuditsEnabled: scheduledAuditEnabledRows,
      },
      providerResources,
      activeSubscriptions: subscriptionSummaries,
      riskFlags,
      blockingReasons,
      ...(actorHasOtherMemberships !== undefined
        ? { actorHasOtherMemberships }
        : {}),
    };
  }

  // ─── Queue ───────────────────────────────────────────────

  async queuePermanentDeletion(
    tenantId: string,
    dto: PermanentDeleteTenantDto,
    actorUserId: string,
  ): Promise<TenantDeletionJobSummary> {
    const impact = await this.computeDeletionImpact(tenantId, actorUserId);

    // Verify actor is an OWNER (the controller also enforces this via
    // @MembershipRoles, but we re-check defensively at the service layer).
    const actorMembership = await this.prisma.tenantMembership.findFirst({
      where: { tenantId, userId: actorUserId },
      select: { role: true },
    });
    if (
      !actorMembership ||
      actorMembership.role !== TenantMembershipRole.OWNER
    ) {
      throw new ConflictException({
        code: "TENANT_DELETION_BLOCKED",
        message: "Only workspace owners can permanently delete the workspace.",
      });
    }

    if (
      dto.confirmTenantSlug.trim().toLowerCase() !== impact.slug.toLowerCase()
    ) {
      throw new BadRequestException({
        code: "SLUG_CONFIRMATION_MISMATCH",
        message:
          "Workspace slug does not match. Type the slug exactly to confirm permanent deletion.",
      });
    }

    const missing: string[] = [];
    const requireAck = (
      flag: TenantDeletionImpactRiskFlag,
      key: keyof PermanentDeleteTenantDto,
    ) => {
      if (impact.riskFlags.includes(flag) && !dto[key]) {
        missing.push(key as string);
      }
    };
    requireAck("HAS_OTHER_MEMBERS", "acknowledgeOtherMembers");
    requireAck("HAS_ACTIVE_SITES", "acknowledgeActiveSites");
    requireAck("HAS_ARCHIVED_SITES", "acknowledgeArchivedSites");
    requireAck("HAS_ACTIVE_SUBSCRIPTION", "acknowledgeActiveSubscription");
    requireAck("HAS_PROVIDER_RESOURCES", "acknowledgeProviderResources");
    requireAck("HAS_CONNECTED_DOMAINS", "acknowledgeConnectedDomains");
    requireAck("HAS_FORM_SUBMISSIONS", "acknowledgeFormSubmissions");
    requireAck("HAS_ACTIVE_INTEGRATIONS", "acknowledgeIntegrations");

    if (missing.length > 0) {
      throw new BadRequestException({
        code: "RISK_ACKNOWLEDGEMENTS_REQUIRED",
        message:
          "Please acknowledge each highlighted risk before permanent deletion.",
        missingAcknowledgements: missing,
      });
    }

    // ─── Optional cascade: also delete the actor's user account ─────
    // Validated at queue time AND re-checked at run time.
    if (dto.alsoDeleteMyAccount) {
      if (impact.actorHasOtherMemberships) {
        throw new ConflictException({
          code: "CANNOT_DELETE_ACCOUNT_OTHER_MEMBERSHIPS",
          message:
            "You cannot delete your account during this workspace deletion because you still belong to other workspaces. Leave them first, or uncheck “Also delete my account”.",
        });
      }
      if (!dto.accountDeletionPassword) {
        throw new BadRequestException({
          code: "ACCOUNT_DELETION_PASSWORD_REQUIRED",
          message:
            "Enter your current password to confirm permanent account deletion.",
        });
      }
      const actorUser = await this.prisma.user.findUnique({
        where: { id: actorUserId },
        select: { passwordHash: true, platformRole: true },
      });
      if (!actorUser) {
        throw new NotFoundException({
          code: "NOT_FOUND",
          message: "Actor user not found",
        });
      }
      if (actorUser.platformRole) {
        // Platform operators cannot self-delete via this flow; their account
        // is independent of customer workspace lifecycle.
        throw new ConflictException({
          code: "PLATFORM_USER_ACCOUNT_PROTECTED",
          message:
            "Platform operator accounts cannot be deleted through the workspace deletion flow.",
        });
      }
      const passwordOk = await this.usersService.verifyPassword(
        actorUser.passwordHash,
        dto.accountDeletionPassword,
      );
      if (!passwordOk) {
        throw new BadRequestException({
          code: "INVALID_PASSWORD",
          message: "Password is incorrect. Account deletion blocked.",
        });
      }
    }

    // Block if a tenant-deletion job is already in flight.
    const existing = await this.prisma.tenantDeletionJob.findFirst({
      where: {
        tenantId,
        status: {
          in: [TenantDeletionJobStatus.QUEUED, TenantDeletionJobStatus.RUNNING],
        },
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException({
        code: "TENANT_DELETION_ALREADY_IN_PROGRESS",
        message:
          "A permanent deletion job for this workspace is already queued or running.",
      });
    }

    // Block if any site under this tenant is currently being permanently
    // deleted — let it finish first so the two runners do not race.
    const siteJobInFlight = await this.prisma.siteDeletionJob.findFirst({
      where: {
        tenantId,
        status: {
          in: [SiteDeletionJobStatus.QUEUED, SiteDeletionJobStatus.RUNNING],
        },
      },
      select: { id: true },
    });
    if (siteJobInFlight) {
      throw new ConflictException({
        code: "SITE_DELETION_IN_PROGRESS",
        message:
          "A site under this workspace is currently being permanently deleted. Wait for it to finish, then try again.",
      });
    }

    const acknowledgements = {
      confirmedTenantSlug: dto.confirmTenantSlug.trim(),
      acknowledgeOtherMembers: Boolean(dto.acknowledgeOtherMembers),
      acknowledgeActiveSites: Boolean(dto.acknowledgeActiveSites),
      acknowledgeArchivedSites: Boolean(dto.acknowledgeArchivedSites),
      acknowledgeActiveSubscription: Boolean(dto.acknowledgeActiveSubscription),
      acknowledgeProviderResources: Boolean(dto.acknowledgeProviderResources),
      acknowledgeConnectedDomains: Boolean(dto.acknowledgeConnectedDomains),
      acknowledgeFormSubmissions: Boolean(dto.acknowledgeFormSubmissions),
      acknowledgeIntegrations: Boolean(dto.acknowledgeIntegrations),
      alsoDeleteMyAccount: Boolean(dto.alsoDeleteMyAccount),
    };

    const job = await this.prisma.tenantDeletionJob.create({
      data: {
        tenantId,
        tenantName: impact.name,
        tenantSlug: impact.slug,
        status: TenantDeletionJobStatus.QUEUED,
        totalSteps: TenantDeletionService.STEPS.length,
        requestedByUserId: actorUserId,
        acknowledgements: acknowledgements as unknown as Prisma.InputJsonValue,
        impactSnapshot: impact as unknown as Prisma.InputJsonValue,
      },
    });

    // Write the queued audit log BEFORE any destructive work. Once the runner
    // cascades the tenant, the tenant's audit_logs are gone forever; the
    // surviving record of "this was deleted" lives on the TenantDeletionJob
    // row (which has no FK and thus survives).
    await this.adminService.createAuditLogForTenant({
      tenantId,
      actorUserId,
      action: "tenant.permanent_delete.queued",
      targetType: "tenant",
      targetId: tenantId,
      metadata: {
        tenantName: impact.name,
        tenantSlug: impact.slug,
        counts: impact.counts,
        integrations: impact.integrations,
        providerResources: impact.providerResources,
        activeSubscriptions: impact.activeSubscriptions,
        riskFlags: impact.riskFlags,
        jobId: job.id,
      },
    });

    // Notify all owners + admins that the workspace is being permanently
    // deleted. They will only see this notification before the cascade runs;
    // it is mostly for the audit trail and any active sessions.
    try {
      await this.notificationsService.createForTenantRoles({
        tenantId,
        roles: [TenantMembershipRole.OWNER, TenantMembershipRole.ADMIN],
        category: NotificationCategory.SYSTEM,
        title: `Permanent deletion queued for ${impact.name}`,
        body: `An owner queued the permanent deletion of "${impact.name}". This action is irreversible and will erase all workspace data shortly.`,
        actionUrl: "/profile",
        metadata: {
          jobId: job.id,
          tenantId,
          tenantName: impact.name,
        },
      });
    } catch (err) {
      this.logger.warn(
        `Failed to notify members of tenant deletion ${tenantId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }

    return this.serializeJob(job);
  }

  // ─── Lookup ──────────────────────────────────────────────

  /**
   * Fetch a job by id, scoped to the user who requested it. Intentionally
   * NOT tenant-scoped: once the runner cascades the tenant, the requester's
   * JWT can no longer resolve `activeTenantId`. The dashboard still needs to
   * see the final COMPLETED state, so we authorize via requestedByUserId.
   */
  async getJobForRequester(
    jobId: string,
    userId: string,
  ): Promise<TenantDeletionJobSummary> {
    const job = await this.prisma.tenantDeletionJob.findUnique({
      where: { id: jobId },
    });
    if (!job || job.requestedByUserId !== userId) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Tenant deletion job not found",
      });
    }
    return this.serializeJob(job);
  }

  async listClaimableJobIds(limit = 5): Promise<string[]> {
    const rows = await this.prisma.tenantDeletionJob.findMany({
      where: { status: TenantDeletionJobStatus.QUEUED },
      orderBy: [{ createdAt: "asc" }],
      take: limit,
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }

  // ─── Runner ──────────────────────────────────────────────

  async runJob(jobId: string): Promise<TenantDeletionJobSummary> {
    const claim = await this.prisma.tenantDeletionJob.updateMany({
      where: { id: jobId, status: TenantDeletionJobStatus.QUEUED },
      data: {
        status: TenantDeletionJobStatus.RUNNING,
        startedAt: new Date(),
        progress: 0,
        currentStep: TenantDeletionService.STEPS[0] ?? null,
      },
    });

    if (claim.count === 0) {
      const existing = await this.prisma.tenantDeletionJob.findUnique({
        where: { id: jobId },
      });
      if (!existing) {
        throw new NotFoundException({
          code: "NOT_FOUND",
          message: "Tenant deletion job not found",
        });
      }
      return this.serializeJob(existing);
    }

    const job = await this.prisma.tenantDeletionJob.findUnique({
      where: { id: jobId },
    });
    if (!job) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Tenant deletion job not found",
      });
    }

    const steps: DeletionStepResult[] = [];
    const tenantId = job.tenantId;
    let cacheHosts: string[] = [];

    try {
      // 1. Snapshot every host that maps to this tenant for cache busting.
      steps.push(
        await this.runStep(jobId, 0, async () => {
          const sites = await this.prisma.site.findMany({
            where: { tenantId },
            select: {
              id: true,
              publicSubdomain: true,
              archivedPublicSubdomain: true,
              archivedDomains: true,
              domains: { select: { host: true } },
            },
          });
          cacheHosts = this.collectCacheHosts(sites);
          return cacheHosts.length;
        }),
      );

      const siteIds = await this.prisma.site.findMany({
        where: { tenantId },
        select: { id: true },
      });
      const siteIdList = siteIds.map((s) => s.id);

      // 2. Per-site non-FK rows (notification.siteId / translationUsage.siteId
      //    have no FK and so survive the Site cascade). Clean them up before
      //    we drop the parent tenant so we do not leak orphaned rows.
      steps.push(
        await this.runStep(jobId, 1, async () => {
          if (siteIdList.length === 0) return 0;
          const [notifications, translationUsage] = await Promise.all([
            this.prisma.notification.deleteMany({
              where: { siteId: { in: siteIdList } },
            }),
            this.prisma.translationUsage.deleteMany({
              where: { siteId: { in: siteIdList } },
            }),
          ]);
          return notifications.count + translationUsage.count;
        }),
      );

      // 3. Tenant-level non-FK rows. Notification/NotificationPreference/
      //    TranslationUsage/TenantOnboarding all carry a `tenantId` column
      //    without a Prisma relation back to Tenant, so the tenant cascade
      //    does NOT erase them. TenantOnboardingMilestone cascades from
      //    TenantOnboarding via its own FK.
      steps.push(
        await this.runStep(jobId, 2, async () => {
          const [notifications, preferences, translationUsage, onboarding] =
            await Promise.all([
              this.prisma.notification.deleteMany({ where: { tenantId } }),
              this.prisma.notificationPreference.deleteMany({
                where: { tenantId },
              }),
              this.prisma.translationUsage.deleteMany({ where: { tenantId } }),
              this.prisma.tenantOnboarding.deleteMany({ where: { tenantId } }),
            ]);
          return (
            notifications.count +
            preferences.count +
            translationUsage.count +
            onboarding.count
          );
        }),
      );

      // 4. Drop the tenant — Prisma cascades:
      //      • TenantMembership, WorkspaceInvitation
      //      • Subscription
      //      • Site (and all its children: Page, Domain, Deployment,
      //        FormDefinition + Submissions + Deliveries, AuditLog rows for
      //        the site, TranslationJob, TranslationGlossary,
      //        TranslationProviderGlossary, SearchConsoleConnection,
      //        BingWebmasterConnection, SeoCrawlJob, SeoAuditRun + Task +
      //        Snapshot, PsiAudit, CruxRecord, HreflangIssue/Scan, Redirect,
      //        SitePublishedRevision, SiteStructuredData, SiteSettings,
      //        OperationalAlert, sitemap submissions, SearchConsole*,
      //        Bing*, AiCitationAudit, FormEmailTheme + Templates,
      //        FormRoutingRule, SiteDeploymentEnvironmentVariable, etc.)
      //      • AuditLog (tenant-level)
      //      • SiteDeletionJob (site-deletion jobs for this tenant)
      //      • BillingWebhookEvent: tenantId set to NULL (SetNull)
      //    The TenantDeletionJob row itself has NO FK and survives this
      //    delete, which is exactly what the dashboard polling needs.
      steps.push(
        await this.runStep(jobId, 3, async () => {
          await this.prisma.tenant.delete({ where: { id: tenantId } });
          return 1;
        }),
      );

      // 5. Bust runtime cache so any in-flight public-runtime caches release
      //    the freed subdomain/custom domain immediately.
      steps.push(
        await this.runStep(jobId, 4, async () => {
          await this.bustHostCache(cacheHosts);
          return cacheHosts.length;
        }),
      );

      // 6. Optional: also permanently delete the actor's user account when
      //    requested AND the actor still has zero other memberships. This is
      //    re-checked at run time, not just at queue time. If the actor has
      //    joined another workspace between queueing and running, we
      //    silently skip this step rather than failing the whole job — the
      //    tenant deletion itself already succeeded.
      const acks =
        (job.acknowledgements as Prisma.JsonObject | null) ??
        ({} as Prisma.JsonObject);
      const alsoDeleteUser = acks?.["alsoDeleteMyAccount"] === true;
      const actorUserId = job.requestedByUserId;
      steps.push(
        await this.runStep(jobId, 5, async () => {
          if (!alsoDeleteUser || !actorUserId) return 0;
          const otherCount = await this.prisma.tenantMembership.count({
            where: { userId: actorUserId },
          });
          if (otherCount > 0) {
            this.logger.warn(
              `Skipping actor user delete for job ${jobId}: user ${actorUserId} now belongs to ${otherCount} other workspaces.`,
            );
            return 0;
          }
          // Clear non-FK personal references that don't cascade from User.
          // Matches the manual cleanup in ProfileService.deleteAccount.
          await this.prisma.$transaction([
            this.prisma.notification.deleteMany({
              where: { userId: actorUserId },
            }),
            this.prisma.notificationPreference.deleteMany({
              where: { userId: actorUserId },
            }),
            this.prisma.user.delete({ where: { id: actorUserId } }),
          ]);
          return 1;
        }),
      );

      const totalDeleted = steps.reduce((acc, s) => acc + s.deleted, 0);

      const completed = await this.prisma.tenantDeletionJob.update({
        where: { id: jobId },
        data: {
          status: TenantDeletionJobStatus.COMPLETED,
          progress: TenantDeletionService.STEPS.length,
          currentStep: null,
          completedAt: new Date(),
          resultSummary: {
            steps,
            totalDeleted,
            siteIdsErased: siteIdList,
            hostsBusted: cacheHosts,
          } as unknown as Prisma.InputJsonValue,
        },
      });

      // NOTE: we deliberately do NOT call createAuditLogForTenant here — the
      // audit_logs for this tenant were cascaded away by tenant.delete. The
      // permanent record of completion lives on this TenantDeletionJob row.
      this.logger.log(
        `Permanently deleted tenant ${tenantId} (${job.tenantName}) — totalDeleted=${totalDeleted}, hosts=${cacheHosts.length}`,
      );

      return this.serializeJob(completed);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error ?? "unknown");
      const code =
        error instanceof Prisma.PrismaClientKnownRequestError
          ? error.code
          : "INTERNAL_ERROR";
      this.logger.error(
        `Tenant deletion job ${jobId} failed at step "${
          job.currentStep ?? "unknown"
        }": ${message}`,
        error instanceof Error ? error.stack : undefined,
      );

      const failed = await this.prisma.tenantDeletionJob.update({
        where: { id: jobId },
        data: {
          status: TenantDeletionJobStatus.FAILED,
          completedAt: new Date(),
          errorCode: code,
          errorMessage: message.slice(0, 800),
          resultSummary: {
            steps,
          } as unknown as Prisma.InputJsonValue,
        },
      });

      // We cannot reliably write an audit log on failure because the tenant
      // may already be partially destroyed. Log to the system logger only.
      return this.serializeJob(failed);
    }
  }

  // ─── Internals ───────────────────────────────────────────

  private async runStep(
    jobId: string,
    index: number,
    work: () => Promise<number>,
  ): Promise<DeletionStepResult> {
    const stepName = TenantDeletionService.STEPS[index] ?? `step_${index}`;
    await this.prisma.tenantDeletionJob.update({
      where: { id: jobId },
      data: { currentStep: stepName, progress: index },
    });
    const deleted = await work();
    await this.prisma.tenantDeletionJob.update({
      where: { id: jobId },
      data: { progress: index + 1 },
    });
    return { step: stepName, deleted };
  }

  private collectCacheHosts(
    sites: Array<{
      publicSubdomain: string | null;
      archivedPublicSubdomain: string | null;
      archivedDomains: string[];
      domains: { host: string }[];
    }>,
  ): string[] {
    const hosts: string[] = [];
    const root = getConfiguredPlatformRootDomain(this.configService);

    for (const site of sites) {
      const subdomain = site.publicSubdomain ?? site.archivedPublicSubdomain;
      if (subdomain && isUsablePlatformRootDomain(root)) {
        hosts.push(`${subdomain}.${root}`);
      }
      for (const domain of site.domains) {
        hosts.push(domain.host, companionHost(domain.host));
      }
      for (const host of site.archivedDomains ?? []) {
        hosts.push(host, companionHost(host));
      }
    }

    return Array.from(new Set(hosts.map(normalizeHostname).filter(Boolean)));
  }

  private async bustHostCache(hosts: string[]): Promise<void> {
    if (!this.publicRuntimeCacheService || hosts.length === 0) return;
    try {
      await this.publicRuntimeCacheService.deleteKeys(
        hosts.map((host) => `runtime:host:${host}`),
      );
    } catch (error) {
      this.logger.warn(
        `Failed to bust runtime host cache after tenant deletion: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private serializeJob(job: {
    id: string;
    tenantId: string;
    tenantName: string;
    tenantSlug: string;
    status: TenantDeletionJobStatus;
    progress: number;
    totalSteps: number;
    currentStep: string | null;
    requestedByUserId: string | null;
    errorCode: string | null;
    errorMessage: string | null;
    startedAt: Date | null;
    completedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): TenantDeletionJobSummary {
    return {
      id: job.id,
      tenantId: job.tenantId,
      tenantName: job.tenantName,
      tenantSlug: job.tenantSlug,
      status: job.status,
      progress: job.progress,
      totalSteps: job.totalSteps,
      currentStep: job.currentStep,
      requestedByUserId: job.requestedByUserId,
      errorCode: job.errorCode,
      errorMessage: job.errorMessage,
      startedAt: job.startedAt ? job.startedAt.toISOString() : null,
      completedAt: job.completedAt ? job.completedAt.toISOString() : null,
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
    };
  }
}
