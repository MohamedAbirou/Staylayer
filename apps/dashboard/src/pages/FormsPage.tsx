import { useEffect, useState } from "react";
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

type RoutingRuleEditor = {
  id?: string;
  name: string;
  pageSlug: string;
  locale: string;
  priority: number;
  emailRecipientsText: string;
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

type EmailTemplateEditor = {
  id?: string;
  templateType: FormEmailTemplateType;
  name: string;
  enabled: boolean;
  subjectTemplate: string;
  previewText: string;
  introText: string;
  footerText: string;
  fieldOrderText: string;
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
  INTERNAL_NOTIFICATION: "Internal notification",
  GUEST_CONFIRMATION: "Guest confirmation",
};

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
  const [previewTemplateType, setPreviewTemplateType] =
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
      updateFormEmailStudio(siteId!, {
        theme: {
          brandName: emailStudioEditor.brandName,
          logoUrl: emailStudioEditor.logoUrl,
          primaryColor: emailStudioEditor.primaryColor,
          accentColor: emailStudioEditor.accentColor,
          surfaceColor: emailStudioEditor.surfaceColor,
          textColor: emailStudioEditor.textColor,
          typographyFamily: emailStudioEditor.typographyFamily,
          footerContent: {
            text: emailStudioEditor.templates.find(
              (template) => template.templateType === "INTERNAL_NOTIFICATION",
            )?.footerText,
          },
        },
        templates: emailStudioEditor.templates.map((template) => ({
          id: template.id,
          templateType: template.templateType,
          name: template.name,
          enabled: template.enabled,
          subjectTemplate: template.subjectTemplate,
          previewText: template.previewText,
          blocks: [
            {
              type: "brand_header",
              title:
                template.templateType === "GUEST_CONFIRMATION"
                  ? "Thanks for contacting {{siteName}}"
                  : "New {{formName}} submission",
            },
            { type: "rich_text", text: template.introText },
            {
              type: "field_list",
              title:
                template.templateType === "GUEST_CONFIRMATION"
                  ? "Your submission"
                  : "Submitted fields",
            },
            { type: "footer", text: template.footerText },
          ],
          fieldOrder: splitCommaList(template.fieldOrderText),
        })),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["form-email-studio", siteId],
      });
      toast.success("Email studio saved");
    },
    onError: () => {
      toast.error("Failed to save email studio");
    },
  });

  const previewEmailMutation = useMutation({
    mutationFn: () =>
      previewFormEmail(siteId!, {
        templateType: previewTemplateType,
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
        templateType: previewTemplateType,
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
          <h1 className="text-2xl font-bold text-gray-900">Inquiry Studio</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage submissions, subscriber-owned form schemas, routing rules,
            and branded inquiry emails in one place.
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
          { id: "studio", label: "Form Studio", icon: Settings2 },
          { id: "email", label: "Email Studio", icon: Paintbrush2 },
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
                    Reusable Forms
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
                    Site Fallback Routing
                  </h2>
                  <p className="mt-1 text-xs text-gray-500">
                    Used when a form has no more specific route. Keep at least
                    one email recipient or webhook destination configured.
                  </p>
                </div>
                <button
                  onClick={() => saveSiteRoutingMutation.mutate()}
                  disabled={saveSiteRoutingMutation.isPending}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700"
                >
                  <Save className="h-4 w-4" />
                  Save fallback
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
                  Per-form routing overrides
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
        <div className="grid gap-6 xl:grid-cols-[1.15fr,0.85fr]">
          <div className="space-y-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Branded Email Studio
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Customize internal notification emails and guest confirmations
                  with safe theme tokens and structured blocks.
                </p>
              </div>
              <button
                onClick={() => saveEmailStudioMutation.mutate()}
                disabled={saveEmailStudioMutation.isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
              >
                <Save className="h-4 w-4" />
                Save email studio
              </button>
            </div>

            {emailStudioQuery.isLoading ? (
              <StudioLoadingCard />
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-2">
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
                  <LabeledInput
                    label="Logo URL"
                    value={emailStudioEditor.logoUrl}
                    onChange={(value) =>
                      setEmailStudioEditor((current) => ({
                        ...current,
                        logoUrl: value,
                      }))
                    }
                    placeholder="https://cdn.example.com/logo.png"
                  />
                  <LabeledInput
                    label="Primary color"
                    value={emailStudioEditor.primaryColor}
                    onChange={(value) =>
                      setEmailStudioEditor((current) => ({
                        ...current,
                        primaryColor: value,
                      }))
                    }
                    placeholder="#2563eb"
                  />
                  <LabeledInput
                    label="Accent color"
                    value={emailStudioEditor.accentColor}
                    onChange={(value) =>
                      setEmailStudioEditor((current) => ({
                        ...current,
                        accentColor: value,
                      }))
                    }
                    placeholder="#0f172a"
                  />
                  <LabeledInput
                    label="Surface color"
                    value={emailStudioEditor.surfaceColor}
                    onChange={(value) =>
                      setEmailStudioEditor((current) => ({
                        ...current,
                        surfaceColor: value,
                      }))
                    }
                    placeholder="#ffffff"
                  />
                  <LabeledInput
                    label="Text color"
                    value={emailStudioEditor.textColor}
                    onChange={(value) =>
                      setEmailStudioEditor((current) => ({
                        ...current,
                        textColor: value,
                      }))
                    }
                    placeholder="#0f172a"
                  />
                  <div className="md:col-span-2">
                    <LabeledInput
                      label="Typography family"
                      value={emailStudioEditor.typographyFamily}
                      onChange={(value) =>
                        setEmailStudioEditor((current) => ({
                          ...current,
                          typographyFamily: value,
                        }))
                      }
                      placeholder="Arial"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  {emailStudioEditor.templates.map((template, index) => (
                    <div
                      key={template.templateType}
                      className="rounded-2xl border border-gray-200 p-5"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <div className="text-sm font-semibold text-gray-900">
                            {EMAIL_TEMPLATE_LABELS[template.templateType]}
                          </div>
                          <div className="mt-1 text-xs text-gray-500">
                            Customize copy, preview text, and field order
                            without editing raw HTML.
                          </div>
                        </div>
                        <label className="inline-flex items-center gap-2 text-xs font-medium text-gray-600">
                          <input
                            type="checkbox"
                            checked={template.enabled}
                            onChange={(event) =>
                              setEmailStudioEditor((current) => ({
                                ...current,
                                templates: current.templates.map(
                                  (item, itemIndex) =>
                                    itemIndex === index
                                      ? {
                                          ...item,
                                          enabled: event.target.checked,
                                        }
                                      : item,
                                ),
                              }))
                            }
                          />
                          Enabled
                        </label>
                      </div>

                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <LabeledInput
                          label="Template name"
                          value={template.name}
                          onChange={(value) =>
                            setEmailStudioEditor((current) => ({
                              ...current,
                              templates: current.templates.map(
                                (item, itemIndex) =>
                                  itemIndex === index
                                    ? { ...item, name: value }
                                    : item,
                              ),
                            }))
                          }
                        />
                        <LabeledInput
                          label="Preview text"
                          value={template.previewText}
                          onChange={(value) =>
                            setEmailStudioEditor((current) => ({
                              ...current,
                              templates: current.templates.map(
                                (item, itemIndex) =>
                                  itemIndex === index
                                    ? { ...item, previewText: value }
                                    : item,
                              ),
                            }))
                          }
                        />
                        <div className="md:col-span-2">
                          <LabeledInput
                            label="Subject template"
                            value={template.subjectTemplate}
                            onChange={(value) =>
                              setEmailStudioEditor((current) => ({
                                ...current,
                                templates: current.templates.map(
                                  (item, itemIndex) =>
                                    itemIndex === index
                                      ? { ...item, subjectTemplate: value }
                                      : item,
                                ),
                              }))
                            }
                            help="Tokens such as {{siteName}}, {{formName}}, {{name}}, and {{email}} are supported."
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700">
                            Intro copy
                          </label>
                          <textarea
                            value={template.introText}
                            onChange={(event) =>
                              setEmailStudioEditor((current) => ({
                                ...current,
                                templates: current.templates.map(
                                  (item, itemIndex) =>
                                    itemIndex === index
                                      ? {
                                          ...item,
                                          introText: event.target.value,
                                        }
                                      : item,
                                ),
                              }))
                            }
                            className="mt-2 min-h-24 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700">
                            Footer copy
                          </label>
                          <textarea
                            value={template.footerText}
                            onChange={(event) =>
                              setEmailStudioEditor((current) => ({
                                ...current,
                                templates: current.templates.map(
                                  (item, itemIndex) =>
                                    itemIndex === index
                                      ? {
                                          ...item,
                                          footerText: event.target.value,
                                        }
                                      : item,
                                ),
                              }))
                            }
                            className="mt-2 min-h-20 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <LabeledInput
                            label="Field order"
                            value={template.fieldOrderText}
                            onChange={(value) =>
                              setEmailStudioEditor((current) => ({
                                ...current,
                                templates: current.templates.map(
                                  (item, itemIndex) =>
                                    itemIndex === index
                                      ? { ...item, fieldOrderText: value }
                                      : item,
                                ),
                              }))
                            }
                            placeholder="name, email, message"
                            help="Comma-separated field keys in the order they should appear in the email."
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="space-y-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Preview and test
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Preview the saved template output and send it to your local SMTP
                sink or test inbox.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <LabeledSelect
                label="Template"
                value={previewTemplateType}
                options={Object.entries(EMAIL_TEMPLATE_LABELS).map(
                  ([value, label]) => ({
                    value,
                    label,
                  }),
                )}
                onChange={(value) =>
                  setPreviewTemplateType(value as FormEmailTemplateType)
                }
              />
              <LabeledInput
                label="Test recipient"
                value={testRecipientEmail}
                onChange={setTestRecipientEmail}
                placeholder="preview@mailpit.local"
              />
            </div>

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
                  Save your email studio, then refresh the preview to inspect
                  the rendered output.
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
    typographyFamily: "Arial",
    templates: [
      {
        templateType: "INTERNAL_NOTIFICATION",
        name: "Default internal notification",
        enabled: true,
        subjectTemplate: "[{{siteName}}] New {{formName}} from {{name}}",
        previewText: "A new inquiry has been submitted.",
        introText: "A new {{formName}} submission arrived for {{siteName}}.",
        footerText: "Delivered by MyAllocator CMS",
        fieldOrderText: "name, email, message",
      },
      {
        templateType: "GUEST_CONFIRMATION",
        name: "Default guest confirmation",
        enabled: false,
        subjectTemplate: "Thanks for contacting {{siteName}}",
        previewText: "We received your message.",
        introText:
          "We received your {{formName}} submission and will reply soon.",
        footerText: "This is an automated confirmation from {{siteName}}.",
        fieldOrderText: "name, message",
      },
    ],
  };
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
    primaryColor: studio.theme.primaryColor,
    accentColor: studio.theme.accentColor,
    surfaceColor: studio.theme.surfaceColor,
    textColor: studio.theme.textColor,
    typographyFamily: studio.theme.typographyFamily,
    templates:
      siteLevelTemplates.length > 0
        ? siteLevelTemplates.map((template) => ({
            id: template.id,
            templateType: template.templateType,
            name: template.name,
            enabled: template.enabled,
            subjectTemplate: template.subjectTemplate,
            previewText: template.previewText,
            introText: readBlockText(template.blocks, "rich_text"),
            footerText: readBlockText(template.blocks, "footer"),
            fieldOrderText: template.fieldOrder.join(", "),
          }))
        : createBlankEmailStudioEditor().templates,
  };
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
    webhookUrl: rule.webhookUrl.trim() || undefined,
    webhookSecret: rule.webhookSecret.trim() || undefined,
    sendConfirmationEmail: rule.sendConfirmationEmail,
    confirmationReplyToFieldKey:
      rule.confirmationReplyToFieldKey.trim() || "email",
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
  if (!Array.isArray(blocks)) {
    return "";
  }

  const match = blocks.find(
    (block) =>
      block &&
      typeof block === "object" &&
      "type" in block &&
      block.type === targetType,
  ) as { text?: string } | undefined;

  return match?.text ?? "";
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

function RoutingRuleEditorCard({
  rule,
  onChange,
  onRemove,
}: {
  rule: RoutingRuleEditor;
  onChange: (rule: RoutingRuleEditor) => void;
  onRemove: () => void;
}) {
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
          label="Priority"
          value={String(rule.priority)}
          onChange={(value) =>
            onChange({ ...rule, priority: Number(value || 0) })
          }
        />
        <LabeledInput
          label="Page slug override"
          value={rule.pageSlug}
          onChange={(value) => onChange({ ...rule, pageSlug: value })}
          placeholder="contact-us"
        />
        <LabeledInput
          label="Locale override"
          value={rule.locale}
          onChange={(value) => onChange({ ...rule, locale: value })}
          placeholder="en"
        />
        <div className="md:col-span-2">
          <LabeledInput
            label="Email recipients"
            value={rule.emailRecipientsText}
            onChange={(value) =>
              onChange({ ...rule, emailRecipientsText: value })
            }
            placeholder="ops@example.com, sales@example.com"
          />
        </div>
        <LabeledInput
          label="Webhook URL"
          value={rule.webhookUrl}
          onChange={(value) => onChange({ ...rule, webhookUrl: value })}
          placeholder="https://example.com/hooks/inquiry"
        />
        <LabeledInput
          label="Webhook secret"
          value={rule.webhookSecret}
          onChange={(value) => onChange({ ...rule, webhookSecret: value })}
        />
        <LabeledInput
          label="Guest reply-to field"
          value={rule.confirmationReplyToFieldKey}
          onChange={(value) =>
            onChange({ ...rule, confirmationReplyToFieldKey: value })
          }
          placeholder="email"
        />
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
