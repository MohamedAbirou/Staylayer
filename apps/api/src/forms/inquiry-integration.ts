import { createHmac } from "node:crypto";

export const INQUIRY_INTEGRATION_PROVIDERS = [
  "email",
  "custom_webhook",
  "zapier",
  "make",
  "n8n",
  "hubspot",
  "salesforce",
  "pipedrive",
  "zoho",
  "pms_api",
] as const;

export type InquiryIntegrationProvider =
  (typeof INQUIRY_INTEGRATION_PROVIDERS)[number];

type InquiryContact = {
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
};

export type InquiryIntegrationEnvelope = {
  event: "form_submission.created";
  submittedAt: string;
  provider: InquiryIntegrationProvider;
  submission: {
    id: string;
    siteId: string;
    formDefinitionId: string | null;
    formSchemaVersionId: string | null;
    routingRuleId: string | null;
    formKey: string | null;
    formType: string;
    pageSlug: string | null;
    locale: string;
    status: string;
    createdAt: string;
  };
  contact: InquiryContact;
  inquiry: {
    subject: string;
    message: string | null;
    source: string;
  };
  fields: Record<string, unknown>;
  site: {
    name: string;
  };
};

export class InquiryIntegrationDeliveryError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
    readonly responseCode: number | null = null,
    readonly metadata?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "InquiryIntegrationDeliveryError";
  }
}

const PROVIDER_SET = new Set<string>(INQUIRY_INTEGRATION_PROVIDERS);
const ENDPOINT_PROVIDERS = new Set<InquiryIntegrationProvider>([
  "custom_webhook",
  "zapier",
  "make",
  "n8n",
  "salesforce",
  "pipedrive",
  "zoho",
  "pms_api",
]);
const SECRET_REQUIRED_PROVIDERS = new Set<InquiryIntegrationProvider>([
  "hubspot",
  "salesforce",
  "pipedrive",
  "zoho",
  "pms_api",
]);

export function normalizeInquiryIntegrationProvider(
  value: unknown,
  hasWebhookDestination = false,
): InquiryIntegrationProvider {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_");

  if (normalized === "none") return "email";
  if (normalized === "custom") return "custom_webhook";
  if (normalized === "automation") return "zapier";
  if (normalized === "crm") return "hubspot";
  if (normalized === "pms") return "pms_api";
  if (PROVIDER_SET.has(normalized)) {
    return normalized as InquiryIntegrationProvider;
  }

  return hasWebhookDestination ? "custom_webhook" : "email";
}

export function isIntegrationProviderConfigured(input: {
  provider: InquiryIntegrationProvider;
  destination?: string | null;
  secret?: string | null;
}) {
  if (input.provider === "email") return false;
  if (ENDPOINT_PROVIDERS.has(input.provider) && !input.destination?.trim()) {
    return false;
  }
  if (SECRET_REQUIRED_PROVIDERS.has(input.provider) && !input.secret?.trim()) {
    return false;
  }
  return true;
}

export function requiresIntegrationSecret(
  provider: InquiryIntegrationProvider,
) {
  return SECRET_REQUIRED_PROVIDERS.has(provider);
}

export function isEndpointIntegrationProvider(
  provider: InquiryIntegrationProvider,
) {
  return ENDPOINT_PROVIDERS.has(provider);
}

