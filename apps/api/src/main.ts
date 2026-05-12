import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { globalValidationPipe } from "./common/pipes/validation.pipe";
import { REQUEST_ID_HEADER } from "./common/request-context";
import cookieParser = require("cookie-parser");

function trimTrailingSlash(value: string): string {
  return value.replace(/\/$/, "");
}

function buildDefaultCorsOrigins(): string[] {
  const origins = new Set([
    "http://localhost:5173",
    "http://localhost:4174",
    "http://localhost:3000",
    "http://localhost:3002",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:4174",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3002",
  ]);

  const configuredOrigins = [
    process.env.DASHBOARD_APP_URL,
    process.env.MARKETING_APP_URL,
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
  const app = await NestFactory.create(AppModule, { rawBody: true });

  // Security middleware
  app.use(helmet());
  app.use(cookieParser());

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
      REQUEST_ID_HEADER,
    ],
    exposedHeaders: [REQUEST_ID_HEADER],
  });

  // Global validation pipe
  app.useGlobalPipes(globalValidationPipe);

  // Graceful shutdown
  app.enableShutdownHooks();

  const port = process.env.PORT || 4000;
  await app.listen(port);
  logger.log(`API server running on http://localhost:${port}`);
}

bootstrap();
