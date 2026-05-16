/**
 * Pure JSON-LD validator. No I/O. Operates on an array of structured-data
 * nodes (Schema.org JSON-LD objects) and returns issues.
 *
 * Scope:
 * - Structural rules (valid object, @context, @type).
 * - Schema.org type recognition for common types we surface.
 * - Google rich-result required-property checks for the types Google
 *   explicitly documents required fields for.
 *
 * Heuristic, not exhaustive — we surface high-signal issues without trying
 * to be a full Schema.org validator.
 */

export type JsonLdNode = Record<string, unknown>;

export type JsonLdIssueSeverity = "ERROR" | "WARNING" | "INFO";

export interface JsonLdIssue {
  nodeIndex: number;
  path: string;
  severity: JsonLdIssueSeverity;
  ruleId: string;
  message: string;
}

export interface JsonLdValidationResult {
  issues: JsonLdIssue[];
  bySeverity: Record<JsonLdIssueSeverity, number>;
}

const SCHEMA_ORG_CONTEXT = "https://schema.org";

/**
 * Subset of Schema.org types we recognize. Unknown types are surfaced as
 * a WARNING — not an error — because Schema.org is continuously extended.
 */
const KNOWN_SCHEMA_TYPES = new Set<string>([
  "Article",
  "BlogPosting",
  "BreadcrumbList",
  "Event",
  "FAQPage",
  "HotelRoom",
  "Hotel",
  "HospitalityBusiness",
  "HowTo",
  "ImageObject",
  "JobPosting",
  "LocalBusiness",
  "LodgingBusiness",
  "NewsArticle",
  "Offer",
  "Organization",
  "Person",
  "Place",
  "PostalAddress",
  "Product",
  "Recipe",
  "Resort",
  "Restaurant",
  "Review",
  "Service",
  "SoftwareApplication",
  "VideoObject",
  "WebPage",
  "WebSite",
]);

/**
 * Google rich-result required-property rules for types where Google
 * documents required fields. Keys are Schema.org type names; values are
 * the property names that MUST be present for Google to pick the result up.
 */
const GOOGLE_REQUIRED_PROPS: Record<string, string[]> = {
  Article: ["headline"],
  BlogPosting: ["headline"],
  NewsArticle: ["headline"],
  Event: ["name", "startDate", "location"],
  FAQPage: ["mainEntity"],
  HowTo: ["name", "step"],
  JobPosting: ["title", "datePosted", "hiringOrganization", "jobLocation"],
  Product: ["name"],
  Recipe: ["name", "recipeIngredient", "recipeInstructions"],
  Review: ["itemReviewed", "reviewRating", "author"],
  VideoObject: ["name", "uploadDate", "thumbnailUrl"],
  BreadcrumbList: ["itemListElement"],
};

const MAX_NODE_DEPTH = 12;
const MAX_NODES = 50;

