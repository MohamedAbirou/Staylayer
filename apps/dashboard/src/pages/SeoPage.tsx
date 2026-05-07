import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Plus, Trash2, Loader as Loader2, ToggleLeft, ToggleRight, Search, MapPin, Building, Phone, Star } from "lucide-react";
import { useAuth } from "../auth/useAuth";
import {
  getRedirects,
  createRedirect,
  toggleRedirect,
  deleteRedirect,
  getStructuredData,
  upsertStructuredData,
  type RedirectDto,
  type StructuredDataDto,
} from "../api/seo";

type Tab = "redirects" | "structured-data";

export default function SeoPage() {
  const { session } = useAuth();
  const siteId = session?.activeSite?.id ?? null;
  const [tab, setTab] = useState<Tab>("redirects");

  if (!siteId) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900">SEO</h1>
        <p className="mt-2 text-sm text-gray-600">Select a site to manage SEO settings.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">SEO</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage redirects, structured data, and search engine optimization.
        </p>
      </div>

      <div className="flex gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1">
        <button
          onClick={() => setTab("redirects")}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            tab === "redirects"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-800"
          }`}
        >
          Redirects
        </button>
        <button
          onClick={() => setTab("structured-data")}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            tab === "structured-data"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-800"
          }`}
        >
          Structured Data
        </button>
      </div>

      {tab === "redirects" && <RedirectsPanel siteId={siteId} />}
      {tab === "structured-data" && <StructuredDataPanel siteId={siteId} />}
    </div>
  );
}

