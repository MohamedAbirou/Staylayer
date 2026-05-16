import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import {
  FormFieldType,
  FormDeliveryStatus,
  FormSubmissionStatus,
  FormType,
  OperationalAlertType,
  Prisma,
} from "@prisma/client";
import { BillingService } from "../billing/billing.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreateSubmissionDto } from "./dto/create-submission.dto";
import {
  PreviewFormEmailDto,
  SendTestFormEmailDto,
} from "./dto/preview-form-email.dto";
import { UpdateFormEmailStudioDto } from "./dto/update-form-email-studio.dto";
import { UpsertFormDefinitionDto } from "./dto/upsert-form-definition.dto";
import { FormEmailRendererService } from "./form-email-renderer.service";
import {
  normalizeInquiryIntegrationProvider,
  readIntegrationConfig,
} from "./inquiry-integration";
import { SubmissionOperationsService } from "./submission-operations.service";

/** Honeypot score assigned when the trap field is non-empty. */
const HONEYPOT_SPAM_SCORE = 1.0;
const HOMEPAGE_SLUG_ALIASES = new Set(["", "/", "index", "home"]);
const DEFAULT_FORM_KEY = "contact-primary";

type JsonRecord = Record<string, unknown>;

type FormAssignment = {
  pageSlugs?: string[];
  locales?: string[];
  pageTypes?: string[];
  sectionKeys?: string[];
};

type SchemaFieldSnapshot = {
  key: string;
  label: string;
  placeholder: string;
  helpText: string;
  type: FormFieldType;
  required: boolean;
  sortOrder: number;
  validation?: JsonRecord | null;
  options?: unknown;
  defaultValue?: string | null;
  isPlatformManaged: boolean;
  visibilityRules?: JsonRecord | null;
};

type SchemaSnapshot = {
  formDefinitionId: string;
  key: string;
  name: string;
  description: string;
  formType: FormType;
  assignment: FormAssignment | null;
  fields: SchemaFieldSnapshot[];
};

@Injectable()
export class FormsService {
  private readonly logger = new Logger(FormsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly formEmailRendererService: FormEmailRendererService,
    private readonly submissionOperationsService: SubmissionOperationsService,
    private readonly billingService: BillingService,
  ) {}

  // ─── Public ───────────────────────────────────────────────────────────────────

