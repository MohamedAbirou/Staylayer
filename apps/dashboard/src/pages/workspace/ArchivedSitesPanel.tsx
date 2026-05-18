import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArchiveRestore,
  CheckCircle2,
  Loader2,
  ShieldAlert,
  Trash2,
  X,
} from "lucide-react";
import toast from "react-hot-toast";

import {
  getArchivedWorkspaceSites,
  getSiteDeletionImpact,
  getSiteDeletionJob,
  permanentlyDeleteWorkspaceSite,
  restoreWorkspaceSite,
  type ArchivedWorkspaceSiteRecord,
  type PermanentDeleteSitePayload,
  type SiteDeletionImpact,
  type SiteDeletionJobRecord,
  type SiteDeletionRiskFlag,
} from "../../api/workspace";
import { formatDate, formatRelativeTime } from "../../lib/formatDate";

const RISK_LABEL: Record<SiteDeletionRiskFlag, { title: string; body: string }> = {
  HAS_SUBMISSIONS: {
    title: "Form submissions will be permanently erased",
    body: "Guest inquiries and form deliveries collected on this site will be removed from analytics and exports.",
  },
  HAS_PROVIDER_RESOURCES: {
    title: "Deployment provider resources require ops cleanup",
    body: "This site has provider project / deploy IDs. The shared StayLayer runtime will not be torn down, but ops will need to release any project-specific provider records using the listed IDs.",
  },
  HAS_ACTIVE_INTEGRATIONS: {
    title: "Search Console / Bing / scheduled audits will be revoked",
    body: "Active integrations will be disconnected and scheduled audits will stop. Reconnecting later will require a fresh OAuth handshake.",
  },
  HAS_PUBLISHED_PAGES: {
    title: "Published pages will go offline immediately",
    body: "Live URLs for this site will stop resolving and visitors will get a 404.",
  },
  HAS_CONNECTED_DOMAINS: {
    title: "Connected custom domains will be released",
    body: "Custom hostnames attached to this site will be detached. Verification has to be redone if you ever re-attach them elsewhere.",
  },
};

interface AcknowledgementState {
  acknowledgeSubmissions: boolean;
  acknowledgeProviderResources: boolean;
  acknowledgeIntegrations: boolean;
  acknowledgePublishedPages: boolean;
  acknowledgeConnectedDomains: boolean;
}

const EMPTY_ACKS: AcknowledgementState = {
  acknowledgeSubmissions: false,
  acknowledgeProviderResources: false,
  acknowledgeIntegrations: false,
  acknowledgePublishedPages: false,
  acknowledgeConnectedDomains: false,
};

function ackKeyForRisk(
  risk: SiteDeletionRiskFlag,
): keyof AcknowledgementState {
  switch (risk) {
    case "HAS_SUBMISSIONS":
      return "acknowledgeSubmissions";
    case "HAS_PROVIDER_RESOURCES":
      return "acknowledgeProviderResources";
    case "HAS_ACTIVE_INTEGRATIONS":
      return "acknowledgeIntegrations";
    case "HAS_PUBLISHED_PAGES":
      return "acknowledgePublishedPages";
    case "HAS_CONNECTED_DOMAINS":
      return "acknowledgeConnectedDomains";
  }
}

interface ArchivedSitesPanelProps {
  tenantId: string;
  canManageDangerActions: boolean;
}

