/// <reference types="jest" />

import { ArgumentsHost, ForbiddenException, Logger } from "@nestjs/common";
import { REQUEST_ID_HEADER } from "../request-context";
import { HttpExceptionFilter } from "./http-exception.filter";

function createHost(overrides?: {
  headers?: Record<string, string>;
  query?: Record<string, unknown>;
  user?: Record<string, unknown>;
}) {
  const request = {
    method: "POST",
    url: "/pages",
    originalUrl: "/pages?siteId=site-1",
    headers: overrides?.headers ?? {},
    query: overrides?.query ?? {},
    user: overrides?.user,
  };

  const response = {
    setHeader: jest.fn(),
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };

  const host = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as ArgumentsHost;

  return { host, response };
}

describe("HttpExceptionFilter", () => {
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    errorSpy = jest.spyOn(Logger.prototype, "error").mockImplementation();
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it("includes the request id in fail-closed client errors", () => {
    const filter = new HttpExceptionFilter();
    const { host, response } = createHost({
      headers: { "x-request-id": "req-403" },
    });

    filter.catch(
      new ForbiddenException({
        code: "SITE_ACCESS_DENIED",
        message: "The selected site is not available in the active tenant",
      }),
      host,
    );

    expect(response.setHeader).toHaveBeenCalledWith(
      REQUEST_ID_HEADER,
      "req-403",
    );
    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "SITE_ACCESS_DENIED",
        requestId: "req-403",
      }),
    );
  });

  it("logs structured request context for server errors", () => {
    const filter = new HttpExceptionFilter();
    const { host, response } = createHost({
      query: { tenantId: "tenant-1", siteId: "site-1" },
      user: { sub: "user-1" },
    });

    filter.catch(new Error("boom"), host);

    expect(response.setHeader).toHaveBeenCalledWith(
      REQUEST_ID_HEADER,
      expect.any(String),
    );
    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "INTERNAL_ERROR",
        requestId: expect.any(String),
      }),
    );

    const payload = JSON.parse(errorSpy.mock.calls[0][0] as string);
    expect(payload).toMatchObject({
      event: "http_request_failed",
      method: "POST",
      url: "/pages?siteId=site-1",
      statusCode: 500,
      tenantId: "tenant-1",
      siteId: "site-1",
      userId: "user-1",
      code: "INTERNAL_ERROR",
    });
    expect(payload.requestId).toEqual(expect.any(String));
  });
});
