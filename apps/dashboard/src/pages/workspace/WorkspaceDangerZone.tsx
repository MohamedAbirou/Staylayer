import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, Loader2, ShieldAlert, Trash2 } from "lucide-react";
import toast from "react-hot-toast";

import {
  getTenantDeletionImpact,
  getTenantDeletionJob,
  permanentlyDeleteWorkspace,
  type PermanentDeleteTenantPayload,
  type TenantDeletionImpact,
  type TenantDeletionJobRecord,
  type TenantDeletionRiskFlag,
} from "../../api/workspace";
import { useAuth } from "../../auth/useAuth";

const RISK_LABEL: Record<
  TenantDeletionRiskFlag,
  { title: string; body: string }
> = {
  HAS_OTHER_MEMBERS: {
    title: "Other workspace members will be removed",
    body: "Every collaborator (owners, admins, editors, viewers) will immediately lose access. Their personal accounts remain but they will no longer belong to this workspace.",
  },
  HAS_ACTIVE_SITES: {
    title: "Active (non-archived) sites will be erased",
    body: "Live sites will go offline immediately. All pages, deployments, settings, and history will be deleted without going through the per-site archive flow.",
  },
  HAS_ARCHIVED_SITES: {
    title: "Archived sites will be erased",
    body: "Sites already in the trash will be permanently deleted along with their preserved snapshots.",
  },
  HAS_ACTIVE_SUBSCRIPTION: {
    title: "Active billing subscription will be left orphaned",
    body: "StayLayer does NOT cancel your Stripe subscription as part of this action. Cancel it from the billing portal first, or the subscription will keep renewing against the provider customer record.",
  },
  HAS_PROVIDER_RESOURCES: {
    title: "Deployment provider resources require ops cleanup",
    body: "Some deployments have provider project / deploy IDs. The shared runtime will not be torn down, but ops will need to release any project-specific provider records using the listed IDs.",
  },
  HAS_CONNECTED_DOMAINS: {
    title: "Connected custom domains will be released",
    body: "Custom hostnames attached to every site in this workspace will be detached. Verification has to be redone if you ever re-attach them elsewhere.",
  },
  HAS_FORM_SUBMISSIONS: {
    title: "Form submissions will be permanently erased",
    body: "Guest inquiries and delivery logs across every site in this workspace will be removed.",
  },
  HAS_ACTIVE_INTEGRATIONS: {
    title: "Search Console / Bing / scheduled audits will be revoked",
    body: "Active integrations will be disconnected and scheduled audits will stop. Reconnecting later requires a fresh OAuth handshake.",
  },
};

interface AckState {
  acknowledgeOtherMembers: boolean;
  acknowledgeActiveSites: boolean;
  acknowledgeArchivedSites: boolean;
  acknowledgeActiveSubscription: boolean;
  acknowledgeProviderResources: boolean;
  acknowledgeConnectedDomains: boolean;
  acknowledgeFormSubmissions: boolean;
  acknowledgeIntegrations: boolean;
}

const EMPTY_ACKS: AckState = {
  acknowledgeOtherMembers: false,
  acknowledgeActiveSites: false,
  acknowledgeArchivedSites: false,
  acknowledgeActiveSubscription: false,
  acknowledgeProviderResources: false,
  acknowledgeConnectedDomains: false,
  acknowledgeFormSubmissions: false,
  acknowledgeIntegrations: false,
};

function ackKeyForRisk(risk: TenantDeletionRiskFlag): keyof AckState {
  switch (risk) {
    case "HAS_OTHER_MEMBERS":
      return "acknowledgeOtherMembers";
    case "HAS_ACTIVE_SITES":
      return "acknowledgeActiveSites";
    case "HAS_ARCHIVED_SITES":
      return "acknowledgeArchivedSites";
    case "HAS_ACTIVE_SUBSCRIPTION":
      return "acknowledgeActiveSubscription";
    case "HAS_PROVIDER_RESOURCES":
      return "acknowledgeProviderResources";
    case "HAS_CONNECTED_DOMAINS":
      return "acknowledgeConnectedDomains";
    case "HAS_FORM_SUBMISSIONS":
      return "acknowledgeFormSubmissions";
    case "HAS_ACTIVE_INTEGRATIONS":
      return "acknowledgeIntegrations";
  }
}

interface WorkspaceDangerZoneProps {
  tenantId: string;
  canManageDangerActions: boolean;
}

