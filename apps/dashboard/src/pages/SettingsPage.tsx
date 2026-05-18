import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSettings, useUpdateSettings } from "../hooks/useSettings";
import { getPages } from "../api/pages";
import { getReadiness } from "../api/settings";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { formatRelativeTime } from "../lib/formatDate";
import { LOCALES } from "../lib/constants";
import {
  ImageAssetField,
  type ImageAssetPreset,
} from "@staylayer/puck-components";
import type { UpdateSettingsPayload } from "../api/settings";
import { useAuth } from "../auth/useAuth";
import {
  Loader2,
  Globe,
  CheckCircle2,
  Save,
  RotateCcw,
  BarChart3,
  Link,
  FileText,
  Tags,
  Image,
  Eye,
  EyeOff,
  ChevronRight,
  AlertCircle,
  TrendingUp,
  Languages,
} from "lucide-react";
import toast from "react-hot-toast";

// ─── Types ─────────────────────────────────────────────────

const readinessTone = {
  ready: {
    badge: "bg-emerald-100 text-emerald-700",
    panel: "border-emerald-200 bg-emerald-50/60",
    kicker: "text-emerald-700",
  },
  warning: {
    badge: "bg-amber-100 text-amber-800",
    panel: "border-amber-200 bg-amber-50/60",
    kicker: "text-amber-800",
  },
  blocking: {
    badge: "bg-red-100 text-red-700",
    panel: "border-red-200 bg-red-50/60",
    kicker: "text-red-700",
  },
} as const;

// ─── Helpers ───────────────────────────────────────────────

const LOCALE_META: Record<
  string,
  { label: string; flag: string; nativeName: string }
> = {
  en: { label: "English", flag: "🇬🇧", nativeName: "English" },
  es: { label: "Spanish", flag: "🇪🇸", nativeName: "Español" },
  fr: { label: "French", flag: "🇫🇷", nativeName: "Français" },
  de: { label: "German", flag: "🇩🇪", nativeName: "Deutsch" },
  it: { label: "Italian", flag: "🇮🇹", nativeName: "Italiano" },
  pt: { label: "Portuguese", flag: "🇵🇹", nativeName: "Português" },
  nl: { label: "Dutch", flag: "🇳🇱", nativeName: "Nederlands" },
  ar: { label: "Arabic", flag: "🇸🇦", nativeName: "العربية" },
};

type SeoLocaleDefault = {
  titleTemplate: string;
  description: string;
  ogImage: string;
};

type SeoLocaleDefaults = Record<string, SeoLocaleDefault>;

function normalizeSeoLocaleDefaults(
  defaults?: Record<
    string,
    { titleTemplate?: string; description?: string; ogImage?: string }
  >,
): SeoLocaleDefaults {
  return LOCALES.reduce<SeoLocaleDefaults>((acc, locale) => {
    const entry = defaults?.[locale] ?? {};
    acc[locale] = {
      titleTemplate: entry.titleTemplate ?? "",
      description: entry.description ?? "",
      ogImage: entry.ogImage ?? "",
    };
    return acc;
  }, {});
}

type InquiryDeliveryPresetId =
  | "email"
  | "custom_webhook"
  | "zapier"
  | "make"
  | "n8n"
  | "hubspot"
  | "salesforce"
  | "pipedrive"
  | "zoho"
  | "pms_api";

type InquiryDeliveryPreset = {
  id: InquiryDeliveryPresetId;
  label: string;
  description: string;
  endpointLabel: string;
  endpointPlaceholder: string;
  endpointHelp: string;
  secretLabel: string;
  secretPlaceholder: string;
  secretHelp: string;
};

const INQUIRY_DELIVERY_PRESETS: InquiryDeliveryPreset[] = [
  {
    id: "email",
    label: "Email only",
    description:
      "Keep delivery simple and send inquiries only to the routing inbox.",
    endpointLabel: "",
    endpointPlaceholder: "",
    endpointHelp: "",
    secretLabel: "",
    secretPlaceholder: "",
    secretHelp: "",
  },
  {
    id: "hubspot",
    label: "HubSpot",
    description: "Create or update contacts and open inquiry tickets.",
    endpointLabel: "HubSpot API base",
    endpointPlaceholder: "https://api.hubapi.com",
    endpointHelp:
      "Optional. StayLayer uses HubSpot's public CRM API by default.",
    secretLabel: "Private app access token",
    secretPlaceholder: "pat-na1-...",
    secretHelp:
      "Required. Use a HubSpot private app token with CRM object scopes.",
  },
  {
    id: "salesforce",
    label: "Salesforce",
    description: "Create native Salesforce Leads from inquiries.",
    endpointLabel: "Instance URL",
    endpointPlaceholder: "https://your-domain.my.salesforce.com",
    endpointHelp:
      "Required. Use the Salesforce instance URL for REST API calls.",
    secretLabel: "OAuth access token",
    secretPlaceholder: "00D...",
    secretHelp:
      "Required. Token must allow Lead creation through the REST API.",
  },
  {
    id: "pipedrive",
    label: "Pipedrive",
    description: "Create people and leads in Pipedrive.",
    endpointLabel: "Company domain",
    endpointPlaceholder: "your-company",
    endpointHelp: "Enter the Pipedrive company domain, without .pipedrive.com.",
    secretLabel: "API token",
    secretPlaceholder: "Pipedrive API token",
    secretHelp: "Required. Use a token allowed to create people and leads.",
  },
  {
    id: "zoho",
    label: "Zoho CRM",
    description: "Create native Zoho CRM Leads from inquiries.",
    endpointLabel: "Zoho API domain",
    endpointPlaceholder: "https://www.zohoapis.com",
    endpointHelp:
      "Required for non-US data centers; otherwise the US API is used.",
    secretLabel: "OAuth access token",
    secretPlaceholder: "1000....",
    secretHelp: "Required. Token must allow Leads create access in Zoho CRM.",
  },
  {
    id: "zapier",
    label: "Zapier",
    description:
      "Send a Zapier catch-hook payload shaped for workflow triggers.",
    endpointLabel: "Zapier catch hook",
    endpointPlaceholder: "https://hooks.zapier.com/hooks/catch/...",
    endpointHelp: "Paste the hook URL from your Zap trigger.",
    secretLabel: "Verification token",
    secretPlaceholder: "Optional token or shared secret",
    secretHelp:
      "Optional. StayLayer signs the payload when a token is provided.",
  },
  {
    id: "make",
    label: "Make",
    description: "Send a Make custom webhook payload shaped for scenarios.",
    endpointLabel: "Make webhook URL",
    endpointPlaceholder: "https://hook.us1.make.com/...",
    endpointHelp: "Paste the custom webhook URL from your Make scenario.",
    secretLabel: "Signing secret",
    secretPlaceholder: "Optional shared secret",
    secretHelp: "Optional. Adds a StayLayer HMAC signature header.",
  },
  {
    id: "n8n",
    label: "n8n",
    description: "Send a structured payload to an n8n production webhook.",
    endpointLabel: "n8n webhook URL",
    endpointPlaceholder: "https://n8n.example.com/webhook/...",
    endpointHelp: "Paste the production webhook URL from n8n.",
    secretLabel: "Signing secret",
    secretPlaceholder: "Optional shared secret",
    secretHelp: "Optional. Adds a StayLayer HMAC signature header.",
  },
  {
    id: "pms_api",
    label: "PMS / reservations API",
    description: "Send a reservation-inquiry handoff to a PMS API endpoint.",
    endpointLabel: "PMS API endpoint",
    endpointPlaceholder: "https://pms.example.com/api/reservation-inquiries",
    endpointHelp:
      "Required. Use the PMS endpoint that accepts reservation inquiries.",
    secretLabel: "API key or bearer token",
    secretPlaceholder: "PMS API credential",
    secretHelp:
      "Required. StayLayer sends it as a bearer token and signing secret.",
  },
  {
    id: "custom_webhook",
    label: "Custom webhook",
    description:
      "Bring your own endpoint when none of the named presets match your stack.",
    endpointLabel: "Webhook URL",
    endpointPlaceholder: "https://example.com/hooks/inquiries",
    endpointHelp: "Paste the full endpoint URL for your custom integration.",
    secretLabel: "Webhook secret",
    secretPlaceholder: "whsec_...",
    secretHelp:
      "Optional HMAC secret used to sign outgoing inquiry delivery payloads.",
  },
];

