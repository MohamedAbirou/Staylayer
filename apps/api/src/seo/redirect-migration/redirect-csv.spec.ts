import {
  parseRedirectsCsv,
  serializeRedirectsCsv,
  splitCsvLine,
} from "./redirect-csv";

describe("splitCsvLine", () => {
  test("splits unquoted fields", () => {
    expect(splitCsvLine("a,b,c")).toEqual(["a", "b", "c"]);
  });
  test("honors quoted commas", () => {
    expect(splitCsvLine('"a,b",c')).toEqual(["a,b", "c"]);
  });
  test('unescapes ""', () => {
    expect(splitCsvLine('"a""b",c')).toEqual(['a"b', "c"]);
  });
});

describe("parseRedirectsCsv", () => {
  test("parses minimal from/to header", () => {
    const r = parseRedirectsCsv("from,to\n/a,/b\n/c,/d");
    expect(r.errors).toEqual([]);
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0]).toMatchObject({
      fromPath: "/a",
      toPath: "/b",
      statusCode: 301,
      enabled: true,
      source: "CSV_IMPORT",
    });
  });

  test("recognizes header synonyms (source_path / target)", () => {
    const r = parseRedirectsCsv("source_path,target\n/a,/b");
    expect(r.rows[0]).toMatchObject({ fromPath: "/a", toPath: "/b" });
  });

  test("permanent column maps to status 301/302", () => {
    const r = parseRedirectsCsv("from,to,permanent\n/a,/b,true\n/c,/d,false");
    expect(r.rows[0]!.statusCode).toBe(301);
    expect(r.rows[1]!.statusCode).toBe(302);
  });

  test("rejects unknown status code", () => {
    const r = parseRedirectsCsv("from,to,status\n/a,/b,418");
    expect(r.errors.length).toBeGreaterThanOrEqual(1);
    expect(r.rows).toHaveLength(0);
  });

  test("rejects invalid source value", () => {
    const r = parseRedirectsCsv("from,to,source\n/a,/b,BANANA");
    expect(r.errors.length).toBeGreaterThanOrEqual(1);
  });

  test("rejects row missing required from/to", () => {
    const r = parseRedirectsCsv("from,to\n,/b");
    expect(r.errors.length).toBeGreaterThanOrEqual(1);
    expect(r.rows).toHaveLength(0);
  });

  test("normalizes paths (lowercase + leading slash + no trailing slash)", () => {
    const r = parseRedirectsCsv("from,to\nFoo/,Bar/Baz/");
    expect(r.rows[0]).toMatchObject({ fromPath: "/foo", toPath: "/bar/baz" });
  });

  test("parses enabled column variants", () => {
    const r = parseRedirectsCsv(
      "from,to,enabled\n/a,/b,no\n/c,/d,yes\n/e,/f,0",
    );
    expect(r.rows[0]!.enabled).toBe(false);
    expect(r.rows[1]!.enabled).toBe(true);
    expect(r.rows[2]!.enabled).toBe(false);
  });
});

describe("serializeRedirectsCsv", () => {
  test("roundtrips parse → serialize → parse with same data", () => {
    const original = [
      {
        fromPath: "/a",
        toPath: "/b",
        statusCode: 301,
        locale: "en",
        reason: "test, with comma",
        enabled: true,
        source: "MANUAL",
      },
      {
        fromPath: "/c",
        toPath: "/d",
        statusCode: 302,
        locale: null,
        reason: null,
        enabled: false,
        source: "CSV_IMPORT",
      },
    ];
    const csv = serializeRedirectsCsv(original);
    const parsed = parseRedirectsCsv(csv);
    expect(parsed.errors).toEqual([]);
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0]!.reason).toBe("test, with comma");
    expect(parsed.rows[1]!.enabled).toBe(false);
  });

  test("escapes commas, quotes, and newlines", () => {
    const csv = serializeRedirectsCsv([
      {
        fromPath: "/a",
        toPath: "/b",
        statusCode: 301,
        locale: null,
        reason: 'has "quotes" and\nnewline, too',
        enabled: true,
        source: "MANUAL",
      },
    ]);
    expect(csv).toContain('"has ""quotes"" and\nnewline, too"');
  });

  test("emits the canonical header", () => {
    const csv = serializeRedirectsCsv([]);
    expect(csv.split("\n")[0]).toBe(
      "from,to,status,locale,reason,enabled,source",
    );
  });
});
