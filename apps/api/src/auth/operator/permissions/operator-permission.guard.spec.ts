/// <reference types="jest" />

import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PlatformRole } from "@prisma/client";
import { OperatorPermissionGuard } from "./operator-permission.guard";
import { OPERATOR_PERMISSIONS } from "./operator-permissions.registry";
import { REQUIRE_OPERATOR_PERMISSIONS_KEY } from "./require-operator-permissions.decorator";
import { OPERATOR_JWT_AUDIENCE } from "../operator-auth.types";

function makeContext(opts: {
  required?: readonly string[] | undefined;
  user?: Record<string, unknown> | undefined;
  method?: string;
  url?: string;
}): { context: ExecutionContext; reflector: Reflector } {
  const reflector = new Reflector();
  jest
    .spyOn(reflector, "getAllAndOverride")
    .mockImplementation((key: unknown) => {
      if (key === REQUIRE_OPERATOR_PERMISSIONS_KEY) {
        return opts.required;
      }
      return undefined;
    });
  const handler = () => undefined;
  class Ctrl {}
  const ctx = {
    getHandler: () => handler,
    getClass: () => Ctrl,
    switchToHttp: () => ({
      getRequest: () => ({
        user: opts.user,
        method: opts.method ?? "POST",
        url: opts.url ?? "/operator/tenants/t-1/suspend",
        originalUrl: opts.url ?? "/operator/tenants/t-1/suspend",
      }),
    }),
  } as unknown as ExecutionContext;
  return { context: ctx, reflector };
}

describe("OperatorPermissionGuard", () => {
  it("passes when no permission metadata is declared", () => {
    const { context, reflector } = makeContext({ required: undefined });
    const guard = new OperatorPermissionGuard(reflector);
    expect(guard.canActivate(context)).toBe(true);
  });

  it("passes when required is an empty array", () => {
    const { context, reflector } = makeContext({ required: [] });
    const guard = new OperatorPermissionGuard(reflector);
    expect(guard.canActivate(context)).toBe(true);
  });

  it("rejects with OPERATOR_UNAUTHENTICATED when req.user is missing", () => {
    const { context, reflector } = makeContext({
      required: [OPERATOR_PERMISSIONS.TENANT_READ_ALL],
      user: undefined,
    });
    const guard = new OperatorPermissionGuard(reflector);
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it("rejects with OPERATOR_UNAUTHENTICATED when the audience is not operator", () => {
    const { context, reflector } = makeContext({
      required: [OPERATOR_PERMISSIONS.TENANT_READ_ALL],
      user: {
        id: "u-1",
        aud: "customer-dashboard",
        platformRole: PlatformRole.PLATFORM_OWNER,
      },
    });
    const guard = new OperatorPermissionGuard(reflector);
    try {
      guard.canActivate(context);
      throw new Error("expected guard to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(UnauthorizedException);
      expect((err as UnauthorizedException).getResponse()).toMatchObject({
        code: "OPERATOR_UNAUTHENTICATED",
      });
    }
  });

  it("rejects with OPERATOR_PERMISSION_DENIED when role lacks the permission", () => {
    const { context, reflector } = makeContext({
      required: [OPERATOR_PERMISSIONS.BILLING_INVOICE_REFUND_ALL],
      user: {
        id: "u-1",
        aud: OPERATOR_JWT_AUDIENCE,
        platformRole: PlatformRole.SUPPORT_ADMIN,
      },
    });
    const guard = new OperatorPermissionGuard(reflector);
    try {
      guard.canActivate(context);
      throw new Error("expected guard to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenException);
      const body = (err as ForbiddenException).getResponse() as {
        code: string;
        required: string[];
      };
      expect(body.code).toBe("OPERATOR_PERMISSION_DENIED");
      expect(body.required).toEqual([
        OPERATOR_PERMISSIONS.BILLING_INVOICE_REFUND_ALL,
      ]);
    }
  });

  it("allows PLATFORM_OWNER for any required permission", () => {
    const { context, reflector } = makeContext({
      required: [
        OPERATOR_PERMISSIONS.BILLING_INVOICE_REFUND_ALL,
        OPERATOR_PERMISSIONS.TENANT_SUSPEND_ALL,
      ],
      user: {
        id: "u-1",
        aud: OPERATOR_JWT_AUDIENCE,
        platformRole: PlatformRole.PLATFORM_OWNER,
      },
    });
    const guard = new OperatorPermissionGuard(reflector);
    expect(guard.canActivate(context)).toBe(true);
  });

  it("allows SUPPORT_ADMIN for support recovery actions", () => {
    const { context, reflector } = makeContext({
      required: [
        OPERATOR_PERMISSIONS.SUPPORT_CASE_RESOLVE_ALL,
        OPERATOR_PERMISSIONS.FORM_DELIVERY_REPLAY_ALL,
      ],
      user: {
        id: "u-1",
        aud: OPERATOR_JWT_AUDIENCE,
        platformRole: PlatformRole.SUPPORT_ADMIN,
      },
    });
    const guard = new OperatorPermissionGuard(reflector);
    expect(guard.canActivate(context)).toBe(true);
  });
});
