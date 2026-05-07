import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  RefreshCw,
  Rocket,
  ExternalLink,
  AlertCircle,
  Clock4,
  Globe,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import {
  BILLING_MEMBERSHIP_ROLES,
  hasActiveSite,
  hasMembershipRole,
} from "../auth/access";
import { useAuth } from "../auth/useAuth";
import { getBillingPlan } from "../api/billing";
import { getDomains } from "../api/domains";
import {
  getDeployments,
  provisionDeployment,
  retryDeployment,
  type SiteDeployment,
} from "../api/deployments";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { DeploymentStatusBadge } from "../components/DeploymentStatusBadge";
import { formatDate, formatRelativeTime } from "../lib/formatDate";
import { useState } from "react";

const DEPLOYMENT_ADMIN_ROLES = ["OWNER", "ADMIN"] as const;
const POLLING_STATUSES: SiteDeployment["status"][] = [
  "CREATING_PROJECT",
  "SYNCING_ENV",
  "DEPLOYING",
  "RETRYING",
];

export default function DeploymentsPage() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const siteId = session?.activeSite?.id ?? null;
  const tenantId = session?.activeTenant?.id ?? null;
  const canManageDeployments = hasMembershipRole(
    session,
    DEPLOYMENT_ADMIN_ROLES,
  );
  const canViewBilling = hasMembershipRole(session, BILLING_MEMBERSHIP_ROLES);

  const [provisionConfirmOpen, setProvisionConfirmOpen] = useState(false);
  const [retryTarget, setRetryTarget] = useState<string | null>(null);

  const {
    data: deployments = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["deployments", siteId],
    queryFn: () => getDeployments(siteId!),
    enabled: !!siteId,
    refetchInterval: (query) => {
      const rows = query.state.data ?? [];
      return rows.some((deployment) =>
        POLLING_STATUSES.includes(deployment.status),
      )
        ? 10_000
        : false;
    },
    retry: false,
  });

  const { data: domains = [] } = useQuery({
    queryKey: ["deployments-page", "domains", siteId],
    queryFn: () => getDomains(siteId!),
    enabled: !!siteId,
    retry: false,
  });

  const { data: billingPlan } = useQuery({
    queryKey: ["deployments-page", "billing", tenantId],
    queryFn: () => getBillingPlan(tenantId!),
    enabled: Boolean(tenantId && canViewBilling),
    retry: false,
  });

  const provisionMutation = useMutation({
    mutationFn: () => provisionDeployment(siteId!),
    onSuccess: () => {
      setProvisionConfirmOpen(false);
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["deployments", siteId] }),
        queryClient.invalidateQueries({
          queryKey: ["deployments-page", "domains", siteId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["dashboard-home", "latest-deployment", siteId],
        }),
      ]);
    },
  });

  const retryMutation = useMutation({
    mutationFn: (deploymentId: string) =>
      retryDeployment(siteId!, deploymentId),
    onSuccess: () => {
      setRetryTarget(null);
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["deployments", siteId] }),
        queryClient.invalidateQueries({
          queryKey: ["deployments-page", "domains", siteId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["dashboard-home", "latest-deployment", siteId],
        }),
      ]);
    },
  });

  if (!hasActiveSite(session)) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900">Deployments</h1>
        <p className="mt-2 text-sm text-gray-600">
          Select a site to view deployment history and go-live status.
        </p>
      </div>
    );
  }

  const latest = deployments[0] ?? null;
  const activePrimaryDomain = domains.find(
    (domain) => domain.isPrimary && domain.status === "ACTIVE",
  );
  const pendingPrimaryDomain = domains.find((domain) => domain.isPrimary);
  const providerTarget = latest?.providerUrl ?? latest?.url ?? null;
  const billingBlocked = billingPlan?.actions.publishingBlocked ?? false;
  const readinessTone =
    latest?.status === "FAILED"
      ? "danger"
      : billingBlocked
        ? "warning"
        : activePrimaryDomain
          ? "success"
          : "warning";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Deployments</h1>
          <p className="mt-1 text-sm text-gray-500">
            Provision, retry, and inspect dedicated site deployments without
            leaving the customer workspace.
          </p>
        </div>
        {canManageDeployments ? (
          <button
            onClick={() => setProvisionConfirmOpen(true)}
            disabled={
              provisionMutation.isPending ||
              Boolean(latest && POLLING_STATUSES.includes(latest.status))
            }
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {provisionMutation.isPending ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Rocket className="h-4 w-4" />
            )}
            Provision production deployment
          </button>
        ) : null}
      </div>

      {!canManageDeployments ? (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-700">
          You can inspect deployment state here, but only site admins can
          provision or retry deployments.
        </div>
      ) : null}

      <ReadinessBanner
        tone={readinessTone}
        latest={latest}
        activePrimaryDomain={activePrimaryDomain?.hostname ?? null}
        pendingPrimaryDomain={pendingPrimaryDomain?.hostname ?? null}
        providerTarget={providerTarget}
        billingBlocked={billingBlocked}
      />

      {isError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Could not load deployment history. Refresh the page or contact
          support.
        </div>
      ) : null}

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
              Current live routing
            </p>
            <h2 className="mt-2 text-lg font-semibold text-gray-900">
              {latest ? "Latest deployment" : "No deployments yet"}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {latest
                ? describeDeployment(latest)
                : "Provision the first dedicated deployment to generate a live site URL."}
            </p>
          </div>
          {latest ? <DeploymentStatusBadge status={latest.status} /> : null}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
          {latest?.url ? (
            <a
              href={latest.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-medium text-blue-600 hover:text-blue-800"
            >
              <ExternalLink className="h-4 w-4" />
              Open live site
            </a>
          ) : null}
          {latest?.providerUrl && latest.providerUrl !== latest.url ? (
            <a
              href={latest.providerUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-medium text-gray-600 hover:text-gray-800"
            >
              <ExternalLink className="h-4 w-4" />
              Open provider target
            </a>
          ) : null}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <SignalTile
            label="Production domain"
            value={
              activePrimaryDomain?.hostname ??
              pendingPrimaryDomain?.hostname ??
              "Not connected"
            }
            detail={
              activePrimaryDomain
                ? "Verified and serving live traffic"
                : pendingPrimaryDomain
                  ? "Connected but not verified yet"
                  : "Connect a primary domain before customer launch"
            }
          />
          <SignalTile
            label="Public URL"
            value={latest?.url ?? "Not live yet"}
            detail={
              latest?.providerUrl && latest.providerUrl !== latest.url
                ? `Provider target ${latest.providerUrl}`
                : "This is the customer-facing address"
            }
          />
          <SignalTile
            label="Billing gate"
            value={billingBlocked ? "Publishing blocked" : "Publishing allowed"}
            detail={
              billingBlocked
                ? "Resolve billing before promoting this site"
                : "Billing is not blocking go-live"
            }
          />
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-sm text-gray-400">
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            Loading deployment history…
          </div>
        ) : deployments.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-50">
              <Rocket className="h-7 w-7 text-gray-300" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">
                No deployment history yet
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Provision a deployment to create the dedicated customer runtime.
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {deployments.map((deployment) => (
              <div
                key={deployment.id}
                className="flex items-start justify-between gap-4 px-6 py-5"
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <DeploymentStatusBadge status={deployment.status} />
                    <span
                      className="text-xs text-gray-400"
                      title={formatDate(deployment.createdAt)}
                    >
                      Created {formatRelativeTime(deployment.createdAt)}
                    </span>
                    <span
                      className="text-xs text-gray-400"
                      title={formatDate(deployment.updatedAt)}
                    >
                      Updated {formatRelativeTime(deployment.updatedAt)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700">
                    {describeDeployment(deployment)}
                  </p>
                  {deployment.errorMessage ? (
                    <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{deployment.errorMessage}</span>
                    </div>
                  ) : null}
                  {deployment.status === "FAILED" && (
                    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                      <div>
                        <span className="font-semibold">Next step: </span>
                        {getFailedNextAction(deployment.errorMessage)}
                      </div>
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                    {deployment.providerDeployId ? (
                      <span>
                        Provider deployment: {deployment.providerDeployId}
                      </span>
                    ) : null}
                    {deployment.url ? (
                      <span>Public URL: {deployment.url}</span>
                    ) : null}
                    {deployment.providerUrl &&
                    deployment.providerUrl !== deployment.url ? (
                      <span>Provider URL: {deployment.providerUrl}</span>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {deployment.url ? (
                    <a
                      href={deployment.url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Open live site
                    </a>
                  ) : null}
                  {deployment.providerUrl &&
                  deployment.providerUrl !== deployment.url ? (
                    <a
                      href={deployment.providerUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Provider target
                    </a>
                  ) : null}
                  {canManageDeployments && deployment.status === "FAILED" ? (
                    <button
                      onClick={() => setRetryTarget(deployment.id)}
                      disabled={retryMutation.isPending}
                      className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                    >
                      {retryMutation.isPending ? (
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Clock4 className="h-3.5 w-3.5" />
                      )}
                      Retry
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={provisionConfirmOpen}
        title="Provision production deployment?"
        message="This starts a live hosting build for the selected site, syncs deployment environment variables, and may update the public routing target used for launch."
        confirmLabel="Start provisioning"
        isPending={provisionMutation.isPending}
        onConfirm={() => provisionMutation.mutate()}
        onCancel={() => setProvisionConfirmOpen(false)}
      />

      <ConfirmDialog
        open={retryTarget !== null}
        title="Retry failed deployment?"
        message="This queues another live deployment attempt for the site. Retry only after checking the current failure reason and domain or environment setup."
        confirmLabel="Retry deployment"
        isPending={retryMutation.isPending}
        onConfirm={() => retryTarget && retryMutation.mutate(retryTarget)}
        onCancel={() => setRetryTarget(null)}
      />
    </div>
  );
}

function ReadinessBanner({
  tone,
  latest,
  activePrimaryDomain,
  pendingPrimaryDomain,
  providerTarget,
  billingBlocked,
}: {
  tone: "success" | "warning" | "danger";
  latest: SiteDeployment | null;
  activePrimaryDomain: string | null;
  pendingPrimaryDomain: string | null;
  providerTarget: string | null;
  billingBlocked: boolean;
}) {
  const styles = {
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    danger: "border-red-200 bg-red-50 text-red-900",
  };
  const Icon =
    tone === "success" ? ShieldCheck : tone === "danger" ? ShieldAlert : Globe;

  let message =
    "Provision the first production deployment before routing guests to this site.";
  if (latest?.status === "FAILED") {
    message =
      "The latest deployment failed. Review the provider error and retry only after correcting the root cause.";
  } else if (billingBlocked) {
    message =
      "The site can deploy, but billing is currently blocking safe publishing and launch.";
  } else if (activePrimaryDomain) {
    message = `Production traffic is routed through ${activePrimaryDomain}. Keep the provider target bookmarked for diagnostics only.`;
  } else if (pendingPrimaryDomain && providerTarget) {
    message = `The domain ${pendingPrimaryDomain} is connected. Point DNS at the current provider target and wait for verification and SSL.`;
  } else if (providerTarget) {
    message =
      "The deployment target is live, but you should still connect and verify a primary custom domain before launch.";
  }

  return (
    <div className={`rounded-xl border px-4 py-4 ${styles[tone]}`}>
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="text-sm font-semibold">Go-live readiness</p>
          <p className="mt-1 text-sm opacity-90">{message}</p>
        </div>
      </div>
    </div>
  );
}

function SignalTile({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">
        {label}
      </p>
      <p className="mt-2 break-all text-sm font-semibold text-gray-900">
        {value}
      </p>
      <p className="mt-2 text-xs text-gray-500">{detail}</p>
    </div>
  );
}

function describeDeployment(deployment: SiteDeployment) {
  switch (deployment.status) {
    case "LIVE":
      return deployment.url
        ? deployment.providerUrl && deployment.providerUrl !== deployment.url
          ? `The deployment is live for customers at ${deployment.url}. The provider target remains ${deployment.providerUrl} for diagnostics.`
          : `The deployment is live and serving traffic at ${deployment.url}.`
        : "The deployment is live and serving traffic.";
    case "PENDING":
      return "Provisioning has been queued and will start shortly.";
    case "CREATING_PROJECT":
      return "Creating the deployment project at your hosting provider. This usually takes under a minute.";
    case "SYNCING_ENV":
      return "Syncing site environment variables to the deployment project.";
    case "DEPLOYING":
      return "Building and deploying your site. This may take 1–3 minutes.";
    case "RETRYING":
      return "Retrying the previous deployment step automatically.";
    case "FAILED":
      return deployment.errorMessage
        ? `The deployment failed: ${deployment.errorMessage}`
        : "The deployment failed before going live.";
    default:
      return "This deployment is still in progress. Polling will continue automatically.";
  }
}

function getFailedNextAction(errorMessage?: string | null): string | null {
  if (!errorMessage)
    return "Use the Retry button to attempt provisioning again.";
  const msg = errorMessage.toLowerCase();
  if (msg.includes("domain") || msg.includes("dns"))
    return "Check your domain's DNS records in the Domains tab, then retry.";
  if (
    msg.includes("env") ||
    msg.includes("environment") ||
    msg.includes("variable")
  )
    return "Verify your hosting provider environment variables are correct, then retry.";
  if (msg.includes("build") || msg.includes("compile"))
    return "A build error occurred at the provider. Check provider logs and retry.";
  if (msg.includes("timeout") || msg.includes("timed out"))
    return "The deployment timed out. Retry — transient timeouts usually resolve on their own.";
  return "Use the Retry button to attempt provisioning again.";
}
