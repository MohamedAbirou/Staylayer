import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { globalValidationPipe } from "./common/pipes/validation.pipe";
import { REQUEST_ID_HEADER } from "./common/request-context";
import cookieParser = require("cookie-parser");
// `compression` is a CommonJS module. We import it with `require` so the
// build works with or without `@types/compression` installed; the
// runtime contract (`compression(opts)` returning express middleware,
// `compression.filter` as the default content-type filter) is stable
// across versions.
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
const compression: {
  (
    opts?: Record<string, unknown>,
  ): (req: unknown, res: unknown, next: () => void) => void;
  filter: (req: unknown, res: unknown) => boolean;
} = require("compression");

function trimTrailingSlash(value: string): string {
  return value.replace(/\/$/, "");
}

function buildDefaultCorsOrigins(): string[] {
  const origins = new Set([
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:4174",
    "http://localhost:3000",
    "http://localhost:3002",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    "http://127.0.0.1:4174",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3002",
  ]);

  const configuredOrigins = [
    process.env.DASHBOARD_APP_URL,
    process.env.MARKETING_APP_URL,
    process.env.OPERATOR_CONSOLE_APP_URL,
  ]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));

  for (const origin of configuredOrigins) {
    origins.add(trimTrailingSlash(origin));
  }

  return Array.from(origins);
}

async function bootstrap(): Promise<void> {
  const logger = new Logger("Bootstrap");
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
    // Disable Nest's verbose access log in production — request-id
    // correlation is already emitted by our request-context middleware.
    logger:
      process.env.NODE_ENV === "production"
        ? ["log", "warn", "error"]
        : ["log", "warn", "error", "debug", "verbose"],
  });

  // Trust the platform proxy (Vercel / Fly / Render set `X-Forwarded-*`).
  // Required for: correct `req.ip` in throttler / audit logs, `secure`
  // cookie heuristics, and rate-limit identification.
  app.set("trust proxy", 1);

  // Security middleware. We turn off Helmet's CSP — the API is JSON-only
  // and serves no HTML, but each customer-facing app (dashboard,
  // operator console, marketing, website) ships its own page-level CSP.
  // Cross-Origin-Resource-Policy is set to `cross-origin` so the
  // dashboard / operator console hosted on different origins can fetch
  // JSON responses without CORP blocking them.
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
      // HSTS only kicks in for HTTPS responses — safe to enable
      // unconditionally; the dev server speaks plain HTTP so the
      // browser ignores the header there.
      strictTransportSecurity: {
        maxAge: 63072000,
        includeSubDomains: true,
        preload: true,
      },
      // The API never embeds in an iframe.
      frameguard: { action: "deny" },
      referrerPolicy: { policy: "no-referrer" },
    }),
  );
  app.use(cookieParser());

  // Response compression. Gzip-encodes JSON / text responses larger than
  // the threshold; binary streams (Stripe webhook raw body, image
  // uploads) are already either small or already-compressed and the
  // default `compression.filter` skips them. The `x-no-compression`
  // header is honored so the webhook ingest path can opt out if needed.
  app.use(
    compression({
      threshold: 1024,
      filter: (req: unknown, res: unknown) => {
        const headers = (req as { headers?: Record<string, unknown> }).headers;
        if (headers && headers["x-no-compression"]) return false;
        return compression.filter(req, res);
      },
    }),
  );

  // CORS configuration
  const corsOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(",").map((origin) => origin.trim())
    : buildDefaultCorsOrigins();

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Active-Tenant-Id",
      "X-Active-Site-Id",
      "X-Operator-Console",
      REQUEST_ID_HEADER,
    ],
    exposedHeaders: [REQUEST_ID_HEADER],
    maxAge: 86400,
  });

  // Global validation pipe
  app.useGlobalPipes(globalValidationPipe);

  // Graceful shutdown
  app.enableShutdownHooks();

  const port = process.env.PORT || 4000;
  await app.listen(port);

  // Tune the HTTP server for production. Defaults are pessimistic for
  // long-lived API traffic behind a load balancer.
  //  - `keepAliveTimeout` slightly higher than the upstream LB idle
  //    timeout to avoid 502s on connection reuse.
  //  - `headersTimeout` must be > keepAliveTimeout (Node requirement).
  //  - `requestTimeout` caps slow-loris attacks.
  const httpServer = app.getHttpServer() as {
    keepAliveTimeout?: number;
    headersTimeout?: number;
    requestTimeout?: number;
    maxHeadersCount?: number;
  } | null;
  if (httpServer) {
    httpServer.keepAliveTimeout = 65_000;
    httpServer.headersTimeout = 66_000;
    httpServer.requestTimeout = 30_000;
    httpServer.maxHeadersCount = 100;
  }

  logger.log(`API server running on http://localhost:${port}`);
}

bootstrap();
