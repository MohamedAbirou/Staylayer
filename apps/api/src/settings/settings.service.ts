import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  DeploymentStatus,
  DomainStatus,
  FormEmailTemplateType,
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { UpdateSettingsDto } from "./dto/update-settings.dto";
import { BillingService } from "../billing/billing.service";

type ReadinessSeverity = "ready" | "warning" | "blocking";

type ReadinessCheck = {
  key: string;
  label: string;
  severity: ReadinessSeverity;
  summary: string;
  action: string | null;
};

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly billingService: BillingService,
    private readonly configService: ConfigService,
  ) {}

  async get(siteId: string) {
    const site = await this.prisma.site.findUnique({
      where: { id: siteId },
      select: {
        id: true,
        name: true,
        primaryLocale: true,
        enabledLocales: true,
      },
    });

    if (!site) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Site not found",
      });
    }

    const settings = await this.prisma.siteSettings.upsert({
      where: { siteId },
      create: {
        siteId,
        siteName: site.name,
        defaultLocale: site.primaryLocale,
        activeLocales: site.enabledLocales,
      },
      update: {},
    });

    return this.toDto(settings);
  }

  async getPublic(siteId: string) {
    const settings = await this.get(siteId);

    return {
      siteName: settings.siteName,
      supportEmail: settings.supportEmail,
      seoTitleTemplate: settings.seoTitleTemplate,
      seoDefaultDesc: settings.seoDefaultDesc,
      seoOgImage: settings.seoOgImage,
      seoIndexingEnabled: settings.seoIndexingEnabled,
      googleSiteVerify: settings.googleSiteVerify,
      gaTrackingId: settings.gaTrackingId,
      gtmContainerId: settings.gtmContainerId,
      clarityId: settings.clarityId,
      twitterHandle: settings.twitterHandle,
      linkedinUrl: settings.linkedinUrl,
      facebookUrl: settings.facebookUrl,
    };
  }

  async update(siteId: string, dto: UpdateSettingsDto, updatedBy?: string) {
    const site = await this.prisma.site.findUnique({
      where: { id: siteId },
      select: {
        id: true,
        primaryLocale: true,
        enabledLocales: true,
      },
    });

    if (!site) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Site not found",
      });
    }

    const nextActiveLocales = dto.activeLocales
      ? Array.from(new Set(dto.activeLocales))
      : site.enabledLocales;
    const nextDefaultLocale = dto.defaultLocale ?? site.primaryLocale;

    if (!nextActiveLocales.includes(nextDefaultLocale)) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message:
          "The default locale must be included in the active locale list",
      });
    }

    if (dto.activeLocales) {
      await this.billingService.assertCanUpdateSiteLocales(
        siteId,
        nextActiveLocales,
      );
    }

    return this.prisma
      .$transaction(async (tx) => {
        if (dto.activeLocales || dto.defaultLocale) {
          await tx.site.update({
            where: { id: siteId },
            data: {
              enabledLocales: dto.activeLocales ? nextActiveLocales : undefined,
              primaryLocale: dto.defaultLocale ?? undefined,
            },
          });
        }

        return tx.siteSettings.upsert({
          where: { siteId },
          create: {
            siteId,
            ...dto,
            activeLocales: dto.activeLocales ? nextActiveLocales : undefined,
            defaultLocale: dto.defaultLocale ?? undefined,
            updatedBy,
          },
          update: {
            ...dto,
            activeLocales: dto.activeLocales ? nextActiveLocales : undefined,
            defaultLocale: dto.defaultLocale ?? undefined,
            updatedBy,
          },
        });
      })
      .then((settings) => this.toDto(settings));
  }

  async getReadiness(siteId: string) {
    const site = await this.prisma.site.findUnique({
      where: { id: siteId },
      select: {
        id: true,
        slug: true,
        primaryLocale: true,
        enabledLocales: true,
        settings: true,
        pages: {
          where: {
            deletedAt: null,
          },
          select: {
            slug: true,
            locale: true,
            published: true,
            seoTitle: true,
            seoDescription: true,
          },
        },
        deployments: {
          orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
          take: 5,
          select: {
            id: true,
            status: true,
            url: true,
            errorMessage: true,
            updatedAt: true,
          },
        },
        domains: {
          orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
          select: {
            id: true,
            host: true,
            status: true,
            isPrimary: true,
            lastError: true,
            verificationDetails: true,
          },
        },
        formDefinitions: {
          select: {
            id: true,
            activeSchemaVersionId: true,
          },
        },
        formRoutingRules: {
          select: {
            id: true,
            isActive: true,
            emailRecipients: true,
            webhookUrl: true,
            webhookSecret: true,
          },
        },
        formEmailTheme: {
          select: {
            id: true,
          },
        },
        formEmailTemplates: {
          select: {
            id: true,
            templateType: true,
            enabled: true,
          },
        },
      },
    });

    if (!site) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Site not found",
      });
    }

    const checks: ReadinessCheck[] = [];
    const latestDeployment = site.deployments[0] ?? null;
    const primaryDomain =
      site.domains.find((domain) => domain.isPrimary) ?? null;
    const publishedPages = site.pages.filter((page) => page.published);
    const settings = site.settings;
    const hasPublishedPages = publishedPages.length > 0;
    const hasSeoDefaults = Boolean(
      settings?.seoTitleTemplate.trim() && settings?.seoDefaultDesc.trim(),
    );
    const pagesMissingSeo = publishedPages.filter(
      (page) => !page.seoTitle?.trim() || !page.seoDescription?.trim(),
    );
    const activeRoutingRules = site.formRoutingRules.filter(
      (rule) => rule.isActive,
    );
    const hasEmailRoute = activeRoutingRules.some(
      (rule) => rule.emailRecipients.length > 0,
    );
    const hasWebhookRoute = activeRoutingRules.some((rule) =>
      Boolean(rule.webhookUrl.trim()),
    );
    const smtpConfigured = this.isSmtpConfigured();
    const webhookSecretConfigured = activeRoutingRules
      .filter((rule) => Boolean(rule.webhookUrl.trim()))
      .every((rule) => Boolean(rule.webhookSecret.trim()));
    const hasPublishedForms = site.formDefinitions.some((definition) =>
      Boolean(definition.activeSchemaVersionId),
    );
    const internalTemplateConfigured = site.formEmailTemplates.some(
      (template) =>
        template.templateType === FormEmailTemplateType.INTERNAL_NOTIFICATION &&
        template.enabled,
    );
    const guestTemplateConfigured = site.formEmailTemplates.some(
      (template) =>
        template.templateType === FormEmailTemplateType.GUEST_CONFIRMATION &&
        template.enabled,
    );

    checks.push(
      this.makeCheck(
        "deployment_config",
        "Deployment configuration",
        this.isDeploymentConfigReady() ? "ready" : "blocking",
        this.isDeploymentConfigReady()
          ? "Required deployment environment values are configured."
          : "Deployment provider configuration is incomplete for this environment.",
        this.isDeploymentConfigReady()
          ? null
          : "Set the deployment provider env contract before go-live.",
      ),
    );

    checks.push(
      this.makeCheck(
        "current_deployment",
        "Current deployment",
        this.getDeploymentSeverity(latestDeployment?.status ?? null),
        this.describeDeployment(latestDeployment),
        this.getDeploymentAction(latestDeployment),
      ),
    );

    checks.push(
      this.makeCheck(
        "primary_domain",
        "Primary domain",
        primaryDomain
          ? primaryDomain.status === DomainStatus.ACTIVE
            ? "ready"
            : primaryDomain.status === DomainStatus.FAILED
              ? "blocking"
              : "warning"
          : "warning",
        primaryDomain
          ? `Primary domain ${primaryDomain.host} is ${this.describeDomainStatus(primaryDomain.status)}.`
          : "No primary custom domain is configured yet.",
        primaryDomain
          ? this.getDomainAction(primaryDomain.status)
          : "Add a primary custom domain or confirm the default deployment URL is intentional.",
      ),
    );

    checks.push(
      this.makeCheck(
        "seo_defaults",
        "SEO defaults",
        hasSeoDefaults ? "ready" : "warning",
        hasSeoDefaults
          ? "Site-level SEO defaults are configured."
          : "Site-level SEO defaults are incomplete.",
        hasSeoDefaults
          ? null
          : "Set a title template and default description before launch.",
      ),
    );

    checks.push(
      this.makeCheck(
        "published_pages",
        "Published pages",
        hasPublishedPages ? "ready" : "blocking",
        hasPublishedPages
          ? `${publishedPages.length} published page${publishedPages.length === 1 ? " is" : "s are"} available for the sitemap.`
          : "No published pages are available for public visitors.",
        hasPublishedPages ? null : "Publish at least one page before go-live.",
      ),
    );

    checks.push(
      this.makeCheck(
        "page_seo",
        "Page-level SEO",
        pagesMissingSeo.length === 0 ? "ready" : "warning",
        pagesMissingSeo.length === 0
          ? "Published pages include page-level SEO titles and descriptions."
          : `${pagesMissingSeo.length} published page${pagesMissingSeo.length === 1 ? " is" : "s are"} missing page-level SEO fields.`,
        pagesMissingSeo.length === 0
          ? null
          : "Review page SEO titles and descriptions before launch.",
      ),
    );

    checks.push(
      this.makeCheck(
        "published_forms",
        "Published forms",
        hasPublishedForms ? "ready" : "warning",
        hasPublishedForms
          ? `${site.formDefinitions.filter((definition) => definition.activeSchemaVersionId).length} published form definition${site.formDefinitions.filter((definition) => definition.activeSchemaVersionId).length === 1 ? " is" : "s are"} ready for public runtime use.`
          : "No published form definitions exist yet.",
        hasPublishedForms
          ? null
          : "Publish at least one form definition before assigning contact sections to live pages.",
      ),
    );

    checks.push(
      this.makeCheck(
        "form_routing",
        "Inquiry routing",
        hasEmailRoute || hasWebhookRoute ? "ready" : "blocking",
        hasEmailRoute || hasWebhookRoute
          ? `${this.describeRouting(hasEmailRoute, hasWebhookRoute)} ${activeRoutingRules.length} active routing rule${activeRoutingRules.length === 1 ? " is" : "s are"} configured.`
          : "No email recipient or webhook destination is configured for inquiry delivery.",
        hasEmailRoute || hasWebhookRoute
          ? null
          : "Configure at least one inquiry destination before accepting submissions.",
      ),
    );

    checks.push(
      this.makeCheck(
        "email_delivery",
        "Email delivery infrastructure",
        !hasEmailRoute
          ? "ready"
          : smtpConfigured && internalTemplateConfigured && site.formEmailTheme
            ? "ready"
            : "blocking",
        !hasEmailRoute
          ? "Email delivery is not required because no email routing is configured."
          : smtpConfigured && internalTemplateConfigured && site.formEmailTheme
            ? guestTemplateConfigured
              ? "Email delivery infrastructure and branded email templates are configured, including guest confirmations."
              : "Email delivery infrastructure and branded internal notification templates are configured."
            : !smtpConfigured
              ? "Email routing is configured, but no supported delivery provider is configured."
              : !site.formEmailTheme
                ? "Email routing is configured, but the branded email theme has not been saved yet."
                : "Email routing is configured, but the branded internal notification template is missing or disabled.",
        !hasEmailRoute ||
          (smtpConfigured && internalTemplateConfigured && site.formEmailTheme)
          ? null
          : !smtpConfigured
            ? "Configure RESEND_API_KEY and TRANSACTIONAL_EMAIL_FROM, or configure SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and INQUIRY_EMAIL_FROM."
            : !site.formEmailTheme
              ? "Save the branded email theme in the email studio before go-live."
              : "Enable an internal notification email template in the email studio before go-live.",
      ),
    );

    checks.push(
      this.makeCheck(
        "webhook_delivery",
        "Webhook delivery",
        !hasWebhookRoute || webhookSecretConfigured ? "ready" : "warning",
        !hasWebhookRoute
          ? "Webhook forwarding is not configured."
          : webhookSecretConfigured
            ? "Webhook forwarding is configured with signing enabled."
            : "Webhook forwarding is configured, but at least one active route is missing a signing secret.",
        !hasWebhookRoute || webhookSecretConfigured
          ? null
          : "Add a webhook signing secret to every active webhook route before sending production traffic.",
      ),
    );

    const severity = this.getOverallSeverity(checks);

    return {
      siteId: site.id,
      siteSlug: site.slug,
      checkedAt: new Date().toISOString(),
      severity,
      isReady: severity === "ready",
      liveUrl: latestDeployment?.url ?? null,
      primaryDomain: primaryDomain
        ? {
            hostname: primaryDomain.host,
            status: primaryDomain.status,
          }
        : null,
      checks,
    };
  }

  private toDto(settings: {
    id: string;
    siteName: string;
    supportEmail: string;
    defaultInquiryRoutingEmail: string;
    inquiryWebhookUrl: string;
    inquiryWebhookSecret: string;
    logoUrl: string;
    faviconUrl: string;
    seoTitleTemplate: string;
    seoDefaultDesc: string;
    seoOgImage: string;
    seoIndexingEnabled: boolean;
    googleSiteVerify: string;
    gaTrackingId: string;
    gtmContainerId: string;
    clarityId: string;
    twitterHandle: string;
    linkedinUrl: string;
    facebookUrl: string;
    defaultLocale: string;
    activeLocales: string[];
    updatedAt: Date;
    updatedBy: string | null;
  }) {
    return {
      id: settings.id,
      siteName: settings.siteName,
      supportEmail: settings.supportEmail,
      defaultInquiryRoutingEmail: settings.defaultInquiryRoutingEmail,
      inquiryWebhookUrl: settings.inquiryWebhookUrl,
      inquiryWebhookSecretConfigured: Boolean(settings.inquiryWebhookSecret),
      logoUrl: settings.logoUrl,
      faviconUrl: settings.faviconUrl,
      seoTitleTemplate: settings.seoTitleTemplate,
      seoDefaultDesc: settings.seoDefaultDesc,
      seoOgImage: settings.seoOgImage,
      seoIndexingEnabled: settings.seoIndexingEnabled,
      googleSiteVerify: settings.googleSiteVerify,
      gaTrackingId: settings.gaTrackingId,
      gtmContainerId: settings.gtmContainerId,
      clarityId: settings.clarityId,
      twitterHandle: settings.twitterHandle,
      linkedinUrl: settings.linkedinUrl,
      facebookUrl: settings.facebookUrl,
      defaultLocale: settings.defaultLocale,
      activeLocales: settings.activeLocales,
      updatedAt: settings.updatedAt,
      updatedBy: settings.updatedBy,
    };
  }

  private makeCheck(
    key: string,
    label: string,
    severity: ReadinessSeverity,
    summary: string,
    action: string | null,
  ): ReadinessCheck {
    return { key, label, severity, summary, action };
  }

  private getDeploymentSeverity(
    status: DeploymentStatus | null,
  ): ReadinessSeverity {
    if (!status) {
      return "blocking";
    }

    if (status === DeploymentStatus.LIVE) {
      return "ready";
    }

    if (status === DeploymentStatus.FAILED) {
      return "blocking";
    }

    return "warning";
  }

  private describeDeployment(
    deployment: {
      status: DeploymentStatus;
      url: string | null;
      errorMessage: string | null;
    } | null,
  ): string {
    if (!deployment) {
      return "No deployment has been provisioned yet.";
    }

    if (deployment.status === DeploymentStatus.LIVE) {
      return deployment.url
        ? `The latest deployment is live at ${deployment.url}.`
        : "The latest deployment is live.";
    }

    if (deployment.status === DeploymentStatus.FAILED) {
      return deployment.errorMessage
        ? `The latest deployment failed: ${deployment.errorMessage}`
        : "The latest deployment failed.";
    }

    return `The latest deployment is ${deployment.status.toLowerCase().replace(/_/g, " ")}.`;
  }

  private getDeploymentAction(
    deployment: {
      status: DeploymentStatus;
    } | null,
  ): string | null {
    if (!deployment) {
      return "Provision the site from the customer deployment center.";
    }

    if (deployment.status === DeploymentStatus.FAILED) {
      return "Retry the failed deployment after correcting the reported issue.";
    }

    if (deployment.status !== DeploymentStatus.LIVE) {
      return "Wait for the active deployment to complete before go-live.";
    }

    return null;
  }

  private describeDomainStatus(status: DomainStatus): string {
    return status.toLowerCase().replace(/_/g, " ");
  }

  private getDomainAction(status: DomainStatus): string | null {
    if (status === DomainStatus.ACTIVE) {
      return null;
    }

    if (status === DomainStatus.DNS_REQUIRED) {
      return "Update your DNS records to match the deployment target, then retry verification.";
    }

    if (status === DomainStatus.PROVIDER_ATTACH_PENDING) {
      return "Retry provider attachment if it stalls after DNS is correct.";
    }

    if (status === DomainStatus.SSL_PROVISIONING) {
      return "Wait for SSL issuance to complete before directing production traffic.";
    }

    if (status === DomainStatus.FAILED) {
      return "Review the domain error details and retry verification.";
    }

    return "Finish domain setup and verify it again before launch.";
  }

  private describeRouting(hasEmailRoute: boolean, hasWebhookRoute: boolean) {
    if (hasEmailRoute && hasWebhookRoute) {
      return "Inquiry routing is configured for both email and webhook delivery.";
    }

    if (hasEmailRoute) {
      return "Inquiry routing is configured for email delivery.";
    }

    return "Inquiry routing is configured for webhook delivery.";
  }

  private getOverallSeverity(checks: ReadinessCheck[]): ReadinessSeverity {
    if (checks.some((check) => check.severity === "blocking")) {
      return "blocking";
    }

    if (checks.some((check) => check.severity === "warning")) {
      return "warning";
    }

    return "ready";
  }

  private isDeploymentConfigReady() {
    return [
      "DEPLOYMENTS_CMS_API_URL",
      "DEPLOYMENTS_REVALIDATE_SECRET",
      "DEPLOYMENTS_VERCEL_ACCESS_TOKEN",
      "DEPLOYMENTS_VERCEL_GIT_REPO",
      "DEPLOYMENTS_VERCEL_GIT_REPO_ID",
    ].every((key) => Boolean(this.configService.get<string>(key)?.trim()));
  }

  private isSmtpConfigured() {
    if (Boolean(this.configService.get<string>("RESEND_API_KEY")?.trim())) {
      return Boolean(
        this.configService.get<string>("TRANSACTIONAL_EMAIL_FROM")?.trim() ||
        this.configService.get<string>("INQUIRY_EMAIL_FROM")?.trim(),
      );
    }

    return ["SMTP_HOST", "SMTP_PORT", "INQUIRY_EMAIL_FROM"].every((key) =>
      Boolean(this.configService.get<string>(key)?.trim()),
    );
  }
}
