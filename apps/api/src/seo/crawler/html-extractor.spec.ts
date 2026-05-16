import { extractHtmlMetadata } from "./html-extractor";

describe("extractHtmlMetadata", () => {
  it("parses a typical page", () => {
    const html = `<!doctype html><html lang="en"><head>
      <title> Welcome &amp; Stay </title>
      <meta name="description" content="A boutique coastal retreat" />
      <meta name="robots" content="index,follow" />
      <link rel="canonical" href="https://example.com/" />
    </head><body>
      <h1>Hello world</h1>
      <h2>Rooms</h2><h2>Dining</h2>
      <p>Welcome to our charming hotel by the sea.</p>
      <img src="/hero.jpg" alt="Hero" />
      <img src="/gallery1.jpg" />
      <a href="/rooms">Rooms</a>
      <a href="https://other.com/x" rel="nofollow">External</a>
    </body></html>`;
    const out = extractHtmlMetadata(html);
    expect(out.title).toBe("Welcome & Stay");
    expect(out.metaDescription).toBe("A boutique coastal retreat");
    expect(out.metaRobots).toBe("index,follow");
    expect(out.canonical).toBe("https://example.com/");
    expect(out.h1).toEqual(["Hello world"]);
    expect(out.h2Count).toBe(2);
    expect(out.images).toHaveLength(2);
    expect(out.images[1].alt).toBeNull();
    expect(out.links).toHaveLength(2);
    expect(out.links[1].nofollow).toBe(true);
    expect(out.lang).toBe("en");
    expect(out.wordCount).toBeGreaterThan(5);
  });

  it("handles missing head fields", () => {
    const out = extractHtmlMetadata("<html><body><p>Hi</p></body></html>");
    expect(out.title).toBeNull();
    expect(out.metaDescription).toBeNull();
    expect(out.canonical).toBeNull();
    expect(out.h1).toEqual([]);
  });

  it("ignores script and style content for word count", () => {
    const out = extractHtmlMetadata(
      "<html><body><script>var x=1;var y=2;var z=3;</script><style>.a{}</style><p>One two three</p></body></html>",
    );
    expect(out.wordCount).toBe(3);
  });

  it("decodes hex and decimal entities", () => {
    const out = extractHtmlMetadata(
      "<html><head><title>&#x41;&#66;</title></head></html>",
    );
    expect(out.title).toBe("AB");
  });

  it("does not crash on malformed input", () => {
    const out = extractHtmlMetadata("<html><title>oops<body><h1>x");
    expect(out.title).toBeNull();
  });
});
