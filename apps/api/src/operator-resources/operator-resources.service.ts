import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  DeploymentStatus,
  DomainStatus,
  OperationalAlertStatus,
  PlatformRole,
  Prisma,
  SiteStatus,
  SubscriptionStatus,
  TenantStatus,
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  OPERATOR_PERMISSIONS,
  getPermissionsForRole,
  hasAllPermissions,
} from "../auth/operator/permissions/operator-permissions.registry";
import { redactAuditMetadata } from "../common/redact-audit-metadata";
import type { OperatorAuditScope } from "./dto/operator-audit-query.dto";

/**
 * Operator-only read services backing the Phase 4 "resource shell".
 *
 * All read APIs:
 *  - Are scoped to /operator/* routes and require an operator JWT.
 *  - Are permission-gated per controller (read-only `*.read.*` keys).
 *  - Use bounded pagination (limit ≤ 100) and parameterised filters so the
 *    operator surface cannot be used to drive expensive scans or to bypass
 *    SQL injection protections.
 *  - Return ISO-string dates so the wire format is stable and
 *    JSON-serialisable without bespoke client adapters.
 *
 * Notes on cross-tenant access: operator endpoints intentionally cross
 * tenant boundaries (that is the whole point of the operator console). We
 * therefore NEVER scope by `req.user.activeTenantId`; instead we record
 * the operator's role and request id via the audit interceptor and rely on
 * the permission registry to fence dangerous actions in later phases.
 */