export function readIntegrationConfig(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

export function buildInquiryEnvelope(input: {
  provider: InquiryIntegrationProvider;
  submission: InquiryIntegrationEnvelope["submission"];
  fields: Record<string, unknown>;
  siteName: string;
}): InquiryIntegrationEnvelope {
  const contact = readContact(input.fields);
  const message = readFirstString(input.fields, [
    "message",
    "notes",
    "details",
    "inquiry",
    "comments",
  ]);
  const subject = [
    input.siteName,
    input.submission.formKey ?? input.submission.formType,
    contact.name ?? contact.email ?? "Website inquiry",
  ]
    .filter(Boolean)
    .join(" - ");

  return {
    event: "form_submission.created",
    submittedAt: input.submission.createdAt,
    provider: input.provider,
    submission: input.submission,
    contact,
    inquiry: {
      subject,
      message,
      source: "StayLayer",
    },
    fields: input.fields,
    site: {
      name: input.siteName,
    },
  };
}

export async function deliverInquiryIntegration(input: {
  provider: InquiryIntegrationProvider;
  destination: string;
  secret: string | null;
  config: Record<string, unknown>;
  envelope: InquiryIntegrationEnvelope;
  timeoutMs: number;
}) {
  switch (input.provider) {
    case "custom_webhook":
      return postCustomWebhook(input);
    case "zapier":
    case "make":
    case "n8n":
      return postWorkflowIntegration(input);
    case "hubspot":
      return deliverHubSpot(input);
    case "salesforce":
      return deliverSalesforce(input);
    case "pipedrive":
      return deliverPipedrive(input);
    case "zoho":
      return deliverZoho(input);
    case "pms_api":
      return deliverPmsApi(input);
    case "email":
      throw new InquiryIntegrationDeliveryError(
        "Email-only integration cannot be delivered as a webhook",
        false,
      );
  }
}

async function postCustomWebhook(input: {
  provider: InquiryIntegrationProvider;
  destination: string;
  secret: string | null;
  envelope: InquiryIntegrationEnvelope;
  timeoutMs: number;
}) {
  const body = JSON.stringify({
    event: input.envelope.event,
    submission: {
      ...input.envelope.submission,
      fields: input.envelope.fields,
    },
    site: input.envelope.site,
  });
  const headers = buildSignedHeaders(input.secret, body, input.provider);

  return postRawJson({
    url: input.destination,
    body,
    headers,
    provider: input.provider,
    timeoutMs: input.timeoutMs,
  });
}

async function postWorkflowIntegration(input: {
  provider: InquiryIntegrationProvider;
  destination: string;
  secret: string | null;
  envelope: InquiryIntegrationEnvelope;
  timeoutMs: number;
}) {
  const body = JSON.stringify({
    event: input.envelope.event,
    provider: input.provider,
    submittedAt: input.envelope.submittedAt,
    contact: input.envelope.contact,
    inquiry: input.envelope.inquiry,
    fields: input.envelope.fields,
    staylayer: input.envelope.submission,
    site: input.envelope.site,
  });
  const headers = buildSignedHeaders(input.secret, body, input.provider);

  return postRawJson({
    url: input.destination,
    body,
    headers,
    provider: input.provider,
    timeoutMs: input.timeoutMs,
  });
}

async function deliverHubSpot(input: {
  provider: InquiryIntegrationProvider;
  secret: string | null;
  config: Record<string, unknown>;
  envelope: InquiryIntegrationEnvelope;
  timeoutMs: number;
}) {
  const token = requireSecret(input.provider, input.secret);
  const headers = bearerHeaders(token);
  const baseUrl = "https://api.hubapi.com";
  const email = input.envelope.contact.email;
  const properties = compactRecord({
    email,
    firstname: input.envelope.contact.firstName,
    lastname: input.envelope.contact.lastName ?? input.envelope.contact.name,
    phone: input.envelope.contact.phone,
    lifecyclestage: readConfigString(input.config, "lifecycleStage") ?? "lead",
    hs_lead_status: readConfigString(input.config, "leadStatus"),
    company: input.envelope.site.name,
  });

  let contactId: string | null = null;
  if (email) {
    const search = await requestJson({
      url: `${baseUrl}/crm/v3/objects/contacts/search`,
      body: {
        filterGroups: [
          {
            filters: [
              {
                propertyName: "email",
                operator: "EQ",
                value: email,
              },
            ],
          },
        ],
        properties: ["email"],
        limit: 1,
      },
      headers,
      provider: input.provider,
      timeoutMs: input.timeoutMs,
    });
    const result = firstResult(search.json);
    contactId = result ? readRecordString(result, "id") : null;
  }

  if (contactId) {
    await requestJson({
      url: `${baseUrl}/crm/v3/objects/contacts/${contactId}`,
      method: "PATCH",
      body: { properties },
      headers,
      provider: input.provider,
      timeoutMs: input.timeoutMs,
    });
  } else {
    const created = await requestJson({
      url: `${baseUrl}/crm/v3/objects/contacts`,
      body: { properties },
      headers,
      provider: input.provider,
      timeoutMs: input.timeoutMs,
    });
    contactId = readRecordString(created.json, "id");
  }

  if (input.config.createTicket !== false) {
    await requestJson({
      url: `${baseUrl}/crm/v3/objects/tickets`,
      body: {
        properties: compactRecord({
          subject: input.envelope.inquiry.subject,
          content: formatDescription(input.envelope),
          hs_pipeline: readConfigString(input.config, "ticketPipeline"),
          hs_pipeline_stage: readConfigString(input.config, "ticketStage"),
        }),
      },
      headers,
      provider: input.provider,
      timeoutMs: input.timeoutMs,
    });
  }

  return {
    responseCode: 202,
    metadata: {
      provider: input.provider,
      contactId,
    },
  };
}

async function deliverSalesforce(input: {
  provider: InquiryIntegrationProvider;
  destination: string;
  secret: string | null;
  config: Record<string, unknown>;
  envelope: InquiryIntegrationEnvelope;
  timeoutMs: number;
}) {
  const token = requireSecret(input.provider, input.secret);
  const instanceUrl = normalizeBaseUrl(
    readConfigString(input.config, "instanceUrl") ?? input.destination,
    input.provider,
  );
  const apiVersion = readConfigString(input.config, "apiVersion") ?? "v61.0";
  const contact = input.envelope.contact;
  const body = compactRecord({
    FirstName: contact.firstName,
    LastName: contact.lastName ?? contact.name ?? "Website inquiry",
    Company:
      readConfigString(input.config, "company") ?? input.envelope.site.name,
    Email: contact.email,
    Phone: contact.phone,
    LeadSource: readConfigString(input.config, "leadSource") ?? "StayLayer",
    Description: formatDescription(input.envelope),
  });

  const response = await requestJson({
    url: `${instanceUrl}/services/data/${apiVersion}/sobjects/Lead`,
    body,
    headers: bearerHeaders(token),
    provider: input.provider,
    timeoutMs: input.timeoutMs,
  });

  return {
    responseCode: response.responseCode,
    metadata: {
      provider: input.provider,
      leadId: readRecordString(response.json, "id"),
    },
  };
}

async function deliverPipedrive(input: {
  provider: InquiryIntegrationProvider;
  destination: string;
  secret: string | null;
  config: Record<string, unknown>;
  envelope: InquiryIntegrationEnvelope;
  timeoutMs: number;
}) {
  const token = requireSecret(input.provider, input.secret);
  const baseUrl = normalizePipedriveBaseUrl(
    readConfigString(input.config, "companyDomain") ?? input.destination,
  );
  const contact = input.envelope.contact;
  const person = await requestJson({
    url: withApiToken(`${baseUrl}/api/v1/persons`, token),
    body: compactRecord({
      name: contact.name ?? contact.email ?? "Website inquiry",
      email: contact.email
        ? [{ value: contact.email, primary: true }]
        : undefined,
      phone: contact.phone
        ? [{ value: contact.phone, primary: true }]
        : undefined,
    }),
    provider: input.provider,
    timeoutMs: input.timeoutMs,
  });
  const personId = readRecordString(readRecord(person.json, "data"), "id");
  const lead = await requestJson({
    url: withApiToken(`${baseUrl}/api/v1/leads`, token),
    body: compactRecord({
      title: input.envelope.inquiry.subject,
      person_id: personId,
      note: formatDescription(input.envelope),
    }),
    provider: input.provider,
    timeoutMs: input.timeoutMs,
  });

  return {
    responseCode: lead.responseCode,
    metadata: {
      provider: input.provider,
      personId,
      leadId: readRecordString(readRecord(lead.json, "data"), "id"),
    },
  };
}

async function deliverZoho(input: {
  provider: InquiryIntegrationProvider;
  destination: string;
  secret: string | null;
  config: Record<string, unknown>;
  envelope: InquiryIntegrationEnvelope;
  timeoutMs: number;
}) {
  const token = requireSecret(input.provider, input.secret);
  const baseUrl = normalizeBaseUrl(
    readConfigString(input.config, "apiDomain") ||
      input.destination ||
      "https://www.zohoapis.com",
    input.provider,
  );
  const contact = input.envelope.contact;
  const response = await requestJson({
    url: `${baseUrl}/crm/v6/Leads`,
    body: {
      data: [
        compactRecord({
          First_Name: contact.firstName,
          Last_Name: contact.lastName ?? contact.name ?? "Website inquiry",
          Email: contact.email,
          Phone: contact.phone,
          Company: input.envelope.site.name,
          Lead_Source:
            readConfigString(input.config, "leadSource") ?? "StayLayer",
          Description: formatDescription(input.envelope),
        }),
      ],
    },
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
    },
    provider: input.provider,
    timeoutMs: input.timeoutMs,
  });

  return {
    responseCode: response.responseCode,
    metadata: {
      provider: input.provider,
    },
  };
}

