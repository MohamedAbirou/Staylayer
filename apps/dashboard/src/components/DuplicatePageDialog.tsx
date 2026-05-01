import { useState, useEffect, useRef, type FormEvent } from "react";
import { X } from "lucide-react";
import { LOCALES } from "../lib/constants";

interface DuplicatePageDialogProps {
  open: boolean;
  sourceTitle: string;
  sourceLocale: string;
  onConfirm: (newSlug: string, newTitle: string, newLocale: string) => void;
  onCancel: () => void;
  isPending?: boolean;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export function DuplicatePageDialog({
  open,
  sourceTitle,
  sourceLocale,
  onConfirm,
  onCancel,
  isPending = false,
}: DuplicatePageDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [locale, setLocale] = useState(sourceLocale);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      const defaultTitle = `Copy of ${sourceTitle}`;
      setTitle(defaultTitle);
      setSlug(slugify(defaultTitle));
      setSlugTouched(false);
      setLocale(sourceLocale);
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [open, sourceTitle, sourceLocale]);

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
    if (!isValidSlug || !title.trim()) return;
    onConfirm(slug, title.trim(), locale);
  };

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      onClose={onCancel}
      className="fixed inset-0 z-50 m-auto w-full max-w-md rounded-lg border-0 bg-white p-0 shadow-xl backdrop:bg-black/50"
    >
      <form onSubmit={handleSubmit}>
        <div className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              Duplicate Page
            </h3>
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md p-1 text-gray-400 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <p className="mb-4 text-sm text-gray-500">
            Creating a copy of{" "}
            <span className="font-medium text-gray-700">"{sourceTitle}"</span>.
            The duplicate will be saved as a draft.
          </p>

          <div className="space-y-4">
            <div>
              <label
                htmlFor="dup-title"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Title
              </label>
              <input
                id="dup-title"
                type="text"
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                required
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label
                htmlFor="dup-slug"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Slug
              </label>
              <div className="flex items-center gap-1">
                <span className="text-sm text-gray-400">/</span>
                <input
                  id="dup-slug"
                  type="text"
                  value={slug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  required
                  className={`w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 ${
                    isValidSlug
                      ? "border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                      : "border-red-300 focus:border-red-500 focus:ring-red-500"
                  }`}
                />
              </div>
              {!isValidSlug && slug.length > 0 && (
                <p className="mt-1 text-xs text-red-600">
                  Only lowercase letters, numbers, and hyphens allowed.
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="dup-locale"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Locale
              </label>
              <select
                id="dup-locale"
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
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isValidSlug || !title.trim() || isPending}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isPending ? "Duplicating…" : "Duplicate"}
            </button>
          </div>
        </div>
      </form>
    </dialog>
  );
}
