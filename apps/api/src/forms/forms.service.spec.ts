/// <reference types="jest" />

import { BadRequestException, ConflictException } from "@nestjs/common";
import {
  FormDeliveryStatus,
  FormFieldType,
  FormSubmissionStatus,
  FormType,
  OperationalAlertType,
} from "@prisma/client";
import { BillingService } from "../billing/billing.service";
import { PrismaService } from "../prisma/prisma.service";
import { FormEmailRendererService } from "./form-email-renderer.service";
import { FormsService } from "./forms.service";
import { SubmissionOperationsService } from "./submission-operations.service";

describe("FormsService", () => {
  let service: FormsService;
  let prisma: {
    $transaction: jest.Mock;
    site: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
    };
    formDefinition: {
      count: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
      create: jest.Mock;
    };
    formRoutingRule: {
      count: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
      create: jest.Mock;
    };
    formField: {
      deleteMany: jest.Mock;
      createMany: jest.Mock;
    };
    page: {
      findFirst: jest.Mock;
    };
    formSubmission: {
      create: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
    };
    formDelivery: {
      findMany: jest.Mock;
    };
    operationalAlert: {
      findMany: jest.Mock;
    };
  };
  let submissionOperationsService: {
    queueSubmissionDelivery: jest.Mock;
  };
  let formEmailRendererService: {
    getStudio: jest.Mock;
  };
  let billingService: {
    assertCanAcceptInquiry: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn(async (callback) => callback(prisma)),
      site: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      formDefinition: {
        count: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
      formRoutingRule: {
        count: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        create: jest.fn(),
      },
      formField: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      page: {
        findFirst: jest.fn(),
      },
      formSubmission: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      formDelivery: {
        findMany: jest.fn(),
      },
      operationalAlert: {
        findMany: jest.fn(),
      },
    };

    submissionOperationsService = {
      queueSubmissionDelivery: jest.fn(),
    };

    formEmailRendererService = {
      getStudio: jest.fn().mockResolvedValue({
        theme: { id: "theme-1" },
        templates: [],
      }),
    };
    billingService = {
      assertCanAcceptInquiry: jest.fn().mockResolvedValue(undefined),
    };

    prisma.formDefinition.count.mockResolvedValue(1);
    prisma.formRoutingRule.count.mockResolvedValue(1);
    prisma.formDefinition.findMany.mockResolvedValue([
      {
        id: "form-1",
        siteId: "site-1",
        key: "contact-primary",
        name: "Primary inquiry form",
        description: "",
        formType: FormType.CONTACT,
        assignment: null,
        activeSchemaVersionId: "schema-1",
        activeSchemaVersion: {
          id: "schema-1",
          versionNumber: 1,
          publishedAt: new Date("2026-05-05T10:00:00.000Z"),
          schemaSnapshot: {
            formDefinitionId: "form-1",
            key: "contact-primary",
            name: "Primary inquiry form",
            description: "",
            formType: FormType.CONTACT,
            assignment: null,
            fields: [
              {
                key: "name",
                label: "Name",
                placeholder: "",
                helpText: "",
                type: FormFieldType.SINGLE_LINE_TEXT,
                required: true,
                sortOrder: 0,
                validation: null,
                options: [],
                defaultValue: null,
                isPlatformManaged: false,
                visibilityRules: null,
              },
              {
                key: "email",
                label: "Email",
                placeholder: "",
                helpText: "",
                type: FormFieldType.EMAIL,
                required: true,
                sortOrder: 1,
                validation: null,
                options: [],
                defaultValue: null,
                isPlatformManaged: false,
                visibilityRules: null,
              },
              {
                key: "message",
                label: "Message",
                placeholder: "",
                helpText: "",
                type: FormFieldType.MULTI_LINE_TEXT,
                required: true,
                sortOrder: 2,
                validation: null,
                options: [],
                defaultValue: null,
                isPlatformManaged: false,
                visibilityRules: null,
              },
            ],
          },
        },
      },
    ]);
    prisma.formRoutingRule.findMany.mockResolvedValue([]);

    service = new FormsService(
      prisma as unknown as PrismaService,
      formEmailRendererService as unknown as FormEmailRendererService,
      submissionOperationsService as unknown as SubmissionOperationsService,
      billingService as unknown as BillingService,
    );
  });

  it("normalizes homepage submissions and validates the page in the site scope", async () => {
    prisma.site.findUnique.mockResolvedValue({ id: "site-1" });
    prisma.page.findFirst.mockResolvedValue({ id: "page-1" });
    prisma.formSubmission.create.mockResolvedValue({
      id: "submission-1",
      status: FormSubmissionStatus.RECEIVED,
    });

    await service.createSubmission({
      siteId: "site-1",
      formType: FormType.CONTACT,
      pageSlug: "/",
      locale: "en",
      name: "Guest Example",
      email: "guest@example.com",
      message: "We would like to book a room for two nights.",
    });

    expect(prisma.page.findFirst).toHaveBeenCalledWith({
      where: {
        siteId: "site-1",
        slug: "home",
        locale: "en",
        deletedAt: null,
      },
      select: { id: true },
    });
    expect(prisma.formSubmission.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          pageSlug: "home",
          locale: "en",
        }),
      }),
    );
    expect(billingService.assertCanAcceptInquiry).toHaveBeenCalledWith(
      "site-1",
    );
    expect(
      submissionOperationsService.queueSubmissionDelivery,
    ).toHaveBeenCalledWith("submission-1");
  });

  it("fails closed when the submitted page does not belong to the site", async () => {
    prisma.site.findUnique.mockResolvedValue({ id: "site-1" });
    prisma.page.findFirst.mockResolvedValue(null);

    await expect(
      service.createSubmission({
        siteId: "site-1",
        formType: FormType.CONTACT,
        pageSlug: "contact-us",
        locale: "en",
        name: "Guest Example",
        email: "guest@example.com",
        message: "We would like to book a room for two nights.",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.formSubmission.create).not.toHaveBeenCalled();
  });

  it("stops public submission persistence when the monthly inquiry allowance is exhausted", async () => {
    prisma.site.findUnique.mockResolvedValue({ id: "site-1" });
    prisma.page.findFirst.mockResolvedValue({ id: "page-1" });
    billingService.assertCanAcceptInquiry.mockRejectedValue(
      new ConflictException({
        code: "PLAN_LIMIT_EXCEEDED",
        message: "Monthly inquiry allowance reached",
      }),
    );

    await expect(
      service.createSubmission({
        siteId: "site-1",
        formType: FormType.CONTACT,
        pageSlug: "/",
        locale: "en",
        name: "Guest Example",
        email: "guest@example.com",
        message: "We would like to book a room for two nights.",
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.formSubmission.create).not.toHaveBeenCalled();
  });

  it("prefers the most specific matching routing rule for a submission", async () => {
    prisma.site.findUnique.mockResolvedValue({ id: "site-1" });
    prisma.page.findFirst.mockResolvedValue({ id: "page-1" });
    prisma.formRoutingRule.findMany.mockResolvedValue([
      {
        id: "site-fallback",
        formDefinitionId: null,
        pageSlug: null,
        locale: null,
        priority: 0,
        isActive: true,
      },
      {
        id: "form-only",
        formDefinitionId: "form-1",
        pageSlug: null,
        locale: null,
        priority: 0,
        isActive: true,
      },
      {
        id: "form-page",
        formDefinitionId: "form-1",
        pageSlug: "contact",
        locale: null,
        priority: 0,
        isActive: true,
      },
      {
        id: "form-page-locale",
        formDefinitionId: "form-1",
        pageSlug: "contact",
        locale: "en",
        priority: 0,
        isActive: true,
      },
    ]);
    prisma.formSubmission.create.mockResolvedValue({
      id: "submission-2",
      status: FormSubmissionStatus.RECEIVED,
    });

    await service.createSubmission({
      siteId: "site-1",
      formType: FormType.CONTACT,
      pageSlug: "contact",
      locale: "en",
      name: "Guest Example",
      email: "guest@example.com",
      message: "We would like to book a room for two nights.",
    });

    expect(prisma.formSubmission.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          routingRuleId: "form-page-locale",
        }),
      }),
    );
  });

  it("hides submissions from routing rules that disable inbox storage", async () => {
    prisma.formSubmission.findMany.mockResolvedValue([]);
    prisma.formSubmission.count.mockResolvedValue(0);

    await expect(service.listForSite("site-1", {})).resolves.toEqual({
      data: [],
      total: 0,
      page: 1,
      limit: 50,
    });

    const expectedWhere = {
      siteId: "site-1",
      status: { not: FormSubmissionStatus.SPAM },
      OR: [
        { routingRuleId: null },
        { routingRule: { is: { saveToInbox: true } } },
      ],
    };

    expect(prisma.formSubmission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expectedWhere,
      }),
    );
    expect(prisma.formSubmission.count).toHaveBeenCalledWith({
      where: expectedWhere,
    });
  });

  it("deactivates removed fallback routing rules instead of deleting them", async () => {
    prisma.site.findUnique.mockResolvedValue({ id: "site-1" });
    prisma.formRoutingRule.findMany
      .mockResolvedValueOnce([
        {
          id: "rule-1",
          siteId: "site-1",
          formDefinitionId: null,
          name: "Keep me",
          pageSlug: null,
          locale: null,
          priority: 0,
          isActive: true,
          saveToInbox: true,
          emailRecipients: ["ops@example.com"],
          webhookUrl: "",
          webhookSecret: "",
          sendConfirmationEmail: false,
          confirmationReplyToFieldKey: "email",
          createdAt: new Date("2026-05-05T10:00:00.000Z"),
        },
        {
          id: "rule-2",
          siteId: "site-1",
          formDefinitionId: null,
          name: "Retire me",
          pageSlug: "contact",
          locale: "en",
          priority: 10,
          isActive: true,
          saveToInbox: false,
          emailRecipients: ["ops@example.com"],
          webhookUrl: "",
          webhookSecret: "",
          sendConfirmationEmail: false,
          confirmationReplyToFieldKey: "email",
          createdAt: new Date("2026-05-05T10:05:00.000Z"),
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "rule-1",
          siteId: "site-1",
          formDefinitionId: null,
          name: "Keep me updated",
          pageSlug: null,
          locale: null,
          priority: 5,
          isActive: true,
          saveToInbox: true,
          emailRecipients: ["sales@example.com"],
          webhookUrl: "",
          webhookSecret: "",
          sendConfirmationEmail: false,
          confirmationReplyToFieldKey: "email",
          createdAt: new Date("2026-05-05T10:00:00.000Z"),
        },
      ]);
    prisma.formRoutingRule.update.mockResolvedValue({ id: "rule-1" });
    prisma.formRoutingRule.updateMany.mockResolvedValue({ count: 1 });

    await expect(
      service.updateSiteRoutingRules("site-1", [
        {
          id: "rule-1",
          name: "Keep me updated",
          priority: 5,
          emailRecipients: ["sales@example.com"],
        },
      ]),
    ).resolves.toEqual([
      expect.objectContaining({
        id: "rule-1",
        name: "Keep me updated",
        priority: 5,
      }),
    ]);

    expect(prisma.formRoutingRule.update).toHaveBeenCalledWith({
      where: { id: "rule-1" },
      data: expect.objectContaining({
        name: "Keep me updated",
        priority: 5,
        saveToInbox: true,
        emailRecipients: ["sales@example.com"],
      }),
    });
    expect(prisma.formRoutingRule.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["rule-2"] } },
      data: { isActive: false },
    });
  });

  it("preserves stored integration secrets and never returns them in routing DTOs", async () => {
    prisma.site.findUnique.mockResolvedValue({ id: "site-1" });
    prisma.formRoutingRule.findMany
      .mockResolvedValueOnce([
        {
          id: "rule-1",
          siteId: "site-1",
          formDefinitionId: null,
          name: "Native CRM",
          pageSlug: null,
          locale: null,
          priority: 0,
          isActive: true,
          saveToInbox: true,
          emailRecipients: [],
          integrationProvider: "hubspot",
          integrationConfig: { pipelineId: "0" },
          integrationSecret: "stored-hubspot-token",
          webhookUrl: "",
          webhookSecret: "stored-webhook-secret",
          sendConfirmationEmail: false,
          confirmationReplyToFieldKey: "email",
          createdAt: new Date("2026-05-05T10:00:00.000Z"),
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "rule-1",
          siteId: "site-1",
          formDefinitionId: null,
          name: "Native CRM",
          pageSlug: null,
          locale: null,
          priority: 0,
          isActive: true,
          saveToInbox: true,
          emailRecipients: [],
          integrationProvider: "hubspot",
          integrationConfig: { pipelineId: "0" },
          integrationSecret: "stored-hubspot-token",
          webhookUrl: "",
          webhookSecret: "stored-webhook-secret",
          sendConfirmationEmail: false,
          confirmationReplyToFieldKey: "email",
          createdAt: new Date("2026-05-05T10:00:00.000Z"),
        },
      ]);
    prisma.formRoutingRule.update.mockResolvedValue({ id: "rule-1" });

    await expect(
      service.updateSiteRoutingRules("site-1", [
        {
          id: "rule-1",
          name: "Native CRM",
          integrationProvider: "hubspot",
          integrationConfig: { pipelineId: "0" },
          emailRecipients: [],
        },
      ]),
    ).resolves.toEqual([
      expect.objectContaining({
        id: "rule-1",
        integrationProvider: "hubspot",
        integrationSecret: "",
        integrationSecretConfigured: true,
        webhookSecret: "",
        webhookSecretConfigured: true,
      }),
    ]);

    expect(prisma.formRoutingRule.update).toHaveBeenCalledWith({
      where: { id: "rule-1" },
      data: expect.objectContaining({
        integrationSecret: "stored-hubspot-token",
        webhookSecret: "stored-webhook-secret",
      }),
    });
  });

  it("reports admin totals with spam included in the denominator", async () => {
    prisma.site.findMany.mockResolvedValue([
      {
        id: "site-1",
        name: "Harbor House",
        tenant: { name: "Harbor Group" },
      },
    ]);
    prisma.site.count.mockResolvedValue(1);
    prisma.formSubmission.findMany.mockResolvedValue([
      {
        siteId: "site-1",
        status: FormSubmissionStatus.RECEIVED,
        createdAt: new Date("2026-05-05T10:00:00.000Z"),
      },
      {
        siteId: "site-1",
        status: FormSubmissionStatus.SPAM,
        createdAt: new Date("2026-05-05T09:00:00.000Z"),
      },
      {
        siteId: "site-1",
        status: FormSubmissionStatus.REVIEWED,
        createdAt: new Date("2026-05-05T08:00:00.000Z"),
      },
    ]);
    prisma.formDelivery.findMany.mockResolvedValue([
      {
        siteId: "site-1",
        status: FormDeliveryStatus.FAILED,
        errorMessage: "SMTP inquiry delivery is not configured",
        lastAttemptAt: new Date("2026-05-05T10:05:00.000Z"),
        updatedAt: new Date("2026-05-05T10:05:00.000Z"),
      },
      {
        siteId: "site-1",
        status: FormDeliveryStatus.PENDING,
        errorMessage: null,
        lastAttemptAt: null,
        updatedAt: new Date("2026-05-05T10:06:00.000Z"),
      },
    ]);
    prisma.operationalAlert.findMany.mockResolvedValue([
      {
        siteId: "site-1",
        type: OperationalAlertType.FORM_DELIVERY_FAILURE,
        message: "SMTP inquiry delivery is not configured",
      },
      {
        siteId: "site-1",
        type: OperationalAlertType.SUBMISSION_SPIKE,
        message: "12 non-spam inquiries arrived in the last hour",
      },
    ]);

    await expect(service.getAdminSummary({})).resolves.toEqual({
      data: [
        {
          siteId: "site-1",
          siteName: "Harbor House",
          tenantName: "Harbor Group",
          totalSubmissions: 3,
          nonSpamSubmissions: 2,
          spamCount: 1,
          unreadCount: 1,
          failedDeliveryCount: 1,
          pendingDeliveryCount: 1,
          lastDeliveryFailureAt: "2026-05-05T10:05:00.000Z",
          lastDeliveryError: "SMTP inquiry delivery is not configured",
          openDeliveryAlert: true,
          deliveryAlertMessage: "SMTP inquiry delivery is not configured",
          openSpikeAlert: true,
          spikeAlertMessage: "12 non-spam inquiries arrived in the last hour",
          lastSubmittedAt: "2026-05-05T10:00:00.000Z",
        },
      ],
      total: 1,
    });
  });

  // ── Required coverage: "form submission routing" — honeypot/spam path ─────────
  it("marks the submission as SPAM when the honeypot trap field is non-empty", async () => {
    prisma.site.findUnique.mockResolvedValue({ id: "site-1" });
    prisma.formSubmission.create.mockResolvedValue({
      id: "spam-sub-1",
      status: FormSubmissionStatus.SPAM,
    });

    const result = await service.createSubmission({
      siteId: "site-1",
      formType: FormType.CONTACT,
      locale: "en",
      name: "SpamBot",
      email: "bot@spam.invalid",
      message: "Buy cheap watches now",
      _trap: "I am a robot",
    });

    expect(prisma.formSubmission.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: FormSubmissionStatus.SPAM,
          spamScore: 1.0,
        }),
      }),
    );
    // Delivery queue is still called — the operations service decides not to
    // send spam; this keeps the interface consistent for audit purposes.
    expect(
      submissionOperationsService.queueSubmissionDelivery,
    ).toHaveBeenCalledWith("spam-sub-1");
    expect(result).toEqual({
      id: "spam-sub-1",
      status: FormSubmissionStatus.SPAM,
    });
  });
});
