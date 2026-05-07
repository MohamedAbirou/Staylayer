import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from "@nestjs/common";
import { Response } from "express";
import { Observable, tap } from "rxjs";
import {
  RequestWithContext,
  ensureRequestId,
  getRequestContext,
} from "../request-context";

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger("HTTP");

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<RequestWithContext>();
    const response = ctx.getResponse<Response>();
    const { method, url, ip } = request;
    const userAgent = request.get("user-agent") || "";
    const now = Date.now();

    ensureRequestId(request, response);

    return next.handle().pipe(
      tap(() => {
        const { statusCode } = response;
        const duration = Date.now() - now;
        const requestContext = getRequestContext(request);

        this.logger.log(
          JSON.stringify({
            event: "http_request_completed",
            method,
            url: request.originalUrl ?? url,
            statusCode,
            durationMs: duration,
            ip: ip ?? null,
            userAgent: userAgent || null,
            ...requestContext,
          }),
        );
      }),
    );
  }
}