export function WorkspaceDangerZone({
  tenantId,
  canManageDangerActions,
}: WorkspaceDangerZoneProps) {
  const { logout, refresh } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [confirmSlug, setConfirmSlug] = useState("");
  const [acks, setAcks] = useState<AckState>(EMPTY_ACKS);
  const [alsoDeleteMyAccount, setAlsoDeleteMyAccount] = useState(false);
  const [accountPassword, setAccountPassword] = useState("");
  // Mirrors `alsoDeleteMyAccount` at the moment the deletion was queued.
  // We can't read it back from the job summary, so we remember the user's
  // intent here for the completion handler.
  const [cascadeIntent, setCascadeIntent] = useState(false);
  const [activeJob, setActiveJob] = useState<TenantDeletionJobRecord | null>(
    null,
  );

  const impactQuery = useQuery({
    queryKey: ["workspace-tenant-deletion-impact", tenantId],
    queryFn: () => getTenantDeletionImpact(tenantId),
    enabled: Boolean(tenantId && canManageDangerActions && expanded),
    retry: false,
  });

  const queueMutation = useMutation({
    mutationFn: (payload: PermanentDeleteTenantPayload) =>
      permanentlyDeleteWorkspace(tenantId, payload),
    onSuccess: (job) => {
      setActiveJob(job);
      toast.success(`Permanent deletion queued for ${job.tenantName}.`);
    },
    onError: (error: unknown) => {
      const message = extractErrorMessage(error);
      toast.error(message);
    },
  });

  // Poll the job until it leaves QUEUED/RUNNING. The endpoint is NOT
  // tenant-scoped, so it keeps working after the cascade destroys the
  // tenant + membership.
  const jobQuery = useQuery({
    queryKey: ["workspace-tenant-deletion-job", activeJob?.id],
    queryFn: () => getTenantDeletionJob(activeJob!.id),
    enabled: Boolean(
      activeJob &&
      (activeJob.status === "QUEUED" || activeJob.status === "RUNNING"),
    ),
    refetchInterval: 3_000,
    retry: (failureCount, error) => {
      // Once the JWT can no longer resolve a tenant context, the API may
      // return 401. Treat that as "the workspace is gone" — we already know
      // it was queued, so stop retrying. The completion handler below logs
      // the user out.
      if (isUnauthorized(error)) return false;
      return failureCount < 3;
    },
  });

  useEffect(() => {
    if (!jobQuery.data) {
      // If polling errored with 401, the tenant is almost certainly gone. When
      // the account is being kept, refresh into the no-workspace session
      // instead of logging out.
      if (
        activeJob &&
        (activeJob.status === "QUEUED" || activeJob.status === "RUNNING") &&
        isUnauthorized(jobQuery.error)
      ) {
        if (cascadeIntent) {
          toast.success("Workspace permanently deleted. Signing you out…");
          void completeLogout(logout);
        } else {
          toast.success("Workspace permanently deleted.");
          void refresh().catch(() => {
            void completeLogout(logout);
          });
        }
      }
      return;
    }
    setActiveJob(jobQuery.data);
    if (jobQuery.data.status === "COMPLETED") {
      if (cascadeIntent) {
        toast.success(
          `${jobQuery.data.tenantName} and your account were permanently deleted.`,
        );
        void completeLogout(logout);
      } else {
        toast.success(`${jobQuery.data.tenantName} was permanently deleted.`);
        // Refresh the session so the router can route the user to /no-workspace
        // (or to a remaining workspace if they belonged to others).
        void refresh().catch(() => {
          // If refresh fails the user is effectively signed out anyway.
          void completeLogout(logout);
        });
      }
    } else if (jobQuery.data.status === "FAILED") {
      toast.error(
        jobQuery.data.errorMessage ||
          `Permanent deletion of ${jobQuery.data.tenantName} failed.`,
      );
    }
  }, [
    jobQuery.data,
    jobQuery.error,
    activeJob,
    logout,
    refresh,
    cascadeIntent,
  ]);

  const impact = impactQuery.data ?? null;
  const missingAcks = useMemo(() => {
    if (!impact) return [] as TenantDeletionRiskFlag[];
    return impact.riskFlags.filter((flag) => !acks[ackKeyForRisk(flag)]);
  }, [impact, acks]);

  const slugMatches = useMemo(() => {
    if (!impact) return false;
    return confirmSlug.trim().toLowerCase() === impact.slug.toLowerCase();
  }, [confirmSlug, impact]);

  if (!canManageDangerActions) return null;

  const jobInFlight =
    activeJob &&
    (activeJob.status === "QUEUED" || activeJob.status === "RUNNING");

  return (
    <div className="rounded-[28px] border border-rose-300 bg-rose-50/40 p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-rose-700">
            Danger zone · Workspace
          </p>
          <h2 className="mt-2 text-2xl font-bold text-slate-950">
            Permanently delete this workspace
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            This erases the workspace, every site under it, every member, every
            form submission, audit log, and integration. Owners must review the
            impact summary, acknowledge each highlighted risk, and type the
            workspace slug exactly. There is no undo.
          </p>
        </div>
        {!expanded ? (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="inline-flex items-center gap-2 rounded-full border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-700 shadow-sm hover:bg-rose-100"
          >
            <Trash2 className="h-4 w-4" />
            Permanently delete workspace…
          </button>
        ) : null}
      </div>

      {expanded ? (
        <div className="mt-6 space-y-5 rounded-2xl border border-rose-200 bg-white p-5">
          {impactQuery.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading workspace
              impact summary…
            </div>
          ) : impactQuery.isError || !impact ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              Could not load workspace impact. Try again.
            </div>
          ) : (
            <>
              <ImpactSummary impact={impact} />

              {impact.riskFlags.length > 0 ? (
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-700">
                    Risk acknowledgements
                  </p>
                  {impact.riskFlags.map((flag) => {
                    const key = ackKeyForRisk(flag);
                    const checked = acks[key];
                    const label = RISK_LABEL[flag];
                    return (
                      <label
                        key={flag}
                        className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3 text-sm ${
                          checked
                            ? "border-emerald-300 bg-emerald-50"
                            : "border-amber-300 bg-amber-50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4"
                          checked={checked}
                          onChange={(e) =>
                            setAcks((prev) => ({
                              ...prev,
                              [key]: e.target.checked,
                            }))
                          }
                        />
                        <span>
                          <span className="block font-semibold text-slate-900">
                            {label.title}
                          </span>
                          <span className="block text-slate-700">
                            {label.body}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              ) : null}

              <div className="space-y-2">
                <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-rose-700">
                  Type the workspace slug to confirm
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  <code className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-sm text-slate-800">
                    {impact.slug}
                  </code>
                  <input
                    type="text"
                    value={confirmSlug}
                    onChange={(e) => setConfirmSlug(e.target.value)}
                    placeholder={impact.slug}
                    className="min-w-[200px] flex-1 rounded-full border border-rose-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-300"
                  />
                </div>
              </div>

              {impact.actorHasOtherMemberships === false ? (
                <div className="space-y-3 rounded-lg border border-rose-200 bg-rose-50/60 p-4">
                  <label className="flex items-start gap-3 text-sm text-rose-900">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded border-rose-300 text-rose-600 focus:ring-rose-500"
                      checked={alsoDeleteMyAccount}
                      onChange={(e) => {
                        setAlsoDeleteMyAccount(e.target.checked);
                        if (!e.target.checked) setAccountPassword("");
                      }}
                    />
                    <span>
                      <span className="block font-semibold">
                        Also permanently delete my account
                      </span>
                      <span className="block text-rose-800">
                        This is your only workspace. Check this box to delete
                        your StayLayer account in the same step. You will be
                        signed out and unable to recover this account.
                      </span>
                    </span>
                  </label>
                  {alsoDeleteMyAccount ? (
                    <div className="space-y-1 pl-7">
                      <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-rose-700">
                        Confirm your password
                      </label>
                      <input
                        type="password"
                        autoComplete="current-password"
                        value={accountPassword}
                        onChange={(e) => setAccountPassword(e.target.value)}
                        placeholder="Current account password"
                        className="w-full max-w-sm rounded-full border border-rose-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-300"
                      />
                    </div>
                  ) : null}
                </div>
              ) : impact.actorHasOtherMemberships === true ? (
                <p className="text-xs text-slate-600">
                  You belong to other workspaces, so your account will be kept.
                  To delete your account, leave or delete the remaining
                  workspaces first, then visit your profile settings.
                </p>
              ) : null}

              {jobInFlight ? <JobProgressBox job={activeJob!} /> : null}

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setExpanded(false);
                    setConfirmSlug("");
                    setAcks(EMPTY_ACKS);
                    setAlsoDeleteMyAccount(false);
                    setAccountPassword("");
                  }}
                  disabled={queueMutation.isPending || Boolean(jobInFlight)}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={
                    queueMutation.isPending ||
                    Boolean(jobInFlight) ||
                    !slugMatches ||
                    missingAcks.length > 0 ||
                    (alsoDeleteMyAccount && accountPassword.length === 0)
                  }
                  onClick={() => {
                    setCascadeIntent(alsoDeleteMyAccount);
                    queueMutation.mutate({
                      confirmTenantSlug: confirmSlug.trim(),
                      ...acks,
                      ...(alsoDeleteMyAccount
                        ? {
                            alsoDeleteMyAccount: true,
                            accountDeletionPassword: accountPassword,
                          }
                        : {}),
                    });
                  }}
                  className="inline-flex items-center gap-2 rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {queueMutation.isPending || jobInFlight ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ShieldAlert className="h-4 w-4" />
                  )}
                  Permanently delete workspace
                </button>
                {missingAcks.length > 0 ? (
                  <span className="inline-flex items-center gap-1 text-xs text-amber-700">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Acknowledge {missingAcks.length} highlighted risk
                    {missingAcks.length === 1 ? "" : "s"} to enable.
                  </span>
                ) : null}
                {!slugMatches && confirmSlug.length > 0 ? (
                  <span className="inline-flex items-center gap-1 text-xs text-rose-700">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Slug does not match.
                  </span>
                ) : null}
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

function ImpactSummary({ impact }: { impact: TenantDeletionImpact }) {
  const counts = impact.counts;
  const rows: Array<{ label: string; value: number }> = [
    { label: "Members", value: counts.members },
    { label: "Active sites", value: counts.activeSites },
    { label: "Archived sites", value: counts.archivedSites },
    { label: "Pages", value: counts.pages },
    { label: "Deployments", value: counts.deployments },
    { label: "Connected domains", value: counts.connectedDomains },
    { label: "Form submissions", value: counts.formSubmissions },
    { label: "Form deliveries", value: counts.formDeliveries },
    { label: "Pending invitations", value: counts.pendingInvitations },
    { label: "Audit logs", value: counts.auditLogs },
    { label: "Translation jobs", value: counts.translationJobs },
    { label: "Notifications", value: counts.notifications },
  ];

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
        What will be erased
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {rows.map((row) => (
          <div
            key={row.label}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2"
          >
            <p className="text-xs uppercase tracking-wide text-slate-500">
              {row.label}
            </p>
            <p className="text-lg font-semibold text-slate-900">
              {row.value.toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      {impact.activeSubscriptions.length > 0 ? (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-semibold">
            Active billing subscription
            {impact.activeSubscriptions.length === 1 ? "" : "s"}
          </p>
          <ul className="mt-1 space-y-1">
            {impact.activeSubscriptions.map((sub) => (
              <li key={sub.id} className="text-xs">
                <code className="rounded bg-white/60 px-1.5 py-0.5">
                  {sub.provider}
                </code>{" "}
                · plan <code>{sub.planKey}</code> · status{" "}
                <code>{sub.status}</code>
                {sub.providerSubscriptionId ? (
                  <>
                    {" "}
                    · provider id <code>{sub.providerSubscriptionId}</code>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs">
            StayLayer will not cancel these subscriptions automatically. Cancel
            them via the provider portal first if needed.
          </p>
        </div>
      ) : null}

      {impact.providerResources.length > 0 ? (
        <details className="rounded-2xl border border-slate-200 bg-white p-3 text-sm text-slate-700">
          <summary className="cursor-pointer font-semibold">
            Deployment provider resources ({impact.providerResources.length})
          </summary>
          <ul className="mt-2 space-y-1 text-xs">
            {impact.providerResources.map((res) => (
              <li key={res.deploymentId}>
                <code>{res.provider ?? "?"}</code> · {res.siteName} · project{" "}
                <code>{res.providerProjectId ?? "—"}</code> · deploy{" "}
                <code>{res.providerDeployId ?? "—"}</code>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

function JobProgressBox({ job }: { job: TenantDeletionJobRecord }) {
  const pct =
    job.totalSteps > 0 ? Math.round((job.progress / job.totalSteps) * 100) : 0;
  return (
    <div className="rounded-2xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900">
      <p className="font-semibold">
        Permanent deletion in progress — do not close this tab
      </p>
      <p className="mt-1 text-xs">
        Step: <code>{job.currentStep ?? "preparing"}</code> ({job.progress}/
        {job.totalSteps} · {pct}%)
      </p>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/70">
        <div
          className="h-full bg-rose-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

async function completeLogout(logout: () => Promise<void> | void) {
  try {
    await logout();
  } catch {
    // ignore — fall through to redirect anyway
  }
  if (typeof window !== "undefined") {
    window.location.href = "/login";
  }
}

function extractErrorMessage(error: unknown): string {
  if (!error) return "Something went wrong.";
  if (typeof error === "object" && error !== null) {
    const maybeAxios = error as {
      response?: { data?: { message?: string; code?: string } };
      message?: string;
    };
    return (
      maybeAxios.response?.data?.message ||
      maybeAxios.message ||
      "Something went wrong."
    );
  }
  return String(error);
}

function isUnauthorized(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const status = (error as { response?: { status?: number } }).response?.status;
  return status === 401 || status === 403;
}
