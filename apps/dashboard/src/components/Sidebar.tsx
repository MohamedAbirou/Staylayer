import { NavLink, useNavigate } from "react-router-dom";
import {
  FileText,
  Settings,
  LogOut,
  Plus,
  LayoutDashboard,
} from "lucide-react";
import { useAuth } from "../auth/useAuth";
import { useSettings } from "../hooks/useSettings";

export function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { data: settings } = useSettings();

  const siteName = settings?.siteName || "MyAllocator";
  const logoUrl = settings?.logoUrl || "";

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const link = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
      isActive
        ? "bg-blue-600 text-white shadow-sm"
        : "text-slate-400 hover:bg-slate-800 hover:text-white"
    }`;

  const roleColor: Record<string, string> = {
    SUPER_ADMIN: "text-purple-400",
    ADMIN: "text-blue-400",
    EDITOR: "text-slate-400",
  };

  return (
    <aside className="flex w-64 shrink-0 flex-col bg-slate-900">
      {/* Brand */}
      <div className="flex h-16 items-center gap-3 border-b border-slate-700/50 px-5">
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
          <p className="text-[11px] text-slate-400">CMS Dashboard</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-5 px-3 py-5">
        <NavLink to="/" end className={link}>
          <LayoutDashboard className="h-4 w-4" />
          Overview
        </NavLink>

        <div>
          <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
            Content
          </p>
          <div className="space-y-0.5">
            <NavLink to="/pages" className={link} end>
              <FileText className="h-4 w-4" />
              Pages
            </NavLink>
            <NavLink to="/pages/new" className={link} end>
              <Plus className="h-4 w-4" />
              New Page
            </NavLink>
          </div>
        </div>

        {user?.role === "SUPER_ADMIN" && (
          <div>
            <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
              System
            </p>
            <div className="space-y-0.5">
              <NavLink to="/settings" className={link}>
                <Settings className="h-4 w-4" />
                Settings
              </NavLink>
            </div>
          </div>
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
            <p
              className={`text-xs font-medium ${roleColor[user?.role ?? "EDITOR"] ?? "text-slate-400"}`}
            >
              {user?.role}
            </p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
