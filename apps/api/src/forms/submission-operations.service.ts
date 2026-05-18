import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  FormDeliveryChannel,
  FormDeliveryPurpose,
  FormDeliveryStatus,
  FormEmailTemplateType,
  FormSubmissionStatus,
  OperationalAlertSeverity,
  OperationalAlertStatus,
  OperationalAlertType,
  Prisma,
} from "@prisma/client";
import { type Transporter } from "nodemailer";
import { buildSmtpTransport } from "../mail/smtp-transport";
import { PrismaService } from "../prisma/prisma.service";
import { FormEmailRendererService } from "./form-email-renderer.service";
import {
  buildInquiryEnvelope,
  deliverInquiryIntegration,
  InquiryIntegrationDeliveryError,
  normalizeInquiryIntegrationProvider,
  readIntegrationConfig,
} from "./inquiry-integration";

const DELIVERY_FAILURE_FINGERPRINT = "delivery-failed";
const ROUTING_MISSING_FINGERPRINT = "routing-missing";
const SUBMISSION_SPIKE_FINGERPRINT = "submission-spike";
const DEFAULT_DELIVERY_POLL_MS = 20_000;
const DEFAULT_SPIKE_POLL_MS = 5 * 60_000;
const DEFAULT_DELIVERY_BATCH_SIZE = 20;
const DEFAULT_DELIVERY_MAX_ATTEMPTS = 5;
const DEFAULT_WEBHOOK_TIMEOUT_MS = 8_000;

class DeliveryFailure extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
    readonly responseCode: number | null = null,
    readonly metadata?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "DeliveryFailure";
  }
}

type QueuedDelivery = Prisma.FormDeliveryGetPayload<{
  include: {
    submission: {
      include: {
        routingRule: true;
        formDefinition: {
          select: {
            id: true;
            key: true;
            name: true;
          };
        };
        formSchemaVersion: {
          select: {
            schemaSnapshot: true;
          };
        };
        site: {
          select: {
            name: true;
            settings: {
              select: {
                supportEmail: true;
                defaultInquiryRoutingEmail: true;
                inquiryIntegrationProvider: true;
                inquiryIntegrationConfig: true;
                inquiryIntegrationSecret: true;
                inquiryWebhookUrl: true;
                inquiryWebhookSecret: true;
              };
            };
          };
        };
      };
    };
  };
}>;

