"use client";

import {
  ContactSectionRuntimeProvider,
  puckConfig,
} from "@myallocator/puck-components";
import { Render } from "@puckeditor/core";
import { useRouter } from "next/navigation";
import { RuntimeSiteBrand } from "./RuntimeSiteBrand";

const DEFAULT_NAVBAR_LOGO_URL = "/images/logo.png";

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

function hasNavbar(puckData) {
  return (puckData?.content || []).some((block) => block?.type === "Navbar");
}

function applyRuntimeTheme(puckData, site) {
  const logoUrl = site?.theme?.logoUrl;

  if (!logoUrl || !hasNavbar(puckData)) {
    return puckData;
  }

  return {
    ...puckData,
    content: (puckData.content || []).map((block) => {
      if (block?.type !== "Navbar") {
        return block;
      }

      const props = block.props || {};
      const currentLogoUrl = String(props.logoImageUrl || "").trim();
      const shouldUseRuntimeLogo =
        !currentLogoUrl || currentLogoUrl === DEFAULT_NAVBAR_LOGO_URL;

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
          logoType:
            props.logoType === "text" ? "both" : props.logoType || "image",
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
  const shouldRenderBrandHeader =
    Boolean(runtime.site?.theme?.logoUrl) && !hasNavbar(themedPuckData);

  const availableForms = buildAvailableForms(runtime.forms?.byKey);
  const runtimeValue = {
    pageSlug: runtime.page.slug || "home",
    locale: runtime.page.locale || runtime.site.defaultLocale,
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
    router.push(href);
  }

  return (
    <ContactSectionRuntimeProvider value={runtimeValue}>
      {shouldRenderBrandHeader ? (
        <RuntimeSiteBrand site={runtime.site} />
      ) : null}
      <div className="puck-root" onClick={handleClick}>
        <Render config={puckConfig} data={themedPuckData} />
      </div>
    </ContactSectionRuntimeProvider>
  );
}
