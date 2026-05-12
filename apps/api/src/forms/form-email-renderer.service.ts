import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { FormEmailTemplateType, Prisma } from "@prisma/client";
import { type Transporter } from "nodemailer";
import { buildSmtpTransport } from "../mail/smtp-transport";
import { PrismaService } from "../prisma/prisma.service";
import {
  PreviewFormEmailDto,
  SendTestFormEmailDto,
} from "./dto/preview-form-email.dto";
import { UpdateFormEmailStudioDto } from "./dto/update-form-email-studio.dto";

type JsonRecord = Record<string, unknown>;

type RenderContext = {
  siteName: string;
  brandName: string;
  formName: string;
  pageSlug: string | null;
  locale: string;
  submittedAtIso: string;
  payload: JsonRecord;
  fieldDefinitions?: Array<{ key: string; label: string }>;
};

type TemplateBundle = {
  theme: {
    id: string;
    brandName: string;
    logoUrl: string;
    primaryColor: string;
    accentColor: string;
    surfaceColor: string;
    textColor: string;
    typographyFamily: string;
    buttonStyle: Prisma.JsonValue | null;
    cardStyle: Prisma.JsonValue | null;
    headerContent: Prisma.JsonValue | null;
    footerContent: Prisma.JsonValue | null;
  };
  template: {
    id: string;
    templateType: FormEmailTemplateType;
    name: string;
    enabled: boolean;
    subjectTemplate: string;
    previewText: string;
    blocks: Prisma.JsonValue;
    fieldOrder: string[];
  };
  siteName: string;
  formName: string;
};

const DEFAULT_INTERNAL_BLOCKS = [
  { type: "brand_header", title: "New form submission" },
  {
    type: "rich_text",
    text: "A new {{formName}} submission arrived for {{siteName}}.",
  },
  { type: "field_list", title: "Submitted fields" },
  { type: "footer", text: "Delivered by MyAllocator CMS" },
];

const DEFAULT_GUEST_BLOCKS = [
  { type: "brand_header", title: "Thanks for contacting {{siteName}}" },
  {
    type: "rich_text",
    text: "We received your {{formName}} submission and will reply soon.",
  },
  { type: "field_list", title: "Your submission" },
  {
    type: "footer",
    text: "This is an automated confirmation from {{siteName}}.",
  },
];

@Injectable()
export class FormEmailRendererService {
  private mailTransport: Transporter | null | undefined = undefined;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async getStudio(siteId: string) {
    await this.ensureDefaults(siteId);

    const [theme, templates] = await Promise.all([
      this.prisma.formEmailTheme.findUnique({ where: { siteId } }),
      this.prisma.formEmailTemplate.findMany({
        where: { siteId },
        include: {
          formDefinition: {
            select: {
              id: true,
              key: true,
              name: true,
            },
          },
        },
        orderBy: [{ formDefinitionId: "asc" }, { templateType: "asc" }],
      }),
    ]);

    if (!theme) {
      throw new BadRequestException({
        code: "FORM_EMAIL_THEME_NOT_FOUND",
        message: "Form email theme is not configured for this site",
      });
    }

    return {
      theme,
      templates,
    };
  }

