import { createContext, useContext, type ReactNode } from "react";

export type ContactRuntimeFormType =
  | "CONTACT"
  | "INQUIRY"
  | "AVAILABILITY_REQUEST"
  | "GROUP_STAY"
  | string;

export type ContactRuntimeFieldType =
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

export interface ContactRuntimeFieldDefinition {
  key: string;
  label: string;
  placeholder?: string;
  helpText?: string;
  type: ContactRuntimeFieldType;
  required: boolean;
  sortOrder: number;
  options?: Array<string | { label: string; value: string }>;
  defaultValue?: string | boolean | number | null;
  isPlatformManaged?: boolean;
  visibilityRules?: Record<string, unknown> | null;
}

export interface ContactRuntimeResolvedForm {
  id: string;
  key: string;
  name: string;
  description: string;
  formType: ContactRuntimeFormType;
  assignment?: {
    pageSlugs?: string[];
    locales?: string[];
  } | null;
  schemaVersion?: {
    id: string;
    versionNumber: number;
    publishedAt: string | null;
  } | null;
  fields: ContactRuntimeFieldDefinition[];
}

export interface ContactRuntimeFormOption {
  id: string;
  key: string;
  name: string;
  status?: string;
  assignment?: {
    pageSlugs?: string[];
    locales?: string[];
  } | null;
}

export interface ContactRuntimeResolveParams {
  formKey?: string;
  pageSlug?: string | null;
  locale?: string | null;
}

export interface ContactRuntimeSubmitPayload {
  formType?: ContactRuntimeFormType;
  formKey?: string;
  formDefinitionId?: string;
  formSchemaVersionId?: string;
  pageSlug?: string | null;
  locale?: string | null;
  fields?: Record<string, unknown>;
  name?: string;
  email?: string;
  message?: string;
  _trap?: string;
}

export interface ContactRuntimeNotification {
  type: "success" | "error";
  message: string;
}

export interface ContactSectionRuntimeValue {
  pageSlug?: string | null;
  locale?: string | null;
  availableForms?: ContactRuntimeFormOption[];
  loadingForms?: boolean;
  formsError?: string | null;
  resolveForm?: (
    params: ContactRuntimeResolveParams,
  ) => Promise<ContactRuntimeResolvedForm | null>;
  submitForm?: (payload: ContactRuntimeSubmitPayload) => Promise<unknown>;
  notify?: (notification: ContactRuntimeNotification) => void;
}

const ContactSectionRuntimeContext =
  createContext<ContactSectionRuntimeValue | null>(null);

export function ContactSectionRuntimeProvider({
  value,
  children,
}: {
  value: ContactSectionRuntimeValue;
  children: ReactNode;
}) {
  return (
    <ContactSectionRuntimeContext.Provider value={value}>
      {children}
    </ContactSectionRuntimeContext.Provider>
  );
}

export function useContactSectionRuntime() {
  return useContext(ContactSectionRuntimeContext);
}
