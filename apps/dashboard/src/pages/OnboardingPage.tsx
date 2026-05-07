import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { createPage } from "../api/pages";
import { LOCALES } from "../lib/constants";
import {
  Hotel,
  Home,
  Bed,
  Leaf,
  DoorOpen,
  Image,
  HelpCircle,
  Mail,
  MapPin,
  Utensils,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import toast from "react-hot-toast";

// ─── Brand types ─────────────────────────────────────────────────────────────
const BRAND_TYPES = [
  { id: "villa", label: "Villa", icon: Home },
  { id: "hotel", label: "Hotel", icon: Hotel },
  { id: "bnb", label: "B&B", icon: DoorOpen },
  { id: "glamping", label: "Glamping", icon: Leaf },
  { id: "guesthouse", label: "Guest House", icon: Bed },
] as const;

type BrandType = (typeof BRAND_TYPES)[number]["id"];

// ─── Hospitality page presets ─────────────────────────────────────────────────
const PAGE_PRESETS = [
  {
    id: "homepage",
    label: "Homepage",
    slug: "home",
    icon: Home,
    description: "Your main landing page with hero and key highlights",
    recommended: true,
  },
  {
    id: "accommodation",
    label: "Accommodation",
    slug: "accommodation",
    icon: Bed,
    description: "Showcase rooms, suites, or units with photos and details",
    recommended: true,
  },
  {
    id: "amenities",
    label: "Amenities",
    slug: "amenities",
    icon: Utensils,
    description: "Highlight your facilities, services, and guest experiences",
  },
  {
    id: "location",
    label: "Location",
    slug: "location",
    icon: MapPin,
    description:
      "Share your destination, nearby attractions, and how to get there",
  },
  {
    id: "gallery",
    label: "Gallery",
    slug: "gallery",
    icon: Image,
    description: "Visual showcase of your property and surroundings",
  },
  {
    id: "faq",
    label: "FAQ",
    slug: "faq",
    icon: HelpCircle,
    description: "Answer common guest questions about your property",
  },
  {
    id: "contact",
    label: "Contact & Inquiry",
    slug: "contact",
    icon: Mail,
    description:
      "Contact details and inquiry form for direct guest communication",
    recommended: true,
  },
] as const;

// ─── Main page ────────────────────────────────────────────────────────────────
export default function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [brandType, setBrandType] = useState<BrandType | null>(null);
  const [primaryLocale, setPrimaryLocale] = useState("en");
  const [selectedPresets, setSelectedPresets] = useState<Set<string>>(
    new Set(["homepage", "accommodation", "contact"]),
  );
  const [creating, setCreating] = useState(false);
  const [createdCount, setCreatedCount] = useState(0);

  const createMutation = useMutation({ mutationFn: createPage });

  const togglePreset = (id: string) => {
    setSelectedPresets((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleCreatePages = async (e: FormEvent) => {
    e.preventDefault();
    if (selectedPresets.size === 0) {
      toast.error("Select at least one page preset");
      return;
    }
    setCreating(true);
    setCreatedCount(0);
    const presetsToCreate = PAGE_PRESETS.filter((p) =>
      selectedPresets.has(p.id),
    );
    let count = 0;
    for (const preset of presetsToCreate) {
      try {
        await createMutation.mutateAsync({
          title: preset.label,
          slug: preset.slug,
          locale: primaryLocale,
          puckData: { content: [], root: { props: { title: preset.label } } },
        });
        count++;
        setCreatedCount(count);
      } catch {
        // Skip duplicates silently — page may already exist
      }
    }
    setCreating(false);
    toast.success(
      count === 1
        ? "Page created — start editing!"
        : `${count} starter pages created`,
    );
    navigate("/pages");
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      {/* Progress */}
      <div className="flex items-center gap-3">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                s < step
                  ? "bg-blue-600 text-white"
                  : s === step
                    ? "bg-blue-600 text-white ring-4 ring-blue-100"
                    : "bg-gray-100 text-gray-400"
              }`}
            >
              {s < step ? <CheckCircle2 className="h-4 w-4" /> : s}
            </div>
            {s < 3 && (
              <div
                className={`h-0.5 w-10 rounded-full ${s < step ? "bg-blue-400" : "bg-gray-200"}`}
              />
            )}
          </div>
        ))}
        <p className="ml-2 text-sm text-gray-500">
          {step === 1 && "Brand type"}
          {step === 2 && "Primary language"}
          {step === 3 && "Starter pages"}
        </p>
      </div>

      {/* ─── Step 1: Brand type ─────────────────────────────────────────── */}
      {step === 1 && (
        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900">
            What type of property are you creating a site for?
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            We use this to set the right tone and page presets for your
            hospitality workspace.
          </p>

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {BRAND_TYPES.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setBrandType(id)}
                className={`flex flex-col items-center gap-2 rounded-xl border-2 px-4 py-5 text-sm font-medium transition-all ${
                  brandType === id
                    ? "border-blue-500 bg-blue-50 text-blue-700 shadow-sm"
                    : "border-gray-200 text-gray-600 hover:border-blue-200 hover:bg-blue-50/30"
                }`}
              >
                <Icon className="h-6 w-6" />
                {label}
              </button>
            ))}
          </div>

          <div className="mt-8 flex justify-end">
            <button
              type="button"
              disabled={!brandType}
              onClick={() => setStep(2)}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Continue
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ─── Step 2: Primary locale ─────────────────────────────────────── */}
      {step === 2 && (
        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900">
            What language will your site use primarily?
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            You can add more languages later in Site Settings.
          </p>

          <div className="mt-6">
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Primary language
            </label>
            <select
              value={primaryLocale}
              onChange={(e) => setPrimaryLocale(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
            >
              {LOCALES.map((locale) => (
                <option key={locale} value={locale}>
                  {locale.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-8 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <button
              type="button"
              onClick={() => setStep(3)}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
            >
              Continue
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ─── Step 3: Page presets ────────────────────────────────────────── */}
      {step === 3 && (
        <form onSubmit={handleCreatePages}>
          <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
            <h1 className="text-2xl font-bold text-gray-900">
              Choose your starter pages
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              We&apos;ll create blank pages with these names so you can start
              editing right away. You can always add or remove pages later.
            </p>

            <div className="mt-6 space-y-2">
              {PAGE_PRESETS.map((preset) => {
                const { id, label, icon: Icon, description } = preset;
                const recommended =
                  "recommended" in preset && !!preset.recommended;
                return (
                  <label
                    key={id}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 px-4 py-3.5 transition-all ${
                      selectedPresets.has(id)
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-blue-200"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedPresets.has(id)}
                      onChange={() => togglePreset(id)}
                      className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <Icon
                      className={`mt-0.5 h-4 w-4 shrink-0 ${
                        selectedPresets.has(id)
                          ? "text-blue-600"
                          : "text-gray-400"
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900">
                          {label}
                        </span>
                        {recommended && (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                            Recommended
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-gray-500">
                        {description}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>

            <div className="mt-8 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => navigate("/pages")}
                  className="text-sm text-gray-400 hover:text-gray-700"
                >
                  Skip for now
                </button>
                <button
                  type="submit"
                  disabled={creating || selectedPresets.size === 0}
                  className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {creating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating {createdCount}/{selectedPresets.size}…
                    </>
                  ) : (
                    <>
                      Create {selectedPresets.size} page
                      {selectedPresets.size !== 1 ? "s" : ""}
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
