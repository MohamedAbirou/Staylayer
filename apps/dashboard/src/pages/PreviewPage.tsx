import { useCallback } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Render, type Data } from "@puckeditor/core";
import {
  ContactSectionRuntimeProvider,
  puckConfig,
  type ContactRuntimeResolvedForm,
  type ContactRuntimeSubmitPayload,
} from "@myallocator/puck-components";
import client from "../api/client";
import { getFormStudio } from "../api/forms";
import { getPagePreview } from "../api/pages";
import { useAuth } from "../auth/useAuth";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { ArrowLeft } from "lucide-react";
import toast from "react-hot-toast";
import "@puckeditor/core/puck.css";

export default function PreviewPage() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const locale = searchParams.get("locale") || "en";
  const navigate = useNavigate();
  const { session } = useAuth();
  const activeSiteId = session?.activeSite?.id ?? null;

  const {
    data: page,
    isLoading,
    error: pageError,
  } = useQuery({
    queryKey: ["preview", slug, locale],
    queryFn: () => getPagePreview(slug!, locale),
    enabled: !!slug,
  });

  const formStudioQuery = useQuery({
    queryKey: ["form-studio", activeSiteId],
    queryFn: () => getFormStudio(activeSiteId!),
    enabled: Boolean(activeSiteId),
    staleTime: 60_000,
  });

  const resolveContactForm = useCallback(
    async ({
      formKey,
      pageSlug,
      locale: requestedLocale,
    }: {
      formKey?: string;
      pageSlug?: string | null;
      locale?: string | null;
    }) => {
      if (!activeSiteId) {
        return null;
      }

      const { data } = await client.get<ContactRuntimeResolvedForm | null>(
        "/public/forms/resolve",
        {
          params: {
            siteId: activeSiteId,
            locale: requestedLocale || locale,
            ...(pageSlug ? { pageSlug } : {}),
            ...(formKey ? { formKey } : {}),
          },
        },
      );

      return data;
    },
    [activeSiteId, locale],
  );

  const submitContactPreview = useCallback(
    async (payload: ContactRuntimeSubmitPayload) => {
      if (!activeSiteId) {
        throw new Error("No active site is selected for this preview.");
      }

      await client.post("/public/submissions", {
        siteId: activeSiteId,
        formType: payload.formType || "CONTACT",
        ...payload,
      });
    },
    [activeSiteId],
  );

  const availableForms = (formStudioQuery.data?.definitions ?? [])
    .map((definition) => ({
      id: definition.id,
      key: definition.key,
      name: definition.name,
      status: definition.status,
      assignment: definition.assignment,
    }))
    .sort((left, right) => {
      if (left.status === right.status) {
        return left.name.localeCompare(right.name);
      }

      if (left.status === "ACTIVE") {
        return -1;
      }

      if (right.status === "ACTIVE") {
        return 1;
      }

      return left.name.localeCompare(right.name);
    });

  const contactSectionRuntime = {
    pageSlug: slug ?? null,
    locale,
    availableForms,
    loadingForms: formStudioQuery.isLoading,
    formsError: formStudioQuery.error
      ? formStudioQuery.error instanceof Error
        ? formStudioQuery.error.message
        : "Failed to load Form Studio definitions."
      : null,
    resolveForm: activeSiteId ? resolveContactForm : undefined,
    submitForm: activeSiteId ? submitContactPreview : undefined,
    notify: ({
      type,
      message,
    }: {
      type: "success" | "error";
      message: string;
    }) => {
      if (type === "success") {
        toast.success(message);
        return;
      }

      toast.error(message);
    },
  };

  if (isLoading) return <LoadingSpinner />;

  if (pageError || !page) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <h2 className="text-lg font-semibold text-gray-900">Page not found</h2>
        <button
          onClick={() => navigate("/pages")}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Back to Pages
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between bg-yellow-50 border-b border-yellow-200 px-4 py-2">
        <div className="flex items-center gap-2 text-sm text-yellow-800">
          <span className="font-medium">PREVIEW MODE</span>
          <span>
            {page.published
              ? "— this page is publicly visible"
              : "— this page is not publicly visible (draft)"}
          </span>
        </div>
        <button
          onClick={() => navigate(`/editor/${slug}?locale=${locale}`)}
          className="flex items-center gap-1.5 text-sm font-medium text-yellow-800 hover:text-yellow-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Editor
        </button>
      </div>
      <div>
        <ContactSectionRuntimeProvider value={contactSectionRuntime}>
          <Render
            config={puckConfig}
            data={
              (page.puckData as Data) || { content: [], root: { props: {} } }
            }
          />
        </ContactSectionRuntimeProvider>
      </div>
    </div>
  );
}
