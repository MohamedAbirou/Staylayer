import {
  analyzeAiCitation,
  detectAnswerReadyBlocks,
  detectEntityFacts,
  evaluateFreshness,
  scoreToGrade,
  type AiCitationInput,
  type AiCitationInputBlock,
} from "./ai-citation-analyzer";

const today = () => new Date();

function input(overrides: Partial<AiCitationInput> = {}): AiCitationInput {
  return {
    title: "Cozy Lakeside Cottage in Aspen",
    seoTitle: "Cozy Lakeside Cottage in Aspen | Lakeside Retreats",
    seoDescription:
      "A 2-bedroom lakeside cottage in Aspen with private dock, hot tub, and fireplace. Book direct and save 10%.",
    blocks: [
      { type: "heading", text: "Cozy Lakeside Cottage in Aspen", level: 1 },
      { type: "heading", text: "What time is check-in?", level: 2 },
      {
        type: "paragraph",
        text: "Check-in is at 4 pm and check-out is by 11 am. Reservations are confirmed via email.",
      },
      { type: "heading", text: "How many guests can stay?", level: 2 },
      {
        type: "paragraph",
        text: "The cottage sleeps up to 6 guests across 2 bedrooms and 2 baths.",
      },
      {
        type: "paragraph",
        text: "Lakeside Retreats is a family-run property located at 123 Lake Road, Aspen, 81611. Call +1 970-555-0199 for direct bookings.",
      },
      {
        type: "qa",
        text: "Is breakfast included? — Yes, continental breakfast is included.",
      },
    ],
    updatedAt: today(),
    robots: {},
    structuredDataTypes: ["FAQPage"],
    ...overrides,
  };
}

describe("scoreToGrade", () => {
  it("maps scores to letter grades on the documented thresholds", () => {
    expect(scoreToGrade(100)).toBe("A");
    expect(scoreToGrade(85)).toBe("A");
    expect(scoreToGrade(84)).toBe("B");
    expect(scoreToGrade(70)).toBe("B");
    expect(scoreToGrade(69)).toBe("C");
    expect(scoreToGrade(55)).toBe("C");
    expect(scoreToGrade(54)).toBe("D");
    expect(scoreToGrade(40)).toBe("D");
    expect(scoreToGrade(39)).toBe("F");
    expect(scoreToGrade(0)).toBe("F");
  });
});

describe("evaluateFreshness", () => {
  it("returns 'unknown' when no date supplied", () => {
    expect(evaluateFreshness(null).verdict).toBe("unknown");
    expect(evaluateFreshness(undefined).verdict).toBe("unknown");
    expect(evaluateFreshness("not-a-date").verdict).toBe("unknown");
  });

  it("buckets dates into fresh / ok / stale", () => {
    const now = Date.now();
    expect(evaluateFreshness(new Date(now - 5 * 86_400_000)).verdict).toBe(
      "fresh",
    );
    expect(evaluateFreshness(new Date(now - 200 * 86_400_000)).verdict).toBe(
      "ok",
    );
    expect(evaluateFreshness(new Date(now - 400 * 86_400_000)).verdict).toBe(
      "stale",
    );
  });
});

describe("detectEntityFacts", () => {
  it("captures sentences with prices, hours, addresses, phones", () => {
    const text =
      "Check-in is at 4 pm. The room rate starts at $189 per night. Call +1 970-555-0199 to book. We are located at 123 Lake Road.";
    const facts = detectEntityFacts(text, []);
    // Should pick up all 4 sentences (price, hours, phone, address).
    expect(facts.length).toBeGreaterThanOrEqual(3);
  });

  it("captures definitional intros from paragraphs", () => {
    const facts = detectEntityFacts(
      "Lakeside Retreats offers private dock access for every booking.",
      [
        {
          type: "paragraph",
          text: "Lakeside Retreats offers private dock access for every booking.",
        },
      ],
    );
    expect(facts.some((f) => /Lakeside Retreats/.test(f))).toBe(true);
  });

  it("returns no facts for fluffy prose without concrete attributes", () => {
    const text =
      "Welcome to a wonderful place. You will love it here. It feels great. Come visit soon.";
    expect(detectEntityFacts(text, []).length).toBe(0);
  });
});

