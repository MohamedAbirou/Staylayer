import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Render, type Data } from "@puckeditor/core";
import { puckConfig } from "@myallocator/puck-components";
import { getPagePreview } from "../api/pages";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { ArrowLeft } from "lucide-react";
import "@puckeditor/core/puck.css";

export default function PreviewPage() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const locale = searchParams.get("locale") || "en";
  const navigate = useNavigate();

  const {
    data: page,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["preview", slug, locale],
    queryFn: () => getPagePreview(slug!, locale),
    enabled: !!slug,
  });

  if (isLoading) return <LoadingSpinner />;

  if (error || !page) {
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
        <Render
          config={puckConfig}
          data={(page.puckData as Data) || { content: [], root: { props: {} } }}
        />
      </div>
    </div>
  );
}
