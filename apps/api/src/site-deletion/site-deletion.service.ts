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
  TenantDeletionJobStatus,
  TenantMembershipRole,
} from "@prisma/client";

import { AdminService } from "../admin/admin.service";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import {
  getConfiguredPlatformRootDomain,
  isUsablePlatformRootDomain,
} from "../public-runtime/platform-root-domain";
import { PublicRuntimeCacheService } from "../public-runtime/public-runtime.cache.service";
import {
  companionHost,
  normalizeHostname,
} from "../public-runtime/public-runtime.util";
import { PermanentDeleteSiteDto } from "../tenant-workspace/dto/permanent-delete-site.dto";

export type SiteDeletionImpactRiskFlag =
  | "HAS_SUBMISSIONS"
  | "HAS_PROVIDER_RESOURCES"
  | "HAS_ACTIVE_INTEGRATIONS"
  | "HAS_PUBLISHED_PAGES"
  | "HAS_CONNECTED_DOMAINS";

export interface SiteDeletionProviderResource {
  deploymentId: string;
  provider: string | null;
  providerProjectId: string | null;
  providerDeployId: string | null;
}

export interface SiteDeletionImpactSummary {
  siteId: string;
  tenantId: string;
  name: string;
  archivedSlug: string | null;
  archivedPublicSubdomain: string | null;
  archivedDomains: string[];
  archivedAt: string | null;
  status: SiteStatus;
  counts: {
    pages: number;
    publishedPages: number;
    formDefinitions: number;
    formSubmissions: number;
    formDeliveries: number;
    connectedDomains: number;
    deployments: number;
    publishedRevisions: number;
    searchConsolePerformanceRows: number;
    bingPerformanceRows: number;
    psiAudits: number;
    cruxRecords: number;
    hreflangIssues: number;
    seoCrawlJobs: number;
    seoAuditRuns: number;
    seoAuditTasks: number;
    aiCitationAudits: number;
    translationJobs: number;
    translationUsageRows: number;
    redirects: number;
    notifications: number;
    auditLogs: number;
  };
  integrations: {
    searchConsoleConnected: boolean;
    bingConnected: boolean;
    scheduledAuditsEnabled: boolean;
  };
  providerResources: SiteDeletionProviderResource[];
  riskFlags: SiteDeletionImpactRiskFlag[];
  blockingReasons: string[];
}

export interface SiteDeletionJobSummary {
  id: string;
  tenantId: string;
  siteId: string;
  siteName: string;
  archivedSlug: string | null;
  status: SiteDeletionJobStatus;
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
export class SiteDeletionService {
  private readonly logger = new Logger(SiteDeletionService.name);

  private static readonly STEPS: string[] = [
    "delete_pages",
    "delete_form_submissions_and_deliveries",
    "delete_search_console_performance",
    "delete_bing_performance",
    "delete_seo_audit_history",
    "delete_psi_and_crux",
    "delete_hreflang_history",
    "delete_seo_crawler_history",
    "delete_url_inspections_and_sitemaps",
    "delete_non_fk_references",
    "finalize_site_record",
    "bust_runtime_cache",
  ];

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly adminService: AdminService,
    private readonly configService: ConfigService,
    @Optional()
    private readonly publicRuntimeCacheService?: PublicRuntimeCacheService,
  ) {}

  // ─── Impact summary ───────────────────────────────────────

