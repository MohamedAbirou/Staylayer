import dns from "node:dns";
import net from "node:net";
import tls from "node:tls";
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

function buildIpv4SocketFactory(
  configService: ConfigService,
): SMTPTransport.Options["getSocket"] | undefined {
  if (resolveSmtpDnsResultOrder(configService) !== "ipv4first") {
    return undefined;
  }

  return (options, callback) => {
    const host = options.host ?? "";
    const port = Number(options.port ?? (options.secure ? 465 : 587));

    const lookup: net.LookupFunction = (
      hostname,
      _lookupOptions,
      lookupCallback,
    ) => {
      dns.lookup(hostname, { family: 4 }, lookupCallback);
    };

    const connectOptions: net.TcpNetConnectOpts = {
      host,
      port,
      localAddress: options.localAddress,
      lookup,
    };

    const socket = options.secure
      ? tls.connect({
          ...connectOptions,
          servername: options.tls?.servername ?? host,
          ...(options.tls ?? {}),
        })
      : net.connect(connectOptions);

    let settled = false;

    const cleanup = () => {
      socket.removeListener("error", onError);
      socket.removeListener(
        options.secure ? "secureConnect" : "connect",
        onConnect,
      );
    };

    const onError = (error: Error) => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      callback(error, {});
    };

    const onConnect = () => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      socket.setKeepAlive(true);
      callback(null, { connection: socket });
    };

    socket.once("error", onError);
    socket.once(options.secure ? "secureConnect" : "connect", onConnect);
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

  const options: SMTPTransport.Options = {
    host,
    port,
    secure:
      String(configService.get<string>("SMTP_SECURE") ?? "false") === "true",
    auth: user && pass ? { user, pass } : undefined,
    getSocket: buildIpv4SocketFactory(configService),
  };

  return nodemailer.createTransport(options);
}
