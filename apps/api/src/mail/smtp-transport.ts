import dns from "node:dns/promises";
import net from "node:net";
import { ConfigService } from "@nestjs/config";
import nodemailer, { type Transporter } from "nodemailer";
import SMTPTransport from "nodemailer/lib/smtp-transport";

type SmtpTransportCandidate = {
  host: string;
  port: number;
  secure: boolean;
  requireTLS?: boolean;
};

function resolveSmtpDnsResultOrder(
  configService: ConfigService,
): "ipv4first" | "verbatim" {
  const configuredOrder =
    configService.get<string>("SMTP_DNS_RESULT_ORDER")?.trim().toLowerCase() ??
    "ipv4first";

  return configuredOrder === "verbatim" ? "verbatim" : "ipv4first";
}

function getBooleanEnv(configService: ConfigService, key: string) {
  return configService.get<string>(key)?.trim().toLowerCase() === "true";
}

function getOptionalNumberEnv(configService: ConfigService, key: string) {
  const rawValue = configService.get<string>(key)?.trim();

  if (!rawValue) {
    return null;
  }

  const parsedValue = Number(rawValue);
  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function buildSmtpCandidates(
  configService: ConfigService,
  primary: SmtpTransportCandidate,
): SmtpTransportCandidate[] {
  const candidates: SmtpTransportCandidate[] = [primary];
  const fallbackPort = getOptionalNumberEnv(
    configService,
    "SMTP_FALLBACK_PORT",
  );

  if (fallbackPort && fallbackPort !== primary.port) {
    candidates.push({
      host: primary.host,
      port: fallbackPort,
      secure: getBooleanEnv(configService, "SMTP_FALLBACK_SECURE"),
      requireTLS: getBooleanEnv(configService, "SMTP_FALLBACK_REQUIRE_TLS"),
    });
  } else if (
    primary.host === "smtp.gmail.com" &&
    primary.port === 465 &&
    primary.secure
  ) {
    candidates.push({
      host: primary.host,
      port: 587,
      secure: false,
      requireTLS: true,
    });
  }

  return candidates;
}

async function resolveTransportHost(
  host: string,
  dnsResultOrder: "ipv4first" | "verbatim",
) {
  if (dnsResultOrder !== "ipv4first" || net.isIP(host)) {
    return { connectHost: host, servername: net.isIP(host) ? undefined : host };
  }

  try {
    const addresses = await dns.resolve4(host);

    if (addresses.length > 0) {
      return { connectHost: addresses[0], servername: host };
    }
  } catch {
    // Fall back to the hostname so the underlying transport can make one last attempt.
  }

  return { connectHost: host, servername: host };
}

function shouldTryNextCandidate(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const code = (error as NodeJS.ErrnoException).code;
  return [
    "ETIMEDOUT",
    "ESOCKET",
    "ECONNREFUSED",
    "EHOSTUNREACH",
    "ENETUNREACH",
    "ECONNRESET",
  ].includes(code ?? "");
}

async function buildTransportOptions(
  candidate: SmtpTransportCandidate,
  configService: ConfigService,
): Promise<SMTPTransport.Options> {
  const user = configService.get<string>("SMTP_USER")?.trim();
  const pass = configService.get<string>("SMTP_PASS")?.trim();
  const connectionTimeout = getOptionalNumberEnv(
    configService,
    "SMTP_CONNECTION_TIMEOUT_MS",
  );
  const resolvedHost = await resolveTransportHost(
    candidate.host,
    resolveSmtpDnsResultOrder(configService),
  );

  return {
    host: resolvedHost.connectHost,
    port: candidate.port,
    secure: candidate.secure,
    requireTLS: candidate.requireTLS,
    auth: user && pass ? { user, pass } : undefined,
    connectionTimeout: connectionTimeout ?? undefined,
    tls: resolvedHost.servername
      ? { servername: resolvedHost.servername }
      : undefined,
  };
}

export function buildSmtpTransport(
  configService: ConfigService,
): Transporter | null {
  const host = configService.get<string>("SMTP_HOST")?.trim();
  const port = Number(configService.get<string>("SMTP_PORT") ?? "587");
  const user = configService.get<string>("SMTP_USER")?.trim();
  const pass = configService.get<string>("SMTP_PASS")?.trim();

  if (!host || !Number.isFinite(port)) {
    return null;
  }

  const primaryCandidate: SmtpTransportCandidate = {
    host,
    port,
    secure:
      String(configService.get<string>("SMTP_SECURE") ?? "false") === "true",
  };
  const transport = nodemailer.createTransport({
    host,
    port,
    secure: primaryCandidate.secure,
    auth: user && pass ? { user, pass } : undefined,
  });
  const candidates = buildSmtpCandidates(configService, primaryCandidate);

  const sendWithFallback = async (mailOptions: unknown) => {
    let lastError: unknown = null;

    for (let index = 0; index < candidates.length; index += 1) {
      const candidate = candidates[index];

      try {
        const candidateTransport = nodemailer.createTransport(
          await buildTransportOptions(candidate, configService),
        );

        return await candidateTransport.sendMail(mailOptions as never);
      } catch (error) {
        lastError = error;

        if (index === candidates.length - 1 || !shouldTryNextCandidate(error)) {
          throw error;
        }
      }
    }

    throw lastError;
  };

  transport.sendMail = ((mailOptions: unknown, callback?: unknown) => {
    if (typeof callback === "function") {
      sendWithFallback(mailOptions)
        .then((result) => {
          (callback as (error: null, info: unknown) => void)(null, result);
        })
        .catch((error) => {
          (callback as (error: unknown) => void)(error);
        });

      return transport;
    }

    return sendWithFallback(mailOptions);
  }) as Transporter["sendMail"];

  return transport;
}
