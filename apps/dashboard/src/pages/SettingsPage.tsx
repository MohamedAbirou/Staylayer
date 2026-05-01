import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useUsers } from "../hooks/useUsers";
import {
  useSettings,
  useUpdateSettings,
  useHealth,
} from "../hooks/useSettings";
import { useAuth } from "../auth/useAuth";
import { createUser, updateUser, deleteUser } from "../api/users";
import { getPages } from "../api/pages";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { formatDate, formatRelativeTime } from "../lib/formatDate";
import { ROLES, LOCALES, type Role } from "../lib/constants";
import type { UpdateSettingsPayload } from "../api/settings";
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
  Activity,
  Database,
  Clock,
  CheckCircle2,
  XCircle,
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
  role: Role;
}

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

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

// ─── Main Page ─────────────────────────────────────────────

export default function SettingsPage() {
  const { user: currentUser } = useAuth();

  const [tab, setTab] = useState<"users" | "site" | "seo" | "localization">(
    "users",
  );

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
          Manage your CMS configuration, users, and publishing settings
        </p>
      </div>

      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex gap-1">
          <button className={tabClass("users")} onClick={() => setTab("users")}>
            Users
          </button>
          <button className={tabClass("site")} onClick={() => setTab("site")}>
            Site Settings
          </button>
          <button className={tabClass("seo")} onClick={() => setTab("seo")}>
            SEO Defaults
          </button>
          <button
            className={tabClass("localization")}
            onClick={() => setTab("localization")}
          >
            Localization
          </button>
        </nav>
      </div>

      {tab === "users" && <UsersTab currentUser={currentUser} />}
      {tab === "site" && <SiteSettingsTab />}
      {tab === "seo" && <SeoDefaultsTab />}
      {tab === "localization" && <LocalizationTab />}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// USERS TAB
// ══════════════════════════════════════════════════════════

function UsersTab({
  currentUser,
}: {
  currentUser: { id: string; email: string; role: Role } | null;
}) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useUsers();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<UserFormData>({
    email: "",
    password: "",
    role: "EDITOR",
  });
  const [formError, setFormError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    email: string;
  } | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<Role | "ALL">("ALL");

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
      role?: Role;
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
    setFormData({ email: "", password: "", role: "EDITOR" });
    setFormError("");
  };

  const handleEdit = (user: { id: string; email: string; role: Role }) => {
    setEditingId(user.id);
    setFormData({ email: user.email, password: "", role: user.role });
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
        role?: Role;
      } = {
        id: editingId,
        email: formData.email,
        role: formData.role,
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
    const matchesRole = roleFilter === "ALL" || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const stats = {
    total: allUsers.length,
    superAdmins: allUsers.filter((u) => u.role === "SUPER_ADMIN").length,
    admins: allUsers.filter((u) => u.role === "ADMIN").length,
    editors: allUsers.filter((u) => u.role === "EDITOR").length,
  };

  const roleBadge = (role: Role) => {
    const map: Record<Role, string> = {
      SUPER_ADMIN: "bg-purple-100 text-purple-800 border border-purple-200",
      ADMIN: "bg-blue-100 text-blue-800 border border-blue-200",
      EDITOR: "bg-gray-100 text-gray-700 border border-gray-200",
    };
    const labels: Record<Role, string> = {
      SUPER_ADMIN: "Super Admin",
      ADMIN: "Admin",
      EDITOR: "Editor",
    };
    return (
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${map[role]}`}
      >
        {labels[role]}
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
            label: "Super Admins",
            value: stats.superAdmins,
            icon: ShieldCheck,
            color: "text-purple-700 bg-purple-50 border-purple-200",
          },
          {
            label: "Admins",
            value: stats.admins,
            icon: UserCog,
            color: "text-blue-700 bg-blue-50 border-blue-200",
          },
          {
            label: "Editors",
            value: stats.editors,
            icon: Pencil,
            color: "text-amber-700 bg-amber-50 border-amber-200",
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
            onChange={(e) => setRoleFilter(e.target.value as Role | "ALL")}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="ALL">All Roles</option>
            <option value="SUPER_ADMIN">Super Admin</option>
            <option value="ADMIN">Admin</option>
            <option value="EDITOR">Editor</option>
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
                  value={formData.role}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, role: e.target.value as Role }))
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {ROLES.map((role) => (
                    <option key={role} value={role}>
                      {role === "SUPER_ADMIN"
                        ? "Super Admin"
                        : role === "ADMIN"
                          ? "Admin"
                          : "Editor"}
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
                  <td className="px-4 py-3">{roleBadge(u.role as Role)}</td>
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
                            role: u.role as Role,
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
  const { data: health, isLoading: healthLoading } = useHealth();
  const updateMutation = useUpdateSettings();

  const [general, setGeneral] = useState({
    siteName: "",
    supportEmail: "",
    logoUrl: "",
    faviconUrl: "",
  });
  const [analytics, setAnalytics] = useState({
    gaTrackingId: "",
    gtmContainerId: "",
    clarityId: "",
    googleSiteVerify: "",
  });
  const [social, setSocial] = useState({
    twitterHandle: "",
    linkedinUrl: "",
    facebookUrl: "",
  });
  const [generalDirty, setGeneralDirty] = useState(false);
  const [analyticsDirty, setAnalyticsDirty] = useState(false);
  const [socialDirty, setSocialDirty] = useState(false);

  useEffect(() => {
    if (settings) {
      setGeneral({
        siteName: settings.siteName,
        supportEmail: settings.supportEmail,
        logoUrl: settings.logoUrl,
        faviconUrl: settings.faviconUrl,
      });
      setAnalytics({
        gaTrackingId: settings.gaTrackingId,
        gtmContainerId: settings.gtmContainerId,
        clarityId: settings.clarityId,
        googleSiteVerify: settings.googleSiteVerify,
      });
      setSocial({
        twitterHandle: settings.twitterHandle,
        linkedinUrl: settings.linkedinUrl,
        facebookUrl: settings.facebookUrl,
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

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      {/* System Health */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-gray-100 bg-gray-50 px-5 py-3.5 flex items-center gap-2">
          <Activity className="h-4 w-4 text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-800">System Status</h2>
          <span className="ml-auto text-xs text-gray-400">
            Refreshes every 30s
          </span>
        </div>
        <div className="grid divide-x divide-gray-100 sm:grid-cols-4">
          {/* API Status */}
          <div className="px-5 py-4">
            <p className="text-xs font-medium text-gray-500 mb-1.5">
              API Status
            </p>
            {healthLoading ? (
              <div className="h-5 w-12 animate-pulse rounded bg-gray-200" />
            ) : (
              <div className="flex items-center gap-1.5">
                {health?.status === "ok" ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    <span className="text-sm font-semibold text-emerald-600">
                      Online
                    </span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 text-red-500" />
                    <span className="text-sm font-semibold text-red-600">
                      Error
                    </span>
                  </>
                )}
              </div>
            )}
          </div>
          {/* DB Status */}
          <div className="px-5 py-4">
            <p className="text-xs font-medium text-gray-500 mb-1.5">Database</p>
            {healthLoading ? (
              <div className="h-5 w-16 animate-pulse rounded bg-gray-200" />
            ) : (
              <div className="flex items-center gap-1.5">
                <Database
                  className={`h-4 w-4 ${health?.dbConnected ? "text-emerald-500" : "text-red-500"}`}
                />
                <span
                  className={`text-sm font-semibold ${health?.dbConnected ? "text-emerald-600" : "text-red-600"}`}
                >
                  {health?.dbConnected ? "Connected" : "Disconnected"}
                </span>
              </div>
            )}
          </div>
          {/* Uptime */}
          <div className="px-5 py-4">
            <p className="text-xs font-medium text-gray-500 mb-1.5">Uptime</p>
            {healthLoading ? (
              <div className="h-5 w-20 animate-pulse rounded bg-gray-200" />
            ) : (
              <div className="flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-blue-500" />
                <span className="text-sm font-semibold text-gray-800">
                  {health ? formatUptime(health.uptime) : "—"}
                </span>
              </div>
            )}
          </div>
          {/* Last Check */}
          <div className="px-5 py-4">
            <p className="text-xs font-medium text-gray-500 mb-1.5">
              Last Check
            </p>
            {healthLoading ? (
              <div className="h-5 w-24 animate-pulse rounded bg-gray-200" />
            ) : (
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-600">
                  {health
                    ? new Date(health.timestamp).toLocaleTimeString()
                    : "—"}
                </span>
              </div>
            )}
          </div>
        </div>
        {settings?.updatedBy && (
          <div className="border-t border-gray-100 bg-gray-50/50 px-5 py-2.5 text-xs text-gray-500">
            Settings last updated by{" "}
            <span className="font-medium text-gray-700">
              {settings.updatedBy}
            </span>
            {" · "}
            <span title={formatDate(settings.updatedAt)}>
              {formatRelativeTime(settings.updatedAt)}
            </span>
          </div>
        )}
      </div>

      {/* General Settings */}
      <SettingsCard
        icon={Globe}
        title="General"
        description="Basic site identity shown across the CMS and published website"
        dirty={generalDirty}
        saving={updateMutation.isPending}
        onSave={() => save(general, () => setGeneralDirty(false))}
        onReset={() => {
          if (settings)
            setGeneral({
              siteName: settings.siteName,
              supportEmail: settings.supportEmail,
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
              placeholder="MyAllocator CMS"
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
            label="Logo URL"
            id="logoUrl"
            hint="Direct URL to your logo image (SVG or PNG recommended)"
          >
            <input
              id="logoUrl"
              type="text"
              value={general.logoUrl}
              onChange={(e) => {
                setGeneral((p) => ({ ...p, logoUrl: e.target.value }));
                setGeneralDirty(true);
              }}
              className={inputCls}
              placeholder="https://example.com/logo.svg"
            />
          </SettingsField>
          <SettingsField
            label="Favicon URL"
            id="faviconUrl"
            hint="URL to favicon (.ico, .png or .svg, 32×32 recommended)"
          >
            <input
              id="faviconUrl"
              type="text"
              value={general.faviconUrl}
              onChange={(e) => {
                setGeneral((p) => ({ ...p, faviconUrl: e.target.value }));
                setGeneralDirty(true);
              }}
              className={inputCls}
              placeholder="https://example.com/favicon.ico"
            />
          </SettingsField>
        </div>
        {general.logoUrl && (
          <div className="mt-3 flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
            <img
              src={general.logoUrl}
              alt="Logo preview"
              className="h-8 max-w-30 object-contain"
              onError={(e) =>
                ((e.target as HTMLImageElement).style.display = "none")
              }
            />
            <span className="text-xs text-gray-500">Logo preview</span>
          </div>
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
            });
          setSocialDirty(false);
        }}
      >
        <div className="grid gap-4 sm:grid-cols-3">
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
        </div>
      </SettingsCard>
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
      });
    }
  }, [settings]);

  const serp = form.seoTitleTemplate.replace("%s", previewTitle);
  const descLen = form.seoDefaultDesc.length;

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
              placeholder="%s | MyAllocator"
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
            <input
              id="ogImage"
              type="text"
              value={form.seoOgImage}
              onChange={(e) => {
                setForm((p) => ({ ...p, seoOgImage: e.target.value }));
                setDirty(true);
              }}
              className={inputCls}
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

  const save = () => {
    updateMutation.mutate(
      { activeLocales, defaultLocale },
      {
        onSuccess: () => {
          toast.success("Localization settings saved");
          setDirty(false);
        },
        onError: () => toast.error("Failed to save localization settings"),
      },
    );
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
            Default Locale
          </h2>
        </div>
        <div className="p-5">
          <p className="mb-3 text-sm text-gray-600">
            The default locale is used for canonical URLs and as a fallback when
            no locale-specific content exists.
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
