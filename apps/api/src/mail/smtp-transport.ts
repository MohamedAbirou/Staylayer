import dns from "node:dns";
import { ConfigService } from "@nestjs/config";
import nodemailer, { type Transporter } from "nodemailer";
import SMTPTransport from "nodemailer/lib/smtp-transport";

function resolveSmtpDnsResultOrder(
  configService: ConfigService,
): "ipv4first" | "verbatim" {
  const configuredOrder =
    configService.get<string>("SMTP_DNS_RESULT_ORDER")?.trim().toLowerCase() ??
    "ipv4first";

  return configuredOrder === "verbatim" ? "verbatim" : "ipv4first";
}

export function buildSmtpTransport(
  configService: ConfigService,
): Transporter | null {
  dns.setDefaultResultOrder(resolveSmtpDnsResultOrder(configService));

  const host = configService.get<string>("SMTP_HOST")?.trim();
  const port = Number(configService.get<string>("SMTP_PORT") ?? "587");
  const user = configService.get<string>("SMTP_USER")?.trim();
  const pass = configService.get<string>("SMTP_PASS")?.trim();

  if (!host || !Number.isFinite(port)) {
    return null;
  }

  const options: SMTPTransport.Options = {
    host,
    port,
    secure:
      String(configService.get<string>("SMTP_SECURE") ?? "false") === "true",
    auth: user && pass ? { user, pass } : undefined,
  };

  return nodemailer.createTransport(options);
}
