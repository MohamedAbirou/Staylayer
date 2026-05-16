/**
 * Pure CSV parser/serializer for redirect import/export. RFC-4180 friendly:
 *   • Fields may be quoted; quotes inside are doubled (`""`).
 *   • LF or CRLF line endings accepted on input.
 *   • Header row is required and case-insensitive.
 *
 * Accepted columns (header names, case-insensitive, * = required):
 *   from*, to*, status, locale, reason, enabled, source
 *
 * Synonyms: `from_path`/`source_path` → from, `to_path`/`destination` → to,
 * `status_code` → status, `permanent` → status (true=301, false=302).
 */

import { normalizeRedirectPath } from "./redirect-analyzer";

export interface CsvParseError {
  line: number;
  column?: string;
  message: string;
}

export interface ParsedRedirectRow {
  line: number;
  fromPath: string;
  toPath: string;
  statusCode: number;
  locale: string | null;
  reason: string | null;
  enabled: boolean;
  source: string;
}

export interface CsvParseResult {
  rows: ParsedRedirectRow[];
  errors: CsvParseError[];
}

const FROM_HEADERS = new Set(["from", "from_path", "source_path", "old"]);
const TO_HEADERS = new Set(["to", "to_path", "destination", "new", "target"]);
const STATUS_HEADERS = new Set(["status", "status_code", "code"]);
const LOCALE_HEADERS = new Set(["locale", "language", "lang"]);
const REASON_HEADERS = new Set(["reason", "note", "notes"]);
const ENABLED_HEADERS = new Set(["enabled", "active"]);
const SOURCE_HEADERS = new Set(["source", "origin"]);
const PERMANENT_HEADERS = new Set(["permanent"]);
const ALLOWED_STATUS_CODES = new Set([301, 302, 307, 308]);
const ALLOWED_SOURCES = new Set([
  "MANUAL",
  "CSV_IMPORT",
  "SLUG_CHANGE",
  "PAGE_DELETE",
]);

/**
 * Split a single CSV line into fields, honoring quoted commas and escaped
 * `""` quotes. Returns the list of cells (without surrounding quotes).
 */
export function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let buf = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          buf += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        buf += ch;
      }
    } else if (ch === ",") {
      cells.push(buf);
      buf = "";
    } else if (ch === '"' && buf.length === 0) {
      inQuotes = true;
    } else {
      buf += ch;
    }
  }
  cells.push(buf);
  return cells;
}

function parseBoolean(value: string | undefined): boolean | null {
  if (value === undefined) return null;
  const v = value.trim().toLowerCase();
  if (["1", "true", "yes", "y", "on", "enabled"].includes(v)) return true;
  if (["0", "false", "no", "n", "off", "disabled"].includes(v)) return false;
  if (v === "") return null;
  return null;
}

function parseStatusCode(value: string | undefined): number | null {
  if (!value) return null;
  const n = Number.parseInt(value.trim(), 10);
  if (!Number.isFinite(n)) return null;
  return n;
}

/**
 * Parse a CSV document into typed rows + per-line errors. Never throws.
 * The caller decides what to do with errors (e.g. abort the import in strict
 * mode, skip rows in lenient mode).
 */
