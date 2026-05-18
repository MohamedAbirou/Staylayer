import { Link } from "react-router-dom";
import {
  Rocket,
  Globe2,
  Inbox,
  AlertTriangle,
  Search,
  Languages,
  Bell,
  ArrowRight,
} from "lucide-react";
import { usePermissions } from "../permissions";
import { OPERATOR_PERMISSIONS } from "../permissions/registry";

interface Tile {
  to: string;
  title: string;
  description: string;
  icon: typeof Rocket;
  permission: string;
}
const TILES: Tile[] = [
  {
    to: "/operations/deployments",
    title: "Deployments",
    description:
      "Vercel build pipeline status across every site. Inspect the timeline and retry failed deploys.",
    icon: Rocket,
    permission: OPERATOR_PERMISSIONS.DEPLOYMENT_READ_ALL,
  },
  {
    to: "/operations/domains",
    title: "Domains",
    description:
      "DNS verification, SSL provisioning, and host status for tenant domains. Retry stuck verifications.",
    icon: Globe2,
    permission: OPERATOR_PERMISSIONS.DOMAIN_READ_ALL,
  },
  {
    to: "/operations/forms",
    title: "Form submissions",
    description:
      "Tenant lead submissions and their email/webhook deliveries. Replay failed deliveries safely.",
    icon: Inbox,
    permission: OPERATOR_PERMISSIONS.FORM_DELIVERY_READ_ALL,
  },
  {
    to: "/operations/alerts",
    title: "Operational alerts",
    description:
      "Open + acknowledged platform alerts (delivery failures, sitemap errors, integration issues).",
    icon: AlertTriangle,
    permission: OPERATOR_PERMISSIONS.OPERATIONAL_ALERT_READ_ALL,
  },
  {
    to: "/operations/seo",
    title: "SEO operations",
    description:
      "Per-site SEO snapshot — structured data, sitemap submissions, hreflang, PSI runs. Retry submissions.",
    icon: Search,
    permission: OPERATOR_PERMISSIONS.SEO_READ_ALL,
  },
  {
    to: "/operations/translations",
    title: "Translations",
    description:
      "DeepL job queue, character usage, and glossaries. Retry failed translation jobs.",
    icon: Languages,
    permission: OPERATOR_PERMISSIONS.TRANSLATION_JOB_READ_ALL,
  },
  {
    to: "/operations/notifications",
    title: "Notifications",
    description:
      "User-facing notifications across all tenants. Read-only — supports filtering by category and tenant.",
    icon: Bell,
    permission: OPERATOR_PERMISSIONS.NOTIFICATION_READ_ALL,
  },
];

/**
 * Phase 9 — landing page for the Operations section. Tiles are hidden
 * for operators who lack the relevant read permission so the surface
 * stays role-appropriate.
 */
export default function OperationsLandingPage() {
  const { can } = usePermissions();
  const visible = TILES.filter((tile) => can(tile.permission));
  return (
    <div className="px-8 py-8">
      <header className="flex items-center gap-3">
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-2 text-cyan-400">
          <Rocket className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-white">Operations</h1>
          <p className="text-xs text-slate-400">
            Cross-tenant operational dashboards. All mutations are
            permission-checked and audited.
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
          Your operator role does not include access to any Operations surfaces.
        </p>
      ) : null}
    </div>
  );
}
