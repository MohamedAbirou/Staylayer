import {
  BadRequestException,
  HttpException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  DeploymentStatus,
  DomainStatus,
  FormDeliveryStatus,
  FormSubmissionStatus,
  NotificationCategory,
  OperationalAlertSeverity,
  OperationalAlertStatus,
  OperationalAlertType,
  Prisma,
  TranslationJobStatus,
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { DeploymentsService } from "../deployments/deployments.service";
import { DomainsService } from "../domains/domains.service";
import { SubmissionOperationsService } from "../forms/submission-operations.service";
import { IndexNowService } from "../seo/indexnow/indexnow.service";
import { TranslationService } from "../translation/translation.service";

/**
 * Phase 9 — operator operations service.
 *
 * Cross-tenant read aggregates plus thin wrappers around existing
 * customer-domain services for the safe recovery actions the operator
 * console exposes. We deliberately:
 *
 *  - never duplicate Prisma logic that already lives on a feature service;
 *    we reuse `DeploymentsService.retryDeployment`,
 *    `DomainsService.adminRetryVerification`,
 *    `SubmissionOperationsService.requeueDelivery`,
 *    `TranslationService.retryJob`, and
 *    `IndexNowService.retrySubmission`.
 *  - bound every list at 100 items per page and serialize dates to ISO so
 *    the frontend never receives raw Prisma DateTime instances.
 *  - shape responses to the operator list contract documented in
 *    operator-console-docs/05: `{ data, total, page, limit, filters,
 *    generatedAt }`.
 */
@Injectable()
export class OperatorOperationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly deployments: DeploymentsService,
    private readonly domains: DomainsService,
    private readonly submissionOps: SubmissionOperationsService,
    private readonly indexNow: IndexNowService,
    private readonly translation: TranslationService,
  ) {}

  // ─── shared helpers ─────────────────────────────────────────────────

  private normalizePage(input?: number | string | null): number {
    const value =
      typeof input === "string" ? Number.parseInt(input, 10) : input;
    if (!Number.isFinite(value) || (value as number) < 1) return 1;
    return Math.floor(value as number);
  }

  private normalizeLimit(
    input?: number | string | null,
    fallback = 25,
  ): number {
    const value =
      typeof input === "string" ? Number.parseInt(input, 10) : input;
    if (!Number.isFinite(value) || (value as number) < 1) return fallback;
    return Math.min(100, Math.floor(value as number));
  }

  private buildEnvelope<T>(
    data: T[],
    total: number,
    page: number,
    limit: number,
    filters: Record<string, unknown>,
  ): OperatorListResponse<T> {
    return {
      data,
      total,
      page,
      limit,
      filters,
      generatedAt: new Date().toISOString(),
    };
  }

  // ─── Deployments ────────────────────────────────────────────────────

  async listDeployments(filters: {
    status?: DeploymentStatus | null;
    siteId?: string | null;
    tenantId?: string | null;
    q?: string | null;
    page?: number;
    limit?: number;
  }): Promise<OperatorListResponse<OperatorDeploymentListItem>> {
    const page = this.normalizePage(filters.page);
    const limit = this.normalizeLimit(filters.limit);

    const where: Prisma.DeploymentWhereInput = {};
    if (filters.status) where.status = filters.status;
    if (filters.siteId) where.siteId = filters.siteId;
    if (filters.tenantId) where.site = { tenantId: filters.tenantId };
    if (filters.q?.trim()) {
      const term = filters.q.trim();
      where.OR = [
        { id: term },
        { providerProjectId: term },
        { site: { is: { name: { contains: term, mode: "insensitive" } } } },
        {
          site: {
            is: {
              tenant: { is: { name: { contains: term, mode: "insensitive" } } },
            },
          },
        },
      ];
    }

    const [rows, total] = await Promise.all([
      this.prisma.deployment.findMany({
        where,
        include: {
          site: {
            select: {
              id: true,
              name: true,
              tenantId: true,
              tenant: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.deployment.count({ where }),
    ]);

    const data = rows.map((row) => this.toDeploymentListItem(row));
    return this.buildEnvelope(data, total, page, limit, {
      status: filters.status ?? null,
      siteId: filters.siteId ?? null,
      tenantId: filters.tenantId ?? null,
      q: filters.q ?? null,
    });
  }

  async getDeployment(deploymentId: string): Promise<OperatorDeploymentDetail> {
    const row = await this.prisma.deployment.findUnique({
      where: { id: deploymentId },
      include: {
        site: {
          select: {
            id: true,
            name: true,
            tenantId: true,
            tenant: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (!row) {
      throw new NotFoundException({
        code: "DEPLOYMENT_NOT_FOUND",
        message: "Deployment not found",
      });
    }
    const recent = await this.prisma.deployment.findMany({
      where: { siteId: row.siteId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        status: true,
        providerProjectId: true,
        providerDeployId: true,
        errorMessage: true,
        url: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return {
      generatedAt: new Date().toISOString(),
      ...this.toDeploymentListItem(row),
      providerDeployId: row.providerDeployId,
      url: row.url,
      siteTimeline: recent.map((r) => ({
        id: r.id,
        status: r.status,
        providerProjectId: r.providerProjectId,
        providerDeployId: r.providerDeployId,
        url: r.url,
        errorMessage: r.errorMessage,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      })),
      auditContext: {
        targetType: "deployment",
        targetId: row.id,
        tenantId: row.site.tenantId,
        siteId: row.siteId,
      },
    };
  }

  async retryDeployment(
    deploymentId: string,
  ): Promise<OperatorDeploymentListItem> {
    const before = await this.prisma.deployment.findUnique({
      where: { id: deploymentId },
      select: { status: true },
    });
    if (!before) {
      throw new NotFoundException({
        code: "DEPLOYMENT_NOT_FOUND",
        message: "Deployment not found",
      });
    }
    if (before.status !== DeploymentStatus.FAILED) {
      throw new BadRequestException({
        code: "DEPLOYMENT_NOT_RETRIABLE",
        message: "Only failed deployments can be retried",
      });
    }
    await this.deployments.retryDeployment(deploymentId);
    const row = await this.prisma.deployment.findUniqueOrThrow({
      where: { id: deploymentId },
      include: {
        site: {
          select: {
            id: true,
            name: true,
            tenantId: true,
            tenant: { select: { id: true, name: true } },
          },
        },
      },
    });
    return this.toDeploymentListItem(row);
  }

  private toDeploymentListItem(
    row: Prisma.DeploymentGetPayload<{
      include: {
        site: {
          select: {
            id: true;
            name: true;
            tenantId: true;
            tenant: { select: { id: true; name: true } };
          };
        };
      };
    }>,
  ): OperatorDeploymentListItem {
    return {
      id: row.id,
      status: row.status,
      siteId: row.siteId,
      siteName: row.site.name,
      tenantId: row.site.tenantId,
      tenantName: row.site.tenant.name,
      providerProjectId: row.providerProjectId,
      errorMessage: row.errorMessage,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  // ─── Domains ────────────────────────────────────────────────────────

  async listDomains(filters: {
    status?: DomainStatus | null;
    tenantId?: string | null;
    siteId?: string | null;
    q?: string | null;
    page?: number;
    limit?: number;
  }): Promise<OperatorListResponse<OperatorDomainListItem>> {
    const page = this.normalizePage(filters.page);
    const limit = this.normalizeLimit(filters.limit);

    const where: Prisma.DomainWhereInput = {};
    if (filters.status) where.status = filters.status;
    if (filters.siteId) where.siteId = filters.siteId;
    if (filters.tenantId) where.site = { tenantId: filters.tenantId };
    if (filters.q?.trim()) {
      const term = filters.q.trim();
      where.OR = [
        { host: { contains: term, mode: "insensitive" } },
        { site: { is: { name: { contains: term, mode: "insensitive" } } } },
        {
          site: {
            is: {
              tenant: { is: { name: { contains: term, mode: "insensitive" } } },
            },
          },
        },
      ];
    }

    const [rows, total] = await Promise.all([
      this.prisma.domain.findMany({
        where,
        include: {
          site: {
            select: {
              id: true,
              name: true,
              tenantId: true,
              tenant: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.domain.count({ where }),
    ]);

    const data = rows.map((row) => this.toDomainListItem(row));
    return this.buildEnvelope(data, total, page, limit, {
      status: filters.status ?? null,
      siteId: filters.siteId ?? null,
      tenantId: filters.tenantId ?? null,
      q: filters.q ?? null,
    });
  }

  async retryDomainVerification(
    domainId: string,
  ): Promise<OperatorDomainListItem> {
    await this.domains.adminRetryVerification(domainId);
    const row = await this.prisma.domain.findUniqueOrThrow({
      where: { id: domainId },
      include: {
        site: {
          select: {
            id: true,
            name: true,
            tenantId: true,
            tenant: { select: { id: true, name: true } },
          },
        },
      },
    });
    return this.toDomainListItem(row);
  }

  private toDomainListItem(
    row: Prisma.DomainGetPayload<{
      include: {
        site: {
          select: {
            id: true;
            name: true;
            tenantId: true;
            tenant: { select: { id: true; name: true } };
          };
        };
      };
    }>,
  ): OperatorDomainListItem {
    return {
      id: row.id,
      host: row.host,
      isPrimary: row.isPrimary,
      status: row.status,
      lastError: row.lastError,
      lastCheckedAt: row.lastCheckedAt?.toISOString() ?? null,
      verifiedAt: row.verifiedAt?.toISOString() ?? null,
      siteId: row.siteId,
      siteName: row.site.name,
      tenantId: row.site.tenantId,
      tenantName: row.site.tenant.name,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  // ─── Form deliveries / submissions ─────────────────────────────────

  async listFormSubmissions(filters: {
    status?: FormSubmissionStatus | null;
    siteId?: string | null;
    tenantId?: string | null;
    page?: number;
    limit?: number;
  }): Promise<OperatorListResponse<OperatorFormSubmissionListItem>> {
    const page = this.normalizePage(filters.page);
    const limit = this.normalizeLimit(filters.limit);

    const where: Prisma.FormSubmissionWhereInput = {};
    if (filters.status) where.status = filters.status;
    if (filters.siteId) where.siteId = filters.siteId;
    if (filters.tenantId) where.site = { tenantId: filters.tenantId };

    const [rows, total] = await Promise.all([
      this.prisma.formSubmission.findMany({
        where,
        include: {
          formDefinition: { select: { id: true, key: true, name: true } },
          site: {
            select: {
              id: true,
              name: true,
              tenantId: true,
              tenant: { select: { id: true, name: true } },
            },
          },
          deliveries: {
            select: { id: true, status: true, channel: true, attempts: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.formSubmission.count({ where }),
    ]);

    const data: OperatorFormSubmissionListItem[] = rows.map((row) => ({
      id: row.id,
      formType: row.formType,
      formKey: row.formDefinition?.key ?? null,
      formName: row.formDefinition?.name ?? null,
      status: row.status,
      spamScore: row.spamScore,
      siteId: row.siteId,
      siteName: row.site.name,
      tenantId: row.site.tenantId,
      tenantName: row.site.tenant.name,
      deliveries: row.deliveries.map((d) => ({
        id: d.id,
        status: d.status,
        channel: d.channel,
        attempts: d.attempts,
      })),
      createdAt: row.createdAt.toISOString(),
    }));

    return this.buildEnvelope(data, total, page, limit, {
      status: filters.status ?? null,
      siteId: filters.siteId ?? null,
      tenantId: filters.tenantId ?? null,
    });
  }

  async listFormDeliveries(filters: {
    status?: FormDeliveryStatus | null;
    siteId?: string | null;
    tenantId?: string | null;
    page?: number;
    limit?: number;
  }): Promise<OperatorListResponse<OperatorFormDeliveryListItem>> {
    const page = this.normalizePage(filters.page);
    const limit = this.normalizeLimit(filters.limit);

    const where: Prisma.FormDeliveryWhereInput = {};
    if (filters.status) where.status = filters.status;
    if (filters.siteId) where.siteId = filters.siteId;
    if (filters.tenantId) where.site = { tenantId: filters.tenantId };

    const [rows, total] = await Promise.all([
      this.prisma.formDelivery.findMany({
        where,
        include: {
          site: {
            select: {
              id: true,
              name: true,
              tenantId: true,
              tenant: { select: { id: true, name: true } },
            },
          },
        },
        // Failed-first so operators can immediately triage. Within a status,
        // newer attempts surface higher.
        orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.formDelivery.count({ where }),
    ]);

    const data: OperatorFormDeliveryListItem[] = rows.map((row) => ({
      id: row.id,
      submissionId: row.submissionId,
      purpose: row.purpose,
      channel: row.channel,
      destination: row.destination,
      status: row.status,
      attempts: row.attempts,
      responseCode: row.responseCode,
      errorMessage: row.errorMessage,
      nextAttemptAt: row.nextAttemptAt?.toISOString() ?? null,
      lastAttemptAt: row.lastAttemptAt?.toISOString() ?? null,
      deliveredAt: row.deliveredAt?.toISOString() ?? null,
      siteId: row.siteId,
      siteName: row.site.name,
      tenantId: row.site.tenantId,
      tenantName: row.site.tenant.name,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));

    return this.buildEnvelope(data, total, page, limit, {
      status: filters.status ?? null,
      siteId: filters.siteId ?? null,
      tenantId: filters.tenantId ?? null,
    });
  }

  async replayFormDelivery(deliveryId: string) {
    try {
      const result = await this.submissionOps.requeueDelivery(deliveryId);
      return { ok: true as const, ...result };
    } catch (err) {
      this.rethrowKnown(err);
      throw err;
    }
  }

  // ─── Operational alerts ────────────────────────────────────────────

  async listAlerts(filters: {
    status?: OperationalAlertStatus | null;
    severity?: OperationalAlertSeverity | null;
    type?: OperationalAlertType | null;
    siteId?: string | null;
    tenantId?: string | null;
    page?: number;
    limit?: number;
  }): Promise<OperatorListResponse<OperatorAlertListItem>> {
    const page = this.normalizePage(filters.page);
    const limit = this.normalizeLimit(filters.limit);

    const where: Prisma.OperationalAlertWhereInput = {};
    if (filters.status) where.status = filters.status;
    if (filters.severity) where.severity = filters.severity;
    if (filters.type) where.type = filters.type;
    if (filters.siteId) where.siteId = filters.siteId;
    if (filters.tenantId) where.site = { tenantId: filters.tenantId };

    const [rows, total] = await Promise.all([
      this.prisma.operationalAlert.findMany({
        where,
        include: {
          site: {
            select: {
              id: true,
              name: true,
              tenantId: true,
              tenant: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: [{ status: "asc" }, { lastTriggeredAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.operationalAlert.count({ where }),
    ]);

    const data: OperatorAlertListItem[] = rows.map((row) => ({
      id: row.id,
      type: row.type,
      severity: row.severity,
      status: row.status,
      fingerprint: row.fingerprint,
      message: row.message,
      siteId: row.siteId,
      siteName: row.site.name,
      tenantId: row.site.tenantId,
      tenantName: row.site.tenant.name,
      firstTriggeredAt: row.firstTriggeredAt.toISOString(),
      lastTriggeredAt: row.lastTriggeredAt.toISOString(),
      resolvedAt: row.resolvedAt?.toISOString() ?? null,
    }));

    return this.buildEnvelope(data, total, page, limit, {
      status: filters.status ?? null,
      severity: filters.severity ?? null,
      type: filters.type ?? null,
      siteId: filters.siteId ?? null,
      tenantId: filters.tenantId ?? null,
    });
  }

  async resolveAlert(alertId: string): Promise<OperatorAlertListItem> {
    const existing = await this.prisma.operationalAlert.findUnique({
      where: { id: alertId },
      select: { id: true, status: true },
    });
    if (!existing) {
      throw new NotFoundException({
        code: "ALERT_NOT_FOUND",
        message: "Operational alert not found",
      });
    }
    if (existing.status === OperationalAlertStatus.RESOLVED) {
      throw new BadRequestException({
        code: "ALERT_ALREADY_RESOLVED",
        message: "Alert is already resolved",
      });
    }
    await this.prisma.operationalAlert.update({
      where: { id: alertId },
      data: { status: OperationalAlertStatus.RESOLVED, resolvedAt: new Date() },
    });
    const row = await this.prisma.operationalAlert.findUniqueOrThrow({
      where: { id: alertId },
      include: {
        site: {
          select: {
            id: true,
            name: true,
            tenantId: true,
            tenant: { select: { id: true, name: true } },
          },
        },
      },
    });
    return {
      id: row.id,
      type: row.type,
      severity: row.severity,
      status: row.status,
      fingerprint: row.fingerprint,
      message: row.message,
      siteId: row.siteId,
      siteName: row.site.name,
      tenantId: row.site.tenantId,
      tenantName: row.site.tenant.name,
      firstTriggeredAt: row.firstTriggeredAt.toISOString(),
      lastTriggeredAt: row.lastTriggeredAt.toISOString(),
      resolvedAt: row.resolvedAt?.toISOString() ?? null,
    };
  }

  // ─── SEO ───────────────────────────────────────────────────────────

  async getSeoSiteSummary(siteId: string): Promise<OperatorSeoSiteSummary> {
    const site = await this.prisma.site.findUnique({
      where: { id: siteId },
      select: {
        id: true,
        name: true,
        tenantId: true,
        tenant: { select: { id: true, name: true } },
      },
    });
    if (!site) {
      throw new NotFoundException({
        code: "SITE_NOT_FOUND",
        message: "Site not found",
      });
    }

    const [
      redirectsTotal,
      structuredData,
      submissionsRecent,
      psiLatest,
      hreflangLatest,
      crawlLatest,
    ] = await Promise.all([
      this.prisma.redirect.count({ where: { siteId } }),
      this.prisma.siteStructuredData.findUnique({ where: { siteId } }),
      this.prisma.sitemapSubmissionLog.findMany({
        where: { siteId },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      this.prisma.psiAudit.findFirst({
        where: { siteId },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.hreflangScan.findFirst({
        where: { siteId },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.seoCrawlJob.findFirst({
        where: { siteId },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      site: {
        id: site.id,
        name: site.name,
        tenantId: site.tenantId,
        tenantName: site.tenant.name,
      },
      redirects: { total: redirectsTotal },
      structuredData: structuredData
        ? {
            id: structuredData.id,
            businessType: structuredData.businessType,
            enabledSchemas: structuredData.enabledSchemas,
            updatedAt: structuredData.updatedAt.toISOString(),
          }
        : null,
      sitemapSubmissions: submissionsRecent.map((row) => ({
        id: row.id,
        target: row.target,
        status: row.status,
        urlCount: row.urlCount,
        attempts: row.attempts,
        responseStatus: row.responseStatus,
        reason: row.reason,
        lastAttemptAt: row.lastAttemptAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
      })),
      psi: psiLatest
        ? {
            id: psiLatest.id,
            status: psiLatest.status,
            strategy: psiLatest.strategy,
            createdAt: psiLatest.createdAt.toISOString(),
          }
        : null,
      hreflang: hreflangLatest
        ? {
            id: hreflangLatest.id,
            status: hreflangLatest.status,
            errorCount: hreflangLatest.errorCount,
            warningCount: hreflangLatest.warningCount,
            createdAt: hreflangLatest.createdAt.toISOString(),
          }
        : null,
      crawl: crawlLatest
        ? {
            id: crawlLatest.id,
            status: crawlLatest.status,
            createdAt: crawlLatest.createdAt.toISOString(),
          }
        : null,
      auditContext: {
        targetType: "site",
        targetId: site.id,
        tenantId: site.tenantId,
        siteId: site.id,
      },
    };
  }

  async retrySitemapSubmission(siteId: string, logId: string, actor: string) {
    return this.indexNow.retrySubmission(siteId, logId, actor);
  }

  // ─── Translations ──────────────────────────────────────────────────

  async listTranslationJobs(filters: {
    status?: TranslationJobStatus | null;
    tenantId?: string | null;
    siteId?: string | null;
    page?: number;
    limit?: number;
  }): Promise<OperatorListResponse<OperatorTranslationJobListItem>> {
    const page = this.normalizePage(filters.page);
    const limit = this.normalizeLimit(filters.limit);

    const where: Prisma.TranslationJobWhereInput = {};
    if (filters.status) where.status = filters.status;
    if (filters.tenantId) where.tenantId = filters.tenantId;
    if (filters.siteId) where.siteId = filters.siteId;

    const [rows, total] = await Promise.all([
      this.prisma.translationJob.findMany({
        where,
        include: {
          tenant: { select: { id: true, name: true } },
          site: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.translationJob.count({ where }),
    ]);

    const data: OperatorTranslationJobListItem[] = rows.map((row) => ({
      id: row.id,
      tenantId: row.tenantId,
      tenantName: row.tenant.name,
      siteId: row.siteId,
      siteName: row.site.name,
      sourceLocale: row.sourceLocale,
      targetLocale: row.targetLocale,
      status: row.status,
      totalPages: row.totalPages,
      completedPages: row.completedPages,
      failedPages: row.failedPages,
      charactersUsed: row.charactersUsed,
      error: row.error,
      createdAt: row.createdAt.toISOString(),
      startedAt: row.startedAt?.toISOString() ?? null,
      completedAt: row.completedAt?.toISOString() ?? null,
    }));

    return this.buildEnvelope(data, total, page, limit, {
      status: filters.status ?? null,
      tenantId: filters.tenantId ?? null,
      siteId: filters.siteId ?? null,
    });
  }

  async retryTranslationJob(
    jobId: string,
  ): Promise<OperatorTranslationJobListItem> {
    const job = await this.prisma.translationJob.findUnique({
      where: { id: jobId },
      select: { id: true, tenantId: true },
    });
    if (!job) {
      throw new NotFoundException({
        code: "TRANSLATION_JOB_NOT_FOUND",
        message: "Translation job not found",
      });
    }
    await this.translation.retryJob(job.tenantId, jobId);
    const row = await this.prisma.translationJob.findUniqueOrThrow({
      where: { id: jobId },
      include: {
        tenant: { select: { id: true, name: true } },
        site: { select: { id: true, name: true } },
      },
    });
    return {
      id: row.id,
      tenantId: row.tenantId,
      tenantName: row.tenant.name,
      siteId: row.siteId,
      siteName: row.site.name,
      sourceLocale: row.sourceLocale,
      targetLocale: row.targetLocale,
      status: row.status,
      totalPages: row.totalPages,
      completedPages: row.completedPages,
      failedPages: row.failedPages,
      charactersUsed: row.charactersUsed,
      error: row.error,
      createdAt: row.createdAt.toISOString(),
      startedAt: row.startedAt?.toISOString() ?? null,
      completedAt: row.completedAt?.toISOString() ?? null,
    };
  }

  async listGlossaries(filters: {
    tenantId?: string | null;
    siteId?: string | null;
    page?: number;
    limit?: number;
  }): Promise<OperatorListResponse<OperatorGlossaryListItem>> {
    const page = this.normalizePage(filters.page);
    const limit = this.normalizeLimit(filters.limit);

    const where: Prisma.TranslationGlossaryWhereInput = {};
    if (filters.tenantId) where.tenantId = filters.tenantId;
    if (filters.siteId) where.siteId = filters.siteId;

    const [rows, total] = await Promise.all([
      this.prisma.translationGlossary.findMany({
        where,
        include: {
          tenant: { select: { id: true, name: true } },
          site: { select: { id: true, name: true } },
          _count: { select: { terms: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.translationGlossary.count({ where }),
    ]);

    const data: OperatorGlossaryListItem[] = rows.map((row) => ({
      id: row.id,
      name: row.name,
      tenantId: row.tenantId,
      tenantName: row.tenant.name,
      siteId: row.siteId,
      siteName: row.site?.name ?? null,
      termCount: row._count.terms,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));

    return this.buildEnvelope(data, total, page, limit, {
      tenantId: filters.tenantId ?? null,
      siteId: filters.siteId ?? null,
    });
  }

  async getLocaleCompleteness(siteId: string) {
    const site = await this.prisma.site.findUnique({
      where: { id: siteId },
      select: { id: true },
    });
    if (!site) {
      throw new NotFoundException({
        code: "SITE_NOT_FOUND",
        message: "Site not found",
      });
    }
    const data = await this.translation.getLocaleCompleteness(siteId);
    return {
      generatedAt: new Date().toISOString(),
      siteId,
      data,
    };
  }

  // ─── Notifications ─────────────────────────────────────────────────

  async listNotifications(filters: {
    tenantId?: string | null;
    userId?: string | null;
    category?: NotificationCategory | null;
    unreadOnly?: boolean;
    page?: number;
    limit?: number;
  }): Promise<OperatorListResponse<OperatorNotificationListItem>> {
    const page = this.normalizePage(filters.page);
    const limit = this.normalizeLimit(filters.limit);

    const where: Prisma.NotificationWhereInput = {};
    if (filters.tenantId) where.tenantId = filters.tenantId;
    if (filters.userId) where.userId = filters.userId;
    if (filters.category) where.category = filters.category;
    if (filters.unreadOnly) where.readAt = null;

    const [rows, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
    ]);

    const tenantIds = Array.from(new Set(rows.map((r) => r.tenantId)));
    const userIds = Array.from(
      new Set(rows.map((r) => r.userId).filter((id): id is string => !!id)),
    );

    const [tenants, users] = await Promise.all([
      tenantIds.length
        ? this.prisma.tenant.findMany({
            where: { id: { in: tenantIds } },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
      userIds.length
        ? this.prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, email: true },
          })
        : Promise.resolve([]),
    ]);

    const tenantById = new Map(tenants.map((t) => [t.id, t.name]));
    const userById = new Map(users.map((u) => [u.id, u.email]));

    const data: OperatorNotificationListItem[] = rows.map((row) => ({
      id: row.id,
      tenantId: row.tenantId,
      tenantName: tenantById.get(row.tenantId) ?? null,
      userId: row.userId,
      userEmail: row.userId ? (userById.get(row.userId) ?? null) : null,
      siteId: row.siteId,
      category: row.category,
      channel: row.channel,
      title: row.title,
      body: row.body,
      actionUrl: row.actionUrl,
      readAt: row.readAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    }));

    return this.buildEnvelope(data, total, page, limit, {
      tenantId: filters.tenantId ?? null,
      userId: filters.userId ?? null,
      category: filters.category ?? null,
      unreadOnly: !!filters.unreadOnly,
    });
  }

  // ─── shared ────────────────────────────────────────────────────────

  private rethrowKnown(err: unknown): never | void {
    if (err instanceof HttpException) {
      throw err;
    }
    if (
      err &&
      typeof err === "object" &&
      "status" in err &&
      typeof (err as { status: unknown }).status === "number"
    ) {
      const record = err as Record<string, unknown>;
      const status = record.status as number;
      const message =
        typeof record.message === "string"
          ? record.message
          : "Operation failed";
      const code = typeof record.code === "string" ? record.code : undefined;
      throw new HttpException({ code, message }, status);
    }
  }
}

// ─── Public DTO shapes ────────────────────────────────────────────────

export interface OperatorListResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  filters: Record<string, unknown>;
  generatedAt: string;
}

export interface OperatorDeploymentListItem {
  id: string;
  status: DeploymentStatus;
  siteId: string;
  siteName: string;
  tenantId: string;
  tenantName: string;
  providerProjectId: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OperatorDeploymentDetail extends OperatorDeploymentListItem {
  generatedAt: string;
  providerDeployId: string | null;
  url: string | null;
  siteTimeline: Array<{
    id: string;
    status: DeploymentStatus;
    providerProjectId: string | null;
    providerDeployId: string | null;
    url: string | null;
    errorMessage: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
  auditContext: {
    targetType: string;
    targetId: string;
    tenantId: string;
    siteId: string;
  };
}

export interface OperatorDomainListItem {
  id: string;
  host: string;
  isPrimary: boolean;
  status: DomainStatus;
  lastError: string | null;
  lastCheckedAt: string | null;
  verifiedAt: string | null;
  siteId: string;
  siteName: string;
  tenantId: string;
  tenantName: string;
  createdAt: string;
  updatedAt: string;
}

export interface OperatorFormSubmissionListItem {
  id: string;
  formType: string;
  formKey: string | null;
  formName: string | null;
  status: FormSubmissionStatus;
  spamScore: number | null;
  siteId: string;
  siteName: string;
  tenantId: string;
  tenantName: string;
  deliveries: Array<{
    id: string;
    status: FormDeliveryStatus;
    channel: string;
    attempts: number;
  }>;
  createdAt: string;
}

export interface OperatorFormDeliveryListItem {
  id: string;
  submissionId: string;
  purpose: string;
  channel: string;
  destination: string;
  status: FormDeliveryStatus;
  attempts: number;
  responseCode: number | null;
  errorMessage: string | null;
  nextAttemptAt: string | null;
  lastAttemptAt: string | null;
  deliveredAt: string | null;
  siteId: string;
  siteName: string;
  tenantId: string;
  tenantName: string;
  createdAt: string;
  updatedAt: string;
}

export interface OperatorAlertListItem {
  id: string;
  type: OperationalAlertType;
  severity: OperationalAlertSeverity;
  status: OperationalAlertStatus;
  fingerprint: string;
  message: string;
  siteId: string;
  siteName: string;
  tenantId: string;
  tenantName: string;
  firstTriggeredAt: string;
  lastTriggeredAt: string;
  resolvedAt: string | null;
}

export interface OperatorSeoSiteSummary {
  generatedAt: string;
  site: { id: string; name: string; tenantId: string; tenantName: string };
  redirects: { total: number };
  structuredData: {
    id: string;
    businessType: string;
    enabledSchemas: string[];
    updatedAt: string;
  } | null;
  sitemapSubmissions: Array<{
    id: string;
    target: string;
    status: string;
    urlCount: number;
    attempts: number;
    responseStatus: number | null;
    reason: string | null;
    lastAttemptAt: string | null;
    createdAt: string;
  }>;
  psi: {
    id: string;
    status: string;
    strategy: string;
    createdAt: string;
  } | null;
  hreflang: {
    id: string;
    status: string;
    errorCount: number;
    warningCount: number;
    createdAt: string;
  } | null;
  crawl: { id: string; status: string; createdAt: string } | null;
  auditContext: {
    targetType: string;
    targetId: string;
    tenantId: string;
    siteId: string;
  };
}

export interface OperatorTranslationJobListItem {
  id: string;
  tenantId: string;
  tenantName: string;
  siteId: string;
  siteName: string;
  sourceLocale: string;
  targetLocale: string;
  status: TranslationJobStatus;
  totalPages: number;
  completedPages: number;
  failedPages: number;
  charactersUsed: number;
  error: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface OperatorGlossaryListItem {
  id: string;
  name: string;
  tenantId: string;
  tenantName: string;
  siteId: string | null;
  siteName: string | null;
  termCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface OperatorNotificationListItem {
  id: string;
  tenantId: string;
  tenantName: string | null;
  userId: string | null;
  userEmail: string | null;
  siteId: string | null;
  category: NotificationCategory;
  channel: string;
  title: string;
  body: string;
  actionUrl: string | null;
  readAt: string | null;
  createdAt: string;
}