function isPlainObject(value: unknown): value is JsonLdNode {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function getDepth(value: unknown, depth = 0): number {
  if (depth > MAX_NODE_DEPTH) return depth;
  if (Array.isArray(value)) {
    return value.reduce<number>(
      (max, entry) => Math.max(max, getDepth(entry, depth + 1)),
      depth,
    );
  }
  if (isPlainObject(value)) {
    return Object.values(value).reduce<number>(
      (max, entry) => Math.max(max, getDepth(entry, depth + 1)),
      depth,
    );
  }
  return depth;
}

function extractTypes(node: JsonLdNode): string[] {
  const raw = node["@type"];
  if (typeof raw === "string") return [raw];
  if (Array.isArray(raw)) {
    return raw.filter((value): value is string => typeof value === "string");
  }
  return [];
}

function validateNode(node: unknown, index: number): JsonLdIssue[] {
  const issues: JsonLdIssue[] = [];

  if (!isPlainObject(node)) {
    issues.push({
      nodeIndex: index,
      path: "$",
      severity: "ERROR",
      ruleId: "node.not_object",
      message: "Each JSON-LD node must be a plain object.",
    });
    return issues;
  }

  // @context
  const ctx = node["@context"];
  if (ctx === undefined) {
    issues.push({
      nodeIndex: index,
      path: "$.@context",
      severity: "WARNING",
      ruleId: "context.missing",
      message: '"@context" is missing. Add "@context": "https://schema.org".',
    });
  } else if (typeof ctx === "string" && ctx !== SCHEMA_ORG_CONTEXT) {
    issues.push({
      nodeIndex: index,
      path: "$.@context",
      severity: "WARNING",
      ruleId: "context.unexpected",
      message: `"@context" is "${ctx}". Most Google rich results expect "https://schema.org".`,
    });
  } else if (typeof ctx !== "string" && !isPlainObject(ctx)) {
    issues.push({
      nodeIndex: index,
      path: "$.@context",
      severity: "ERROR",
      ruleId: "context.invalid_type",
      message: '"@context" must be a string or object.',
    });
  }

  // @type
  const types = extractTypes(node);
  if (types.length === 0) {
    issues.push({
      nodeIndex: index,
      path: "$.@type",
      severity: "ERROR",
      ruleId: "type.missing",
      message: '"@type" is required.',
    });
    return issues;
  }

  for (const t of types) {
    if (!KNOWN_SCHEMA_TYPES.has(t)) {
      issues.push({
        nodeIndex: index,
        path: "$.@type",
        severity: "WARNING",
        ruleId: "type.unknown",
        message: `"${t}" is not a recognized Schema.org type from our reference set. Make sure it is spelled correctly.`,
      });
    }
  }

  // Google required properties
  for (const t of types) {
    const required = GOOGLE_REQUIRED_PROPS[t];
    if (!required) continue;
    for (const prop of required) {
      const value = node[prop];
      const missing =
        value === undefined ||
        value === null ||
        (typeof value === "string" && value.trim() === "") ||
        (Array.isArray(value) && value.length === 0);
      if (missing) {
        issues.push({
          nodeIndex: index,
          path: `$.${prop}`,
          severity: "ERROR",
          ruleId: `google.${t}.required.${prop}`,
          message: `"${t}" is missing required property "${prop}" for Google rich results.`,
        });
      }
    }
  }

  // URL sanity for @id / url
  for (const key of ["@id", "url"]) {
    const value = node[key];
    if (typeof value === "string" && value.length > 0) {
      if (!/^https?:\/\//i.test(value) && !value.startsWith("#")) {
        issues.push({
          nodeIndex: index,
          path: `$.${key}`,
          severity: "WARNING",
          ruleId: `${key}.not_absolute_url`,
          message: `"${key}" should be an absolute URL (https://…).`,
        });
      }
    }
  }

  // Depth
  if (getDepth(node) > MAX_NODE_DEPTH) {
    issues.push({
      nodeIndex: index,
      path: "$",
      severity: "WARNING",
      ruleId: "node.too_deep",
      message: `Node is nested deeper than ${MAX_NODE_DEPTH} levels. Search engines may truncate it.`,
    });
  }

  return issues;
}

export function validateJsonLdNodes(nodes: unknown): JsonLdValidationResult {
  const issues: JsonLdIssue[] = [];

  if (!Array.isArray(nodes)) {
    issues.push({
      nodeIndex: -1,
      path: "$",
      severity: "ERROR",
      ruleId: "input.not_array",
      message: "JSON-LD input must be an array of nodes.",
    });
    return {
      issues,
      bySeverity: { ERROR: 1, WARNING: 0, INFO: 0 },
    };
  }

  if (nodes.length > MAX_NODES) {
    issues.push({
      nodeIndex: -1,
      path: "$",
      severity: "WARNING",
      ruleId: "input.too_many_nodes",
      message: `Graph has ${nodes.length} nodes; keep it under ${MAX_NODES} for predictable indexing.`,
    });
  }

  nodes.forEach((node, index) => {
    issues.push(...validateNode(node, index));
  });

  const bySeverity: Record<JsonLdIssueSeverity, number> = {
    ERROR: 0,
    WARNING: 0,
    INFO: 0,
  };
  for (const issue of issues) {
    bySeverity[issue.severity] += 1;
  }

  return { issues, bySeverity };
}
