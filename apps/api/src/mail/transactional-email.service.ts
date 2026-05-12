import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import nodemailer, { type Transporter } from "nodemailer";

export interface SendTransactionalEmailInput {
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
  from?: string;
}

@Injectable()
export class TransactionalEmailService {
  private mailTransport: Transporter | null | undefined;

  constructor(private readonly configService: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.getMailTransport() && this.resolveFromAddress());
  }

  async send(
    input: SendTransactionalEmailInput,
  ): Promise<{ messageId: string }> {
    const transport = this.getMailTransport();
    const from = input.from ?? this.resolveFromAddress();

    if (!transport || !from) {
      throw new ServiceUnavailableException({
        code: "SMTP_NOT_CONFIGURED",
        message: "SMTP email delivery is not configured",
      });
    }

    const info = await transport.sendMail({
      from,
      to: input.to,
      replyTo: input.replyTo,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });

    return { messageId: info.messageId };
  }

  private resolveFromAddress(): string | null {
    return (
      this.configService.get<string>("TRANSACTIONAL_EMAIL_FROM")?.trim() ||
      this.configService.get<string>("INQUIRY_EMAIL_FROM")?.trim() ||
      this.configService.get<string>("SMTP_USER")?.trim() ||
      null
    );
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
