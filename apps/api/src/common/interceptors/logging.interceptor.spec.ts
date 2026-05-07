/// <reference types="jest" />

import { CallHandler, ExecutionContext, Logger } from "@nestjs/common";
import { lastValueFrom, of } from "rxjs";
import { REQUEST_ID_HEADER } from "../request-context";
import { LoggingInterceptor } from "./logging.interceptor";

function createExecutionContext(overrides?: {
  headers?: Record<string, string>;
  query?: Record<string, unknown>;
  user?: Record<string, unknown>;
}) {
  const request = {
    method: "GET",
    url: "/pages",
    originalUrl: "/pages?siteId=site-1",
    ip: "127.0.0.1",
    headers: overrides?.headers ?? {},
    query: overrides?.query ?? {},
    user: overrides?.user,
    get(name: string) {
      return this.headers[name.toLowerCase()];
    },
  };

  const response = {
    statusCode: 200,
    setHeader: jest.fn(),
  };

  const context = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as ExecutionContext;

  return { context, response };
}

describe("LoggingInterceptor", () => {
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest.spyOn(Logger.prototype, "log").mockImplementation();
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it("generates a request id header and emits structured request logs", async () => {
    const interceptor = new LoggingInterceptor();
    const { context, response } = createExecutionContext({
      query: { tenantId: "tenant-1", siteId: "site-1" },
      user: {
        sub: "user-1",
        activeTenantId: "tenant-1",
        activeSiteId: "site-1",
      },
    });

    await lastValueFrom(
      interceptor.intercept(context, {
        handle: () => of({ ok: true }),
      } as CallHandler),
    );

    expect(response.setHeader).toHaveBeenCalledWith(
      REQUEST_ID_HEADER,
      expect.any(String),
    );

    const payload = JSON.parse(logSpy.mock.calls[0][0] as string);
    expect(payload).toMatchObject({
      event: "http_request_completed",
      method: "GET",
      url: "/pages?siteId=site-1",
      statusCode: 200,
      tenantId: "tenant-1",
      siteId: "site-1",
      userId: "user-1",
    });
    expect(payload.requestId).toEqual(expect.any(String));
  });

  it("preserves inbound request ids for downstream correlation", async () => {
    const interceptor = new LoggingInterceptor();
    const { context, response } = createExecutionContext({
      headers: { "x-request-id": "req-123" },
    });

    await lastValueFrom(
      interceptor.intercept(context, {
        handle: () => of({ ok: true }),
      } as CallHandler),
    );

    expect(response.setHeader).toHaveBeenCalledWith(
      REQUEST_ID_HEADER,
      "req-123",
    );

    const payload = JSON.parse(logSpy.mock.calls[0][0] as string);
    expect(payload.requestId).toBe("req-123");
  });
});
