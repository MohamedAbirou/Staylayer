/// <reference types="jest" />

import { AdminOverviewController } from "./admin-overview.controller";
import { AdminService } from "./admin.service";

describe("AdminOverviewController", () => {
  it("returns the operator overview payload from the admin service", async () => {
    const adminService = {
      getOverview: jest.fn().mockResolvedValue({
        generatedAt: "2026-05-06T12:00:00.000Z",
        scorecards: {
          tenants: {
            total: 1,
            active: 1,
            suspended: 0,
            archived: 0,
            newLast30Days: 1,
          },
          billing: {
            active: 1,
            trialing: 0,
            pastDue: 0,
            canceled: 0,
            inactive: 0,
          },
          deployments: {
            liveSites: 1,
            buildingSites: 0,
            failedSites: 0,
            pendingSites: 0,
            unprovisionedSites: 0,
            liveRate: 100,
          },
          domains: {
            activeDomains: 1,
            pendingDomains: 0,
            failedDomains: 0,
            sslProvisioningDomains: 0,
            sitesMissingPrimaryDomain: 0,
          },
          operations: {
            openAlerts: 0,
            criticalAlerts: 0,
            submissionsLast30Days: 4,
            failedDeliveriesLast30Days: 0,
          },
        },
        planMix: [],
        tenantHealth: [],
        queues: {
          billingAttention: [],
          deploymentFailures: [],
          domainIssues: [],
          formAlerts: [],
          recentAudit: [],
        },
      }),
    };

    const controller = new AdminOverviewController(
      adminService as unknown as AdminService,
    );

    await expect(controller.getOverview()).resolves.toEqual(
      expect.objectContaining({
        generatedAt: "2026-05-06T12:00:00.000Z",
      }),
    );
    expect(adminService.getOverview).toHaveBeenCalledTimes(1);
  });
});
