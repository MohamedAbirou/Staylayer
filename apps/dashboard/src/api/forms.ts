import client from "./client";

export type FormType =
  | "CONTACT"
  | "INQUIRY"
  | "AVAILABILITY_REQUEST"
  | "GROUP_STAY";

export type FormDefinitionStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";

export type FormFieldType =
  | "SINGLE_LINE_TEXT"
  | "MULTI_LINE_TEXT"
  | "EMAIL"
  | "PHONE"
  | "SELECT"
  | "RADIO"
  | "CHECKBOX"
  | "DATE"
  | "NUMBER"
  | "HIDDEN";

export type FormEmailTemplateType =
  | "INTERNAL_NOTIFICATION"
  | "GUEST_CONFIRMATION";

export interface FormFieldDefinition {
  id?: string;
  key: string;
  label: string;
  placeholder?: string;
  helpText?: string;
  type: FormFieldType;
  required: boolean;
  sortOrder: number;
  validation?: Record<string, unknown> | null;
  options?: Array<string | { label: string; value: string }>;
  defaultValue?: string | null;
  isPlatformManaged?: boolean;
  visibilityRules?: Record<string, unknown> | null;
}

export interface FormRoutingRule {
  id?: string;
  name: string;
  pageSlug?: string | null;
  locale?: string | null;
  priority: number;
  isActive: boolean;
  saveToInbox: boolean;
  emailRecipients: string[];
  integrationProvider: string;
  integrationConfig: Record<string, unknown>;
  integrationSecret?: string;
  integrationSecretConfigured?: boolean;
  webhookUrl: string;
  webhookSecret: string;
  webhookSecretConfigured?: boolean;
  sendConfirmationEmail: boolean;
  confirmationReplyToFieldKey: string;
}

export interface FormSchemaVersionSummary {
  id: string;
  versionNumber: number;
  publishedAt: string | null;
  createdAt?: string;
}

export interface FormDefinition {
  id: string;
  key: string;
  name: string;
  description: string;
  formType: FormType;
  status: FormDefinitionStatus;
  assignment: {
    pageSlugs?: string[];
    locales?: string[];
  } | null;
  fields: FormFieldDefinition[];
  routingRules: FormRoutingRule[];
  activeSchemaVersion: FormSchemaVersionSummary | null;
  schemaVersions: FormSchemaVersionSummary[];
  emailTemplates: Array<{
    id: string;
    templateType: FormEmailTemplateType;
    enabled: boolean;
    name: string;
  }>;
}

export interface FormStudioResponse {
  definitions: FormDefinition[];
  siteRoutingRules: FormRoutingRule[];
}

export interface FormEmailTheme {
  id: string;
  brandName: string;
  logoUrl: string;
  primaryColor: string;
  accentColor: string;
  surfaceColor: string;
  textColor: string;
  typographyFamily: string;
  buttonStyle?: Record<string, unknown> | null;
  cardStyle?: Record<string, unknown> | null;
  headerContent?: unknown;
  footerContent?: unknown;
}

export interface FormEmailTemplate {
  id: string;
  formDefinitionId?: string | null;
  templateType: FormEmailTemplateType;
  name: string;
  enabled: boolean;
  subjectTemplate: string;
  previewText: string;
  blocks: unknown;
  fieldOrder: string[];
  formDefinition?: {
    id: string;
    key: string;
    name: string;
  } | null;
}

export interface FormEmailStudioResponse {
  theme: FormEmailTheme;
  templates: FormEmailTemplate[];
}

export interface SaveFormDefinitionPayload {
  key: string;
  name: string;
  description?: string;
  formType: FormType;
  assignment?: Record<string, unknown>;
  fields: Array<{
    key: string;
    label: string;
    placeholder?: string;
    helpText?: string;
    type: FormFieldType;
    required?: boolean;
    sortOrder?: number;
    validation?: Record<string, unknown>;
    options?: unknown;
    defaultValue?: string;
    isPlatformManaged?: boolean;
    visibilityRules?: Record<string, unknown>;
  }>;
  routingRules?: Array<{
    id?: string;
    name?: string;
    pageSlug?: string;
    locale?: string;
    priority?: number;
    isActive?: boolean;
    saveToInbox?: boolean;
    emailRecipients?: string[];
    integrationProvider?: string;
    integrationConfig?: Record<string, unknown>;
    integrationSecret?: string;
    webhookUrl?: string;
    webhookSecret?: string;
    sendConfirmationEmail?: boolean;
    confirmationReplyToFieldKey?: string;
  }>;
}

export interface UpdateSiteRoutingPayload {
  routingRules: SaveFormDefinitionPayload["routingRules"];
}

export interface UpdateFormEmailStudioPayload {
  theme?: Partial<FormEmailTheme>;
  templates?: Array<{
    id?: string;
    formDefinitionId?: string;
    templateType: FormEmailTemplateType;
    name: string;
    enabled?: boolean;
    subjectTemplate: string;
    previewText?: string;
    blocks?: unknown;
    fieldOrder?: string[];
  }>;
}

export interface FormEmailPreview {
  subject: string;
  previewText: string;
  html: string;
  text: string;
  templateId: string;
  themeId: string;
  enabled: boolean;
}

export async function getFormStudio(siteId: string) {
  const { data } = await client.get<FormStudioResponse>("/forms", {
    params: { siteId },
  });
  return data;
}

export async function createFormDefinition(
  siteId: string,
  payload: SaveFormDefinitionPayload,
) {
  const { data } = await client.post<FormDefinition>("/forms", payload, {
    params: { siteId },
  });
  return data;
}

export async function updateFormDefinition(
  siteId: string,
  formId: string,
  payload: SaveFormDefinitionPayload,
) {
  const { data } = await client.put<FormDefinition>(
    `/forms/${formId}`,
    payload,
    {
      params: { siteId },
    },
  );
  return data;
}

export async function publishFormDefinition(siteId: string, formId: string) {
  const { data } = await client.post<FormDefinition>(
    `/forms/${formId}/publish`,
    {},
    { params: { siteId } },
  );
  return data;
}

export async function updateSiteRoutingRules(
  siteId: string,
  payload: UpdateSiteRoutingPayload,
) {
  const { data } = await client.patch<{ routingRules: FormRoutingRule[] }>(
    "/forms/routing/fallback",
    payload,
    { params: { siteId } },
  );
  return data;
}

export async function getFormEmailStudio(siteId: string) {
  const { data } = await client.get<FormEmailStudioResponse>("/forms/email", {
    params: { siteId },
  });
  return data;
}

export async function updateFormEmailStudio(
  siteId: string,
  payload: UpdateFormEmailStudioPayload,
) {
  const { data } = await client.patch<FormEmailStudioResponse>(
    "/forms/email",
    payload,
    { params: { siteId } },
  );
  return data;
}

export async function previewFormEmail(
  siteId: string,
  payload: {
    templateType: FormEmailTemplateType;
    formDefinitionId?: string;
    samplePayload?: Record<string, unknown>;
  },
) {
  const { data } = await client.post<FormEmailPreview>(
    "/forms/email/preview",
    payload,
    { params: { siteId } },
  );
  return data;
}

export async function sendTestFormEmail(
  siteId: string,
  payload: {
    templateType: FormEmailTemplateType;
    formDefinitionId?: string;
    samplePayload?: Record<string, unknown>;
    recipientEmail: string;
  },
) {
  const { data } = await client.post<{
    accepted: string[];
    rejected: string[];
    messageId: string;
  }>("/forms/email/test", payload, { params: { siteId } });
  return data;
}
