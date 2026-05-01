import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { usePages } from "../hooks/usePages";
import { useAuth } from "../auth/useAuth";
import { formatDate } from "../lib/formatDate";
import { PageStatusBadge } from "../components/PageStatusBadge";
import { LoadingSpinner } from "../components/LoadingSpinner";
import {
  FileText,
  Globe,
  FileEdit,
  Languages,
  Plus,
  ArrowRight,
  Clock,
} from "lucide-react";

export default function DashboardHome() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data, isLoading } = usePages({ limit: 100 });

  const stats = useMemo(() => {
    const pages = data?.data ?? [];
    const published = pages.filter((p) => p.published).length;
    const drafts = pages.filter((p) => !p.published).length;
    const locales = new Set(pages.map((p) => p.locale)).size;
    const recent = [...pages]
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      )
      .slice(0, 6);
    return { total: pages.length, published, drafts, locales, recent };
  }, [data]);

  if (isLoading) return <LoadingSpinner />;

  const greeting = user?.email?.split("@")[0] ?? "there";

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Good to see you, {greeting} 👋
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Here's an overview of your CMS content.
          </p>
        </div>
        <button
          onClick={() => navigate("/pages/new")}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 active:bg-blue-800"
        >
          <Plus className="h-4 w-4" />
          New Page
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Total Pages"
          value={stats.total}
          icon={FileText}
          color="blue"
          onClick={() => navigate("/pages")}
        />
        <StatCard
          label="Published"
          value={stats.published}
          icon={Globe}
          color="green"
          onClick={() => navigate("/pages")}
        />
        <StatCard
          label="Drafts"
          value={stats.drafts}
          icon={FileEdit}
          color="amber"
          onClick={() => navigate("/pages")}
        />
        <StatCard
          label="Locales"
          value={stats.locales}
          icon={Languages}
          color="purple"
        />
      </div>

      {/* Recently updated */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-900">
              Recently Updated
            </h2>
          </div>
          <button
            onClick={() => navigate("/pages")}
            className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800"
          >
            View all
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>

        {stats.recent.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
            <FileText className="h-10 w-10 text-gray-200" />
            <p className="text-sm text-gray-500">No pages yet</p>
            <button
              onClick={() => navigate("/pages/new")}
              className="text-sm font-medium text-blue-600 hover:text-blue-800"
            >
              Create your first page →
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {stats.recent.map((page) => (
              <div
                key={page.id}
                className="flex items-center justify-between px-6 py-4 hover:bg-gray-50/70 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-gray-900">
                      {page.title}
                    </p>
                    <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                      {page.locale}
                    </span>
                    <PageStatusBadge published={page.published} />
                  </div>
                  <p className="mt-0.5 text-xs text-gray-400">
                    /{page.slug} · updated {formatDate(page.updatedAt)}
                  </p>
                </div>
                <button
                  onClick={() =>
                    navigate(`/editor/${page.slug}?locale=${page.locale}`)
                  }
                  className="ml-4 shrink-0 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                >
                  Edit
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ElementType;
  color: "blue" | "green" | "amber" | "purple";
  onClick?: () => void;
}

const colorMap = {
  blue: { bg: "bg-blue-50", icon: "text-blue-600", value: "text-blue-700" },
  green: {
    bg: "bg-emerald-50",
    icon: "text-emerald-600",
    value: "text-emerald-700",
  },
  amber: { bg: "bg-amber-50", icon: "text-amber-500", value: "text-amber-600" },
  purple: {
    bg: "bg-purple-50",
    icon: "text-purple-600",
    value: "text-purple-700",
  },
};

function StatCard({ label, value, icon: Icon, color, onClick }: StatCardProps) {
  const c = colorMap[color];
  return (
    <div
      onClick={onClick}
      className={`group rounded-xl border border-gray-100 bg-white p-5 shadow-sm transition-all ${
        onClick ? "cursor-pointer hover:shadow-md hover:border-gray-200" : ""
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            {label}
          </p>
          <p className={`mt-2 text-3xl font-bold ${c.value}`}>{value}</p>
        </div>
        <div
          className={`rounded-xl p-2.5 ${c.bg} transition-transform group-hover:scale-110`}
        >
          <Icon className={`h-5 w-5 ${c.icon}`} />
        </div>
      </div>
    </div>
  );
}
