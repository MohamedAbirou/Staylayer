import { NavLink, useNavigate } from "react-router-dom";
import {
  FileText,
  Users,
  Settings,
  LogOut,
  LayoutDashboard,
  Inbox,
  CreditCard,
  Globe,
  Sparkles,
  Rocket,
  Gauge,
  Languages,
  BookOpen,
  Search,
} from "lucide-react";
import {
  BILLING_MEMBERSHIP_ROLES,
  CONTENT_MEMBERSHIP_ROLES,
  SITE_ADMIN_MEMBERSHIP_ROLES,
  describeMembershipRole,
  describePlatformRole,
  // getDefaultAuthenticatedPath,
  hasActiveSite,
  hasMembershipRole,
  hasPlatformRole,
} from "../auth/access";
import { useAuth } from "../auth/useAuth";
import { PLATFORM_ROLES } from "../auth/types";
import { useSettings } from "../hooks/useSettings";
import { NotificationBell } from "./NotificationBell";

export function Sidebar() {
  const { session, user, logout } = useAuth();
  const navigate = useNavigate();
  const { data: settings } = useSettings();
  // const [switchingWorkspace, setSwitchingWorkspace] = useState(false);

  const hasContentAccess = hasMembershipRole(session, CONTENT_MEMBERSHIP_ROLES);
  const hasBillingAccess = hasMembershipRole(session, BILLING_MEMBERSHIP_ROLES);
  const canManageWorkspace = hasMembershipRole(
    session,
    SITE_ADMIN_MEMBERSHIP_ROLES,
  );
  const canOpenSettings = canManageWorkspace && hasActiveSite(session);
  // const activeMembership =
  //   session?.memberships.find(
  //     (membership) => membership.tenantId === session.activeTenant?.id,
  //   ) ?? null;

  const siteName =
    session?.activeSite?.name ||
    settings?.siteName ||
    (hasPlatformRole(session, PLATFORM_ROLES)
      ? "StayLayer Operator"
      : "StayLayer");
  const logoUrl = settings?.logoUrl || "";

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  // const handleTenantChange = async (tenantId: string) => {
  //   if (!session) return;

  //   const membership = session.memberships.find(
  //     (item) => item.tenantId === tenantId,
  //   );
  //   const nextSiteId =
  //     membership?.sites.length === 1 ? membership.sites[0].id : undefined;

  //   setSwitchingWorkspace(true);
  //   try {
  //     const nextSession = await switchWorkspace({
  //       tenantId,
  //       siteId: nextSiteId,
  //     });
  //     navigate(getDefaultAuthenticatedPath(nextSession), { replace: true });
  //   } finally {
  //     setSwitchingWorkspace(false);
  //   }
  // };

  // const handleSiteChange = async (siteId: string) => {
  //   if (!session?.activeTenant) return;

  //   setSwitchingWorkspace(true);
  //   try {
  //     const nextSession = await switchWorkspace({
  //       tenantId: session.activeTenant.id,
  //       siteId,
  //     });
  //     navigate(getDefaultAuthenticatedPath(nextSession), { replace: true });
  //   } finally {
  //     setSwitchingWorkspace(false);
  //   }
  // };

  const link = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
      isActive
        ? "bg-blue-600 text-white shadow-sm"
        : "text-slate-400 hover:bg-slate-800 hover:text-white"
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

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col bg-slate-900">
      {/* Brand */}
      <div className="flex items-center justify-between border-b border-slate-700/50 px-3">
        <div className="flex h-16 items-center gap-3 ">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 overflow-hidden">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={siteName}
                className="h-6 w-6 object-contain"
              />
            ) : (
              <img src="/favicon.svg" alt={siteName} className="w-5 h-5" />
            )}
          </div>
          <div className="leading-tight min-w-0">
            <p className="truncate text-sm font-bold text-white">{siteName}</p>
            <p className="text-[11px] text-slate-400">
              {session?.activeTenant?.name || "CMS Dashboard"}
            </p>
          </div>
        </div>
        <NotificationBell />
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-5 px-3 py-5 overflow-y-auto">
        {/* {session?.memberships.length ? (
          <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/50 px-3 py-3">
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                Workspace
              </p>
              <label className="mb-1 block text-[11px] text-slate-400">
                Select workspace
              </label>
              <div className="relative">
                <Building2 className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                <select
                  value={`${session.activeTenant?.id ?? ""}:${session.activeSite?.id ?? ""}`}
                  disabled={
                    switchingWorkspace || session.memberships.length === 1
                  }
                  onChange={async (event) => {
                    const [tenantId, siteId] = event.target.value.split(":");
                    setSwitchingWorkspace(true);
                    try {
                      const nextSession = await switchWorkspace({
                        tenantId,
                        siteId: siteId || undefined,
                      });
                      navigate(getDefaultAuthenticatedPath(nextSession), {
                        replace: true,
                      });
                    } finally {
                      setSwitchingWorkspace(false);
                    }
                  }}
                  className="w-full appearance-none rounded-lg border border-slate-800 bg-slate-900 py-2 pl-8 pr-3 text-xs text-slate-200 focus:border-blue-500 focus:outline-none"
                >
                  {session.memberships.flatMap((membership) =>
                    membership.sites && membership.sites.length > 0
                      ? membership.sites.map((site) => (
                          <option
                            key={`${membership.tenantId}:${site.id}`}
                            value={`${membership.tenantId}:${site.id}`}
                          >
                            {membership.tenantName} — {site.name}
                          </option>
                        ))
                      : [
                          <option
                            key={membership.tenantId}
                            value={`${membership.tenantId}:`}
                          >
                            {membership.tenantName}
                          </option>,
                        ],
                  )}
                </select>
              </div>

              {hasContentAccess && !hasActiveSite(session) && (
                <p className="text-[11px] leading-5 text-amber-300">
                  Select a workspace to load pages, previews, and content
                  actions.
                </p>
              )}
            </div>
          </div>
        ) : null} */}

        {hasContentAccess && (
          <NavLink to="/" end className={link}>
            <LayoutDashboard className="h-4 w-4" />
            Overview
          </NavLink>
        )}

        {hasContentAccess && hasActiveSite(session) && (
          <div>
            <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
              Content
            </p>
            <div className="space-y-0.5">
              <NavLink to="/pages" className={link} end>
                <FileText className="h-4 w-4" />
                Pages
              </NavLink>
              <NavLink to="/translation" className={link}>
                <Languages className="h-4 w-4" />
                Translation
              </NavLink>
              <NavLink to="/glossary" className={link}>
                <BookOpen className="h-4 w-4" />
                Glossary
              </NavLink>
              <NavLink to="/seo" className={link}>
                <Search className="h-4 w-4" />
                SEO
              </NavLink>
            </div>
          </div>
        )}

        {hasContentAccess || hasBillingAccess ? (
          <div>
            <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
              Workspace
            </p>
            <div className="space-y-0.5">
              {hasContentAccess && hasActiveSite(session) && (
                <NavLink to="/deployments" className={link}>
                  <Rocket className="h-4 w-4" />
                  Deployments
                </NavLink>
              )}
              {hasContentAccess && hasActiveSite(session) && (
                <NavLink to="/forms" className={link}>
                  <Inbox className="h-4 w-4" />
                  Inquiries
                </NavLink>
              )}
              {hasContentAccess && hasActiveSite(session) && (
                <NavLink to="/domains" className={link}>
                  <Globe className="h-4 w-4" />
                  Domains
                </NavLink>
              )}
              {hasContentAccess && (
                <NavLink to="/usage" className={link}>
                  <Gauge className="h-4 w-4" />
                  Usage
                </NavLink>
              )}
              {hasBillingAccess && (
                <NavLink to="/billing" className={link}>
                  <CreditCard className="h-4 w-4" />
                  Billing
                </NavLink>
              )}
            </div>
          </div>
        ) : null}

        {(canManageWorkspace || canOpenSettings) && (
          <div>
            <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
              Administration
            </p>
            <div className="space-y-0.5">
              {canManageWorkspace && (
                <NavLink to="/workspace" className={link}>
                  <Users className="h-4 w-4" />
                  Workspace Studio
                </NavLink>
              )}
              <NavLink to="/settings" className={link}>
                <Settings className="h-4 w-4" />
                Settings
              </NavLink>
            </div>
          </div>
        )}

        {hasContentAccess && hasActiveSite(session) && (
          <NavLink to="/onboarding" className={link}>
            <Sparkles className="h-4 w-4" />
            Onboarding
          </NavLink>
        )}
      </nav>

      {/* User footer */}
      <div className="border-t border-slate-700/50 p-3">
        <div className="mb-2 flex items-center gap-3 rounded-lg px-3 py-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-700 text-xs font-semibold text-slate-200">
            {user?.email?.[0]?.toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-200">
              {user?.email}
            </p>
            {platformLabel ? (
              <p
                className={`text-xs font-medium ${roleColor[user?.platformRole ?? "SUPPORT_ADMIN"] ?? "text-slate-400"}`}
              >
                {platformLabel}
              </p>
            ) : null}
            {membershipLabel ? (
              <p
                className={`text-xs font-medium ${roleColor[session?.activeMembershipRole ?? "EDITOR"] ?? "text-slate-400"}`}
              >
                {membershipLabel}
              </p>
            ) : null}
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex-1 flex items-center justify-center gap-3 rounded-lg w-full px-3 py-2 text-sm font-medium text-white transition-colors bg-red-800 hover:bg-red-800/80 cursor-pointer"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
