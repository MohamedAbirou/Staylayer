import { useRef, useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useUsers } from "../hooks/useUsers";
import { useSettings, useUpdateSettings } from "../hooks/useSettings";
import { createUser, updateUser, deleteUser } from "../api/users";
import { getPages } from "../api/pages";
import { getReadiness } from "../api/settings";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { formatDate, formatRelativeTime } from "../lib/formatDate";
import { LOCALES } from "../lib/constants";
import {
  PLATFORM_ROLES,
  type AuthUser,
  type PlatformRole,
} from "../auth/types";
import { describePlatformRole } from "../auth/access";
import type { UpdateSettingsPayload } from "../api/settings";
import { useAuth } from "../auth/useAuth";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Loader2,
  UserPlus,
  Search,
  Users,
  ShieldCheck,
  UserCog,
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

interface UserFormData {
  email: string;
  password: string;
  platformRole: PlatformRole;
}

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

type InquiryDeliveryPresetId = "none" | "automation" | "crm" | "pms" | "custom";

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
    id: "none",
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
    id: "automation",
    label: "Automation workflow",
    description:
      "Send inquiries into Zapier, Make, n8n, or another workflow tool.",
    endpointLabel: "Workflow endpoint",
    endpointPlaceholder: "https://hooks.zapier.com/hooks/catch/...",
    endpointHelp: "Paste the catch-hook URL from your automation platform.",
    secretLabel: "Verification token",
    secretPlaceholder: "Optional token or shared secret",
    secretHelp:
      "Optional. Use this when your workflow expects a token outside the URL.",
  },
  {
    id: "crm",
    label: "CRM handoff",
    description:
      "Forward structured inquiries into HubSpot, Salesforce, or another pipeline.",
    endpointLabel: "CRM intake endpoint",
    endpointPlaceholder: "https://crm.example.com/api/inquiries",
    endpointHelp:
      "Paste the CRM workflow or middleware endpoint for new inquiries.",
    secretLabel: "CRM signing secret",
    secretPlaceholder: "Optional HMAC or shared secret",
    secretHelp:
      "Use this when your CRM bridge validates signed inquiry traffic.",
  },
  {
    id: "pms",
    label: "PMS / reservations",
    description:
      "Route inquiries into a PMS, reservations desk workflow, or hospitality ops service.",
    endpointLabel: "Reservations endpoint",
    endpointPlaceholder: "https://ops.example.com/pms/inquiries",
    endpointHelp:
      "Paste the endpoint that should receive reservation-ready inquiry data.",
    secretLabel: "Shared signing secret",
    secretPlaceholder: "Optional shared secret",
    secretHelp:
      "Add a secret if the PMS or middleware verifies signed requests.",
  },
  {
    id: "custom",
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

function inferInquiryDeliveryPresetId(
  webhookUrl: string,
): InquiryDeliveryPresetId {
  const trimmedUrl = webhookUrl.trim();

  if (!trimmedUrl) {
    return "none";
  }

  try {
    const hostname = new URL(trimmedUrl).hostname.toLowerCase();

    if (
      hostname.includes("zapier") ||
      hostname.includes("make.com") ||
      hostname.includes("n8n") ||
      hostname.includes("pipedream") ||
      hostname.includes("workato")
    ) {
      return "automation";
    }

    if (
      hostname.includes("hubspot") ||
      hostname.includes("salesforce") ||
      hostname.includes("zoho") ||
      hostname.includes("pipedrive") ||
      hostname.includes("crm")
    ) {
      return "crm";
    }

    if (
      hostname.includes("cloudbeds") ||
      hostname.includes("guesty") ||
      hostname.includes("mews") ||
      hostname.includes("apaleo") ||
      hostname.includes("opera") ||
      hostname.includes("siteminder") ||
      hostname.includes("pms")
    ) {
      return "pms";
    }
  } catch {
    return "custom";
  }

  return "custom";
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
// USERS TAB
// ══════════════════════════════════════════════════════════

export function UsersTab({ currentUser }: { currentUser: AuthUser | null }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useUsers();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<UserFormData>({
    email: "",
    password: "",
    platformRole: "SUPPORT_ADMIN",
  });
  const [formError, setFormError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    email: string;
  } | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<PlatformRole | "ALL">("ALL");

  const createMutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      toast.success("User created successfully");
      queryClient.invalidateQueries({ queryKey: ["users"] });
      resetForm();
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Failed to create user";
      setFormError(message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      ...payload
    }: {
      id: string;
      email?: string;
      password?: string;
      platformRole?: PlatformRole;
    }) => updateUser(id, payload),
    onSuccess: () => {
      toast.success("User updated successfully");
      queryClient.invalidateQueries({ queryKey: ["users"] });
      resetForm();
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Failed to update user";
      setFormError(message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteUser,
    onSuccess: () => {
      toast.success("User deleted");
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setDeleteTarget(null);
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Failed to delete user";
      toast.error(message);
    },
  });

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData({ email: "", password: "", platformRole: "SUPPORT_ADMIN" });
    setFormError("");
  };

  const handleEdit = (user: {
    id: string;
    email: string;
    platformRole: PlatformRole | null;
  }) => {
    setEditingId(user.id);
    setFormData({
      email: user.email,
      password: "",
      platformRole: user.platformRole ?? "SUPPORT_ADMIN",
    });
    setShowForm(true);
    setFormError("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (editingId) {
      const payload: {
        id: string;
        email?: string;
        password?: string;
        platformRole?: PlatformRole;
      } = {
        id: editingId,
        email: formData.email,
        platformRole: formData.platformRole,
      };
      if (formData.password) payload.password = formData.password;
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(formData);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  const allUsers = data?.data ?? [];

  const filtered = allUsers.filter((u) => {
    const matchesSearch =
      !search || u.email.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === "ALL" || u.platformRole === roleFilter;
    return matchesSearch && matchesRole;
  });

  const stats = {
    total: allUsers.length,
    platformOwners: allUsers.filter((u) => u.platformRole === "PLATFORM_OWNER")
      .length,
    supportAdmins: allUsers.filter((u) => u.platformRole === "SUPPORT_ADMIN")
      .length,
    financeAdmins: allUsers.filter((u) => u.platformRole === "FINANCE_ADMIN")
      .length,
  };

  const roleBadge = (role: PlatformRole | null) => {
    if (!role) {
      return (
        <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
          No platform role
        </span>
      );
    }

    const map: Record<PlatformRole, string> = {
      PLATFORM_OWNER: "bg-purple-100 text-purple-800 border border-purple-200",
      SUPPORT_ADMIN: "bg-blue-100 text-blue-800 border border-blue-200",
      FINANCE_ADMIN:
        "bg-emerald-100 text-emerald-800 border border-emerald-200",
    };
    return (
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${map[role]}`}
      >
        {describePlatformRole(role)}
      </span>
    );
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            label: "Total Users",
            value: stats.total,
            icon: Users,
            color: "text-gray-900 bg-gray-50 border-gray-200",
          },
          {
            label: "Platform Owners",
            value: stats.platformOwners,
            icon: ShieldCheck,
            color: "text-purple-700 bg-purple-50 border-purple-200",
          },
          {
            label: "Support Admins",
            value: stats.supportAdmins,
            icon: UserCog,
            color: "text-blue-700 bg-blue-50 border-blue-200",
          },
          {
            label: "Finance Admins",
            value: stats.financeAdmins,
            icon: Pencil,
            color: "text-emerald-700 bg-emerald-50 border-emerald-200",
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

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search users…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-56 rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) =>
              setRoleFilter(e.target.value as PlatformRole | "ALL")
            }
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="ALL">All Roles</option>
            <option value="PLATFORM_OWNER">Platform owner</option>
            <option value="SUPPORT_ADMIN">Support admin</option>
            <option value="FINANCE_ADMIN">Finance admin</option>
          </select>
        </div>
        {!showForm && (
          <button
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add User
          </button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-blue-600" />
              <h2 className="text-base font-semibold text-gray-900">
                {editingId ? "Edit User" : "New User"}
              </h2>
            </div>
            <button
              onClick={resetForm}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            {formError && (
              <div className="mb-4 flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700 border border-red-200">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                {formError}
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label
                  htmlFor="user-email"
                  className="mb-1.5 block text-sm font-medium text-gray-700"
                >
                  Email
                </label>
                <input
                  id="user-email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, email: e.target.value }))
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label
                  htmlFor="user-password"
                  className="mb-1.5 block text-sm font-medium text-gray-700"
                >
                  Password
                  {editingId && (
                    <span className="ml-1 text-gray-400 font-normal">
                      (leave blank to keep)
                    </span>
                  )}
                </label>
                <input
                  id="user-password"
                  type="password"
                  required={!editingId}
                  minLength={8}
                  value={formData.password}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, password: e.target.value }))
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label
                  htmlFor="user-role"
                  className="mb-1.5 block text-sm font-medium text-gray-700"
                >
                  Role
                </label>
                <select
                  id="user-role"
                  value={formData.platformRole}
                  onChange={(e) =>
                    setFormData((f) => ({
                      ...f,
                      platformRole: e.target.value as PlatformRole,
                    }))
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {PLATFORM_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {describePlatformRole(role)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <UserPlus className="h-4 w-4" />
                )}
                {editingId ? "Update User" : "Create User"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 bg-gray-50 px-4 py-2.5">
          <p className="text-xs font-medium text-gray-500">
            Showing{" "}
            <span className="font-semibold text-gray-700">
              {filtered.length}
            </span>{" "}
            of{" "}
            <span className="font-semibold text-gray-700">
              {allUsers.length}
            </span>{" "}
            users
          </p>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-100">
            <tr>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                User
              </th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Role
              </th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Created
              </th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Last Modified
              </th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-12 text-center text-sm text-gray-400"
                >
                  No users match your search
                </td>
              </tr>
            ) : (
              filtered.map((u) => (
                <tr
                  key={u.id}
                  className="group hover:bg-gray-50/70 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-blue-500 to-indigo-600 text-xs font-semibold text-white uppercase">
                        {u.email[0]}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{u.email}</p>
                        {u.id === currentUser?.id && (
                          <p className="text-xs text-blue-500 font-medium">
                            You
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">{roleBadge(u.platformRole)}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    <span title={formatDate(u.createdAt)}>
                      {formatRelativeTime(u.createdAt)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {u.updatedAt ? (
                      <span title={formatDate(u.updatedAt)}>
                        {formatRelativeTime(u.updatedAt)}
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() =>
                          handleEdit({
                            id: u.id,
                            email: u.email,
                            platformRole: u.platformRole,
                          })
                        }
                        className="rounded-lg p-1.5 text-gray-500 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                        title="Edit user"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      {u.id !== currentUser?.id && (
                        <button
                          onClick={() =>
                            setDeleteTarget({ id: u.id, email: u.email })
                          }
                          className="rounded-lg p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                          title="Delete user"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {data && data.total > (data.limit ?? 20) && (
          <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 text-xs text-gray-500 text-right">
            Page {data.page} — {data.total} total users
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete User"
        message={`Are you sure you want to delete "${deleteTarget?.email}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
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
    inquiryWebhookPresetId: "none" as InquiryDeliveryPresetId,
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
        inquiryWebhookPresetId: inferInquiryDeliveryPresetId(
          settings.inquiryWebhookUrl,
        ),
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

  const buildGeneralPayload = (): UpdateSettingsPayload => ({
    ...(general.inquiryWebhookPresetId === "none"
      ? { inquiryWebhookUrl: "", inquiryWebhookSecret: "" }
      : { inquiryWebhookUrl: general.inquiryWebhookUrl }),
    siteName: general.siteName,
    supportEmail: general.supportEmail,
    defaultInquiryRoutingEmail: general.defaultInquiryRoutingEmail,
    ...(general.inquiryWebhookPresetId === "none" ||
    general.clearInquiryWebhookSecret
      ? { inquiryWebhookSecret: "" }
      : general.inquiryWebhookSecret.trim()
        ? { inquiryWebhookSecret: general.inquiryWebhookSecret.trim() }
        : {}),
    logoUrl: general.logoUrl,
    faviconUrl: general.faviconUrl,
  });

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      {/* General Settings */}
      <SettingsCard
        icon={Globe}
        title="General"
        description="Basic site identity shown across the CMS and published website"
        dirty={generalDirty}
        saving={updateMutation.isPending}
        onSave={() =>
          save(buildGeneralPayload(), () => {
            setGeneralDirty(false);
            setGeneral((previous) => ({
              ...previous,
              inquiryWebhookSecret: "",
              clearInquiryWebhookSecret: false,
            }));
          })
        }
        onReset={() => {
          if (settings)
            setGeneral({
              siteName: settings.siteName,
              supportEmail: settings.supportEmail,
              defaultInquiryRoutingEmail: settings.defaultInquiryRoutingEmail,
              inquiryWebhookPresetId: inferInquiryDeliveryPresetId(
                settings.inquiryWebhookUrl,
              ),
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
                      preset.id === "none" ? "inquiryDeliveryPreset" : undefined
                    }
                    type="button"
                    onClick={() => {
                      setGeneral((p) => ({
                        ...p,
                        inquiryWebhookPresetId: preset.id,
                        inquiryWebhookUrl:
                          preset.id === "none" ? "" : p.inquiryWebhookUrl,
                        inquiryWebhookSecret:
                          preset.id === "none" ? "" : p.inquiryWebhookSecret,
                        clearInquiryWebhookSecret: preset.id === "none",
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

              {general.inquiryWebhookPresetId === "none" ? (
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
                        type="url"
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
                        value={general.inquiryWebhookSecret}
                        onChange={(e) => {
                          setGeneral((p) => ({
                            ...p,
                            inquiryWebhookSecret: e.target.value,
                            clearInquiryWebhookSecret: false,
                          }));
                          setGeneralDirty(true);
                        }}
                        className={inputCls}
                        placeholder={
                          general.inquiryWebhookSecretConfigured &&
                          !general.clearInquiryWebhookSecret
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
                      {general.inquiryWebhookSecretConfigured &&
                        !general.clearInquiryWebhookSecret && (
                          <button
                            type="button"
                            onClick={() => {
                              setGeneral((p) => ({
                                ...p,
                                inquiryWebhookSecret: "",
                                clearInquiryWebhookSecret: true,
                              }));
                              setGeneralDirty(true);
                            }}
                            className="mt-2 text-xs font-medium text-amber-700 hover:text-amber-800"
                          >
                            Clear stored secret on next save
                          </button>
                        )}
                    </div>
                  </div>
                </div>
              )}

              {general.clearInquiryWebhookSecret ||
              general.inquiryWebhookPresetId === "none" ? (
                <p className="text-xs text-amber-700">
                  The stored webhook secret will be removed when you save.
                </p>
              ) : general.inquiryWebhookSecretConfigured ? (
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
              id="logoUrl"
              value={general.logoUrl}
              onChange={(value) => {
                setGeneral((p) => ({ ...p, logoUrl: value }));
                setGeneralDirty(true);
              }}
              placeholder="https://example.com/logo.png"
            />
          </SettingsField>
          <SettingsField
            label="Favicon URL"
            id="faviconUrl"
            hint="Hosted icon URL or compact uploaded icon asset"
          >
            <AssetPickerField
              id="faviconUrl"
              value={general.faviconUrl}
              kind="icon"
              onChange={(value) => {
                setGeneral((p) => ({ ...p, faviconUrl: value }));
                setGeneralDirty(true);
              }}
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
              id="ogImage"
              value={form.seoOgImage}
              onChange={(value) => {
                setForm((p) => ({ ...p, seoOgImage: value }));
                setDirty(true);
              }}
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

const MAX_SEO_ASSET_FILE_SIZE = 350 * 1024;

function isAllowedSeoAsset(file: File, kind: "image" | "icon") {
  const allowedTypes =
    kind === "icon"
      ? [
          "image/png",
          "image/jpeg",
          "image/svg+xml",
          "image/webp",
          "image/x-icon",
        ]
      : ["image/png", "image/jpeg", "image/svg+xml", "image/webp"];

  return allowedTypes.includes(file.type);
}

function AssetPickerField({
  id,
  value,
  onChange,
  placeholder,
  kind = "image",
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  kind?: "image" | "icon";
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          id={id}
          type="url"
          value={value.startsWith("data:") ? "" : value}
          onChange={(event) => onChange(event.target.value)}
          className={inputCls}
          placeholder={placeholder}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="shrink-0 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          Upload
        </button>
        {value ? (
          <button
            type="button"
            onClick={() => onChange("")}
            className="shrink-0 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-500 hover:bg-gray-50"
          >
            Clear
          </button>
        ) : null}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={
          kind === "icon"
            ? "image/png,image/jpeg,image/svg+xml,image/webp,image/x-icon"
            : "image/png,image/jpeg,image/svg+xml,image/webp"
        }
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];

          if (!file) return;

          if (!isAllowedSeoAsset(file, kind)) {
            toast.error("Choose a PNG, JPG, SVG, or WebP image asset.");
            event.target.value = "";
            return;
          }

          if (file.size > MAX_SEO_ASSET_FILE_SIZE) {
            toast.error("Choose an image smaller than 350 KB.");
            event.target.value = "";
            return;
          }

          const reader = new FileReader();
          reader.onload = () => {
            if (typeof reader.result === "string") {
              onChange(reader.result);
            }
          };
          reader.readAsDataURL(file);
          event.target.value = "";
        }}
      />
      <p className="text-xs text-gray-400">
        Paste a hosted asset URL or upload a compact image for validated
        preview.
      </p>
    </div>
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
