import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { createPage } from "../api/pages";
import { LOCALES } from "../lib/constants";
import { ArrowLeft, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export default function NewPagePage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [locale, setLocale] = useState("en");
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: createPage,
    onSuccess: (page) => {
      toast.success("Page created");
      navigate(`/editor/${page.slug}?locale=${page.locale}`);
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Failed to create page";
      setError(message);
    },
  });

  const handleTitleChange = (value: string) => {
    setTitle(value);
    if (!slugTouched) {
      setSlug(slugify(value));
    }
  };

  const handleSlugChange = (value: string) => {
    setSlugTouched(true);
    setSlug(slugify(value));
  };

  const isValidSlug = /^[a-z0-9-]+$/.test(slug) && slug.length > 0;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!isValidSlug) {
      setError("Slug must contain only lowercase letters, numbers, and hyphens");
      return;
    }
    setError("");
    mutation.mutate({
      title,
      slug,
      locale,
      puckData: { content: [], root: { props: { title: "" } } },
    });
  };

  return (
    <div>
      <button
        onClick={() => navigate("/pages")}
        className="mb-6 flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Pages
      </button>

      <div className="mx-auto max-w-lg">
        <h1 className="mb-6 text-2xl font-bold text-gray-900">
          Create New Page
        </h1>

        <form
          onSubmit={handleSubmit}
          className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
        >
          {error && (
            <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="mb-4">
            <label
              htmlFor="title"
              className="mb-1.5 block text-sm font-medium text-gray-700"
            >
              Title
            </label>
            <input
              id="title"
              type="text"
              required
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="My New Page"
            />
          </div>

          <div className="mb-4">
            <label
              htmlFor="slug"
              className="mb-1.5 block text-sm font-medium text-gray-700"
            >
              Slug
            </label>
            <input
              id="slug"
              type="text"
              required
              value={slug}
              onChange={(e) => handleSlugChange(e.target.value)}
              className={`w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 ${
                slug && !isValidSlug
                  ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                  : "border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              }`}
              placeholder="my-new-page"
            />
            {slug && !isValidSlug && (
              <p className="mt-1 text-xs text-red-600">
                Only lowercase letters, numbers, and hyphens allowed
              </p>
            )}
          </div>

          <div className="mb-6">
            <label
              htmlFor="locale"
              className="mb-1.5 block text-sm font-medium text-gray-700"
            >
              Locale
            </label>
            <select
              id="locale"
              value={locale}
              onChange={(e) => setLocale(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {LOCALES.map((l) => (
                <option key={l} value={l}>
                  {l.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => navigate("/pages")}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending || !isValidSlug}
              className="flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {mutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Create Page
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
