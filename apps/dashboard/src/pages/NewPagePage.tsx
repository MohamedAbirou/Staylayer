import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { createPage } from "../api/pages";
import { LOCALES } from "../lib/constants";
import {
  ArrowLeft,
  Loader2,
  Home,
  Bed,
  Utensils,
  MapPin,
  Image,
  HelpCircle,
  Mail,
  FileText,
  Sparkles,
  BookOpen,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  pageTemplates,
  BLANK_TEMPLATE,
  type PuckTemplate,
} from "@staylayer/puck-components";

// ─── Hospitality page presets ─────────────────────────────────────────────────
const HOSPITALITY_PRESETS = [
  { label: "Homepage", slug: "home", icon: Home },
  { label: "Accommodation", slug: "accommodation", icon: Bed },
  { label: "Amenities", slug: "amenities", icon: Utensils },
  { label: "Location", slug: "location", icon: MapPin },
  { label: "Gallery", slug: "gallery", icon: Image },
  { label: "FAQ", slug: "faq", icon: HelpCircle },
  { label: "Contact & Inquiry", slug: "contact", icon: Mail },
] as const;

// ─── Starter template icons ──────────────────────────────────────────────────
const TEMPLATE_ICONS: Record<string, typeof Home> = {
  blank: FileText,
  "boutique-lodge-home": Home,
  "villa-rental-home": Sparkles,
  "accommodation-detail": Bed,
  "contact-inquiry": Mail,
  "local-guide": BookOpen,
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/^\/+|\/+$/g, "")
    .replace(/[\/_]+/g, "-")
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
  const [templateId, setTemplateId] = useState<string>(BLANK_TEMPLATE.id);

  const selectedTemplate: PuckTemplate =
    pageTemplates.find((t) => t.id === templateId) ?? BLANK_TEMPLATE;

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

  const applyPreset = (presetLabel: string, presetSlug: string) => {
    setTitle(presetLabel);
    setSlug(presetSlug);
    setSlugTouched(true);
  };

  const handleSelectTemplate = (id: string) => {
    setTemplateId(id);
    const tpl = pageTemplates.find((t) => t.id === id);
    if (!tpl) return;
    // Only prefill title/slug when user hasn't typed their own values yet.
    if (!title && tpl.suggestedTitle) {
      setTitle(tpl.suggestedTitle);
    }
    if (!slugTouched && tpl.suggestedSlug) {
      setSlug(slugify(tpl.suggestedSlug));
    }
  };

  const isValidSlug = /^[a-z0-9-]+$/.test(slug) && slug.length > 0;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!isValidSlug) {
      setError(
        "Slug must contain only lowercase letters, numbers, and hyphens",
      );
      return;
    }
    setError("");
    mutation.mutate({
      title,
      slug,
      locale,
      puckData: selectedTemplate.puckData as unknown as Record<string, unknown>,
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

      <div className="mx-auto max-w-3xl">
        <h1 className="mb-2 text-2xl font-bold text-gray-900">
          Create New Page
        </h1>
        <p className="mb-5 text-sm text-gray-500">
          Start from a ready-made hospitality template, or pick a blank page and
          assemble it yourself.
        </p>

        {/* Starter templates */}
        <div className="mb-6 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400">
            Starter template
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {pageTemplates.map((tpl) => {
              const Icon = TEMPLATE_ICONS[tpl.id] ?? FileText;
              const isSelected = templateId === tpl.id;
              return (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => handleSelectTemplate(tpl.id)}
                  className={`flex flex-col items-start gap-1.5 rounded-lg border-2 p-3 text-left transition-all ${
                    isSelected
                      ? "border-blue-500 bg-blue-50/50 shadow-sm"
                      : "border-gray-200 bg-white hover:border-blue-300"
                  }`}
                >
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-md ${
                      isSelected
                        ? "bg-blue-100 text-blue-700"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-semibold text-gray-900">
                    {tpl.label}
                  </span>
                  <span className="text-xs leading-snug text-gray-500">
                    {tpl.description}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Hospitality presets */}
        <div className="mb-6 rounded-xl border border-gray-100 bg-gray-50 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400">
            Title & slug presets
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {HOSPITALITY_PRESETS.map(
              ({ label, slug: presetSlug, icon: Icon }) => (
                <button
                  key={presetSlug}
                  type="button"
                  onClick={() => applyPreset(label, presetSlug)}
                  className={`flex flex-col items-center gap-1.5 rounded-lg border-2 px-3 py-2.5 text-xs font-medium transition-all ${
                    slug === presetSlug && title === label
                      ? "border-blue-500 bg-white text-blue-700 shadow-sm"
                      : "border-transparent bg-white text-gray-600 hover:border-blue-200 hover:text-blue-600"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ),
            )}
          </div>
        </div>

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
