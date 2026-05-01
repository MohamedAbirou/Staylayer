import type { ComponentConfig } from "@puckeditor/core";
import { textColorField, backgroundColorField } from "../../lib/fields";

export interface ContactSectionProps {
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

/**
 * ContactSection — puck-components render outputs a realistic visual preview
 * for the dashboard editor (mock form fields, no real submit logic).
 *
 * On the website, puckRenderer.js overrides this render with the real
 * ContactForm component (which has full validation + Formspree submit).
 */
export const ContactSection = ({
  heading = "Let's Connect",
  description = "Have a question? Fill out the form and our team will get back to you quickly.",
  bulletItems = [
    { text: "Onboarding & setup guidance" },
    { text: "Feature walkthroughs" },
    { text: "Partnership opportunities" },
    { text: "General support" },
  ],
  badgeText = "Fast, friendly replies",
  emailAddress = "contact@myallocator.com",
  emailLabel = "contact@myallocator.com",
  emailNote = "We aim to respond within one business day.",
  backgroundColor = "#ffffff",
  headingColor = "#1d4ed8",
  descriptionColor = "#334155",
}: ContactSectionProps) => {
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

          {/* ── Right: form mock (editor preview only) ───────────────── */}
          <div className="md:col-span-2">
            <div className="max-w-md mx-auto bg-white rounded-2xl shadow-xl p-6 sm:p-8 flex flex-col gap-6 border border-gray-100">
              {/* Mock inputs — visual only, not interactive */}
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
                <span className="text-white font-semibold text-base">
                  Send Message
                </span>
              </div>
            </div>
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
    heading: "Let's Connect",
    description:
      "Have a question about MyAllocator or need help with your account? Fill out the form and our team will get back to you quickly.",
    bulletItems: [
      { text: "Onboarding & setup guidance" },
      { text: "Feature walkthroughs" },
      { text: "Partnership opportunities" },
      { text: "General support" },
    ],
    badgeText: "Fast, friendly replies",
    emailAddress: "contact@myallocator.com",
    emailLabel: "contact@myallocator.com",
    emailNote: "We aim to respond within one business day.",
    backgroundColor: "#ffffff",
    headingColor: "#1d4ed8",
    descriptionColor: "#334155",
  },
  render: ContactSection,
};