@Injectable()
export class OperatorResourcesService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Tenants ────────────────────────────────────────────────────────

  async getTenantDetail(params: {
    tenantId: string;
    includeBilling: boolean;
  }): Promise<TenantDetailResponse> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: params.tenantId },
      select: {
        id: true,
        slug: true,
        name: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            memberships: true,
            sites: true,
          },
        },
        memberships: {
          orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
          take: 25,
          select: {
            id: true,
            role: true,
            isDefault: true,
            createdAt: true,
            user: {
              select: { id: true, email: true },
            },
          },
        },
        sites: {
          orderBy: [{ updatedAt: "desc" }],
          take: 50,
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
            publicSubdomain: true,
            primaryLocale: true,
            createdAt: true,
            updatedAt: true,
            _count: {
              select: { domains: true, pages: true },
            },
            deployments: {
              orderBy: [{ createdAt: "desc" }],
              take: 1,
              select: {
                id: true,
                status: true,
                url: true,
                createdAt: true,
                updatedAt: true,
              },
            },
            domains: {
              where: { isPrimary: true },
              take: 1,
              select: {
                id: true,
                host: true,
                status: true,
                isPrimary: true,
              },
            },
            alerts: {
              where: { status: OperationalAlertStatus.OPEN },
              select: { id: true, severity: true },
            },
          },
        },
        subscriptions: {
          orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
          take: 5,
          select: {
            id: true,
            provider: true,
            planKey: true,
            status: true,
            currentPeriodStart: true,
            currentPeriodEnd: true,
            cancelAtPeriodEnd: true,
            pendingPlanKey: true,
            pendingPlanEffectiveAt: true,
            gracePeriodEndsAt: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!tenant) {
      throw new NotFoundException({
        code: "OPERATOR_TENANT_NOT_FOUND",
        message: "Tenant not found",
      });
    }

    const recentAudit = await this.prisma.auditLog.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        action: true,
        targetType: true,
        targetId: true,
        actorUserId: true,
        siteId: true,
        metadata: true,
        createdAt: true,
      },
    });
    const operatorAudit = await this.prisma.operatorAuditLog.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        requestId: true,
        action: true,
        actorUserId: true,
        platformRole: true,
        targetType: true,
        targetId: true,
        siteId: true,
        statusCode: true,
        sensitive: true,
        reason: true,
        createdAt: true,
      },
    });

    const actorEmailById = await this.resolveActorEmails([
      ...recentAudit
        .map((row) => row.actorUserId)
        .filter((v): v is string => !!v),
      ...operatorAudit.map((row) => row.actorUserId),
    ]);

    const openAlerts = tenant.sites.reduce(
      (acc, site) => acc + site.alerts.length,
      0,
    );

    return {
      tenant: {
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
        status: tenant.status,
        createdAt: tenant.createdAt.toISOString(),
        updatedAt: tenant.updatedAt.toISOString(),
        memberCount: tenant._count.memberships,
        siteCount: tenant._count.sites,
        openAlerts,
      },
      members: tenant.memberships.map((m) => ({
        id: m.id,
        role: m.role,
        isDefault: m.isDefault,
        joinedAt: m.createdAt.toISOString(),
        user: {
          id: m.user.id,
          email: m.user.email,
          name: null,
        },
      })),
      sites: tenant.sites.map((site) => ({
        id: site.id,
        name: site.name,
        slug: site.slug,
        status: site.status,
        publicSubdomain: site.publicSubdomain,
        primaryLocale: site.primaryLocale,
        createdAt: site.createdAt.toISOString(),
        updatedAt: site.updatedAt.toISOString(),
        domainCount: site._count.domains,
        pageCount: site._count.pages,
        primaryDomain: site.domains[0]?.host ?? null,
        latestDeployment: site.deployments[0]
          ? {
              id: site.deployments[0].id,
              status: site.deployments[0].status,
              url: site.deployments[0].url,
              createdAt: site.deployments[0].createdAt.toISOString(),
              updatedAt: site.deployments[0].updatedAt.toISOString(),
            }
          : null,
        openAlerts: site.alerts.length,
      })),
      subscriptions: params.includeBilling
        ? tenant.subscriptions.map((sub) => ({
            id: sub.id,
            provider: sub.provider,
            planKey: sub.planKey,
            status: sub.status,
            currentPeriodStart: sub.currentPeriodStart?.toISOString() ?? null,
            currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
            cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
            pendingPlanKey: sub.pendingPlanKey,
            pendingPlanEffectiveAt:
              sub.pendingPlanEffectiveAt?.toISOString() ?? null,
            gracePeriodEndsAt: sub.gracePeriodEndsAt?.toISOString() ?? null,
            updatedAt: sub.updatedAt.toISOString(),
          }))
        : tenant.subscriptions.slice(0, 1).map((sub) => ({
            id: sub.id,
            provider: sub.provider,
            planKey: sub.planKey,
            status: sub.status,
            currentPeriodStart: null,
            currentPeriodEnd: null,
            cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
            pendingPlanKey: null,
            pendingPlanEffectiveAt: null,
            gracePeriodEndsAt: null,
            updatedAt: sub.updatedAt.toISOString(),
          })),
      audit: this.mergeAuditFeeds(
        recentAudit,
        operatorAudit,
        actorEmailById,
        25,
      ),
      generatedAt: new Date().toISOString(),
    };
  }

  async listTenantSearch(params: {
    q: string;
    limit: number;
  }): Promise<TenantSearchResult[]> {
    const term = params.q;
    const rows = await this.prisma.tenant.findMany({
      where: this.buildTenantSearchWhere(term),
      take: params.limit,
      orderBy: [{ updatedAt: "desc" }],
      select: {
        id: true,
        slug: true,
        name: true,
        status: true,
        _count: { select: { sites: true } },
      },
    });
    return rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      status: row.status,
      siteCount: row._count.sites,
    }));
  }

  // ─── Sites ──────────────────────────────────────────────────────────

  async getSiteDetail(siteId: string): Promise<SiteDetailResponse> {
    const site = await this.prisma.site.findUnique({
      where: { id: siteId },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        publicSubdomain: true,
        primaryLocale: true,
        enabledLocales: true,
        siteType: true,
        templateKey: true,
        publishedRevision: true,
        createdAt: true,
        updatedAt: true,
        archivedAt: true,
        tenant: {
          select: {
            id: true,
            slug: true,
            name: true,
            status: true,
          },
        },
        domains: {
          orderBy: [
            { isPrimary: "desc" },
            { status: "asc" },
            { createdAt: "asc" },
          ],
          select: {
            id: true,
            host: true,
            status: true,
            isPrimary: true,
            verifiedAt: true,
            lastCheckedAt: true,
            lastError: true,
          },
        },
        deployments: {
          orderBy: [{ createdAt: "desc" }],
          take: 10,
          select: {
            id: true,
            status: true,
            provider: true,
            url: true,
            errorMessage: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        alerts: {
          where: { status: OperationalAlertStatus.OPEN },
          orderBy: [{ lastTriggeredAt: "desc" }],
          take: 20,
          select: {
            id: true,
            type: true,
            severity: true,
            status: true,
            message: true,
            firstTriggeredAt: true,
            lastTriggeredAt: true,
          },
        },
        _count: {
          select: {
            pages: true,
            domains: true,
            formDefinitions: true,
            formSubmissions: true,
            redirects: true,
          },
        },
      },
    });

    if (!site) {
      throw new NotFoundException({
        code: "OPERATOR_SITE_NOT_FOUND",
        message: "Site not found",
      });
    }

    const [
      recentSubmissions,
      recentDeliveryFailures,
      recentAudit,
      operatorAudit,
    ] = await Promise.all([
      this.prisma.formSubmission.count({
        where: {
          siteId: site.id,
          createdAt: { gte: this.daysAgo(30) },
        },
      }),
      this.prisma.formDelivery.count({
        where: {
          siteId: site.id,
          status: "FAILED",
          createdAt: { gte: this.daysAgo(30) },
        },
      }),
      this.prisma.auditLog.findMany({
        where: { siteId: site.id },
        orderBy: { createdAt: "desc" },
        take: 25,
        select: {
          id: true,
          action: true,
          actorUserId: true,
          targetType: true,
          targetId: true,
          siteId: true,
          metadata: true,
          createdAt: true,
        },
      }),
      this.prisma.operatorAuditLog.findMany({
        where: { siteId: site.id },
        orderBy: { createdAt: "desc" },
        take: 25,
        select: {
          id: true,
          requestId: true,
          action: true,
          actorUserId: true,
          platformRole: true,
          targetType: true,
          targetId: true,
          siteId: true,
          statusCode: true,
          sensitive: true,
          reason: true,
          createdAt: true,
        },
      }),
    ]);

    const actorEmailById = await this.resolveActorEmails([
      ...recentAudit.map((r) => r.actorUserId).filter((v): v is string => !!v),
      ...operatorAudit.map((r) => r.actorUserId),
    ]);

    return {
      site: {
        id: site.id,
        name: site.name,
        slug: site.slug,
        status: site.status,
        publicSubdomain: site.publicSubdomain,
        primaryLocale: site.primaryLocale,
        enabledLocales: site.enabledLocales,
        siteType: site.siteType,
        templateKey: site.templateKey,
        publishedRevision: site.publishedRevision,
        createdAt: site.createdAt.toISOString(),
        updatedAt: site.updatedAt.toISOString(),
        archivedAt: site.archivedAt?.toISOString() ?? null,
        counts: site._count,
        recentSubmissions30d: recentSubmissions,
        recentDeliveryFailures30d: recentDeliveryFailures,
      },
      tenant: site.tenant,
      domains: site.domains.map((d) => ({
        id: d.id,
        host: d.host,
        status: d.status,
        isPrimary: d.isPrimary,
        verifiedAt: d.verifiedAt?.toISOString() ?? null,
        lastCheckedAt: d.lastCheckedAt?.toISOString() ?? null,
        lastError: d.lastError,
      })),
      deployments: site.deployments.map((d) => ({
        id: d.id,
        status: d.status,
        provider: d.provider,
        url: d.url,
        errorMessage: d.errorMessage,
        createdAt: d.createdAt.toISOString(),
        updatedAt: d.updatedAt.toISOString(),
      })),
      alerts: site.alerts.map((a) => ({
        id: a.id,
        type: a.type,
        severity: a.severity,
        status: a.status,
        message: a.message,
        firstTriggeredAt: a.firstTriggeredAt.toISOString(),
        lastTriggeredAt: a.lastTriggeredAt.toISOString(),
      })),
      audit: this.mergeAuditFeeds(
        recentAudit,
        operatorAudit,
        actorEmailById,
        30,
      ),
      generatedAt: new Date().toISOString(),
    };
  }

  // ─── Audit ──────────────────────────────────────────────────────────

  async listAudit(params: {
    role: PlatformRole;
    scope?: OperatorAuditScope;
    action?: string;
    tenantId?: string;
    siteId?: string;
    actorUserId?: string;
    page?: number;
    limit?: number;
  }): Promise<AuditFeedResponse> {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.max(1, Math.min(100, params.limit ?? 50));
    const skip = (page - 1) * limit;

    const held = getPermissionsForRole(params.role);
    const resolvedScope = this.resolveAuditScope(params.scope, held);

    if (!resolvedScope) {
      throw new ForbiddenException({
        code: "OPERATOR_AUDIT_SCOPE_DENIED",
        message:
          "Operator role does not have access to the requested audit scope.",
      });
    }

    const operatorWhere = this.buildOperatorAuditWhere({
      scope: resolvedScope,
      action: params.action,
      tenantId: params.tenantId,
      siteId: params.siteId,
      actorUserId: params.actorUserId,
    });
    const legacyWhere = this.buildLegacyAuditWhere({
      scope: resolvedScope,
      action: params.action,
      tenantId: params.tenantId,
      siteId: params.siteId,
      actorUserId: params.actorUserId,
    });

    // To support combined pagination over two physical tables we count both
    // sources, then page over the merged ordering. For Phase 4 the volume of
    // operator audit rows is modest; if either feed grows past ~10⁶ rows we
    // can move this to a SQL UNION view. The current implementation caps the
    // window at `skip + limit` per source so we never materialise more rows
    // than required to honor the requested page.
    const [operatorRows, legacyRows, operatorTotal, legacyTotal] =
      await Promise.all([
        this.prisma.operatorAuditLog.findMany({
          where: operatorWhere,
          orderBy: { createdAt: "desc" },
          take: skip + limit,
          select: {
            id: true,
            requestId: true,
            actorUserId: true,
            platformRole: true,
            action: true,
            targetType: true,
            targetId: true,
            tenantId: true,
            siteId: true,
            method: true,
            path: true,
            statusCode: true,
            durationMs: true,
            sensitive: true,
            reason: true,
            createdAt: true,
          },
        }),
        this.prisma.auditLog.findMany({
          where: legacyWhere,
          orderBy: { createdAt: "desc" },
          take: skip + limit,
          select: {
            id: true,
            actorUserId: true,
            action: true,
            targetType: true,
            targetId: true,
            tenantId: true,
            siteId: true,
            metadata: true,
            createdAt: true,
          },
        }),
        this.prisma.operatorAuditLog.count({ where: operatorWhere }),
        this.prisma.auditLog.count({ where: legacyWhere }),
      ]);

    const actorEmailById = await this.resolveActorEmails([
      ...operatorRows.map((r) => r.actorUserId),
      ...legacyRows.map((r) => r.actorUserId).filter((v): v is string => !!v),
    ]);

    const merged: AuditFeedEntry[] = [
      ...operatorRows.map((row) => ({
        kind: "operator" as const,
        id: row.id,
        requestId: row.requestId,
        action: row.action,
        actorId: row.actorUserId,
        actorEmail: actorEmailById.get(row.actorUserId) ?? "Unknown operator",
        actorRole: row.platformRole,
        targetType: row.targetType,
        targetId: row.targetId,
        tenantId: row.tenantId,
        siteId: row.siteId,
        method: row.method,
        path: row.path,
        statusCode: row.statusCode,
        durationMs: row.durationMs,
        sensitive: row.sensitive,
        reason: row.reason,
        createdAt: row.createdAt.toISOString(),
      })),
      ...legacyRows.map((row) => ({
        kind: "legacy" as const,
        id: row.id,
        requestId: null,
        action: row.action,
        actorId: row.actorUserId,
        actorEmail: row.actorUserId
          ? (actorEmailById.get(row.actorUserId) ?? "Unknown user")
          : "System",
        actorRole: null,
        targetType: row.targetType,
        targetId: row.targetId,
        tenantId: row.tenantId,
        siteId: row.siteId,
        method: null,
        path: null,
        statusCode: null,
        durationMs: null,
        sensitive: false as const,
        reason: null,
        metadata: this.toJsonObject(row.metadata),
        createdAt: row.createdAt.toISOString(),
      })),
    ];

    merged.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    const pageSlice = merged.slice(skip, skip + limit);

    return {
      data: pageSlice,
      total: operatorTotal + legacyTotal,
      page,
      limit,
      scope: resolvedScope,
      generatedAt: new Date().toISOString(),
    };
  }

  // ─── Global search ──────────────────────────────────────────────────

  async globalSearch(params: {
    q: string;
    limit: number;
    role: PlatformRole;
  }): Promise<GlobalSearchResponse> {
    const q = params.q;
    const limit = params.limit;
    if (q.length < 2) {
      return {
        query: q,
        tenants: [],
        sites: [],
        domains: [],
        users: [],
        generatedAt: new Date().toISOString(),
      };
    }

    const held = getPermissionsForRole(params.role);
    const canReadTenants = hasAllPermissions(held, [
      OPERATOR_PERMISSIONS.TENANT_LIST_ALL,
    ]);
    const canReadSites = hasAllPermissions(held, [
      OPERATOR_PERMISSIONS.SITE_LIST_ALL,
    ]);
    const canReadDomains = hasAllPermissions(held, [
      OPERATOR_PERMISSIONS.DOMAIN_READ_ALL,
    ]);
    const canReadUsers = hasAllPermissions(held, [
      OPERATOR_PERMISSIONS.OPERATOR_USER_READ_ALL,
    ]);

    const [tenants, sites, domains, users] = await Promise.all([
      canReadTenants
        ? this.prisma.tenant.findMany({
            where: this.buildTenantSearchWhere(q),
            orderBy: [{ updatedAt: "desc" }],
            take: limit,
            select: {
              id: true,
              slug: true,
              name: true,
              status: true,
              _count: { select: { sites: true } },
            },
          })
        : Promise.resolve(
            [] as Array<{
              id: string;
              slug: string;
              name: string;
              status: TenantStatus;
              _count: { sites: number };
            }>,
          ),
      canReadSites
        ? this.prisma.site.findMany({
            where: this.buildSiteSearchWhere(q),
            orderBy: [{ updatedAt: "desc" }],
            take: limit,
            select: {
              id: true,
              name: true,
              slug: true,
              status: true,
              publicSubdomain: true,
              tenant: { select: { id: true, name: true, slug: true } },
            },
          })
        : Promise.resolve(
            [] as Array<{
              id: string;
              name: string;
              slug: string;
              status: SiteStatus;
              publicSubdomain: string | null;
              tenant: { id: string; name: string; slug: string };
            }>,
          ),
      canReadDomains
        ? this.prisma.domain.findMany({
            where: { host: { contains: q, mode: "insensitive" } },
            orderBy: [{ updatedAt: "desc" }],
            take: limit,
            select: {
              id: true,
              host: true,
              status: true,
              isPrimary: true,
              site: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  tenant: { select: { id: true, name: true, slug: true } },
                },
              },
            },
          })
        : Promise.resolve(
            [] as Array<{
              id: string;
              host: string;
              status: DomainStatus;
              isPrimary: boolean;
              site: {
                id: string;
                name: string;
                slug: string;
                tenant: { id: string; name: string; slug: string };
              };
            }>,
          ),
      canReadUsers
        ? this.prisma.user.findMany({
            where: {
              email: { contains: q, mode: "insensitive" },
            },
            orderBy: [{ updatedAt: "desc" }],
            take: limit,
            select: {
              id: true,
              email: true,
              platformRole: true,
            },
          })
        : Promise.resolve(
            [] as Array<{
              id: string;
              email: string;
              platformRole: PlatformRole | null;
            }>,
          ),
    ]);

    return {
      query: q,
      tenants: tenants.map((t) => ({
        id: t.id,
        slug: t.slug,
        name: t.name,
        status: t.status,
        siteCount: t._count.sites,
      })),
      sites: sites.map((s) => ({
        id: s.id,
        name: s.name,
        slug: s.slug,
        status: s.status,
        publicSubdomain: s.publicSubdomain,
        tenant: s.tenant,
      })),
      domains: domains.map((d) => ({
        id: d.id,
        host: d.host,
        status: d.status,
        isPrimary: d.isPrimary,
        site: d.site,
      })),
      users: users.map((u) => ({
        id: u.id,
        email: u.email,
        platformRole: u.platformRole,
      })),
      generatedAt: new Date().toISOString(),
    };
  }

  // ─── Helpers ────────────────────────────────────────────────────────

  private buildTenantSearchWhere(q: string): Prisma.TenantWhereInput {
    if (this.looksLikeId(q)) {
      return {
        OR: [
          { id: q },
          { slug: { contains: q, mode: "insensitive" } },
          { name: { contains: q, mode: "insensitive" } },
        ],
      };
    }
    return {
      OR: [
        { slug: { contains: q, mode: "insensitive" } },
        { name: { contains: q, mode: "insensitive" } },
      ],
    };
  }

  private buildSiteSearchWhere(q: string): Prisma.SiteWhereInput {
    if (this.looksLikeId(q)) {
      return {
        OR: [
          { id: q },
          { slug: { contains: q, mode: "insensitive" } },
          { name: { contains: q, mode: "insensitive" } },
          { publicSubdomain: { contains: q, mode: "insensitive" } },
        ],
      };
    }
    return {
      OR: [
        { slug: { contains: q, mode: "insensitive" } },
        { name: { contains: q, mode: "insensitive" } },
        { publicSubdomain: { contains: q, mode: "insensitive" } },
      ],
    };
  }

  private looksLikeId(q: string): boolean {
    // cuid-like ids start with `c` and are 25 chars. We don't enforce strict
    // length so partial pastes still match by `contains`.
    return /^c[a-z0-9]{8,}$/i.test(q);
  }

  private async resolveActorEmails(
    actorIds: ReadonlyArray<string | null | undefined>,
  ): Promise<Map<string, string>> {
    const cleaned = Array.from(
      new Set(actorIds.filter((id): id is string => !!id)),
    );
    if (cleaned.length === 0) return new Map();
    const users = await this.prisma.user.findMany({
      where: { id: { in: cleaned } },
      select: { id: true, email: true },
    });
    return new Map(users.map((u) => [u.id, u.email]));
  }

  private daysAgo(n: number): Date {
    return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
  }

  private resolveAuditScope(
    requested: OperatorAuditScope | undefined,
    held: ReadonlyArray<string>,
  ): OperatorAuditScope | null {
    const canAll = hasAllPermissions(held, [
      OPERATOR_PERMISSIONS.AUDIT_READ_ALL,
    ]);
    const canSupport = hasAllPermissions(held, [
      OPERATOR_PERMISSIONS.AUDIT_READ_SUPPORT,
    ]);
    const canBilling = hasAllPermissions(held, [
      OPERATOR_PERMISSIONS.AUDIT_READ_BILLING,
    ]);

    if (requested) {
      if (requested === "all" && canAll) return "all";
      if (requested === "support" && (canAll || canSupport)) return "support";
      if (requested === "billing" && (canAll || canBilling)) return "billing";
      return null;
    }
    if (canAll) return "all";
    if (canSupport) return "support";
    if (canBilling) return "billing";
    return null;
  }

  private buildOperatorAuditWhere(params: {
    scope: OperatorAuditScope;
    action?: string;
    tenantId?: string;
    siteId?: string;
    actorUserId?: string;
  }): Prisma.OperatorAuditLogWhereInput {
    const where: Prisma.OperatorAuditLogWhereInput = {};
    if (params.scope === "support") {
      where.NOT = { action: { startsWith: "billing." } };
    } else if (params.scope === "billing") {
      where.OR = [
        { action: { startsWith: "billing." } },
        { targetType: "billing_account" },
        { targetType: "subscription" },
        { targetType: "invoice" },
      ];
    }
    if (params.action) {
      where.action = { startsWith: params.action };
    }
    if (params.tenantId) where.tenantId = params.tenantId;
    if (params.siteId) where.siteId = params.siteId;
    if (params.actorUserId) where.actorUserId = params.actorUserId;
    return where;
  }

  private buildLegacyAuditWhere(params: {
    scope: OperatorAuditScope;
    action?: string;
    tenantId?: string;
    siteId?: string;
    actorUserId?: string;
  }): Prisma.AuditLogWhereInput {
    const where: Prisma.AuditLogWhereInput = {};
    if (params.scope === "support") {
      where.NOT = { action: { startsWith: "billing." } };
    } else if (params.scope === "billing") {
      where.action = { startsWith: "billing." };
    }
    if (params.action) {
      // If a specific action filter is supplied, replace the scope prefix
      // with the requested prefix (the controller already validated the
      // operator may read this scope).
      where.action = { startsWith: params.action };
    }
    if (params.tenantId) where.tenantId = params.tenantId;
    if (params.siteId) where.siteId = params.siteId;
    if (params.actorUserId) where.actorUserId = params.actorUserId;
    return where;
  }

  private toJsonObject(
    value: Prisma.JsonValue | null,
  ): Record<string, unknown> | null {
    if (!value || typeof value !== "object" || Array.isArray(value))
      return null;
    // Phase 12 — never surface raw audit metadata to the operator console;
    // PII / secrets are key-masked before leaving the service boundary.
    return redactAuditMetadata(value) as Record<string, unknown>;
  }

  private mergeAuditFeeds(
    legacy: Array<{
      id: string;
      action: string;
      actorUserId: string | null;
      targetType: string | null;
      targetId: string | null;
      siteId: string | null;
      metadata: Prisma.JsonValue | null;
      createdAt: Date;
    }>,
    operator: Array<{
      id: string;
      requestId: string;
      action: string;
      actorUserId: string;
      platformRole: string;
      targetType: string | null;
      targetId: string | null;
      siteId: string | null;
      statusCode: number;
      sensitive: boolean;
      reason: string | null;
      createdAt: Date;
    }>,
    actorEmailById: ReadonlyMap<string, string>,
    take: number,
  ): AuditFeedEntry[] {
    const merged: AuditFeedEntry[] = [
      ...legacy.map((row) => ({
        kind: "legacy" as const,
        id: row.id,
        requestId: null,
        action: row.action,
        actorId: row.actorUserId,
        actorEmail: row.actorUserId
          ? (actorEmailById.get(row.actorUserId) ?? "Unknown user")
          : "System",
        actorRole: null,
        targetType: row.targetType,
        targetId: row.targetId,
        tenantId: null,
        siteId: row.siteId,
        method: null,
        path: null,
        statusCode: null,
        durationMs: null,
        sensitive: false as const,
        reason: null,
        metadata: this.toJsonObject(row.metadata),
        createdAt: row.createdAt.toISOString(),
      })),
      ...operator.map((row) => ({
        kind: "operator" as const,
        id: row.id,
        requestId: row.requestId,
        action: row.action,
        actorId: row.actorUserId,
        actorEmail: actorEmailById.get(row.actorUserId) ?? "Unknown operator",
        actorRole: row.platformRole,
        targetType: row.targetType,
        targetId: row.targetId,
        tenantId: null,
        siteId: row.siteId,
        method: null,
        path: null,
        statusCode: row.statusCode,
        durationMs: null,
        sensitive: row.sensitive,
        reason: row.reason,
        createdAt: row.createdAt.toISOString(),
      })),
    ];
    merged.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return merged.slice(0, take);
  }
}

