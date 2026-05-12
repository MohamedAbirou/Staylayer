/// <reference types="jest" />

import { ConfigService } from "@nestjs/config";
import {
  FormDeliveryChannel,
  FormDeliveryPurpose,
  FormSubmissionStatus,
  FormType,
  OperationalAlertStatus,
  OperationalAlertType,
} from "@prisma/client";
import { FormEmailRendererService } from "./form-email-renderer.service";
import { PrismaService } from "../prisma/prisma.service";
import { SubmissionOperationsService } from "./submission-operations.service";

describe("SubmissionOperationsService", () => {
  let service: SubmissionOperationsService;
  let prisma: {
    formSubmission: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
    };
    formDelivery: {
      findMany: jest.Mock;
      createMany: jest.Mock;
      findFirst: jest.Mock;
      updateMany: jest.Mock;
    };
    operationalAlert: {
      upsert: jest.Mock;
      updateMany: jest.Mock;
      findMany: jest.Mock;
    };
  };
  let formEmailRendererService: {
    isTemplateEnabled: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      formSubmission: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      formDelivery: {
        findMany: jest.fn(),
        createMany: jest.fn(),
        findFirst: jest.fn(),
        updateMany: jest.fn(),
      },
      operationalAlert: {
        upsert: jest.fn(),
        updateMany: jest.fn(),
        findMany: jest.fn(),
      },
    };

    formEmailRendererService = {
      isTemplateEnabled: jest.fn().mockResolvedValue(false),
    };

    service = new SubmissionOperationsService(
      prisma as unknown as PrismaService,
      {
        get: jest.fn(),
      } as unknown as ConfigService,
      formEmailRendererService as unknown as FormEmailRendererService,
    );
  });

  it("creates both email and webhook deliveries when routing is configured", async () => {
    prisma.formSubmission.findUnique.mockResolvedValue({
      id: "submission-1",
      siteId: "site-1",
      formDefinitionId: "form-1",
      formType: FormType.CONTACT,
      status: FormSubmissionStatus.RECEIVED,
      payload: {
        name: "Guest Example",
        email: "guest@example.com",
        message: "Hello",
      },
      routingRule: null,
      site: {
        name: "Harbor House",
        settings: {
          supportEmail: "support@example.com",
          defaultInquiryRoutingEmail: "ops@example.com",
          inquiryWebhookUrl: "https://hooks.example.com/inquiry",
          inquiryWebhookSecret: "secret",
        },
      },
    });
    prisma.formDelivery.findMany.mockResolvedValue([]);

    await service.queueSubmissionDelivery("submission-1");

    expect(prisma.formDelivery.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          submissionId: "submission-1",
          siteId: "site-1",
          purpose: FormDeliveryPurpose.INTERNAL_NOTIFICATION,
          channel: FormDeliveryChannel.EMAIL,
          destination: "ops@example.com",
        }),
        expect.objectContaining({
          submissionId: "submission-1",
          siteId: "site-1",
          purpose: FormDeliveryPurpose.INTERNAL_NOTIFICATION,
          channel: FormDeliveryChannel.EMAIL,
          destination: "support@example.com",
        }),
        expect.objectContaining({
          submissionId: "submission-1",
          siteId: "site-1",
          purpose: FormDeliveryPurpose.WEBHOOK_FORWARD,
          channel: FormDeliveryChannel.WEBHOOK,
          destination: "https://hooks.example.com/inquiry",
        }),
      ]),
    });
  });

  it("creates a guest confirmation delivery when the route and template both allow it", async () => {
    formEmailRendererService.isTemplateEnabled.mockResolvedValue(true);
    prisma.formSubmission.findUnique.mockResolvedValue({
      id: "submission-1",
      siteId: "site-1",
      formDefinitionId: "form-1",
      formType: FormType.CONTACT,
      status: FormSubmissionStatus.RECEIVED,
      payload: {
        name: "Guest Example",
        email: "guest@example.com",
        message: "Hello",
      },
      routingRule: {
        emailRecipients: ["ops@example.com"],
        webhookUrl: "",
        sendConfirmationEmail: true,
        confirmationReplyToFieldKey: "email",
      },
      site: {
        name: "Harbor House",
        settings: {
          supportEmail: "",
          defaultInquiryRoutingEmail: "",
          inquiryWebhookUrl: "",
          inquiryWebhookSecret: "",
        },
      },
    });
    prisma.formDelivery.findMany.mockResolvedValue([]);

    await service.queueSubmissionDelivery("submission-1");

    expect(formEmailRendererService.isTemplateEnabled).toHaveBeenCalledWith(
      "site-1",
      "form-1",
      "GUEST_CONFIRMATION",
    );
    expect(prisma.formDelivery.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          submissionId: "submission-1",
          siteId: "site-1",
          purpose: FormDeliveryPurpose.INTERNAL_NOTIFICATION,
          channel: FormDeliveryChannel.EMAIL,
          destination: "ops@example.com",
        }),
        expect.objectContaining({
          submissionId: "submission-1",
          siteId: "site-1",
          purpose: FormDeliveryPurpose.GUEST_CONFIRMATION,
          channel: FormDeliveryChannel.EMAIL,
          destination: "guest@example.com",
        }),
      ]),
    });
  });

  it("opens a delivery alert when no routing destination exists", async () => {
    prisma.formSubmission.findUnique.mockResolvedValue({
      id: "submission-1",
      siteId: "site-1",
      formDefinitionId: "form-1",
      formType: FormType.CONTACT,
      status: FormSubmissionStatus.RECEIVED,
      payload: {},
      routingRule: null,
      site: {
        name: "Harbor House",
        settings: {
          supportEmail: "",
          defaultInquiryRoutingEmail: "",
          inquiryWebhookUrl: "",
          inquiryWebhookSecret: "",
        },
      },
    });

    await service.queueSubmissionDelivery("submission-1");

    expect(prisma.operationalAlert.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          siteId_type_fingerprint: {
            siteId: "site-1",
            type: OperationalAlertType.FORM_DELIVERY_FAILURE,
            fingerprint: "routing-missing",
          },
        }),
      }),
    );
  });

  it("opens and resolves spike alerts from recent submission volume", async () => {
    const now = new Date("2026-05-05T12:00:00.000Z");
    jest.useFakeTimers().setSystemTime(now);

    prisma.formSubmission.findMany.mockResolvedValue([
      ...Array.from({ length: 12 }, (_, index) => ({
        siteId: "site-1",
        createdAt: new Date(
          `2026-05-05T11:${String(index).padStart(2, "0")}:00.000Z`,
        ),
      })),
    ]);
    prisma.operationalAlert.findMany.mockResolvedValue([{ siteId: "site-2" }]);

    await service.processSpikeAlerts();

    expect(prisma.operationalAlert.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          siteId_type_fingerprint: {
            siteId: "site-1",
            type: OperationalAlertType.SUBMISSION_SPIKE,
            fingerprint: "submission-spike",
          },
        }),
      }),
    );
    expect(prisma.operationalAlert.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          siteId: "site-2",
          type: OperationalAlertType.SUBMISSION_SPIKE,
          fingerprint: "submission-spike",
          status: OperationalAlertStatus.OPEN,
        },
      }),
    );

    jest.useRealTimers();
  });
});