async function deliverPmsApi(input: {
  provider: InquiryIntegrationProvider;
  destination: string;
  secret: string | null;
  envelope: InquiryIntegrationEnvelope;
  timeoutMs: number;
}) {
  const token = requireSecret(input.provider, input.secret);
  const body = JSON.stringify({
    type: "reservation_inquiry",
    source: "StayLayer",
    contact: input.envelope.contact,
    reservationRequest: {
      message: input.envelope.inquiry.message,
      pageSlug: input.envelope.submission.pageSlug,
      locale: input.envelope.submission.locale,
      fields: input.envelope.fields,
    },
    staylayer: input.envelope.submission,
    site: input.envelope.site,
  });

  return postRawJson({
    url: input.destination,
    body,
    headers: {
      ...buildSignedHeaders(token, body, input.provider),
      Authorization: `Bearer ${token}`,
    },
    provider: input.provider,
    timeoutMs: input.timeoutMs,
  });
}

function buildSignedHeaders(
  secret: string | null,
  body: string,
  provider: InquiryIntegrationProvider,
) {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-staylayer-event": "form_submission.created",
    "x-staylayer-provider": provider,
  };

  if (secret?.trim()) {
    headers["x-staylayer-signature"] = createHmac("sha256", secret.trim())
      .update(body)
      .digest("hex");
  }

  return headers;
}

