import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import nodemailer, { type Transporter } from "nodemailer";
import { CreatePublicContactInquiryDto } from "./dto/create-public-contact-inquiry.dto";

@Injectable()
export class PublicContactService {
  private mailTransport: Transporter | null | undefined;

  constructor(private readonly configService: ConfigService) {}

  async submitInquiry(dto: CreatePublicContactInquiryDto) {
    if (dto.website?.trim()) {
      return { accepted: true };
    }

    const transport = this.getMailTransport();
    const to = this.resolveInbox();
    const from = this.resolveFromAddress();

    if (!transport || !to || !from) {
      throw new ServiceUnavailableException({
        code: "MARKETING_CONTACT_NOT_CONFIGURED",
        message: "Marketing contact delivery is not configured",
      });
    }

    const subject = this.buildSubject(dto);
    const text = this.buildText(dto);
    const html = this.buildHtml(dto);
    const info = await transport.sendMail({
      from,
      to,
      replyTo: dto.email.trim(),
      subject,
      text,
      html,
    });

    return {
      accepted: true,
      messageId: info.messageId,
    };
  }

  private buildSubject(dto: CreatePublicContactInquiryDto) {
    const planLabel = dto.planInterest
      ? ` · ${this.humanizePlanInterest(dto.planInterest)}`
      : "";

    return `StayLayer sales inquiry · ${dto.companyName.trim()}${planLabel}`;
  }

  private buildText(dto: CreatePublicContactInquiryDto) {
    const lines = [
      "New StayLayer marketing inquiry",
      "",
      `Name: ${dto.name.trim()}`,
      `Email: ${dto.email.trim()}`,
      `Company: ${dto.companyName.trim()}`,
      `Plan interest: ${this.humanizePlanInterest(dto.planInterest)}`,
      "",
      "Message:",
      dto.message.trim(),
    ];

    return lines.join("\n");
  }

  private buildHtml(dto: CreatePublicContactInquiryDto) {
    const message = this.escapeHtml(dto.message.trim()).replace(
      /\n/g,
      "<br />",
    );

    return [
      "<!doctype html>",
      '<html><body style="margin:0;padding:24px;background:#f7f2eb;font-family:Arial,sans-serif;color:#102a36;">',
      '<div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:20px;padding:32px;border:1px solid rgba(26,72,112,0.12);">',
      '<p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#E07038;">New inquiry</p>',
      '<h1 style="margin:0 0 20px;font-size:28px;line-height:1.2;color:#0D2840;">StayLayer sales inquiry</h1>',
      '<table role="presentation" width="100%" style="border-collapse:collapse;">',
      `<tr><td style="padding:10px 0;font-weight:700;vertical-align:top;min-width:140px;">Name</td><td style="padding:10px 0;">${this.escapeHtml(dto.name.trim())}</td></tr>`,
      `<tr><td style="padding:10px 0;font-weight:700;vertical-align:top;min-width:140px;">Email</td><td style="padding:10px 0;">${this.escapeHtml(dto.email.trim())}</td></tr>`,
      `<tr><td style="padding:10px 0;font-weight:700;vertical-align:top;min-width:140px;">Company</td><td style="padding:10px 0;">${this.escapeHtml(dto.companyName.trim())}</td></tr>`,
      `<tr><td style="padding:10px 0;font-weight:700;vertical-align:top;min-width:140px;">Plan interest</td><td style="padding:10px 0;">${this.escapeHtml(this.humanizePlanInterest(dto.planInterest))}</td></tr>`,
      "</table>",
      '<div style="margin-top:24px;padding:20px;border-radius:16px;background:#faf7f3;border:1px solid rgba(26,72,112,0.08);">',
      '<p style="margin:0 0 10px;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#1A4870;">Message</p>',
      `<p style="margin:0;font-size:15px;line-height:1.7;color:#102a36;">${message}</p>`,
      "</div>",
      "</div></body></html>",
    ].join("");
  }

  private humanizePlanInterest(value?: string) {
    switch (value) {
      case "free":
        return "Free";
      case "starter_stay":
        return "Starter Stay";
      case "boutique_growth":
        return "Boutique Growth";
      case "portfolio":
        return "Portfolio";
      case "custom":
        return "Custom";
      default:
        return "Not specified";
    }
  }

  private resolveInbox() {
    return (
      this.configService.get<string>("MARKETING_CONTACT_EMAIL")?.trim() ||
      this.configService.get<string>("SMTP_USER")?.trim() ||
      null
    );
  }

  private resolveFromAddress() {
    const smtpUser = this.configService.get<string>("SMTP_USER")?.trim();
    const configuredFrom = this.configService
      .get<string>("INQUIRY_EMAIL_FROM")
      ?.trim();

    return smtpUser || configuredFrom || this.resolveInbox();
  }

  private escapeHtml(value: string) {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  private getMailTransport() {
    if (this.mailTransport !== undefined) {
      return this.mailTransport;
    }

    const host = this.configService.get<string>("SMTP_HOST")?.trim();
    const port = Number(this.configService.get<string>("SMTP_PORT") ?? "587");
    const user = this.configService.get<string>("SMTP_USER")?.trim();
    const pass = this.configService.get<string>("SMTP_PASS")?.trim();

    if (!host || !Number.isFinite(port)) {
      this.mailTransport = null;
      return this.mailTransport;
    }

    this.mailTransport = nodemailer.createTransport({
      host,
      port,
      secure:
        String(this.configService.get<string>("SMTP_SECURE") ?? "false") ===
        "true",
      auth: user && pass ? { user, pass } : undefined,
    });

    return this.mailTransport;
  }
}
