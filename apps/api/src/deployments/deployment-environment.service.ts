import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  DeploymentEnvironmentVariableType,
  DomainStatus,
} from "@prisma/client";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import {
  buildOperatorManagedEnvironmentContract,
  OPERATOR_MANAGED_ENVIRONMENT_DESCRIPTIONS,
  OPERATOR_MANAGED_ENVIRONMENT_KEYS,
} from "./deployment-environment.contract";
import {
  DeploymentProviderEnvironment,
  SiteDeploymentContext,
} from "./deployment-provider.port";

const MAX_CUSTOMER_ENVIRONMENT_VARIABLES = 30;
const ENVIRONMENT_KEY_PATTERN = /^[A-Z][A-Z0-9_]{1,63}$/;

export type SiteDeploymentEnvironmentVariableDto = {
  id: string;
  key: string;
  type: "plain" | "encrypted";
  description: string | null;
  targets: string[];
  editable: boolean;
  source: "customer" | "operator";
  isValueSet: boolean;
  value: string | null;
  valuePreview: string | null;
  updatedAt: string | null;
};

export type SiteDeploymentEnvironmentCatalog = {
  customerEditable: SiteDeploymentEnvironmentVariableDto[];
  operatorManaged: SiteDeploymentEnvironmentVariableDto[];
};

type SiteContextRecord = {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  primaryLocale: string;
  enabledLocales: string[];
  settings: {
    siteName: string;
  } | null;
  domains: Array<{
    host: string;
  }>;
};

@Injectable()
export class DeploymentEnvironmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async listForSite(siteId: string): Promise<SiteDeploymentEnvironmentCatalog> {
    const [site, rows] = await Promise.all([
      this.getSiteContext(siteId),
      this.prisma.siteDeploymentEnvironmentVariable.findMany({
        where: { siteId },
        orderBy: { key: "asc" },
      }),
    ]);

