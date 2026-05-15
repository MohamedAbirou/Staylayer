import type { ComponentConfig, FieldProps } from "@puckeditor/core";
import { ManagedContactForm } from "../../forms/ManagedContactForm";
import {
  useContactSectionRuntime,
  type ContactRuntimeFormOption,
} from "../../forms/contact-section-runtime";
import { textColorField, backgroundColorField } from "../../lib/fields";

export interface ContactSectionProps {
  formKey?: string;
  heading: string;
  description: string;
  bulletItems: { text: string }[];
  badgeText: string;
  emailAddress: string;
  emailLabel: string;
  emailNote: string;
  backgroundColor: string;
  headingColor: string;
  descriptionColor: string;
}

function summarizeAssignment(form: ContactRuntimeFormOption) {
  const pageCount = form.assignment?.pageSlugs?.length ?? 0;
  const localeCount = form.assignment?.locales?.length ?? 0;

  if (!pageCount && !localeCount) {
    return "Uses fallback routing or default contact form behavior.";
  }

  const pageSummary = pageCount
    ? `${pageCount} page${pageCount === 1 ? "" : "s"}`
    : "all pages";
  const localeSummary = localeCount
    ? `${localeCount} locale${localeCount === 1 ? "" : "s"}`
    : "all locales";

  return `Assigned to ${pageSummary} across ${localeSummary}.`;
}