@Injectable()
export class SubmissionOperationsService
  implements OnModuleInit, OnModuleDestroy
{
  private deliveryTimer: NodeJS.Timeout | null = null;
  private spikeTimer: NodeJS.Timeout | null = null;
  private deliveryRunInProgress = false;
  private spikeRunInProgress = false;
  private mailTransport: Transporter | null | undefined = undefined;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly formEmailRendererService: FormEmailRendererService,
  ) {}

  onModuleInit() {
    this.deliveryTimer = setInterval(
      () => {
        void this.processDueDeliveries();
      },
      this.getNumber(
        "FORM_DELIVERY_POLL_INTERVAL_MS",
        DEFAULT_DELIVERY_POLL_MS,
      ),
    );
    this.deliveryTimer.unref?.();

    this.spikeTimer = setInterval(
      () => {
        void this.processSpikeAlerts();
      },
      this.getNumber("FORM_SPIKE_POLL_INTERVAL_MS", DEFAULT_SPIKE_POLL_MS),
    );
    this.spikeTimer.unref?.();

    queueMicrotask(() => {
      void this.processDueDeliveries();
      void this.processSpikeAlerts();
    });
  }

  onModuleDestroy() {
    if (this.deliveryTimer) {
      clearInterval(this.deliveryTimer);
      this.deliveryTimer = null;
    }

    if (this.spikeTimer) {
      clearInterval(this.spikeTimer);
      this.spikeTimer = null;
    }
  }

  async queueSubmissionDelivery(submissionId: string): Promise<void> {
    const submission = await this.prisma.formSubmission.findUnique({
      where: { id: submissionId },
      include: {
        routingRule: true,
        formDefinition: {
          select: {
            id: true,
            key: true,
            name: true,
          },
        },
        formSchemaVersion: {
          select: {
            schemaSnapshot: true,
          },
        },
        site: {
          select: {
            name: true,
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
        },
      },
    });

    if (!submission || submission.status === FormSubmissionStatus.SPAM) {
      return;
    }

    const targets = await this.resolveTargets(submission);

    if (targets.length === 0) {
      await this.openAlert({
        siteId: submission.siteId,
        type: OperationalAlertType.FORM_DELIVERY_FAILURE,
        fingerprint: ROUTING_MISSING_FINGERPRINT,
        severity: OperationalAlertSeverity.CRITICAL,
        message: "Inquiry routing is not configured for this site",
        metadata: {
          submissionId: submission.id,
          formType: submission.formType,
          formDefinitionId: submission.formDefinitionId,
        },
      });
      return;
    }

    await this.resolveAlert(
      submission.siteId,
      OperationalAlertType.FORM_DELIVERY_FAILURE,
      ROUTING_MISSING_FINGERPRINT,
    );

    const existing = await this.prisma.formDelivery.findMany({
      where: { submissionId },
      select: { channel: true, destination: true, purpose: true },
    });
    const existingTargets = new Set(
      existing.map(
        (entry) => `${entry.purpose}:${entry.channel}:${entry.destination}`,
      ),
    );

    const rows = targets
      .filter(
        (target) =>
          !existingTargets.has(
            `${target.purpose}:${target.channel}:${target.destination}`,
          ),
      )
      .map((target) => ({
        submissionId: submission.id,
        siteId: submission.siteId,
        purpose: target.purpose,
        channel: target.channel,
        destination: target.destination,
        metadata: target.metadata as Prisma.InputJsonValue | undefined,
        nextAttemptAt: new Date(),
      }));

    if (rows.length > 0) {
      await this.prisma.formDelivery.createMany({ data: rows });
    }

    void this.processDueDeliveries({ submissionId: submission.id });
  }

  /**
   * Operator-triggered replay of a specific FormDelivery row. Resets the row
   * to PENDING with an immediate next-attempt window, clears the prior error,
   * and synchronously runs the delivery processor scoped to the submission so
   * the operator gets immediate feedback. Throws when the row is missing or
   * already delivered (no-op replay is rejected to prevent silent confusion).
   */
  async requeueDelivery(deliveryId: string): Promise<{
    id: string;
    submissionId: string;
    status: FormDeliveryStatus;
  }> {
    const existing = await this.prisma.formDelivery.findUnique({
      where: { id: deliveryId },
      select: { id: true, submissionId: true, status: true },
    });
    if (!existing) {
      throw Object.assign(new Error("Form delivery not found"), {
        status: 404,
        code: "FORM_DELIVERY_NOT_FOUND",
      });
    }
    if (existing.status === FormDeliveryStatus.DELIVERED) {
      throw Object.assign(new Error("Form delivery has already succeeded"), {
        status: 400,
        code: "FORM_DELIVERY_ALREADY_DELIVERED",
      });
    }

    const updated = await this.prisma.formDelivery.update({
      where: { id: deliveryId },
      data: {
        status: FormDeliveryStatus.PENDING,
        errorMessage: null,
        nextAttemptAt: new Date(),
      },
      select: { id: true, submissionId: true, status: true },
    });

    // Run scoped to this submission so the replay is processed immediately
    // rather than waiting for the next interval tick.
    await this.processDueDeliveries({ submissionId: updated.submissionId });

    const refreshed = await this.prisma.formDelivery.findUnique({
      where: { id: deliveryId },
      select: { id: true, submissionId: true, status: true },
    });

    return refreshed ?? updated;
  }

  async processDueDeliveries(options?: { submissionId?: string }) {
    if (this.deliveryRunInProgress) {
      return;
    }

    this.deliveryRunInProgress = true;

    try {
      const now = new Date();
      const staleProcessingCutoff = new Date(now.getTime() - 5 * 60_000);
      const due = await this.prisma.formDelivery.findMany({
        where: {
          ...(options?.submissionId
            ? { submissionId: options.submissionId }
            : {}),
          OR: [
            {
              status: FormDeliveryStatus.PENDING,
              OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
            },
            {
              status: FormDeliveryStatus.PROCESSING,
              lastAttemptAt: { lte: staleProcessingCutoff },
            },
          ],
        },
        include: {
          submission: {
            include: {
              routingRule: true,
              formDefinition: {
                select: {
                  id: true,
                  key: true,
                  name: true,
                },
              },
              formSchemaVersion: {
                select: {
                  schemaSnapshot: true,
                },
              },
              site: {
                select: {
                  name: true,
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
              },
            },
          },
        },
        orderBy: { createdAt: "asc" },
        take: this.getNumber(
          "FORM_DELIVERY_BATCH_SIZE",
          DEFAULT_DELIVERY_BATCH_SIZE,
        ),
      });

      if (due.length === 0) {
        return;
      }

      const touchedSiteIds = new Set<string>();

      for (const delivery of due) {
        touchedSiteIds.add(delivery.siteId);

        const locked = await this.prisma.formDelivery.update({
          where: { id: delivery.id },
          data: {
            status: FormDeliveryStatus.PROCESSING,
            attempts: { increment: 1 },
            lastAttemptAt: now,
          },
        });

        try {
          const result = await this.deliver(locked.id, delivery);

          await this.prisma.formDelivery.update({
            where: { id: delivery.id },
            data: {
              status: FormDeliveryStatus.DELIVERED,
              deliveredAt: new Date(),
              nextAttemptAt: null,
              responseCode: result.responseCode,
              errorMessage: null,
              metadata: result.metadata as Prisma.InputJsonValue,
            },
          });
        } catch (error) {
          const failure = this.toDeliveryFailure(error);
          const terminal =
            !failure.retryable ||
            locked.attempts >=
              this.getNumber(
                "FORM_DELIVERY_MAX_ATTEMPTS",
                DEFAULT_DELIVERY_MAX_ATTEMPTS,
              );

          await this.prisma.formDelivery.update({
            where: { id: delivery.id },
            data: {
              status: terminal
                ? FormDeliveryStatus.FAILED
                : FormDeliveryStatus.PENDING,
              nextAttemptAt: terminal
                ? null
                : new Date(
                    now.getTime() + this.computeBackoffMs(locked.attempts),
                  ),
              responseCode: failure.responseCode,
              errorMessage: failure.message,
              metadata: failure.metadata
                ? (failure.metadata as Prisma.InputJsonValue)
                : undefined,
            },
          });
        }
      }

      for (const siteId of touchedSiteIds) {
        await this.refreshDeliveryFailureAlert(siteId);
      }
    } finally {
      this.deliveryRunInProgress = false;
    }
  }

  async processSpikeAlerts() {
    if (this.spikeRunInProgress) {
      return;
    }

    this.spikeRunInProgress = true;

    try {
      const now = new Date();
      const recentStart = new Date(now.getTime() - 60 * 60_000);
      const baselineStart = new Date(now.getTime() - 25 * 60 * 60_000);

      const [submissions, openAlerts] = await Promise.all([
        this.prisma.formSubmission.findMany({
          where: {
            createdAt: { gte: baselineStart },
            status: { not: FormSubmissionStatus.SPAM },
          },
          select: { siteId: true, createdAt: true },
        }),
        this.prisma.operationalAlert.findMany({
          where: {
            type: OperationalAlertType.SUBMISSION_SPIKE,
            fingerprint: SUBMISSION_SPIKE_FINGERPRINT,
            status: OperationalAlertStatus.OPEN,
          },
          select: { siteId: true },
        }),
      ]);

      const siteIds = new Set<string>([
        ...submissions.map((row) => row.siteId),
        ...openAlerts.map((row) => row.siteId),
      ]);

      for (const siteId of siteIds) {
        const siteRows = submissions.filter((row) => row.siteId === siteId);
        const recentCount = siteRows.filter(
          (row) => row.createdAt >= recentStart,
        ).length;
        const baselineCount = siteRows.filter(
          (row) => row.createdAt < recentStart,
        ).length;
        const baselineHourlyAverage = baselineCount / 24;
        const threshold = Math.max(10, Math.ceil(baselineHourlyAverage * 3));

        if (recentCount >= threshold) {
          await this.openAlert({
            siteId,
            type: OperationalAlertType.SUBMISSION_SPIKE,
            fingerprint: SUBMISSION_SPIKE_FINGERPRINT,
            severity:
              recentCount >= threshold * 2
                ? OperationalAlertSeverity.CRITICAL
                : OperationalAlertSeverity.WARNING,
            message: `${recentCount} non-spam inquiries arrived in the last hour against a baseline of ${baselineHourlyAverage.toFixed(1)}/hour`,
            metadata: {
              recentCount,
              baselineHourlyAverage,
              threshold,
            },
          });
        } else {
          await this.resolveAlert(
            siteId,
            OperationalAlertType.SUBMISSION_SPIKE,
            SUBMISSION_SPIKE_FINGERPRINT,
          );
        }
      }
    } finally {
      this.spikeRunInProgress = false;
    }
  }

  private async resolveTargets(submission: {
    siteId: string;
    formDefinitionId: string | null;
    payload: Prisma.JsonValue;
    routingRule: {
      emailRecipients: string[];
      integrationProvider: string;
      integrationConfig: Prisma.JsonValue;
      integrationSecret: string;
      webhookUrl: string;
      webhookSecret: string;
      sendConfirmationEmail: boolean;
      confirmationReplyToFieldKey: string;
    } | null;
    site: {
      settings: {
        supportEmail: string;
        defaultInquiryRoutingEmail: string;
        inquiryIntegrationProvider: string;
        inquiryIntegrationConfig: Prisma.JsonValue;
        inquiryIntegrationSecret: string;
        inquiryWebhookUrl: string;
        inquiryWebhookSecret: string;
      } | null;
    };
  }) {
    const payload = this.payloadAsRecord(submission.payload);
    const routingRule = submission.routingRule;
    const emailRecipients = routingRule?.emailRecipients?.length
      ? routingRule.emailRecipients
      : [
          submission.site.settings?.defaultInquiryRoutingEmail?.trim() || "",
          submission.site.settings?.supportEmail?.trim() || "",
        ].filter(Boolean);
    const integrationProvider = normalizeInquiryIntegrationProvider(
      routingRule?.integrationProvider ??
        submission.site.settings?.inquiryIntegrationProvider,
      Boolean(
        routingRule?.webhookUrl?.trim() ||
        submission.site.settings?.inquiryWebhookUrl?.trim(),
      ),
    );
    const integrationConfig = readIntegrationConfig(
      routingRule?.integrationConfig ??
        submission.site.settings?.inquiryIntegrationConfig,
    );
    const webhookDestination =
      routingRule?.webhookUrl?.trim() ||
      submission.site.settings?.inquiryWebhookUrl?.trim() ||
      "";
    const integrationDestination = this.resolveIntegrationDestination(
      integrationProvider,
      webhookDestination,
      integrationConfig,
    );
    const targets: Array<{
      purpose: FormDeliveryPurpose;
      channel: FormDeliveryChannel;
      destination: string;
      metadata?: Record<string, unknown>;
    }> = [];

    for (const destination of Array.from(new Set(emailRecipients))) {
      targets.push({
        purpose: FormDeliveryPurpose.INTERNAL_NOTIFICATION,
        channel: FormDeliveryChannel.EMAIL,
        destination,
      });
    }

    if (integrationProvider !== "email") {
      targets.push({
        purpose: FormDeliveryPurpose.WEBHOOK_FORWARD,
        channel: FormDeliveryChannel.WEBHOOK,
        destination: integrationDestination,
        metadata: {
          integrationProvider,
          integrationConfig,
        },
      });
    }

    if (routingRule?.sendConfirmationEmail) {
      const replyToKey = routingRule.confirmationReplyToFieldKey || "email";
      const guestEmail = payload[replyToKey];

      if (
        typeof guestEmail === "string" &&
        guestEmail.trim() &&
        (await this.formEmailRendererService.isTemplateEnabled(
          submission.siteId,
          submission.formDefinitionId,
          FormEmailTemplateType.GUEST_CONFIRMATION,
        ))
      ) {
        targets.push({
          purpose: FormDeliveryPurpose.GUEST_CONFIRMATION,
          channel: FormDeliveryChannel.EMAIL,
          destination: guestEmail.trim(),
        });
      }
    }

    return targets;
  }

  private async deliver(_deliveryId: string, delivery: QueuedDelivery) {
    if (delivery.channel === FormDeliveryChannel.EMAIL) {
      return this.sendEmail(delivery);
    }

    return this.sendWebhook(delivery);
  }

  private async sendEmail(delivery: QueuedDelivery) {
    const transport = this.getMailTransport();
    const from = this.configService.get<string>("INQUIRY_EMAIL_FROM")?.trim();

    if (!transport || !from) {
      throw new DeliveryFailure(
        "SMTP inquiry delivery is not configured",
        false,
      );
    }

    const payload = this.payloadAsRecord(delivery.submission.payload);
    const templateType =
      delivery.purpose === FormDeliveryPurpose.GUEST_CONFIRMATION
        ? FormEmailTemplateType.GUEST_CONFIRMATION
        : FormEmailTemplateType.INTERNAL_NOTIFICATION;
    const fieldDefinitions = this.readSchemaFieldDefinitions(
      delivery.submission.formSchemaVersion?.schemaSnapshot,
    );
    const rendered = await this.formEmailRendererService.renderDelivery({
      siteId: delivery.siteId,
      siteName: delivery.submission.site.name,
      formDefinitionId: delivery.submission.formDefinition?.id ?? null,
      formName:
        delivery.submission.formDefinition?.name ?? "Primary inquiry form",
      templateType,
      payload: payload as Prisma.JsonValue,
      pageSlug: delivery.submission.pageSlug,
      locale: delivery.submission.locale,
      submittedAt: delivery.submission.createdAt,
      fieldDefinitions,
    });
    const info = await transport.sendMail({
      from,
      to: delivery.destination,
      replyTo:
        delivery.purpose === FormDeliveryPurpose.INTERNAL_NOTIFICATION &&
        typeof payload.email === "string" &&
        payload.email
          ? payload.email
          : undefined,
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
    });

    return {
      responseCode: 202,
      metadata: {
        messageId: info.messageId,
        accepted: info.accepted,
        rejected: info.rejected,
        templateId: rendered.templateId,
        themeId: rendered.themeId,
      },
    };
  }

  private async sendWebhook(delivery: QueuedDelivery) {
    const payload = this.payloadAsRecord(delivery.submission.payload);
    const metadata = readIntegrationConfig(delivery.metadata);
    const provider = normalizeInquiryIntegrationProvider(
      metadata.integrationProvider,
      Boolean(delivery.destination?.trim()),
    );
    const config = readIntegrationConfig(metadata.integrationConfig);
    const envelope = buildInquiryEnvelope({
      provider,
      submission: {
        id: delivery.submission.id,
        siteId: delivery.submission.siteId,
        formDefinitionId: delivery.submission.formDefinitionId,
        formSchemaVersionId: delivery.submission.formSchemaVersionId,
        routingRuleId: delivery.submission.routingRuleId,
        formKey: delivery.submission.formDefinition?.key ?? null,
        formType: delivery.submission.formType,
        pageSlug: delivery.submission.pageSlug,
        locale: delivery.submission.locale,
        status: delivery.submission.status,
        createdAt: delivery.submission.createdAt.toISOString(),
      },
      fields: payload,
      siteName: delivery.submission.site.name,
    });
    const secret = this.resolveIntegrationSecret(delivery, provider);

    return deliverInquiryIntegration({
      provider,
      destination: delivery.destination,
      secret,
      config,
      envelope,
      timeoutMs: this.getNumber(
        "FORM_WEBHOOK_TIMEOUT_MS",
        DEFAULT_WEBHOOK_TIMEOUT_MS,
      ),
    });
  }

  private resolveIntegrationDestination(
    provider: string,
    webhookDestination: string,
    config: Record<string, unknown>,
  ) {
    const configuredEndpoint =
      typeof config.endpointUrl === "string"
        ? config.endpointUrl.trim()
        : typeof config.apiBaseUrl === "string"
          ? config.apiBaseUrl.trim()
          : "";

    if (provider === "hubspot") {
      return "hubspot";
    }

    return webhookDestination || configuredEndpoint || provider;
  }

  private resolveIntegrationSecret(delivery: QueuedDelivery, provider: string) {
    const routingRule = delivery.submission.routingRule;
    const settings = delivery.submission.site.settings;

    if (provider === "custom_webhook" || provider === "zapier") {
      return (
        routingRule?.webhookSecret?.trim() ||
        routingRule?.integrationSecret?.trim() ||
        settings?.inquiryWebhookSecret?.trim() ||
        settings?.inquiryIntegrationSecret?.trim() ||
        null
      );
    }

    return (
      routingRule?.integrationSecret?.trim() ||
      routingRule?.webhookSecret?.trim() ||
      settings?.inquiryIntegrationSecret?.trim() ||
      settings?.inquiryWebhookSecret?.trim() ||
      null
    );
  }

  private async refreshDeliveryFailureAlert(siteId: string) {
    const latestFailed = await this.prisma.formDelivery.findFirst({
      where: {
        siteId,
        status: FormDeliveryStatus.FAILED,
      },
      orderBy: [{ lastAttemptAt: "desc" }, { updatedAt: "desc" }],
      select: {
        channel: true,
        destination: true,
        errorMessage: true,
        lastAttemptAt: true,
      },
    });

    if (latestFailed) {
      await this.openAlert({
        siteId,
        type: OperationalAlertType.FORM_DELIVERY_FAILURE,
        fingerprint: DELIVERY_FAILURE_FINGERPRINT,
        severity: OperationalAlertSeverity.WARNING,
        message:
          latestFailed.errorMessage ??
          `A ${latestFailed.channel.toLowerCase()} delivery failed`,
        metadata: {
          channel: latestFailed.channel,
          destination: latestFailed.destination,
          lastAttemptAt: latestFailed.lastAttemptAt?.toISOString() ?? null,
        },
      });

      return;
    }

    await this.resolveAlert(
      siteId,
      OperationalAlertType.FORM_DELIVERY_FAILURE,
      DELIVERY_FAILURE_FINGERPRINT,
    );
  }

  private async openAlert(params: {
    siteId: string;
    type: OperationalAlertType;
    fingerprint: string;
    severity: OperationalAlertSeverity;
    message: string;
    metadata?: Record<string, unknown>;
  }) {
    const now = new Date();

    await this.prisma.operationalAlert.upsert({
      where: {
        siteId_type_fingerprint: {
          siteId: params.siteId,
          type: params.type,
          fingerprint: params.fingerprint,
        },
      },
      create: {
        siteId: params.siteId,
        type: params.type,
        fingerprint: params.fingerprint,
        severity: params.severity,
        status: OperationalAlertStatus.OPEN,
        message: params.message,
        metadata: params.metadata as Prisma.InputJsonValue | undefined,
        firstTriggeredAt: now,
        lastTriggeredAt: now,
      },
      update: {
        severity: params.severity,
        status: OperationalAlertStatus.OPEN,
        message: params.message,
        metadata: params.metadata as Prisma.InputJsonValue | undefined,
        lastTriggeredAt: now,
        resolvedAt: null,
      },
    });
  }

  private async resolveAlert(
    siteId: string,
    type: OperationalAlertType,
    fingerprint: string,
  ) {
    await this.prisma.operationalAlert.updateMany({
      where: {
        siteId,
        type,
        fingerprint,
        status: OperationalAlertStatus.OPEN,
      },
      data: {
        status: OperationalAlertStatus.RESOLVED,
        resolvedAt: new Date(),
        lastTriggeredAt: new Date(),
      },
    });
  }

  private payloadAsRecord(payload: Prisma.JsonValue): Record<string, unknown> {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return {};
    }

    return payload as Record<string, unknown>;
  }

  private readSchemaFieldDefinitions(
    snapshot: Prisma.JsonValue | null | undefined,
  ) {
    if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
      return [];
    }

    const fields = (snapshot as { fields?: unknown }).fields;
    if (!Array.isArray(fields)) {
      return [];
    }

    return fields
      .map((field) => {
        if (!field || typeof field !== "object" || Array.isArray(field)) {
          return null;
        }

        const record = field as Record<string, unknown>;
        return typeof record.key === "string" &&
          typeof record.label === "string"
          ? { key: record.key, label: record.label }
          : null;
      })
      .filter((field): field is { key: string; label: string } =>
        Boolean(field),
      );
  }

  private toDeliveryFailure(error: unknown): DeliveryFailure {
    if (error instanceof DeliveryFailure) {
      return error;
    }

    if (error instanceof InquiryIntegrationDeliveryError) {
      return new DeliveryFailure(
        error.message,
        error.retryable,
        error.responseCode,
        error.metadata,
      );
    }

    if (error instanceof Error) {
      return new DeliveryFailure(error.message, true);
    }

    return new DeliveryFailure(String(error), true);
  }

  private getMailTransport() {
    if (this.mailTransport !== undefined) {
      return this.mailTransport;
    }

    this.mailTransport = buildSmtpTransport(this.configService);

    return this.mailTransport;
  }

  private computeBackoffMs(attempt: number) {
    return Math.min(30 * 60_000, 2 ** Math.max(1, attempt) * 60_000);
  }

  private getNumber(key: string, fallback: number) {
    const value = Number(this.configService.get<string>(key) ?? "");
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }
}
