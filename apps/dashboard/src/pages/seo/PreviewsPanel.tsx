import { useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import { useQuery } from "@tanstack/react-query";

import { getPage, getPages, updatePage } from "../../api/pages";
import { useSettings } from "../../hooks/useSettings";
import { useAuth } from "../../auth/useAuth";

interface Props {
  siteId: string;
}

interface DraftSeo {
  seoTitle: string;
  seoDescription: string;
  seoOgImage: string;
}

// Approximate pixel widths Google uses for SERP titles/descriptions on
// desktop and mobile. Hard caps so links/snippets do not get truncated by
// search engines.
const SERP_LIMITS = {
  desktopTitlePx: 600,
  mobileTitlePx: 580,
  desktopDescPx: 920,
  mobileDescPx: 680,
};

const TITLE_FONT = "20px arial, sans-serif";
const DESC_FONT = "14px arial, sans-serif";

function measureWidthPx(text: string, font: string): number {
  if (typeof document === "undefined") return text.length * 6;
  const canvas =
    measureWidthPx.canvas ||
    (measureWidthPx.canvas = document.createElement("canvas"));
  const ctx = canvas.getContext("2d");
  if (!ctx) return text.length * 6;
  ctx.font = font;
  return ctx.measureText(text).width;
}
// eslint-disable-next-line @typescript-eslint/no-namespace
namespace measureWidthPx {
  export let canvas: HTMLCanvasElement | undefined;
}

function truncateToPx(text: string, limitPx: number, font: string): string {
  if (!text) return "";
  if (measureWidthPx(text, font) <= limitPx) return text;
  const ellipsis = "…";
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const slice = text.slice(0, mid) + ellipsis;
    if (measureWidthPx(slice, font) <= limitPx) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return text.slice(0, lo).trimEnd() + ellipsis;
}

export function PreviewsPanel({ siteId }: Props): React.ReactElement {
  void siteId;
  const settings = useSettings();
  const { session } = useAuth();
  const titleTemplate = settings.data?.seoTitleTemplate ?? "%s";
  const publicHost = session?.activeSite?.slug
    ? `${session.activeSite.slug}.example.com`
    : "example.com";

  const pagesQuery = useQuery({
    queryKey: ["pages", "for-previews"],
    queryFn: () => getPages({ limit: 50 }),
  });

  const [selected, setSelected] = useState<{
    slug: string;
    locale: string;
  } | null>(null);

  useEffect(() => {
    if (!selected && pagesQuery.data?.data.length) {
      const first = pagesQuery.data.data[0];
      setSelected({ slug: first.slug, locale: first.locale });
    }
  }, [pagesQuery.data, selected]);

  const pageQuery = useQuery({
    queryKey: ["page", selected?.slug, selected?.locale],
    queryFn: () => getPage(selected!.slug, selected!.locale),
    enabled: !!selected,
  });

  const [draft, setDraft] = useState<DraftSeo | null>(null);
  const initializedFor = useRef<string | null>(null);

  useEffect(() => {
    const page = pageQuery.data;
    if (!page) return;
    const key = `${page.slug}::${page.locale}`;
    if (initializedFor.current === key) return;
    initializedFor.current = key;
    setDraft({
      seoTitle: page.seoTitle ?? "",
      seoDescription: page.seoDescription ?? "",
      seoOgImage: page.seoOgImage ?? "",
    });
  }, [pageQuery.data]);

  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const canonicalUrl = useMemo(() => {
    const slug = pageQuery.data?.slug ?? "";
    const locale = pageQuery.data?.locale ?? "";
    if (!slug) return `https://${publicHost}/`;
    return `https://${publicHost}/${locale}/${slug}`.replace(/\/+$/, "");
  }, [pageQuery.data, publicHost]);

  const renderedTitle = useMemo(() => {
    const t = (draft?.seoTitle || pageQuery.data?.title || "").trim();
    if (!t) return "";
    return titleTemplate.includes("%s") ? titleTemplate.replace("%s", t) : t;
  }, [draft?.seoTitle, pageQuery.data?.title, titleTemplate]);

  const renderedDesc = (
    draft?.seoDescription ||
    settings.data?.seoDefaultDesc ||
    ""
  ).trim();

  const ogImage = draft?.seoOgImage || settings.data?.seoOgImage || null;

  if (pagesQuery.isLoading) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-8 text-sm text-gray-500">
        Loading pages…
      </div>
    );
  }
  if (!pagesQuery.data?.data.length) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-8">
        <h2 className="text-lg font-semibold text-gray-900">Previews</h2>
        <p className="mt-2 text-sm text-gray-600">
          Create pages to preview their SERP and social cards.
        </p>
      </div>
    );
  }

  const onSave = async () => {
    if (!pageQuery.data || !draft) return;
    setSaving(true);
    try {
      await updatePage(pageQuery.data.slug, pageQuery.data.locale, {
        seoTitle: draft.seoTitle,
        seoDescription: draft.seoDescription,
        seoOgImage: draft.seoOgImage,
      });
      setSavedAt(new Date());
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900">
          SERP & Social Previews
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          See exactly how a page appears on Google, Facebook, and Twitter before
          publishing. Edits below preview live and save back to the page.
        </p>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="block text-sm">
            <span className="font-medium text-gray-700">Page</span>
            <select
              className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
              value={selected ? `${selected.slug}::${selected.locale}` : ""}
              onChange={(e) => {
                const [slug, locale] = e.target.value.split("::");
                setSelected({ slug, locale });
                initializedFor.current = null;
              }}
            >
              {pagesQuery.data.data.map((p) => (
                <option
                  key={`${p.slug}::${p.locale}`}
                  value={`${p.slug}::${p.locale}`}
                >
                  /{p.locale}/{p.slug} — {p.title}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end justify-end gap-2">
            <button
              type="button"
              onClick={onSave}
              disabled={saving || !draft}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
            {savedAt && (
              <span className="text-xs text-gray-500">
                Saved {savedAt.toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>

        {draft && (
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <EditField
              label="SEO title"
              value={draft.seoTitle}
              hint="Used as the SERP and OG title. Falls back to page title."
              onChange={(v) => setDraft({ ...draft, seoTitle: v })}
            />
            <EditField
              label="OG image URL"
              value={draft.seoOgImage}
              hint="Recommended 1200×630 px (aspect 1.91:1)."
              onChange={(v) => setDraft({ ...draft, seoOgImage: v })}
            />
            <EditField
              label="Meta description"
              value={draft.seoDescription}
              hint="Used as the SERP snippet and OG description."
              onChange={(v) => setDraft({ ...draft, seoDescription: v })}
              textarea
            />
          </div>
        )}
      </div>

      <SerpPreview
        title={renderedTitle}
        desc={renderedDesc}
        url={canonicalUrl}
        width="desktop"
      />
      <SerpPreview
        title={renderedTitle}
        desc={renderedDesc}
        url={canonicalUrl}
        width="mobile"
      />
      <SocialPreview
        kind="facebook"
        title={renderedTitle}
        desc={renderedDesc}
        url={canonicalUrl}
        ogImage={ogImage}
      />
      <SocialPreview
        kind="twitter"
        title={renderedTitle}
        desc={renderedDesc}
        url={canonicalUrl}
        ogImage={ogImage}
      />
    </div>
  );
}

function EditField({
  label,
  value,
  onChange,
  hint,
  textarea = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  textarea?: boolean;
}): React.ReactElement {
  return (
    <label className="block text-sm">
      <span className="font-medium text-gray-700">{label}</span>
      {textarea ? (
        <textarea
          className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
          rows={3}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          type="text"
          className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {hint && <span className="mt-1 block text-xs text-gray-500">{hint}</span>}
    </label>
  );
}

function SerpPreview({
  title,
  desc,
  url,
  width,
}: {
  title: string;
  desc: string;
  url: string;
  width: "desktop" | "mobile";
}): React.ReactElement {
  const titleLimit =
    width === "desktop"
      ? SERP_LIMITS.desktopTitlePx
      : SERP_LIMITS.mobileTitlePx;
  const descLimit =
    width === "desktop" ? SERP_LIMITS.desktopDescPx : SERP_LIMITS.mobileDescPx;
  const titleClipped = truncateToPx(
    title || "Untitled",
    titleLimit,
    TITLE_FONT,
  );
  const descClipped = truncateToPx(
    desc || "Add a meta description to control this snippet.",
    descLimit,
    DESC_FONT,
  );
  const titleTruncated = titleClipped !== (title || "Untitled");
  const descTruncated =
    descClipped !== (desc || "Add a meta description to control this snippet.");

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6">
      <div className="mb-4 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-gray-900">
          Google SERP — {width === "desktop" ? "Desktop" : "Mobile"}
        </h3>
        {(titleTruncated || descTruncated) && (
          <span className="rounded bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800">
            {titleTruncated && descTruncated
              ? "Title & description truncated"
              : titleTruncated
                ? "Title truncated"
                : "Description truncated"}
          </span>
        )}
      </div>
      <div
        className="rounded-lg border border-gray-100 bg-gray-50 p-4"
        style={{
          maxWidth: width === "desktop" ? 640 : 380,
        }}
      >
        <div className="text-xs text-gray-600">{url}</div>
        <div
          className="mt-1 text-xl text-blue-700 underline-offset-2 hover:underline"
          style={{ fontFamily: "arial, sans-serif" }}
        >
          {titleClipped}
        </div>
        <div
          className="mt-1 text-sm text-gray-700"
          style={{ fontFamily: "arial, sans-serif" }}
        >
          {descClipped}
        </div>
      </div>
    </div>
  );
}

function SocialPreview({
  kind,
  title,
  desc,
  url,
  ogImage,
}: {
  kind: "facebook" | "twitter";
  title: string;
  desc: string;
  url: string;
  ogImage: string | null;
}): React.ReactElement {
  const domain = (() => {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  })();
  const label =
    kind === "facebook"
      ? "Facebook / Open Graph (1200×630)"
      : "Twitter — summary_large_image (1200×675)";
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6">
      <h3 className="mb-4 text-sm font-semibold text-gray-900">{label}</h3>
      <div
        className="overflow-hidden rounded-lg border border-gray-200 bg-white"
        style={{ maxWidth: 520 }}
      >
        <div
          className="flex items-center justify-center bg-gray-100"
          style={{
            aspectRatio: kind === "facebook" ? "1.91 / 1" : "1.78 / 1",
          }}
        >
          {ogImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={ogImage}
              alt="OG preview"
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="text-xs text-gray-500">No og:image set</span>
          )}
        </div>
        <div className="border-t border-gray-200 px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-gray-500">
            {domain}
          </div>
          <div className="mt-1 font-semibold text-gray-900 line-clamp-2">
            {title || "Untitled"}
          </div>
          <div className="mt-1 text-sm text-gray-600 line-clamp-2">
            {desc || "Add a meta description to control this card."}
          </div>
        </div>
      </div>
    </div>
  );
}