function getInquiryDeliveryPreset(
  presetId: InquiryDeliveryPresetId,
): InquiryDeliveryPreset {
  return (
    INQUIRY_DELIVERY_PRESETS.find((preset) => preset.id === presetId) ??
    INQUIRY_DELIVERY_PRESETS[0]
  );
}

function normalizeInquiryDeliveryPresetId(
  provider: string | undefined,
  webhookUrl: string,
): InquiryDeliveryPresetId {
  const normalized = (provider || "").trim().toLowerCase().replace(/-/g, "_");

  if (INQUIRY_DELIVERY_PRESETS.some((preset) => preset.id === normalized)) {
    return normalized as InquiryDeliveryPresetId;
  }
  if (normalized === "none") return "email";
  if (normalized === "custom") return "custom_webhook";
  if (normalized === "automation") return "zapier";
  if (normalized === "crm") return "hubspot";
  if (normalized === "pms") return "pms_api";

  const trimmedUrl = webhookUrl.trim();

  if (!trimmedUrl) {
    return "email";
  }

  try {
    const hostname = new URL(trimmedUrl).hostname.toLowerCase();

    if (hostname.includes("zapier")) return "zapier";
    if (hostname.includes("make.com")) return "make";
    if (hostname.includes("n8n")) return "n8n";
    if (hostname.includes("hubspot")) return "hubspot";
    if (hostname.includes("salesforce")) return "salesforce";
    if (hostname.includes("zoho")) return "zoho";
    if (hostname.includes("pipedrive")) return "pipedrive";
    if (hostname.includes("pms")) return "pms_api";
  } catch {
    return "custom_webhook";
  }

  return "custom_webhook";
}

function usesInquiryWebhookSecret(provider: InquiryDeliveryPresetId) {
  return ["custom_webhook", "zapier", "make", "n8n"].includes(provider);
}

function parseIntegrationConfigText(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return {};

  try {
    const parsed = JSON.parse(trimmed);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    throw new Error("Integration config must be valid JSON.");
  }
}

function formatIntegrationConfig(value: Record<string, unknown> | undefined) {
  if (!value || Object.keys(value).length === 0) return "{}";
  return JSON.stringify(value, null, 2);
}

// ─── Main Page ─────────────────────────────────────────────

