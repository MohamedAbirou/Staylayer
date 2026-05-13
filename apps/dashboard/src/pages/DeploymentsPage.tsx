import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  RefreshCw,
  Rocket,
  ExternalLink,
  CircleAlert as AlertCircle,
  Clock4,
  Globe,
  KeyRound,
  LockKeyhole,
  Pencil,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Trash2,
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
  deleteDeploymentEnvironmentVariable,
  getDeployments,
  getDeploymentEnvironment,
  provisionDeployment,
  retryDeployment,
  rollbackDeployment,
  type SiteDeployment,
  type SiteDeploymentEnvironmentVariable,
  upsertDeploymentEnvironmentVariable,
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

function isDeploymentInFlight(status: SiteDeployment["status"]) {
  return POLLING_STATUSES.includes(status);
}

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
  const [rollbackTarget, setRollbackTarget] = useState<string | null>(null);
  const [environmentFormOpen, setEnvironmentFormOpen] = useState(false);
  const [editingEnvironmentVariable, setEditingEnvironmentVariable] =
    useState<SiteDeploymentEnvironmentVariable | null>(null);
  const [environmentError, setEnvironmentError] = useState<string | null>(null);
  const [runtimeChangeNotice, setRuntimeChangeNotice] = useState<{
    title: string;
    message: string;
  } | null>(null);
  const [runtimeChangePromptOpen, setRuntimeChangePromptOpen] = useState(false);
  const [environmentDraft, setEnvironmentDraft] = useState({
    key: "",
    value: "",
    type: "encrypted" as "plain" | "encrypted",
    description: "",
  });

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
      return rows.some((deployment) => isDeploymentInFlight(deployment.status))
        ? 5_000
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

  const {
    data: environmentCatalog,
    isError: isEnvironmentError,
    isLoading: isEnvironmentLoading,
  } = useQuery({
    queryKey: ["deployments-page", "environment", siteId],
    queryFn: () => getDeploymentEnvironment(siteId!),
    enabled: !!siteId,
    retry: false,
  });

  const provisionMutation = useMutation({
    mutationFn: () => provisionDeployment(siteId!),
    onSuccess: () => {
      setProvisionConfirmOpen(false);
      setRuntimeChangePromptOpen(false);
      setRuntimeChangeNotice(null);
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

  const rollbackMutation = useMutation({
    mutationFn: (deploymentId: string) =>
      rollbackDeployment(siteId!, deploymentId),
    onSuccess: () => {
      setRollbackTarget(null);
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

  const upsertEnvironmentMutation = useMutation({
    mutationFn: (payload: {
      key: string;
      value: string;
      type: "plain" | "encrypted";
      description?: string;
    }) => upsertDeploymentEnvironmentVariable(siteId!, payload),
    onSuccess: () => {
      setEnvironmentError(null);
      resetEnvironmentForm();
      queueRuntimeChangeNotice(
        latest
          ? "The saved variable will not affect the live site until you run a new deployment."
          : "The saved variable will apply once you provision the first production deployment.",
      );
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["deployments-page", "environment", siteId],
        }),
        queryClient.invalidateQueries({ queryKey: ["deployments", siteId] }),
      ]);
    },
    onError: (error: unknown) => {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response
          ?.data?.message ??
        "Could not save this environment variable. Check the key and value and try again.";
      setEnvironmentError(message);
    },
  });

  const deleteEnvironmentMutation = useMutation({
    mutationFn: (variableId: string) =>
      deleteDeploymentEnvironmentVariable(siteId!, variableId),
    onSuccess: () => {
      queueRuntimeChangeNotice(
        latest
          ? "The live site keeps the previous runtime values until you redeploy after this removal."
          : "The removed variable is saved, and the first production deployment will use the current environment set.",
      );
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["deployments-page", "environment", siteId],
        }),
        queryClient.invalidateQueries({ queryKey: ["deployments", siteId] }),
      ]);
    },
  });

  function resetEnvironmentForm() {
    setEnvironmentFormOpen(false);
    setEditingEnvironmentVariable(null);
    setEnvironmentDraft({
      key: "",
      value: "",
      type: "encrypted",
      description: "",
    });
  }

  function startEnvironmentEdit(variable: SiteDeploymentEnvironmentVariable) {
    setEnvironmentError(null);
    setEditingEnvironmentVariable(variable);
    setEnvironmentFormOpen(true);
    setEnvironmentDraft({
      key: variable.key,
      value: variable.type === "plain" ? (variable.value ?? "") : "",
      type: variable.type,
      description: variable.description ?? "",
    });
  }

  function startEnvironmentCreate() {
    setEnvironmentError(null);
    setEditingEnvironmentVariable(null);
    setEnvironmentFormOpen(true);
    setEnvironmentDraft({
      key: "",
      value: "",
      type: "encrypted",
      description: "",
    });
  }

  function submitEnvironmentVariable() {
    const key = environmentDraft.key.trim().toUpperCase();
    const value = environmentDraft.value;

    if (!key || !value) {
      setEnvironmentError("Key and value are required.");
      return;
    }

    upsertEnvironmentMutation.mutate({
      key,
      value,
      type: environmentDraft.type,
      description: environmentDraft.description.trim() || undefined,
    });
  }

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
  const customerEnvironment = environmentCatalog?.customerEditable ?? [];
  const operatorManagedEnvironment = environmentCatalog?.operatorManaged ?? [];
  const activePrimaryDomain = domains.find(
    (domain) => domain.isPrimary && domain.status === "ACTIVE",
  );
  const pendingPrimaryDomain = domains.find((domain) => domain.isPrimary);
  const providerTarget = latest?.providerUrl ?? latest?.url ?? null;
  const billingBlocked = billingPlan?.actions.publishingBlocked ?? false;
  const deploymentBusy = Boolean(latest && isDeploymentInFlight(latest.status));
  const readinessTone =
    latest?.status === "FAILED"
      ? "danger"
      : billingBlocked
        ? "warning"
        : activePrimaryDomain
          ? "success"
          : "warning";

  function queueRuntimeChangeNotice(message: string) {
    setRuntimeChangeNotice({
      title: latest
        ? "Runtime changes are waiting for redeploy"
        : "Runtime changes are waiting for the first deployment",
      message,
    });

    if (!deploymentBusy && !billingBlocked && canManageDeployments) {
      setRuntimeChangePromptOpen(true);
    } else {
      setRuntimeChangePromptOpen(false);
    }
  }

  function startRuntimeDeployment() {
    if (deploymentBusy || billingBlocked || !canManageDeployments) {
      return;
    }

    provisionMutation.mutate();
  }

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
            disabled={provisionMutation.isPending || deploymentBusy}
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

      {runtimeChangeNotice ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-amber-900">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
              <div>
                <p className="text-sm font-semibold">
                  {runtimeChangeNotice.title}
                </p>
                <p className="mt-1 text-sm text-amber-800">
                  {runtimeChangeNotice.message}
                </p>
                <p className="mt-2 text-xs text-amber-700">
                  {deploymentBusy
                    ? "A deployment is already running. These runtime changes will apply after you start the next one."
                    : billingBlocked
                      ? "Billing currently blocks new deployments, so the live site will keep the previous runtime values until publishing access is restored."
                      : latest
                        ? "The live site is still running the previous deployment until you redeploy."
                        : "These runtime values will be picked up by the first production deployment."}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 lg:shrink-0">
              <button
                onClick={() => setRuntimeChangeNotice(null)}
                className="rounded-lg border border-amber-200 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-white"
              >
                Dismiss
              </button>
              {canManageDeployments ? (
                <button
                  onClick={() => setRuntimeChangePromptOpen(true)}
                  disabled={
                    deploymentBusy ||
                    billingBlocked ||
                    provisionMutation.isPending
                  }
                  className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Rocket className="h-3.5 w-3.5" />
                  {latest ? "Redeploy now" : "Provision now"}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

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
            <DeploymentAccessLink
              href={latest.url}
              label="Open live site"
              disabled={deploymentBusy}
            />
          ) : null}
          {latest?.providerUrl && latest.providerUrl !== latest.url ? (
            <DeploymentAccessLink
              href={latest.providerUrl}
              label="Open provider target"
              disabled={deploymentBusy}
              tone="secondary"
            />
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
            {deployments.map((deployment) =>
              (() => {
                const accessDisabled = isDeploymentInFlight(deployment.status);

                return (
                  <div
                    key={deployment.id}
                    className="flex flex-col justify-between gap-4 px-6 py-5"
                  >
                    <div className="flex items-center justify-between">
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
                      </div>

                      <div className="flex items-center gap-2">
                        {deployment.url ? (
                          <DeploymentAccessLink
                            href={deployment.url}
                            label="Open live site"
                            disabled={accessDisabled}
                            compact
                          />
                        ) : null}
                        {deployment.providerUrl &&
                        deployment.providerUrl !== deployment.url ? (
                          <DeploymentAccessLink
                            href={deployment.providerUrl}
                            label="Provider target"
                            disabled={accessDisabled}
                            compact
                            tone="secondary"
                          />
                        ) : null}
                        {canManageDeployments &&
                        deployment.status === "FAILED" ? (
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
                        {canManageDeployments &&
                        deployment.status === "LIVE" &&
                        deployment.id !== deployments[0]?.id ? (
                          <button
                            onClick={() => setRollbackTarget(deployment.id)}
                            disabled={
                              rollbackMutation.isPending || deploymentBusy
                            }
                            className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-60"
                          >
                            {rollbackMutation.isPending ? (
                              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Clock4 className="h-3.5 w-3.5" />
                            )}
                            Rollback to this
                          </button>
                        ) : null}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <DeploymentTimeline phases={deployment.timeline} />
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
                      <DeploymentLogs logs={deployment.recentLogs} />
                    </div>
                  </div>
                );
              })(),
            )}
          </div>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">
                Customer Environment
              </p>
              <h2 className="mt-2 text-lg font-semibold text-gray-900">
                Customer-editable variables
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Store site-specific runtime variables here. These values are
                encrypted at rest and synced during deployment, so customers do
                not need direct provider access.
              </p>
            </div>
            {canManageDeployments ? (
              <button
                onClick={startEnvironmentCreate}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                <Plus className="h-3.5 w-3.5" />
                Add variable
              </button>
            ) : null}
          </div>

          {!canManageDeployments ? (
            <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-700">
              Only site admins can add, replace, or remove customer-managed
              deployment variables.
            </div>
          ) : null}

          {environmentFormOpen ? (
            <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">
                    Key
                  </span>
                  <input
                    type="text"
                    value={environmentDraft.key}
                    onChange={(event) =>
                      setEnvironmentDraft((current) => ({
                        ...current,
                        key: event.target.value.toUpperCase(),
                      }))
                    }
                    placeholder="NEXT_PUBLIC_BOOKING_WIDGET_ID"
                    className="w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">
                    Type
                  </span>
                  <select
                    value={environmentDraft.type}
                    onChange={(event) =>
                      setEnvironmentDraft((current) => ({
                        ...current,
                        type: event.target.value as "plain" | "encrypted",
                      }))
                    }
                    className="w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
                  >
                    <option value="encrypted">Secret</option>
                    <option value="plain">Plain text</option>
                  </select>
                </label>
                <label className="space-y-1 md:col-span-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">
                    Value
                  </span>
                  <textarea
                    value={environmentDraft.value}
                    onChange={(event) =>
                      setEnvironmentDraft((current) => ({
                        ...current,
                        value: event.target.value,
                      }))
                    }
                    rows={
                      editingEnvironmentVariable?.type === "encrypted" ? 4 : 3
                    }
                    placeholder={
                      editingEnvironmentVariable?.type === "encrypted"
                        ? "Enter a new value to replace the current secret"
                        : "Enter the value to sync during deployment"
                    }
                    className="w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
                  />
                </label>
                <label className="space-y-1 md:col-span-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">
                    Description
                  </span>
                  <input
                    type="text"
                    value={environmentDraft.description}
                    onChange={(event) =>
                      setEnvironmentDraft((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                    placeholder="What this variable is used for"
                    className="w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
                  />
                </label>
              </div>
              {environmentError ? (
                <p className="mt-3 text-xs text-red-600">{environmentError}</p>
              ) : null}
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  onClick={submitEnvironmentVariable}
                  disabled={upsertEnvironmentMutation.isPending}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {upsertEnvironmentMutation.isPending ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : null}
                  {editingEnvironmentVariable
                    ? "Save changes"
                    : "Save variable"}
                </button>
                <button
                  onClick={resetEnvironmentForm}
                  className="rounded-lg border border-blue-200 px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-white"
                >
                  Cancel
                </button>
                <p className="text-xs text-gray-500">
                  Reserved platform keys such as SITE_ID or REVALIDATE_SECRET
                  cannot be overridden here.
                </p>
              </div>
            </div>
          ) : null}

          {isEnvironmentError ? (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
              Could not load the deployment environment catalog.
            </div>
          ) : null}

          <div className="mt-4 space-y-3">
            {isEnvironmentLoading ? (
              <div className="flex items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 px-4 py-4 text-sm text-gray-500">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Loading customer-managed variables…
              </div>
            ) : customerEnvironment.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center">
                <KeyRound className="mx-auto h-5 w-5 text-gray-300" />
                <p className="mt-2 text-sm font-semibold text-gray-800">
                  No customer-managed variables yet
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Add site-specific keys here instead of editing provider envs
                  directly.
                </p>
              </div>
            ) : (
              customerEnvironment.map((variable) => (
                <EnvironmentVariableRow
                  key={variable.id}
                  variable={variable}
                  canManage={canManageDeployments}
                  onEdit={() => startEnvironmentEdit(variable)}
                  onDelete={() => deleteEnvironmentMutation.mutate(variable.id)}
                  isDeleting={deleteEnvironmentMutation.isPending}
                />
              ))
            )}
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">
              Operator Environment
            </p>
            <h2 className="mt-2 text-lg font-semibold text-gray-900">
              Platform-managed variables
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              These keys are generated and synced by the platform on every
              deployment. Customers can inspect them here, but they should not
              be changed at the provider.
            </p>
          </div>
          <div className="mt-4 space-y-3 overflow-auto max-h-100">
            {operatorManagedEnvironment.map((variable) => (
              <EnvironmentVariableRow
                key={variable.id}
                variable={variable}
                canManage={false}
                onEdit={() => undefined}
                onDelete={() => undefined}
                isDeleting={false}
              />
            ))}
          </div>
        </section>
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

      <ConfirmDialog
        open={rollbackTarget !== null}
        title="Rollback to this deployment?"
        message="This will revert the live site to the state of the selected previous deployment. The rollback verifies the target is still available at the provider before activating it."
        confirmLabel="Confirm rollback"
        isPending={rollbackMutation.isPending}
        onConfirm={() =>
          rollbackTarget && rollbackMutation.mutate(rollbackTarget)
        }
        onCancel={() => setRollbackTarget(null)}
      />

      <ConfirmDialog
        open={runtimeChangePromptOpen}
        title={
          latest
            ? "Redeploy to apply runtime changes?"
            : "Provision deployment to apply runtime changes?"
        }
        message={
          latest
            ? "Environment variable changes are saved, but the live site will not use them until you run a new deployment. Start that deployment now, or do it later from this page."
            : "Environment variable changes are saved, but the site has not been provisioned yet. Start the first production deployment now, or do it later from this page."
        }
        confirmLabel={latest ? "Redeploy now" : "Provision now"}
        cancelLabel="Do it later"
        isPending={provisionMutation.isPending}
        onConfirm={startRuntimeDeployment}
        onCancel={() => setRuntimeChangePromptOpen(false)}
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

function EnvironmentVariableRow({
  variable,
  canManage,
  onEdit,
  onDelete,
  isDeleting,
}: {
  variable: SiteDeploymentEnvironmentVariable;
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-gray-900">
              {variable.key}
            </p>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${
                variable.type === "encrypted"
                  ? "bg-amber-100 text-amber-800"
                  : "bg-sky-100 text-sky-700"
              }`}
            >
              {variable.type === "encrypted" ? "Secret" : "Plain"}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${
                variable.source === "operator"
                  ? "bg-slate-200 text-slate-700"
                  : "bg-emerald-100 text-emerald-700"
              }`}
            >
              {variable.source === "operator" ? "Managed" : "Customer"}
            </span>
          </div>
          {variable.description ? (
            <p className="mt-1 text-xs text-gray-500">{variable.description}</p>
          ) : null}
          <div className="mt-3 rounded-lg border border-white bg-white px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">
              Current value
            </p>
            <p className="mt-1 break-all text-sm text-gray-700">
              {variable.valuePreview ?? "Stored securely"}
            </p>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-gray-400">
            <span>Targets: {variable.targets.join(", ")}</span>
            {variable.updatedAt ? (
              <span title={formatDate(variable.updatedAt)}>
                Updated {formatRelativeTime(variable.updatedAt)}
              </span>
            ) : (
              <span>Synced automatically on deployment</span>
            )}
          </div>
        </div>
        {canManage ? (
          <div className="flex items-center gap-1">
            <button
              onClick={onEdit}
              className="rounded-lg p-2 text-gray-400 hover:bg-white hover:text-gray-700"
              title="Edit variable"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              onClick={onDelete}
              disabled={isDeleting}
              className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60"
              title="Delete variable"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-500">
            {variable.type === "encrypted" ? (
              <span className="inline-flex items-center gap-1">
                <LockKeyhole className="h-3.5 w-3.5" />
                Platform secret
              </span>
            ) : (
              <span>Read only</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function DeploymentTimeline({
  phases,
}: {
  phases: SiteDeployment["timeline"];
}) {
  if (phases.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">
          Deployment phases
        </p>
        <p className="text-xs text-gray-400">
          {phases.filter((phase) => phase.status === "completed").length}/
          {phases.length} complete
        </p>
      </div>
      <div className="mt-3 space-y-3">
        {phases.map((phase) => {
          const tone = getTimelinePhaseTone(phase.status);

          return (
            <div
              key={phase.key}
              className="grid gap-2 rounded-lg border border-white bg-white/80 px-3 py-3 sm:grid-cols-[auto_1fr_auto] sm:items-start"
            >
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${tone.dot}`} />
                <span className={`text-xs font-semibold ${tone.label}`}>
                  {formatTimelineStatus(phase.status)}
                </span>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  {phase.label}
                </p>
                {phase.summary ? (
                  <p className="mt-1 text-xs text-gray-500">{phase.summary}</p>
                ) : null}
              </div>
              <div className="text-xs text-gray-400 sm:text-right">
                {phase.completedAt ? (
                  <span title={formatDate(phase.completedAt)}>
                    Finished {formatRelativeTime(phase.completedAt)}
                  </span>
                ) : phase.startedAt ? (
                  <span title={formatDate(phase.startedAt)}>
                    Started {formatRelativeTime(phase.startedAt)}
                  </span>
                ) : (
                  <span>{formatTimelineTimestampStatus(phase.status)}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DeploymentLogs({ logs }: { logs: SiteDeployment["recentLogs"] }) {
  return (
    <details
      className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-gray-950 text-gray-100"
      open
    >
      <summary className="cursor-pointer px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-gray-300">
        Recent provider logs
      </summary>
      <div className="max-h-72 space-y-2 overflow-auto border-t border-gray-800 px-4 py-3">
        {logs.length === 0 ? (
          <p className="text-xs text-gray-500">No recent logs available.</p>
        ) : (
          logs.map((entry) => (
            <div
              key={entry.id}
              className="grid gap-1 text-xs sm:grid-cols-[72px_88px_1fr] sm:items-start"
            >
              <span className="font-mono text-gray-500">
                {formatLogTime(entry.createdAt)}
              </span>
              <span className={`font-semibold ${getLogTone(entry.level)}`}>
                {entry.level.toUpperCase()}
              </span>
              <span className="font-mono text-gray-200">{entry.text}</span>
            </div>
          ))
        )}
      </div>
    </details>
  );
}

function DeploymentAccessLink({
  href,
  label,
  disabled,
  tone = "primary",
  compact = false,
}: {
  href: string;
  label: string;
  disabled: boolean;
  tone?: "primary" | "secondary";
  compact?: boolean;
}) {
  const enabledClassName = compact
    ? "rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium hover:bg-gray-50"
    : "inline-flex items-center gap-1 font-medium";
  const toneClassName =
    tone === "secondary"
      ? compact
        ? " text-gray-700"
        : " text-gray-600 hover:text-gray-800"
      : compact
        ? " text-gray-700"
        : " text-blue-600 hover:text-blue-800";

  if (disabled) {
    return (
      <span
        className={`${enabledClassName}${tone === "secondary" || compact ? " text-gray-400" : " text-blue-300"} cursor-not-allowed border-gray-100 bg-gray-50`}
        title="Available after the deployment finishes"
      >
        {compact ? null : <ExternalLink className="h-4 w-4" />}
        {label}
      </span>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={`${enabledClassName}${toneClassName}`}
    >
      {compact ? null : <ExternalLink className="h-4 w-4" />}
      {label}
    </a>
  );
}

function getTimelinePhaseTone(
  status: SiteDeployment["timeline"][number]["status"],
) {
  switch (status) {
    case "completed":
      return {
        dot: "bg-emerald-500",
        label: "text-emerald-700",
      };
    case "active":
      return {
        dot: "bg-blue-500",
        label: "text-blue-700",
      };
    case "failed":
      return {
        dot: "bg-red-500",
        label: "text-red-700",
      };
    default:
      return {
        dot: "bg-gray-300",
        label: "text-gray-500",
      };
  }
}

function formatTimelineStatus(
  status: SiteDeployment["timeline"][number]["status"],
) {
  switch (status) {
    case "completed":
      return "Complete";
    case "active":
      return "Running";
    case "failed":
      return "Failed";
    default:
      return "Pending";
  }
}

function formatTimelineTimestampStatus(
  status: SiteDeployment["timeline"][number]["status"],
) {
  switch (status) {
    case "completed":
      return "Complete";
    case "active":
      return "In progress";
    case "failed":
      return "Failed";
    default:
      return "Waiting";
  }
}

function getLogTone(level: SiteDeployment["recentLogs"][number]["level"]) {
  switch (level) {
    case "error":
      return "text-red-300";
    case "warning":
      return "text-amber-300";
    default:
      return "text-sky-300";
  }
}

function formatLogTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
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
