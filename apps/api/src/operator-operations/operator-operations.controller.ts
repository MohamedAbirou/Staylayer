import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import type { Request } from "express";
import {
  DeploymentStatus,
  DomainStatus,
  FormDeliveryStatus,
  FormSubmissionStatus,
  NotificationCategory,
  OperationalAlertSeverity,
  OperationalAlertStatus,
  OperationalAlertType,
  TranslationJobStatus,
} from "@prisma/client";
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from "class-validator";
import { Transform, Type } from "class-transformer";
import { OperatorJwtAuthGuard } from "../auth/operator/guards/operator-jwt-auth.guard";
import { OperatorPermissionGuard } from "../auth/operator/permissions/operator-permission.guard";
import { RequireOperatorPermissions } from "../auth/operator/permissions/require-operator-permissions.decorator";
import { OperatorAuditInterceptor } from "../auth/operator/audit/operator-audit.interceptor";
import { OperatorAudit } from "../auth/operator/audit/operator-audit.decorator";
import { OPERATOR_PERMISSIONS } from "../auth/operator/permissions/operator-permissions.registry";
import {
  OPERATOR_JWT_AUDIENCE,
  type OperatorAuthenticatedRequestUser,
} from "../auth/operator/operator-auth.types";
import { OperatorOperationsService } from "./operator-operations.service";

/**
 * Phase 9 — operator operations HTTP surface.
 *
 * All endpoints are mounted under `/operator/operations/*` with isolated
 * operator auth (Phase 2). Every mutation declares `@OperatorAudit` so the
 * `OperatorAuditInterceptor` writes a row to `operator_audit_logs` once the
 * call succeeds; sensitive mutations additionally require a non-empty
 * `reason` in the request body (interceptor returns 400 otherwise).
 *
 * Read endpoints follow the operator list contract documented in
 * `operator-console-docs/05-customer-data-operations-and-audit.md`:
 *   `{ data, total, page, limit, filters, generatedAt }`.
 */

// ─── Shared query / body DTOs ────────────────────────────────────────

class PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

class ReasonDto {
  @IsString()
  @Length(8, 500, {
    message: "Reason must be between 8 and 500 characters",
  })
  reason!: string;
}

class ListDeploymentsQueryDto extends PaginationDto {
  @IsOptional()
  @IsEnum(DeploymentStatus)
  status?: DeploymentStatus;

  @IsOptional()
  @IsString()
  siteId?: string;

  @IsOptional()
  @IsString()
  tenantId?: string;

  @IsOptional()
  @IsString()
  q?: string;
}

class ListDomainsQueryDto extends PaginationDto {
  @IsOptional()
  @IsEnum(DomainStatus)
  status?: DomainStatus;

  @IsOptional()
  @IsString()
  siteId?: string;

  @IsOptional()
  @IsString()
  tenantId?: string;

  @IsOptional()
  @IsString()
  q?: string;
}

class ListSubmissionsQueryDto extends PaginationDto {
  @IsOptional()
  @IsEnum(FormSubmissionStatus)
  status?: FormSubmissionStatus;

  @IsOptional()
  @IsString()
  siteId?: string;

  @IsOptional()
  @IsString()
  tenantId?: string;
}

class ListDeliveriesQueryDto extends PaginationDto {
  @IsOptional()
  @IsEnum(FormDeliveryStatus)
  status?: FormDeliveryStatus;

  @IsOptional()
  @IsString()
  siteId?: string;

  @IsOptional()
  @IsString()
  tenantId?: string;
}

class ListAlertsQueryDto extends PaginationDto {
  @IsOptional()
  @IsEnum(OperationalAlertStatus)
  status?: OperationalAlertStatus;

  @IsOptional()
  @IsEnum(OperationalAlertSeverity)
  severity?: OperationalAlertSeverity;

  @IsOptional()
  @IsEnum(OperationalAlertType)
  type?: OperationalAlertType;

  @IsOptional()
  @IsString()
  siteId?: string;

  @IsOptional()
  @IsString()
  tenantId?: string;
}

class ListTranslationJobsQueryDto extends PaginationDto {
  @IsOptional()
  @IsEnum(TranslationJobStatus)
  status?: TranslationJobStatus;

  @IsOptional()
  @IsString()
  tenantId?: string;

  @IsOptional()
  @IsString()
  siteId?: string;
}

class ListGlossariesQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  tenantId?: string;

  @IsOptional()
  @IsString()
  siteId?: string;
}

class ListNotificationsQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  tenantId?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsEnum(NotificationCategory)
  category?: NotificationCategory;

  @IsOptional()
  @Transform(({ value }) => value === "true" || value === true)
  @IsBoolean()
  unreadOnly?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────