function FormKeyField({
  value,
  onChange,
  readOnly,
}: FieldProps<{ type: "custom" }, string | undefined>) {
  const runtime = useContactSectionRuntime();
  const availableForms = runtime?.availableForms ?? [];
  const selectedForm =
    availableForms.find((form) => form.key === value) ?? null;

  if (!availableForms.length) {
    return (
      <div className="space-y-2">
        <input
          type="text"
          value={value || ""}
          onChange={(event) => onChange(event.target.value)}
          readOnly={readOnly}
          placeholder="contact-primary"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-slate-900"
        />
        <p className="text-xs text-slate-500">
          {runtime?.loadingForms
            ? "Loading Form Studio definitions..."
            : runtime?.formsError ||
              "Form Studio is unavailable here. Enter a published form key manually."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <select
        value={value || ""}
        onChange={(event) => onChange(event.target.value)}
        disabled={readOnly}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-slate-900"
      >
        <option value="">Use page routing or the default contact form</option>
        {availableForms.map((form) => (
          <option key={form.id} value={form.key}>
            {form.name} ({form.key})
            {form.status && form.status !== "ACTIVE" ? ` - ${form.status}` : ""}
          </option>
        ))}
      </select>
      <p className="text-xs text-slate-500">
        {selectedForm
          ? summarizeAssignment(selectedForm)
          : "Leave this blank to let Form Studio routing choose the active contact form for the page."}
      </p>
    </div>
  );
}

function StaticContactFormPreview({ formKey = "" }: { formKey?: string }) {
  return (
    <div className="max-w-md mx-auto bg-white rounded-2xl shadow-xl p-6 sm:p-8 flex flex-col gap-6 border border-gray-100">
      {formKey ? (
        <div className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700">
          Assigned form key: {formKey}
        </div>
      ) : null}
      <div className="h-11 rounded-lg border border-gray-200 bg-gray-50 px-4 flex items-center">
        <span className="text-gray-400 text-base">Your Name</span>
      </div>
      <div className="h-11 rounded-lg border border-gray-200 bg-gray-50 px-4 flex items-center">
        <span className="text-gray-400 text-base">Email Address</span>
      </div>
      <div className="h-36 rounded-lg border border-gray-200 bg-gray-50 px-4 pt-3">
        <span className="text-gray-400 text-base">Your Message</span>
      </div>
      <div className="h-11 rounded-lg bg-gradient-to-r from-blue-600 to-blue-500 flex items-center justify-center">
        <span className="text-white font-semibold text-base">Send Message</span>
      </div>
    </div>
  );
}

export const ContactSection = ({
  formKey = "",
  heading = "Plan your stay",
  description = "Share your preferred dates, group size, and any special requests. The reservations team will reply with tailored availability.",
  bulletItems = [
    { text: "Direct availability guidance" },
    { text: "Room and villa recommendations" },
    { text: "Local arrival details" },
    { text: "Special occasion support" },
  ],
  badgeText = "Direct booking assistance",
  emailAddress = "reservations@example.com",
  emailLabel = "reservations@example.com",
  emailNote = "Most inquiries receive a reply within one business day.",
  backgroundColor = "#ffffff",
  headingColor = "#1d4ed8",
  descriptionColor = "#334155",
}: ContactSectionProps) => {
  const runtime = useContactSectionRuntime();
  const hasLivePreview = Boolean(runtime?.resolveForm && runtime?.submitForm);

  return (
    <section className="py-12" style={{ backgroundColor }}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
          {/* ── Left: info panel ──────────────────────────────────────── */}
          <div className="md:col-span-1 flex flex-col justify-center">
            <h3
              className="text-xl font-bold mb-4"
              style={{ color: headingColor }}
            >
              {heading}
            </h3>
            <p
              className="mb-2 text-base leading-relaxed"
              style={{ color: descriptionColor }}
            >
              {description}
            </p>
            {bulletItems.length > 0 && (
              <ul
                className="list-disc pl-5 space-y-1 mb-4 text-base"
                style={{ color: descriptionColor }}
              >
                {bulletItems.map((item, i) => (
                  <li key={i}>{item.text}</li>
                ))}
              </ul>
            )}
            {badgeText && (
              <div className="mt-4">
                <span className="inline-block bg-blue-50 text-blue-700 px-3 py-1 rounded-full font-medium text-sm">
                  {badgeText}
                </span>
              </div>
            )}
          </div>

          {/* ── Right: live preview when runtime context is provided ───── */}
          <div className="md:col-span-2">
            {hasLivePreview ? (
              <ManagedContactForm formKey={formKey} />
            ) : (
              <StaticContactFormPreview formKey={formKey} />
            )}
          </div>
        </div>

        {/* ── Email fallback ──────────────────────────────────────────── */}
        <div className="mt-8 text-center text-slate-600">
          <p className="text-base">
            Prefer email? Reach us at{" "}
            <a
              href={`mailto:${emailAddress}`}
              className="text-blue-700 underline font-medium"
            >
              {emailLabel}
            </a>
          </p>
          {emailNote && (
            <p className="mt-2 text-xs text-slate-400">{emailNote}</p>
          )}
        </div>
      </div>
    </section>
  );
};

export const contactSectionConfig: ComponentConfig<ContactSectionProps> = {
  label: "Contact Section",
  fields: {
    formKey: {
      type: "custom",
      label: "Assigned Form",
      render: FormKeyField,
    },
    heading: {
      type: "text",
      label: "Panel Heading",
      contentEditable: true,
    },
    description: {
      type: "textarea",
      label: "Panel Description",
      contentEditable: true,
    },
    bulletItems: {
      type: "array",
      label: "Bullet Items",
      arrayFields: {
        text: { type: "text", label: "Item", contentEditable: true },
      },
      defaultItemProps: { text: "New item" },
      getItemSummary: (item) => item.text || "Item",
    },
    badgeText: {
      type: "text",
      label: "Badge Text",
      contentEditable: true,
    },
    emailAddress: {
      type: "text",
      label: "Email Address (href)",
    },
    emailLabel: {
      type: "text",
      label: "Email Display Label",
      contentEditable: true,
    },
    emailNote: {
      type: "text",
      label: "Email Note",
      contentEditable: true,
    },
    backgroundColor: backgroundColorField,
    headingColor: textColorField,
    descriptionColor: {
      ...textColorField,
      label: "Description Color",
    },
  },
  defaultProps: {
    formKey: "",
    heading: "Plan your stay",
    description:
      "Share your preferred dates, group size, and any special requests. The reservations team will reply with tailored availability.",
    bulletItems: [
      { text: "Direct availability guidance" },
      { text: "Room and villa recommendations" },
      { text: "Local arrival details" },
      { text: "Special occasion support" },
    ],
    badgeText: "Direct booking assistance",
    emailAddress: "reservations@example.com",
    emailLabel: "reservations@example.com",
    emailNote: "Most inquiries receive a reply within one business day.",
    backgroundColor: "#ffffff",
    headingColor: "#1d4ed8",
    descriptionColor: "#334155",
  },
  render: ContactSection,
};
