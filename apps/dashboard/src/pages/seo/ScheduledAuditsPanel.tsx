import { useMemo, useState } from "react";
import type React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  Play,
  RefreshCw,
  XCircle,
} from "lucide-react";

import {
  dismissSeoAuditAlert,
  getSeoAuditSchedule,
  listSeoAuditAlerts,
  listSeoAuditRuns,
  triggerSeoAuditRun,
  updateSeoAuditSchedule,
  type SeoAuditAlertDto,
  type SeoAuditCadence,
  type SeoAuditRunDto,
  type SeoAuditRunStatus,
  type SeoAuditScheduleDto,
} from "../../api/seo";

interface Props {
  siteId: string;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const STATUS_BADGE: Record<SeoAuditRunStatus, string> = {
  RUNNING: "bg-sky-100 text-sky-800 border-sky-200",
  SUCCESS: "bg-emerald-100 text-emerald-800 border-emerald-200",
  PARTIAL: "bg-amber-100 text-amber-800 border-amber-200",
  FAILED: "bg-red-100 text-red-800 border-red-200",
};

export function ScheduledAuditsPanel({ siteId }: Props): React.ReactElement {
  const queryClient = useQueryClient();

  const scheduleQuery = useQuery({
    queryKey: ["seo-audit-schedule", siteId],
    queryFn: () => getSeoAuditSchedule(siteId),
  });

  const runsQuery = useQuery({
    queryKey: ["seo-audit-runs", siteId],
    queryFn: () => listSeoAuditRuns(siteId, 20),
    refetchInterval: (q) => {
      const data = q.state.data as SeoAuditRunDto[] | undefined;
      return data && data.some((r) => r.status === "RUNNING") ? 4_000 : false;
    },
  });

  const alertsQuery = useQuery({
    queryKey: ["seo-audit-alerts", siteId, "OPEN"],
    queryFn: () => listSeoAuditAlerts(siteId, "OPEN"),
  });

  return (
    <div className="space-y-6">
      <ScheduleCard
        siteId={siteId}
        schedule={scheduleQuery.data}
        isLoading={scheduleQuery.isLoading}
        onSaved={() =>
          void queryClient.invalidateQueries({
            queryKey: ["seo-audit-schedule", siteId],
          })
        }
      />

      <RunsCard
        siteId={siteId}
        runs={runsQuery.data}
        isLoading={runsQuery.isLoading}
        onRefresh={() => void runsQuery.refetch()}
        onTriggered={() =>
          void queryClient.invalidateQueries({
            queryKey: ["seo-audit-runs", siteId],
          })
        }
      />

      <AlertsCard
        siteId={siteId}
        alerts={alertsQuery.data}
        isLoading={alertsQuery.isLoading}
        onDismissed={() =>
          void queryClient.invalidateQueries({
            queryKey: ["seo-audit-alerts", siteId, "OPEN"],
          })
        }
      />
    </div>
  );
}

// ─── Schedule ─────────────────────────────────────────────────────────────

function ScheduleCard({
  siteId,
  schedule,
  isLoading,
  onSaved,
}: {
  siteId: string;
  schedule: SeoAuditScheduleDto | undefined;
  isLoading: boolean;
  onSaved: () => void;
}): React.ReactElement {
  const [cadence, setCadence] = useState<SeoAuditCadence | null>(null);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [hourUtc, setHourUtc] = useState<number | null>(null);
  const [dayOfWeek, setDayOfWeek] = useState<number | null>(null);

  const effective = useMemo(
    () => ({
      cadence: cadence ?? schedule?.cadence ?? "WEEKLY",
      enabled: enabled ?? schedule?.enabled ?? true,
      hourUtc: hourUtc ?? schedule?.hourUtc ?? 3,
      dayOfWeek: dayOfWeek ?? schedule?.dayOfWeek ?? 1,
    }),
    [cadence, enabled, hourUtc, dayOfWeek, schedule],
  );

  const updateMutation = useMutation({
    mutationFn: () =>
      updateSeoAuditSchedule(siteId, {
        cadence: effective.cadence,
        enabled: effective.enabled,
        hourUtc: effective.hourUtc,
        dayOfWeek: effective.cadence === "WEEKLY" ? effective.dayOfWeek : null,
      }),
    onSuccess: () => {
      onSaved();
      setCadence(null);
      setEnabled(null);
      setHourUtc(null);
      setDayOfWeek(null);
    },
  });

  return (
    <Card
      title="Schedule"
      subtitle="When automated SEO audits run for this site."
    >
      {isLoading || !schedule ? (
        <PanelSkeleton />
      ) : (
        <div className="grid gap-4 md:grid-cols-4">
          <Field label="Cadence">
            <select
              className="w-full rounded border-slate-300"
              value={effective.cadence}
              onChange={(e) => setCadence(e.target.value as SeoAuditCadence)}
            >
              <option value="OFF">Off</option>
              <option value="DAILY">Daily</option>
              <option value="WEEKLY">Weekly</option>
            </select>
          </Field>

          <Field label="Enabled">
            <label className="inline-flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                checked={effective.enabled}
                onChange={(e) => setEnabled(e.target.checked)}
              />
              <span className="text-sm text-slate-600">Run on schedule</span>
            </label>
          </Field>

          <Field label="Hour (UTC)">
            <input
              type="number"
              min={0}
              max={23}
              className="w-full rounded border-slate-300"
              value={effective.hourUtc}
              onChange={(e) =>
                setHourUtc(Number.parseInt(e.target.value, 10) || 0)
              }
            />
          </Field>

          <Field label="Day of week">
            <select
              className="w-full rounded border-slate-300 disabled:bg-slate-100"
              value={effective.dayOfWeek}
              disabled={effective.cadence !== "WEEKLY"}
              onChange={(e) =>
                setDayOfWeek(Number.parseInt(e.target.value, 10))
              }
            >
              {DAYS.map((d, i) => (
                <option key={d} value={i}>
                  {d}
                </option>
              ))}
            </select>
          </Field>

          <div className="md:col-span-4 flex items-center justify-between border-t pt-3">
            <div className="text-sm text-slate-600 space-y-1">
              <div>
                <span className="font-medium">Last run:</span>{" "}
                {schedule.lastRunAt
                  ? new Date(schedule.lastRunAt).toLocaleString()
                  : "—"}
              </div>
              <div>
                <span className="font-medium">Next run:</span>{" "}
                {schedule.nextRunAt
                  ? new Date(schedule.nextRunAt).toLocaleString()
                  : "—"}
              </div>
            </div>
            <button
              type="button"
              disabled={updateMutation.isPending}
              onClick={() => updateMutation.mutate()}
              className="inline-flex items-center gap-2 rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"
            >
              {updateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              Save schedule
            </button>
          </div>
          {updateMutation.isError ? (
            <div className="md:col-span-4 text-sm text-red-600">
              Failed to save:{" "}
              {(updateMutation.error as Error | undefined)?.message ??
                "Unknown error"}
            </div>
          ) : null}
        </div>
      )}
    </Card>
  );
}

// ─── Runs ─────────────────────────────────────────────────────────────────

function RunsCard({
  siteId,
  runs,
  isLoading,
  onRefresh,
  onTriggered,
}: {
  siteId: string;
  runs: SeoAuditRunDto[] | undefined;
  isLoading: boolean;
  onRefresh: () => void;
  onTriggered: () => void;
}): React.ReactElement {
  const triggerMutation = useMutation({
    mutationFn: () => triggerSeoAuditRun(siteId),
    onSuccess: onTriggered,
  });

  return (
    <Card
      title="Audit runs"
      subtitle="Most recent automated and manual runs."
      action={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className="h-3 w-3" />
            Refresh
          </button>
          <button
            type="button"
            disabled={triggerMutation.isPending}
            onClick={() => triggerMutation.mutate()}
            className="inline-flex items-center gap-1 rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
          >
            {triggerMutation.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Play className="h-3 w-3" />
            )}
            Run now
          </button>
        </div>
      }
    >
      {isLoading ? (
        <PanelSkeleton />
      ) : !runs || runs.length === 0 ? (
        <EmptyState message="No audit runs yet. Trigger one above to start a history." />
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="py-2 pr-3">Started</th>
                <th className="py-2 pr-3">Kind</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Pages</th>
                <th className="py-2 pr-3">Avg score</th>
                <th className="py-2 pr-3">Alerts</th>
                <th className="py-2 pr-3">Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {runs.map((r) => (
                <tr key={r.id}>
                  <td className="py-2 pr-3 text-slate-700">
                    {new Date(r.startedAt).toLocaleString()}
                  </td>
                  <td className="py-2 pr-3">{r.kind}</td>
                  <td className="py-2 pr-3">
                    <span
                      className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs ${STATUS_BADGE[r.status]}`}
                    >
                      {r.status === "RUNNING" ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : r.status === "SUCCESS" ? (
                        <CheckCircle2 className="h-3 w-3" />
                      ) : r.status === "PARTIAL" ? (
                        <AlertTriangle className="h-3 w-3" />
                      ) : (
                        <XCircle className="h-3 w-3" />
                      )}
                      {r.status}
                    </span>
                  </td>
                  <td className="py-2 pr-3">{r.pagesAudited}</td>
                  <td className="py-2 pr-3">{r.averageScore ?? "—"}</td>
                  <td className="py-2 pr-3">{r.alertsCreated}</td>
                  <td className="py-2 pr-3 text-slate-500">
                    {r.durationMs != null
                      ? `${(r.durationMs / 1000).toFixed(1)}s`
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {triggerMutation.isError ? (
        <div className="mt-2 text-sm text-red-600">
          Failed to trigger:{" "}
          {(triggerMutation.error as Error | undefined)?.message ??
            "Unknown error"}
        </div>
      ) : null}
    </Card>
  );
}

// ─── Alerts ───────────────────────────────────────────────────────────────

function AlertsCard({
  siteId,
  alerts,
  isLoading,
  onDismissed,
}: {
  siteId: string;
  alerts: SeoAuditAlertDto[] | undefined;
  isLoading: boolean;
  onDismissed: () => void;
}): React.ReactElement {
  const dismissMutation = useMutation({
    mutationFn: (alertId: string) => dismissSeoAuditAlert(siteId, alertId),
    onSuccess: onDismissed,
  });

  return (
    <Card
      title="Open alerts"
      subtitle="Regressions detected since the last audit run."
    >
      {isLoading ? (
        <PanelSkeleton />
      ) : !alerts || alerts.length === 0 ? (
        <EmptyState message="No open SEO audit alerts. All clear." />
      ) : (
        <ul className="space-y-2">
          {alerts.map((a) => (
            <li
              key={a.id}
              className="flex items-start gap-3 rounded border border-slate-200 p-3"
            >
              <div className="mt-0.5">
                {a.severity === "CRITICAL" ? (
                  <AlertCircle className="h-4 w-4 text-red-500" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                )}
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-slate-900">
                  {a.message}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span
                    className={`rounded border px-1.5 py-0.5 ${
                      a.severity === "CRITICAL"
                        ? "border-red-200 bg-red-50 text-red-700"
                        : "border-amber-200 bg-amber-50 text-amber-700"
                    }`}
                  >
                    {a.severity}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(a.lastTriggeredAt).toLocaleString()}
                  </span>
                  {a.metadata?.reason ? (
                    <span className="rounded bg-slate-100 px-1.5 py-0.5">
                      {a.metadata.reason}
                    </span>
                  ) : null}
                </div>
              </div>
              <button
                type="button"
                disabled={dismissMutation.isPending}
                onClick={() => dismissMutation.mutate(a.id)}
                className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                Dismiss
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// ─── Layout helpers ───────────────────────────────────────────────────────

function Card({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <header className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          {subtitle ? (
            <p className="text-sm text-slate-500">{subtitle}</p>
          ) : null}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}

function PanelSkeleton(): React.ReactElement {
  return (
    <div className="flex items-center gap-2 text-slate-500">
      <Loader2 className="h-4 w-4 animate-spin" />
      <span>Loading…</span>
    </div>
  );
}

function EmptyState({ message }: { message: string }): React.ReactElement {
  return (
    <div className="rounded bg-slate-50 p-4 text-sm text-slate-600">
      {message}
    </div>
  );
}