  async computeDeletionImpact(
    tenantId: string,
    siteId: string,
  ): Promise<SiteDeletionImpactSummary> {
    const site = await this.prisma.site.findFirst({
      where: { id: siteId, tenantId },
      select: {
        id: true,
        tenantId: true,
        name: true,
        status: true,
        archivedAt: true,
        archivedSlug: true,
        archivedPublicSubdomain: true,
        archivedDomains: true,
      },
    });

    if (!site) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Site not found in this workspace",
      });
    }

    const [
      pages,
      publishedPages,
      formDefinitions,
      formSubmissions,
      formDeliveries,
      connectedDomains,
      deployments,
      publishedRevisions,
      searchConsolePerformancePages,
      searchConsolePerformanceQueries,
      bingPerformancePages,
      bingPerformanceQueries,
      psiAudits,
      cruxRecords,
      hreflangIssues,
      seoCrawlJobs,
      seoAuditRuns,
      seoAuditTasks,
      aiCitationAudits,
      translationJobs,
      translationUsageRows,
      redirects,
      notifications,
      auditLogs,
      searchConsoleConnection,
      bingConnection,
      scheduledAudit,
      deploymentProviderRows,
    ] = await Promise.all([
      this.prisma.page.count({ where: { siteId, deletedAt: null } }),
      this.prisma.page.count({
        where: { siteId, deletedAt: null, published: true },
      }),
      this.prisma.formDefinition.count({ where: { siteId } }),
      this.prisma.formSubmission.count({ where: { siteId } }),
      this.prisma.formDelivery.count({ where: { siteId } }),
      this.prisma.domain.count({ where: { siteId } }),
      this.prisma.deployment.count({ where: { siteId } }),
      this.prisma.sitePublishedRevision.count({ where: { siteId } }),
      this.prisma.searchConsolePagePerformance.count({ where: { siteId } }),
      this.prisma.searchConsoleQueryPerformance.count({ where: { siteId } }),
      this.prisma.bingPagePerformance.count({ where: { siteId } }),
      this.prisma.bingQueryPerformance.count({ where: { siteId } }),
      this.prisma.psiAudit.count({ where: { siteId } }),
      this.prisma.cruxRecord.count({ where: { siteId } }),
      this.prisma.hreflangIssue.count({ where: { siteId } }),
      this.prisma.seoCrawlJob.count({ where: { siteId } }),
      this.prisma.seoAuditRun.count({ where: { siteId } }),
      this.prisma.seoAuditTask.count({ where: { siteId } }),
      this.prisma.aiCitationAudit.count({ where: { siteId } }),
      this.prisma.translationJob.count({ where: { siteId } }),
      this.prisma.translationUsage.count({ where: { siteId } }),
      this.prisma.redirect.count({ where: { siteId } }),
      this.prisma.notification.count({ where: { siteId } }),
      this.prisma.auditLog.count({ where: { siteId } }),
      this.prisma.searchConsoleConnection.findUnique({
        where: { siteId },
        select: { id: true },
      }),
      this.prisma.bingWebmasterConnection.findUnique({
        where: { siteId },
        select: { id: true },
      }),
      this.prisma.seoAuditSchedule.findUnique({
        where: { siteId },
        select: { enabled: true },
      }),
      this.prisma.deployment.findMany({
        where: {
          siteId,
          OR: [
            { providerProjectId: { not: null } },
            { providerDeployId: { not: null } },
          ],
        },
        select: {
          id: true,
          provider: true,
          providerProjectId: true,
          providerDeployId: true,
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const integrations = {
      searchConsoleConnected: Boolean(searchConsoleConnection),
      bingConnected: Boolean(bingConnection),
      scheduledAuditsEnabled: Boolean(scheduledAudit?.enabled),
    };

    const providerResources: SiteDeletionProviderResource[] =
      deploymentProviderRows.map((row) => ({
        deploymentId: row.id,
        provider: row.provider,
        providerProjectId: row.providerProjectId,
        providerDeployId: row.providerDeployId,
      }));

    const riskFlags: SiteDeletionImpactRiskFlag[] = [];
    if (formSubmissions > 0) riskFlags.push("HAS_SUBMISSIONS");
    if (providerResources.length > 0) riskFlags.push("HAS_PROVIDER_RESOURCES");
    if (
      integrations.searchConsoleConnected ||
      integrations.bingConnected ||
      integrations.scheduledAuditsEnabled
    ) {
      riskFlags.push("HAS_ACTIVE_INTEGRATIONS");
    }
    if (publishedPages > 0) riskFlags.push("HAS_PUBLISHED_PAGES");
    if (connectedDomains > 0) riskFlags.push("HAS_CONNECTED_DOMAINS");

    const blockingReasons: string[] = [];
    if (site.status !== SiteStatus.ARCHIVED) {
      blockingReasons.push(
        "Site must be archived before it can be permanently deleted.",
      );
    }

    return {
      siteId: site.id,
      tenantId: site.tenantId,
      name: site.name,
      archivedSlug: site.archivedSlug,
      archivedPublicSubdomain: site.archivedPublicSubdomain,
      archivedDomains: site.archivedDomains ?? [],
      archivedAt: site.archivedAt ? site.archivedAt.toISOString() : null,
      status: site.status,
      counts: {
        pages,
        publishedPages,
        formDefinitions,
        formSubmissions,
        formDeliveries,
        connectedDomains,
        deployments,
        publishedRevisions,
        searchConsolePerformanceRows:
          searchConsolePerformancePages + searchConsolePerformanceQueries,
        bingPerformanceRows: bingPerformancePages + bingPerformanceQueries,
        psiAudits,
        cruxRecords,
        hreflangIssues,
        seoCrawlJobs,
        seoAuditRuns,
        seoAuditTasks,
        aiCitationAudits,
        translationJobs,
        translationUsageRows,
        redirects,
        notifications,
        auditLogs,
      },
      integrations,
      providerResources,
      riskFlags,
      blockingReasons,
    };
  }

  // ─── Queue + status ───────────────────────────────────────

  async queuePermanentDeletion(
    tenantId: string,
    siteId: string,
    dto: PermanentDeleteSiteDto,
    actorUserId: string | null,
  ): Promise<SiteDeletionJobSummary> {
    const impact = await this.computeDeletionImpact(tenantId, siteId);

    if (impact.blockingReasons.length > 0) {
      throw new ConflictException({
        code: "SITE_NOT_ARCHIVED",
        message:
          "Only archived sites can be permanently deleted. Archive the site first.",
        blockingReasons: impact.blockingReasons,
      });
    }

    const typed = dto.confirmSiteName.trim();
    if (typed !== impact.name) {
      throw new BadRequestException({
        code: "NAME_CONFIRMATION_MISMATCH",
        message:
          "Type the exact site name to confirm permanent deletion. Site name is case-sensitive.",
      });
    }

    const missing: string[] = [];
    if (
      impact.riskFlags.includes("HAS_SUBMISSIONS") &&
      !dto.acknowledgeSubmissions
    ) {
      missing.push("acknowledgeSubmissions");
    }
    if (
      impact.riskFlags.includes("HAS_PROVIDER_RESOURCES") &&
      !dto.acknowledgeProviderResources
    ) {
      missing.push("acknowledgeProviderResources");
    }
    if (
      impact.riskFlags.includes("HAS_ACTIVE_INTEGRATIONS") &&
      !dto.acknowledgeIntegrations
    ) {
      missing.push("acknowledgeIntegrations");
    }
    if (
      impact.riskFlags.includes("HAS_PUBLISHED_PAGES") &&
      !dto.acknowledgePublishedPages
    ) {
      missing.push("acknowledgePublishedPages");
    }
    if (
      impact.riskFlags.includes("HAS_CONNECTED_DOMAINS") &&
      !dto.acknowledgeConnectedDomains
    ) {
      missing.push("acknowledgeConnectedDomains");
    }

    if (missing.length > 0) {
      throw new BadRequestException({
        code: "RISK_ACKNOWLEDGEMENTS_REQUIRED",
        message:
          "Please acknowledge each highlighted risk before permanent deletion.",
        missingAcknowledgements: missing,
      });
    }

    const existing = await this.prisma.siteDeletionJob.findFirst({
      where: {
        tenantId,
        siteId,
        status: {
          in: [SiteDeletionJobStatus.QUEUED, SiteDeletionJobStatus.RUNNING],
        },
      },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException({
        code: "DELETION_ALREADY_IN_PROGRESS",
        message:
          "A permanent deletion job for this site is already queued or running.",
      });
    }

    // Cross-block: if a tenant-level permanent deletion is in flight, refuse
    // to queue per-site deletion — the tenant runner will erase the site for
    // us in a single cascade and we should not race it.
    const tenantJobInFlight = await this.prisma.tenantDeletionJob.findFirst({
      where: {
        tenantId,
        status: {
          in: [TenantDeletionJobStatus.QUEUED, TenantDeletionJobStatus.RUNNING],
        },
      },
      select: { id: true },
    });
    if (tenantJobInFlight) {
      throw new ConflictException({
        code: "TENANT_DELETION_IN_PROGRESS",
        message:
          "This workspace is currently being permanently deleted. Site deletions cannot be queued.",
      });
    }

    const job = await this.prisma.siteDeletionJob.create({
      data: {
        tenantId,
        siteId,
        siteName: impact.name,
        archivedSlug: impact.archivedSlug,
        status: SiteDeletionJobStatus.QUEUED,
        totalSteps: SiteDeletionService.STEPS.length,
        requestedByUserId: actorUserId,
        acknowledgements: {
          confirmedSiteName: typed,
          acknowledgeSubmissions: Boolean(dto.acknowledgeSubmissions),
          acknowledgeProviderResources: Boolean(
            dto.acknowledgeProviderResources,
          ),
          acknowledgeIntegrations: Boolean(dto.acknowledgeIntegrations),
          acknowledgePublishedPages: Boolean(dto.acknowledgePublishedPages),
          acknowledgeConnectedDomains: Boolean(dto.acknowledgeConnectedDomains),
        },
        impactSnapshot: impact as unknown as Prisma.InputJsonValue,
      },
    });

    // Preserve a tenant-level audit record BEFORE the site row is gone. Site-
    // scoped audit_logs rows for this site will have their site_id nulled via
    // ON DELETE SET NULL when the runner finally drops the row.
    await this.adminService.createAuditLogForTenant({
      tenantId,
      actorUserId,
      action: "site.permanent_delete.queued",
      targetType: "site",
      targetId: siteId,
      metadata: {
        siteName: impact.name,
        archivedSlug: impact.archivedSlug,
        archivedPublicSubdomain: impact.archivedPublicSubdomain,
        archivedDomains: impact.archivedDomains,
        counts: impact.counts,
        integrations: impact.integrations,
        providerResources: impact.providerResources,
        riskFlags: impact.riskFlags,
        jobId: job.id,
      },
    });

    await this.notificationsService.createForTenantRoles({
      tenantId,
      roles: [TenantMembershipRole.OWNER, TenantMembershipRole.ADMIN],
      category: NotificationCategory.SYSTEM,
      title: `Permanent deletion queued for ${impact.name}`,
      body: `An owner queued the permanent deletion of "${impact.name}". This action is irreversible and will erase all site data shortly.`,
      actionUrl: "/workspace",
      metadata: {
        jobId: job.id,
        siteId,
        siteName: impact.name,
      },
    });

    return this.serializeJob(job);
  }

  async getJob(
    tenantId: string,
    jobId: string,
  ): Promise<SiteDeletionJobSummary> {
    const job = await this.prisma.siteDeletionJob.findFirst({
      where: { id: jobId, tenantId },
    });
    if (!job) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Site deletion job not found in this workspace",
      });
    }
    return this.serializeJob(job);
  }

  async listJobs(tenantId: string): Promise<SiteDeletionJobSummary[]> {
    const rows = await this.prisma.siteDeletionJob.findMany({
      where: { tenantId },
      orderBy: [{ createdAt: "desc" }],
      take: 25,
    });
    return rows.map((row) => this.serializeJob(row));
  }

  // ─── Runner ──────────────────────────────────────────────

  /** Public so cron + tests can drive it directly. */
  async runJob(jobId: string): Promise<SiteDeletionJobSummary> {
    const claim = await this.prisma.siteDeletionJob.updateMany({
      where: { id: jobId, status: SiteDeletionJobStatus.QUEUED },
      data: {
        status: SiteDeletionJobStatus.RUNNING,
        startedAt: new Date(),
        progress: 0,
        currentStep: SiteDeletionService.STEPS[0] ?? null,
      },
    });

    if (claim.count === 0) {
      // Already claimed/running/completed/failed by another worker.
      const existing = await this.prisma.siteDeletionJob.findUnique({
        where: { id: jobId },
      });
      if (!existing) {
        throw new NotFoundException({
          code: "NOT_FOUND",
          message: "Site deletion job not found",
        });
      }
      return this.serializeJob(existing);
    }

    const job = await this.prisma.siteDeletionJob.findUnique({
      where: { id: jobId },
    });
    if (!job) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Site deletion job not found",
      });
    }

    const steps: DeletionStepResult[] = [];

    try {
      const siteId = job.siteId;
      const tenantId = job.tenantId;

      // Snapshot site identifiers for cache busting (site may already be gone
      // if a retry of a partial run somehow occurred).
      const site = await this.prisma.site.findUnique({
        where: { id: siteId },
        select: {
          id: true,
          publicSubdomain: true,
          archivedPublicSubdomain: true,
          archivedDomains: true,
          domains: { select: { host: true } },
        },
      });

      // 1. Pages (cascades page_versions + page_translation_meta).
      steps.push(
        await this.runStep(jobId, 0, async () => {
          const r = await this.prisma.page.deleteMany({ where: { siteId } });
          return r.count;
        }),
      );

      // 2. Form submissions and deliveries (cascade from definition, but
      //    deleting separately keeps progress useful for noisy sites).
      steps.push(
        await this.runStep(jobId, 1, async () => {
          const [delivered, submitted] = await Promise.all([
            this.prisma.formDelivery.deleteMany({ where: { siteId } }),
            this.prisma.formSubmission.deleteMany({ where: { siteId } }),
          ]);
          return delivered.count + submitted.count;
        }),
      );

      // 3. Search Console performance rows (potentially huge).
      steps.push(
        await this.runStep(jobId, 2, async () => {
          const [pages, queries] = await Promise.all([
            this.prisma.searchConsolePagePerformance.deleteMany({
              where: { siteId },
            }),
            this.prisma.searchConsoleQueryPerformance.deleteMany({
              where: { siteId },
            }),
          ]);
          return pages.count + queries.count;
        }),
      );

      // 4. Bing performance rows.
      steps.push(
        await this.runStep(jobId, 3, async () => {
          const [pages, queries] = await Promise.all([
            this.prisma.bingPagePerformance.deleteMany({ where: { siteId } }),
            this.prisma.bingQueryPerformance.deleteMany({ where: { siteId } }),
          ]);
          return pages.count + queries.count;
        }),
      );

      // 5. SEO audit history.
      steps.push(
        await this.runStep(jobId, 4, async () => {
          const [tasks, snapshots, runs] = await Promise.all([
            this.prisma.seoAuditTask.deleteMany({ where: { siteId } }),
            this.prisma.seoAuditSnapshot.deleteMany({ where: { siteId } }),
            this.prisma.seoAuditRun.deleteMany({ where: { siteId } }),
          ]);
          return tasks.count + snapshots.count + runs.count;
        }),
      );

      // 6. PSI + CrUX.
      steps.push(
        await this.runStep(jobId, 5, async () => {
          const [psi, crux] = await Promise.all([
            this.prisma.psiAudit.deleteMany({ where: { siteId } }),
            this.prisma.cruxRecord.deleteMany({ where: { siteId } }),
          ]);
          return psi.count + crux.count;
        }),
      );

      // 7. hreflang history.
      steps.push(
        await this.runStep(jobId, 6, async () => {
          const [issues, scans] = await Promise.all([
            this.prisma.hreflangIssue.deleteMany({ where: { siteId } }),
            this.prisma.hreflangScan.deleteMany({ where: { siteId } }),
          ]);
          return issues.count + scans.count;
        }),
      );

      // 8. Crawler history (crawl jobs cascade to crawl pages / links / image
      //    findings via Prisma onDelete: Cascade).
      steps.push(
        await this.runStep(jobId, 7, async () => {
          const [bingIssues, crawls] = await Promise.all([
            this.prisma.bingCrawlIssue.deleteMany({ where: { siteId } }),
            this.prisma.seoCrawlJob.deleteMany({ where: { siteId } }),
          ]);
          return bingIssues.count + crawls.count;
        }),
      );

      // 9. URL inspections + sitemaps (smaller, but keep step granular).
      steps.push(
        await this.runStep(jobId, 8, async () => {
          const [scIns, scSites, bingSites] = await Promise.all([
            this.prisma.searchConsoleUrlInspection.deleteMany({
              where: { siteId },
            }),
            this.prisma.searchConsoleSitemap.deleteMany({ where: { siteId } }),
            this.prisma.bingSitemap.deleteMany({ where: { siteId } }),
          ]);
          return scIns.count + scSites.count + bingSites.count;
        }),
      );

      // 10. Non-FK references — true-erasure path.
      steps.push(
        await this.runStep(jobId, 9, async () => {
          const [notifications, translationUsage] = await Promise.all([
            this.prisma.notification.deleteMany({ where: { siteId } }),
            this.prisma.translationUsage.deleteMany({ where: { siteId } }),
          ]);
          return notifications.count + translationUsage.count;
        }),
      );

      // 11. Final site row — cascade-deletes all remaining FK children
      //     (domains, deployments, settings, redirects, structured data,
      //     SC/Bing connections + sync jobs, ai citation audits, translation
      //     jobs/glossaries, alerts, scheduled audit schedule, form
      //     definitions/templates/theme/routing rules, etc.). The audit_logs
      //     site_id is set to NULL via ON DELETE SET NULL so tenant audit
      //     history is preserved.
      steps.push(
        await this.runStep(jobId, 10, async () => {
          if (!site) return 0;
          await this.prisma.site.delete({ where: { id: siteId } });
          return 1;
        }),
      );

      // 12. Bust runtime host cache for any released identifiers.
      steps.push(
        await this.runStep(jobId, 11, async () => {
          const hosts = this.collectCacheHosts(site);
          await this.bustHostCache(hosts);
          return hosts.length;
        }),
      );

      const totalDeleted = steps.reduce((acc, s) => acc + s.deleted, 0);

      const completed = await this.prisma.siteDeletionJob.update({
        where: { id: jobId },
        data: {
          status: SiteDeletionJobStatus.COMPLETED,
          progress: SiteDeletionService.STEPS.length,
          currentStep: null,
          completedAt: new Date(),
          resultSummary: {
            steps,
            totalDeleted,
          } as unknown as Prisma.InputJsonValue,
        },
      });

      await this.adminService.createAuditLogForTenant({
        tenantId,
        actorUserId: job.requestedByUserId,
        action: "site.permanent_delete.completed",
        targetType: "site",
        targetId: siteId,
        metadata: {
          jobId: job.id,
          siteName: job.siteName,
          archivedSlug: job.archivedSlug,
          steps,
          totalDeleted,
        },
      });

      await this.notificationsService.createForTenantRoles({
        tenantId,
        roles: [TenantMembershipRole.OWNER, TenantMembershipRole.ADMIN],
        category: NotificationCategory.SYSTEM,
        title: `${job.siteName} was permanently deleted`,
        body: `All ${totalDeleted.toLocaleString()} site record${
          totalDeleted === 1 ? "" : "s"
        } were erased. Tenant audit history was preserved.`,
        actionUrl: "/workspace",
        metadata: {
          jobId: job.id,
          siteId,
          siteName: job.siteName,
          totalDeleted,
        },
      });

      return this.serializeJob(completed);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error ?? "unknown");
      const code =
        error instanceof Prisma.PrismaClientKnownRequestError
          ? error.code
          : "INTERNAL_ERROR";
      this.logger.error(
        `Site deletion job ${jobId} failed at step "${
          job.currentStep ?? "unknown"
        }": ${message}`,
        error instanceof Error ? error.stack : undefined,
      );

      const failed = await this.prisma.siteDeletionJob.update({
        where: { id: jobId },
        data: {
          status: SiteDeletionJobStatus.FAILED,
          completedAt: new Date(),
          errorCode: code,
          errorMessage: message.slice(0, 800),
          resultSummary: {
            steps,
          } as unknown as Prisma.InputJsonValue,
        },
      });

      try {
        await this.adminService.createAuditLogForTenant({
          tenantId: job.tenantId,
          actorUserId: job.requestedByUserId,
          action: "site.permanent_delete.failed",
          targetType: "site",
          targetId: job.siteId,
          metadata: {
            jobId: job.id,
            siteName: job.siteName,
            errorCode: code,
            errorMessage: message.slice(0, 800),
            steps,
          },
        });
      } catch (auditErr) {
        this.logger.warn(
          `Failed to record audit for failed deletion job ${jobId}: ${
            auditErr instanceof Error ? auditErr.message : String(auditErr)
          }`,
        );
      }

      return this.serializeJob(failed);
    }
  }

  // ─── Internals ───────────────────────────────────────────

  private async runStep(
    jobId: string,
    index: number,
    work: () => Promise<number>,
  ): Promise<DeletionStepResult> {
    const stepName = SiteDeletionService.STEPS[index] ?? `step_${index}`;
    await this.prisma.siteDeletionJob.update({
      where: { id: jobId },
      data: { currentStep: stepName, progress: index },
    });
    const deleted = await work();
    await this.prisma.siteDeletionJob.update({
      where: { id: jobId },
      data: { progress: index + 1 },
    });
    return { step: stepName, deleted };
  }

  private collectCacheHosts(
    site: {
      publicSubdomain: string | null;
      archivedPublicSubdomain: string | null;
      archivedDomains: string[];
      domains: { host: string }[];
    } | null,
  ): string[] {
    if (!site) return [];
    const hosts: string[] = [];
    const root = getConfiguredPlatformRootDomain(this.configService);

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
        `Failed to bust runtime host cache after permanent deletion: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private serializeJob(job: {
    id: string;
    tenantId: string;
    siteId: string;
    siteName: string;
    archivedSlug: string | null;
    status: SiteDeletionJobStatus;
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
  }): SiteDeletionJobSummary {
    return {
      id: job.id,
      tenantId: job.tenantId,
      siteId: job.siteId,
      siteName: job.siteName,
      archivedSlug: job.archivedSlug,
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

  /** Used by the cron service to list claimable work. */
  async listClaimableJobIds(limit = 5): Promise<string[]> {
    const rows = await this.prisma.siteDeletionJob.findMany({
      where: { status: SiteDeletionJobStatus.QUEUED },
      orderBy: [{ createdAt: "asc" }],
      take: limit,
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }
}