    return {
      customerEditable: rows.map((row) => this.toCustomerDto(row)),
      operatorManaged: this.buildOperatorManagedDtos(this.toSiteContext(site)),
    };
  }

  async upsertCustomerVariable(
    siteId: string,
    input: {
      key: string;
      value: string;
      type: "plain" | "encrypted";
      description?: string;
    },
    actorUserId?: string | null,
  ): Promise<SiteDeploymentEnvironmentVariableDto> {
    const key = input.key.trim().toUpperCase();
    this.assertCustomerKeyAllowed(key);
    this.assertCustomerValueAllowed(input.value);

    const existing =
      await this.prisma.siteDeploymentEnvironmentVariable.findUnique({
        where: {
          siteId_key: {
            siteId,
            key,
          },
        },
      });

    if (!existing) {
      const count = await this.prisma.siteDeploymentEnvironmentVariable.count({
        where: { siteId },
      });

      if (count >= MAX_CUSTOMER_ENVIRONMENT_VARIABLES) {
        throw new BadRequestException({
          code: "ENVIRONMENT_VARIABLE_LIMIT",
          message: `A site may have at most ${MAX_CUSTOMER_ENVIRONMENT_VARIABLES} customer-managed environment variables`,
        });
      }
    }

    const encryptedValue = this.encryptValue(input.value);
    const variable = await this.prisma.siteDeploymentEnvironmentVariable.upsert(
      {
        where: {
          siteId_key: {
            siteId,
            key,
          },
        },
        create: {
          siteId,
          key,
          type: this.toVariableType(input.type),
          description: input.description?.trim() ?? "",
          targets: ["production"],
          encryptedValue: encryptedValue.encryptedValue,
          initializationVector: encryptedValue.initializationVector,
          authTag: encryptedValue.authTag,
          updatedBy: actorUserId ?? null,
        },
        update: {
          type: this.toVariableType(input.type),
          description: input.description?.trim() ?? "",
          targets: ["production"],
          encryptedValue: encryptedValue.encryptedValue,
          initializationVector: encryptedValue.initializationVector,
          authTag: encryptedValue.authTag,
          updatedBy: actorUserId ?? null,
        },
      },
    );

    return this.toCustomerDto(variable);
  }

  async removeCustomerVariable(
    siteId: string,
    variableId: string,
  ): Promise<void> {
    const variable =
      await this.prisma.siteDeploymentEnvironmentVariable.findUnique({
        where: { id: variableId },
        select: {
          id: true,
          siteId: true,
        },
      });

    if (!variable || variable.siteId !== siteId) {
      throw new NotFoundException({
        code: "ENVIRONMENT_VARIABLE_NOT_FOUND",
        message: "Environment variable not found in this site",
      });
    }

    await this.prisma.siteDeploymentEnvironmentVariable.delete({
      where: { id: variableId },
    });
  }

  async listCustomerEnvironmentEntries(
    siteId: string,
  ): Promise<DeploymentProviderEnvironment[]> {
    const rows = await this.prisma.siteDeploymentEnvironmentVariable.findMany({
      where: { siteId },
      orderBy: { key: "asc" },
    });

    return rows.map((row) => ({
      key: row.key,
      value: this.decryptValue(row),
      type:
        row.type === DeploymentEnvironmentVariableType.ENCRYPTED
          ? "encrypted"
          : "plain",
      target: row.targets,
      comment: row.description.trim() || undefined,
    }));
  }

  private async getSiteContext(siteId: string): Promise<SiteContextRecord> {
    const site = await this.prisma.site.findUnique({
      where: { id: siteId },
      select: {
        id: true,
        tenantId: true,
        name: true,
        slug: true,
        primaryLocale: true,
        enabledLocales: true,
        settings: {
          select: {
            siteName: true,
          },
        },
        domains: {
          where: {
            isPrimary: true,
            status: DomainStatus.ACTIVE,
          },
          select: {
            host: true,
          },
          take: 1,
        },
      },
    });

    if (!site) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Site not found",
      });
    }

    return site;
  }

  private toSiteContext(site: SiteContextRecord): SiteDeploymentContext {
    return {
      siteId: site.id,
      siteSlug: this.normalizeSiteSlug(site.slug, site.name),
      siteName: site.settings?.siteName || site.name,
      tenantId: site.tenantId,
      primaryLocale: site.primaryLocale,
      enabledLocales: this.normalizeLocales(
        site.enabledLocales,
        site.primaryLocale,
      ),
      primaryDomain: site.domains[0]?.host ?? null,
    };
  }

  private buildOperatorManagedDtos(
    site: SiteDeploymentContext,
  ): SiteDeploymentEnvironmentVariableDto[] {
    const entries = buildOperatorManagedEnvironmentContract({
      site,
      cmsApiUrl: this.getRequiredRuntimeConfig("DEPLOYMENTS_CMS_API_URL"),
      revalidateSecret: this.getRequiredRuntimeConfig(
        "DEPLOYMENTS_REVALIDATE_SECRET",
      ),
    });

    return entries.map((entry) => ({
      id: `operator:${entry.key}`,
      key: entry.key,
      type: entry.type ?? "plain",
      description: OPERATOR_MANAGED_ENVIRONMENT_DESCRIPTIONS[entry.key] ?? null,
      targets: entry.target ?? ["production"],
      editable: false,
      source: "operator",
      isValueSet: true,
      value: entry.type === "encrypted" ? null : entry.value,
      valuePreview:
        entry.type === "encrypted"
          ? "Stored securely by the platform"
          : entry.value,
      updatedAt: null,
    }));
  }

  private toCustomerDto(row: {
    id: string;
    key: string;
    type: DeploymentEnvironmentVariableType;
    description: string;
    targets: string[];
    encryptedValue: string;
    initializationVector: string;
    authTag: string;
    updatedAt: Date;
  }): SiteDeploymentEnvironmentVariableDto {
    const decryptedValue = this.decryptValue(row);
    const isPlain = row.type === DeploymentEnvironmentVariableType.PLAIN;

    return {
      id: row.id,
      key: row.key,
      type: isPlain ? "plain" : "encrypted",
      description: row.description.trim() || null,
      targets: row.targets,
      editable: true,
      source: "customer",
      isValueSet: true,
      value: isPlain ? decryptedValue : null,
      valuePreview: isPlain ? decryptedValue : "Stored securely",
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private assertCustomerKeyAllowed(key: string): void {
    if (!ENVIRONMENT_KEY_PATTERN.test(key)) {
      throw new BadRequestException({
        code: "INVALID_ENVIRONMENT_KEY",
        message:
          "Environment variable keys must start with a letter and use only uppercase letters, numbers, or underscores",
      });
    }

    if (OPERATOR_MANAGED_ENVIRONMENT_KEYS.has(key)) {
      throw new ConflictException({
        code: "ENVIRONMENT_KEY_RESERVED",
        message: `${key} is operator-managed and cannot be overridden by customers`,
      });
    }

    if (key.startsWith("VERCEL_")) {
      throw new BadRequestException({
        code: "ENVIRONMENT_KEY_PROVIDER_RESERVED",
        message:
          "Provider-reserved environment variable prefixes are not allowed",
      });
    }
  }

  private assertCustomerValueAllowed(value: string): void {
    if (value.length === 0) {
      throw new BadRequestException({
        code: "INVALID_ENVIRONMENT_VALUE",
        message: "Environment variable values cannot be empty",
      });
    }

    if (value.length > 4000) {
      throw new BadRequestException({
        code: "ENVIRONMENT_VALUE_TOO_LONG",
        message: "Environment variable values must be 4000 characters or fewer",
      });
    }
  }

  private toVariableType(type: "plain" | "encrypted") {
    return type === "encrypted"
      ? DeploymentEnvironmentVariableType.ENCRYPTED
      : DeploymentEnvironmentVariableType.PLAIN;
  }

  private encryptValue(value: string): {
    encryptedValue: string;
    initializationVector: string;
    authTag: string;
  } {
    const initializationVector = randomBytes(12);
    const cipher = createCipheriv(
      "aes-256-gcm",
      this.getEncryptionKey(),
      initializationVector,
    );
    const encryptedValue = Buffer.concat([
      cipher.update(value, "utf8"),
      cipher.final(),
    ]);

    return {
      encryptedValue: encryptedValue.toString("base64"),
      initializationVector: initializationVector.toString("base64"),
      authTag: cipher.getAuthTag().toString("base64"),
    };
  }

  private decryptValue(row: {
    encryptedValue: string;
    initializationVector: string;
    authTag: string;
  }): string {
    try {
      const decipher = createDecipheriv(
        "aes-256-gcm",
        this.getEncryptionKey(),
        Buffer.from(row.initializationVector, "base64"),
      );
      decipher.setAuthTag(Buffer.from(row.authTag, "base64"));

      return Buffer.concat([
        decipher.update(Buffer.from(row.encryptedValue, "base64")),
        decipher.final(),
      ]).toString("utf8");
    } catch {
      throw new InternalServerErrorException({
        code: "ENVIRONMENT_DECRYPTION_FAILED",
        message:
          "Stored environment variables could not be decrypted with the current configuration",
      });
    }
  }

  private getEncryptionKey(): Buffer {
    const value = this.configService
      .get<string>("DEPLOYMENTS_ENV_ENCRYPTION_KEY")
      ?.trim();

    if (!value) {
      throw new InternalServerErrorException({
        code: "MISSING_ENVIRONMENT_ENCRYPTION_KEY",
        message:
          "DEPLOYMENTS_ENV_ENCRYPTION_KEY must be configured for site environment management",
      });
    }

    return createHash("sha256").update(value).digest();
  }

  private getRequiredRuntimeConfig(key: string): string {
    const value = this.configService.get<string>(key)?.trim();

    if (!value) {
      throw new InternalServerErrorException({
        code: "MISSING_DEPLOYMENT_RUNTIME_CONFIG",
        message: `${key} must be configured for dedicated site deployments`,
      });
    }

    return value;
  }

  private normalizeSiteSlug(slug: string, fallbackName: string): string {
    const normalized = `${slug || fallbackName}`
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    return normalized || "site";
  }

  private normalizeLocales(locales: string[], primaryLocale: string): string[] {
    const normalized = Array.from(
      new Set([primaryLocale, ...locales].filter((value) => !!value)),
    );

    return normalized.length > 0 ? normalized : [primaryLocale];
  }
}