  async updateStudio(
    siteId: string,
    dto: UpdateFormEmailStudioDto,
    updatedBy: string | null,
  ) {
    await this.ensureDefaults(siteId);

    await this.prisma.$transaction(async (tx) => {
      if (dto.theme) {
        const existingTheme = await tx.formEmailTheme.findUnique({
          where: { siteId },
        });

        await tx.formEmailTheme.upsert({
          where: { siteId },
          create: {
            siteId,
            brandName: dto.theme.brandName ?? existingTheme?.brandName ?? "",
            logoUrl: dto.theme.logoUrl ?? existingTheme?.logoUrl ?? "",
            primaryColor:
              dto.theme.primaryColor ??
              existingTheme?.primaryColor ??
              "#2563eb",
            accentColor:
              dto.theme.accentColor ?? existingTheme?.accentColor ?? "#0f172a",
            surfaceColor:
              dto.theme.surfaceColor ??
              existingTheme?.surfaceColor ??
              "#ffffff",
            textColor:
              dto.theme.textColor ?? existingTheme?.textColor ?? "#0f172a",
            typographyFamily:
              dto.theme.typographyFamily ??
              existingTheme?.typographyFamily ??
              "Arial",
            buttonStyle:
              (dto.theme.buttonStyle as Prisma.InputJsonValue | undefined) ??
              existingTheme?.buttonStyle ??
              Prisma.JsonNull,
            cardStyle:
              (dto.theme.cardStyle as Prisma.InputJsonValue | undefined) ??
              existingTheme?.cardStyle ??
              Prisma.JsonNull,
            headerContent:
              (dto.theme.headerContent as Prisma.InputJsonValue | undefined) ??
              existingTheme?.headerContent ??
              Prisma.JsonNull,
            footerContent:
              (dto.theme.footerContent as Prisma.InputJsonValue | undefined) ??
              existingTheme?.footerContent ??
              Prisma.JsonNull,
            updatedBy,
          },
          update: {
            brandName: dto.theme.brandName ?? undefined,
            logoUrl: dto.theme.logoUrl ?? undefined,
            primaryColor: dto.theme.primaryColor ?? undefined,
            accentColor: dto.theme.accentColor ?? undefined,
            surfaceColor: dto.theme.surfaceColor ?? undefined,
            textColor: dto.theme.textColor ?? undefined,
            typographyFamily: dto.theme.typographyFamily ?? undefined,
            buttonStyle:
              dto.theme.buttonStyle !== undefined
                ? (dto.theme.buttonStyle as Prisma.InputJsonValue)
                : undefined,
            cardStyle:
              dto.theme.cardStyle !== undefined
                ? (dto.theme.cardStyle as Prisma.InputJsonValue)
                : undefined,
            headerContent:
              dto.theme.headerContent !== undefined
                ? (dto.theme.headerContent as Prisma.InputJsonValue)
                : undefined,
            footerContent:
              dto.theme.footerContent !== undefined
                ? (dto.theme.footerContent as Prisma.InputJsonValue)
                : undefined,
            updatedBy,
          },
        });
      }

      if (dto.templates) {
        for (const template of dto.templates) {
          if (template.id) {
            const existing = await tx.formEmailTemplate.findUnique({
              where: { id: template.id },
            });

            if (!existing || existing.siteId !== siteId) {
              throw new BadRequestException({
                code: "FORM_EMAIL_TEMPLATE_NOT_FOUND",
                message: "Form email template not found in this site",
              });
            }

            await tx.formEmailTemplate.update({
              where: { id: template.id },
              data: {
                formDefinitionId:
                  template.formDefinitionId ?? existing.formDefinitionId,
                templateType: template.templateType,
                name: template.name,
                enabled: template.enabled ?? existing.enabled,
                subjectTemplate: template.subjectTemplate,
                previewText: template.previewText ?? existing.previewText,
                blocks:
                  (template.blocks as Prisma.InputJsonValue | undefined) ??
                  existing.blocks ??
                  Prisma.JsonNull,
                fieldOrder: template.fieldOrder ?? existing.fieldOrder,
              },
            });

            continue;
          }

          await tx.formEmailTemplate.create({
            data: {
              siteId,
              formDefinitionId: template.formDefinitionId ?? null,
              templateType: template.templateType,
              name: template.name,
              enabled: template.enabled ?? true,
              subjectTemplate: template.subjectTemplate,
              previewText: template.previewText ?? "",
              blocks:
                (template.blocks as Prisma.InputJsonValue | undefined) ??
                (this.defaultBlocks(
                  template.templateType,
                ) as Prisma.InputJsonValue),
              fieldOrder: template.fieldOrder ?? [],
            },
          });
        }
      }
    });

    return this.getStudio(siteId);
  }

