/// <reference types="jest" />

import { classifyHostname, companionHost } from "./public-runtime.util";

describe("classifyHostname", () => {
  it("classifies a registrable apex domain", () => {
    expect(classifyHostname("example.com", "staylayer.com")).toEqual({
      kind: "apex",
      hostname: "example.com",
      apexHost: "example.com",
      companionHost: "www.example.com",
    });
  });

  it("classifies a www host as having its apex as companion", () => {
    expect(classifyHostname("www.example.com", "staylayer.com")).toEqual({
      kind: "www",
      hostname: "www.example.com",
      apexHost: "example.com",
      companionHost: "example.com",
    });
  });

  it("classifies a non-www subdomain as having no companion", () => {
    expect(classifyHostname("shop.example.com", "staylayer.com")).toEqual({
      kind: "subdomain",
      hostname: "shop.example.com",
      apexHost: "shop.example.com",
      companionHost: null,
    });
  });

  it("recognises platform subdomains and reports no companion", () => {
    expect(classifyHostname("acme.staylayer.com", "staylayer.com")).toEqual({
      kind: "platform-subdomain",
      hostname: "acme.staylayer.com",
      apexHost: "acme.staylayer.com",
      companionHost: null,
    });
  });

  it("normalizes input hostnames (case, scheme, trailing dot)", () => {
    expect(classifyHostname("HTTPS://Example.Com.", "staylayer.com")).toEqual({
      kind: "apex",
      hostname: "example.com",
      apexHost: "example.com",
      companionHost: "www.example.com",
    });
  });
});

describe("companionHost", () => {
  it("toggles between apex and www", () => {
    expect(companionHost("example.com")).toBe("www.example.com");
    expect(companionHost("www.example.com")).toBe("example.com");
  });
});
