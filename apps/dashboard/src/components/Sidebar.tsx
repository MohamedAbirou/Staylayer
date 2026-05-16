import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { NavLink, useNavigate } from "react-router-dom";
import {
  Bell,
  Building2,
  FileText,
  Users,
  Settings,
  LogOut,
  LayoutDashboard,
  Inbox,
  CreditCard,
  Globe,
  Rocket,
  Gauge,
  Languages,
  BookOpen,
  Search,
  ArrowRight,
} from "lucide-react";
import {
  BILLING_MEMBERSHIP_ROLES,
  CONTENT_MEMBERSHIP_ROLES,
  SITE_ADMIN_MEMBERSHIP_ROLES,
  describeMembershipRole,
  describePlatformRole,
  getDefaultAuthenticatedPath,
  hasActiveSite,
  hasMembershipRole,
  hasPlatformRole,
} from "../auth/access";
import { useAuth } from "../auth/useAuth";
import { PLATFORM_ROLES } from "../auth/types";
import { getPendingWorkspaceInvitations } from "../api/workspace";
import { NotificationBell } from "./NotificationBell";
import { useSettings } from "../hooks/useSettings";
import { buildMarketingLoginUrl } from "../lib/constants";

type NavigationItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  show: boolean;
  end?: boolean;
  badge?: string | null;
};

type NavigationGroup = {
  title: string;
  items: NavigationItem[];
};

