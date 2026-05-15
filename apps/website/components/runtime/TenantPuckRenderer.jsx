"use client";

import {
  ContactSectionRuntimeProvider,
  LanguageSwitcherRuntimeProvider,
  puckConfig,
} from "@staylayer/puck-components";
import { Render } from "@puckeditor/core";
import { useRouter } from "next/navigation";

const DEFAULT_BRAND_LOGO_URL = "/images/logo.png";
const BRAND_COMPONENT_TYPES = new Set(["Navbar", "Footer"]);
const SUPPORTED_RUNTIME_LOCALES = new Set([
  "en",
  "es",
  "fr",
  "de",
  "it",
  "pt",
  "nl",
  "ar",
]);

function isExternalHref(href) {
  return (
    /^(https?:)?\/\//.test(href) ||
    href.startsWith("#") ||
    href.startsWith("mailto:") ||
    href.startsWith("tel:")
  );
}

function buildAvailableForms(formsByKey) {
  return Object.values(formsByKey || {})
    .filter(Boolean)
    .map((form) => ({
      id: form.id,
      key: form.key,
      name: form.name,
      assignment: form.assignment || null,
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function localizeInternalHref(href, locale, defaultLocale) {
  const url = new URL(href, window.location.origin);
  const segments = url.pathname.split("/").filter(Boolean);
  const firstSegment = segments[0]?.toLowerCase();
  const unprefixedSegments = SUPPORTED_RUNTIME_LOCALES.has(firstSegment)
    ? segments.slice(1)
    : segments;
  const basePathname =
    unprefixedSegments.length > 0 ? `/${unprefixedSegments.join("/")}` : "/";
  const localizedPathname =
    locale && locale !== defaultLocale
      ? basePathname === "/"
        ? `/${locale}`
        : `/${locale}${basePathname}`
      : basePathname;

  return `${localizedPathname}${url.search}${url.hash}`;
}

function applyRuntimeTheme(puckData, site) {
  const logoUrl = site?.theme?.logoUrl;

  if (!logoUrl) {
    return puckData;
  }

  return {
    ...puckData,
    content: (puckData.content || []).map((block) => {
      if (!BRAND_COMPONENT_TYPES.has(block?.type)) {
        return block;
      }

      const props = block.props || {};
      const currentLogoUrl = String(props.logoImageUrl || "").trim();
      const logoType = String(props.logoType || "").trim();
      const shouldUseRuntimeLogo =
        (!currentLogoUrl || currentLogoUrl === DEFAULT_BRAND_LOGO_URL) &&
        (!logoType || logoType === "image" || logoType === "both");

      if (!shouldUseRuntimeLogo) {
        return block;
      }

      return {
        ...block,
        props: {
          ...props,
          logoImageUrl: logoUrl,
          logoImageAlt: props.logoImageAlt || `${site?.name || "Site"} logo`,
          logoText: props.logoText || site?.name || "",
          logoType: props.logoType || "image",
        },
      };
    }),
  };
}

async function parseJsonResponse(response, fallbackMessage) {
  const text = await response.text();

  if (!response.ok) {
    let message = fallbackMessage;

    try {
      const payload = text ? JSON.parse(text) : null;
      message = payload?.message || fallbackMessage;
    } catch {
      // Ignore non-JSON errors and fall back to the default message.
    }

    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return text ? JSON.parse(text) : null;
}

export function TenantPuckRenderer({ runtime }) {
  const router = useRouter();

  if (!runtime?.page?.puckData?.content) {
    return null;
  }

  const themedPuckData = applyRuntimeTheme(runtime.page.puckData, runtime.site);
  const pageLocale = runtime.page.locale || runtime.site.defaultLocale || "en";
  const languageDirection = pageLocale === "ar" ? "rtl" : "ltr";

  const availableForms = buildAvailableForms(runtime.forms?.byKey);
  const pageLocales = runtime.page.availableLocales || [];
  const enabledLocales = runtime.site.enabledLocales || [];
  const availableLocales = Array.from(
    new Set(
      (pageLocales.length > 0 ? pageLocales : enabledLocales).filter(Boolean),
    ),
  );
  const runtimeValue = {
    pageSlug: runtime.page.slug || "home",
    locale: pageLocale,
    availableForms,
    resolveForm: async ({ formKey = "", pageSlug, locale }) => {
      const normalizedFormKey = String(formKey || "").trim();
      const cachedForm = runtime.forms?.byKey?.[normalizedFormKey];
      if (cachedForm) {
        return cachedForm;
      }

      const url = new URL("/api/forms/resolve", window.location.origin);
      url.searchParams.set("pageSlug", pageSlug || runtime.page.slug || "home");
      url.searchParams.set(
        "locale",
        locale || runtime.page.locale || runtime.site.defaultLocale,
      );

      if (normalizedFormKey) {
        url.searchParams.set("formKey", normalizedFormKey);
      }

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      return parseJsonResponse(
        response,
        "Failed to load the live form configuration.",
      );
    },
    submitForm: async (payload) => {
      const response = await fetch("/api/forms/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      return parseJsonResponse(response, "Failed to submit the inquiry.");
    },
  };
  const languageSwitcherRuntime = {
    pageSlug: runtime.page.slug || "home",
    currentLocale: pageLocale,
    defaultLocale: runtime.site.defaultLocale || "en",
    availableLocales,
  };

  function handleClick(event) {
    const link = event.target.closest("a[href]");
    if (!link) {
      return;
    }

    const href = link.getAttribute("href");
    if (!href || isExternalHref(href) || link.target === "_blank") {
      return;
    }

    event.preventDefault();

    if (link.closest("[data-runtime-locale-link]")) {
      router.push(href);
      return;
    }

    router.push(
      localizeInternalHref(
        href,
        runtime.page.locale,
        runtime.site.defaultLocale,
      ),
    );
  }

  return (
    <LanguageSwitcherRuntimeProvider value={languageSwitcherRuntime}>
      <ContactSectionRuntimeProvider value={runtimeValue}>
        <div
          className="puck-root"
          onClick={handleClick}
          dir={languageDirection}
          lang={pageLocale}
        >
          <Render config={puckConfig} data={themedPuckData} />
        </div>
      </ContactSectionRuntimeProvider>
    </LanguageSwitcherRuntimeProvider>
  );
}
