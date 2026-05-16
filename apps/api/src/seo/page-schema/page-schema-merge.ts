/**
 * Pure merge logic for per-page JSON-LD overrides.
 *
 * Override shape:
 *   {
 *     mode: "merge" | "replace",
 *     disabledTypes: string[],   // remove auto nodes whose @type matches
 *     customNodes: object[],     // user-authored nodes
 *   }
 *
 * "merge"   → start from auto graph, filter by disabledTypes, append customNodes
 * "replace" → just the customNodes (disabledTypes ignored)
 */

import type { JsonLdNode } from "./page-schema-validator";

export type JsonLdOverrideMode = "merge" | "replace";

export interface JsonLdOverride {
  mode: JsonLdOverrideMode;
  disabledTypes: string[];
  customNodes: JsonLdNode[];
}

export const EMPTY_OVERRIDE: JsonLdOverride = {
  mode: "merge",
  disabledTypes: [],
  customNodes: [],
};

export const MAX_CUSTOM_NODES = 30;
export const MAX_OVERRIDE_BYTES = 64 * 1024;

function isPlainObject(value: unknown): value is JsonLdNode {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function nodeHasType(node: unknown, type: string): boolean {
  if (!isPlainObject(node)) return false;
  const raw = node["@type"];
  if (raw === type) return true;
  if (Array.isArray(raw)) return raw.includes(type);
  return false;
}

/**
 * Coerce raw stored JSON into a canonical JsonLdOverride. Tolerant of
 * partial/legacy shapes; missing fields collapse to defaults.
 */
export function normalizeOverride(raw: unknown): JsonLdOverride {
  if (!isPlainObject(raw)) return EMPTY_OVERRIDE;
  const mode: JsonLdOverrideMode = raw.mode === "replace" ? "replace" : "merge";
  const disabledTypes = Array.isArray(raw.disabledTypes)
    ? raw.disabledTypes.filter(
        (value): value is string => typeof value === "string",
      )
    : [];
  const customNodes = Array.isArray(raw.customNodes)
    ? raw.customNodes.filter(isPlainObject)
    : [];
  return { mode, disabledTypes, customNodes };
}

/**
 * Returns true if the override is effectively a no-op so we can store null
 * and let runtime skip the merge step.
 */
export function isEmptyOverride(override: JsonLdOverride): boolean {
  return (
    override.mode === "merge" &&
    override.disabledTypes.length === 0 &&
    override.customNodes.length === 0
  );
}

export function applyJsonLdOverride(
  autoNodes: JsonLdNode[],
  override: JsonLdOverride,
): JsonLdNode[] {
  if (override.mode === "replace") {
    return override.customNodes.slice();
  }

  const filtered =
    override.disabledTypes.length === 0
      ? autoNodes.slice()
      : autoNodes.filter(
          (node) =>
            !override.disabledTypes.some((type) => nodeHasType(node, type)),
        );

  return [...filtered, ...override.customNodes];
}