export function parseRedirectsCsv(text: string): CsvParseResult {
  const result: CsvParseResult = { rows: [], errors: [] };
  if (!text || text.trim().length === 0) {
    result.errors.push({ line: 1, message: "Empty CSV." });
    return result;
  }

  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  // Drop trailing empty lines
  while (lines.length > 0 && lines[lines.length - 1]!.trim() === "") {
    lines.pop();
  }
  if (lines.length === 0) {
    result.errors.push({ line: 1, message: "Empty CSV." });
    return result;
  }

  const header = splitCsvLine(lines[0]!).map((h) =>
    h
      .trim()
      .toLowerCase()
      .replace(/^['"]|['"]$/g, ""),
  );
  const findIdx = (allowed: Set<string>): number =>
    header.findIndex((h) => allowed.has(h));

  const fromIdx = findIdx(FROM_HEADERS);
  const toIdx = findIdx(TO_HEADERS);
  const statusIdx = findIdx(STATUS_HEADERS);
  const localeIdx = findIdx(LOCALE_HEADERS);
  const reasonIdx = findIdx(REASON_HEADERS);
  const enabledIdx = findIdx(ENABLED_HEADERS);
  const sourceIdx = findIdx(SOURCE_HEADERS);
  const permanentIdx = findIdx(PERMANENT_HEADERS);

  if (fromIdx < 0 || toIdx < 0) {
    result.errors.push({
      line: 1,
      message:
        "CSV must contain 'from' and 'to' columns (synonyms: from_path/source_path, to_path/destination).",
    });
    return result;
  }

  for (let i = 1; i < lines.length; i++) {
    const raw = lines[i]!;
    if (raw.trim() === "") continue;
    const cells = splitCsvLine(raw);
    const lineNum = i + 1;

    const fromRaw = (cells[fromIdx] ?? "").trim();
    const toRaw = (cells[toIdx] ?? "").trim();
    if (!fromRaw) {
      result.errors.push({
        line: lineNum,
        column: "from",
        message: "Missing 'from' value.",
      });
      continue;
    }
    if (!toRaw) {
      result.errors.push({
        line: lineNum,
        column: "to",
        message: "Missing 'to' value.",
      });
      continue;
    }

    const fromPath = normalizeRedirectPath(fromRaw);
    const toPath = normalizeRedirectPath(toRaw);
    if (fromPath === toPath) {
      result.errors.push({
        line: lineNum,
        message: `'from' and 'to' are identical (${fromPath}).`,
      });
      continue;
    }

    let statusCode: number | null = null;
    if (statusIdx >= 0) statusCode = parseStatusCode(cells[statusIdx]);
    if (statusCode === null && permanentIdx >= 0) {
      const perm = parseBoolean(cells[permanentIdx]);
      if (perm !== null) statusCode = perm ? 301 : 302;
    }
    if (statusCode === null) statusCode = 301;
    if (!ALLOWED_STATUS_CODES.has(statusCode)) {
      result.errors.push({
        line: lineNum,
        column: "status",
        message: `Status code ${statusCode} not allowed (use 301, 302, 307, or 308).`,
      });
      continue;
    }

    let locale: string | null = null;
    if (localeIdx >= 0) {
      const raw = (cells[localeIdx] ?? "").trim();
      locale = raw === "" || raw === "*" ? null : raw;
    }

    const reason =
      reasonIdx >= 0 && cells[reasonIdx] && cells[reasonIdx]!.trim() !== ""
        ? cells[reasonIdx]!.trim()
        : null;

    let enabled = true;
    if (enabledIdx >= 0) {
      const parsed = parseBoolean(cells[enabledIdx]);
      if (parsed !== null) enabled = parsed;
    }

    let source = "CSV_IMPORT";
    if (sourceIdx >= 0 && cells[sourceIdx]) {
      const raw = cells[sourceIdx]!.trim().toUpperCase();
      if (raw !== "") {
        if (!ALLOWED_SOURCES.has(raw)) {
          result.errors.push({
            line: lineNum,
            column: "source",
            message: `Unknown source '${raw}'.`,
          });
          continue;
        }
        source = raw;
      }
    }

    result.rows.push({
      line: lineNum,
      fromPath,
      toPath,
      statusCode,
      locale,
      reason,
      enabled,
      source,
    });
  }

  return result;
}

function escapeCsvCell(value: string | number | boolean | null): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export interface SerializableRedirect {
  fromPath: string;
  toPath: string;
  statusCode: number;
  locale: string | null;
  reason: string | null;
  enabled: boolean;
  source: string;
}

export function serializeRedirectsCsv(rows: SerializableRedirect[]): string {
  const header = [
    "from",
    "to",
    "status",
    "locale",
    "reason",
    "enabled",
    "source",
  ];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        escapeCsvCell(r.fromPath),
        escapeCsvCell(r.toPath),
        escapeCsvCell(r.statusCode),
        escapeCsvCell(r.locale ?? ""),
        escapeCsvCell(r.reason ?? ""),
        escapeCsvCell(r.enabled ? "true" : "false"),
        escapeCsvCell(r.source),
      ].join(","),
    );
  }
  return lines.join("\n") + "\n";
}