function requireActor(req: Request): OperatorAuthenticatedRequestUser {
  const user = req.user as OperatorAuthenticatedRequestUser | undefined;
  if (!user || user.aud !== OPERATOR_JWT_AUDIENCE) {
    throw new UnauthorizedException({
      code: "OPERATOR_AUTH_REQUIRED",
      message: "Operator authentication required",
    });
  }
  return user;
}

// ─── Controllers ─────────────────────────────────────────────────────

@Controller("operator/operations")
@UseGuards(OperatorJwtAuthGuard)
@UseInterceptors(OperatorAuditInterceptor)
export class OperatorOperationsController {
  constructor(private readonly service: OperatorOperationsService) {}

  // ── Deployments ───────────────────────────────────────────────────

  @Get("deployments")
  @UseGuards(OperatorPermissionGuard)
  @RequireOperatorPermissions(OPERATOR_PERMISSIONS.DEPLOYMENT_READ_ALL)
  async listDeployments(@Query() query: ListDeploymentsQueryDto) {
    return this.service.listDeployments({
      status: query.status ?? null,
      siteId: query.siteId ?? null,
      tenantId: query.tenantId ?? null,
      q: query.q ?? null,
      page: query.page,
      limit: query.limit,
    });
  }

  @Get("deployments/:id")
  @UseGuards(OperatorPermissionGuard)
  @RequireOperatorPermissions(OPERATOR_PERMISSIONS.DEPLOYMENT_READ_ALL)
  async getDeployment(@Param("id") id: string) {
    return this.service.getDeployment(id);
  }

  @Post("deployments/:id/retry")
  @HttpCode(200)
  @UseGuards(OperatorPermissionGuard)
  @RequireOperatorPermissions(OPERATOR_PERMISSIONS.DEPLOYMENT_RETRY_ALL)
  @OperatorAudit({
    action: "deployment.retry",
    targetType: "deployment",
    targetIdParam: "id",
    sensitive: true,
  })
  async retryDeployment(@Param("id") id: string, @Body() _body: ReasonDto) {
    return this.service.retryDeployment(id);
  }

  // ── Domains ───────────────────────────────────────────────────────

  @Get("domains")
  @UseGuards(OperatorPermissionGuard)
  @RequireOperatorPermissions(OPERATOR_PERMISSIONS.DOMAIN_READ_ALL)
  async listDomains(@Query() query: ListDomainsQueryDto) {
    return this.service.listDomains({
      status: query.status ?? null,
      siteId: query.siteId ?? null,
      tenantId: query.tenantId ?? null,
      q: query.q ?? null,
      page: query.page,
      limit: query.limit,
    });
  }

  @Post("domains/:id/retry-verification")
  @HttpCode(200)
  @UseGuards(OperatorPermissionGuard)
  @RequireOperatorPermissions(
    OPERATOR_PERMISSIONS.DOMAIN_RETRY_VERIFICATION_ALL,
  )
  @OperatorAudit({
    action: "domain.retry_verification",
    targetType: "domain",
    targetIdParam: "id",
    sensitive: true,
  })
  async retryDomainVerification(
    @Param("id") id: string,
    @Body() _body: ReasonDto,
  ) {
    return this.service.retryDomainVerification(id);
  }

  // ── Form submissions / deliveries ─────────────────────────────────

  @Get("forms/submissions")
  @UseGuards(OperatorPermissionGuard)
  @RequireOperatorPermissions(OPERATOR_PERMISSIONS.FORM_SUBMISSION_READ_ALL)
  async listFormSubmissions(@Query() query: ListSubmissionsQueryDto) {
    return this.service.listFormSubmissions({
      status: query.status ?? null,
      siteId: query.siteId ?? null,
      tenantId: query.tenantId ?? null,
      page: query.page,
      limit: query.limit,
    });
  }

  @Get("forms/deliveries")
  @UseGuards(OperatorPermissionGuard)
  @RequireOperatorPermissions(OPERATOR_PERMISSIONS.FORM_DELIVERY_READ_ALL)
  async listFormDeliveries(@Query() query: ListDeliveriesQueryDto) {
    return this.service.listFormDeliveries({
      status: query.status ?? null,
      siteId: query.siteId ?? null,
      tenantId: query.tenantId ?? null,
      page: query.page,
      limit: query.limit,
    });
  }

  @Post("forms/deliveries/:id/replay")
  @HttpCode(200)
  @UseGuards(OperatorPermissionGuard)
  @RequireOperatorPermissions(OPERATOR_PERMISSIONS.FORM_DELIVERY_REPLAY_ALL)
  @OperatorAudit({
    action: "form_delivery.replay",
    targetType: "form_delivery",
    targetIdParam: "id",
    sensitive: true,
  })
  async replayFormDelivery(@Param("id") id: string, @Body() _body: ReasonDto) {
    return this.service.replayFormDelivery(id);
  }

  // ── Operational alerts ────────────────────────────────────────────

