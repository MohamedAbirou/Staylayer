import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Building2,
  Rocket,
  CreditCard,
  Globe,
  Inbox,
  ClipboardList,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "../auth/useAuth";
import { describePlatformRole } from "../auth/access";

const link = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
    isActive
      ? "bg-purple-600 text-white shadow-sm"
      : "text-slate-400 hover:bg-slate-800 hover:text-white"
  }`;

export function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const platformLabel = user?.platformRole
    ? describePlatformRole(user.platformRole)
    : "Operator";

  const roleColor: Record<string, string> = {
    PLATFORM_OWNER: "text-purple-400",
    SUPPORT_ADMIN: "text-blue-400",
    FINANCE_ADMIN: "text-emerald-400",
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Admin sidebar */}
      <aside className="flex w-64 shrink-0 flex-col bg-slate-950">
        {/* Brand */}
        <div className="flex h-16 items-center gap-3 border-b border-slate-800 px-5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-600">
            <ShieldCheck className="h-4 w-4 text-white" />
          </div>
          <div className="leading-tight min-w-0">
            <p className="truncate text-sm font-bold text-white">
              Operator Console
            </p>
            <p className="text-[11px] text-slate-400">Platform admin</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1 px-3 py-5">
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
            Platform
          </p>
          <NavLink to="/admin/overview" className={link}>
            <LayoutDashboard className="h-4 w-4" />
            Overview
          </NavLink>
          <NavLink to="/admin/tenants" className={link}>
            <Building2 className="h-4 w-4" />
            Tenants
          </NavLink>
          <NavLink to="/admin/deployments" className={link}>
            <Rocket className="h-4 w-4" />
            Deployments
          </NavLink>
          <NavLink to="/admin/subscriptions" className={link}>
            <CreditCard className="h-4 w-4" />
            Subscriptions
          </NavLink>
          <NavLink to="/admin/domains" className={link}>
            <Globe className="h-4 w-4" />
            Domains
          </NavLink>
          <NavLink to="/admin/forms" className={link}>
            <Inbox className="h-4 w-4" />
            Inquiry Volume
          </NavLink>
          <NavLink to="/admin/audit" className={link}>
            <ClipboardList className="h-4 w-4" />
            Audit Log
          </NavLink>
        </nav>

        {/* User footer */}
        <div className="border-t border-slate-800 p-3">
          <div className="mb-2 flex items-center gap-3 rounded-lg px-3 py-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-700 text-xs font-semibold text-slate-200">
              {user?.email?.[0]?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-200">
                {user?.email}
              </p>
              <p
                className={`text-xs font-medium ${roleColor[user?.platformRole ?? "SUPPORT_ADMIN"] ?? "text-slate-400"}`}
              >
                {platformLabel}
              </p>
            </div>
          </div>
          <button
            onClick={() => void handleLogout()}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex flex-1 flex-col overflow-auto bg-gray-50">
        <div className="flex-1 p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
