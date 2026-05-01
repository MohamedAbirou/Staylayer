import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Request, Response } from "express";

interface ErrorResponseBody {
  statusCode: number;
  error: string;
  code: string;
  message: string;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let statusCode: number;
    let errorResponse: ErrorResponseBody;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === "object" && exceptionResponse !== null) {
        const resp = exceptionResponse as Record<string, unknown>;
        errorResponse = {
          statusCode,
          error: (resp["error"] as string) || HttpStatus[statusCode] || "Error",
          code: (resp["code"] as string) || this.mapStatusToCode(statusCode),
          message: this.extractMessage(resp),
        };
      } else {
        errorResponse = {
          statusCode,
          error: HttpStatus[statusCode] || "Error",
          code: this.mapStatusToCode(statusCode),
          message: String(exceptionResponse),
        };
      }
    } else {
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
      errorResponse = {
        statusCode,
        error: "Internal Server Error",
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred",
      };

      this.logger.error(
        `Unhandled exception on ${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    if (statusCode >= 500) {
      this.logger.error(
        `${request.method} ${request.url} ${statusCode}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    response.status(statusCode).json(errorResponse);
  }

  private extractMessage(resp: Record<string, unknown>): string {
    const msg = resp["message"];
    if (Array.isArray(msg)) {
      return msg.join(", ");
    }
    return (msg as string) || "An error occurred";
  }

  private mapStatusToCode(status: number): string {
    const codeMap: Record<number, string> = {
      400: "VALIDATION_ERROR",
      401: "UNAUTHORIZED",
      403: "FORBIDDEN",
      404: "NOT_FOUND",
      409: "CONFLICT",
      413: "PAYLOAD_TOO_LARGE",
      429: "RATE_LIMITED",
      500: "INTERNAL_ERROR",
    };
    return codeMap[status] || "INTERNAL_ERROR";
  }
}