export function Sidebar() {
  const { session, user, logout, switchWorkspace } = useAuth();
  const navigate = useNavigate();
  const { data: settings } = useSettings();
  const [switchingWorkspace, setSwitchingWorkspace] = useState(false);
  const [navQuery, setNavQuery] = useState("");

  const hasContentAccess = hasMembershipRole(session, CONTENT_MEMBERSHIP_ROLES);
  const hasBillingAccess = hasMembershipRole(session, BILLING_MEMBERSHIP_ROLES);
  const canManageWorkspace = hasMembershipRole(
    session,
    SITE_ADMIN_MEMBERSHIP_ROLES,
  );
  const canOpenSettings = canManageWorkspace && hasActiveSite(session);
  const tenantId = session?.activeTenant?.id ?? null;
  const activeMembership =
    session?.memberships.find(
      (membership) => membership.tenantId === session.activeTenant?.id,
    ) ?? null;

  const { data: pendingInvitations = [] } = useQuery({
    queryKey: ["workspace-invitations", tenantId],
    queryFn: () => getPendingWorkspaceInvitations(tenantId!),
    enabled: Boolean(tenantId && canManageWorkspace),
    retry: false,
    refetchInterval: 15_000,
  });

  const siteName =
    session?.activeSite?.name ||
    settings?.siteName ||
    (hasPlatformRole(session, PLATFORM_ROLES)
      ? "StayLayer Operator"
      : "StayLayer");

  const handleLogout = async () => {
    await logout();
    window.location.href = buildMarketingLoginUrl();
  };

  const handleTenantChange = async (nextTenantId: string) => {
    if (!session) return;

    const membership = session.memberships.find(
      (item) => item.tenantId === nextTenantId,
    );
    const nextSiteId = membership?.sites[0]?.id;

    setSwitchingWorkspace(true);
    try {
      const nextSession = await switchWorkspace({
        tenantId: nextTenantId,
        siteId: nextSiteId,
      });
      navigate(getDefaultAuthenticatedPath(nextSession), { replace: true });
    } finally {
      setSwitchingWorkspace(false);
    }
  };

  const handleSiteChange = async (siteId: string) => {
    if (!session?.activeTenant) return;

    setSwitchingWorkspace(true);
    try {
      const nextSession = await switchWorkspace({
        tenantId: session.activeTenant.id,
        siteId: siteId || undefined,
      });
      navigate(getDefaultAuthenticatedPath(nextSession), { replace: true });
    } finally {
      setSwitchingWorkspace(false);
    }
  };

  const link = (isActive: boolean) =>
    `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
      isActive
        ? "bg-[#12392f] text-white shadow-[0_14px_28px_rgba(18,57,47,0.22)]"
        : "text-slate-600 hover:bg-white hover:text-slate-950 hover:shadow-sm"
    }`;

  const roleColor: Record<string, string> = {
    PLATFORM_OWNER: "text-purple-400",
    SUPPORT_ADMIN: "text-blue-400",
    FINANCE_ADMIN: "text-emerald-400",
    OWNER: "text-amber-300",
    ADMIN: "text-blue-400",
    EDITOR: "text-slate-400",
    BILLING: "text-emerald-300",
  };

  const membershipLabel = session?.activeMembershipRole
    ? describeMembershipRole(session.activeMembershipRole)
    : null;
  const platformLabel = user?.platformRole
    ? describePlatformRole(user.platformRole)
    : null;
  const pendingInvitationCount = pendingInvitations.length;
  const navFilter = navQuery.trim().toLowerCase();
  const primaryQuickAction = canManageWorkspace
    ? {
        to: "/workspace",
        label: "Workspace Studio",
        icon: Users,
      }
    : hasContentAccess && hasActiveSite(session)
      ? {
          to: "/pages",
          label: "Pages",
          icon: FileText,
        }
      : {
          to: getDefaultAuthenticatedPath(session),
          label: "Dashboard",
          icon: LayoutDashboard,
        };
  const secondaryQuickAction = hasBillingAccess
    ? {
        to: "/billing",
        label: "Billing",
        icon: CreditCard,
      }
    : canOpenSettings
      ? {
          to: "/settings",
          label: "Site settings",
          icon: Settings,
        }
      : hasContentAccess && hasActiveSite(session)
        ? {
            to: "/seo",
            label: "SEO toolkit",
            icon: Search,
          }
        : null;
  const PrimaryQuickIcon = primaryQuickAction.icon;
  const SecondaryQuickIcon = secondaryQuickAction?.icon;

  const navigationGroups: NavigationGroup[] = [
    {
      title: "Primary",
      items: [
        {
          to: "/",
          label: "Overview",
          icon: LayoutDashboard,
          show: hasContentAccess,
          end: true,
        },
        {
          to: "/pages",
          label: "Pages",
          icon: FileText,
          show: hasContentAccess && hasActiveSite(session),
          end: true,
        },
        {
          to: "/forms",
          label: "Inquiries",
          icon: Inbox,
          show: hasContentAccess && hasActiveSite(session),
        },
        {
          to: "/deployments",
          label: "Deployments",
          icon: Rocket,
          show: hasContentAccess && hasActiveSite(session),
        },
        {
          to: "/domains",
          label: "Domains",
          icon: Globe,
          show: hasContentAccess && hasActiveSite(session),
        },
      ],
    },
    {
      title: "Growth",
      items: [
        {
          to: "/translation",
          label: "Translation",
          icon: Languages,
          show: hasContentAccess && hasActiveSite(session),
        },
        {
          to: "/glossary",
          label: "Glossary",
          icon: BookOpen,
          show: hasContentAccess && hasActiveSite(session),
        },
        {
          to: "/seo",
          label: "SEO",
          icon: Search,
          show: hasContentAccess && hasActiveSite(session),
        },
        {
          to: "/usage",
          label: "Usage",
          icon: Gauge,
          show: hasContentAccess,
        },
      ],
    },
    {
      title: "Operations",
      items: [
        {
          to: "/workspace",
          label: "Workspace Studio",
          icon: Users,
          show: canManageWorkspace,
          badge:
            pendingInvitationCount > 0 ? String(pendingInvitationCount) : null,
        },
        {
          to: "/billing",
          label: "Billing",
          icon: CreditCard,
          show: hasBillingAccess,
        },
        {
          to: "/settings",
          label: "Settings",
          icon: Settings,
          show: canOpenSettings,
        },
      ],
    },
  ]
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          item.show &&
          (!navFilter || item.label.toLowerCase().includes(navFilter)),
      ),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <aside className="flex h-screen w-[22rem] shrink-0 flex-col border-r border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.96),rgba(241,245,249,0.96))] px-3 py-3 text-slate-900">
      <div className="rounded-[28px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.98),_rgba(226,232,240,0.7)_50%,_rgba(191,219,254,0.32)_100%)] p-3.5 shadow-[0_24px_50px_rgba(15,23,42,0.08)]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex h-12 w-32 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-sm">
              <img src="/logo2.png" alt={siteName} className="h-16" />
            </div>
            <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">
              Workspace cockpit
            </p>
            <p className="mt-1.5 truncate text-lg font-semibold text-slate-950">
              {session?.activeTenant?.name || siteName}
            </p>
            <p className="mt-0.5 truncate text-sm text-slate-500">
              {session?.activeSite?.name ||
                "Choose a site context to unlock content tools"}
            </p>
          </div>
          <NotificationBell align="start" />
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {membershipLabel ? (
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${roleColor[session?.activeMembershipRole ?? "EDITOR"] ?? "text-slate-500"} bg-white`}
            >
              {membershipLabel}
            </span>
          ) : null}
          {pendingInvitationCount > 0 ? (
            <button
              type="button"
              onClick={() => navigate("/workspace#pending-invitations")}
              className="inline-flex items-center gap-2 rounded-full bg-[#12392f] px-3 py-1 text-xs font-semibold text-white"
            >
              <Bell className="h-3.5 w-3.5" />
              {pendingInvitationCount} pending invite
              {pendingInvitationCount === 1 ? "" : "s"}
            </button>
          ) : null}
        </div>

        {session?.memberships.length ? (
          <div className="mt-4 space-y-2.5">
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                Workspace
              </span>
              <div className="relative">
                <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <select
                  value={session.activeTenant?.id ?? ""}
                  disabled={
                    switchingWorkspace || session.memberships.length === 1
                  }
                  onChange={(event) =>
                    void handleTenantChange(event.target.value)
                  }
                  className="w-full appearance-none rounded-2xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-700 outline-none transition focus:border-slate-400"
                >
                  {session.memberships.map((membership) => (
                    <option
                      key={membership.tenantId}
                      value={membership.tenantId}
                    >
                      {membership.tenantName}
                    </option>
                  ))}
                </select>
              </div>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                Active site
              </span>
              <select
                value={session?.activeSite?.id ?? ""}
                disabled={switchingWorkspace || !activeMembership?.sites.length}
                onChange={(event) => void handleSiteChange(event.target.value)}
                className="w-full appearance-none rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-400"
              >
                {!activeMembership?.sites.length ? (
                  <option value="">No site available yet</option>
                ) : null}
                {activeMembership?.sites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name}
                  </option>
                ))}
              </select>
            </label>

            {switchingWorkspace ? (
              <p className="text-xs font-medium text-slate-500">
                Syncing workspace context...
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="mt-4 flex flex-1 min-h-0 flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white/85 shadow-sm">
        <div className="border-b border-slate-100 p-3">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={navQuery}
              onChange={(event) => setNavQuery(event.target.value)}
              placeholder="Find anything in the dashboard"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:bg-white"
            />
          </label>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => navigate(primaryQuickAction.to)}
              className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-left shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
            >
              <PrimaryQuickIcon className="h-4 w-4 shrink-0 text-slate-500" />
              <p className="truncate text-sm font-semibold text-slate-900">
                {primaryQuickAction.label}
              </p>
            </button>
            {secondaryQuickAction ? (
              <button
                type="button"
                onClick={() => navigate(secondaryQuickAction.to)}
                className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-[#12392f] px-3 py-2.5 text-left text-white shadow-[0_14px_30px_rgba(18,57,47,0.22)] transition hover:bg-[#0f3028]"
              >
                {SecondaryQuickIcon ? (
                  <SecondaryQuickIcon className="h-4 w-4 shrink-0 text-white/80" />
                ) : null}
                <p className="truncate text-sm font-semibold">
                  {secondaryQuickAction.label}
                </p>
              </button>
            ) : null}
          </div>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
          {navigationGroups.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
              No navigation items match that search.
            </div>
          ) : (
            <div className="space-y-4">
              {navigationGroups.map((group) => (
                <div key={group.title}>
                  <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">
                    {group.title}
                  </p>
                  <div className="mt-2 space-y-1">
                    {group.items.map((item) => {
                      const Icon = item.icon;

                      return (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          end={item.end}
                          className={({ isActive }) => link(isActive)}
                        >
                          {({ isActive }) => (
                            <>
                              <span
                                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${isActive ? "bg-white/12 text-white" : "bg-slate-100 text-slate-500 group-hover:bg-slate-200 group-hover:text-slate-800"}`}
                              >
                                <Icon className="h-4 w-4" />
                              </span>
                              <span className="flex-1 truncate">
                                {item.label}
                              </span>
                              {item.badge ? (
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${isActive ? "bg-white/14 text-white" : "bg-amber-100 text-amber-800"}`}
                                >
                                  {item.badge}
                                </span>
                              ) : null}
                              <ArrowRight
                                className={`h-3.5 w-3.5 ${isActive ? "text-white/80" : "text-slate-300 group-hover:text-slate-500"}`}
                              />
                            </>
                          )}
                        </NavLink>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </nav>
      </div>

      <div className="mt-3 rounded-[24px] border border-slate-200 bg-white/90 p-3 shadow-sm">
        <div className="flex items-center gap-3 rounded-2xl bg-slate-50 px-3 py-2.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#12392f] text-sm font-semibold text-white">
            {user?.email?.[0]?.toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900">
              {user?.email}
            </p>
            {platformLabel ? (
              <p
                className={`text-xs font-medium ${roleColor[user?.platformRole ?? "SUPPORT_ADMIN"] ?? "text-slate-500"}`}
              >
                {platformLabel}
              </p>
            ) : null}
            {!platformLabel && membershipLabel ? (
              <p
                className={`text-xs font-medium ${roleColor[session?.activeMembershipRole ?? "EDITOR"] ?? "text-slate-500"}`}
              >
                {membershipLabel}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-600">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
              Current site
            </p>
            <p className="mt-1 truncate font-medium text-slate-900">
              {session?.activeSite?.name || "No site selected"}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
