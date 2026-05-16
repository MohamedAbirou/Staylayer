/**
 * Catalog of search-engine and AI crawler user-agents the platform exposes
 * in the robots.txt editor.
 *
 * Each entry maps to a single explicit `User-agent:` group emitted in
 * robots.txt when the operator overrides its policy. The default for any bot
 * not explicitly overridden is governed by the wildcard `User-agent: *` group
 * (allow when site indexing is enabled, disallow when indexing is paused).
 *
 * Sources: each crawler's official documentation (Google, Bing, OpenAI,
 * Anthropic, Perplexity, Common Crawl, Bytedance, Apple). Verified against
 * January 2026 public docs.
 */

export type CrawlerCategory =
  | "search_engine"
  | "ai_training"
  | "ai_assistant"
  | "ai_search";

export type CrawlerPolicy = "allow" | "disallow";

export interface CrawlerCatalogEntry {
  /**
   * The exact User-agent token to emit. Case-sensitive in some bots
   * (Google-Extended, GPTBot) — preserve the original casing.
   */
  userAgent: string;
  /** Human-readable label shown in the dashboard. */
  label: string;
  /** Crawler operator or owning company. */
  operator: string;
  category: CrawlerCategory;
  /**
   * Default policy if the operator never touches the toggle. Search-engine
   * bots default to `allow` (they drive organic traffic). AI training bots
   * default to `disallow` so customers do not unknowingly opt in to model
   * training. AI search/assistant bots default to `allow` because blocking
   * them means the site cannot appear in answers.
   */
  defaultPolicy: CrawlerPolicy;
  /** One-line description of what the bot does. */
  description: string;
  /** Plain-language warning shown next to the toggle in the dashboard. */
  warning?: string;
  /** Documentation URL for the bot. */
  docsUrl: string;
}

