/// <reference types="jest" />

import { PlatformRole } from "@prisma/client";
import {
  ALL_OPERATOR_PERMISSIONS,
  OPERATOR_PERMISSIONS,
  getPermissionsForRole,
  hasAllPermissions,
  isOperatorPermissionKey,
} from "./operator-permissions.registry";

describe("operator permission registry", () => {
  describe("getPermissionsForRole", () => {
    it("returns every registered permission for PLATFORM_OWNER", () => {
      const perms = getPermissionsForRole(PlatformRole.PLATFORM_OWNER);
      expect(new Set(perms)).toEqual(new Set(ALL_OPERATOR_PERMISSIONS));
    });

    it("grants SUPPORT_ADMIN the support recovery surface but no billing mutations", () => {
      const perms = getPermissionsForRole(PlatformRole.SUPPORT_ADMIN);
      expect(perms).toEqual(
        expect.arrayContaining([
          OPERATOR_PERMISSIONS.SUPPORT_CASE_READ_ALL,
          OPERATOR_PERMISSIONS.SUPPORT_CASE_RESOLVE_ALL,
          OPERATOR_PERMISSIONS.DEPLOYMENT_RETRY_ALL,
          OPERATOR_PERMISSIONS.DOMAIN_RETRY_VERIFICATION_ALL,
          OPERATOR_PERMISSIONS.FORM_DELIVERY_REPLAY_ALL,
        ]),
      );
      expect(perms).not.toContain(
        OPERATOR_PERMISSIONS.BILLING_SUBSCRIPTION_CHANGE_PLAN_ALL,
      );
      expect(perms).not.toContain(
        OPERATOR_PERMISSIONS.BILLING_INVOICE_REFUND_ALL,
      );
      expect(perms).not.toContain(
        OPERATOR_PERMISSIONS.OPERATOR_USER_MANAGE_ALL,
      );
    });

    it("grants FINANCE_ADMIN billing actions but not support resolve/transfer", () => {
      const perms = getPermissionsForRole(PlatformRole.FINANCE_ADMIN);
      expect(perms).toEqual(
        expect.arrayContaining([
          OPERATOR_PERMISSIONS.BILLING_ACCOUNT_READ_ALL,
          OPERATOR_PERMISSIONS.BILLING_SUBSCRIPTION_CHANGE_PLAN_ALL,
          OPERATOR_PERMISSIONS.BILLING_INVOICE_REFUND_ALL,
          OPERATOR_PERMISSIONS.BILLING_STRIPE_REPLAY_ALL,
        ]),
      );
      expect(perms).not.toContain(
        OPERATOR_PERMISSIONS.SUPPORT_CASE_RESOLVE_ALL,
      );
      expect(perms).not.toContain(
        OPERATOR_PERMISSIONS.SUPPORT_CASE_TRANSFER_ALL,
      );
      expect(perms).not.toContain(OPERATOR_PERMISSIONS.DEPLOYMENT_RETRY_ALL);
    });

    it("returns an empty array for missing roles", () => {
      expect(getPermissionsForRole(null)).toEqual([]);
      expect(getPermissionsForRole(undefined)).toEqual([]);
    });

    it("does not return mutable references", () => {
      const a = getPermissionsForRole(PlatformRole.SUPPORT_ADMIN);
      const b = getPermissionsForRole(PlatformRole.SUPPORT_ADMIN);
      a.push("__hack__" as never);
      expect(b).not.toContain("__hack__");
    });
  });

  describe("hasAllPermissions", () => {
    it("returns true when held set is empty but required is empty", () => {
      expect(hasAllPermissions([], [])).toBe(true);
    });

    it("returns false when required is non-empty and held is empty", () => {
      expect(hasAllPermissions([], ["tenant.read.all"])).toBe(false);
    });

    it("matches exact permission keys", () => {
      expect(hasAllPermissions(["tenant.read.all"], ["tenant.read.all"])).toBe(
        true,
      );
    });

    it("treats `*` as a global wildcard", () => {
      expect(hasAllPermissions(["*"], ["anything.you.want"])).toBe(true);
    });

    it("treats `resource.action.all` as a superset of narrower scopes", () => {
      expect(
        hasAllPermissions(["tenant.update.all"], ["tenant.update.region:eu"]),
      ).toBe(true);
    });

    it("requires every permission in the required list", () => {
      expect(
        hasAllPermissions(
          ["tenant.read.all"],
          ["tenant.read.all", "billing.account.read.all"],
        ),
      ).toBe(false);
    });

    it("does NOT widen across resource or action segments", () => {
      // Holding `tenant.read.all` must not satisfy `tenant.update.all`.
      expect(
        hasAllPermissions(["tenant.read.all"], ["tenant.update.all"]),
      ).toBe(false);
      // Holding `tenant.read.all` must not satisfy `site.read.all`.
      expect(hasAllPermissions(["tenant.read.all"], ["site.read.all"])).toBe(
        false,
      );
    });
  });

  describe("isOperatorPermissionKey", () => {
    it("accepts a registered key", () => {
      expect(isOperatorPermissionKey("tenant.read.all")).toBe(true);
    });
    it("rejects an unknown key", () => {
      expect(isOperatorPermissionKey("definitely.not.a.permission")).toBe(
        false,
      );
    });
  });
});