export default function SettingsPage() {
  type SettingsTab = "site" | "seo" | "localization" | "readiness";

  const [tab, setTab] = useState<SettingsTab>("site");

  const availableTabs: Array<{ id: SettingsTab; label: string }> = [
    { id: "site", label: "Site Settings" },
    { id: "seo", label: "SEO Defaults" },
    { id: "localization", label: "Localization" },
    { id: "readiness", label: "Go-Live Readiness" },
  ];

  const tabClass = (t: string) =>
    `border-b-2 px-5 py-3 text-sm font-medium transition-colors ${
      tab === t
        ? "border-blue-600 text-blue-600"
        : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
    }`;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage the active site without leaving the hospitality workspace.
        </p>
      </div>

      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex gap-1">
          {availableTabs.map((item) => (
            <button
              key={item.id}
              className={tabClass(item.id)}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </div>

      {tab === "site" && <SiteSettingsTab />}
      {tab === "seo" && <SeoDefaultsTab />}
      {tab === "localization" && <LocalizationTab />}
      {tab === "readiness" && <ReadinessTab />}
    </div>
  );
}

function ReadinessTab() {
  const { session } = useAuth();
  const siteId = session?.activeSite?.id ?? null;
  const { data, isLoading, isError } = useQuery({
    queryKey: ["go-live-readiness", siteId],
    queryFn: () => getReadiness(),
    enabled: !!siteId,
    retry: false,
  });

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (isError || !data) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        Could not load readiness checks. Refresh the page or contact support.
      </div>
    );
  }

  const headerTone = readinessTone[data.severity];

  return (
    <div className="space-y-6">
      <div className={`rounded-2xl border p-6 ${headerTone.panel}`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p
              className={`text-xs font-semibold uppercase tracking-[0.2em] ${headerTone.kicker}`}
            >
              Go-live status
            </p>
            <h2 className="mt-2 text-2xl font-bold text-gray-900">
              {data.severity === "ready"
                ? "This site is ready to go live"
                : data.severity === "warning"
                  ? "This site is close, but still has launch warnings"
                  : "This site is blocked from a safe go-live"}
            </h2>
            <p className="mt-2 max-w-3xl text-sm text-gray-600">
              Subscribers can use this checklist to understand whether
              deployment, domain, SEO, and inquiry delivery are safe for
              production without operator-only context.
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${headerTone.badge}`}
          >
            {data.severity.toUpperCase()}
          </span>
        </div>
        <div className="mt-4 flex flex-wrap gap-4 text-xs text-gray-600">
          <span>Checked {formatRelativeTime(data.checkedAt)}</span>
          {data.primaryDomain ? (
            <span>Primary domain: {data.primaryDomain.hostname}</span>
          ) : (
            <span>No primary domain configured</span>
          )}
          {data.liveUrl ? <span>Live URL: {data.liveUrl}</span> : null}
        </div>
      </div>

      <div className="grid gap-4">
        {data.checks.map((check) => {
          const tone = readinessTone[check.severity];

          return (
            <div
              key={check.key}
              className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${tone.badge}`}
                    >
                      {check.severity.toUpperCase()}
                    </span>
                    <h3 className="text-sm font-semibold text-gray-900">
                      {check.label}
                    </h3>
                  </div>
                  <p className="mt-2 text-sm text-gray-600">{check.summary}</p>
                  {check.action ? (
                    <p className="mt-2 text-xs font-medium text-gray-500">
                      Next action: {check.action}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// SITE SETTINGS TAB
// ══════════════════════════════════════════════════════════

function SiteSettingsTab() {
  const { data: settings, isLoading } = useSettings();
  const updateMutation = useUpdateSettings();

  const [general, setGeneral] = useState({
    siteName: "",
    supportEmail: "",
    defaultInquiryRoutingEmail: "",
    inquiryWebhookPresetId: "email" as InquiryDeliveryPresetId,
    inquiryIntegrationConfigText: "{}",
    inquiryIntegrationSecret: "",
    inquiryIntegrationSecretConfigured: false,
    clearInquiryIntegrationSecret: false,
    inquiryWebhookUrl: "",
    inquiryWebhookSecret: "",
    inquiryWebhookSecretConfigured: false,
    clearInquiryWebhookSecret: false,
    logoUrl: "",
    faviconUrl: "",
  });
  const [analytics, setAnalytics] = useState({
    gaTrackingId: "",
    gtmContainerId: "",
    clarityId: "",
    googleSiteVerify: "",
    bingSiteVerify: "",
    yandexSiteVerify: "",
    pinterestSiteVerify: "",
  });
  const [social, setSocial] = useState({
    twitterHandle: "",
    linkedinUrl: "",
    facebookUrl: "",
    instagramUrl: "",
    youtubeUrl: "",
    tiktokUrl: "",
    pinterestUrl: "",
  });
  const [generalDirty, setGeneralDirty] = useState(false);
  const [analyticsDirty, setAnalyticsDirty] = useState(false);
  const [socialDirty, setSocialDirty] = useState(false);

  useEffect(() => {
    if (settings) {
      setGeneral({
        siteName: settings.siteName,
        supportEmail: settings.supportEmail,
        defaultInquiryRoutingEmail: settings.defaultInquiryRoutingEmail,
        inquiryWebhookPresetId: normalizeInquiryDeliveryPresetId(
          settings.inquiryIntegrationProvider,
          settings.inquiryWebhookUrl,
        ),
        inquiryIntegrationConfigText: formatIntegrationConfig(
          settings.inquiryIntegrationConfig,
        ),
        inquiryIntegrationSecret: "",
        inquiryIntegrationSecretConfigured:
          settings.inquiryIntegrationSecretConfigured,
        clearInquiryIntegrationSecret: false,
        inquiryWebhookUrl: settings.inquiryWebhookUrl,
        inquiryWebhookSecret: "",
        inquiryWebhookSecretConfigured: settings.inquiryWebhookSecretConfigured,
        clearInquiryWebhookSecret: false,
        logoUrl: settings.logoUrl,
        faviconUrl: settings.faviconUrl,
      });
      setAnalytics({
        gaTrackingId: settings.gaTrackingId,
        gtmContainerId: settings.gtmContainerId,
        clarityId: settings.clarityId,
        googleSiteVerify: settings.googleSiteVerify,
        bingSiteVerify: settings.bingSiteVerify,
        yandexSiteVerify: settings.yandexSiteVerify,
        pinterestSiteVerify: settings.pinterestSiteVerify,
      });
      setSocial({
        twitterHandle: settings.twitterHandle,
        linkedinUrl: settings.linkedinUrl,
        facebookUrl: settings.facebookUrl,
        instagramUrl: settings.instagramUrl,
        youtubeUrl: settings.youtubeUrl,
        tiktokUrl: settings.tiktokUrl,
        pinterestUrl: settings.pinterestUrl,
      });
    }
  }, [settings]);

  const save = (payload: UpdateSettingsPayload, onDone: () => void) => {
    updateMutation.mutate(payload, {
      onSuccess: () => {
        toast.success("Settings saved");
        onDone();
      },
      onError: () => toast.error("Failed to save settings"),
    });
  };

  const buildGeneralPayload = (): UpdateSettingsPayload => {
    const isEmailOnly = general.inquiryWebhookPresetId === "email";
    const usesWebhookCredential = usesInquiryWebhookSecret(
      general.inquiryWebhookPresetId,
    );

    return {
      siteName: general.siteName,
      supportEmail: general.supportEmail,
      defaultInquiryRoutingEmail: general.defaultInquiryRoutingEmail,
      inquiryIntegrationProvider: general.inquiryWebhookPresetId,
      inquiryIntegrationConfig: parseIntegrationConfigText(
        general.inquiryIntegrationConfigText,
      ),
      inquiryWebhookUrl: isEmailOnly ? "" : general.inquiryWebhookUrl,
      ...(isEmailOnly ||
      !usesWebhookCredential ||
      general.clearInquiryWebhookSecret
        ? { inquiryWebhookSecret: "" }
        : general.inquiryWebhookSecret.trim()
          ? { inquiryWebhookSecret: general.inquiryWebhookSecret.trim() }
          : {}),
      ...(isEmailOnly ||
      usesWebhookCredential ||
      general.clearInquiryIntegrationSecret
        ? { inquiryIntegrationSecret: "" }
        : general.inquiryIntegrationSecret.trim()
          ? {
              inquiryIntegrationSecret: general.inquiryIntegrationSecret.trim(),
            }
          : {}),
      logoUrl: general.logoUrl,
      faviconUrl: general.faviconUrl,
    };
  };

  if (isLoading) return <LoadingSpinner />;

  const selectedUsesWebhookSecret = usesInquiryWebhookSecret(
    general.inquiryWebhookPresetId,
  );
  const selectedSecretValue = selectedUsesWebhookSecret
    ? general.inquiryWebhookSecret
    : general.inquiryIntegrationSecret;
  const selectedSecretConfigured = selectedUsesWebhookSecret
    ? general.inquiryWebhookSecretConfigured
    : general.inquiryIntegrationSecretConfigured;
  const selectedSecretCleared = selectedUsesWebhookSecret
    ? general.clearInquiryWebhookSecret
    : general.clearInquiryIntegrationSecret;

  return (
    <div className="space-y-6">
      {/* General Settings */}
      <SettingsCard
        icon={Globe}
        title="General"
        description="Basic site identity shown across the CMS and published website"
        dirty={generalDirty}
        saving={updateMutation.isPending}
        onSave={() => {
          try {
            save(buildGeneralPayload(), () => {
              setGeneralDirty(false);
              setGeneral((previous) => ({
                ...previous,
                inquiryWebhookSecret: "",
                inquiryIntegrationSecret: "",
                clearInquiryWebhookSecret: false,
                clearInquiryIntegrationSecret: false,
              }));
            });
          } catch (error) {
            toast.error(
              error instanceof Error ? error.message : "Invalid settings",
            );
          }
        }}
        onReset={() => {
          if (settings)
            setGeneral({
              siteName: settings.siteName,
              supportEmail: settings.supportEmail,
              defaultInquiryRoutingEmail: settings.defaultInquiryRoutingEmail,
              inquiryWebhookPresetId: normalizeInquiryDeliveryPresetId(
                settings.inquiryIntegrationProvider,
                settings.inquiryWebhookUrl,
              ),
              inquiryIntegrationConfigText: formatIntegrationConfig(
                settings.inquiryIntegrationConfig,
              ),
              inquiryIntegrationSecret: "",
              inquiryIntegrationSecretConfigured:
                settings.inquiryIntegrationSecretConfigured,
              clearInquiryIntegrationSecret: false,
              inquiryWebhookUrl: settings.inquiryWebhookUrl,
              inquiryWebhookSecret: "",
              inquiryWebhookSecretConfigured:
                settings.inquiryWebhookSecretConfigured,
              clearInquiryWebhookSecret: false,
              logoUrl: settings.logoUrl,
              faviconUrl: settings.faviconUrl,
            });
          setGeneralDirty(false);
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <SettingsField
            label="Site Name"
            id="siteName"
            hint="Displayed in the browser tab and CMS header"
          >
            <input
              id="siteName"
              type="text"
              value={general.siteName}
              onChange={(e) => {
                setGeneral((p) => ({ ...p, siteName: e.target.value }));
                setGeneralDirty(true);
              }}
              className={inputCls}
              placeholder="StayLayer CMS"
            />
          </SettingsField>
          <SettingsField
            label="Support Email"
            id="supportEmail"
            hint="Contact email shown in system notifications"
          >
            <input
              id="supportEmail"
              type="email"
              value={general.supportEmail}
              onChange={(e) => {
                setGeneral((p) => ({ ...p, supportEmail: e.target.value }));
                setGeneralDirty(true);
              }}
              className={inputCls}
              placeholder="support@example.com"
            />
          </SettingsField>
          <SettingsField
            label="Inquiry Routing Email"
            id="defaultInquiryRoutingEmail"
            hint="Primary inbox for hospitality inquiry forwarding"
          >
            <input
              id="defaultInquiryRoutingEmail"
              type="email"
              value={general.defaultInquiryRoutingEmail}
              onChange={(e) => {
                setGeneral((p) => ({
                  ...p,
                  defaultInquiryRoutingEmail: e.target.value,
                }));
                setGeneralDirty(true);
              }}
              className={inputCls}
              placeholder="reservations@example.com"
            />
          </SettingsField>
          <SettingsField
            label="Inquiry integration"
            id="inquiryDeliveryPreset"
            hint="Optional structured delivery for CRM, PMS, or workflow handoffs"
          >
            <div className="space-y-2">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {INQUIRY_DELIVERY_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    id={
                      preset.id === "email"
                        ? "inquiryDeliveryPreset"
                        : undefined
                    }
                    type="button"
                    onClick={() => {
                      const nextUsesWebhookSecret = usesInquiryWebhookSecret(
                        preset.id,
                      );
                      setGeneral((p) => ({
                        ...p,
                        inquiryWebhookPresetId: preset.id,
                        inquiryWebhookUrl:
                          preset.id === "email" ? "" : p.inquiryWebhookUrl,
                        inquiryWebhookSecret:
                          preset.id === "email" || !nextUsesWebhookSecret
                            ? ""
                            : p.inquiryWebhookSecret,
                        inquiryIntegrationSecret:
                          preset.id === "email" || nextUsesWebhookSecret
                            ? ""
                            : p.inquiryIntegrationSecret,
                        clearInquiryWebhookSecret:
                          preset.id === "email" || !nextUsesWebhookSecret,
                        clearInquiryIntegrationSecret:
                          preset.id === "email" || nextUsesWebhookSecret,
                      }));
                      setGeneralDirty(true);
                    }}
                    className={`rounded-2xl border p-4 text-left transition-colors ${
                      general.inquiryWebhookPresetId === preset.id
                        ? "border-blue-300 bg-blue-50"
                        : "border-gray-200 bg-white hover:border-gray-300"
                    }`}
                  >
                    <div className="text-sm font-semibold text-gray-900">
                      {preset.label}
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      {preset.description}
                    </div>
                  </button>
                ))}
              </div>

              {general.inquiryWebhookPresetId === "email" ? (
                <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-500">
                  Site-level inquiry delivery will stay email-only until you
                  pick a named integration.
                </div>
              ) : (
                <div className="space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {
                        getInquiryDeliveryPreset(general.inquiryWebhookPresetId)
                          .label
                      }
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      {
                        getInquiryDeliveryPreset(general.inquiryWebhookPresetId)
                          .description
                      }
                    </p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label
                        htmlFor="inquiryWebhookUrl"
                        className="mb-1.5 block text-sm font-medium text-gray-700"
                      >
                        {
                          getInquiryDeliveryPreset(
                            general.inquiryWebhookPresetId,
                          ).endpointLabel
                        }
                      </label>
                      <input
                        id="inquiryWebhookUrl"
                        type="text"
                        value={general.inquiryWebhookUrl}
                        onChange={(e) => {
                          setGeneral((p) => ({
                            ...p,
                            inquiryWebhookUrl: e.target.value,
                          }));
                          setGeneralDirty(true);
                        }}
                        className={inputCls}
                        placeholder={
                          getInquiryDeliveryPreset(
                            general.inquiryWebhookPresetId,
                          ).endpointPlaceholder
                        }
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        {
                          getInquiryDeliveryPreset(
                            general.inquiryWebhookPresetId,
                          ).endpointHelp
                        }
                      </p>
                    </div>

                    <div className="sm:col-span-2">
                      <label
                        htmlFor="inquiryWebhookSecret"
                        className="mb-1.5 block text-sm font-medium text-gray-700"
                      >
                        {
                          getInquiryDeliveryPreset(
                            general.inquiryWebhookPresetId,
                          ).secretLabel
                        }
                      </label>
                      <input
                        id="inquiryWebhookSecret"
                        type="password"
                        value={selectedSecretValue}
                        onChange={(e) => {
                          setGeneral((p) => ({
                            ...p,
                            ...(selectedUsesWebhookSecret
                              ? {
                                  inquiryWebhookSecret: e.target.value,
                                  clearInquiryWebhookSecret: false,
                                }
                              : {
                                  inquiryIntegrationSecret: e.target.value,
                                  clearInquiryIntegrationSecret: false,
                                }),
                          }));
                          setGeneralDirty(true);
                        }}
                        className={inputCls}
                        placeholder={
                          selectedSecretConfigured && !selectedSecretCleared
                            ? "Stored secret configured"
                            : getInquiryDeliveryPreset(
                                general.inquiryWebhookPresetId,
                              ).secretPlaceholder
                        }
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        {
                          getInquiryDeliveryPreset(
                            general.inquiryWebhookPresetId,
                          ).secretHelp
                        }
                      </p>
                      {selectedSecretConfigured && !selectedSecretCleared && (
                        <button
                          type="button"
                          onClick={() => {
                            setGeneral((p) => ({
                              ...p,
                              ...(selectedUsesWebhookSecret
                                ? {
                                    inquiryWebhookSecret: "",
                                    clearInquiryWebhookSecret: true,
                                  }
                                : {
                                    inquiryIntegrationSecret: "",
                                    clearInquiryIntegrationSecret: true,
                                  }),
                            }));
                            setGeneralDirty(true);
                          }}
                          className="mt-2 text-xs font-medium text-amber-700 hover:text-amber-800"
                        >
                          Clear stored secret on next save
                        </button>
                      )}
                    </div>
                    <div className="sm:col-span-2">
                      <label className="mb-1.5 block text-sm font-medium text-gray-700">
                        Provider config JSON
                      </label>
                      <textarea
                        value={general.inquiryIntegrationConfigText}
                        onChange={(event) => {
                          setGeneral((p) => ({
                            ...p,
                            inquiryIntegrationConfigText: event.target.value,
                          }));
                          setGeneralDirty(true);
                        }}
                        rows={4}
                        className={`${inputCls} font-mono text-xs`}
                        placeholder={'{"leadSource":"StayLayer"}'}
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Optional provider options such as Salesforce apiVersion,
                        HubSpot ticketPipeline, or Zoho leadSource.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {selectedSecretCleared ||
              general.inquiryWebhookPresetId === "email" ? (
                <p className="text-xs text-amber-700">
                  The stored integration secret will be removed when you save.
                </p>
              ) : selectedSecretConfigured ? (
                <p className="text-xs text-gray-500">
                  A secret is already stored. Leave this field blank to keep it.
                </p>
              ) : null}
            </div>
          </SettingsField>
          <SettingsField
            label="Logo URL"
            id="logoUrl"
            hint="Hosted asset URL or compact uploaded image for site branding"
          >
            <AssetPickerField
              value={general.logoUrl}
              onChange={(value) => {
                setGeneral((p) => ({ ...p, logoUrl: value }));
                setGeneralDirty(true);
              }}
              preset="logo"
              placeholder="https://example.com/logo.png"
            />
          </SettingsField>
          <SettingsField
            label="Favicon URL"
            id="faviconUrl"
            hint="Hosted icon URL or compact uploaded icon asset"
          >
            <AssetPickerField
              value={general.faviconUrl}
              onChange={(value) => {
                setGeneral((p) => ({ ...p, faviconUrl: value }));
                setGeneralDirty(true);
              }}
              preset="icon"
              placeholder="https://example.com/favicon.ico"
            />
          </SettingsField>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <SiteAssetPreview
            src={general.logoUrl}
            label="Logo preview"
            failedLabel="Logo preview failed. Use a direct image asset URL."
            imageClassName="h-8 max-w-30 object-contain"
          />
          <SiteAssetPreview
            src={general.faviconUrl}
            label="Favicon preview"
            failedLabel="Favicon preview failed. Use a direct icon or image asset URL."
            imageClassName="h-8 w-8 object-contain"
          />
        </div>
        {settings?.updatedBy && (
          <p className="mt-3 text-xs text-gray-500">
            Settings last updated by {settings.updatedBy} ·{" "}
            {formatRelativeTime(settings.updatedAt)}
          </p>
        )}
      </SettingsCard>

      {/* Analytics */}
      <SettingsCard
        icon={BarChart3}
        title="Analytics & Tracking"
        description="Connect analytics platforms to measure website performance"
        dirty={analyticsDirty}
        saving={updateMutation.isPending}
        onSave={() => save(analytics, () => setAnalyticsDirty(false))}
        onReset={() => {
          if (settings)
            setAnalytics({
              gaTrackingId: settings.gaTrackingId,
              gtmContainerId: settings.gtmContainerId,
              clarityId: settings.clarityId,
              googleSiteVerify: settings.googleSiteVerify,
              bingSiteVerify: settings.bingSiteVerify,
              yandexSiteVerify: settings.yandexSiteVerify,
              pinterestSiteVerify: settings.pinterestSiteVerify,
            });
          setAnalyticsDirty(false);
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <SettingsField
            label="Google Analytics ID"
            id="gaId"
            hint="e.g. G-XXXXXXXXXX or UA-XXXXX-X"
          >
            <input
              id="gaId"
              type="text"
              value={analytics.gaTrackingId}
              onChange={(e) => {
                setAnalytics((p) => ({ ...p, gaTrackingId: e.target.value }));
                setAnalyticsDirty(true);
              }}
              className={inputCls}
              placeholder="G-XXXXXXXXXX"
            />
          </SettingsField>
          <SettingsField
            label="GTM Container ID"
            id="gtmId"
            hint="e.g. GTM-XXXXXXX"
          >
            <input
              id="gtmId"
              type="text"
              value={analytics.gtmContainerId}
              onChange={(e) => {
                setAnalytics((p) => ({ ...p, gtmContainerId: e.target.value }));
                setAnalyticsDirty(true);
              }}
              className={inputCls}
              placeholder="GTM-XXXXXXX"
            />
          </SettingsField>
          <SettingsField
            label="Microsoft Clarity ID"
            id="clarityId"
            hint="Project ID from clarity.microsoft.com"
          >
            <input
              id="clarityId"
              type="text"
              value={analytics.clarityId}
              onChange={(e) => {
                setAnalytics((p) => ({ ...p, clarityId: e.target.value }));
                setAnalyticsDirty(true);
              }}
              className={inputCls}
              placeholder="xxxxxxxxxx"
            />
          </SettingsField>
          <SettingsField
            label="Google Site Verification"
            id="gVerify"
            hint="Meta tag content value from Search Console"
          >
            <input
              id="gVerify"
              type="text"
              value={analytics.googleSiteVerify}
              onChange={(e) => {
                setAnalytics((p) => ({
                  ...p,
                  googleSiteVerify: e.target.value,
                }));
                setAnalyticsDirty(true);
              }}
              className={inputCls}
              placeholder="abc123xyz..."
            />
          </SettingsField>
          <SettingsField
            label="Bing Verification"
            id="bingVerify"
            hint="msvalidate.01 token from Bing Webmaster Tools"
          >
            <input
              id="bingVerify"
              type="text"
              value={analytics.bingSiteVerify}
              onChange={(e) => {
                setAnalytics((p) => ({
                  ...p,
                  bingSiteVerify: e.target.value,
                }));
                setAnalyticsDirty(true);
              }}
              className={inputCls}
              placeholder="Bing verification token"
            />
          </SettingsField>
          <SettingsField
            label="Yandex Verification"
            id="yandexVerify"
            hint="Verification token from Yandex Webmaster"
          >
            <input
              id="yandexVerify"
              type="text"
              value={analytics.yandexSiteVerify}
              onChange={(e) => {
                setAnalytics((p) => ({
                  ...p,
                  yandexSiteVerify: e.target.value,
                }));
                setAnalyticsDirty(true);
              }}
              className={inputCls}
              placeholder="Yandex verification token"
            />
          </SettingsField>
          <SettingsField
            label="Pinterest Verification"
            id="pinterestVerify"
            hint="p:domain_verify token from Pinterest"
          >
            <input
              id="pinterestVerify"
              type="text"
              value={analytics.pinterestSiteVerify}
              onChange={(e) => {
                setAnalytics((p) => ({
                  ...p,
                  pinterestSiteVerify: e.target.value,
                }));
                setAnalyticsDirty(true);
              }}
              className={inputCls}
              placeholder="Pinterest verification token"
            />
          </SettingsField>
        </div>
      </SettingsCard>

      {/* Social */}
      <SettingsCard
        icon={Link}
        title="Social Media"
        description="Social profiles used in Open Graph meta tags and structured data"
        dirty={socialDirty}
        saving={updateMutation.isPending}
        onSave={() => save(social, () => setSocialDirty(false))}
        onReset={() => {
          if (settings)
            setSocial({
              twitterHandle: settings.twitterHandle,
              linkedinUrl: settings.linkedinUrl,
              facebookUrl: settings.facebookUrl,
              instagramUrl: settings.instagramUrl,
              youtubeUrl: settings.youtubeUrl,
              tiktokUrl: settings.tiktokUrl,
              pinterestUrl: settings.pinterestUrl,
            });
          setSocialDirty(false);
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SettingsField
            label="Twitter / X Handle"
            id="twitter"
            hint="Without the @ symbol"
          >
            <div className="flex items-center rounded-lg border border-gray-300 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 bg-white overflow-hidden">
              <span className="border-r border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500">
                @
              </span>
              <input
                id="twitter"
                type="text"
                value={social.twitterHandle}
                onChange={(e) => {
                  setSocial((p) => ({ ...p, twitterHandle: e.target.value }));
                  setSocialDirty(true);
                }}
                className="flex-1 px-3 py-2 text-sm focus:outline-none"
                placeholder="yourhandle"
              />
            </div>
          </SettingsField>
          <SettingsField
            label="LinkedIn URL"
            id="linkedin"
            hint="Full LinkedIn company page URL"
          >
            <input
              id="linkedin"
              type="url"
              value={social.linkedinUrl}
              onChange={(e) => {
                setSocial((p) => ({ ...p, linkedinUrl: e.target.value }));
                setSocialDirty(true);
              }}
              className={inputCls}
              placeholder="https://linkedin.com/company/..."
            />
          </SettingsField>
          <SettingsField
            label="Facebook URL"
            id="facebook"
            hint="Full Facebook page URL"
          >
            <input
              id="facebook"
              type="url"
              value={social.facebookUrl}
              onChange={(e) => {
                setSocial((p) => ({ ...p, facebookUrl: e.target.value }));
                setSocialDirty(true);
              }}
              className={inputCls}
              placeholder="https://facebook.com/..."
            />
          </SettingsField>
          <SettingsField
            label="Instagram URL"
            id="instagram"
            hint="Full Instagram profile URL"
          >
            <input
              id="instagram"
              type="url"
              value={social.instagramUrl}
              onChange={(e) => {
                setSocial((p) => ({ ...p, instagramUrl: e.target.value }));
                setSocialDirty(true);
              }}
              className={inputCls}
              placeholder="https://instagram.com/..."
            />
          </SettingsField>
          <SettingsField
            label="YouTube URL"
            id="youtube"
            hint="Full YouTube channel URL"
          >
            <input
              id="youtube"
              type="url"
              value={social.youtubeUrl}
              onChange={(e) => {
                setSocial((p) => ({ ...p, youtubeUrl: e.target.value }));
                setSocialDirty(true);
              }}
              className={inputCls}
              placeholder="https://youtube.com/@..."
            />
          </SettingsField>
          <SettingsField
            label="TikTok URL"
            id="tiktok"
            hint="Full TikTok profile URL"
          >
            <input
              id="tiktok"
              type="url"
              value={social.tiktokUrl}
              onChange={(e) => {
                setSocial((p) => ({ ...p, tiktokUrl: e.target.value }));
                setSocialDirty(true);
              }}
              className={inputCls}
              placeholder="https://tiktok.com/@..."
            />
          </SettingsField>
          <SettingsField
            label="Pinterest URL"
            id="pinterest"
            hint="Full Pinterest profile URL"
          >
            <input
              id="pinterest"
              type="url"
              value={social.pinterestUrl}
              onChange={(e) => {
                setSocial((p) => ({ ...p, pinterestUrl: e.target.value }));
                setSocialDirty(true);
              }}
              className={inputCls}
              placeholder="https://pinterest.com/..."
            />
          </SettingsField>
        </div>
      </SettingsCard>
    </div>
  );
}

function SiteAssetPreview({
  src,
  label,
  failedLabel,
  imageClassName,
}: {
  src: string;
  label: string;
  failedLabel: string;
  imageClassName: string;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src) {
    return null;
  }

  return (
    <div
      className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${
        failed
          ? "border-amber-200 bg-amber-50 text-amber-800"
          : "border-gray-200 bg-gray-50 text-gray-500"
      }`}
    >
      {failed ? (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-amber-200 bg-white text-[10px] font-semibold uppercase text-amber-700">
          Error
        </div>
      ) : (
        <img
          src={src}
          alt={label}
          className={imageClassName}
          onError={() => setFailed(true)}
        />
      )}
      <span className="text-xs">{failed ? failedLabel : label}</span>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// SEO DEFAULTS TAB
// ══════════════════════════════════════════════════════════

function SeoDefaultsTab() {
  const { data: settings, isLoading } = useSettings();
  const updateMutation = useUpdateSettings();

  const [form, setForm] = useState({
    seoTitleTemplate: "",
    seoDefaultDesc: "",
    seoOgImage: "",
    seoIndexingEnabled: true,
    seoLocaleDefaults: normalizeSeoLocaleDefaults(),
  });
  const [dirty, setDirty] = useState(false);
  const [previewTitle, setPreviewTitle] = useState("Example Page Title");

  useEffect(() => {
    if (settings) {
      setForm({
        seoTitleTemplate: settings.seoTitleTemplate,
        seoDefaultDesc: settings.seoDefaultDesc,
        seoOgImage: settings.seoOgImage,
        seoIndexingEnabled: settings.seoIndexingEnabled,
        seoLocaleDefaults: normalizeSeoLocaleDefaults(
          settings.seoLocaleDefaults,
        ),
      });
    }
  }, [settings]);

  const serp = form.seoTitleTemplate.replace("%s", previewTitle);
  const descLen = form.seoDefaultDesc.length;
  const activeSeoLocales = settings?.activeLocales?.length
    ? settings.activeLocales
    : [...LOCALES];
  const updateLocaleDefault = (
    locale: string,
    patch: Partial<SeoLocaleDefault>,
  ) => {
    setForm((previous) => ({
      ...previous,
      seoLocaleDefaults: {
        ...previous.seoLocaleDefaults,
        [locale]: {
          ...(previous.seoLocaleDefaults[locale] ?? {
            titleTemplate: "",
            description: "",
            ogImage: "",
          }),
          ...patch,
        },
      },
    }));
    setDirty(true);
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      {/* SERP Preview */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-gray-100 bg-gray-50 px-5 py-3.5 flex items-center gap-2">
          <Eye className="h-4 w-4 text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-800">
            Search Result Preview
          </h2>
          <span className="ml-auto text-xs text-gray-400">Live preview</span>
        </div>
        <div className="p-5">
          <div className="mb-4 flex items-center gap-3">
            <label className="text-xs font-medium text-gray-600 shrink-0">
              Preview page title:
            </label>
            <input
              type="text"
              value={previewTitle}
              onChange={(e) => setPreviewTitle(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 w-48"
            />
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5 max-w-xl">
            <div className="mb-1 flex items-center gap-2">
              <div className="h-5 w-5 rounded-full bg-gray-200" />
              <p className="text-xs text-gray-700">example.com</p>
              <ChevronRight className="h-3 w-3 text-gray-400" />
              <p className="text-xs text-gray-500">Home</p>
            </div>
            <p className="text-lg font-medium text-blue-700 hover:underline cursor-pointer line-clamp-1">
              {serp || "Page title will appear here"}
            </p>
            <p className="mt-1 text-sm text-gray-600 line-clamp-2 leading-relaxed">
              {form.seoDefaultDesc ||
                "Your default meta description will appear here as the page snippet in search results"}
            </p>
          </div>
          {serp.length > 60 && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-600">
              <AlertCircle className="h-3.5 w-3.5" />
              Title is {serp.length} characters — Google typically truncates at
              60
            </p>
          )}
        </div>
      </div>

      {/* Form */}
      <SettingsCard
        icon={Tags}
        title="SEO Defaults"
        description="Default values applied to pages that do not have custom SEO settings"
        dirty={dirty}
        saving={updateMutation.isPending}
        onSave={() => {
          updateMutation.mutate(form, {
            onSuccess: () => {
              toast.success("SEO settings saved");
              setDirty(false);
            },
            onError: () => toast.error("Failed to save SEO settings"),
          });
        }}
        onReset={() => {
          if (settings) {
            setForm({
              seoTitleTemplate: settings.seoTitleTemplate,
              seoDefaultDesc: settings.seoDefaultDesc,
              seoOgImage: settings.seoOgImage,
              seoIndexingEnabled: settings.seoIndexingEnabled,
              seoLocaleDefaults: normalizeSeoLocaleDefaults(
                settings.seoLocaleDefaults,
              ),
            });
          }
          setDirty(false);
        }}
      >
        <div className="space-y-4">
          <SettingsField
            label="Title Template"
            id="titleTpl"
            hint='Use %s as a placeholder for the page title. e.g. "%s | My Brand"'
          >
            <input
              id="titleTpl"
              type="text"
              value={form.seoTitleTemplate}
              onChange={(e) => {
                setForm((p) => ({ ...p, seoTitleTemplate: e.target.value }));
                setDirty(true);
              }}
              className={inputCls}
              placeholder="%s | StayLayer"
            />
          </SettingsField>

          <SettingsField
            label="Default Meta Description"
            id="seoDesc"
            hint={`${descLen}/160 characters · Used when a page has no custom description`}
            hintColor={
              descLen > 160
                ? "text-red-500"
                : descLen > 140
                  ? "text-amber-500"
                  : "text-gray-400"
            }
          >
            <textarea
              id="seoDesc"
              rows={3}
              value={form.seoDefaultDesc}
              onChange={(e) => {
                setForm((p) => ({ ...p, seoDefaultDesc: e.target.value }));
                setDirty(true);
              }}
              className={`${inputCls} resize-none`}
              placeholder="A concise description of your website for search engines…"
            />
          </SettingsField>

          <SettingsField
            label="Default OG Image URL"
            id="ogImage"
            hint="Recommended size: 1200×630px, used when no page-specific OG image is set"
          >
            <AssetPickerField
              value={form.seoOgImage}
              onChange={(value) => {
                setForm((p) => ({ ...p, seoOgImage: value }));
                setDirty(true);
              }}
              preset="content"
              placeholder="https://example.com/og-default.jpg"
            />
          </SettingsField>

          {form.seoOgImage && (
            <div className="flex items-start gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3">
              <Image className="mt-0.5 h-4 w-4 text-gray-400 shrink-0" />
              <div>
                <p className="text-xs font-medium text-gray-600 mb-1.5">
                  OG Image preview
                </p>
                <img
                  src={form.seoOgImage}
                  alt="OG preview"
                  className="max-h-32 max-w-xs rounded-lg border border-gray-200 object-contain"
                  onError={(e) =>
                    ((e.target as HTMLImageElement).style.display = "none")
                  }
                />
              </div>
            </div>
          )}

          {/* Social card preview */}
          {form.seoOgImage && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-400">
                Social card preview
              </p>
              <div className="overflow-hidden rounded-xl border border-gray-200 bg-white max-w-sm shadow-sm">
                <img
                  src={form.seoOgImage}
                  alt="Social OG card preview"
                  className="aspect-1200/630 w-full object-cover"
                  onError={(e) =>
                    ((e.target as HTMLImageElement).style.display = "none")
                  }
                />
                <div className="border-t border-gray-100 bg-gray-50 px-3 py-2">
                  <p className="text-xs font-medium text-gray-900 line-clamp-1">
                    {form.seoTitleTemplate.replace("%s", previewTitle) ||
                      previewTitle}
                  </p>
                  <p className="text-[11px] text-gray-500 line-clamp-2">
                    {form.seoDefaultDesc}
                  </p>
                  <p className="mt-0.5 text-[10px] uppercase text-gray-400">
                    yourdomain.com
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  Locale-specific defaults
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Override the global title template, description, or OG image
                  for multilingual search snippets.
                </p>
              </div>
              <Languages className="h-4 w-4 text-gray-400" />
            </div>
            <div className="space-y-4">
              {activeSeoLocales.map((locale) => {
                const meta = LOCALE_META[locale];
                const localeDefaults = form.seoLocaleDefaults[locale] ?? {
                  titleTemplate: "",
                  description: "",
                  ogImage: "",
                };
                const localeDescLen = localeDefaults.description.length;

                return (
                  <div
                    key={locale}
                    className="rounded-lg border border-gray-200 bg-white p-4"
                  >
                    <div className="mb-3 flex items-center gap-2">
                      <span className="text-lg">{meta?.flag}</span>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          {meta?.label ?? locale.toUpperCase()}
                        </p>
                        <p className="text-xs text-gray-400">
                          Leave blank to inherit global defaults
                        </p>
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <SettingsField
                        label="Title Template"
                        id={`seoLocaleTitle-${locale}`}
                        hint="Use %s as the page title placeholder"
                      >
                        <input
                          id={`seoLocaleTitle-${locale}`}
                          type="text"
                          value={localeDefaults.titleTemplate}
                          onChange={(e) =>
                            updateLocaleDefault(locale, {
                              titleTemplate: e.target.value,
                            })
                          }
                          className={inputCls}
                          placeholder={form.seoTitleTemplate || "%s | Brand"}
                        />
                      </SettingsField>
                      <SettingsField
                        label="OG Image URL"
                        id={`seoLocaleOg-${locale}`}
                        hint="Optional locale-specific social sharing image"
                      >
                        <input
                          id={`seoLocaleOg-${locale}`}
                          type="url"
                          value={localeDefaults.ogImage}
                          onChange={(e) =>
                            updateLocaleDefault(locale, {
                              ogImage: e.target.value,
                            })
                          }
                          className={inputCls}
                          placeholder={form.seoOgImage || "https://..."}
                        />
                      </SettingsField>
                      <SettingsField
                        label="Meta Description"
                        id={`seoLocaleDesc-${locale}`}
                        hint={`${localeDescLen}/160 characters`}
                        hintColor={
                          localeDescLen > 160
                            ? "text-red-500"
                            : localeDescLen > 140
                              ? "text-amber-500"
                              : "text-gray-400"
                        }
                      >
                        <textarea
                          id={`seoLocaleDesc-${locale}`}
                          rows={2}
                          value={localeDefaults.description}
                          onChange={(e) =>
                            updateLocaleDefault(locale, {
                              description: e.target.value,
                            })
                          }
                          className={`${inputCls} resize-none`}
                          placeholder={
                            form.seoDefaultDesc ||
                            "Localized default meta description"
                          }
                        />
                      </SettingsField>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-gray-800">
                Allow Search Indexing
              </p>
              <p className="text-xs text-gray-500">
                Controls the robots meta tag across all pages (noindex when
                disabled)
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setForm((p) => ({
                  ...p,
                  seoIndexingEnabled: !p.seoIndexingEnabled,
                }));
                setDirty(true);
              }}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.seoIndexingEnabled ? "bg-blue-600" : "bg-gray-300"}`}
            >
              <span
                className={`inline-block h-4 w-4 translate-x-1 transform rounded-full bg-white shadow transition-transform ${form.seoIndexingEnabled ? "translate-x-6" : ""}`}
              />
            </button>
          </div>
          <div className="flex items-center gap-2 text-xs">
            {form.seoIndexingEnabled ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                <span className="text-emerald-600">
                  Search engines can index your pages
                </span>
              </>
            ) : (
              <>
                <EyeOff className="h-3.5 w-3.5 text-red-500" />
                <span className="text-red-500">
                  Search engines are blocked from indexing (noindex)
                </span>
              </>
            )}
          </div>
        </div>
      </SettingsCard>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// LOCALIZATION TAB
// ══════════════════════════════════════════════════════════

function LocalizationTab() {
  const { data: settings, isLoading: settingsLoading } = useSettings();
  const updateMutation = useUpdateSettings();

  const [activeLocales, setActiveLocales] = useState<string[]>([]);
  const [defaultLocale, setDefaultLocale] = useState("en");
  const [dirty, setDirty] = useState(false);

  // Load page counts per locale
  const localeStats = useQuery({
    queryKey: ["pages-locale-stats"],
    queryFn: async () => {
      const results = await Promise.all(
        LOCALES.map(async (locale) => {
          const [allRes, publishedRes] = await Promise.all([
            getPages({ locale, limit: 1 }),
            getPages({ locale, published: true, limit: 1 }),
          ]);
          return {
            locale,
            total: allRes.total,
            published: publishedRes.total,
          };
        }),
      );
      return results;
    },
    staleTime: 60_000,
  });

  useEffect(() => {
    if (settings) {
      setActiveLocales(settings.activeLocales);
      setDefaultLocale(settings.defaultLocale);
    }
  }, [settings]);

  const toggleLocale = (locale: string) => {
    if (locale === defaultLocale) {
      toast.error("Cannot disable the default locale");
      return;
    }
    setActiveLocales((prev) =>
      prev.includes(locale)
        ? prev.filter((l) => l !== locale)
        : [...prev, locale],
    );
    setDirty(true);
  };

  const handleDefaultChange = (locale: string) => {
    if (!activeLocales.includes(locale)) {
      setActiveLocales((prev) => [...prev, locale]);
    }
    setDefaultLocale(locale);
    setDirty(true);
  };

  const runSave = (payload: {
    activeLocales: string[];
    defaultLocale: string;
  }) => {
    updateMutation.mutate(payload, {
      onSuccess: () => {
        toast.success("Localization settings saved");
        setDirty(false);
      },
      onError: () => toast.error("Failed to save localization settings"),
    });
  };

  const save = () => {
    runSave({ activeLocales, defaultLocale });
  };

  if (settingsLoading) return <LoadingSpinner />;

  const totalStats = localeStats.data?.reduce(
    (acc, s) => ({
      total: acc.total + s.total,
      published: acc.published + s.published,
    }),
    { total: 0, published: 0 },
  );

  return (
    <div className="space-y-6">
      {/* Overview stats */}
      {localeStats.data && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            {
              label: "Total Pages",
              value: totalStats?.total ?? 0,
              icon: FileText,
              color: "text-gray-900 bg-gray-50 border-gray-200",
            },
            {
              label: "Published",
              value: totalStats?.published ?? 0,
              icon: TrendingUp,
              color: "text-emerald-700 bg-emerald-50 border-emerald-200",
            },
            {
              label: "Active Locales",
              value: activeLocales.length,
              icon: Languages,
              color: "text-blue-700 bg-blue-50 border-blue-200",
            },
            {
              label: "Total Locales",
              value: LOCALES.length,
              icon: Globe,
              color: "text-purple-700 bg-purple-50 border-purple-200",
            },
          ].map(({ label, value, icon: Icon, color }) => (
            <div
              key={label}
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${color}`}
            >
              <Icon className="h-5 w-5 shrink-0 opacity-70" />
              <div>
                <p className="text-2xl font-bold leading-none">{value}</p>
                <p className="mt-0.5 text-xs font-medium opacity-70">{label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Default locale */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-gray-100 bg-gray-50 px-5 py-3.5 flex items-center gap-2">
          <Globe className="h-4 w-4 text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-800">
            Primary / Canonical Locale
          </h2>
        </div>
        <div className="p-5">
          <p className="mb-3 text-sm text-gray-600">
            This locale owns the root / URL and is used for canonical URLs and
            fallbacks when no locale-specific content exists.
          </p>
          <div className="flex flex-wrap gap-2">
            {LOCALES.map((locale) => {
              const meta = LOCALE_META[locale];
              const isDefault = defaultLocale === locale;
              return (
                <button
                  key={locale}
                  onClick={() => handleDefaultChange(locale)}
                  className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-all ${
                    isDefault
                      ? "border-blue-500 bg-blue-600 text-white shadow-sm"
                      : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  <span className="text-lg">{meta?.flag}</span>
                  <span>{meta?.label}</span>
                  {isDefault && <CheckCircle2 className="h-3.5 w-3.5 ml-0.5" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Locale cards */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-gray-100 bg-gray-50 px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Languages className="h-4 w-4 text-gray-500" />
            <h2 className="text-sm font-semibold text-gray-800">
              Language Configuration
            </h2>
          </div>
          <span className="text-xs text-gray-400">
            {activeLocales.length} of {LOCALES.length} active
          </span>
        </div>
        <div className="divide-y divide-gray-50">
          {LOCALES.map((locale) => {
            const meta = LOCALE_META[locale];
            const isActive = activeLocales.includes(locale);
            const isDefault = defaultLocale === locale;
            const stats = localeStats.data?.find((s) => s.locale === locale);

            return (
              <div
                key={locale}
                className={`flex items-center gap-4 px-5 py-4 transition-colors ${isActive ? "" : "opacity-50"}`}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xl">
                  {meta?.flag}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900">{meta?.label}</p>
                    <span className="text-xs text-gray-400">
                      ({meta?.nativeName})
                    </span>
                    {isDefault && (
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                        Default
                      </span>
                    )}
                    {!isActive && (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                        Disabled
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
                    <span>
                      <span className="font-semibold text-gray-700">
                        {stats?.total ?? "—"}
                      </span>{" "}
                      pages
                    </span>
                    <span className="h-1 w-1 rounded-full bg-gray-300" />
                    <span className="text-emerald-600">
                      <span className="font-semibold">
                        {stats?.published ?? "—"}
                      </span>{" "}
                      published
                    </span>
                    <span className="h-1 w-1 rounded-full bg-gray-300" />
                    <span>
                      <span className="font-semibold text-gray-700">
                        {stats && stats.total > 0
                          ? `${Math.round((stats.published / stats.total) * 100)}%`
                          : "—"}
                      </span>{" "}
                      publish rate
                    </span>
                  </div>
                  {stats && stats.total > 0 && (
                    <div className="mt-2 h-1.5 w-48 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all"
                        style={{
                          width: `${Math.round((stats.published / stats.total) * 100)}%`,
                        }}
                      />
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => toggleLocale(locale)}
                  disabled={isDefault}
                  title={
                    isDefault
                      ? "Cannot disable the default locale"
                      : isActive
                        ? "Disable this locale"
                        : "Enable this locale"
                  }
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed ${
                    isActive ? "bg-blue-600" : "bg-gray-300"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 translate-x-1 transform rounded-full bg-white shadow transition-transform ${isActive ? "translate-x-6" : ""}`}
                  />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Save bar */}
      {dirty && (
        <div className="sticky bottom-4 z-10 flex items-center justify-between gap-4 rounded-xl border border-blue-200 bg-blue-50 px-5 py-3.5 shadow-lg">
          <div className="flex items-center gap-2 text-sm text-blue-700">
            <AlertCircle className="h-4 w-4" />
            You have unsaved localization changes
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (settings) {
                  setActiveLocales(settings.activeLocales);
                  setDefaultLocale(settings.defaultLocale);
                }
                setDirty(false);
              }}
              className="rounded-lg border border-blue-300 bg-white px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 transition-colors"
            >
              Discard
            </button>
            <button
              onClick={save}
              disabled={updateMutation.isPending}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {updateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save Changes
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// SHARED UI HELPERS
// ══════════════════════════════════════════════════════════

const inputCls =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-shadow";

function AssetPickerField({
  value,
  onChange,
  placeholder,
  preset = "content",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  preset?: ImageAssetPreset;
}) {
  return (
    <ImageAssetField
      value={value}
      onChange={onChange}
      preset={preset}
      placeholder={placeholder}
      uploadLabel="Upload"
      removeLabel="Clear"
      rootClassName="border-none bg-transparent p-0"
      inputClassName={inputCls}
      previewWrapperClassName="min-h-24"
      previewAlt="Site asset preview"
    />
  );
}

function SettingsField({
  label,
  id,
  hint,
  hintColor = "text-gray-400",
  children,
}: {
  label: string;
  id: string;
  hint?: string;
  hintColor?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-sm font-medium text-gray-700"
      >
        {label}
      </label>
      {children}
      {hint && <p className={`mt-1 text-xs ${hintColor}`}>{hint}</p>}
    </div>
  );
}

function SettingsCard({
  icon: Icon,
  title,
  description,
  dirty,
  saving,
  onSave,
  onReset,
  children,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  onReset: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-xl border bg-white shadow-sm overflow-hidden transition-all ${dirty ? "border-blue-300 ring-1 ring-blue-200" : "border-gray-200"}`}
    >
      <div className="border-b border-gray-100 bg-gray-50 px-5 py-3.5 flex items-center gap-2">
        <Icon className="h-4 w-4 text-gray-500" />
        <div>
          <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
          <p className="text-xs text-gray-400">{description}</p>
        </div>
        {dirty && (
          <span className="ml-auto flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
            <AlertCircle className="h-3 w-3" />
            Unsaved
          </span>
        )}
      </div>
      <div className="p-5">{children}</div>
      <div className="border-t border-gray-100 bg-gray-50/50 px-5 py-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={onReset}
          disabled={!dirty}
          className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={!dirty || saving}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40 transition-colors"
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          Save
        </button>
      </div>
    </div>
  );
}
