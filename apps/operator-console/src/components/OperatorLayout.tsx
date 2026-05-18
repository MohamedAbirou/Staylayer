import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  ActivitySquare,
  BarChart3,
  Building2,
  CreditCard,
  HeartPulse,
  LifeBuoy,
  Rocket,
  ScrollText,
  Search,
  Settings,
  Shield,
  Users,
} from "lucide-react";
import { useOperatorAuth } from "../auth/useOperatorAuth";
import { OPERATOR_PERMISSIONS, usePermissions } from "../permissions";
import { CommandPalette } from "./CommandPalette";

interface NavItem {
  to: string;
  label: string;
  icon: typeof ActivitySquare;
  /** At least one of these permissions is required for the item to render. */
  anyOf?: readonly string[];
  // Phase 1 marks pending sections so we never silently link to missing routes.
  pending?: boolean;
}

// Top-level information architecture mirrors
// operator-console-docs/01-architecture-and-tech-stack.md. Nav items are
// permission-gated so SUPPORT_ADMIN and FINANCE_ADMIN only see the surfaces
// their role grants them.
const PRIMARY_NAV: NavItem[] = [
  {
    to: "/",
    label: "Command Center",
    icon: ActivitySquare,
    anyOf: [
      OPERATOR_PERMISSIONS.OVERVIEW_READ_ALL,
      OPERATOR_PERMISSIONS.OVERVIEW_READ_SUPPORT,
      OPERATOR_PERMISSIONS.OVERVIEW_READ_BILLING,
    ],
  },
  {
    to: "/tenants",
    label: "Tenants",
    icon: Building2,
    anyOf: [
      OPERATOR_PERMISSIONS.TENANT_READ_ALL,
      OPERATOR_PERMISSIONS.TENANT_LIST_ALL,
    ],
  },
  {
    to: "/support",
    label: "Support",
    icon: LifeBuoy,
    anyOf: [
      OPERATOR_PERMISSIONS.SUPPORT_CASE_READ_ALL,
      OPERATOR_PERMISSIONS.SUPPORT_CASE_READ_BILLING,
      OPERATOR_PERMISSIONS.SUPPORT_CASE_LIST_ALL,
    ],
  },
  {
    to: "/billing",
    label: "Billing",
    icon: CreditCard,
    anyOf: [
      OPERATOR_PERMISSIONS.BILLING_ACCOUNT_READ_ALL,
      OPERATOR_PERMISSIONS.BILLING_SUBSCRIPTION_READ_ALL,
      OPERATOR_PERMISSIONS.BILLING_INVOICE_READ_ALL,
    ],
  },
  {
    to: "/operations",
    label: "Operations",
    icon: Rocket,
    anyOf: [
      OPERATOR_PERMISSIONS.DEPLOYMENT_READ_ALL,
      OPERATOR_PERMISSIONS.DOMAIN_READ_ALL,
      OPERATOR_PERMISSIONS.FORM_DELIVERY_READ_ALL,
      OPERATOR_PERMISSIONS.FORM_SUBMISSION_READ_ALL,
      OPERATOR_PERMISSIONS.OPERATIONAL_ALERT_READ_ALL,
      OPERATOR_PERMISSIONS.SEO_READ_ALL,
      OPERATOR_PERMISSIONS.TRANSLATION_JOB_READ_ALL,
      OPERATOR_PERMISSIONS.NOTIFICATION_READ_ALL,
    ],
  },
  {
    to: "/analytics",
    label: "Analytics",
    icon: BarChart3,
    anyOf: [
      OPERATOR_PERMISSIONS.ANALYTICS_READ_ALL,
      OPERATOR_PERMISSIONS.ANALYTICS_READ_BUSINESS,
      OPERATOR_PERMISSIONS.ANALYTICS_READ_SUPPORT,
      OPERATOR_PERMISSIONS.ANALYTICS_READ_OPERATIONS,
    ],
  },
  {
    to: "/observability",
    label: "Observability",
    icon: HeartPulse,
    anyOf: [OPERATOR_PERMISSIONS.OBSERVABILITY_READ_ALL],
  },
  {
    to: "/audit",
    label: "Audit",
    icon: ScrollText,
    anyOf: [
      OPERATOR_PERMISSIONS.AUDIT_READ_ALL,
      OPERATOR_PERMISSIONS.AUDIT_READ_SUPPORT,
      OPERATOR_PERMISSIONS.AUDIT_READ_BILLING,
    ],
  },
  {
    to: "/permissions",
    label: "Permissions",
    icon: Shield,
    anyOf: [OPERATOR_PERMISSIONS.PERMISSION_MANAGE_ALL],
  },
  {
    to: "/operator-users",
    label: "Operator Users",
    icon: Users,
    anyOf: [
      OPERATOR_PERMISSIONS.OPERATOR_USER_READ_ALL,
      OPERATOR_PERMISSIONS.OPERATOR_USER_MANAGE_ALL,
    ],
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
  const { canAny } = usePermissions();
  const navigate = useNavigate();
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Register a global ⌘K / Ctrl+K shortcut so operators can always reach the
  // command palette without taking their hands off the keyboard.
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const cmdOrCtrl = event.metaKey || event.ctrlKey;
      if (cmdOrCtrl && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen(true);
      } else if (event.key === "Escape" && paletteOpen) {
        setPaletteOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [paletteOpen]);

  const visibleNav = PRIMARY_NAV.filter((item) =>
    item.anyOf ? canAny(item.anyOf) : true,
  );

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
          {visibleNav.map((item) => {
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
        <div className="sticky top-0 z-30 flex items-center justify-end gap-2 border-b border-slate-800 bg-slate-950/80 px-6 py-2 backdrop-blur">
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="flex items-center gap-2 rounded-md border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-400 hover:border-slate-700 hover:text-slate-100"
          >
            <Search className="h-3.5 w-3.5" />
            <span>Quick search</span>
            <span className="ml-2 rounded border border-slate-700 px-1.5 py-0.5 text-[10px] uppercase tracking-widest text-slate-500">
              ⌘K
            </span>
          </button>
          <button
            type="button"
            onClick={() => navigate("/search")}
            className="text-[10px] uppercase tracking-widest text-slate-500 hover:text-slate-300"
          >
            Open full search
          </button>
        </div>
        <Outlet />
      </main>
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
      />
    </div>
  );
}