  async renderPreview(siteId: string, dto: PreviewFormEmailDto) {
    const samplePayload = this.payloadAsRecord(dto.samplePayload ?? {});
    const site = await this.prisma.site.findUnique({
      where: { id: siteId },
      select: {
        name: true,
      },
    });

    if (!site) {
      throw new BadRequestException({
        code: "SITE_NOT_FOUND",
        message: "The referenced site does not exist",
      });
    }

    const bundle = await this.getTemplateBundle(
      siteId,
      dto.formDefinitionId ?? null,
      dto.templateType,
      true,
    );

    return this.renderTemplate(bundle, {
      siteName: site.name,
      brandName: bundle.theme.brandName || site.name,
      formName: bundle.formName,
      pageSlug: "preview",
      locale: "en",
      submittedAtIso: new Date().toISOString(),
      payload: {
        name: "Guest Example",
        email: "guest@example.com",
        message: "We would like more information about availability in June.",
        ...samplePayload,
      },
    });
  }

  async sendTestEmail(siteId: string, dto: SendTestFormEmailDto) {
    const preview = await this.renderPreview(siteId, dto);
    const transport = this.getMailTransport();
    const from = this.configService.get<string>("INQUIRY_EMAIL_FROM")?.trim();

    if (!transport || !from) {
      throw new ServiceUnavailableException({
        code: "SMTP_NOT_CONFIGURED",
        message: "SMTP inquiry delivery is not configured",
      });
    }

    const info = await transport.sendMail({
      from,
      to: dto.recipientEmail,
      subject: preview.subject,
      text: preview.text,
      html: preview.html,
    });

    return {
      accepted: info.accepted,
      rejected: info.rejected,
      messageId: info.messageId,
    };
  }

  async isTemplateEnabled(
    siteId: string,
    formDefinitionId: string | null,
    templateType: FormEmailTemplateType,
  ) {
    const bundle = await this.getTemplateBundle(
      siteId,
      formDefinitionId,
      templateType,
      true,
    );
    return bundle.template.enabled;
  }

  async renderDelivery(params: {
    siteId: string;
    siteName: string;
    formDefinitionId: string | null;
    formName: string;
    templateType: FormEmailTemplateType;
    payload: Prisma.JsonValue;
    pageSlug: string | null;
    locale: string;
    submittedAt: Date;
    fieldDefinitions?: Array<{ key: string; label: string }>;
  }) {
    const bundle = await this.getTemplateBundle(
      params.siteId,
      params.formDefinitionId,
      params.templateType,
      false,
    );

    return this.renderTemplate(bundle, {
      siteName: params.siteName,
      brandName: bundle.theme.brandName || params.siteName,
      formName: params.formName,
      pageSlug: params.pageSlug,
      locale: params.locale,
      submittedAtIso: params.submittedAt.toISOString(),
      payload: this.payloadAsRecord(params.payload),
      fieldDefinitions: params.fieldDefinitions,
    });
  }

