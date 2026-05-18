import { Link } from "react-router-dom";
import {
  BarChart3,
  HeartPulse,
  LineChart,
  Users,
  LifeBuoy,
  Activity,
  ArrowRight,
} from "lucide-react";
import { usePermissions } from "../permissions";
import { OPERATOR_PERMISSIONS } from "../permissions/registry";

interface Tile {
  to: string;
  title: string;
  description: string;
  icon: typeof Activity;
  anyOf: string[];
}

const TILES: Tile[] = [
  {
    to: "/analytics/business",
    title: "Business metrics",
    description:
      "Tenant growth, plan mix, trial → paid funnel, MRR trend, payment failures, expansion vs downgrade.",
    icon: LineChart,
    anyOf: [
      OPERATOR_PERMISSIONS.ANALYTICS_READ_ALL,
      OPERATOR_PERMISSIONS.ANALYTICS_READ_BUSINESS,
    ],
  },
  {
    to: "/analytics/support",
    title: "Support metrics",
    description:
      "Case volume, response/resolution percentiles, SLA breaches, reopen rate, operator workload.",
    icon: LifeBuoy,
    anyOf: [
      OPERATOR_PERMISSIONS.ANALYTICS_READ_ALL,
      OPERATOR_PERMISSIONS.ANALYTICS_READ_SUPPORT,
    ],
  },
  {
    to: "/analytics/operations",
    title: "Operations metrics",
    description:
      "Deployment success / duration, domain verification, submission volume, delivery failures, SEO audits.",
    icon: Activity,
    anyOf: [
      OPERATOR_PERMISSIONS.ANALYTICS_READ_ALL,
      OPERATOR_PERMISSIONS.ANALYTICS_READ_OPERATIONS,
    ],
  },
  {
    to: "/analytics/tenant-health",
    title: "Tenant health",
    description:
      "Cross-tenant health score table with drill-down to Tenant 360. Healthy → critical distribution histogram.",
    icon: Users,
    anyOf: [OPERATOR_PERMISSIONS.ANALYTICS_READ_ALL],
  },
  {
    to: "/observability",
    title: "Observability",
    description:
      "Live dependency health — database, billing webhooks, deployment provider, form delivery, audit log.",
    icon: HeartPulse,
    anyOf: [OPERATOR_PERMISSIONS.OBSERVABILITY_READ_ALL],
  },
];

/**
 * Phase 10 — landing page for the Analytics section. Tiles are hidden for
 * operators who lack the relevant permission so the surface stays
 * role-appropriate. Mirrors the layout of `OperationsLandingPage`.
 */
export default function AnalyticsLandingPage() {
  const { can } = usePermissions();
  const visible = TILES.filter((tile) => tile.anyOf.some((p) => can(p)));
  return (
    <div className="px-8 py-8">
      <header className="flex items-center gap-3">
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-2 text-cyan-400">
          <BarChart3 className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-white">Analytics</h1>
          <p className="text-xs text-slate-400">
            Read-only platform analytics. Live queries scoped to the last
            7/30/90 days. Drill-down links lead to the matching operational
            queue.
          </p>
        </div>
      </header>

      <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((tile) => {
          const Icon = tile.icon;
          return (
            <Link
              key={tile.to}
              to={tile.to}
              className="group flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-5 hover:border-cyan-700 hover:bg-slate-900/80"
            >
              <div className="flex items-center justify-between">
                <Icon className="h-5 w-5 text-cyan-400" />
                <ArrowRight className="h-4 w-4 text-slate-500 transition group-hover:translate-x-1 group-hover:text-cyan-300" />
              </div>
              <h2 className="text-sm font-semibold text-white">{tile.title}</h2>
              <p className="text-xs text-slate-400">{tile.description}</p>
            </Link>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <p className="mt-12 rounded-xl border border-slate-800 bg-slate-900 p-6 text-center text-sm text-slate-400">
          Your operator role does not include access to any Analytics surfaces.
        </p>
      ) : null}
    </div>
  );
}