  @Get("alerts")
  @UseGuards(OperatorPermissionGuard)
  @RequireOperatorPermissions(OPERATOR_PERMISSIONS.OPERATIONAL_ALERT_READ_ALL)
  async listAlerts(@Query() query: ListAlertsQueryDto) {
    return this.service.listAlerts({
      status: query.status ?? null,
      severity: query.severity ?? null,
      type: query.type ?? null,
      siteId: query.siteId ?? null,
      tenantId: query.tenantId ?? null,
      page: query.page,
      limit: query.limit,
    });
  }

  @Post("alerts/:id/resolve")
  @HttpCode(200)
  @UseGuards(OperatorPermissionGuard)
  @RequireOperatorPermissions(
    OPERATOR_PERMISSIONS.OPERATIONAL_ALERT_RESOLVE_ALL,
  )
  @OperatorAudit({
    action: "operational_alert.resolve",
    targetType: "operational_alert",
    targetIdParam: "id",
    sensitive: true,
  })
  async resolveAlert(@Param("id") id: string, @Body() _body: ReasonDto) {
    return this.service.resolveAlert(id);
  }

  // ── SEO operations ────────────────────────────────────────────────

  @Get("seo/sites/:siteId")
  @UseGuards(OperatorPermissionGuard)
  @RequireOperatorPermissions(OPERATOR_PERMISSIONS.SEO_READ_ALL)
  async getSeoSiteSummary(@Param("siteId") siteId: string) {
    return this.service.getSeoSiteSummary(siteId);
  }

  @Post("seo/sites/:siteId/sitemap-submissions/:logId/retry")
  @HttpCode(200)
  @UseGuards(OperatorPermissionGuard)
  @RequireOperatorPermissions(OPERATOR_PERMISSIONS.SEO_RESUBMIT_ALL)
  @OperatorAudit({
    action: "seo.sitemap.retry_submission",
    targetType: "sitemap_submission_log",
    targetIdParam: "logId",
    sensitive: true,
  })
  async retrySitemapSubmission(
    @Param("siteId") siteId: string,
    @Param("logId") logId: string,
    @Body() _body: ReasonDto,
    @Req() req: Request,
  ) {
    const actor = requireActor(req);
    return this.service.retrySitemapSubmission(siteId, logId, actor.id);
  }

  // ── Translations ──────────────────────────────────────────────────

  @Get("translations/jobs")
  @UseGuards(OperatorPermissionGuard)
  @RequireOperatorPermissions(OPERATOR_PERMISSIONS.TRANSLATION_JOB_READ_ALL)
  async listTranslationJobs(@Query() query: ListTranslationJobsQueryDto) {
    return this.service.listTranslationJobs({
      status: query.status ?? null,
      tenantId: query.tenantId ?? null,
      siteId: query.siteId ?? null,
      page: query.page,
      limit: query.limit,
    });
  }

  @Post("translations/jobs/:id/retry")
  @HttpCode(200)
  @UseGuards(OperatorPermissionGuard)
  @RequireOperatorPermissions(OPERATOR_PERMISSIONS.TRANSLATION_JOB_RETRY_ALL)
  @OperatorAudit({
    action: "translation.job.retry",
    targetType: "translation_job",
    targetIdParam: "id",
    sensitive: true,
  })
  async retryTranslationJob(@Param("id") id: string, @Body() _body: ReasonDto) {
    return this.service.retryTranslationJob(id);
  }

  @Get("translations/glossaries")
  @UseGuards(OperatorPermissionGuard)
  @RequireOperatorPermissions(
    OPERATOR_PERMISSIONS.TRANSLATION_GLOSSARY_READ_ALL,
  )
  async listGlossaries(@Query() query: ListGlossariesQueryDto) {
    return this.service.listGlossaries({
      tenantId: query.tenantId ?? null,
      siteId: query.siteId ?? null,
      page: query.page,
      limit: query.limit,
    });
  }

  @Get("translations/sites/:siteId/completeness")
  @UseGuards(OperatorPermissionGuard)
  @RequireOperatorPermissions(OPERATOR_PERMISSIONS.TRANSLATION_JOB_READ_ALL)
  async getLocaleCompleteness(@Param("siteId") siteId: string) {
    return this.service.getLocaleCompleteness(siteId);
  }

  // ── Notifications ─────────────────────────────────────────────────

  @Get("notifications")
  @UseGuards(OperatorPermissionGuard)
  @RequireOperatorPermissions(OPERATOR_PERMISSIONS.NOTIFICATION_READ_ALL)
  async listNotifications(@Query() query: ListNotificationsQueryDto) {
    return this.service.listNotifications({
      tenantId: query.tenantId ?? null,
      userId: query.userId ?? null,
      category: query.category ?? null,
      unreadOnly: !!query.unreadOnly,
      page: query.page,
      limit: query.limit,
    });
  }
}
