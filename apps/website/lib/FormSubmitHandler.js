/**
 * Contact form API service
 *
 * When NEXT_PUBLIC_CMS_API_URL and NEXT_PUBLIC_SITE_ID are set (i.e. dedicated
 * site deployment), submissions are stored centrally via the CMS API at
 * POST /public/submissions.
 *
 * Falls back to Formspree for legacy / shared-domain deployments where these
 * env vars are absent.
 */

const CMS_API_URL = process.env.NEXT_PUBLIC_CMS_API_URL ?? null;
const SITE_ID = process.env.NEXT_PUBLIC_SITE_ID ?? null;

const FORMSPREE_ENDPOINT = "https://formspree.io/f/mblypnzk";

export const hasCmsSubmissionEndpoint = Boolean(CMS_API_URL && SITE_ID);

export const resolvePublicContactForm = async ({
  pageSlug,
  locale = "en",
  formKey,
} = {}) => {
  if (!hasCmsSubmissionEndpoint) {
    return null;
  }

  const url = new URL("/public/forms/resolve", CMS_API_URL);
  url.searchParams.set("siteId", SITE_ID);
  if (pageSlug) {
    url.searchParams.set("pageSlug", pageSlug);
  }
  if (locale) {
    url.searchParams.set("locale", locale);
  }
  if (formKey) {
    url.searchParams.set("formKey", formKey);
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Failed to resolve public form (${response.status})`);
  }

  return response.json();
};

/**
 * @param {{ name?: string; email?: string; message?: string; fields?: Record<string, unknown>; formType?: string; formKey?: string; formDefinitionId?: string; formSchemaVersionId?: string; pageSlug?: string; locale?: string; _trap?: string }} formData
 */
export const submitContactForm = async (formData) => {
  if (hasCmsSubmissionEndpoint) {
    return submitViaCmsApi(formData);
  }
  return submitViaFormspree(formData);
};

async function submitViaCmsApi(formData) {
  const body = {
    siteId: SITE_ID,
    formType: formData.formType || "CONTACT",
    pageSlug: formData.pageSlug ?? null,
    locale: formData.locale ?? "en",
    _trap: formData._trap ?? "",
  };

  if (formData.formKey) {
    body.formKey = formData.formKey;
  }
  if (formData.formDefinitionId) {
    body.formDefinitionId = formData.formDefinitionId;
  }
  if (formData.formSchemaVersionId) {
    body.formSchemaVersionId = formData.formSchemaVersionId;
  }
  if (formData.fields && Object.keys(formData.fields).length > 0) {
    body.fields = formData.fields;
  } else {
    body.name = formData.name;
    body.email = formData.email;
    body.message = formData.message;
  }

  const response = await fetch(`${CMS_API_URL}/public/submissions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let detail = "Failed to send message";
    try {
      const body = await response.json();
      detail = body?.message ?? detail;
    } catch {
      // ignore JSON parse failures
    }
    const error = new Error("Form submission failed");
    error.errors = [{ message: detail }];
    throw error;
  }

  return response.json();
}

async function submitViaFormspree(formData) {
  const fields = formData.fields || {};
  const response = await fetch(FORMSPREE_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: formData.name ?? fields.name ?? "",
      email: formData.email ?? fields.email ?? "",
      message: formData.message ?? fields.message ?? "",
    }),
  });

  const result = await response.json();
  if (!response.ok) {
    const error = new Error("Form submission failed");
    error.errors = result.errors || [
      { message: result.error || "Failed to send message" },
    ];
    throw error;
  }
  return result;
}
