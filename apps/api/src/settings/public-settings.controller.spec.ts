/// <reference types="jest" />

import { PublicSettingsController } from "./public-settings.controller";
import { SettingsService } from "./settings.service";

describe("PublicSettingsController", () => {
  let controller: PublicSettingsController;
  let settingsService: {
    getPublic: jest.Mock;
  };

  beforeEach(() => {
    settingsService = {
      getPublic: jest.fn(),
    };

    controller = new PublicSettingsController(
      settingsService as unknown as SettingsService,
    );
  });

  it("returns the sanitized public settings for a site", async () => {
    settingsService.getPublic.mockResolvedValue({ siteName: "Harbor House" });

    await controller.getPublic({ siteId: "site-1" } as never);

    expect(settingsService.getPublic).toHaveBeenCalledWith("site-1");
  });
});