  async createSubmission(dto: CreateSubmissionDto) {
    const locale = dto.locale ?? "en";
    const pageSlug = dto.pageSlug ? this.normalizePageSlug(dto.pageSlug) : null;

    await this.ensureSiteExists(dto.siteId);
    await this.ensureStudioDefaults(dto.siteId);

    if (pageSlug) {
      const page = await this.prisma.page.findFirst({
        where: {
          siteId: dto.siteId,
          slug: pageSlug,
          locale,
          deletedAt: null,
        },
        select: { id: true },
      });

      if (!page) {
        throw new BadRequestException({
          code: "PAGE_NOT_FOUND",
          message: "The referenced page does not exist for this site",
        });
      }
    }

    const spamScore = dto._trap ? HONEYPOT_SPAM_SCORE : 0;
    const status =
      spamScore >= 1.0
        ? FormSubmissionStatus.SPAM
        : FormSubmissionStatus.RECEIVED;

    const definition = await this.resolveSubmissionDefinition(dto.siteId, {
      formDefinitionId: dto.formDefinitionId,
      formKey: dto.formKey,
      pageSlug,
      locale,
    });

    if (!definition) {
      throw new BadRequestException({
        code: "FORM_NOT_FOUND",
        message: "No active form is available for this page",
      });
    }

    const assignment = this.parseAssignment(definition.assignment);
    if (!this.matchesAssignment(assignment, pageSlug, locale)) {
      throw new BadRequestException({
        code: "FORM_NOT_AVAILABLE",
        message: "This form is not assigned to the requested page or locale",
      });
    }

    const schemaVersion = dto.formSchemaVersionId
      ? await this.prisma.formSchemaVersion.findFirst({
          where: {
            id: dto.formSchemaVersionId,
            formDefinitionId: definition.id,
            publishedAt: { not: null },
          },
        })
      : definition.activeSchemaVersion;

    if (!schemaVersion) {
      throw new BadRequestException({
        code: "FORM_SCHEMA_VERSION_NOT_FOUND",
        message: "The referenced form schema version is not available",
      });
    }

    const schemaSnapshot = this.parseSchemaSnapshot(
      schemaVersion.schemaSnapshot,
    );
    const payload = this.buildSubmissionPayload(schemaSnapshot, dto, {
      siteId: dto.siteId,
      pageSlug,
      locale,
    });
    const routingRule = await this.resolveRoutingRule(
      dto.siteId,
      definition.id,
      pageSlug,
      locale,
    );

    await this.billingService.assertCanAcceptInquiry(dto.siteId);

    const submission = await this.prisma.formSubmission.create({
      data: {
        siteId: dto.siteId,
        formDefinitionId: definition.id,
        formSchemaVersionId: schemaVersion.id,
        routingRuleId: routingRule?.id ?? null,
        formType: definition.formType,
        pageSlug,
        locale,
        payload: payload as unknown as Prisma.InputJsonValue,
        spamScore,
        status,
      },
    });

    try {
      await this.submissionOperationsService.queueSubmissionDelivery(
        submission.id,
      );
    } catch (error) {
      this.logger.error(
        `Failed to queue submission delivery for ${submission.id}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return { id: submission.id, status: submission.status };
  }

  async resolvePublicForm(
    siteId: string,
    params: {
      pageSlug?: string;
      locale?: string;
      formKey?: string;
    },
  ) {
    await this.ensureSiteExists(siteId);
    await this.ensureStudioDefaults(siteId);

    const locale = params.locale ?? "en";
    const pageSlug = params.pageSlug
      ? this.normalizePageSlug(params.pageSlug)
      : null;

    const definition = await this.resolveSubmissionDefinition(siteId, {
      formDefinitionId: undefined,
      formKey: params.formKey,
      pageSlug,
      locale,
    });

    if (!definition?.activeSchemaVersion) {
      return null;
    }

    const schema = this.parseSchemaSnapshot(
      definition.activeSchemaVersion.schemaSnapshot,
    );

    return {
      id: definition.id,
      key: definition.key,
      name: definition.name,
      description: definition.description,
      formType: definition.formType,
      assignment: this.parseAssignment(definition.assignment),
      schemaVersion: {
        id: definition.activeSchemaVersion.id,
        versionNumber: definition.activeSchemaVersion.versionNumber,
        publishedAt:
          definition.activeSchemaVersion.publishedAt?.toISOString() ?? null,
      },
      fields: schema.fields.map((field) => ({
        key: field.key,
        label: field.label,
        placeholder: field.placeholder,
        helpText: field.helpText,
        type: field.type,
        required: field.required,
        sortOrder: field.sortOrder,
        options: field.options ?? [],
        defaultValue: field.defaultValue ?? null,
        isPlatformManaged: field.isPlatformManaged,
        visibilityRules: field.visibilityRules ?? null,
      })),
      antiSpam: {
        honeypotField: "lastname",
      },
    };
  }

  // ─── Customer ────────────────────────────────────────────────────────────────

  async listDefinitions(siteId: string) {
    await this.ensureSiteExists(siteId);
    await this.ensureStudioDefaults(siteId);

    const [definitions, siteRoutingRules] = await Promise.all([
      this.prisma.formDefinition.findMany({
        where: { siteId },
        include: {
          draftFields: { orderBy: { sortOrder: "asc" } },
          routingRules: {
            where: { isActive: true },
            orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
          },
          activeSchemaVersion: {
            select: {
              id: true,
              versionNumber: true,
              publishedAt: true,
            },
          },
          schemaVersions: {
            select: {
              id: true,
              versionNumber: true,
              publishedAt: true,
              createdAt: true,
            },
            orderBy: { versionNumber: "desc" },
          },
          emailTemplates: {
            select: {
              id: true,
              templateType: true,
              enabled: true,
              name: true,
            },
            orderBy: { templateType: "asc" },
          },
        },
        orderBy: { createdAt: "asc" },
      }),
      this.prisma.formRoutingRule.findMany({
        where: { siteId, formDefinitionId: null, isActive: true },
        orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
      }),
    ]);

    return {
      definitions: definitions.map((definition) => ({
        id: definition.id,
        key: definition.key,
        name: definition.name,
        description: definition.description,
        formType: definition.formType,
        status: definition.status,
        assignment: this.parseAssignment(definition.assignment),
        fields: definition.draftFields.map((field) => ({
          id: field.id,
          key: field.key,
          label: field.label,
          placeholder: field.placeholder,
          helpText: field.helpText,
          type: field.type,
          required: field.required,
          sortOrder: field.sortOrder,
          validation: this.asRecord(field.validation),
          options: field.options ?? [],
          defaultValue: field.defaultValue,
          isPlatformManaged: field.isPlatformManaged,
          visibilityRules: this.asRecord(field.visibilityRules),
        })),
        routingRules: definition.routingRules.map((rule) =>
          this.toRoutingRuleDto(rule),
        ),
        activeSchemaVersion: definition.activeSchemaVersion
          ? {
              id: definition.activeSchemaVersion.id,
              versionNumber: definition.activeSchemaVersion.versionNumber,
              publishedAt:
                definition.activeSchemaVersion.publishedAt?.toISOString() ??
                null,
            }
          : null,
        schemaVersions: definition.schemaVersions.map((version) => ({
          id: version.id,
          versionNumber: version.versionNumber,
          publishedAt: version.publishedAt?.toISOString() ?? null,
          createdAt: version.createdAt.toISOString(),
        })),
        emailTemplates: definition.emailTemplates,
      })),
      siteRoutingRules: siteRoutingRules.map((rule) =>
        this.toRoutingRuleDto(rule),
      ),
    };
  }

  async saveDefinition(
    siteId: string,
    definitionId: string | null,
    dto: UpsertFormDefinitionDto,
  ) {
    await this.ensureSiteExists(siteId);
    await this.ensureStudioDefaults(siteId);
    this.validateFieldDrafts(dto.fields);

    return this.prisma.$transaction(async (tx) => {
      const existing = definitionId
        ? await tx.formDefinition.findUnique({ where: { id: definitionId } })
        : null;

      if (definitionId && (!existing || existing.siteId !== siteId)) {
        throw new NotFoundException({
          code: "FORM_DEFINITION_NOT_FOUND",
          message: "Form definition not found in this site",
        });
      }

      const duplicate = await tx.formDefinition.findFirst({
        where: {
          siteId,
          key: dto.key.trim(),
          ...(definitionId ? { id: { not: definitionId } } : {}),
        },
        select: { id: true },
      });

      if (duplicate) {
        throw new BadRequestException({
          code: "FORM_KEY_ALREADY_EXISTS",
          message: "A form with this key already exists in the site",
        });
      }

      const definition = existing
        ? await tx.formDefinition.update({
            where: { id: existing.id },
            data: {
              key: dto.key.trim(),
              name: dto.name.trim(),
              description: dto.description?.trim() ?? "",
              formType: dto.formType,
              assignment:
                (dto.assignment as Prisma.InputJsonValue | undefined) ??
                Prisma.JsonNull,
            },
          })
        : await tx.formDefinition.create({
            data: {
              siteId,
              key: dto.key.trim(),
              name: dto.name.trim(),
              description: dto.description?.trim() ?? "",
              formType: dto.formType,
              assignment:
                (dto.assignment as Prisma.InputJsonValue | undefined) ??
                Prisma.JsonNull,
            },
          });

      await tx.formField.deleteMany({
        where: { formDefinitionId: definition.id },
      });

      await tx.formField.createMany({
        data: dto.fields.map((field, index) => ({
          formDefinitionId: definition.id,
          key: field.key.trim(),
          label: field.label.trim(),
          placeholder: field.placeholder?.trim() ?? "",
          helpText: field.helpText?.trim() ?? "",
          type: field.type,
          required: field.required ?? false,
          sortOrder: field.sortOrder ?? index,
          validation:
            (field.validation as Prisma.InputJsonValue | undefined) ??
            Prisma.JsonNull,
          options:
            (field.options as Prisma.InputJsonValue | undefined) ??
            Prisma.JsonNull,
          defaultValue: field.defaultValue ?? null,
          isPlatformManaged: field.isPlatformManaged ?? false,
          visibilityRules:
            (field.visibilityRules as Prisma.InputJsonValue | undefined) ??
            Prisma.JsonNull,
        })),
      });

      await this.syncRoutingRules(tx, {
        siteId,
        formDefinitionId: definition.id,
        rules: dto.routingRules,
        defaultName: `${dto.name.trim()} route`,
      });

      const saved = await tx.formDefinition.findUniqueOrThrow({
        where: { id: definition.id },
        include: {
          draftFields: { orderBy: { sortOrder: "asc" } },
          routingRules: {
            where: { isActive: true },
            orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
          },
          activeSchemaVersion: {
            select: {
              id: true,
              versionNumber: true,
              publishedAt: true,
            },
          },
        },
      });

      return {
        ...saved,
        routingRules: saved.routingRules.map((rule) =>
          this.toRoutingRuleDto(rule),
        ),
      };
    });
  }

  async updateSiteRoutingRules(
    siteId: string,
    routingRules: UpsertFormDefinitionDto["routingRules"] = [],
  ) {
    await this.ensureSiteExists(siteId);
    await this.ensureStudioDefaults(siteId);

    return this.prisma.$transaction(async (tx) => {
      const saved = await this.syncRoutingRules(tx, {
        siteId,
        formDefinitionId: null,
        rules: routingRules,
        defaultName: "Site fallback route",
      });

      return saved.map((rule) => this.toRoutingRuleDto(rule));
    });
  }

  async publishDefinition(
    siteId: string,
    definitionId: string,
    publishedBy: string | null,
  ) {
    await this.ensureSiteExists(siteId);
    await this.ensureStudioDefaults(siteId);

    return this.prisma.$transaction(async (tx) => {
      const definition = await tx.formDefinition.findUnique({
        where: { id: definitionId },
        include: {
          draftFields: { orderBy: { sortOrder: "asc" } },
          routingRules: {
            where: { isActive: true },
            orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
          },
          schemaVersions: {
            select: { versionNumber: true },
            orderBy: { versionNumber: "desc" },
            take: 1,
          },
        },
      });

      if (!definition || definition.siteId !== siteId) {
        throw new NotFoundException({
          code: "FORM_DEFINITION_NOT_FOUND",
          message: "Form definition not found in this site",
        });
      }

      if (definition.draftFields.length === 0) {
        throw new BadRequestException({
          code: "FORM_FIELDS_REQUIRED",
          message: "A form must contain at least one field before publishing",
        });
      }

      const versionNumber =
        (definition.schemaVersions[0]?.versionNumber ?? 0) + 1;
      const schemaSnapshot = this.buildSchemaSnapshot(definition);
      const routingSnapshot = definition.routingRules.map((rule) => ({
        id: rule.id,
        name: rule.name,
        pageSlug: rule.pageSlug,
        locale: rule.locale,
        priority: rule.priority,
        isActive: rule.isActive,
        saveToInbox: rule.saveToInbox,
        emailRecipients: rule.emailRecipients,
        integrationProvider: rule.integrationProvider,
        integrationConfig: rule.integrationConfig,
        webhookUrl: rule.webhookUrl,
        sendConfirmationEmail: rule.sendConfirmationEmail,
        confirmationReplyToFieldKey: rule.confirmationReplyToFieldKey,
      }));
      const emailStudio = await this.formEmailRendererService.getStudio(siteId);

      const version = await tx.formSchemaVersion.create({
        data: {
          formDefinitionId: definition.id,
          versionNumber,
          schemaSnapshot: schemaSnapshot as Prisma.InputJsonValue,
          routingSnapshot: routingSnapshot as Prisma.InputJsonValue,
          emailSnapshot: {
            themeId: emailStudio.theme.id,
            templateIds: emailStudio.templates
              .filter(
                (template) =>
                  template.formDefinitionId === null ||
                  template.formDefinitionId === definition.id,
              )
              .map((template) => template.id),
          } as Prisma.InputJsonValue,
          createdBy: publishedBy,
          publishedAt: new Date(),
        },
      });

      const published = await tx.formDefinition.update({
        where: { id: definition.id },
        data: {
          status: "ACTIVE",
          activeSchemaVersionId: version.id,
        },
        include: {
          activeSchemaVersion: {
            select: {
              id: true,
              versionNumber: true,
              publishedAt: true,
            },
          },
          draftFields: { orderBy: { sortOrder: "asc" } },
          routingRules: {
            where: { isActive: true },
            orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
          },
        },
      });

      return {
        ...published,
        routingRules: published.routingRules.map((rule) =>
          this.toRoutingRuleDto(rule),
        ),
      };
    });
  }

  async getEmailStudio(siteId: string) {
    await this.ensureSiteExists(siteId);
    await this.ensureStudioDefaults(siteId);
    return this.formEmailRendererService.getStudio(siteId);
  }

  async updateEmailStudio(
    siteId: string,
    dto: UpdateFormEmailStudioDto,
    updatedBy: string | null,
  ) {
    await this.ensureSiteExists(siteId);
    await this.ensureStudioDefaults(siteId);
    return this.formEmailRendererService.updateStudio(siteId, dto, updatedBy);
  }

  async previewEmail(siteId: string, dto: PreviewFormEmailDto) {
    await this.ensureSiteExists(siteId);
    await this.ensureStudioDefaults(siteId);
    return this.formEmailRendererService.renderPreview(siteId, dto);
  }

  async sendTestEmail(siteId: string, dto: SendTestFormEmailDto) {
    await this.ensureSiteExists(siteId);
    await this.ensureStudioDefaults(siteId);
    return this.formEmailRendererService.sendTestEmail(siteId, dto);
  }

  async listForSite(
    siteId: string,
    params: {
      status?: FormSubmissionStatus;
      page?: number;
      limit?: number;
    },
  ) {
    const { status, page = 1, limit = 50 } = params;
    const where: Prisma.FormSubmissionWhereInput = {
      siteId,
      // Customers never see spam-flagged submissions or routes that opt out
      // of the inbox surface.
      status: status ?? { not: FormSubmissionStatus.SPAM },
      OR: [
        { routingRuleId: null },
        { routingRule: { is: { saveToInbox: true } } },
      ],
    };

    const [rows, total] = await Promise.all([
      this.prisma.formSubmission.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.formSubmission.count({ where }),
    ]);

    return {
      data: rows.map((r) => this.toCustomerDto(r)),
      total,
      page,
      limit,
    };
  }

  async updateStatus(
    siteId: string,
    submissionId: string,
    status: FormSubmissionStatus,
  ) {
    const sub = await this.prisma.formSubmission.findUnique({
      where: { id: submissionId },
    });
    if (!sub || sub.siteId !== siteId) {
      throw new NotFoundException({
        code: "SUBMISSION_NOT_FOUND",
        message: "Submission not found in this site",
      });
    }

    const updated = await this.prisma.formSubmission.update({
      where: { id: submissionId },
      data: { status },
    });
    return this.toCustomerDto(updated);
  }

  // ─── Admin ────────────────────────────────────────────────────────────────────

  async getAdminSummary(params: { page?: number; limit?: number }) {
    const { page = 1, limit = 50 } = params;

    const [sites, total] = await Promise.all([
      this.prisma.site.findMany({
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          tenant: { select: { name: true } },
        },
      }),
      this.prisma.site.count(),
    ]);

    if (sites.length === 0) {
      return { data: [], total };
    }

    const siteIds = sites.map((s) => s.id);

    // Load all submissions for the page batch in one query
    const [submissions, deliveries, alerts] = await Promise.all([
      this.prisma.formSubmission.findMany({
        where: { siteId: { in: siteIds } },
        select: { siteId: true, status: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.formDelivery.findMany({
        where: { siteId: { in: siteIds } },
        select: {
          siteId: true,
          status: true,
          errorMessage: true,
          lastAttemptAt: true,
          updatedAt: true,
        },
        orderBy: [{ lastAttemptAt: "desc" }, { updatedAt: "desc" }],
      }),
      this.prisma.operationalAlert.findMany({
        where: {
          siteId: { in: siteIds },
          status: "OPEN",
          type: {
            in: [
              OperationalAlertType.FORM_DELIVERY_FAILURE,
              OperationalAlertType.SUBMISSION_SPIKE,
            ],
          },
        },
        select: {
          siteId: true,
          type: true,
          message: true,
        },
      }),
    ]);

    // Aggregate per site
    const bysite = new Map<
      string,
      Array<{ status: FormSubmissionStatus; createdAt: Date }>
    >();
    for (const sub of submissions) {
      if (!bysite.has(sub.siteId)) bysite.set(sub.siteId, []);
      bysite.get(sub.siteId)!.push(sub);
    }

    const deliveryBySite = new Map<
      string,
      Array<{
        status: FormDeliveryStatus;
        errorMessage: string | null;
        lastAttemptAt: Date | null;
        updatedAt: Date;
      }>
    >();
    for (const delivery of deliveries) {
      if (!deliveryBySite.has(delivery.siteId)) {
        deliveryBySite.set(delivery.siteId, []);
      }
      deliveryBySite.get(delivery.siteId)!.push(delivery);
    }

    const alertsBySite = new Map<
      string,
      Array<{ type: OperationalAlertType; message: string }>
    >();
    for (const alert of alerts) {
      if (!alertsBySite.has(alert.siteId)) {
        alertsBySite.set(alert.siteId, []);
      }
      alertsBySite.get(alert.siteId)!.push(alert);
    }

    const data = sites.map((site) => {
      const subs = bysite.get(site.id) ?? [];
      const spamCount = subs.filter(
        (s) => s.status === FormSubmissionStatus.SPAM,
      ).length;
      const siteDeliveries = deliveryBySite.get(site.id) ?? [];
      const failedDeliveries = siteDeliveries.filter(
        (delivery) => delivery.status === FormDeliveryStatus.FAILED,
      );
      const pendingDeliveries = siteDeliveries.filter(
        (delivery) =>
          delivery.status === FormDeliveryStatus.PENDING ||
          delivery.status === FormDeliveryStatus.PROCESSING,
      );
      const openSiteAlerts = alertsBySite.get(site.id) ?? [];
      const deliveryAlert = openSiteAlerts.find(
        (alert) => alert.type === OperationalAlertType.FORM_DELIVERY_FAILURE,
      );
      const spikeAlert = openSiteAlerts.find(
        (alert) => alert.type === OperationalAlertType.SUBMISSION_SPIKE,
      );

      return {
        siteId: site.id,
        siteName: site.name,
        tenantName: site.tenant.name,
        totalSubmissions: subs.length,
        nonSpamSubmissions: subs.length - spamCount,
        spamCount,
        unreadCount: subs.filter(
          (s) => s.status === FormSubmissionStatus.RECEIVED,
        ).length,
        failedDeliveryCount: failedDeliveries.length,
        pendingDeliveryCount: pendingDeliveries.length,
        lastDeliveryFailureAt:
          failedDeliveries[0]?.lastAttemptAt?.toISOString() ??
          failedDeliveries[0]?.updatedAt?.toISOString() ??
          null,
        lastDeliveryError: failedDeliveries[0]?.errorMessage ?? null,
        openDeliveryAlert: Boolean(deliveryAlert),
        deliveryAlertMessage: deliveryAlert?.message ?? null,
        openSpikeAlert: Boolean(spikeAlert),
        spikeAlertMessage: spikeAlert?.message ?? null,
        lastSubmittedAt: subs[0]?.createdAt?.toISOString() ?? null,
      };
    });

    return { data, total };
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private toCustomerDto(sub: {
    id: string;
    formType: FormType;
    pageSlug: string | null;
    locale: string;
    payload: Prisma.JsonValue;
    status: FormSubmissionStatus;
    createdAt: Date;
  }) {
    const p =
      typeof sub.payload === "object" && sub.payload !== null
        ? (sub.payload as Record<string, unknown>)
        : {};

    return {
      id: sub.id,
      formDefinitionId:
        (sub as { formDefinitionId?: string | null }).formDefinitionId ?? null,
      formSchemaVersionId:
        (sub as { formSchemaVersionId?: string | null }).formSchemaVersionId ??
        null,
      routingRuleId:
        (sub as { routingRuleId?: string | null }).routingRuleId ?? null,
      formType: sub.formType,
      pageSlug: sub.pageSlug,
      locale: sub.locale,
      name: String(p["name"] ?? ""),
      email: String(p["email"] ?? ""),
      message: String(p["message"] ?? ""),
      extra: Object.fromEntries(
        Object.entries(p).filter(
          ([k]) => !["name", "email", "message"].includes(k),
        ),
      ),
      status: sub.status,
      createdAt: sub.createdAt.toISOString(),
    };
  }

  private normalizePageSlug(pageSlug: string): string {
    const trimmed = pageSlug.trim().replace(/^\/+|\/+$/g, "");
    const alias = trimmed.toLowerCase();

    if (HOMEPAGE_SLUG_ALIASES.has(alias)) {
      return "home";
    }

    return trimmed;
  }

  private async ensureSiteExists(siteId: string) {
    const site = await this.prisma.site.findUnique({
      where: { id: siteId },
      select: { id: true },
    });

    if (!site) {
      throw new BadRequestException({
        code: "SITE_NOT_FOUND",
        message: "The referenced site does not exist",
      });
    }

    return site;
  }

  private async ensureStudioDefaults(siteId: string) {
    const site = await this.prisma.site.findUnique({
      where: { id: siteId },
      select: {
        id: true,
        settings: {
          select: {
            supportEmail: true,
            defaultInquiryRoutingEmail: true,
            inquiryIntegrationProvider: true,
            inquiryIntegrationConfig: true,
            inquiryIntegrationSecret: true,
            inquiryWebhookUrl: true,
            inquiryWebhookSecret: true,
          },
        },
      },
    });

    if (!site) {
      throw new BadRequestException({
        code: "SITE_NOT_FOUND",
        message: "The referenced site does not exist",
      });
    }

    const [definitionCount, routingRuleCount] = await Promise.all([
      this.prisma.formDefinition.count({ where: { siteId } }),
      this.prisma.formRoutingRule.count({ where: { siteId } }),
    ]);

    if (definitionCount === 0) {
      await this.prisma.$transaction(async (tx) => {
        const definition = await tx.formDefinition.create({
          data: {
            siteId,
            key: DEFAULT_FORM_KEY,
            name: "Primary inquiry form",
            description: "Default public inquiry form",
            formType: FormType.CONTACT,
            status: "ACTIVE",
          },
        });

        const defaultFields = [
          {
            key: "name",
            label: "Name",
            type: FormFieldType.SINGLE_LINE_TEXT,
            required: true,
            sortOrder: 0,
            placeholder: "Your name",
          },
          {
            key: "email",
            label: "Email",
            type: FormFieldType.EMAIL,
            required: true,
            sortOrder: 1,
            placeholder: "you@example.com",
          },
          {
            key: "message",
            label: "Message",
            type: FormFieldType.MULTI_LINE_TEXT,
            required: true,
            sortOrder: 2,
            placeholder: "How can we help?",
          },
          {
            key: "pageSlug",
            label: "Page slug",
            type: FormFieldType.HIDDEN,
            required: false,
            sortOrder: 3,
            placeholder: "",
            isPlatformManaged: true,
          },
          {
            key: "locale",
            label: "Locale",
            type: FormFieldType.HIDDEN,
            required: false,
            sortOrder: 4,
            placeholder: "",
            isPlatformManaged: true,
          },
        ];

        await tx.formField.createMany({
          data: defaultFields.map((field) => ({
            formDefinitionId: definition.id,
            key: field.key,
            label: field.label,
            placeholder: field.placeholder,
            helpText: "",
            type: field.type,
            required: field.required,
            sortOrder: field.sortOrder,
            isPlatformManaged: field.isPlatformManaged ?? false,
          })),
        });

        const schemaSnapshot: SchemaSnapshot = {
          formDefinitionId: definition.id,
          key: DEFAULT_FORM_KEY,
          name: definition.name,
          description: definition.description,
          formType: definition.formType,
          assignment: null,
          fields: defaultFields.map((field) => ({
            key: field.key,
            label: field.label,
            placeholder: field.placeholder,
            helpText: "",
            type: field.type,
            required: field.required,
            sortOrder: field.sortOrder,
            defaultValue: null,
            isPlatformManaged: field.isPlatformManaged ?? false,
            validation: null,
            options: [],
            visibilityRules: null,
          })),
        };

        const version = await tx.formSchemaVersion.create({
          data: {
            formDefinitionId: definition.id,
            versionNumber: 1,
            schemaSnapshot: schemaSnapshot as Prisma.InputJsonValue,
            publishedAt: new Date(),
          },
        });

        await tx.formDefinition.update({
          where: { id: definition.id },
          data: { activeSchemaVersionId: version.id },
        });
      });
    }

    if (routingRuleCount === 0) {
      const emailRecipients = Array.from(
        new Set(
          [
            site.settings?.defaultInquiryRoutingEmail?.trim(),
            site.settings?.supportEmail?.trim(),
          ].filter((value): value is string => Boolean(value)),
        ),
      );

      await this.prisma.formRoutingRule.create({
        data: {
          siteId,
          name: "Default site fallback",
          priority: 0,
          isActive: true,
          saveToInbox: true,
          emailRecipients,
          integrationProvider: normalizeInquiryIntegrationProvider(
            site.settings?.inquiryIntegrationProvider,
            Boolean(site.settings?.inquiryWebhookUrl?.trim()),
          ),
          integrationConfig: readIntegrationConfig(
            site.settings?.inquiryIntegrationConfig,
          ) as Prisma.InputJsonValue,
          integrationSecret:
            site.settings?.inquiryIntegrationSecret?.trim() ?? "",
          webhookUrl: site.settings?.inquiryWebhookUrl?.trim() ?? "",
          webhookSecret: site.settings?.inquiryWebhookSecret?.trim() ?? "",
          sendConfirmationEmail: false,
          confirmationReplyToFieldKey: "email",
        },
      });
    }

    await this.formEmailRendererService.getStudio(siteId);
  }

  private async resolveSubmissionDefinition(
    siteId: string,
    params: {
      formDefinitionId?: string;
      formKey?: string;
      pageSlug: string | null;
      locale: string;
    },
  ) {
    if (params.formDefinitionId) {
      const definition = await this.prisma.formDefinition.findUnique({
        where: { id: params.formDefinitionId },
        include: {
          activeSchemaVersion: true,
        },
      });

      if (!definition || definition.siteId !== siteId) {
        throw new BadRequestException({
          code: "FORM_NOT_FOUND",
          message: "The referenced form does not exist in this site",
        });
      }

      return definition;
    }

    if (params.formKey) {
      const definition = await this.prisma.formDefinition.findFirst({
        where: {
          siteId,
          key: params.formKey,
        },
        include: {
          activeSchemaVersion: true,
        },
      });

      if (!definition) {
        throw new BadRequestException({
          code: "FORM_NOT_FOUND",
          message: "The requested form key is not active for this site",
        });
      }

      return definition;
    }

    const activeDefinitions = await this.prisma.formDefinition.findMany({
      where: {
        siteId,
        activeSchemaVersionId: { not: null },
      },
      include: {
        activeSchemaVersion: true,
      },
      orderBy: { createdAt: "asc" },
    });

    const matches = activeDefinitions
      .map((definition) => ({
        definition,
        score: this.scoreAssignment(
          this.parseAssignment(definition.assignment),
          params.pageSlug,
          params.locale,
        ),
      }))
      .filter((entry) => entry.score >= 0)
      .sort((left, right) => right.score - left.score);

    return matches[0]?.definition ?? activeDefinitions[0] ?? null;
  }

  private async resolveRoutingRule(
    siteId: string,
    formDefinitionId: string,
    pageSlug: string | null,
    locale: string,
  ) {
    const rules = await this.prisma.formRoutingRule.findMany({
      where: {
        siteId,
        isActive: true,
        OR: [{ formDefinitionId }, { formDefinitionId: null }],
      },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    });

    const ranked = rules
      .filter((rule) => {
        const pageMatches = !rule.pageSlug || rule.pageSlug === pageSlug;
        const localeMatches = !rule.locale || rule.locale === locale;
        return pageMatches && localeMatches;
      })
      .map((rule) => ({
        rule,
        score:
          (rule.formDefinitionId === formDefinitionId ? 100 : 0) +
          (rule.pageSlug ? 10 : 0) +
          (rule.locale ? 5 : 0) +
          rule.priority,
      }))
      .sort((left, right) => right.score - left.score);

    return ranked[0]?.rule ?? null;
  }

  private async syncRoutingRules(
    tx: Prisma.TransactionClient,
    params: {
      siteId: string;
      formDefinitionId: string | null;
      rules?: UpsertFormDefinitionDto["routingRules"];
      defaultName: string;
    },
  ) {
    const incomingRules = params.rules ?? [];
    const existingRules = await tx.formRoutingRule.findMany({
      where: {
        siteId: params.siteId,
        formDefinitionId: params.formDefinitionId,
      },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    });
    const existingById = new Map(existingRules.map((rule) => [rule.id, rule]));
    const retainedRuleIds = new Set<string>();

    for (const rule of incomingRules) {
      const existingRule = rule.id ? existingById.get(rule.id) : null;
      const data = {
        siteId: params.siteId,
        formDefinitionId: params.formDefinitionId,
        name: rule.name?.trim() || params.defaultName,
        pageSlug: rule.pageSlug ? this.normalizePageSlug(rule.pageSlug) : null,
        locale: rule.locale?.trim() || null,
        priority: rule.priority ?? 0,
        isActive: rule.isActive ?? true,
        saveToInbox: rule.saveToInbox ?? true,
        emailRecipients: Array.from(
          new Set(
            (rule.emailRecipients ?? [])
              .map((value) => value.trim())
              .filter(Boolean),
          ),
        ),
        integrationProvider: normalizeInquiryIntegrationProvider(
          rule.integrationProvider,
          Boolean(rule.webhookUrl?.trim()),
        ),
        integrationConfig: readIntegrationConfig(
          rule.integrationConfig,
        ) as Prisma.InputJsonValue,
        integrationSecret:
          rule.integrationSecret === undefined
            ? (existingRule?.integrationSecret ?? "")
            : rule.integrationSecret.trim(),
        webhookUrl: rule.webhookUrl?.trim() ?? "",
        webhookSecret:
          rule.webhookSecret === undefined
            ? (existingRule?.webhookSecret ?? "")
            : rule.webhookSecret.trim(),
        sendConfirmationEmail: rule.sendConfirmationEmail ?? false,
        confirmationReplyToFieldKey:
          rule.confirmationReplyToFieldKey?.trim() || "email",
      };

      if (rule.id && existingById.has(rule.id)) {
        retainedRuleIds.add(rule.id);
        await tx.formRoutingRule.update({
          where: { id: rule.id },
          data,
        });
        continue;
      }

      const createdRule = await tx.formRoutingRule.create({
        data,
      });
      retainedRuleIds.add(createdRule.id);
    }

    const retiredRuleIds = existingRules
      .filter((rule) => !retainedRuleIds.has(rule.id) && rule.isActive)
      .map((rule) => rule.id);

    if (retiredRuleIds.length > 0) {
      await tx.formRoutingRule.updateMany({
        where: { id: { in: retiredRuleIds } },
        data: { isActive: false },
      });
    }

    return tx.formRoutingRule.findMany({
      where: {
        siteId: params.siteId,
        formDefinitionId: params.formDefinitionId,
        isActive: true,
      },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    });
  }

  private toRoutingRuleDto<
    T extends {
      webhookSecret: string;
      integrationSecret?: string | null;
    },
  >(rule: T) {
    return {
      ...rule,
      webhookSecret: "",
      integrationSecret: "",
      webhookSecretConfigured: Boolean(rule.webhookSecret),
      integrationSecretConfigured: Boolean(rule.integrationSecret),
    };
  }

  private buildSchemaSnapshot(definition: {
    id: string;
    key: string;
    name: string;
    description: string;
    formType: FormType;
    assignment: Prisma.JsonValue | null;
    draftFields: Array<{
      key: string;
      label: string;
      placeholder: string;
      helpText: string;
      type: FormFieldType;
      required: boolean;
      sortOrder: number;
      validation: Prisma.JsonValue | null;
      options: Prisma.JsonValue | null;
      defaultValue: string | null;
      isPlatformManaged: boolean;
      visibilityRules: Prisma.JsonValue | null;
    }>;
  }): SchemaSnapshot {
    return {
      formDefinitionId: definition.id,
      key: definition.key,
      name: definition.name,
      description: definition.description,
      formType: definition.formType,
      assignment: this.parseAssignment(definition.assignment),
      fields: definition.draftFields.map((field) => ({
        key: field.key,
        label: field.label,
        placeholder: field.placeholder,
        helpText: field.helpText,
        type: field.type,
        required: field.required,
        sortOrder: field.sortOrder,
        validation: this.asRecord(field.validation),
        options: field.options ?? [],
        defaultValue: field.defaultValue,
        isPlatformManaged: field.isPlatformManaged,
        visibilityRules: this.asRecord(field.visibilityRules),
      })),
    };
  }

  private buildSubmissionPayload(
    schema: SchemaSnapshot,
    dto: CreateSubmissionDto,
    context: {
      siteId: string;
      pageSlug: string | null;
      locale: string;
    },
  ) {
    const incoming = this.extractIncomingFields(dto);
    const payload: JsonRecord = {};

    for (const field of schema.fields) {
      const raw = field.isPlatformManaged
        ? this.resolvePlatformFieldValue(field.key, context, field.defaultValue)
        : incoming[field.key];
      const value = this.normalizeFieldValue(field, raw, field.defaultValue);

      if (field.required && this.isEmptyValue(value)) {
        throw new BadRequestException({
          code: "FORM_VALIDATION_ERROR",
          message: `${field.label} is required`,
        });
      }

      if (!this.isEmptyValue(value)) {
        payload[field.key] = value;
      }
    }

    return payload;
  }

  private extractIncomingFields(dto: CreateSubmissionDto) {
    if (dto.fields && Object.keys(dto.fields).length > 0) {
      return { ...dto.fields };
    }

    const legacyFields: JsonRecord = {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.email !== undefined ? { email: dto.email } : {}),
      ...(dto.message !== undefined ? { message: dto.message } : {}),
      ...(dto.extra ?? {}),
    };

    if (Object.keys(legacyFields).length === 0) {
      throw new BadRequestException({
        code: "FORM_FIELDS_REQUIRED",
        message: "No form fields were provided",
      });
    }

    return legacyFields;
  }

  private normalizeFieldValue(
    field: SchemaFieldSnapshot,
    raw: unknown,
    defaultValue?: string | null,
  ) {
    const value = this.isEmptyValue(raw) ? (defaultValue ?? raw) : raw;

    if (this.isEmptyValue(value)) {
      return undefined;
    }

    switch (field.type) {
      case FormFieldType.SINGLE_LINE_TEXT:
      case FormFieldType.MULTI_LINE_TEXT:
      case FormFieldType.HIDDEN: {
        const normalized = String(value).trim();
        this.applyValidationRules(field, normalized);
        return normalized;
      }
      case FormFieldType.EMAIL: {
        const normalized = String(value).trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
          throw new BadRequestException({
            code: "FORM_VALIDATION_ERROR",
            message: `${field.label} must be a valid email address`,
          });
        }
        return normalized;
      }
      case FormFieldType.PHONE: {
        const normalized = String(value).trim();
        if (!/^[0-9+()\-\s]{7,30}$/.test(normalized)) {
          throw new BadRequestException({
            code: "FORM_VALIDATION_ERROR",
            message: `${field.label} must be a valid phone number`,
          });
        }
        return normalized;
      }
      case FormFieldType.NUMBER: {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) {
          throw new BadRequestException({
            code: "FORM_VALIDATION_ERROR",
            message: `${field.label} must be a valid number`,
          });
        }
        this.applyValidationRules(field, numeric);
        return numeric;
      }
      case FormFieldType.DATE: {
        const normalized = String(value).slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
          throw new BadRequestException({
            code: "FORM_VALIDATION_ERROR",
            message: `${field.label} must be a valid date`,
          });
        }
        return normalized;
      }
      case FormFieldType.SELECT:
      case FormFieldType.RADIO: {
        const normalized = String(value).trim();
        const allowed = this.optionValues(field.options);
        if (allowed.length > 0 && !allowed.includes(normalized)) {
          throw new BadRequestException({
            code: "FORM_VALIDATION_ERROR",
            message: `${field.label} contains an unsupported option`,
          });
        }
        return normalized;
      }
      case FormFieldType.CHECKBOX:
        return this.coerceBoolean(value);
      default:
        return value;
    }
  }

  private applyValidationRules(
    field: SchemaFieldSnapshot,
    value: string | number,
  ) {
    const rules = field.validation ?? null;
    if (!rules) {
      return;
    }

    if (typeof value === "string") {
      const minLength = Number(rules.minLength ?? "");
      const maxLength = Number(rules.maxLength ?? "");
      const pattern = typeof rules.pattern === "string" ? rules.pattern : null;

      if (Number.isFinite(minLength) && value.length < minLength) {
        throw new BadRequestException({
          code: "FORM_VALIDATION_ERROR",
          message: `${field.label} is too short`,
        });
      }

      if (Number.isFinite(maxLength) && value.length > maxLength) {
        throw new BadRequestException({
          code: "FORM_VALIDATION_ERROR",
          message: `${field.label} is too long`,
        });
      }

      if (pattern && !new RegExp(pattern).test(value)) {
        throw new BadRequestException({
          code: "FORM_VALIDATION_ERROR",
          message: `${field.label} is invalid`,
        });
      }
    }

    if (typeof value === "number") {
      const min = Number(rules.min ?? "");
      const max = Number(rules.max ?? "");

      if (Number.isFinite(min) && value < min) {
        throw new BadRequestException({
          code: "FORM_VALIDATION_ERROR",
          message: `${field.label} is below the allowed range`,
        });
      }

      if (Number.isFinite(max) && value > max) {
        throw new BadRequestException({
          code: "FORM_VALIDATION_ERROR",
          message: `${field.label} is above the allowed range`,
        });
      }
    }
  }

  private validateFieldDrafts(fields: UpsertFormDefinitionDto["fields"]) {
    const keys = new Set<string>();

    for (const field of fields) {
      const key = field.key.trim();
      if (keys.has(key)) {
        throw new BadRequestException({
          code: "FORM_FIELD_KEY_DUPLICATED",
          message: `Field key ${key} is duplicated`,
        });
      }
      keys.add(key);
    }

    if (!keys.has("email")) {
      throw new BadRequestException({
        code: "FORM_EMAIL_FIELD_REQUIRED",
        message: "Each form must include an email field",
      });
    }
  }

  private resolvePlatformFieldValue(
    key: string,
    context: {
      siteId: string;
      pageSlug: string | null;
      locale: string;
    },
    defaultValue?: string | null,
  ) {
    const normalizedKey = key.toLowerCase();

    switch (normalizedKey) {
      case "pageslug":
      case "sourcepageslug":
        return context.pageSlug ?? defaultValue ?? "";
      case "locale":
      case "submissionlocale":
        return context.locale;
      case "siteid":
        return context.siteId;
      default:
        return defaultValue ?? "";
    }
  }

  private parseSchemaSnapshot(value: Prisma.JsonValue): SchemaSnapshot {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new BadRequestException({
        code: "FORM_SCHEMA_INVALID",
        message: "Stored form schema snapshot is invalid",
      });
    }

    return value as unknown as SchemaSnapshot;
  }

  private parseAssignment(
    value: Prisma.JsonValue | null,
  ): FormAssignment | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }

    return value as FormAssignment;
  }

  private matchesAssignment(
    assignment: FormAssignment | null,
    pageSlug: string | null,
    locale: string,
  ) {
    return this.scoreAssignment(assignment, pageSlug, locale) >= 0;
  }

  private scoreAssignment(
    assignment: FormAssignment | null,
    pageSlug: string | null,
    locale: string,
  ) {
    if (!assignment) {
      return 1;
    }

    let score = 1;

    if (assignment.pageSlugs?.length) {
      if (!pageSlug || !assignment.pageSlugs.includes(pageSlug)) {
        return -1;
      }
      score += 10;
    }

    if (assignment.locales?.length) {
      if (!assignment.locales.includes(locale)) {
        return -1;
      }
      score += 5;
    }

    return score;
  }

  private optionValues(options: unknown) {
    if (!Array.isArray(options)) {
      return [];
    }

    return options
      .map((option) => {
        if (typeof option === "string") {
          return option;
        }

        if (option && typeof option === "object" && !Array.isArray(option)) {
          const record = option as Record<string, unknown>;
          return typeof record.value === "string"
            ? record.value
            : typeof record.label === "string"
              ? record.label
              : null;
        }

        return null;
      })
      .filter((value): value is string => Boolean(value));
  }

  private asRecord(value: Prisma.JsonValue | null) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }

    return value as JsonRecord;
  }

  private isEmptyValue(value: unknown) {
    return (
      value === null ||
      value === undefined ||
      (typeof value === "string" && value.trim() === "")
    );
  }

  private coerceBoolean(value: unknown) {
    if (typeof value === "boolean") {
      return value;
    }

    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      return ["true", "1", "yes", "on"].includes(normalized);
    }

    if (typeof value === "number") {
      return value !== 0;
    }

    return Boolean(value);
  }
}
