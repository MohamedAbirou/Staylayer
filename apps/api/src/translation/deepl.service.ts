import { Injectable, Logger } from "@nestjs/common";

export interface DeepLTranslateRequest {
  texts: string[];
  sourceLang: string;
  targetLang: string;
  glossaryId?: string;
}

export interface DeepLTranslateResult {
  translations: { text: string; detectedSourceLang: string }[];
  charactersConsumed: number;
}

export interface DeepLGlossaryCreateRequest {
  name: string;
  sourceLang: string;
  targetLang: string;
  entries: { source: string; target: string }[];
}

export interface DeepLGlossaryInfo {
  glossaryId: string;
  name: string;
  sourceLang: string;
  targetLang: string;
  entryCount: number;
}

@Injectable()
export class DeepLService {
  private readonly logger = new Logger(DeepLService.name);
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor() {
    this.apiKey = process.env.DEEPL_API_KEY ?? "";
    this.baseUrl = process.env.DEEPL_API_URL ?? "https://api-free.deepl.com/v2";
  }

  isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  async translate(request: DeepLTranslateRequest): Promise<DeepLTranslateResult> {
    if (!this.isConfigured()) {
      throw new Error("DeepL API key is not configured");
    }

    const body: Record<string, unknown> = {
      text: request.texts,
      source_lang: request.sourceLang.toUpperCase(),
      target_lang: this.normalizeTargetLang(request.targetLang),
    };

    if (request.glossaryId) {
      body.glossary_id = request.glossaryId;
    }

    const response = await fetch(`${this.baseUrl}/translate`, {
      method: "POST",
      headers: {
        Authorization: `DeepL-Auth-Key ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      this.logger.error(
        `DeepL API error: ${response.status} ${errorBody}`,
      );
      throw new Error(
        `DeepL translation failed: ${response.status} ${response.statusText}`,
      );
    }

    const data = (await response.json()) as {
      translations: { text: string; detected_source_language: string }[];
    };

    const charactersConsumed = request.texts.reduce(
      (sum, t) => sum + t.length,
      0,
    );

    return {
      translations: data.translations.map((t) => ({
        text: t.text,
        detectedSourceLang: t.detected_source_language,
      })),
      charactersConsumed,
    };
  }

  async createGlossary(
    request: DeepLGlossaryCreateRequest,
  ): Promise<DeepLGlossaryInfo> {
    if (!this.isConfigured()) {
      throw new Error("DeepL API key is not configured");
    }

    const tsvEntries = request.entries
      .map((e) => `${e.source}\t${e.target}`)
      .join("\n");

    const response = await fetch(`${this.baseUrl}/glossaries`, {
      method: "POST",
      headers: {
        Authorization: `DeepL-Auth-Key ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: request.name,
        source_lang: request.sourceLang.toUpperCase(),
        target_lang: this.normalizeTargetLang(request.targetLang),
        entries: tsvEntries,
        entries_format: "tsv",
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      this.logger.error(`DeepL glossary create error: ${response.status} ${errorBody}`);
      throw new Error(
        `DeepL glossary creation failed: ${response.status} ${response.statusText}`,
      );
    }

    const data = (await response.json()) as {
      glossary_id: string;
      name: string;
      source_lang: string;
      target_lang: string;
      entry_count: number;
    };

    return {
      glossaryId: data.glossary_id,
      name: data.name,
      sourceLang: data.source_lang,
      targetLang: data.target_lang,
      entryCount: data.entry_count,
    };
  }

  async deleteGlossary(glossaryId: string): Promise<void> {
    if (!this.isConfigured()) return;

    await fetch(`${this.baseUrl}/glossaries/${glossaryId}`, {
      method: "DELETE",
      headers: {
        Authorization: `DeepL-Auth-Key ${this.apiKey}`,
      },
    });
  }

  private normalizeTargetLang(lang: string): string {
    const upper = lang.toUpperCase();
    if (upper === "EN") return "EN-US";
    if (upper === "PT") return "PT-BR";
    return upper;
  }
}
