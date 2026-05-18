import { NavLink, Outlet } from "react-router-dom";
import {
  ActivitySquare,
  Building2,
  CreditCard,
  LifeBuoy,
  Receipt,
  ScrollText,
  Settings,
  Shield,
  Users,
} from "lucide-react";
import { useOperatorAuth } from "../auth/useOperatorAuth";

interface NavItem {
  to: string;
  label: string;
  icon: typeof ActivitySquare;
  // Phase 1 marks pending sections so we never silently link to missing routes.
  pending?: boolean;
}

// Top-level information architecture mirrors
// operator-console-docs/01-architecture-and-tech-stack.md. Most sections are
// placeholders in Phase 1 and will be implemented in their respective phases.
const PRIMARY_NAV: NavItem[] = [
  { to: "/", label: "Command Center", icon: ActivitySquare },
  { to: "/tenants", label: "Tenants", icon: Building2, pending: true },
  { to: "/support", label: "Support", icon: LifeBuoy, pending: true },
  { to: "/billing", label: "Billing", icon: CreditCard, pending: true },
  { to: "/operations", label: "Operations", icon: Receipt, pending: true },
  { to: "/audit", label: "Audit", icon: ScrollText, pending: true },
  { to: "/permissions", label: "Permissions", icon: Shield, pending: true },
  {
    to: "/operator-users",
    label: "Operator Users",
    icon: Users,
    pending: true,
  },
];

function navLinkClass({ isActive }: { isActive: boolean }) {
  return [
    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition",
    isActive
      ? "bg-slate-800 text-white"
      : "text-slate-300 hover:bg-slate-800/60 hover:text-white",
  ].join(" ");
}

export function OperatorLayout() {
  const { session, logout } = useOperatorAuth();

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      <aside className="flex w-64 shrink-0 flex-col border-r border-slate-800 bg-slate-900">
        <div className="flex items-center gap-3 border-b border-slate-800 px-4 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-cyan-600">
            <Shield className="h-4 w-4 text-white" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold text-white">Operator Console</p>
            <p className="text-[11px] uppercase tracking-widest text-slate-500">
              Internal control plane
            </p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
            Workspace
          </p>
          {PRIMARY_NAV.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={navLinkClass}
              >
                <Icon className="h-4 w-4" />
                <span className="flex-1">{item.label}</span>
                {item.pending ? (
                  <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    Soon
                  </span>
                ) : null}
              </NavLink>
            );
          })}
        </nav>
        <div className="border-t border-slate-800 p-3">
          <div className="flex items-center gap-3 rounded-md px-3 py-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-700 text-xs font-semibold text-slate-200">
              {session?.user.email?.[0]?.toUpperCase() ?? "?"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-white">
                {session?.user.email ?? "Not signed in"}
              </p>
              <p className="text-[10px] uppercase tracking-widest text-slate-500">
                {session?.user.platformRole ?? "—"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              void logout();
            }}
            className="mt-2 flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs font-medium text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <Settings className="h-3.5 w-3.5" />
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
