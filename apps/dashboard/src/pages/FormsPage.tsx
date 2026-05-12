import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/useAuth";
import {
  hasActiveSite,
  hasMembershipRole,
  SITE_ADMIN_MEMBERSHIP_ROLES,
} from "../auth/access";
import {
  Inbox,
  Download,
  Filter,
  Clock,
  CheckCircle2,
  XCircle,
  RefreshCw,
  FileText,
  Mail,
  Paintbrush2,
  Plus,
  Save,
  Send,
  Settings2,
  Sparkles,
} from "lucide-react";
import {
  createFormDefinition,
  getFormEmailStudio,
  getFormStudio,
  previewFormEmail,
  publishFormDefinition,
  sendTestFormEmail,
  updateFormDefinition,
  updateFormEmailStudio,
  updateSiteRoutingRules,
  type FormDefinition,
  type UpdateFormEmailStudioPayload,
  type FormEmailStudioResponse,
  type FormEmailTemplateType,
  type FormFieldDefinition,
  type FormFieldType,
  type FormRoutingRule,
  type FormType as StudioFormType,
} from "../api/forms";
import { getSubmissions, updateSubmissionStatus } from "../api/submissions";
import type {
  Submission,
  SubmissionStatus,
  FormType,
} from "../api/submissions";

type FormsTab = "inbox" | "studio" | "email";

type FieldEditor = {
  key: string;
  label: string;
  placeholder: string;
  helpText: string;
  type: FormFieldType;
  required: boolean;
  sortOrder: number;
  optionsText: string;
  defaultValue: string;
  isPlatformManaged: boolean;
};

type DeliveryIntegrationPresetId =
  | "none"
  | "automation"
  | "crm"
  | "pms"
  | "custom";

type RoutingRuleEditor = {
  id?: string;
  name: string;
  pageSlug: string;
  locale: string;
  priority: number;
  emailRecipientsText: string;
  integrationPresetId: DeliveryIntegrationPresetId;
  webhookUrl: string;
  webhookSecret: string;
  sendConfirmationEmail: boolean;
  confirmationReplyToFieldKey: string;
  saveToInbox: boolean;
  isActive: boolean;
};

type FormEditorState = {
  id: string | null;
  key: string;
  name: string;
  description: string;
  formType: StudioFormType;
  assignmentPageSlugs: string;
  assignmentLocales: string;
  fields: FieldEditor[];
  routingRules: RoutingRuleEditor[];
};

type EmailLayoutId = "signature" | "concierge" | "spotlight" | "minimal";

type EmailTemplateEditor = {
  id?: string;
  templateType: FormEmailTemplateType;
  name: string;
  enabled: boolean;
  subjectTemplate: string;
  previewText: string;
  introText: string;
  footerText: string;
  fieldOrder: string[];
  layoutId: EmailLayoutId;
  showContextSummary: boolean;
  showFieldList: boolean;
  showFooter: boolean;
  advancedMode: boolean;
  advancedBlocksText: string;
};

type EmailStudioEditor = {
  brandName: string;
  logoUrl: string;
  primaryColor: string;
  accentColor: string;
  surfaceColor: string;
  textColor: string;
  typographyFamily: string;
  templates: EmailTemplateEditor[];
};

type EmailLayoutPreset = {
  id: EmailLayoutId;
  label: string;
  description: string;
  fieldListVariant: "striped" | "cards" | "minimal";
  defaults: {
    showContextSummary: boolean;
    showFieldList: boolean;
    showFooter: boolean;
  };
};

type DeliveryIntegrationPreset = {
  id: DeliveryIntegrationPresetId;
  label: string;
  description: string;
  endpointLabel: string;
  endpointPlaceholder: string;
  endpointHelp: string;
  secretLabel: string;
  secretPlaceholder: string;
  secretHelp: string;
};

const FORM_FIELD_TYPES: Array<{ value: FormFieldType; label: string }> = [
  { value: "SINGLE_LINE_TEXT", label: "Single line text" },
  { value: "MULTI_LINE_TEXT", label: "Multi-line text" },
  { value: "EMAIL", label: "Email" },
  { value: "PHONE", label: "Phone" },
  { value: "SELECT", label: "Select" },
  { value: "RADIO", label: "Radio" },
  { value: "CHECKBOX", label: "Checkbox" },
  { value: "DATE", label: "Date" },
  { value: "NUMBER", label: "Number" },
  { value: "HIDDEN", label: "Hidden/context" },
];

const STUDIO_FORM_TYPES: Array<{ value: StudioFormType; label: string }> = [
  { value: "CONTACT", label: "General inquiry" },
  { value: "INQUIRY", label: "Stay inquiry" },
  { value: "AVAILABILITY_REQUEST", label: "Availability request" },
  { value: "GROUP_STAY", label: "Group or event inquiry" },
];

const EMAIL_TEMPLATE_LABELS: Record<FormEmailTemplateType, string> = {
  INTERNAL_NOTIFICATION: "Team notification",
  GUEST_CONFIRMATION: "Guest confirmation",
};

const EMAIL_TEMPLATE_DESCRIPTIONS: Record<FormEmailTemplateType, string> = {
  INTERNAL_NOTIFICATION:
    "Sent to your team when a guest submits a contact or stay inquiry.",
  GUEST_CONFIRMATION:
    "Optional auto-reply that confirms the guest message was received.",
};

const SAFE_EMAIL_FONTS: Array<{ value: string; label: string }> = [
  { value: "Arial", label: "Arial" },
  { value: "Helvetica", label: "Helvetica" },
  { value: "Verdana", label: "Verdana" },
  { value: "Georgia", label: "Georgia" },
  { value: "Tahoma", label: "Tahoma" },
];

const EMAIL_LAYOUT_PRESETS: EmailLayoutPreset[] = [
  {
    id: "signature",
    label: "Signature",
    description: "Balanced brand-first layout for polished guest replies.",
    fieldListVariant: "striped",
    defaults: {
      showContextSummary: true,
      showFieldList: true,
      showFooter: true,
    },
  },
  {
    id: "concierge",
    label: "Concierge",
    description:
      "Higher-touch presentation for hospitality and reservations teams.",
    fieldListVariant: "cards",
    defaults: {
      showContextSummary: true,
      showFieldList: true,
      showFooter: true,
    },
  },
  {
    id: "spotlight",
    label: "Spotlight",
    description:
      "Bold hero header for branded confirmations and campaign-style replies.",
    fieldListVariant: "striped",
    defaults: {
      showContextSummary: false,
      showFieldList: true,
      showFooter: true,
    },
  },
  {
    id: "minimal",
    label: "Minimal",
    description: "Compact utility layout for readable staff notifications.",
    fieldListVariant: "minimal",
    defaults: {
      showContextSummary: false,
      showFieldList: true,
      showFooter: true,
    },
  },
];

const DELIVERY_INTEGRATION_PRESETS: DeliveryIntegrationPreset[] = [
  {
    id: "none",
    label: "Email only",
    description:
      "Keep delivery simple and send inquiries only to the inboxes above.",
    endpointLabel: "",
    endpointPlaceholder: "",
    endpointHelp: "",
    secretLabel: "",
    secretPlaceholder: "",
    secretHelp: "",
  },
  {
    id: "automation",
    label: "Automation workflow",
    description:
      "Send inquiries into Zapier, Make, n8n, Pipedream, or another workflow tool.",
    endpointLabel: "Workflow endpoint",
    endpointPlaceholder: "https://hooks.zapier.com/hooks/catch/...",
    endpointHelp: "Paste the catch-hook URL from your automation platform.",
    secretLabel: "Verification token",
    secretPlaceholder: "Optional token or shared secret",
    secretHelp:
      "Optional. Use this when your workflow expects a token outside the URL.",
  },
  {
    id: "crm",
    label: "CRM handoff",
    description:
      "Forward structured inquiries into HubSpot, Salesforce, or another sales pipeline.",
    endpointLabel: "CRM intake endpoint",
    endpointPlaceholder: "https://crm.example.com/api/inquiries",
    endpointHelp:
      "Paste the CRM workflow or middleware endpoint that accepts inquiry payloads.",
    secretLabel: "CRM signing secret",
    secretPlaceholder: "Optional HMAC or shared secret",
    secretHelp:
      "Use this when your CRM bridge validates signed inquiry traffic.",
  },
  {
    id: "pms",
    label: "PMS / reservations",
    description:
      "Route inquiries into a PMS, reservations desk workflow, or hospitality ops service.",
    endpointLabel: "Reservations endpoint",
    endpointPlaceholder: "https://ops.example.com/pms/inquiries",
    endpointHelp:
      "Paste the endpoint that should receive reservation-ready inquiry data.",
    secretLabel: "Shared signing secret",
    secretPlaceholder: "Optional shared secret",
    secretHelp:
      "Add a secret if the PMS or middleware verifies signed requests.",
  },
  {
    id: "custom",
    label: "Custom webhook",
    description:
      "Bring your own endpoint when none of the presets match your delivery flow.",
    endpointLabel: "Webhook URL",
    endpointPlaceholder: "https://example.com/hooks/inquiry",
    endpointHelp: "Paste the full endpoint URL for your custom integration.",
    secretLabel: "Webhook secret",
    secretPlaceholder: "whsec_...",
    secretHelp:
      "Optional HMAC secret used to sign outgoing inquiry delivery payloads.",
  },
];

const DEFAULT_EMAIL_FIELD_KEYS = ["name", "email", "message"];
const MAX_EMAIL_LOGO_FILE_SIZE = 120 * 1024;

const STATUS_LABELS: Record<SubmissionStatus, string> = {
  RECEIVED: "New",
  REVIEWED: "Read",
  SPAM: "Spam",
  ARCHIVED: "Archived",
};

const STATUS_COLORS: Record<SubmissionStatus, string> = {
  RECEIVED: "bg-blue-100 text-blue-700",
  REVIEWED: "bg-gray-100 text-gray-600",
  SPAM: "bg-red-100 text-red-700",
  ARCHIVED: "bg-amber-100 text-amber-700",
};

const FORM_TYPE_LABELS: Record<FormType, string> = {
  CONTACT: "Contact",
  INQUIRY: "Stay inquiry",
  AVAILABILITY_REQUEST: "Availability",
  GROUP_STAY: "Group booking",
};