async function postRawJson(input: {
  url: string;
  body: string;
  headers: Record<string, string>;
  provider: InquiryIntegrationProvider;
  timeoutMs: number;
}) {
  const response = await fetch(input.url, {
    method: "POST",
    headers: input.headers,
    body: input.body,
    signal: AbortSignal.timeout(input.timeoutMs),
  });

  if (!response.ok) {
    await throwResponseFailure(response, input.provider);
  }

  return {
    responseCode: response.status,
    metadata: {
      provider: input.provider,
      responseStatus: response.status,
    },
  };
}

async function requestJson(input: {
  url: string;
  method?: "POST" | "PATCH";
  body: unknown;
  headers?: Record<string, string>;
  provider: InquiryIntegrationProvider;
  timeoutMs: number;
}): Promise<{ responseCode: number; json: unknown }> {
  const response = await fetch(input.url, {
    method: input.method ?? "POST",
    headers: {
      "content-type": "application/json",
      ...(input.headers ?? {}),
    },
    body: JSON.stringify(input.body),
    signal: AbortSignal.timeout(input.timeoutMs),
  });
  const text = await response.text();
  const json = parseJson(text);

  if (!response.ok) {
    throw new InquiryIntegrationDeliveryError(
      `${input.provider} responded with ${response.status}`,
      response.status >= 500 || response.status === 429,
      response.status,
      text ? { responseBody: text.slice(0, 500) } : undefined,
    );
  }

  return { responseCode: response.status, json };
}