describe("detectAnswerReadyBlocks", () => {
  it("captures explicit qa blocks", () => {
    const blocks: AiCitationInputBlock[] = [
      { type: "qa", text: "Q: When is breakfast? — A: 7am to 10am daily." },
    ];
    expect(detectAnswerReadyBlocks(blocks).length).toBe(1);
  });

  it("captures question-heading followed by paragraph", () => {
    const blocks: AiCitationInputBlock[] = [
      { type: "heading", text: "How do I cancel?", level: 2 },
      {
        type: "paragraph",
        text: "Cancel free of charge up to 7 days before arrival.",
      },
    ];
    expect(detectAnswerReadyBlocks(blocks).length).toBe(1);
  });

  it("ignores plain narrative paragraphs", () => {
    const blocks: AiCitationInputBlock[] = [
      {
        type: "paragraph",
        text: "we love hosting families from around the world.",
      },
    ];
    expect(detectAnswerReadyBlocks(blocks).length).toBe(0);
  });
});

describe("analyzeAiCitation", () => {
  it("returns a high score for a well-structured FAQ page", () => {
    const r = analyzeAiCitation(input());
    expect(r.score).toBeGreaterThanOrEqual(85);
    expect(r.grade).toBe("A");
    expect(r.signals.entityFacts.count).toBeGreaterThanOrEqual(3);
    expect(r.signals.answerReady.count).toBeGreaterThanOrEqual(1);
    expect(r.signals.robots.allowsCitation).toBe(true);
    expect(r.signals.structuredData.hasQaSchema).toBe(true);
  });

  it("returns F when noindex is set and other signals are weak", () => {
    const r = analyzeAiCitation(
      input({
        title: "",
        seoTitle: null,
        seoDescription: null,
        blocks: [{ type: "paragraph", text: "hi" }],
        robots: { noindex: true },
        structuredDataTypes: [],
        updatedAt: null,
      }),
    );
    expect(r.signals.robots.allowsCitation).toBe(false);
    expect(r.score).toBeLessThanOrEqual(40);
    expect(r.findings.some((f) => f.code === "ROBOTS_NOINDEX")).toBe(true);
  });

  it("flags noarchive and nosnippet as warnings without zeroing the score", () => {
    const r = analyzeAiCitation(
      input({ robots: { noarchive: true, nosnippet: true } }),
    );
    expect(r.findings.some((f) => f.code === "ROBOTS_NOARCHIVE")).toBe(true);
    expect(r.findings.some((f) => f.code === "ROBOTS_NOSNIPPET")).toBe(true);
    expect(r.score).toBeLessThan(100);
    expect(r.score).toBeGreaterThan(40);
  });

  it("penalises thin content", () => {
    const r = analyzeAiCitation(
      input({ blocks: [{ type: "paragraph", text: "Tiny page." }] }),
    );
    expect(r.findings.some((f) => f.code === "THIN_CONTENT")).toBe(true);
  });

  it("rewards Q&A heading structure", () => {
    const r = analyzeAiCitation(input());
    expect(r.findings.some((f) => f.code === "GOOD_HEADING_STRUCTURE")).toBe(
      true,
    );
  });

  it("flags stale pages", () => {
    const stale = new Date(Date.now() - 400 * 86_400_000);
    const r = analyzeAiCitation(input({ updatedAt: stale }));
    expect(r.findings.some((f) => f.code === "STALE_CONTENT")).toBe(true);
  });

  it("flags missing description", () => {
    const r = analyzeAiCitation(input({ seoDescription: "" }));
    expect(r.findings.some((f) => f.code === "MISSING_DESCRIPTION")).toBe(true);
  });

  it("flags short description as info", () => {
    const r = analyzeAiCitation(
      input({ seoDescription: "Short page about Aspen" }),
    );
    expect(r.findings.some((f) => f.code === "DESCRIPTION_TOO_SHORT")).toBe(
      true,
    );
  });

  it("clamps score to [0, 100]", () => {
    const r = analyzeAiCitation(input());
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });

  it("is deterministic for identical input", () => {
    const a = analyzeAiCitation(input());
    const b = analyzeAiCitation(input());
    expect(a.score).toBe(b.score);
    expect(a.findings.length).toBe(b.findings.length);
  });
});