export function ArchivedSitesPanel({
  tenantId,
  canManageDangerActions,
}: ArchivedSitesPanelProps) {
  const queryClient = useQueryClient();
  const [expandedSiteId, setExpandedSiteId] = useState<string | null>(null);
  const [activeJob, setActiveJob] = useState<SiteDeletionJobRecord | null>(null);

  const {
    data: archived = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["workspace-archived-sites", tenantId],
    queryFn: () => getArchivedWorkspaceSites(tenantId),
    enabled: Boolean(tenantId),
    retry: false,
  });

  // Auto-poll the active job until it leaves running/queued state.
  const {
    data: polledJob,
  } = useQuery({
    queryKey: ["workspace-site-deletion-job", tenantId, activeJob?.id],
    queryFn: () => getSiteDeletionJob(tenantId, activeJob!.id),
    enabled: Boolean(
      activeJob && (activeJob.status === "QUEUED" || activeJob.status === "RUNNING"),
    ),
    refetchInterval: 3_000,
    retry: false,
  });

  useEffect(() => {
    if (!polledJob) return;
    setActiveJob(polledJob);
    if (polledJob.status === "COMPLETED") {
      toast.success(`${polledJob.siteName} was permanently deleted.`);
      void queryClient.invalidateQueries({
        queryKey: ["workspace-archived-sites", tenantId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["workspace-sites", tenantId],
      });
    } else if (polledJob.status === "FAILED") {
      toast.error(
        polledJob.errorMessage ||
          `Permanent deletion of ${polledJob.siteName} failed.`,
      );
    }
  }, [polledJob, queryClient, tenantId]);

  if (!canManageDangerActions) return null;

  return (
    <div className="rounded-[28px] border border-amber-200 bg-amber-50/40 p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-700">
            Archive · Trash
          </p>
          <h2 className="mt-2 text-2xl font-bold text-slate-950">
            Archived sites
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Archived sites are kept for recovery. From here, an owner can
            restore a site or permanently erase every record after reviewing
            the deletion impact. Permanent deletion preserves tenant audit
            history but removes the site row and all of its data.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refetch()}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
        >
          Refresh
        </button>
      </div>

      {isLoading ? (
        <div className="mt-6 flex items-center gap-2 text-sm text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading archived sites…
        </div>
      ) : isError ? (
        <div className="mt-6 rounded-2xl border border-rose-200 bg-white p-4 text-sm text-rose-700">
          Could not load archived sites. Try again.
        </div>
      ) : archived.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-amber-300 bg-white/70 p-4 text-sm text-slate-600">
          No archived sites in this workspace.
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {archived.map((site) => (
            <ArchivedSiteCard
              key={site.id}
              tenantId={tenantId}
              site={site}
              expanded={expandedSiteId === site.id}
              onToggleExpand={() =>
                setExpandedSiteId(expandedSiteId === site.id ? null : site.id)
              }
              onJobQueued={(job) => setActiveJob(job)}
              activeJob={activeJob}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface ArchivedSiteCardProps {
  tenantId: string;
  site: ArchivedWorkspaceSiteRecord;
  expanded: boolean;
  onToggleExpand: () => void;
  onJobQueued: (job: SiteDeletionJobRecord) => void;
  activeJob: SiteDeletionJobRecord | null;
}

function ArchivedSiteCard({
  tenantId,
  site,
  expanded,
  onToggleExpand,
  onJobQueued,
  activeJob,
}: ArchivedSiteCardProps) {
  const queryClient = useQueryClient();
  const [confirmName, setConfirmName] = useState("");
  const [acks, setAcks] = useState<AcknowledgementState>(EMPTY_ACKS);

  const restoreMutation = useMutation({
    mutationFn: () => restoreWorkspaceSite(tenantId, site.id),
    onSuccess: async () => {
      toast.success(`${site.name} was restored.`);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["workspace-archived-sites", tenantId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["workspace-sites", tenantId],
        }),
      ]);
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response
          ?.data?.message ?? "Could not restore that site.";
      toast.error(message);
    },
  });

  const {
    data: impact,
    isLoading: impactLoading,
    isError: impactError,
  } = useQuery({
    queryKey: ["workspace-site-deletion-impact", tenantId, site.id],
    queryFn: () => getSiteDeletionImpact(tenantId, site.id),
    enabled: expanded,
    retry: false,
  });

  const permanentDeleteMutation = useMutation({
    mutationFn: (payload: PermanentDeleteSitePayload) =>
      permanentlyDeleteWorkspaceSite(tenantId, site.id, payload),
    onSuccess: (job) => {
      toast.success(`Permanent deletion queued for ${site.name}.`);
      onJobQueued(job);
      setConfirmName("");
      setAcks(EMPTY_ACKS);
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response
          ?.data?.message ?? "Could not queue permanent deletion.";
      toast.error(message);
    },
  });

  const allRequiredAcksGranted = useMemo(() => {
    if (!impact) return false;
    return impact.riskFlags.every((risk) => acks[ackKeyForRisk(risk)]);
  }, [impact, acks]);

  const nameMatches = confirmName.trim() === site.name;
  const hasActiveJob =
    activeJob?.siteId === site.id &&
    (activeJob.status === "QUEUED" || activeJob.status === "RUNNING");

  return (
    <article className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-slate-950">{site.name}</h3>
          <p className="mt-1 text-sm text-slate-500">
            Archived{" "}
            {site.archivedAt ? (
              <>
                <span>{formatRelativeTime(site.archivedAt)}</span>{" "}
                <span className="text-slate-400">
                  ({formatDate(site.archivedAt)})
                </span>
              </>
            ) : (
              "—"
            )}
          </p>
          {site.archivedSlug ? (
            <p className="mt-1 text-xs text-slate-500">
              Slug at archive: <code>/{site.archivedSlug}</code>
              {site.archivedSlugAvailable ? null : (
                <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-800">
                  Slug now taken
                </span>
              )}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => restoreMutation.mutate()}
            disabled={restoreMutation.isPending || hasActiveJob}
            className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {restoreMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ArchiveRestore className="h-3.5 w-3.5" />
            )}
            Restore
          </button>
          <button
            type="button"
            onClick={onToggleExpand}
            disabled={hasActiveJob}
            className="inline-flex items-center gap-2 rounded-full border border-rose-300 bg-white px-4 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {expanded ? "Hide danger zone" : "Permanently delete…"}
          </button>
        </div>
      </div>

      {hasActiveJob && activeJob ? (
        <JobProgress job={activeJob} />
      ) : null}

      {expanded && !hasActiveJob ? (
        <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50/60 p-4">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 flex-none text-rose-700" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-rose-950">
                Permanent deletion is irreversible
              </p>
              <p className="mt-1 text-xs leading-5 text-rose-800">
                Site rows and child records will be erased. Tenant audit
                history is preserved. Restore the site first if you are not
                sure.
              </p>

              {impactLoading ? (
                <div className="mt-4 flex items-center gap-2 text-xs text-slate-700">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Computing
                  impact…
                </div>
              ) : impactError || !impact ? (
                <div className="mt-4 text-xs text-rose-800">
                  Could not load impact summary.
                </div>
              ) : (
                <>
                  <ImpactSummary impact={impact} />

                  <div className="mt-4 space-y-2">
                    {impact.riskFlags.length === 0 ? (
                      <p className="text-xs text-slate-600">
                        No elevated risks detected for this site.
                      </p>
                    ) : (
                      impact.riskFlags.map((risk) => {
                        const key = ackKeyForRisk(risk);
                        return (
                          <label
                            key={risk}
                            className="flex items-start gap-2 rounded-xl border border-rose-200 bg-white p-3 text-xs text-slate-700"
                          >
                            <input
                              type="checkbox"
                              checked={acks[key]}
                              onChange={(e) =>
                                setAcks((prev) => ({
                                  ...prev,
                                  [key]: e.target.checked,
                                }))
                              }
                              className="mt-0.5 h-4 w-4 flex-none rounded border-rose-300 text-rose-700 focus:ring-rose-700"
                            />
                            <span>
                              <strong className="block text-slate-900">
                                {RISK_LABEL[risk].title}
                              </strong>
                              <span className="mt-1 block text-slate-600">
                                {RISK_LABEL[risk].body}
                              </span>
                            </span>
                          </label>
                        );
                      })
                    )}
                  </div>

                  <div className="mt-4">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-rose-900">
                      Type <code>{site.name}</code> to confirm
                    </label>
                    <input
                      value={confirmName}
                      onChange={(e) => setConfirmName(e.target.value)}
                      placeholder={site.name}
                      className="mt-2 w-full rounded-xl border border-rose-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-700/30"
                    />
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={
                        permanentDeleteMutation.isPending ||
                        !nameMatches ||
                        !allRequiredAcksGranted
                      }
                      onClick={() =>
                        permanentDeleteMutation.mutate({
                          confirmSiteName: confirmName.trim(),
                          ...acks,
                        })
                      }
                      className="inline-flex items-center gap-2 rounded-full bg-rose-700 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-800 disabled:cursor-not-allowed disabled:bg-rose-300"
                    >
                      {permanentDeleteMutation.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                      Permanently delete
                    </button>
                    <button
                      type="button"
                      onClick={onToggleExpand}
                      className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-white px-4 py-2 text-xs font-semibold text-rose-800 hover:bg-rose-100"
                    >
                      <X className="h-3.5 w-3.5" />
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </article>
  );
}

function ImpactSummary({ impact }: { impact: SiteDeletionImpact }) {
  const rows: Array<{ label: string; value: number | string }> = [
    { label: "Pages", value: impact.counts.pages },
    { label: "Published pages", value: impact.counts.publishedPages },
    { label: "Form definitions", value: impact.counts.formDefinitions },
    { label: "Form submissions", value: impact.counts.formSubmissions },
    { label: "Connected domains", value: impact.counts.connectedDomains },
    { label: "Deployments", value: impact.counts.deployments },
    {
      label: "Search Console rows",
      value: impact.counts.searchConsolePerformanceRows,
    },
    { label: "Bing rows", value: impact.counts.bingPerformanceRows },
    { label: "PSI audits", value: impact.counts.psiAudits },
    { label: "Translation jobs", value: impact.counts.translationJobs },
    { label: "Redirects", value: impact.counts.redirects },
    { label: "Notifications", value: impact.counts.notifications },
    { label: "Audit log entries (preserved)", value: impact.counts.auditLogs },
  ];

  return (
    <div className="mt-3 grid gap-2 rounded-xl border border-rose-100 bg-white p-3 text-xs text-slate-700 sm:grid-cols-2">
      {rows.map((row) => (
        <div key={row.label} className="flex items-center justify-between">
          <span className="text-slate-500">{row.label}</span>
          <span className="font-semibold text-slate-900">
            {typeof row.value === "number"
              ? row.value.toLocaleString()
              : row.value}
          </span>
        </div>
      ))}
      {impact.providerResources.length > 0 ? (
        <div className="sm:col-span-2">
          <p className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-rose-700">
            Ops cleanup — provider resource IDs
          </p>
          <ul className="mt-1 space-y-1 text-[11px] text-slate-700">
            {impact.providerResources.map((res) => (
              <li
                key={res.deploymentId}
                className="rounded bg-rose-50 px-2 py-1"
              >
                <span className="font-semibold">{res.provider ?? "?"}</span>
                {" · project="}
                <code>{res.providerProjectId ?? "—"}</code>
                {" · deploy="}
                <code>{res.providerDeployId ?? "—"}</code>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function JobProgress({ job }: { job: SiteDeletionJobRecord }) {
  const pct = job.totalSteps
    ? Math.min(100, Math.round((job.progress / job.totalSteps) * 100))
    : 0;
  return (
    <div className="mt-4 rounded-2xl border border-amber-200 bg-white p-4">
      <div className="flex items-center gap-2 text-sm">
        {job.status === "RUNNING" || job.status === "QUEUED" ? (
          <Loader2 className="h-4 w-4 animate-spin text-amber-700" />
        ) : job.status === "COMPLETED" ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
        ) : (
          <AlertTriangle className="h-4 w-4 text-rose-600" />
        )}
        <span className="font-semibold text-slate-950">
          {job.status === "QUEUED"
            ? "Deletion queued"
            : job.status === "RUNNING"
              ? `Deleting · ${job.currentStep ?? "working"}`
              : job.status === "COMPLETED"
                ? "Deletion completed"
                : "Deletion failed"}
        </span>
        <span className="ml-auto text-xs text-slate-500">
          {job.progress}/{job.totalSteps}
        </span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full transition-all ${
            job.status === "FAILED"
              ? "bg-rose-600"
              : job.status === "COMPLETED"
                ? "bg-emerald-600"
                : "bg-amber-500"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {job.status === "FAILED" && job.errorMessage ? (
        <p className="mt-2 text-xs text-rose-700">{job.errorMessage}</p>
      ) : null}
    </div>
  );
}