async function throwResponseFailure(
  response: Response,
  provider: InquiryIntegrationProvider,
): Promise<never> {
  const excerpt = (await response.text()).slice(0, 500);
  throw new InquiryIntegrationDeliveryError(
    `${provider} responded with ${response.status}`,
    response.status >= 500 || response.status === 429,
    response.status,
    excerpt ? { responseBody: excerpt } : undefined,
  );
}

function bearerHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

function requireSecret(
  provider: InquiryIntegrationProvider,
  value: string | null,
) {
  const secret = value?.trim();
  if (!secret) {
    throw new InquiryIntegrationDeliveryError(
      `${provider} requires an access token or API key`,
      false,
    );
  }
  return secret;
}

function normalizeBaseUrl(value: string, provider: InquiryIntegrationProvider) {
  const trimmed = value.trim().replace(/\/+$/, "");
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:") {
      throw new Error("Only HTTPS integration endpoints are supported");
    }
    return url.toString().replace(/\/+$/, "");
  } catch {
    throw new InquiryIntegrationDeliveryError(
      `${provider} requires a valid HTTPS base URL`,
      false,
    );
  }
}

function normalizePipedriveBaseUrl(value: string) {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (/^https:\/\//i.test(trimmed)) {
    return normalizeBaseUrl(trimmed, "pipedrive");
  }
  return `https://${trimmed}.pipedrive.com`;
}

function withApiToken(url: string, token: string) {
  const parsed = new URL(url);
  parsed.searchParams.set("api_token", token);
  return parsed.toString();
}

function readContact(fields: Record<string, unknown>): InquiryContact {
  const explicitFirst = readFirstString(fields, ["firstName", "first_name"]);
  const explicitLast = readFirstString(fields, ["lastName", "last_name"]);
  const name = readFirstString(fields, ["name", "fullName", "full_name"]);
  const derived = splitName(name);

  return {
    name,
    firstName: explicitFirst ?? derived.firstName,
    lastName: explicitLast ?? derived.lastName,
    email: readFirstString(fields, ["email", "emailAddress", "email_address"]),
    phone: readFirstString(fields, [
      "phone",
      "phoneNumber",
      "phone_number",
      "mobile",
    ]),
  };
}

function splitName(value: string | null) {
  if (!value) return { firstName: null, lastName: null };
  const parts = value.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: null, lastName: null };
  if (parts.length === 1) return { firstName: null, lastName: parts[0] };
  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts[parts.length - 1],
  };
}

function readFirstString(
  record: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function readConfigString(
  record: Record<string, unknown>,
  key: string,
): string | null {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readRecord(value: unknown, key: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const nested = (value as Record<string, unknown>)[key];
  if (!nested || typeof nested !== "object" || Array.isArray(nested)) return {};
  return nested as Record<string, unknown>;
}

function readRecordString(value: unknown, key: string): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const raw = record[key];
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  if (typeof raw === "number") return String(raw);
  return null;
}

function firstResult(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const results = (value as { results?: unknown }).results;
  if (!Array.isArray(results) || results.length === 0) return null;
  const first = results[0];
  return first && typeof first === "object" && !Array.isArray(first)
    ? (first as Record<string, unknown>)
    : null;
}

function compactRecord(record: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => {
      if (value === null || value === undefined) return false;
      if (typeof value === "string" && !value.trim()) return false;
      if (Array.isArray(value) && value.length === 0) return false;
      return true;
    }),
  );
}

function formatDescription(envelope: InquiryIntegrationEnvelope) {
  const lines = [
    envelope.inquiry.message,
    "",
    `StayLayer submission: ${envelope.submission.id}`,
    `Form: ${envelope.submission.formKey ?? envelope.submission.formType}`,
    `Page: ${envelope.submission.pageSlug ?? "home"}`,
    `Locale: ${envelope.submission.locale}`,
    "",
    "Fields:",
    ...Object.entries(envelope.fields).map(
      ([key, value]) => `${key}: ${String(value ?? "")}`,
    ),
  ];

  return lines.filter((line) => line !== null && line !== undefined).join("\n");
}

function parseJson(value: string) {
  if (!value.trim()) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