  private async ensureDefaults(siteId: string) {
    const site = await this.prisma.site.findUnique({
      where: { id: siteId },
      select: {
        id: true,
        name: true,
        settings: {
          select: {
            siteName: true,
            logoUrl: true,
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

    await this.prisma.formEmailTheme.upsert({
      where: { siteId },
      create: {
        siteId,
        brandName: site.settings?.siteName?.trim() || site.name,
        logoUrl: site.settings?.logoUrl?.trim() || "",
      },
      update: {},
    });

    const existingTemplates = await this.prisma.formEmailTemplate.findMany({
      where: { siteId, formDefinitionId: null },
      select: {
        id: true,
        templateType: true,
      },
    });
    const existingTypes = new Set(
      existingTemplates.map((row) => row.templateType),
    );

    if (!existingTypes.has(FormEmailTemplateType.INTERNAL_NOTIFICATION)) {
      await this.prisma.formEmailTemplate.create({
        data: {
          siteId,
          templateType: FormEmailTemplateType.INTERNAL_NOTIFICATION,
          name: "Default internal notification",
          enabled: true,
          subjectTemplate: "[{{siteName}}] New {{formName}} from {{name}}",
          previewText: "A new inquiry has been submitted.",
          blocks: this.defaultBlocks(
            FormEmailTemplateType.INTERNAL_NOTIFICATION,
          ) as Prisma.InputJsonValue,
          fieldOrder: ["name", "email", "message"],
        },
      });
    }

    if (!existingTypes.has(FormEmailTemplateType.GUEST_CONFIRMATION)) {
      await this.prisma.formEmailTemplate.create({
        data: {
          siteId,
          templateType: FormEmailTemplateType.GUEST_CONFIRMATION,
          name: "Default guest confirmation",
          enabled: false,
          subjectTemplate: "Thanks for contacting {{siteName}}",
          previewText: "We received your message.",
          blocks: this.defaultBlocks(
            FormEmailTemplateType.GUEST_CONFIRMATION,
          ) as Prisma.InputJsonValue,
          fieldOrder: ["name", "message"],
        },
      });
    }
  }

  private async getTemplateBundle(
    siteId: string,
    formDefinitionId: string | null,
    templateType: FormEmailTemplateType,
    allowDisabled: boolean,
  ): Promise<TemplateBundle> {
    await this.ensureDefaults(siteId);

    const [site, theme, template] = await Promise.all([
      this.prisma.site.findUnique({
        where: { id: siteId },
        select: { name: true },
      }),
      this.prisma.formEmailTheme.findUnique({ where: { siteId } }),
      this.prisma.formEmailTemplate.findFirst({
        where: {
          siteId,
          templateType,
          OR: [{ formDefinitionId }, { formDefinitionId: null }],
        },
        orderBy: [
          { formDefinitionId: formDefinitionId ? "desc" : "asc" },
          { updatedAt: "desc" },
        ],
      }),
    ]);

    if (!site || !theme || !template) {
      throw new BadRequestException({
        code: "FORM_EMAIL_TEMPLATE_NOT_FOUND",
        message: "Form email template is not configured for this site",
      });
    }

    if (!allowDisabled && !template.enabled) {
      throw new BadRequestException({
        code: "FORM_EMAIL_TEMPLATE_DISABLED",
        message: "The selected email template is disabled",
      });
    }

    const formDefinition = formDefinitionId
      ? await this.prisma.formDefinition.findUnique({
          where: { id: formDefinitionId },
          select: { name: true },
        })
      : null;

    return {
      theme,
      template,
      siteName: site.name,
      formName: formDefinition?.name ?? "Primary inquiry form",
    };
  }

  private renderTemplate(bundle: TemplateBundle, context: RenderContext) {
    const blocks = this.resolveBlocks(
      bundle.template.blocks,
      bundle.template.templateType,
    );
    const tokens = this.buildTokens(context, bundle.theme);
    const htmlBlocks = blocks
      .map((block) =>
        this.renderBlockHtml(
          block,
          context,
          tokens,
          bundle.template.fieldOrder,
        ),
      )
      .filter(Boolean)
      .join("");
    const textBlocks = blocks
      .map((block) =>
        this.renderBlockText(
          block,
          context,
          tokens,
          bundle.template.fieldOrder,
        ),
      )
      .filter(Boolean)
      .join("\n\n");

    const subject = this.interpolate(bundle.template.subjectTemplate, tokens);
    const previewText = this.interpolate(bundle.template.previewText, tokens);
    const html = [
      "<!doctype html>",
      `<html><body style=\"margin:0;padding:32px 16px;background:${this.escapeHtml(this.withAlpha(bundle.theme.primaryColor, "10"))};font-family:${this.escapeHtml(bundle.theme.typographyFamily)},sans-serif;color:${this.escapeHtml(bundle.theme.textColor)};\">`,
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;"><tr><td align="center">',
      `<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"max-width:680px;border-collapse:separate;background:${this.escapeHtml(bundle.theme.surfaceColor)};border:1px solid ${this.escapeHtml(this.withAlpha(bundle.theme.accentColor, "1f"))};border-radius:28px;overflow:hidden;box-shadow:0 18px 60px ${this.escapeHtml(this.withAlpha(bundle.theme.accentColor, "18"))};\">`,
      `<tr><td style=\"height:8px;line-height:8px;font-size:0;background:${this.escapeHtml(bundle.theme.primaryColor)};\">&nbsp;</td></tr>`,
      '<tr><td style="padding:32px;">',
      previewText
        ? `<div style=\"display:none;max-height:0;overflow:hidden;opacity:0;\">${this.escapeHtml(previewText)}</div>`
        : "",
      htmlBlocks,
      "</td></tr></table>",
      "</td></tr></table></body></html>",
    ]
      .filter(Boolean)
      .join("");

    return {
      subject,
      previewText,
      html,
      text: textBlocks,
      templateId: bundle.template.id,
      themeId: bundle.theme.id,
      enabled: bundle.template.enabled,
    };
  }

  private renderBlockHtml(
    block: JsonRecord,
    context: RenderContext,
    tokens: Record<string, string>,
    fieldOrder: string[],
  ) {
    const type = String(block.type ?? "");

    switch (type) {
      case "brand_header": {
        const title = this.escapeHtml(
          this.interpolate(String(block.title ?? context.formName), tokens),
        );
        const subtitle = String(block.subtitle ?? "");
        const resolvedSubtitle = subtitle
          ? `<p style=\"margin:12px 0 0;color:${this.escapeHtml(tokens.textColor)};font-size:15px;line-height:1.7;opacity:0.84;\">${this.escapeHtml(this.interpolate(subtitle, tokens))}</p>`
          : "";
        const logo =
          context.brandName && tokens.logoUrl
            ? `<img src=\"${this.escapeHtml(tokens.logoUrl)}\" alt=\"${this.escapeHtml(context.brandName)}\" style=\"max-height:44px;max-width:180px;display:block;margin:0 0 20px;\" />`
            : "";
        const badge = `<div style=\"display:inline-block;margin:0 0 14px;padding:6px 12px;border-radius:999px;background:${this.escapeHtml(this.withAlpha(tokens.primaryColor, "16"))};color:${this.escapeHtml(tokens.primaryColor)};font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;\">${this.escapeHtml(context.brandName || context.siteName)}</div>`;
        const summary = this.renderContextSummaryHtml(context, tokens);

        return `${badge}${logo}<h1 style=\"margin:0;font-size:34px;line-height:1.15;letter-spacing:-0.02em;color:${this.escapeHtml(tokens.accentColor)};\">${title}</h1>${resolvedSubtitle}${summary}`;
      }
      case "rich_text":
        return `<p style=\"margin:24px 0 0;font-size:16px;line-height:1.75;color:${this.escapeHtml(tokens.textColor)};\">${this.escapeHtml(this.interpolate(String(block.text ?? ""), tokens))}</p>`;
      case "field_list": {
        const title = block.title
          ? `<div style=\"margin:32px 0 14px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${this.escapeHtml(tokens.primaryColor)};\">${this.escapeHtml(this.interpolate(String(block.title), tokens))}</div>`
          : "";
        const rows = this.renderFieldRows(context, fieldOrder)
          .map(
            (row, index) =>
              `<tr><td style=\"padding:14px 16px;width:34%;font-weight:700;vertical-align:top;color:${this.escapeHtml(tokens.accentColor)};background:${this.escapeHtml(index % 2 === 0 ? this.withAlpha(tokens.primaryColor, "08") : tokens.surfaceColor)};${index > 0 ? `border-top:1px solid ${this.escapeHtml(this.withAlpha(tokens.accentColor, "12"))};` : ""}\">${this.escapeHtml(row.label)}</td><td style=\"padding:14px 16px;color:${this.escapeHtml(tokens.textColor)};background:${this.escapeHtml(index % 2 === 0 ? this.withAlpha(tokens.primaryColor, "04") : tokens.surfaceColor)};${index > 0 ? `border-top:1px solid ${this.escapeHtml(this.withAlpha(tokens.accentColor, "12"))};` : ""}\">${this.escapeHtml(row.value)}</td></tr>`,
          )
          .join("");

        return `${title}<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"border-collapse:separate;border-spacing:0;border:1px solid ${this.escapeHtml(this.withAlpha(tokens.accentColor, "16"))};border-radius:20px;overflow:hidden;background:${this.escapeHtml(tokens.surfaceColor)};\">${rows}</table>`;
      }
      case "cta": {
        const label = this.escapeHtml(
          this.interpolate(String(block.label ?? "Open link"), tokens),
        );
        const url = this.escapeHtml(
          this.interpolate(String(block.url ?? "#"), tokens),
        );
        return `<p style=\"margin:28px 0 0;\"><a href=\"${url}\" style=\"display:inline-block;background:${this.escapeHtml(tokens.primaryColor)};color:#ffffff;text-decoration:none;padding:14px 22px;border-radius:999px;font-weight:700;letter-spacing:0.01em;\">${label}</a></p>`;
      }
      case "footer":
        return `<div style=\"margin:32px 0 0;padding-top:18px;border-top:1px solid ${this.escapeHtml(this.withAlpha(tokens.accentColor, "16"))};font-size:13px;line-height:1.8;color:${this.escapeHtml(tokens.textColor)};opacity:0.72;\">${this.escapeHtml(this.interpolate(String(block.text ?? ""), tokens))}</div>`;
      default:
        return "";
    }
  }

  private renderBlockText(
    block: JsonRecord,
    context: RenderContext,
    tokens: Record<string, string>,
    fieldOrder: string[],
  ) {
    const type = String(block.type ?? "");

    switch (type) {
      case "brand_header": {
        const title = this.interpolate(
          String(block.title ?? context.formName),
          tokens,
        );
        const subtitle = String(block.subtitle ?? "");

        return [
          title,
          subtitle ? this.interpolate(subtitle, tokens) : "",
          `Form: ${context.formName}`,
          context.pageSlug ? `Page: /${context.pageSlug}` : "",
          `Locale: ${context.locale}`,
          `Submitted: ${this.formatSubmittedAt(context.submittedAtIso)}`,
        ]
          .filter(Boolean)
          .join("\n");
      }
      case "rich_text":
        return this.interpolate(String(block.text ?? ""), tokens);
      case "field_list":
        return this.renderFieldRows(context, fieldOrder)
          .map((row) => `${row.label}: ${row.value}`)
          .join("\n");
      case "cta":
        return `${this.interpolate(String(block.label ?? "Open link"), tokens)}: ${this.interpolate(String(block.url ?? "#"), tokens)}`;
      case "footer":
        return this.interpolate(String(block.text ?? ""), tokens);
      default:
        return "";
    }
  }

  private renderFieldRows(context: RenderContext, fieldOrder: string[]) {
    const definitionByKey = new Map(
      (context.fieldDefinitions ?? []).map((field) => [field.key, field.label]),
    );
    const orderedKeys = [
      ...fieldOrder,
      ...Object.keys(context.payload).filter(
        (key) => !fieldOrder.includes(key),
      ),
    ];

    return orderedKeys
      .filter((key, index) => orderedKeys.indexOf(key) === index)
      .map((key) => ({
        label: definitionByKey.get(key) ?? this.humanizeKey(key),
        value: this.stringifyValue(context.payload[key]),
      }))
      .filter((row) => row.value !== "");
  }

  private resolveBlocks(
    blocks: Prisma.JsonValue,
    templateType: FormEmailTemplateType,
  ): JsonRecord[] {
    if (Array.isArray(blocks)) {
      return blocks.filter((block) =>
        Boolean(block && typeof block === "object" && !Array.isArray(block)),
      ) as JsonRecord[];
    }

    return this.defaultBlocks(templateType);
  }

  private defaultBlocks(templateType: FormEmailTemplateType) {
    return templateType === FormEmailTemplateType.GUEST_CONFIRMATION
      ? DEFAULT_GUEST_BLOCKS
      : DEFAULT_INTERNAL_BLOCKS;
  }

  private buildTokens(context: RenderContext, theme: TemplateBundle["theme"]) {
    const payloadTokens = Object.fromEntries(
      Object.entries(context.payload).map(([key, value]) => [
        key,
        this.stringifyValue(value),
      ]),
    );

    return {
      ...payloadTokens,
      siteName: context.siteName,
      brandName: context.brandName,
      formName: context.formName,
      pageSlug: context.pageSlug ?? "",
      locale: context.locale,
      submittedAt: context.submittedAtIso,
      primaryColor: theme.primaryColor || "#2563eb",
      accentColor: theme.accentColor || "#0f172a",
      surfaceColor: theme.surfaceColor || "#ffffff",
      textColor: theme.textColor || "#0f172a",
      logoUrl: theme.logoUrl || "",
    };
  }

  private renderContextSummaryHtml(
    context: RenderContext,
    tokens: Record<string, string>,
  ) {
    const details = [
      { label: "Form", value: context.formName },
      context.pageSlug
        ? { label: "Page", value: `/${context.pageSlug}` }
        : null,
      { label: "Locale", value: context.locale.toUpperCase() },
      {
        label: "Submitted",
        value: this.formatSubmittedAt(context.submittedAtIso),
      },
    ].filter(Boolean) as Array<{ label: string; value: string }>;

    const cells = details
      .map(
        (detail) =>
          `<td style=\"padding:0 10px 10px 0;\"><table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" style=\"border-collapse:separate;\"><tr><td style=\"padding:10px 12px;border:1px solid ${this.escapeHtml(this.withAlpha(tokens.accentColor, "14"))};border-radius:16px;background:${this.escapeHtml(this.withAlpha(tokens.primaryColor, "08"))};\"><div style=\"font-size:10px;line-height:1.4;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${this.escapeHtml(tokens.primaryColor)};\">${this.escapeHtml(detail.label)}</div><div style=\"padding-top:4px;font-size:13px;line-height:1.5;font-weight:600;color:${this.escapeHtml(tokens.textColor)};\">${this.escapeHtml(detail.value)}</div></td></tr></table></td>`,
      )
      .join("");

    return `<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" style=\"border-collapse:collapse;margin-top:24px;\"><tr>${cells}</tr></table>`;
  }

  private formatSubmittedAt(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
  }

  private withAlpha(color: string, alphaHex: string) {
    const trimmed = color.trim();

    if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) {
      return `${trimmed}${alphaHex}`;
    }

    if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
      const expanded = `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`;
      return `${expanded}${alphaHex}`;
    }

    return color;
  }

  private payloadAsRecord(payload: unknown): JsonRecord {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return {};
    }

    return payload as JsonRecord;
  }

  private stringifyValue(value: unknown): string {
    if (value === null || value === undefined) {
      return "";
    }

    if (typeof value === "string") {
      return value;
    }

    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }

    if (Array.isArray(value)) {
      return value
        .map((entry) => this.stringifyValue(entry))
        .filter(Boolean)
        .join(", ");
    }

    if (typeof value === "object") {
      return JSON.stringify(value);
    }

    return String(value);
  }

  private interpolate(template: string, tokens: Record<string, string>) {
    return template.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_, key: string) => {
      return tokens[key] ?? "";
    });
  }

  private escapeHtml(value: string) {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  private humanizeKey(key: string) {
    return key
      .replace(/[_-]+/g, " ")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/^./, (match) => match.toUpperCase());
  }

  private getMailTransport() {
    if (this.mailTransport !== undefined) {
      return this.mailTransport;
    }

    this.mailTransport = buildSmtpTransport(this.configService);

    return this.mailTransport;
  }
}
