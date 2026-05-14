/// <reference types="jest" />

import { ConfigService } from "@nestjs/config";
import { PublicRuntimeService } from "../public-runtime/public-runtime.service";
import { RevalidationService } from "./revalidation.service";

describe("RevalidationService", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("posts a host-aware invalidation payload to the shared website runtime", async () => {
    const configService = {
      get: jest.fn((key: string) => {
        switch (key) {
          case "WEBSITE_APP_ORIGIN":
            return "https://website.example.com";
          case "WEBSITE_RUNTIME_SECRET":
            return "runtime-secret";
          default:
            return undefined;
        }
      }),
    };
    const publicRuntimeService = {
      listSiteHosts: jest
        .fn()
        .mockResolvedValue([
          "sunset-villa.staylayer.com",
          "www.stay.example.com",
        ]),
    };
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
    });
    global.fetch = fetchMock as typeof fetch;

    const service = new RevalidationService(
      configService as unknown as ConfigService,
      publicRuntimeService as unknown as PublicRuntimeService,
    );

    await service.revalidatePage("site-1", "home");

    expect(publicRuntimeService.listSiteHosts).toHaveBeenCalledWith("site-1");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://website.example.com/api/revalidate",
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-website-runtime-secret": "runtime-secret",
        },
        body: JSON.stringify({
          siteId: "site-1",
          hosts: ["sunset-villa.staylayer.com", "www.stay.example.com"],
          paths: ["/"],
        }),
      }),
    );
  });
});
