import { runCrawlEngine, CrawlPageOutcome } from "./crawler-engine";

/**
 * Builds a deterministic mock fetch backed by an in-memory site map. Each
 * key is a URL; the value is either an HTML body string, a redirect target,
 * or an HTTP status.
 */
function mockFetch(
  pages: Record<
    string,
    { status: number; body?: string; redirectTo?: string; contentType?: string }
  >,
): typeof fetch {
  return (async (input: string | URL | Request) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    const page = pages[url];
    if (!page) {
      return new Response("not found", {
        status: 404,
        headers: { "content-type": "text/html" },
      });
    }
    if (page.redirectTo) {
      return new Response("", {
        status: page.status,
        headers: { location: page.redirectTo },
      });
    }
    return new Response(page.body ?? "", {
      status: page.status,
      headers: { "content-type": page.contentType ?? "text/html" },
    });
  }) as unknown as typeof fetch;
}

describe("runCrawlEngine", () => {
  it("crawls same-origin links breadth-first up to maxDepth", async () => {
    const pages: Record<string, { status: number; body?: string }> = {
      "https://example.com/": {
        status: 200,
        body: `<html><body>
          <a href="/a">A</a><a href="/b">B</a>
          <a href="https://external.com/x">Ext</a>
        </body></html>`,
      },
      "https://example.com/a": {
        status: 200,
        body: `<html><body><a href="/deep">Deep</a></body></html>`,
      },
      "https://example.com/b": {
        status: 200,
        body: "<html><body>B</body></html>",
      },
      "https://example.com/deep": {
        status: 200,
        body: "<html><body>Deep</body></html>",
      },
    };
    const seen: string[] = [];
    const result = await runCrawlEngine({
      startUrl: "https://example.com/",
      canonicalHost: "example.com",
      urlLimit: 100,
      maxDepth: 2,
      concurrency: 2,
      fetchImpl: mockFetch(pages),
      onPage: (p) => {
        seen.push(p.url);
      },
    });
    expect(result.totalUrls).toBe(4);
    expect(seen).toContain("https://example.com/");
    expect(seen).toContain("https://example.com/a");
    expect(seen).toContain("https://example.com/b");
    expect(seen).toContain("https://example.com/deep");
    expect(seen.every((u) => u.startsWith("https://example.com/"))).toBe(true);
  });

  it("respects urlLimit", async () => {
    const pages: Record<string, { status: number; body?: string }> = {
      "https://example.com/": {
        status: 200,
        body: `<html><body>
          <a href="/a">A</a><a href="/b">B</a><a href="/c">C</a><a href="/d">D</a>
        </body></html>`,
      },
      "https://example.com/a": { status: 200, body: "<html></html>" },
      "https://example.com/b": { status: 200, body: "<html></html>" },
      "https://example.com/c": { status: 200, body: "<html></html>" },
      "https://example.com/d": { status: 200, body: "<html></html>" },
    };
    const result = await runCrawlEngine({
      startUrl: "https://example.com/",
      canonicalHost: "example.com",
      urlLimit: 3,
      maxDepth: 5,
      concurrency: 1,
      fetchImpl: mockFetch(pages),
      onPage: () => undefined,
    });
    expect(result.totalUrls).toBeLessThanOrEqual(3);
    expect(result.reachedLimit).toBe(true);
  });

  it("records redirect chains", async () => {
    const pages = {
      "https://example.com/": {
        status: 301,
        redirectTo: "https://example.com/new",
      },
      "https://example.com/new": {
        status: 200,
        body: "<html><body>Hi</body></html>",
      },
    };
    let captured: CrawlPageOutcome | null = null;
    await runCrawlEngine({
      startUrl: "https://example.com/",
      canonicalHost: "example.com",
      urlLimit: 10,
      maxDepth: 0,
      fetchImpl: mockFetch(pages),
      onPage: (p) => {
        captured = p;
      },
    });
    expect(captured).not.toBeNull();
    expect(captured!.redirectChain.length).toBe(1);
    expect(captured!.statusCode).toBe(200);
  });

  it("detects noindex from meta robots", async () => {
    const pages = {
      "https://example.com/": {
        status: 200,
        body: `<html><head><meta name="robots" content="noindex"></head><body></body></html>`,
      },
    };
    let captured: CrawlPageOutcome | null = null;
    await runCrawlEngine({
      startUrl: "https://example.com/",
      canonicalHost: "example.com",
      urlLimit: 10,
      maxDepth: 0,
      fetchImpl: mockFetch(pages),
      onPage: (p) => {
        captured = p;
      },
    });
    expect(captured!.indexable).toBe(false);
    expect(captured!.noindexReason).toBeTruthy();
  });

  it("does not follow links on noindex pages", async () => {
    const pages = {
      "https://example.com/": {
        status: 200,
        body: `<html><head><meta name="robots" content="noindex"></head><body>
          <a href="/should-not-follow">x</a>
        </body></html>`,
      },
      "https://example.com/should-not-follow": {
        status: 200,
        body: "<html></html>",
      },
    };
    const seen: string[] = [];
    await runCrawlEngine({
      startUrl: "https://example.com/",
      canonicalHost: "example.com",
      urlLimit: 10,
      maxDepth: 5,
      fetchImpl: mockFetch(pages),
      onPage: (p) => {
        seen.push(p.url);
      },
    });
    expect(seen).toEqual(["https://example.com/"]);
  });

  it("stops when isCancelled returns true", async () => {
    const pages: Record<string, { status: number; body?: string }> = {
      "https://example.com/": {
        status: 200,
        body: `<html><body><a href="/a">A</a></body></html>`,
      },
      "https://example.com/a": { status: 200, body: "<html></html>" },
    };
    let cancel = false;
    const result = await runCrawlEngine({
      startUrl: "https://example.com/",
      canonicalHost: "example.com",
      urlLimit: 10,
      maxDepth: 5,
      fetchImpl: mockFetch(pages),
      onPage: () => {
        cancel = true;
      },
      isCancelled: () => cancel,
    });
    expect(result.totalUrls).toBe(1);
  });

  it("captures outbound link metadata (anchor text, rel, internal flag)", async () => {
    const pages: Record<string, { status: number; body?: string }> = {
      "https://example.com/": {
        status: 200,
        body: `<html><body>
          <a href="/inside" title="x">Inside Page</a>
          <a href="https://external.com/x" rel="nofollow ugc">Ext</a>
        </body></html>`,
      },
      "https://example.com/inside": {
        status: 200,
        body: "<html><body>ok</body></html>",
      },
    };
    let homepage: CrawlPageOutcome | null = null;
    await runCrawlEngine({
      startUrl: "https://example.com/",
      canonicalHost: "example.com",
      urlLimit: 5,
      maxDepth: 2,
      fetchImpl: mockFetch(pages),
      onPage: (p) => {
        if (p.url === "https://example.com/") homepage = p;
      },
    });
    expect(homepage).not.toBeNull();
    const links = homepage!.outboundLinks;
    expect(links.length).toBe(2);

    const internal = links.find((l) => l.isInternal)!;
    expect(internal.targetUrl).toBe("https://example.com/inside");
    expect(internal.targetPathname).toBe("/inside");
    expect(internal.anchorText).toBe("Inside Page");
    expect(internal.nofollow).toBe(false);

    const external = links.find((l) => !l.isInternal)!;
    expect(external.targetUrl).toBe("https://external.com/x");
    expect(external.targetPathname).toBeNull();
    expect(external.rel).toMatch(/nofollow/);
    expect(external.nofollow).toBe(true);
  });
});
