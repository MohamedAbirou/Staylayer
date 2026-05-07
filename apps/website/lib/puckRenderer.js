import { Render } from "@puckeditor/core";
import { puckConfig, Navbar } from "@myallocator/puck-components";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import LanguageSelector from "@/components/LanguageSelector";
import { EMAIL_CONTACT } from "@/lib/brand";

const ContactForm = dynamic(() => import("@/components/contactForm"), {
  ssr: false,
});

const AnnualReportForm = dynamic(
  () => import("@/components/annual-report-form"),
  { ssr: false },
);

/**
 * ContactSection with the real live form injected.
 * Wraps the editable props (heading, description, bullets, email copy)
 * from puckData around the actual ContactForm component.
 */
function ContactSectionWithRealForm(props) {
  const {
    heading,
    description,
    bulletItems = [],
    badgeText,
    emailAddress,
    emailLabel,
    emailNote,
    backgroundColor,
    headingColor,
    descriptionColor,
  } = props;

  return (
    <section
      className="py-12"
      style={{ backgroundColor: backgroundColor || "#ffffff" }}
    >
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
          {/* ── Left: info panel ── */}
          <div className="md:col-span-1 flex flex-col justify-center">
            <h3
              className="text-xl font-bold mb-4"
              style={{ color: headingColor || "#1d4ed8" }}
            >
              {heading}
            </h3>
            <p
              className="mb-2"
              style={{ color: descriptionColor || "#334155" }}
            >
              {description}
            </p>
            {bulletItems.length > 0 && (
              <ul
                className="list-disc pl-5 space-y-1 mb-4"
                style={{ color: descriptionColor || "#334155" }}
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

          {/* ── Right: real ContactForm ── */}
          <div className="md:col-span-2">
            <ContactForm formKey={props.formKey || null} />
          </div>
        </div>

        {/* ── Email fallback ── */}
        <div className="mt-8 text-center text-slate-600">
          <p>
            Prefer email? Reach us at{" "}
            <a
              href={`mailto:${emailAddress || EMAIL_CONTACT}`}
              className="text-blue-700 underline font-medium"
            >
              {emailLabel || emailAddress || EMAIL_CONTACT}
            </a>
          </p>
          {emailNote && (
            <p className="mt-2 text-xs text-slate-400">{emailNote}</p>
          )}
        </div>
      </div>
    </section>
  );
}

/**
 * AnnualReportSection with the real download form injected.
 */
function AnnualReportSectionWithRealForm({ backgroundColor }) {
  return (
    <section
      className="py-12"
      style={{ backgroundColor: backgroundColor || "#ffffff" }}
    >
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <AnnualReportForm />
      </div>
    </section>
  );
}

/**
 * Navbar with LanguageSelector injected into the CTA area.
 * This is a render override — it receives all puck-stored props and
 * passes them straight through, adding the LanguageSelector via the
 * `rightExtra` slot added to the Navbar component.
 * No page data changes are required.
 */
function NavbarWithLanguageSelector(props) {
  return <Navbar {...props} rightExtra={<LanguageSelector />} />;
}

// Build a config that swaps form sections for the real component versions
const websiteConfig = {
  ...puckConfig,
  components: {
    ...puckConfig.components,
    Navbar: {
      ...puckConfig.components.Navbar,
      render: NavbarWithLanguageSelector,
    },
    ContactSection: {
      ...puckConfig.components.ContactSection,
      render: ContactSectionWithRealForm,
    },
    AnnualReportSection: {
      ...puckConfig.components.AnnualReportSection,
      render: AnnualReportSectionWithRealForm,
    },
  },
};

/**
 * Renders Puck page data using the shared component config.
 * Use inside a Next.js page to display CMS-built content.
 */
export default function PuckRenderer({ data }) {
  const router = useRouter();

  if (!data || !data.content) {
    return null;
  }

  // Intercept all internal link clicks so the active locale is preserved.
  // Plain <a href="/about"> would otherwise navigate to the default-locale
  // URL and drop the language. By routing through next/router we keep the
  // locale prefix on every page transition.
  const handleClick = (e) => {
    const a = e.target.closest("a[href]");
    if (!a) return;
    const href = a.getAttribute("href");
    if (!href) return;
    // Leave external URLs, anchors, mailto:, tel: alone.
    if (
      /^(https?:)?\/\//.test(href) ||
      href.startsWith("#") ||
      href.startsWith("mailto:") ||
      href.startsWith("tel:")
    )
      return;
    // Leave new-tab links alone.
    if (a.target === "_blank") return;
    // Internal link — navigate with the currently selected locale.
    e.preventDefault();
    router.push(href, href, { locale: router.locale });
  };

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div className="puck-root" onClick={handleClick}>
      <Render config={websiteConfig} data={data} />
    </div>
  );
}