// ─── Response types ──────────────────────────────────────────────────────

export interface TenantSearchResult {
  id: string;
  slug: string;
  name: string;
  status: TenantStatus;
  siteCount: number;
}

export interface TenantDetailResponse {
  tenant: {
    id: string;
    slug: string;
    name: string;
    status: TenantStatus;
    createdAt: string;
    updatedAt: string;
    memberCount: number;
    siteCount: number;
    openAlerts: number;
  };
  members: Array<{
    id: string;
    role: string;
    isDefault: boolean;
    joinedAt: string;
    user: { id: string; email: string; name: string | null };
  }>;
  sites: Array<{
    id: string;
    name: string;
    slug: string;
    status: SiteStatus;
    publicSubdomain: string | null;
    primaryLocale: string;
    createdAt: string;
    updatedAt: string;
    domainCount: number;
    pageCount: number;
    primaryDomain: string | null;
    latestDeployment: {
      id: string;
      status: DeploymentStatus;
      url: string | null;
      createdAt: string;
      updatedAt: string;
    } | null;
    openAlerts: number;
  }>;
  subscriptions: Array<{
    id: string;
    provider: string;
    planKey: string;
    status: SubscriptionStatus;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    pendingPlanKey: string | null;
    pendingPlanEffectiveAt: string | null;
    gracePeriodEndsAt: string | null;
    updatedAt: string;
  }>;
  audit: AuditFeedEntry[];
  generatedAt: string;
}

