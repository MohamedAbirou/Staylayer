import { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PlatformRole, TenantMembershipRole } from "@prisma/client";
import { RolesGuard } from "./roles.guard";

function createExecutionContext(
  user: Record<string, unknown>,
): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
      getResponse: () => ({}),
      getNext: () => undefined,
    }),
  } as ExecutionContext;
}

describe("RolesGuard", () => {
  it("allows matching platform roles", () => {
    const reflector = {
      getAllAndOverride: jest
        .fn()
        .mockReturnValueOnce([PlatformRole.PLATFORM_OWNER])
        .mockReturnValueOnce(undefined),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(
      guard.canActivate(
        createExecutionContext({ platformRole: PlatformRole.PLATFORM_OWNER }),
      ),
    ).toBe(true);
  });

  it("rejects missing membership roles on customer routes", () => {
    const reflector = {
      getAllAndOverride: jest
        .fn()
        .mockReturnValueOnce(undefined)
        .mockReturnValueOnce([TenantMembershipRole.ADMIN]),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(
      guard.canActivate(
        createExecutionContext({
          platformRole: PlatformRole.PLATFORM_OWNER,
          activeMembershipRole: null,
        }),
      ),
    ).toBe(false);
  });

  it("rejects a BILLING role on an EDITOR-minimum route", () => {
    const reflector = {
      getAllAndOverride: jest
        .fn()
        .mockReturnValueOnce(undefined)
        .mockReturnValueOnce([
          TenantMembershipRole.OWNER,
          TenantMembershipRole.ADMIN,
          TenantMembershipRole.EDITOR,
        ]),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(
      guard.canActivate(
        createExecutionContext({
          activeMembershipRole: TenantMembershipRole.BILLING,
        }),
      ),
    ).toBe(false);
  });

  it("rejects an EDITOR role on an OWNER-only route", () => {
    const reflector = {
      getAllAndOverride: jest
        .fn()
        .mockReturnValueOnce(undefined)
        .mockReturnValueOnce([TenantMembershipRole.OWNER]),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(
      guard.canActivate(
        createExecutionContext({
          activeMembershipRole: TenantMembershipRole.EDITOR,
        }),
      ),
    ).toBe(false);
  });

  it("allows any authenticated user on an open route with no role decorators", () => {
    const reflector = {
      getAllAndOverride: jest
        .fn()
        .mockReturnValueOnce(undefined)
        .mockReturnValueOnce(undefined),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(
      guard.canActivate(
        createExecutionContext({
          activeMembershipRole: TenantMembershipRole.BILLING,
        }),
      ),
    ).toBe(true);
  });

  it("rejects an unauthenticated request on a membership-guarded route", () => {
    const reflector = {
      getAllAndOverride: jest
        .fn()
        .mockReturnValueOnce(undefined)
        .mockReturnValueOnce([TenantMembershipRole.ADMIN]),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(
      guard.canActivate(
        createExecutionContext(null as unknown as Record<string, unknown>),
      ),
    ).toBe(false);
  });
});
