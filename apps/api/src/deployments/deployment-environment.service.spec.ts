/// <reference types="jest" />

import { ConflictException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DeploymentEnvironmentVariableType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { DeploymentEnvironmentService } from "./deployment-environment.service";

describe("DeploymentEnvironmentService", () => {
  let service: DeploymentEnvironmentService;
  let prisma: {
    site: {
      findUnique: jest.Mock;
    };
    siteDeploymentEnvironmentVariable: {
      count: jest.Mock;
      delete: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      upsert: jest.Mock;
    };
  };

  beforeEach(() => {
    prisma = {
      site: {
        findUnique: jest.fn(),
      },
      siteDeploymentEnvironmentVariable: {
        count: jest.fn().mockResolvedValue(0),
        delete: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn(),
      },
    };

    const configService = {
      get: jest.fn((key: string) => {
        const values: Record<string, string> = {
          DEPLOYMENTS_CMS_API_URL: "https://api.example.com",
          DEPLOYMENTS_REVALIDATE_SECRET: "secret-123",
          DEPLOYMENTS_ENV_ENCRYPTION_KEY: "test-encryption-key",
        };

        return values[key];
      }),
    };

    service = new DeploymentEnvironmentService(
      prisma as unknown as PrismaService,
      configService as unknown as ConfigService,
    );
  });

  it("stores encrypted customer variables and decrypts them for deployment sync", async () => {
    let storedRow: Record<string, unknown> | null = null;

    prisma.siteDeploymentEnvironmentVariable.upsert.mockImplementation(
      async ({ create }: { create: Record<string, unknown> }) => {
        storedRow = {
          id: "env_1",
          key: create.key,
          type: create.type,
          description: create.description,
          targets: create.targets,
          encryptedValue: create.encryptedValue,
          initializationVector: create.initializationVector,
          authTag: create.authTag,
          updatedAt: new Date("2026-05-07T11:00:00.000Z"),
        };

        return storedRow;
      },
    );

    const result = await service.upsertCustomerVariable("site-1", {
      key: "BOOKING_API_KEY",
      value: "booking-secret",
      type: "encrypted",
      description: "Booking integration secret",
    });

    expect(result).toMatchObject({
      key: "BOOKING_API_KEY",
      type: "encrypted",
      value: null,
      valuePreview: "Stored securely",
    });

    prisma.siteDeploymentEnvironmentVariable.findMany.mockResolvedValue([
      storedRow,
    ]);

    await expect(
      service.listCustomerEnvironmentEntries("site-1"),
    ).resolves.toEqual([
      {
        key: "BOOKING_API_KEY",
        value: "booking-secret",
        type: "encrypted",
        target: ["production"],
        comment: "Booking integration secret",
      },
    ]);
  });

  it("separates operator-managed variables from customer-editable ones", async () => {
    prisma.site.findUnique.mockResolvedValue({
      id: "site-1",
      tenantId: "tenant-1",
      name: "Harbor House",
      slug: "harbor-house",
      primaryLocale: "en",
      enabledLocales: ["en", "fr"],
      settings: { siteName: "Harbor House" },
      domains: [{ host: "stay.harborhouse.example" }],
    });
    prisma.siteDeploymentEnvironmentVariable.findMany.mockResolvedValue([
      {
        id: "env_plain",
        key: "NEXT_PUBLIC_BOOKING_WIDGET_ID",
        type: DeploymentEnvironmentVariableType.PLAIN,
        description: "Widget id",
        targets: ["production"],
        encryptedValue: "",
        initializationVector: "",
        authTag: "",
        updatedAt: new Date("2026-05-07T11:05:00.000Z"),
      },
    ]);

    jest
      .spyOn(service as any, "decryptValue")
      .mockImplementation(() => "widget_123");

    const catalog = await service.listForSite("site-1");

    expect(catalog.customerEditable).toEqual([
      expect.objectContaining({
        key: "NEXT_PUBLIC_BOOKING_WIDGET_ID",
        value: "widget_123",
        editable: true,
        source: "customer",
      }),
    ]);
    expect(catalog.operatorManaged).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "SITE_ID",
          editable: false,
          source: "operator",
        }),
        expect.objectContaining({
          key: "REVALIDATE_SECRET",
          type: "encrypted",
          value: null,
        }),
      ]),
    );
  });

  it("rejects operator-managed keys for customer overrides", async () => {
    await expect(
      service.upsertCustomerVariable("site-1", {
        key: "SITE_ID",
        value: "override",
        type: "plain",
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