// ─── Page ────────────────────────────────────────────────────────────────────
export default function FormsPage() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const siteId = session?.activeSite?.id ?? null;
  const canManageSubmissionStatus = hasMembershipRole(
    session,
    SITE_ADMIN_MEMBERSHIP_ROLES,
  );
  const [statusFilter, setStatusFilter] = useState<SubmissionStatus | "all">(
    "all",
  );
  const [tab, setTab] = useState<FormsTab>("inbox");
  const [selectedFormId, setSelectedFormId] = useState<string | "new" | null>(
    null,
  );
  const [formEditor, setFormEditor] = useState<FormEditorState>(() =>
    createBlankFormEditor(),
  );
  const [siteRoutingEditor, setSiteRoutingEditor] = useState<
    RoutingRuleEditor[]
  >([]);
  const [emailStudioEditor, setEmailStudioEditor] = useState<EmailStudioEditor>(
    createBlankEmailStudioEditor(),
  );
  const [activeEmailTemplateType, setActiveEmailTemplateType] =
    useState<FormEmailTemplateType>("INTERNAL_NOTIFICATION");
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [previewText, setPreviewText] = useState<string>("");
  const [testRecipientEmail, setTestRecipientEmail] = useState("");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["submissions", siteId, statusFilter],
    queryFn: () =>
      getSubmissions(siteId!, {
        status: statusFilter !== "all" ? statusFilter : undefined,
      }),
    enabled: !!siteId,
    retry: false,
  });

  const formStudioQuery = useQuery({
    queryKey: ["form-studio", siteId],
    queryFn: () => getFormStudio(siteId!),
    enabled: !!siteId && tab === "studio",
    retry: false,
  });

  const emailStudioQuery = useQuery({
    queryKey: ["form-email-studio", siteId],
    queryFn: () => getFormEmailStudio(siteId!),
    enabled: !!siteId && tab === "email",
    retry: false,
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: SubmissionStatus }) =>
      updateSubmissionStatus(siteId!, id, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["submissions", siteId],
      });
    },
  });

  const saveFormMutation = useMutation({
    mutationFn: () => {
      const payload = serializeFormEditor(formEditor);
      if (formEditor.id) {
        return updateFormDefinition(siteId!, formEditor.id, payload);
      }
      return createFormDefinition(siteId!, payload);
    },
    onSuccess: (savedDefinition) => {
      setSelectedFormId(savedDefinition.id);
      void queryClient.invalidateQueries({ queryKey: ["form-studio", siteId] });
      toast.success("Form saved");
    },
    onError: () => {
      toast.error("Failed to save form");
    },
  });

  const publishFormMutation = useMutation({
    mutationFn: (formId: string) => publishFormDefinition(siteId!, formId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["form-studio", siteId] });
      toast.success("Form published");
    },
    onError: () => {
      toast.error("Failed to publish form");
    },
  });

  const saveSiteRoutingMutation = useMutation({
    mutationFn: () =>
      updateSiteRoutingRules(siteId!, {
        routingRules: siteRoutingEditor.map(serializeRoutingRuleEditor),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["form-studio", siteId] });
      toast.success("Routing rules saved");
    },
    onError: () => {
      toast.error("Failed to save routing rules");
    },
  });

  const saveEmailStudioMutation = useMutation({
    mutationFn: () =>
      updateFormEmailStudio(
        siteId!,
        serializeEmailStudioEditor(emailStudioEditor),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["form-email-studio", siteId],
      });
      toast.success("Email studio saved");
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to save email studio",
      );
    },
  });

  const previewEmailMutation = useMutation({
    mutationFn: () =>
      previewFormEmail(siteId!, {
        templateType: activeEmailTemplateType,
        formDefinitionId:
          selectedFormId && selectedFormId !== "new"
            ? selectedFormId
            : undefined,
      }),
    onSuccess: (preview) => {
      setPreviewHtml(preview.html);
      setPreviewText(preview.text);
    },
    onError: () => {
      toast.error("Failed to generate email preview");
    },
  });

  const sendTestEmailMutation = useMutation({
    mutationFn: () =>
      sendTestFormEmail(siteId!, {
        templateType: activeEmailTemplateType,
        formDefinitionId:
          selectedFormId && selectedFormId !== "new"
            ? selectedFormId
            : undefined,
        recipientEmail: testRecipientEmail,
      }),
    onSuccess: (result) => {
      const acceptedRecipient = result.accepted?.[0] ?? testRecipientEmail;
      toast.success(`Test email sent to ${acceptedRecipient}`);
    },
    onError: () => {
      toast.error("Failed to send test email");
    },
  });

  const submissions: Submission[] = data?.data ?? [];
  const formStudio = formStudioQuery.data ?? null;
  const emailStudio = emailStudioQuery.data ?? null;
  const activeEmailTemplate =
    emailStudioEditor.templates.find(
      (template) => template.templateType === activeEmailTemplateType,
    ) ?? emailStudioEditor.templates[0];
  const emailFieldSuggestions = useMemo(() => {
    const keys = new Set<string>(DEFAULT_EMAIL_FIELD_KEYS);
    const selectedDefinition =
      selectedFormId && selectedFormId !== "new"
        ? formStudio?.definitions.find(
            (definition) => definition.id === selectedFormId,
          )
        : formStudio?.definitions[0];

    selectedDefinition?.fields.forEach((field) => keys.add(field.key));
    emailStudioEditor.templates.forEach((template) => {
      template.fieldOrder.forEach((fieldKey) => keys.add(fieldKey));
    });

    return Array.from(keys);
  }, [formStudio, selectedFormId, emailStudioEditor.templates]);

  const updateActiveEmailTemplate = (
    updater: (template: EmailTemplateEditor) => EmailTemplateEditor,
  ) => {
    setEmailStudioEditor((current) => ({
      ...current,
      templates: current.templates.map((template) =>
        template.templateType === activeEmailTemplateType
          ? updater(template)
          : template,
      ),
    }));
  };

  useEffect(() => {
    if (!formStudio?.definitions.length) {
      setSelectedFormId("new");
      setFormEditor(createBlankFormEditor());
      return;
    }

    if (!selectedFormId) {
      setSelectedFormId(formStudio.definitions[0].id);
      return;
    }

    if (selectedFormId === "new") {
      return;
    }

    const selectedDefinition = formStudio.definitions.find(
      (definition) => definition.id === selectedFormId,
    );
    if (selectedDefinition) {
      setFormEditor(mapDefinitionToEditor(selectedDefinition));
    }
  }, [formStudio, selectedFormId]);

  useEffect(() => {
    if (!formStudio) {
      return;
    }
    setSiteRoutingEditor(
      formStudio.siteRoutingRules.length > 0
        ? formStudio.siteRoutingRules.map(mapRoutingRuleToEditor)
        : [createBlankRoutingRuleEditor()],
    );
  }, [formStudio]);

  useEffect(() => {
    if (!emailStudio) {
      return;
    }

    setEmailStudioEditor(mapEmailStudioToEditor(emailStudio));
  }, [emailStudio]);

  useEffect(() => {
    if (tab !== "email" || !siteId || !emailStudio || !activeEmailTemplate) {
      return;
    }

    previewEmailMutation.mutate();
  }, [tab, siteId, emailStudio, activeEmailTemplateType, activeEmailTemplate]);

  const handleExport = () => {
    if (submissions.length === 0) {
      return;
    }

    const headers = [
      "id",
      "formType",
      "pageSlug",
      "locale",
      "name",
      "email",
      "message",
      "status",
      "createdAt",
      "extra",
    ];
    const rows = submissions.map((submission) => [
      submission.id,
      submission.formType,
      submission.pageSlug ?? "",
      submission.locale,
      submission.name,
      submission.email,
      submission.message,
      submission.status,
      submission.createdAt,
      JSON.stringify(submission.extra ?? {}),
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((value) => toCsvCell(value)).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `inquiries-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  if (!hasActiveSite(session)) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900">
          Inquiry Submissions
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Select a site to view inquiry submissions.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inquiries</h1>
          <p className="mt-1 text-sm text-gray-500">
            Review guest inquiries, manage form coverage, and control how each
            submission is delivered.
          </p>
        </div>
        {tab === "inbox" ? (
          <button
            disabled={submissions.length === 0}
            onClick={handleExport}
            className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-400"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2 rounded-xl border border-gray-200 bg-white p-2 shadow-sm">
        {[
          { id: "inbox", label: "Inbox", icon: Inbox },
          { id: "studio", label: "Forms", icon: Settings2 },
          { id: "email", label: "Emails", icon: Paintbrush2 },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => setTab(item.id as FormsTab)}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                tab === item.id
                  ? "bg-blue-600 text-white"
                  : "text-gray-500 hover:bg-gray-100"
              }`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </button>
          );
        })}
      </div>

      {tab === "inbox" && isError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
          Could not load submissions. Please refresh the page or contact
          support.
        </div>
      )}

      {tab === "inbox" && !canManageSubmissionStatus && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-700">
          You can review inquiry details here, but only site admins can change
          inquiry status.
        </div>
      )}

      {tab === "inbox" ? (
        <>
          <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
            <Filter className="h-4 w-4 text-gray-400" />
            <span className="mr-2 text-xs font-semibold uppercase tracking-widest text-gray-400">
              Status
            </span>
            {(["all", "RECEIVED", "REVIEWED", "ARCHIVED"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  statusFilter === s
                    ? "bg-blue-600 text-white"
                    : "text-gray-500 hover:bg-gray-100"
                }`}
              >
                {s === "all" ? "All" : STATUS_LABELS[s]}
              </button>
            ))}
          </div>

          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            {isLoading ? (
              <div className="flex items-center justify-center py-16 text-sm text-gray-400">
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Loading submissions…
              </div>
            ) : submissions.length === 0 ? (
              <EmptySubmissions />
            ) : (
              <div className="divide-y divide-gray-50">
                {submissions.map((sub) => (
                  <SubmissionRow
                    key={sub.id}
                    submission={sub}
                    canManageStatus={canManageSubmissionStatus}
                    onMarkReviewed={() =>
                      statusMutation.mutate({ id: sub.id, status: "REVIEWED" })
                    }
                    onArchive={() =>
                      statusMutation.mutate({ id: sub.id, status: "ARCHIVED" })
                    }
                  />
                ))}
              </div>
            )}
          </div>
        </>
      ) : null}

      {tab === "studio" ? (
        <div className="grid gap-6 xl:grid-cols-[320px,1fr]">
          <div className="space-y-6">
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">
                    Forms library
                  </h2>
                  <p className="mt-1 text-xs text-gray-500">
                    Create separate inquiry flows for contact, availability, and
                    group bookings.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setSelectedFormId("new");
                    setFormEditor(createBlankFormEditor());
                  }}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white"
                >
                  <Plus className="h-4 w-4" />
                  New form
                </button>
              </div>

              <div className="mt-4 space-y-3">
                {formStudioQuery.isLoading ? (
                  <StudioLoadingCard />
                ) : (
                  (formStudio?.definitions ?? []).map((definition) => (
                    <button
                      key={definition.id}
                      onClick={() => setSelectedFormId(definition.id)}
                      className={`w-full rounded-xl border p-4 text-left transition-colors ${
                        selectedFormId === definition.id
                          ? "border-blue-300 bg-blue-50"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-gray-900">
                            {definition.name}
                          </div>
                          <div className="mt-1 text-xs text-gray-500">
                            {definition.key}
                          </div>
                        </div>
                        <span className="rounded-full bg-gray-100 px-2 py-1 text-[10px] font-semibold text-gray-600">
                          {definition.status}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-gray-500">
                        <span className="rounded bg-gray-100 px-2 py-1">
                          {definition.fields.length} fields
                        </span>
                        <span className="rounded bg-gray-100 px-2 py-1">
                          {definition.routingRules.length} routes
                        </span>
                        {definition.activeSchemaVersion ? (
                          <span className="rounded bg-emerald-100 px-2 py-1 text-emerald-700">
                            v{definition.activeSchemaVersion.versionNumber} live
                          </span>
                        ) : null}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">
                    Default delivery
                  </h2>
                  <p className="mt-1 text-xs text-gray-500">
                    Used when a form has no more specific route. Most sites only
                    need inbox delivery; webhooks stay tucked under Advanced
                    delivery.
                  </p>
                </div>
                <button
                  onClick={() => saveSiteRoutingMutation.mutate()}
                  disabled={saveSiteRoutingMutation.isPending}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700"
                >
                  <Save className="h-4 w-4" />
                  Save delivery
                </button>
              </div>

              <div className="mt-4 space-y-4">
                {siteRoutingEditor.map((rule, index) => (
                  <RoutingRuleEditorCard
                    key={`${rule.name}-${index}`}
                    rule={rule}
                    onChange={(nextRule) => {
                      setSiteRoutingEditor((currentRules) =>
                        currentRules.map((item, itemIndex) =>
                          itemIndex === index ? nextRule : item,
                        ),
                      );
                    }}
                    onRemove={() => {
                      setSiteRoutingEditor((currentRules) =>
                        currentRules.filter(
                          (_, itemIndex) => itemIndex !== index,
                        ),
                      );
                    }}
                  />
                ))}

                <button
                  onClick={() =>
                    setSiteRoutingEditor((currentRules) => [
                      ...currentRules,
                      createBlankRoutingRuleEditor(),
                    ])
                  }
                  className="inline-flex items-center gap-2 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-xs font-semibold text-gray-600"
                >
                  <Plus className="h-4 w-4" />
                  Add fallback route
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {formEditor.id ? "Edit form" : "Create a new form"}
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Publish new schema versions when you change fields so old
                  submissions remain readable.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => saveFormMutation.mutate()}
                  disabled={saveFormMutation.isPending}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700"
                >
                  <Save className="h-4 w-4" />
                  Save draft
                </button>
                <button
                  onClick={() => {
                    if (formEditor.id) {
                      publishFormMutation.mutate(formEditor.id);
                    }
                  }}
                  disabled={!formEditor.id || publishFormMutation.isPending}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  <Sparkles className="h-4 w-4" />
                  Publish version
                </button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <LabeledInput
                label="Form key"
                value={formEditor.key}
                onChange={(value) =>
                  setFormEditor((current) => ({ ...current, key: value }))
                }
                placeholder="contact-primary"
                help="Use this key to target a form from a contact section block."
              />
              <LabeledInput
                label="Form name"
                value={formEditor.name}
                onChange={(value) =>
                  setFormEditor((current) => ({ ...current, name: value }))
                }
                placeholder="Primary inquiry form"
              />
              <LabeledSelect
                label="Form type"
                value={formEditor.formType}
                options={STUDIO_FORM_TYPES}
                onChange={(value) =>
                  setFormEditor((current) => ({
                    ...current,
                    formType: value as StudioFormType,
                  }))
                }
              />
              <LabeledInput
                label="Locales"
                value={formEditor.assignmentLocales}
                onChange={(value) =>
                  setFormEditor((current) => ({
                    ...current,
                    assignmentLocales: value,
                  }))
                }
                placeholder="en, fr"
                help="Leave blank to allow every locale."
              />
              <div className="md:col-span-2">
                <LabeledInput
                  label="Assigned page slugs"
                  value={formEditor.assignmentPageSlugs}
                  onChange={(value) =>
                    setFormEditor((current) => ({
                      ...current,
                      assignmentPageSlugs: value,
                    }))
                  }
                  placeholder="contact-us, weddings"
                  help="Leave blank to make the form available as the default public form."
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700">
                  Description
                </label>
                <textarea
                  value={formEditor.description}
                  onChange={(event) =>
                    setFormEditor((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  className="mt-2 min-h-24 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  placeholder="Briefly explain where this form should be used."
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">Fields</h3>
                <button
                  onClick={() =>
                    setFormEditor((current) => ({
                      ...current,
                      fields: [
                        ...current.fields,
                        createBlankFieldEditor(current.fields.length),
                      ],
                    }))
                  }
                  className="inline-flex items-center gap-2 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-xs font-semibold text-gray-600"
                >
                  <Plus className="h-4 w-4" />
                  Add field
                </button>
              </div>

              <div className="space-y-4">
                {formEditor.fields.map((field, index) => (
                  <FieldEditorCard
                    key={`${field.key}-${index}`}
                    field={field}
                    onChange={(nextField) => {
                      setFormEditor((current) => ({
                        ...current,
                        fields: current.fields.map((item, itemIndex) =>
                          itemIndex === index ? nextField : item,
                        ),
                      }));
                    }}
                    onRemove={() => {
                      setFormEditor((current) => ({
                        ...current,
                        fields: current.fields.filter(
                          (_, itemIndex) => itemIndex !== index,
                        ),
                      }));
                    }}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">
                  Delivery overrides
                </h3>
                <button
                  onClick={() =>
                    setFormEditor((current) => ({
                      ...current,
                      routingRules: [
                        ...current.routingRules,
                        createBlankRoutingRuleEditor(),
                      ],
                    }))
                  }
                  className="inline-flex items-center gap-2 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-xs font-semibold text-gray-600"
                >
                  <Plus className="h-4 w-4" />
                  Add route
                </button>
              </div>
              <div className="space-y-4">
                {formEditor.routingRules.map((rule, index) => (
                  <RoutingRuleEditorCard
                    key={`${rule.name}-${index}`}
                    rule={rule}
                    onChange={(nextRule) => {
                      setFormEditor((current) => ({
                        ...current,
                        routingRules: current.routingRules.map(
                          (item, itemIndex) =>
                            itemIndex === index ? nextRule : item,
                        ),
                      }));
                    }}
                    onRemove={() => {
                      setFormEditor((current) => ({
                        ...current,
                        routingRules: current.routingRules.filter(
                          (_, itemIndex) => itemIndex !== index,
                        ),
                      }));
                    }}
                  />
                ))}
              </div>
            </div>

            {formEditor.id && selectedFormId ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {selectedFormId &&
                formStudio?.definitions.find(
                  (definition) => definition.id === selectedFormId,
                )?.activeSchemaVersion
                  ? `Live schema version: v${formStudio.definitions.find((definition) => definition.id === selectedFormId)?.activeSchemaVersion?.versionNumber}`
                  : "This form has not been published yet."}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {tab === "email" ? (
        <div className="grid gap-6 xl:grid-cols-[1.05fr,0.95fr]">
          <div className="space-y-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Email templates
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Start from tested layouts, brand them safely, and edit only
                  the copy and field order your team actually needs.
                </p>
              </div>
              <button
                onClick={() => saveEmailStudioMutation.mutate()}
                disabled={saveEmailStudioMutation.isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
              >
                <Save className="h-4 w-4" />
                Save templates
              </button>
            </div>

            {emailStudioQuery.isLoading ? (
              <StudioLoadingCard />
            ) : activeEmailTemplate ? (
              <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr),minmax(0,1.05fr)]">
                <div className="space-y-6">
                  <div className="rounded-2xl border border-gray-200 p-5">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900">
                        Brand kit
                      </h3>
                      <p className="mt-1 text-xs text-gray-500">
                        Keep logos, colors, and fonts inside a safe set that
                        renders consistently across inboxes.
                      </p>
                    </div>

                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <LabeledInput
                        label="Brand name"
                        value={emailStudioEditor.brandName}
                        onChange={(value) =>
                          setEmailStudioEditor((current) => ({
                            ...current,
                            brandName: value,
                          }))
                        }
                      />
                      <LabeledSelect
                        label="Safe font"
                        value={emailStudioEditor.typographyFamily}
                        options={SAFE_EMAIL_FONTS}
                        onChange={(value) =>
                          setEmailStudioEditor((current) => ({
                            ...current,
                            typographyFamily: value,
                          }))
                        }
                      />
                      <div className="md:col-span-2">
                        <LogoUploader
                          value={emailStudioEditor.logoUrl}
                          onChange={(value) =>
                            setEmailStudioEditor((current) => ({
                              ...current,
                              logoUrl: value,
                            }))
                          }
                        />
                      </div>
                      <LabeledColorInput
                        label="Brand accent"
                        value={emailStudioEditor.primaryColor}
                        onChange={(value) =>
                          setEmailStudioEditor((current) => ({
                            ...current,
                            primaryColor: value,
                          }))
                        }
                        help="Used for badges, highlights, and the top accent bar."
                      />
                      <LabeledColorInput
                        label="Headline ink"
                        value={emailStudioEditor.accentColor}
                        onChange={(value) =>
                          setEmailStudioEditor((current) => ({
                            ...current,
                            accentColor: value,
                          }))
                        }
                        help="Used for headlines and structural borders."
                      />
                      <LabeledColorInput
                        label="Card background"
                        value={emailStudioEditor.surfaceColor}
                        onChange={(value) =>
                          setEmailStudioEditor((current) => ({
                            ...current,
                            surfaceColor: value,
                          }))
                        }
                        help="Main canvas color inside the email card."
                      />
                      <LabeledColorInput
                        label="Body text"
                        value={emailStudioEditor.textColor}
                        onChange={(value) =>
                          setEmailStudioEditor((current) => ({
                            ...current,
                            textColor: value,
                          }))
                        }
                        help="Main copy color for readable text blocks."
                      />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-gray-200 p-5">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900">
                        Template focus
                      </h3>
                      <p className="mt-1 text-xs text-gray-500">
                        Configure one email at a time so the copy, layout, and
                        preview stay aligned.
                      </p>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      {emailStudioEditor.templates.map((template) => (
                        <button
                          key={template.templateType}
                          type="button"
                          onClick={() =>
                            setActiveEmailTemplateType(template.templateType)
                          }
                          className={`rounded-2xl border p-4 text-left transition-colors ${
                            activeEmailTemplateType === template.templateType
                              ? "border-blue-300 bg-blue-50"
                              : "border-gray-200 hover:border-gray-300"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold text-gray-900">
                                {EMAIL_TEMPLATE_LABELS[template.templateType]}
                              </div>
                              <div className="mt-1 text-xs text-gray-500">
                                {
                                  EMAIL_TEMPLATE_DESCRIPTIONS[
                                    template.templateType
                                  ]
                                }
                              </div>
                            </div>
                            <span
                              className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
                                template.enabled
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-gray-100 text-gray-500"
                              }`}
                            >
                              {template.enabled ? "Live" : "Off"}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-gray-200 p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900">
                          Tested layouts
                        </h3>
                        <p className="mt-1 text-xs text-gray-500">
                          Presets keep branding polished without opening raw
                          HTML or freeform template structure by default.
                        </p>
                      </div>
                      <span className="rounded-full bg-gray-100 px-2 py-1 text-[10px] font-semibold text-gray-600">
                        {
                          EMAIL_TEMPLATE_LABELS[
                            activeEmailTemplate.templateType
                          ]
                        }
                      </span>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      {EMAIL_LAYOUT_PRESETS.map((preset) => (
                        <EmailLayoutPresetCard
                          key={preset.id}
                          preset={preset}
                          selected={activeEmailTemplate.layoutId === preset.id}
                          primaryColor={emailStudioEditor.primaryColor}
                          accentColor={emailStudioEditor.accentColor}
                          onSelect={() =>
                            updateActiveEmailTemplate((template) =>
                              applyEmailLayoutPreset(template, preset.id),
                            )
                          }
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="rounded-2xl border border-gray-200 p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900">
                          Message settings
                        </h3>
                        <p className="mt-1 text-xs text-gray-500">
                          Change the subject, preview text, intro, footer, and a
                          few safe block toggles without drifting into a custom
                          template system.
                        </p>
                      </div>
                      <label className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700">
                        <input
                          type="checkbox"
                          checked={activeEmailTemplate.enabled}
                          onChange={(event) =>
                            updateActiveEmailTemplate((template) => ({
                              ...template,
                              enabled: event.target.checked,
                            }))
                          }
                        />
                        Enabled
                      </label>
                    </div>

                    <div className="mt-4 space-y-4">
                      <LabeledInput
                        label="Subject line"
                        value={activeEmailTemplate.subjectTemplate}
                        onChange={(value) =>
                          updateActiveEmailTemplate((template) => ({
                            ...template,
                            subjectTemplate: value,
                          }))
                        }
                        help="Supported tokens include {{siteName}}, {{formName}}, {{name}}, and {{email}}."
                      />
                      <LabeledInput
                        label="Preview text"
                        value={activeEmailTemplate.previewText}
                        onChange={(value) =>
                          updateActiveEmailTemplate((template) => ({
                            ...template,
                            previewText: value,
                          }))
                        }
                      />
                      <label className="block">
                        <span className="text-sm font-medium text-gray-700">
                          Intro copy
                        </span>
                        <textarea
                          value={activeEmailTemplate.introText}
                          onChange={(event) =>
                            updateActiveEmailTemplate((template) => ({
                              ...template,
                              introText: event.target.value,
                            }))
                          }
                          className="mt-2 min-h-28 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                        />
                      </label>
                      <label className="block">
                        <span className="text-sm font-medium text-gray-700">
                          Footer note
                        </span>
                        <textarea
                          value={activeEmailTemplate.footerText}
                          onChange={(event) =>
                            updateActiveEmailTemplate((template) => ({
                              ...template,
                              footerText: event.target.value,
                            }))
                          }
                          className="mt-2 min-h-24 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                        />
                      </label>
                    </div>

                    <div className="mt-5 grid gap-3 md:grid-cols-3">
                      <EmailToggleCard
                        label="Submission summary"
                        description="Page, locale, and timestamp chips beneath the heading."
                        checked={activeEmailTemplate.showContextSummary}
                        onChange={(checked) =>
                          updateActiveEmailTemplate((template) => ({
                            ...template,
                            showContextSummary: checked,
                          }))
                        }
                      />
                      <EmailToggleCard
                        label="Submitted fields"
                        description="Show the guest data list inside the email body."
                        checked={activeEmailTemplate.showFieldList}
                        onChange={(checked) =>
                          updateActiveEmailTemplate((template) => ({
                            ...template,
                            showFieldList: checked,
                          }))
                        }
                      />
                      <EmailToggleCard
                        label="Footer note"
                        description="Keep a branded sign-off or operational note at the end."
                        checked={activeEmailTemplate.showFooter}
                        onChange={(checked) =>
                          updateActiveEmailTemplate((template) => ({
                            ...template,
                            showFooter: checked,
                          }))
                        }
                      />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-gray-200 p-5">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900">
                        Field order
                      </h3>
                      <p className="mt-1 text-xs text-gray-500">
                        Choose the fields that appear in the email and arrange
                        them in the order recipients scan first.
                      </p>
                    </div>

                    <div className="mt-4">
                      <FieldOrderComposer
                        value={activeEmailTemplate.fieldOrder}
                        suggestedKeys={emailFieldSuggestions}
                        onChange={(fieldOrder) =>
                          updateActiveEmailTemplate((template) => ({
                            ...template,
                            fieldOrder,
                          }))
                        }
                      />
                    </div>
                  </div>

                  <details className="rounded-2xl border border-gray-200 p-5">
                    <summary className="flex cursor-pointer list-none items-start justify-between gap-4">
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900">
                          Advanced blocks
                        </h3>
                        <p className="mt-1 text-xs text-gray-500">
                          Available for higher-touch accounts that need custom
                          HTML or unsupported block combinations.
                        </p>
                      </div>
                      <span className="rounded-full bg-gray-100 px-2 py-1 text-[10px] font-semibold text-gray-600">
                        {activeEmailTemplate.advancedMode
                          ? "Advanced on"
                          : "Preset mode"}
                      </span>
                    </summary>

                    <div className="mt-4 space-y-4 border-t border-gray-100 pt-4">
                      <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
                        <input
                          type="checkbox"
                          checked={activeEmailTemplate.advancedMode}
                          onChange={(event) =>
                            updateActiveEmailTemplate((template) =>
                              setEmailTemplateAdvancedMode(
                                template,
                                event.target.checked,
                              ),
                            )
                          }
                        />
                        Enable advanced blocks mode
                      </label>

                      {activeEmailTemplate.advancedMode ? (
                        <label className="block">
                          <span className="text-sm font-medium text-gray-700">
                            Blocks JSON
                          </span>
                          <textarea
                            value={activeEmailTemplate.advancedBlocksText}
                            onChange={(event) =>
                              updateActiveEmailTemplate((template) => ({
                                ...template,
                                advancedBlocksText: event.target.value,
                              }))
                            }
                            className="mt-2 min-h-56 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 font-mono text-xs text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                          />
                          <span className="mt-2 block text-xs text-gray-500">
                            Supported blocks include brand_header, rich_text,
                            field_list, footer, and custom_html.
                          </span>
                        </label>
                      ) : (
                        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-xs text-gray-600">
                          Keep preset mode on for most customers. Switching to
                          advanced mode exposes raw blocks and lets you insert
                          custom_html blocks when you need an exception.
                        </div>
                      )}
                    </div>
                  </details>
                </div>
              </div>
            ) : null}
          </div>

          <div className="space-y-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Preview and test
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Preview the last saved template output and send it to your local
                SMTP sink or a test inbox.
              </p>
            </div>

            {activeEmailTemplate ? (
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                  Previewing
                </div>
                <div className="mt-1 text-sm font-semibold text-gray-900">
                  {EMAIL_TEMPLATE_LABELS[activeEmailTemplateType]}
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  {EMAIL_TEMPLATE_DESCRIPTIONS[activeEmailTemplateType]}
                </p>
              </div>
            ) : null}

            <LabeledInput
              label="Test recipient"
              value={testRecipientEmail}
              onChange={setTestRecipientEmail}
              placeholder="preview@mailpit.local"
            />

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => previewEmailMutation.mutate()}
                disabled={previewEmailMutation.isPending}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700"
              >
                <Mail className="h-4 w-4" />
                Refresh preview
              </button>
              <button
                onClick={() => sendTestEmailMutation.mutate()}
                disabled={
                  !testRecipientEmail || sendTestEmailMutation.isPending
                }
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                Send test email
              </button>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              {previewHtml ? (
                <div
                  className="overflow-hidden rounded-xl bg-white shadow-sm"
                  dangerouslySetInnerHTML={{ __html: previewHtml }}
                />
              ) : (
                <div className="rounded-xl border border-dashed border-gray-300 bg-white px-4 py-8 text-center text-sm text-gray-500">
                  Save your template changes to refresh the live preview.
                </div>
              )}
            </div>

            {previewText ? (
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                  Plain text preview
                </div>
                <pre className="mt-3 whitespace-pre-wrap text-xs text-gray-600">
                  {previewText}
                </pre>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StudioLoadingCard() {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-8 text-sm text-gray-500">
      <RefreshCw className="h-4 w-4 animate-spin" />
      Loading configuration…
    </div>
  );
}

function createBlankFieldEditor(sortOrder = 0): FieldEditor {
  return {
    key: "",
    label: "",
    placeholder: "",
    helpText: "",
    type: "SINGLE_LINE_TEXT",
    required: false,
    sortOrder,
    optionsText: "",
    defaultValue: "",
    isPlatformManaged: false,
  };
}

function createBlankRoutingRuleEditor(): RoutingRuleEditor {
  return {
    id: undefined,
    name: "",
    pageSlug: "",
    locale: "",
    priority: 0,
    emailRecipientsText: "",
    integrationPresetId: "none",
    webhookUrl: "",
    webhookSecret: "",
    sendConfirmationEmail: false,
    confirmationReplyToFieldKey: "email",
    saveToInbox: true,
    isActive: true,
  };
}

function createBlankFormEditor(): FormEditorState {
  return {
    id: null,
    key: "",
    name: "",
    description: "",
    formType: "CONTACT",
    assignmentPageSlugs: "",
    assignmentLocales: "",
    fields: [
      {
        ...createBlankFieldEditor(0),
        key: "name",
        label: "Name",
        required: true,
      },
      {
        ...createBlankFieldEditor(1),
        key: "email",
        label: "Email",
        type: "EMAIL",
        required: true,
      },
      {
        ...createBlankFieldEditor(2),
        key: "message",
        label: "Message",
        type: "MULTI_LINE_TEXT",
        required: true,
      },
    ],
    routingRules: [createBlankRoutingRuleEditor()],
  };
}

function createBlankEmailStudioEditor(): EmailStudioEditor {
  return {
    brandName: "",
    logoUrl: "",
    primaryColor: "#2563eb",
    accentColor: "#0f172a",
    surfaceColor: "#ffffff",
    textColor: "#0f172a",
    typographyFamily: normalizeEmailFont("Arial"),
    templates: [
      createDefaultEmailTemplateEditor("INTERNAL_NOTIFICATION"),
      createDefaultEmailTemplateEditor("GUEST_CONFIRMATION"),
    ],
  };
}

function createDefaultEmailTemplateEditor(
  templateType: FormEmailTemplateType,
): EmailTemplateEditor {
  const layoutId = getDefaultEmailLayoutId(templateType);
  const preset = getEmailLayoutPreset(layoutId);
  const template: EmailTemplateEditor =
    templateType === "GUEST_CONFIRMATION"
      ? {
          templateType,
          name: "Guest confirmation",
          enabled: false,
          subjectTemplate: "Thanks for contacting {{siteName}}",
          previewText: "We received your message.",
          introText:
            "We received your {{formName}} submission and will reply soon.",
          footerText: "This is an automated confirmation from {{siteName}}.",
          fieldOrder: ["name", "message"],
          layoutId,
          showContextSummary: preset.defaults.showContextSummary,
          showFieldList: preset.defaults.showFieldList,
          showFooter: preset.defaults.showFooter,
          advancedMode: false,
          advancedBlocksText: "",
        }
      : {
          templateType,
          name: "Team notification",
          enabled: true,
          subjectTemplate: "[{{siteName}}] New {{formName}} from {{name}}",
          previewText: "A new inquiry has been submitted.",
          introText: "A new {{formName}} submission arrived for {{siteName}}.",
          footerText: "Delivered by StayLayer.",
          fieldOrder: ["name", "email", "message"],
          layoutId,
          showContextSummary: preset.defaults.showContextSummary,
          showFieldList: preset.defaults.showFieldList,
          showFooter: preset.defaults.showFooter,
          advancedMode: false,
          advancedBlocksText: "",
        };

  return {
    ...template,
    advancedBlocksText: formatEmailBlocks(buildStandardEmailBlocks(template)),
  };
}

function getDefaultEmailLayoutId(
  templateType: FormEmailTemplateType,
): EmailLayoutId {
  return templateType === "GUEST_CONFIRMATION" ? "signature" : "minimal";
}

function getDefaultEmailHeading(templateType: FormEmailTemplateType) {
  return templateType === "GUEST_CONFIRMATION"
    ? "Thanks for contacting {{siteName}}"
    : "New {{formName}} submission";
}

function getDefaultEmailFieldListTitle(templateType: FormEmailTemplateType) {
  return templateType === "GUEST_CONFIRMATION"
    ? "Your submission"
    : "Submitted fields";
}

function getEmailTemplateSavedName(template: EmailTemplateEditor) {
  return template.advancedMode
    ? `${EMAIL_TEMPLATE_LABELS[template.templateType]} - Advanced`
    : `${EMAIL_TEMPLATE_LABELS[template.templateType]} - ${getEmailLayoutPreset(template.layoutId).label}`;
}

function getEmailLayoutPreset(layoutId: EmailLayoutId): EmailLayoutPreset {
  return (
    EMAIL_LAYOUT_PRESETS.find((preset) => preset.id === layoutId) ??
    EMAIL_LAYOUT_PRESETS[0]
  );
}

function mapDefinitionToEditor(definition: FormDefinition): FormEditorState {
  return {
    id: definition.id,
    key: definition.key,
    name: definition.name,
    description: definition.description,
    formType: definition.formType,
    assignmentPageSlugs: (definition.assignment?.pageSlugs ?? []).join(", "),
    assignmentLocales: (definition.assignment?.locales ?? []).join(", "),
    fields: definition.fields.map((field) => ({
      key: field.key,
      label: field.label,
      placeholder: field.placeholder ?? "",
      helpText: field.helpText ?? "",
      type: field.type,
      required: field.required,
      sortOrder: field.sortOrder,
      optionsText: normalizeOptionsToText(field.options),
      defaultValue: field.defaultValue ?? "",
      isPlatformManaged: field.isPlatformManaged ?? false,
    })),
    routingRules:
      definition.routingRules.length > 0
        ? definition.routingRules.map(mapRoutingRuleToEditor)
        : [createBlankRoutingRuleEditor()],
  };
}

function mapRoutingRuleToEditor(rule: FormRoutingRule): RoutingRuleEditor {
  return {
    id: rule.id,
    name: rule.name,
    pageSlug: rule.pageSlug ?? "",
    locale: rule.locale ?? "",
    priority: rule.priority,
    emailRecipientsText: rule.emailRecipients.join(", "),
    integrationPresetId: inferDeliveryIntegrationPresetId(rule.webhookUrl),
    webhookUrl: rule.webhookUrl,
    webhookSecret: rule.webhookSecret,
    sendConfirmationEmail: rule.sendConfirmationEmail,
    confirmationReplyToFieldKey: rule.confirmationReplyToFieldKey,
    saveToInbox: rule.saveToInbox,
    isActive: rule.isActive,
  };
}

function mapEmailStudioToEditor(
  studio: FormEmailStudioResponse,
): EmailStudioEditor {
  const siteLevelTemplates = studio.templates.filter(
    (template) => !template.formDefinitionId,
  );

  return {
    brandName: studio.theme.brandName,
    logoUrl: studio.theme.logoUrl,
    primaryColor: normalizeHexColor(studio.theme.primaryColor, "#2563eb"),
    accentColor: normalizeHexColor(studio.theme.accentColor, "#0f172a"),
    surfaceColor: normalizeHexColor(studio.theme.surfaceColor, "#ffffff"),
    textColor: normalizeHexColor(studio.theme.textColor, "#0f172a"),
    typographyFamily: normalizeEmailFont(studio.theme.typographyFamily),
    templates:
      siteLevelTemplates.length > 0
        ? siteLevelTemplates.map((template) => {
            const fallbackTemplate = createDefaultEmailTemplateEditor(
              template.templateType,
            );
            const blocks = toEmailBlocksArray(template.blocks);
            const layoutId = resolveEmailLayoutId(
              blocks,
              template.templateType,
            );
            const preset = getEmailLayoutPreset(layoutId);
            const editorTemplate: EmailTemplateEditor = {
              id: template.id,
              templateType: template.templateType,
              name: template.name,
              enabled: template.enabled,
              subjectTemplate: template.subjectTemplate,
              previewText: template.previewText,
              introText:
                readBlockText(blocks, "rich_text") ||
                fallbackTemplate.introText,
              footerText:
                readBlockText(blocks, "footer") || fallbackTemplate.footerText,
              fieldOrder:
                normalizeFieldOrder(template.fieldOrder).length > 0
                  ? normalizeFieldOrder(template.fieldOrder)
                  : fallbackTemplate.fieldOrder,
              layoutId,
              showContextSummary: readBlockBoolean(
                blocks,
                "brand_header",
                "showSummary",
                preset.defaults.showContextSummary,
              ),
              showFieldList: blocks.some(
                (block) => String(block.type ?? "") === "field_list",
              ),
              showFooter: blocks.some(
                (block) => String(block.type ?? "") === "footer",
              ),
              advancedMode: false,
              advancedBlocksText: "",
            };
            const persistedBlocks =
              blocks.length > 0
                ? blocks
                : buildStandardEmailBlocks(editorTemplate);

            return {
              ...editorTemplate,
              advancedMode: !isStandardEmailTemplate(
                persistedBlocks,
                editorTemplate,
              ),
              advancedBlocksText: formatEmailBlocks(persistedBlocks),
            };
          })
        : createBlankEmailStudioEditor().templates,
  };
}

function serializeEmailStudioEditor(
  editor: EmailStudioEditor,
): UpdateFormEmailStudioPayload {
  const internalTemplate = editor.templates.find(
    (template) => template.templateType === "INTERNAL_NOTIFICATION",
  );

  return {
    theme: {
      brandName: editor.brandName.trim(),
      logoUrl: editor.logoUrl.trim(),
      primaryColor: normalizeHexColor(editor.primaryColor, "#2563eb"),
      accentColor: normalizeHexColor(editor.accentColor, "#0f172a"),
      surfaceColor: normalizeHexColor(editor.surfaceColor, "#ffffff"),
      textColor: normalizeHexColor(editor.textColor, "#0f172a"),
      typographyFamily: normalizeEmailFont(editor.typographyFamily),
      footerContent: {
        text:
          internalTemplate && internalTemplate.showFooter
            ? internalTemplate.footerText.trim()
            : "",
      },
    },
    templates: editor.templates.map((template) => ({
      id: template.id,
      templateType: template.templateType,
      name: getEmailTemplateSavedName(template),
      enabled: template.enabled,
      subjectTemplate: template.subjectTemplate.trim(),
      previewText: template.previewText.trim(),
      blocks: template.advancedMode
        ? parseAdvancedEmailBlocks(template.advancedBlocksText)
        : buildStandardEmailBlocks(template),
      fieldOrder: normalizeFieldOrder(template.fieldOrder),
    })),
  };
}

function buildStandardEmailBlocks(template: EmailTemplateEditor) {
  const preset = getEmailLayoutPreset(template.layoutId);

  return [
    {
      type: "brand_header",
      variant: template.layoutId,
      title: getDefaultEmailHeading(template.templateType),
      showSummary: template.showContextSummary,
    },
    template.introText.trim()
      ? { type: "rich_text", text: template.introText.trim() }
      : null,
    template.showFieldList
      ? {
          type: "field_list",
          variant: preset.fieldListVariant,
          title: getDefaultEmailFieldListTitle(template.templateType),
        }
      : null,
    template.showFooter && template.footerText.trim()
      ? { type: "footer", text: template.footerText.trim() }
      : null,
  ].filter(Boolean) as Array<Record<string, unknown>>;
}

function applyEmailLayoutPreset(
  template: EmailTemplateEditor,
  layoutId: EmailLayoutId,
): EmailTemplateEditor {
  const preset = getEmailLayoutPreset(layoutId);
  const nextTemplate: EmailTemplateEditor = {
    ...template,
    layoutId,
    showContextSummary: preset.defaults.showContextSummary,
    showFieldList: preset.defaults.showFieldList,
    showFooter: preset.defaults.showFooter,
    advancedMode: false,
  };

  return {
    ...nextTemplate,
    advancedBlocksText: formatEmailBlocks(
      buildStandardEmailBlocks(nextTemplate),
    ),
  };
}

function setEmailTemplateAdvancedMode(
  template: EmailTemplateEditor,
  enabled: boolean,
): EmailTemplateEditor {
  if (!enabled) {
    return {
      ...template,
      advancedMode: false,
    };
  }

  return {
    ...template,
    advancedMode: true,
    advancedBlocksText: template.advancedMode
      ? template.advancedBlocksText
      : formatEmailBlocks(buildStandardEmailBlocks(template)),
  };
}

function parseAdvancedEmailBlocks(value: string) {
  let parsed: unknown;

  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("Advanced blocks must be valid JSON.");
  }

  if (!Array.isArray(parsed)) {
    throw new Error("Advanced blocks must be a JSON array.");
  }

  if (
    parsed.some(
      (block) => !block || typeof block !== "object" || Array.isArray(block),
    )
  ) {
    throw new Error("Each advanced block must be a JSON object.");
  }

  return parsed as Array<Record<string, unknown>>;
}

function formatEmailBlocks(blocks: unknown) {
  return JSON.stringify(blocks, null, 2);
}

function isStandardEmailTemplate(
  blocks: Array<Record<string, unknown>>,
  template: EmailTemplateEditor,
) {
  if (isLegacyStandardEmailTemplate(blocks)) {
    return true;
  }

  return (
    JSON.stringify(blocks) ===
    JSON.stringify(buildStandardEmailBlocks(template))
  );
}

function resolveEmailLayoutId(
  blocks: Array<Record<string, unknown>>,
  templateType: FormEmailTemplateType,
): EmailLayoutId {
  const headerBlock = findEmailBlock(blocks, "brand_header");
  const variant = headerBlock?.variant;

  if (
    typeof variant === "string" &&
    EMAIL_LAYOUT_PRESETS.some((preset) => preset.id === variant)
  ) {
    return variant as EmailLayoutId;
  }

  if (isLegacyStandardEmailTemplate(blocks)) {
    return "signature";
  }

  return getDefaultEmailLayoutId(templateType);
}

function isLegacyStandardEmailTemplate(blocks: Array<Record<string, unknown>>) {
  return (
    JSON.stringify(blocks.map((block) => String(block.type ?? ""))) ===
    JSON.stringify(["brand_header", "rich_text", "field_list", "footer"])
  );
}

function normalizeFieldOrder(value: string[]) {
  return value
    .map((fieldKey) => fieldKey.trim())
    .filter(Boolean)
    .filter((fieldKey, index, fields) => fields.indexOf(fieldKey) === index);
}

function normalizeEmailFont(value: string) {
  const trimmedValue = value.trim();

  return SAFE_EMAIL_FONTS.some((font) => font.value === trimmedValue)
    ? trimmedValue
    : SAFE_EMAIL_FONTS[0].value;
}

function normalizeHexColor(value: string, fallback: string) {
  const trimmedValue = value.trim();
  const shortMatch = trimmedValue.match(/^#([0-9a-f]{3})$/i);

  if (shortMatch) {
    return `#${shortMatch[1]
      .split("")
      .map((part) => `${part}${part}`)
      .join("")}`.toLowerCase();
  }

  if (/^#([0-9a-f]{6})$/i.test(trimmedValue)) {
    return trimmedValue.toLowerCase();
  }

  return fallback;
}

function readBlockBoolean(
  blocks: Array<Record<string, unknown>>,
  targetType: string,
  key: string,
  fallback: boolean,
) {
  const match = findEmailBlock(blocks, targetType);
  return typeof match?.[key] === "boolean" ? Boolean(match[key]) : fallback;
}

function findEmailBlock(
  blocks: Array<Record<string, unknown>> | unknown,
  targetType: string,
) {
  return toEmailBlocksArray(blocks).find(
    (block) => String(block.type ?? "") === targetType,
  );
}

function toEmailBlocksArray(blocks: unknown) {
  if (!Array.isArray(blocks)) {
    return [] as Array<Record<string, unknown>>;
  }

  return blocks.filter(
    (block) => block && typeof block === "object" && !Array.isArray(block),
  ) as Array<Record<string, unknown>>;
}

function serializeFormEditor(formEditor: FormEditorState) {
  const assignment = {
    pageSlugs: splitCommaList(formEditor.assignmentPageSlugs),
    locales: splitCommaList(formEditor.assignmentLocales),
  };

  return {
    key: formEditor.key.trim(),
    name: formEditor.name.trim(),
    description: formEditor.description.trim(),
    formType: formEditor.formType,
    assignment:
      assignment.pageSlugs.length > 0 || assignment.locales.length > 0
        ? assignment
        : undefined,
    fields: formEditor.fields.map((field, index) => ({
      key: field.key.trim(),
      label: field.label.trim(),
      placeholder: field.placeholder.trim(),
      helpText: field.helpText.trim(),
      type: field.type,
      required: field.required,
      sortOrder: index,
      defaultValue: field.defaultValue.trim() || undefined,
      isPlatformManaged: field.isPlatformManaged,
      options:
        field.type === "SELECT" || field.type === "RADIO"
          ? splitCommaList(field.optionsText).map((value) => ({
              label: value,
              value,
            }))
          : undefined,
    })),
    routingRules: formEditor.routingRules.map(serializeRoutingRuleEditor),
  };
}

function serializeRoutingRuleEditor(rule: RoutingRuleEditor) {
  return {
    id: rule.id,
    name: rule.name.trim(),
    pageSlug: rule.pageSlug.trim() || undefined,
    locale: rule.locale.trim() || undefined,
    priority: Number(rule.priority || 0),
    isActive: rule.isActive,
    saveToInbox: rule.saveToInbox,
    emailRecipients: splitCommaList(rule.emailRecipientsText),
    webhookUrl:
      rule.integrationPresetId === "none"
        ? undefined
        : rule.webhookUrl.trim() || undefined,
    webhookSecret:
      rule.integrationPresetId === "none"
        ? undefined
        : rule.webhookSecret.trim() || undefined,
    sendConfirmationEmail: rule.sendConfirmationEmail,
    confirmationReplyToFieldKey:
      rule.confirmationReplyToFieldKey.trim() || "email",
  };
}

function getDeliveryIntegrationPreset(
  presetId: DeliveryIntegrationPresetId,
): DeliveryIntegrationPreset {
  return (
    DELIVERY_INTEGRATION_PRESETS.find((preset) => preset.id === presetId) ??
    DELIVERY_INTEGRATION_PRESETS[0]
  );
}

function inferDeliveryIntegrationPresetId(
  webhookUrl: string,
): DeliveryIntegrationPresetId {
  const trimmedUrl = webhookUrl.trim();

  if (!trimmedUrl) {
    return "none";
  }

  try {
    const hostname = new URL(trimmedUrl).hostname.toLowerCase();

    if (
      hostname.includes("zapier") ||
      hostname.includes("make.com") ||
      hostname.includes("n8n") ||
      hostname.includes("pipedream") ||
      hostname.includes("workato")
    ) {
      return "automation";
    }

    if (
      hostname.includes("hubspot") ||
      hostname.includes("salesforce") ||
      hostname.includes("zoho") ||
      hostname.includes("pipedrive") ||
      hostname.includes("crm")
    ) {
      return "crm";
    }

    if (
      hostname.includes("cloudbeds") ||
      hostname.includes("guesty") ||
      hostname.includes("mews") ||
      hostname.includes("apaleo") ||
      hostname.includes("opera") ||
      hostname.includes("siteminder") ||
      hostname.includes("pms")
    ) {
      return "pms";
    }
  } catch {
    return "custom";
  }

  return "custom";
}

function applyDeliveryIntegrationPreset(
  rule: RoutingRuleEditor,
  presetId: DeliveryIntegrationPresetId,
): RoutingRuleEditor {
  if (presetId === "none") {
    return {
      ...rule,
      integrationPresetId: presetId,
      webhookUrl: "",
      webhookSecret: "",
    };
  }

  return {
    ...rule,
    integrationPresetId: presetId,
  };
}

function splitCommaList(value: string) {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizeOptionsToText(
  options: FormFieldDefinition["options"] | undefined,
) {
  if (!Array.isArray(options)) {
    return "";
  }

  return options
    .map((option) =>
      typeof option === "string" ? option : option.value || option.label,
    )
    .join(", ");
}

function readBlockText(blocks: unknown, targetType: string) {
  const match = findEmailBlock(blocks, targetType) as
    | { text?: string }
    | undefined;

  return typeof match?.text === "string" ? match.text : "";
}

function LabeledInput({
  label,
  value,
  onChange,
  placeholder,
  help,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  help?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
      />
      {help ? (
        <span className="mt-1 block text-xs text-gray-500">{help}</span>
      ) : null}
    </label>
  );
}

function LabeledSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function LabeledColorInput({
  label,
  value,
  onChange,
  help,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  help?: string;
}) {
  const normalizedValue = normalizeHexColor(value, "#2563eb");

  return (
    <label className="block">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <div className="mt-2 flex items-center gap-3">
        <input
          type="color"
          value={normalizedValue}
          onChange={(event) => onChange(event.target.value)}
          className="h-12 w-14 rounded-xl border border-gray-200 bg-white p-1"
        />
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          placeholder={normalizedValue}
        />
      </div>
      {help ? (
        <span className="mt-1 block text-xs text-gray-500">{help}</span>
      ) : null}
    </label>
  );
}

function FieldEditorCard({
  field,
  onChange,
  onRemove,
}: {
  field: FieldEditor;
  onChange: (field: FieldEditor) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="text-sm font-semibold text-gray-900">
          {field.label || field.key || "New field"}
        </div>
        <button
          onClick={onRemove}
          className="rounded-lg border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-500"
        >
          Remove
        </button>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <LabeledInput
          label="Field key"
          value={field.key}
          onChange={(value) => onChange({ ...field, key: value })}
          placeholder="arrivalDate"
        />
        <LabeledInput
          label="Label"
          value={field.label}
          onChange={(value) => onChange({ ...field, label: value })}
          placeholder="Arrival date"
        />
        <LabeledSelect
          label="Field type"
          value={field.type}
          options={FORM_FIELD_TYPES}
          onChange={(value) =>
            onChange({ ...field, type: value as FormFieldType })
          }
        />
        <LabeledInput
          label="Default value"
          value={field.defaultValue}
          onChange={(value) => onChange({ ...field, defaultValue: value })}
        />
        <LabeledInput
          label="Placeholder"
          value={field.placeholder}
          onChange={(value) => onChange({ ...field, placeholder: value })}
        />
        <LabeledInput
          label="Help text"
          value={field.helpText}
          onChange={(value) => onChange({ ...field, helpText: value })}
        />
        {(field.type === "SELECT" || field.type === "RADIO") && (
          <div className="md:col-span-2">
            <LabeledInput
              label="Options"
              value={field.optionsText}
              onChange={(value) => onChange({ ...field, optionsText: value })}
              placeholder="Single room, Double room, Suite"
              help="Comma-separated option labels."
            />
          </div>
        )}
        <div className="flex items-center gap-6 md:col-span-2">
          <label className="inline-flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={field.required}
              onChange={(event) =>
                onChange({ ...field, required: event.target.checked })
              }
            />
            Required
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={field.isPlatformManaged}
              onChange={(event) =>
                onChange({
                  ...field,
                  isPlatformManaged: event.target.checked,
                  type: event.target.checked ? "HIDDEN" : field.type,
                })
              }
            />
            Platform-managed hidden field
          </label>
        </div>
      </div>
    </div>
  );
}

function EmailLayoutPresetCard({
  preset,
  selected,
  primaryColor,
  accentColor,
  onSelect,
}: {
  preset: EmailLayoutPreset;
  selected: boolean;
  primaryColor: string;
  accentColor: string;
  onSelect: () => void;
}) {
  const primary = normalizeHexColor(primaryColor, "#2563eb");
  const accent = normalizeHexColor(accentColor, "#0f172a");

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`rounded-2xl border p-4 text-left transition-colors ${
        selected
          ? "border-blue-300 bg-blue-50"
          : "border-gray-200 hover:border-gray-300"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-gray-900">
            {preset.label}
          </div>
          <div className="mt-1 text-xs text-gray-500">{preset.description}</div>
        </div>
        {selected ? (
          <span className="rounded-full bg-blue-100 px-2 py-1 text-[10px] font-semibold text-blue-700">
            Selected
          </span>
        ) : null}
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-white p-3">
        {preset.id === "spotlight" ? (
          <>
            <div
              className="rounded-xl px-3 py-4"
              style={{ backgroundColor: primary }}
            >
              <div className="h-2 w-16 rounded-full bg-white/80" />
              <div className="mt-3 h-3 w-28 rounded-full bg-white/90" />
              <div className="mt-2 h-2 w-24 rounded-full bg-white/60" />
            </div>
            <div className="mt-3 grid gap-2">
              <div className="h-9 rounded-xl bg-gray-100" />
              <div className="h-9 rounded-xl bg-gray-50" />
            </div>
          </>
        ) : preset.id === "concierge" ? (
          <>
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
              <div className="flex items-start gap-3">
                <div
                  className="h-10 w-1 rounded-full"
                  style={{ backgroundColor: primary }}
                />
                <div className="min-w-0 flex-1">
                  <div className="h-2 w-14 rounded-full bg-gray-200" />
                  <div
                    className="mt-2 h-3 w-[6.5rem] rounded-full"
                    style={{ backgroundColor: accent, opacity: 0.2 }}
                  />
                  <div className="mt-2 h-2 w-20 rounded-full bg-gray-200" />
                </div>
              </div>
            </div>
            <div className="mt-3 grid gap-2">
              <div className="rounded-xl border border-gray-100 bg-white p-2">
                <div className="h-2 w-[4.5rem] rounded-full bg-gray-200" />
                <div className="mt-2 h-2 w-full rounded-full bg-gray-100" />
              </div>
              <div className="rounded-xl border border-gray-100 bg-white p-2">
                <div className="h-2 w-16 rounded-full bg-gray-200" />
                <div className="mt-2 h-2 w-5/6 rounded-full bg-gray-100" />
              </div>
            </div>
          </>
        ) : preset.id === "minimal" ? (
          <>
            <div className="flex items-center justify-between border-b border-gray-200 pb-3">
              <div className="h-2 w-[4.5rem] rounded-full bg-gray-300" />
              <div
                className="h-2 w-10 rounded-full"
                style={{ backgroundColor: primary, opacity: 0.35 }}
              />
            </div>
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="h-2 w-16 rounded-full bg-gray-300" />
                <div className="h-2 w-20 rounded-full bg-gray-100" />
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="h-2 w-14 rounded-full bg-gray-300" />
                <div className="h-2 w-24 rounded-full bg-gray-100" />
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="h-2 w-12 rounded-full bg-gray-300" />
                <div className="h-2 w-28 rounded-full bg-gray-100" />
              </div>
            </div>
          </>
        ) : (
          <>
            <div
              className="h-1.5 rounded-full"
              style={{ backgroundColor: primary }}
            />
            <div className="mt-3 rounded-xl bg-gray-50 p-3">
              <div className="h-2 w-14 rounded-full bg-gray-200" />
              <div
                className="mt-2 h-3 w-28 rounded-full"
                style={{ backgroundColor: accent, opacity: 0.18 }}
              />
              <div className="mt-3 flex flex-wrap gap-2">
                <div
                  className="h-6 w-16 rounded-full"
                  style={{ backgroundColor: primary, opacity: 0.12 }}
                />
                <div className="h-6 w-12 rounded-full bg-gray-200" />
                <div className="h-6 w-[4.5rem] rounded-full bg-gray-100" />
              </div>
            </div>
            <div className="mt-3 grid gap-2">
              <div className="h-8 rounded-xl bg-gray-100" />
              <div className="h-8 rounded-xl bg-gray-50" />
            </div>
          </>
        )}
      </div>
    </button>
  );
}

function EmailToggleCard({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start justify-between gap-3 rounded-2xl border p-4 transition-colors ${
        checked ? "border-blue-300 bg-blue-50" : "border-gray-200 bg-white"
      }`}
    >
      <div>
        <div className="text-sm font-semibold text-gray-900">{label}</div>
        <div className="mt-1 text-xs text-gray-500">{description}</div>
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1"
      />
    </label>
  );
}

function FieldOrderComposer({
  value,
  suggestedKeys,
  onChange,
}: {
  value: string[];
  suggestedKeys: string[];
  onChange: (value: string[]) => void;
}) {
  const [customFieldKey, setCustomFieldKey] = useState("");
  const availableKeys = suggestedKeys.filter(
    (fieldKey) => !value.includes(fieldKey),
  );

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {value.length > 0 ? (
          value.map((fieldKey, index) => (
            <div
              key={`${fieldKey}-${index}`}
              className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 px-3 py-2"
            >
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                  Position {index + 1}
                </div>
                <div className="text-sm font-medium text-gray-900">
                  {fieldKey}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (index === 0) {
                      return;
                    }
                    const nextOrder = [...value];
                    [nextOrder[index - 1], nextOrder[index]] = [
                      nextOrder[index],
                      nextOrder[index - 1],
                    ];
                    onChange(nextOrder);
                  }}
                  disabled={index === 0}
                  className="rounded-lg border border-gray-200 px-2 py-1 text-xs font-semibold text-gray-600 disabled:cursor-not-allowed disabled:text-gray-300"
                >
                  Up
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (index === value.length - 1) {
                      return;
                    }
                    const nextOrder = [...value];
                    [nextOrder[index], nextOrder[index + 1]] = [
                      nextOrder[index + 1],
                      nextOrder[index],
                    ];
                    onChange(nextOrder);
                  }}
                  disabled={index === value.length - 1}
                  className="rounded-lg border border-gray-200 px-2 py-1 text-xs font-semibold text-gray-600 disabled:cursor-not-allowed disabled:text-gray-300"
                >
                  Down
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onChange(
                      value.filter((_, itemIndex) => itemIndex !== index),
                    )
                  }
                  className="rounded-lg border border-gray-200 px-2 py-1 text-xs font-semibold text-gray-500"
                >
                  Remove
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-5 text-sm text-gray-500">
            Add the fields that should appear in this email.
          </div>
        )}
      </div>

      {availableKeys.length > 0 ? (
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-gray-400">
            Suggested fields
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {availableKeys.map((fieldKey) => (
              <button
                key={fieldKey}
                type="button"
                onClick={() => onChange([...value, fieldKey])}
                className="rounded-full border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:border-gray-300 hover:bg-gray-50"
              >
                Add {fieldKey}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="rounded-xl bg-gray-50 p-4">
        <div className="text-xs font-semibold uppercase tracking-widest text-gray-400">
          Custom field key
        </div>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            value={customFieldKey}
            onChange={(event) => setCustomFieldKey(event.target.value)}
            placeholder="arrival_date"
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
          <button
            type="button"
            onClick={() => {
              const nextFieldKey = customFieldKey.trim();
              if (!nextFieldKey) {
                return;
              }
              onChange(normalizeFieldOrder([...value, nextFieldKey]));
              setCustomFieldKey("");
            }}
            disabled={!customFieldKey.trim()}
            className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Add field
          </button>
        </div>
      </div>
    </div>
  );
}

function LogoUploader({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="rounded-2xl border border-gray-200 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-gray-900">Logo</div>
          <div className="mt-1 text-xs text-gray-500">
            Upload a compact SVG or PNG, or paste a hosted asset URL. Hosted
            URLs remain the safest option for inbox rendering.
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700"
          >
            Upload logo
          </button>
          {value ? (
            <button
              type="button"
              onClick={() => onChange("")}
              className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-500"
            >
              Remove
            </button>
          ) : null}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/svg+xml,image/webp"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];

          if (!file) {
            return;
          }

          if (file.size > MAX_EMAIL_LOGO_FILE_SIZE) {
            toast.error("Upload a logo smaller than 120 KB.");
            event.target.value = "";
            return;
          }

          const reader = new FileReader();
          reader.onload = () => {
            if (typeof reader.result === "string") {
              onChange(reader.result);
            }
          };
          reader.readAsDataURL(file);
          event.target.value = "";
        }}
      />

      {value ? (
        <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-5">
          <img
            src={value}
            alt="Email logo preview"
            className="h-10 max-w-[12rem] object-contain"
            onError={(event) => {
              (event.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-5 text-sm text-gray-500">
          No logo selected yet.
        </div>
      )}

      <label className="mt-4 block">
        <span className="text-sm font-medium text-gray-700">
          Hosted logo URL
        </span>
        <input
          value={value.startsWith("data:") ? "" : value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="https://cdn.example.com/logo.svg"
          className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
        />
        <span className="mt-1 block text-xs text-gray-500">
          Paste a hosted asset anytime to replace an uploaded file.
        </span>
      </label>
    </div>
  );
}

function RoutingRuleEditorCard({
  rule,
  onChange,
  onRemove,
}: {
  rule: RoutingRuleEditor;
  onChange: (rule: RoutingRuleEditor) => void;
  onRemove: () => void;
}) {
  const integrationPreset = getDeliveryIntegrationPreset(
    rule.integrationPresetId,
  );

  return (
    <div className="rounded-2xl border border-gray-200 p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="text-sm font-semibold text-gray-900">
          {rule.name || "Routing rule"}
        </div>
        <button
          onClick={onRemove}
          className="rounded-lg border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-500"
        >
          Remove
        </button>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <LabeledInput
          label="Rule name"
          value={rule.name}
          onChange={(value) => onChange({ ...rule, name: value })}
        />
        <LabeledInput
          label="Priority order"
          value={String(rule.priority)}
          onChange={(value) =>
            onChange({ ...rule, priority: Number(value || 0) })
          }
          help="Lower numbers run first when more than one rule matches."
        />
        <LabeledInput
          label="Page slug"
          value={rule.pageSlug}
          onChange={(value) => onChange({ ...rule, pageSlug: value })}
          placeholder="contact-us"
        />
        <LabeledInput
          label="Locale"
          value={rule.locale}
          onChange={(value) => onChange({ ...rule, locale: value })}
          placeholder="en"
        />
        <div className="md:col-span-2">
          <LabeledInput
            label="Delivery inboxes"
            value={rule.emailRecipientsText}
            onChange={(value) =>
              onChange({ ...rule, emailRecipientsText: value })
            }
            placeholder="ops@example.com, sales@example.com"
            help="Comma-separated inboxes for the default email delivery path."
          />
        </div>
        <div className="flex items-center gap-6 md:col-span-2">
          <label className="inline-flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={rule.saveToInbox}
              onChange={(event) =>
                onChange({ ...rule, saveToInbox: event.target.checked })
              }
            />
            Save to inbox
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={rule.sendConfirmationEmail}
              onChange={(event) =>
                onChange({
                  ...rule,
                  sendConfirmationEmail: event.target.checked,
                })
              }
            />
            Send guest confirmation
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={rule.isActive}
              onChange={(event) =>
                onChange({ ...rule, isActive: event.target.checked })
              }
            />
            Active
          </label>
        </div>
        <details
          open={rule.integrationPresetId !== "none"}
          className="md:col-span-2 rounded-2xl border border-gray-200 bg-gray-50 p-4"
        >
          <summary className="cursor-pointer list-none text-sm font-semibold text-gray-900">
            Advanced delivery
          </summary>
          <p className="mt-1 text-xs text-gray-500">
            Choose a delivery preset first. Raw webhook fields stay tucked away
            behind the custom option instead of being the default customer path.
          </p>
          <div className="mt-4 space-y-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                Integration preset
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {DELIVERY_INTEGRATION_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() =>
                      onChange(applyDeliveryIntegrationPreset(rule, preset.id))
                    }
                    className={`rounded-2xl border p-4 text-left transition-colors ${
                      rule.integrationPresetId === preset.id
                        ? "border-blue-300 bg-blue-50"
                        : "border-gray-200 bg-white hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-gray-900">
                          {preset.label}
                        </div>
                        <div className="mt-1 text-xs text-gray-500">
                          {preset.description}
                        </div>
                      </div>
                      {rule.integrationPresetId === preset.id ? (
                        <span className="rounded-full bg-blue-100 px-2 py-1 text-[10px] font-semibold text-blue-700">
                          Selected
                        </span>
                      ) : null}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {rule.integrationPresetId === "none" ? (
              <div className="rounded-xl border border-dashed border-gray-300 bg-white px-4 py-4 text-sm text-gray-500">
                This route will deliver only to the inboxes above. Add an
                integration later if your CRM, PMS, or automation workflow needs
                the structured payload too.
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2 rounded-xl border border-gray-200 bg-white px-4 py-4">
                  <div className="text-sm font-semibold text-gray-900">
                    {integrationPreset.label}
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    {integrationPreset.description}
                  </p>
                </div>
                <LabeledInput
                  label={integrationPreset.endpointLabel}
                  value={rule.webhookUrl}
                  onChange={(value) => onChange({ ...rule, webhookUrl: value })}
                  placeholder={integrationPreset.endpointPlaceholder}
                  help={integrationPreset.endpointHelp}
                />
                <LabeledInput
                  label={integrationPreset.secretLabel}
                  value={rule.webhookSecret}
                  onChange={(value) =>
                    onChange({ ...rule, webhookSecret: value })
                  }
                  placeholder={integrationPreset.secretPlaceholder}
                  help={integrationPreset.secretHelp}
                />
              </div>
            )}

            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <LabeledInput
                label="Reply-to field key"
                value={rule.confirmationReplyToFieldKey}
                onChange={(value) =>
                  onChange({ ...rule, confirmationReplyToFieldKey: value })
                }
                placeholder="email"
                help="Used when guest confirmations should reply to a submitted field such as email."
              />
            </div>
          </div>
        </details>
      </div>
    </div>
  );
}

function toCsvCell(value: unknown): string {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function EmptySubmissions() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50">
        <Inbox className="h-7 w-7 text-blue-400" />
      </div>
      <div>
        <p className="text-sm font-semibold text-gray-800">No inquiries yet</p>
        <p className="mt-1 text-xs text-gray-500">
          Submissions from your contact and inquiry forms will appear here.
        </p>
      </div>
    </div>
  );
}

function SubmissionRow({
  submission,
  canManageStatus,
  onMarkReviewed,
  onArchive,
}: {
  submission: Submission;
  canManageStatus: boolean;
  onMarkReviewed: () => void;
  onArchive: () => void;
}) {
  const {
    name,
    email,
    message,
    locale,
    status,
    createdAt,
    pageSlug,
    formType,
  } = submission;
  const isNew = status === "RECEIVED";

  return (
    <div className="flex items-start gap-4 px-6 py-4 hover:bg-gray-50/70 transition-colors">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-bold uppercase">
        {name.charAt(0)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {isNew && (
            <span className="flex h-1.5 w-1.5 rounded-full bg-blue-500" />
          )}
          <p className="text-sm font-semibold text-gray-900">{name}</p>
          <span className="text-xs text-gray-400">{email}</span>
          <span className="text-[10px] uppercase font-semibold text-gray-400 rounded bg-gray-100 px-1.5 py-0.5">
            {locale}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLORS[status]}`}
          >
            {STATUS_LABELS[status]}
          </span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-gray-400">
          <span className="inline-flex items-center gap-1 rounded bg-gray-100 px-1.5 py-0.5 font-medium text-gray-500">
            <FileText className="h-3 w-3" />
            {FORM_TYPE_LABELS[formType]}
          </span>
          <span>{pageSlug ? `/${pageSlug}` : "Unknown page"}</span>
        </div>
        <p className="mt-1 text-xs text-gray-500 line-clamp-2">{message}</p>
        <div className="mt-1 flex items-center gap-1 text-[11px] text-gray-400">
          <Clock className="h-3 w-3" />
          {new Date(createdAt).toLocaleDateString()}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {canManageStatus && status === "RECEIVED" && (
          <button
            onClick={onMarkReviewed}
            title="Mark reviewed"
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            <CheckCircle2 className="h-4 w-4" />
          </button>
        )}
        {canManageStatus && status !== "ARCHIVED" && (
          <button
            onClick={onArchive}
            title="Archive"
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            <XCircle className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