export const CRAWLER_CATALOG: readonly CrawlerCatalogEntry[] = [
  // ── Search engines ────────────────────────────────────────────────────────
  {
    userAgent: "Googlebot",
    label: "Googlebot",
    operator: "Google Search",
    category: "search_engine",
    defaultPolicy: "allow",
    description:
      "Indexes pages for Google Search results. Disallowing this will hide your pages from Google.",
    warning:
      "Blocking Googlebot effectively removes you from Google Search — only do this for staging environments.",
    docsUrl:
      "https://developers.google.com/search/docs/crawling-indexing/overview-google-crawlers",
  },
  {
    userAgent: "Bingbot",
    label: "Bingbot",
    operator: "Microsoft Bing",
    category: "search_engine",
    defaultPolicy: "allow",
    description:
      "Indexes pages for Bing Search, Microsoft Copilot grounding, and DuckDuckGo (via Bing partnership).",
    docsUrl:
      "https://www.bing.com/webmasters/help/which-crawlers-does-bing-use-8c184ec0",
  },
  {
    userAgent: "DuckDuckBot",
    label: "DuckDuckBot",
    operator: "DuckDuckGo",
    category: "search_engine",
    defaultPolicy: "allow",
    description: "Crawls pages for DuckDuckGo's instant answers.",
    docsUrl: "https://duckduckgo.com/duckduckbot",
  },
  {
    userAgent: "YandexBot",
    label: "YandexBot",
    operator: "Yandex",
    category: "search_engine",
    defaultPolicy: "allow",
    description:
      "Indexes pages for Yandex Search (primary in Russia, Belarus, Kazakhstan, Turkey).",
    docsUrl:
      "https://yandex.com/support/webmaster/robot-workings/check-yandex-robots.html",
  },
  {
    userAgent: "Baiduspider",
    label: "Baiduspider",
    operator: "Baidu",
    category: "search_engine",
    defaultPolicy: "allow",
    description: "Indexes pages for Baidu Search (primary in mainland China).",
    docsUrl: "https://help.baidu.com/question?prod_id=99&class=476&id=3001",
  },

  // ── AI search / answer engines (treat like search) ────────────────────────
  {
    userAgent: "PerplexityBot",
    label: "PerplexityBot",
    operator: "Perplexity AI",
    category: "ai_search",
    defaultPolicy: "allow",
    description:
      "Crawls pages to ground Perplexity's AI-powered search answers. Blocking removes your site from Perplexity citations.",
    warning:
      "Perplexity drives AI-search referral traffic. Most hospitality sites should keep this allowed.",
    docsUrl: "https://docs.perplexity.ai/guides/bots",
  },
  {
    userAgent: "OAI-SearchBot",
    label: "OAI-SearchBot",
    operator: "OpenAI",
    category: "ai_search",
    defaultPolicy: "allow",
    description:
      "Crawls pages for ChatGPT search results and citations. Does NOT train models — that is GPTBot.",
    warning:
      "Allowing OAI-SearchBot lets your site appear in ChatGPT search results without contributing to model training.",
    docsUrl: "https://platform.openai.com/docs/bots",
  },
  {
    userAgent: "ChatGPT-User",
    label: "ChatGPT-User",
    operator: "OpenAI",
    category: "ai_assistant",
    defaultPolicy: "allow",
    description:
      "Fetches pages on demand when a ChatGPT user explicitly asks it to read a URL. Does not train models.",
    docsUrl: "https://platform.openai.com/docs/bots",
  },
  {
    userAgent: "PerplexityUser",
    label: "Perplexity-User",
    operator: "Perplexity AI",
    category: "ai_assistant",
    defaultPolicy: "allow",
    description:
      "Fetches pages on demand when a Perplexity user asks the assistant to read a URL.",
    docsUrl: "https://docs.perplexity.ai/guides/bots",
  },

  // ── AI training crawlers (default deny) ───────────────────────────────────
  {
    userAgent: "GPTBot",
    label: "GPTBot",
    operator: "OpenAI",
    category: "ai_training",
    defaultPolicy: "disallow",
    description:
      "Crawls pages to train OpenAI foundation models (GPT-4, GPT-5). Blocking does not affect ChatGPT search or on-demand fetches.",
    warning:
      "Most hospitality operators block GPTBot because the content is licensed for guest-facing use, not LLM training.",
    docsUrl: "https://platform.openai.com/docs/bots",
  },
  {
    userAgent: "Google-Extended",
    label: "Google-Extended",
    operator: "Google DeepMind",
    category: "ai_training",
    defaultPolicy: "disallow",
    description:
      "Controls whether Google may use your content to train Gemini and other generative models. Independent from Googlebot.",
    warning:
      "Blocking Google-Extended does NOT affect Google Search ranking — only generative-AI training use.",
    docsUrl:
      "https://developers.google.com/search/docs/crawling-indexing/overview-google-crawlers",
  },
  {
    userAgent: "anthropic-ai",
    label: "anthropic-ai (legacy)",
    operator: "Anthropic",
    category: "ai_training",
    defaultPolicy: "disallow",
    description:
      "Anthropic's legacy training crawler. Still respected; keep alongside ClaudeBot for full coverage.",
    docsUrl:
      "https://support.anthropic.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler",
  },
  {
    userAgent: "ClaudeBot",
    label: "ClaudeBot",
    operator: "Anthropic",
    category: "ai_training",
    defaultPolicy: "disallow",
    description:
      "Anthropic's current crawler used for both research and on-demand fetches by Claude assistants.",
    warning:
      "Note: Anthropic uses ClaudeBot for both training and live Claude lookups, so blocking removes both.",
    docsUrl:
      "https://support.anthropic.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler",
  },
  {
    userAgent: "CCBot",
    label: "CCBot",
    operator: "Common Crawl",
    category: "ai_training",
    defaultPolicy: "disallow",
    description:
      "Common Crawl powers training datasets for most open-source LLMs (Llama, Mistral, Falcon, etc.). Blocking here blocks all of them downstream.",
    warning:
      "Most generative-AI models train on Common Crawl. Blocking CCBot is the single most impactful AI-training opt-out.",
    docsUrl: "https://commoncrawl.org/ccbot",
  },
  {
    userAgent: "Bytespider",
    label: "Bytespider",
    operator: "ByteDance",
    category: "ai_training",
    defaultPolicy: "disallow",
    description:
      "ByteDance's crawler used to train Doubao and other AI models. Aggressive — most operators block.",
    warning:
      "Bytespider has been reported to ignore robots.txt at times. Blocking is best-effort.",
    docsUrl: "https://bytespider.bytedance.com",
  },
  {
    userAgent: "Applebot-Extended",
    label: "Applebot-Extended",
    operator: "Apple Intelligence",
    category: "ai_training",
    defaultPolicy: "disallow",
    description:
      "Controls whether Apple may use your content to train Apple Intelligence and other generative models. Independent from Applebot (search).",
    docsUrl: "https://support.apple.com/en-us/119829",
  },
  {
    userAgent: "Meta-ExternalAgent",
    label: "Meta-ExternalAgent",
    operator: "Meta AI",
    category: "ai_training",
    defaultPolicy: "disallow",
    description:
      "Meta's AI training crawler used for Llama and Meta AI products.",
    docsUrl:
      "https://developers.facebook.com/docs/sharing/webmasters/web-crawlers/",
  },
  {
    userAgent: "cohere-ai",
    label: "cohere-ai",
    operator: "Cohere",
    category: "ai_training",
    defaultPolicy: "disallow",
    description: "Cohere's training crawler.",
    docsUrl: "https://docs.cohere.com",
  },
  {
    userAgent: "Diffbot",
    label: "Diffbot",
    operator: "Diffbot",
    category: "ai_training",
    defaultPolicy: "disallow",
    description:
      "Commercial knowledge-graph crawler. Often used to resell extracted content to AI vendors.",
    docsUrl: "https://www.diffbot.com/support/crawlbot",
  },
];

export const CRAWLER_USER_AGENTS = new Set(
  CRAWLER_CATALOG.map((entry) => entry.userAgent),
);

/**
 * IndexNow target endpoint. Posting to api.indexnow.org fans the submission
 * out to every participating engine (Bing, Yandex, Naver, Seznam, Yep).
 * https://www.indexnow.org/documentation
 */
export const INDEXNOW_ENDPOINT = "https://api.indexnow.org/IndexNow";