function RedirectsPanel({ siteId }: { siteId: string }) {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [fromPath, setFromPath] = useState("");
  const [toPath, setToPath] = useState("");
  const [permanent, setPermanent] = useState(true);

  const { data: redirects = [], isLoading } = useQuery({
    queryKey: ["seo", "redirects", siteId],
    queryFn: () => getRedirects(siteId),
  });

  const createMutation = useMutation({
    mutationFn: () => createRedirect(siteId, { fromPath, toPath, permanent }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["seo", "redirects", siteId] });
      setShowAdd(false);
      setFromPath("");
      setToPath("");
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      toggleRedirect(siteId, id, enabled),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["seo", "redirects", siteId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteRedirect(siteId, id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["seo", "redirects", siteId] });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          Redirect old URLs to prevent broken links after slug renames or page deletions.
        </p>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Add redirect
        </button>
      </div>

      {showAdd && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">From path</label>
              <input
                type="text"
                value={fromPath}
                onChange={(e) => setFromPath(e.target.value)}
                placeholder="/old-page"
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">To path</label>
              <input
                type="text"
                value={toPath}
                onChange={(e) => setToPath(e.target.value)}
                placeholder="/new-page"
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
              />
            </div>
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={permanent}
              onChange={(e) => setPermanent(e.target.checked)}
              className="rounded border-gray-300"
            />
            Permanent (301) - use for pages that have moved forever
          </label>
          {createMutation.isError && (
            <p className="mt-2 text-xs text-red-600">
              {(createMutation.error as { response?: { data?: { message?: string } } })
                ?.response?.data?.message ?? "Failed to create redirect."}
            </p>
          )}
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => createMutation.mutate()}
              disabled={!fromPath.trim() || !toPath.trim() || createMutation.isPending}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 hover:bg-blue-700"
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Create
            </button>
            <button
              onClick={() => setShowAdd(false)}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-sm text-gray-400">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading...
          </div>
        ) : redirects.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-center">
            <ArrowRight className="h-8 w-8 text-gray-200" />
            <p className="mt-3 text-sm text-gray-500">No redirects configured</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {redirects.map((r) => (
              <div key={r.id} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                      r.permanent
                        ? "bg-blue-100 text-blue-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {r.statusCode}
                  </span>
                  <span className="truncate font-mono text-sm text-gray-900">{r.fromPath}</span>
                  <ArrowRight className="h-3 w-3 shrink-0 text-gray-400" />
                  <span className="truncate font-mono text-sm text-gray-600">{r.toPath}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => toggleMutation.mutate({ id: r.id, enabled: !r.enabled })}
                    className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"
                    title={r.enabled ? "Disable" : "Enable"}
                  >
                    {r.enabled ? (
                      <ToggleRight className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <ToggleLeft className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    onClick={() => deleteMutation.mutate(r.id)}
                    disabled={deleteMutation.isPending}
                    className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StructuredDataPanel({ siteId }: { siteId: string }) {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["seo", "structured-data", siteId],
    queryFn: () => getStructuredData(siteId),
  });

  const [form, setForm] = useState<Partial<StructuredDataDto>>({});
  const [initialized, setInitialized] = useState(false);

  if (data && !initialized) {
    setForm(data);
    setInitialized(true);
  }

  const saveMutation = useMutation({
    mutationFn: () => upsertStructuredData(siteId, form),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["seo", "structured-data", siteId] });
    },
  });

  const updateField = (key: string, value: unknown) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-gray-400">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-600">
        Configure Schema.org structured data for rich search results. This information helps
        search engines display enhanced listings for your hospitality business.
      </p>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-5">
          <Building className="h-4 w-4 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-900">Business Identity</h3>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Business type"
            value={form.businessType ?? "Hotel"}
            onChange={(v) => updateField("businessType", v)}
            type="select"
            options={["Hotel", "Resort", "Hostel", "Motel", "BedAndBreakfast", "VacationRental", "LodgingBusiness"]}
          />
          <Field
            label="Business name"
            value={form.businessName ?? ""}
            onChange={(v) => updateField("businessName", v)}
          />
          <Field
            label="Description"
            value={form.description ?? ""}
            onChange={(v) => updateField("description", v)}
            className="sm:col-span-2"
          />
          <Field
            label="Image URL"
            value={form.imageUrl ?? ""}
            onChange={(v) => updateField("imageUrl", v)}
            placeholder="https://..."
            className="sm:col-span-2"
          />
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-5">
          <MapPin className="h-4 w-4 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-900">Location</h3>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Street address"
            value={form.streetAddress ?? ""}
            onChange={(v) => updateField("streetAddress", v)}
            className="sm:col-span-2"
          />
          <Field label="City" value={form.city ?? ""} onChange={(v) => updateField("city", v)} />
          <Field label="Region/State" value={form.region ?? ""} onChange={(v) => updateField("region", v)} />
          <Field label="Postal code" value={form.postalCode ?? ""} onChange={(v) => updateField("postalCode", v)} />
          <Field label="Country" value={form.country ?? ""} onChange={(v) => updateField("country", v)} />
          <Field
            label="Latitude"
            value={form.latitude?.toString() ?? ""}
            onChange={(v) => updateField("latitude", v ? parseFloat(v) : null)}
            placeholder="e.g. 40.7128"
          />
          <Field
            label="Longitude"
            value={form.longitude?.toString() ?? ""}
            onChange={(v) => updateField("longitude", v ? parseFloat(v) : null)}
            placeholder="e.g. -74.0060"
          />
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-5">
          <Phone className="h-4 w-4 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-900">Contact & Details</h3>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Telephone" value={form.telephone ?? ""} onChange={(v) => updateField("telephone", v)} />
          <Field label="Email" value={form.email ?? ""} onChange={(v) => updateField("email", v)} />
          <Field label="Price range" value={form.priceRange ?? ""} onChange={(v) => updateField("priceRange", v)} placeholder="e.g. $$" />
          <Field
            label="Star rating"
            value={form.starRating?.toString() ?? ""}
            onChange={(v) => updateField("starRating", v ? parseInt(v, 10) : null)}
            placeholder="1-5"
          />
          <Field label="Check-in time" value={form.checkInTime ?? ""} onChange={(v) => updateField("checkInTime", v)} placeholder="e.g. 15:00" />
          <Field label="Check-out time" value={form.checkOutTime ?? ""} onChange={(v) => updateField("checkOutTime", v)} placeholder="e.g. 11:00" />
          <Field
            label="Room count"
            value={form.roomCount?.toString() ?? ""}
            onChange={(v) => updateField("roomCount", v ? parseInt(v, 10) : null)}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
        >
          {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Save structured data
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  className,
  type,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  type?: "text" | "select";
  options?: string[];
}) {
  return (
    <div className={className}>
      <label className="mb-1 block text-xs font-medium text-gray-700">{label}</label>
      {type === "select" && options ? (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
        >
          {options.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
        />
      )}
    </div>
  );
}