export interface SiteDetailResponse {
  site: {
    id: string;
    name: string;
    slug: string;
    status: SiteStatus;
    publicSubdomain: string | null;
    primaryLocale: string;
    enabledLocales: string[];
    siteType: string;
    templateKey: string | null;
    publishedRevision: number;
    createdAt: string;
    updatedAt: string;
    archivedAt: string | null;
    counts: {
      pages: number;
      domains: number;
      formDefinitions: number;
      formSubmissions: number;
      redirects: number;
    };
    recentSubmissions30d: number;
    recentDeliveryFailures30d: number;
  };
  tenant: {
    id: string;
    slug: string;
    name: string;
    status: TenantStatus;
  };
  domains: Array<{
    id: string;
    host: string;
    status: DomainStatus;
    isPrimary: boolean;
    verifiedAt: string | null;
    lastCheckedAt: string | null;
    lastError: string | null;
  }>;
  deployments: Array<{
    id: string;
    status: DeploymentStatus;
    provider: string | null;
    url: string | null;
    errorMessage: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
  alerts: Array<{
    id: string;
    type: string;
    severity: string;
    status: string;
    message: string;
    firstTriggeredAt: string;
    lastTriggeredAt: string;
  }>;
  audit: AuditFeedEntry[];
  generatedAt: string;
}

export type AuditFeedEntry =
  | {
      kind: "operator";
      id: string;
      requestId: string | null;
      action: string;
      actorId: string | null;
      actorEmail: string;
      actorRole: string | null;
      targetType: string | null;
      targetId: string | null;
      tenantId: string | null;
      siteId: string | null;
      method: string | null;
      path: string | null;
      statusCode: number | null;
      durationMs: number | null;
      sensitive: boolean;
      reason: string | null;
      createdAt: string;
    }
  | {
      kind: "legacy";
      id: string;
      requestId: null;
      action: string;
      actorId: string | null;
      actorEmail: string;
      actorRole: null;
      targetType: string | null;
      targetId: string | null;
      tenantId: string | null;
      siteId: string | null;
      method: null;
      path: null;
      statusCode: null;
      durationMs: null;
      sensitive: false;
      reason: null;
      metadata: Record<string, unknown> | null;
      createdAt: string;
    };

export interface AuditFeedResponse {
  data: AuditFeedEntry[];
  total: number;
  page: number;
  limit: number;
  scope: OperatorAuditScope;
  generatedAt: string;
}

export interface GlobalSearchResponse {
  query: string;
  tenants: Array<{
    id: string;
    slug: string;
    name: string;
    status: TenantStatus;
    siteCount: number;
  }>;
  sites: Array<{
    id: string;
    name: string;
    slug: string;
    status: SiteStatus;
    publicSubdomain: string | null;
    tenant: { id: string; name: string; slug: string };
  }>;
  domains: Array<{
    id: string;
    host: string;
    status: DomainStatus;
    isPrimary: boolean;
    site: {
      id: string;
      name: string;
      slug: string;
      tenant: { id: string; name: string; slug: string };
    };
  }>;
  users: Array<{
    id: string;
    email: string;
    platformRole: PlatformRole | null;
  }>;
  generatedAt: string;
}
