import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Rocket,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  KeyRound,
  PencilLine,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../../auth/useAuth";
import { hasPlatformRole } from "../../auth/access";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { formatDate, formatRelativeTime } from "../../lib/formatDate";
import {
  deleteAdminDeploymentEnvironmentVariable,
  getAdminDeploymentEnvironment,
  getAdminDeployments,
  retryDeployment,
  upsertAdminDeploymentEnvironmentVariable,
} from "../../api/admin";
import type {
  AdminDeployment,
  AdminDeploymentEnvironmentCatalog,
  AdminDeploymentEnvironmentVariable,
  AdminDeployStatus,
} from "../../api/admin";

const STATUS_LABELS: Record<AdminDeployStatus, string> = {
  PENDING: "Pending",
  BUILDING: "Building",
  DEPLOYED: "Deployed",
  FAILED: "Failed",
};

const STATUS_COLORS: Record<AdminDeployStatus, string> = {
  PENDING: "bg-blue-100 text-blue-700",
  BUILDING: "bg-yellow-100 text-yellow-800",
  DEPLOYED: "bg-green-100 text-green-700",
  FAILED: "bg-red-100 text-red-700",
};

function StatusIcon({ status }: { status: AdminDeployStatus }) {
  if (status === "DEPLOYED") return <CheckCircle2 className="h-3 w-3" />;
  if (status === "FAILED") return <XCircle className="h-3 w-3" />;
  if (status === "BUILDING")
    return <Loader2 className="h-3 w-3 animate-spin" />;
  return <Clock className="h-3 w-3" />;
}

type EnvironmentEditorState = {
  key: string;
  value: string;
  type: "plain" | "encrypted";
  description: string;
};

const EMPTY_ENVIRONMENT_EDITOR: EnvironmentEditorState = {
  key: "",
  value: "",
  type: "plain",
  description: "",
};

export default function AdminDeploymentsPage() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const canRetry = hasPlatformRole(session, [
    "PLATFORM_OWNER",
    "SUPPORT_ADMIN",
  ]);
  const canManageEnvironment = hasPlatformRole(session, [
    "PLATFORM_OWNER",
    "SUPPORT_ADMIN",
  ]);
  const [statusFilter, setStatusFilter] = useState<AdminDeployStatus | "ALL">(
    "ALL",
  );
  const [retryTarget, setRetryTarget] = useState<string | null>(null);
  const [selectedSite, setSelectedSite] = useState<{
    siteId: string;
    siteName: string;
  } | null>(null);
  const [environmentEditor, setEnvironmentEditor] =
    useState<EnvironmentEditorState>(EMPTY_ENVIRONMENT_EDITOR);
  const [editingEnvironmentVariable, setEditingEnvironmentVariable] =
    useState<AdminDeploymentEnvironmentVariable | null>(null);
  const [environmentDeleteTarget, setEnvironmentDeleteTarget] =
    useState<AdminDeploymentEnvironmentVariable | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "deployments", statusFilter],
    queryFn: () =>
      getAdminDeployments(
        statusFilter !== "ALL" ? { status: statusFilter } : undefined,
      ),
    retry: false,
  });

  const {
    data: environmentCatalog,
    isLoading: isEnvironmentLoading,
    isError: isEnvironmentError,
  } = useQuery({
    queryKey: ["admin", "deployments", "environment", selectedSite?.siteId],
    queryFn: () => getAdminDeploymentEnvironment(selectedSite!.siteId),
    enabled: !!selectedSite,
    retry: false,
  });

  const { mutate: doRetry, isPending: retryPending } = useMutation({
    mutationFn: (id: string) => retryDeployment(id),
    onSuccess: () => {
      toast.success("Deployment retry queued.");
      setRetryTarget(null);
      void queryClient.invalidateQueries({
        queryKey: ["admin", "deployments"],
      });
    },
    onError: () => {
      toast.error("Retry failed. Check console for details.");
    },
  });

  const { mutate: upsertEnvironmentVariable, isPending: upsertPending } =
    useMutation({
      mutationFn: (payload: EnvironmentEditorState) => {
        if (!selectedSite) {
          throw new Error("No site selected");
        }

        return upsertAdminDeploymentEnvironmentVariable(selectedSite.siteId, {
          key: payload.key.trim().toUpperCase(),
          value: payload.value,
          type: payload.type,
          description: payload.description.trim() || undefined,
        });
      },
      onSuccess: () => {
        toast.success(
          editingEnvironmentVariable
            ? "Environment variable updated."
            : "Environment variable saved.",
        );
        resetEnvironmentEditor();
        void queryClient.invalidateQueries({
          queryKey: [
            "admin",
            "deployments",
            "environment",
            selectedSite?.siteId,
          ],
        });
      },
      onError: () => {
        toast.error("Could not save environment variable.");
      },
    });

  const { mutate: removeEnvironmentVariable, isPending: removePending } =
    useMutation({
      mutationFn: (variableId: string) => {
        if (!selectedSite) {
          throw new Error("No site selected");
        }

        return deleteAdminDeploymentEnvironmentVariable(
          selectedSite.siteId,
          variableId,
        );
      },
      onSuccess: () => {
        toast.success("Environment variable removed.");
        setEnvironmentDeleteTarget(null);
        resetEnvironmentEditor();
        void queryClient.invalidateQueries({
          queryKey: [
            "admin",
            "deployments",
            "environment",
            selectedSite?.siteId,
          ],
        });
      },
      onError: () => {
        toast.error("Could not remove environment variable.");
      },
    });

  const deployments: AdminDeployment[] = data?.data ?? [];
  const environment: AdminDeploymentEnvironmentCatalog | undefined =
    environmentCatalog;
  const customerEnvironment = environment?.customerEditable ?? [];
  const operatorManagedEnvironment = environment?.operatorManaged ?? [];

  function resetEnvironmentEditor() {
    setEditingEnvironmentVariable(null);
    setEnvironmentEditor(EMPTY_ENVIRONMENT_EDITOR);
  }

  function openEnvironmentPanel(siteId: string, siteName: string) {
    if (selectedSite?.siteId === siteId) {
      setSelectedSite(null);
      setEnvironmentDeleteTarget(null);
      resetEnvironmentEditor();
      return;
    }

    setSelectedSite({ siteId, siteName });
    setEnvironmentDeleteTarget(null);
    resetEnvironmentEditor();
  }

  function startEditingEnvironmentVariable(
    variable: AdminDeploymentEnvironmentVariable,
  ) {
    setEditingEnvironmentVariable(variable);
    setEnvironmentEditor({
      key: variable.key,
      value: variable.type === "plain" ? (variable.value ?? "") : "",
      type: variable.type,
      description: variable.description ?? "",
    });
  }

  function submitEnvironmentEditor() {
    upsertEnvironmentVariable(environmentEditor);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Deployments</h1>
          <p className="mt-1 text-sm text-gray-500">
            Latest site deployment status across all tenants.
          </p>
        </div>
        <button
          onClick={() => void refetch()}
          className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {isError && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-medium text-amber-800">
              Could not load deployments
            </p>
            <p className="mt-0.5 text-sm text-amber-700">
              The admin deployments API returned an error. Try refreshing or
              check operator permissions.
            </p>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2">
        {(["ALL", "FAILED", "BUILDING", "DEPLOYED", "PENDING"] as const).map(
          (s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                statusFilter === s
                  ? "bg-slate-800 text-white"
                  : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
              }`}
            >
              {s === "ALL" ? "All" : STATUS_LABELS[s]}
            </button>
          ),
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-gray-400">
            Loading deployments…
          </div>
        ) : deployments.length === 0 && !isError ? (
          <div className="flex flex-col items-center gap-3 p-12 text-center">
            <Rocket className="h-10 w-10 text-gray-300" />
            <p className="text-sm text-gray-500">No deployments found.</p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Site
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Tenant
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Provider Project
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Failure
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Deployed
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {deployments.map((d) => (
                <tr key={d.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-gray-900">
                      {d.siteName}
                    </p>
                    <p className="text-xs text-gray-400">{d.siteId}</p>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {d.tenantName}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[d.status]}`}
                    >
                      <StatusIcon status={d.status} />
                      {STATUS_LABELS[d.status]}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs text-gray-400">
                    {d.providerProjectId ?? "—"}
                  </td>
                  <td className="px-6 py-4">
                    {d.errorMessage ? (
                      <p
                        title={d.errorMessage}
                        className="max-w-xs truncate text-xs text-red-600"
                      >
                        {d.errorMessage}
                      </p>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-400">
                    {d.deployedAt
                      ? formatRelativeTime(d.deployedAt)
                      : formatDate(d.createdAt)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => openEnvironmentPanel(d.siteId, d.siteName)}
                      className={`mr-2 rounded px-2.5 py-1 text-xs font-medium ${
                        selectedSite?.siteId === d.siteId
                          ? "bg-slate-100 text-slate-700"
                          : "text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {canManageEnvironment ? "Manage env" : "Inspect env"}
                    </button>
                    {d.status === "FAILED" && canRetry && (
                      <button
                        onClick={() => setRetryTarget(d.id)}
                        className="rounded px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50"
                      >
                        Retry
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selectedSite ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.9fr)]">
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">
                  Operator Environment Workbench
                </p>
                <h2 className="mt-2 text-lg font-semibold text-gray-900">
                  {selectedSite.siteName}
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Review customer-managed variables, inspect the platform keys
                  generated for this site, and rotate values without going into
                  the provider console.
                </p>
              </div>
              <button
                onClick={() => {
                  setSelectedSite(null);
                  setEnvironmentDeleteTarget(null);
                  resetEnvironmentEditor();
                }}
                className="rounded-lg border border-gray-200 p-2 text-gray-400 hover:bg-gray-50 hover:text-gray-600"
                title="Close environment workbench"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {canManageEnvironment ? (
              <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50/60 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {editingEnvironmentVariable
                        ? `Edit ${editingEnvironmentVariable.key}`
                        : "Add customer-managed variable"}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      Use this for per-site runtime overrides. Platform keys
                      such as SITE_ID and REVALIDATE_SECRET stay read-only.
                    </p>
                  </div>
                  {editingEnvironmentVariable ? (
                    <button
                      onClick={resetEnvironmentEditor}
                      className="text-xs font-medium text-gray-500 hover:text-gray-700"
                    >
                      Clear editor
                    </button>
                  ) : null}
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <label className="block text-xs font-medium text-gray-600">
                    Key
                    <input
                      value={environmentEditor.key}
                      onChange={(event) =>
                        setEnvironmentEditor((current) => ({
                          ...current,
                          key: event.target.value.toUpperCase(),
                        }))
                      }
                      disabled={!!editingEnvironmentVariable}
                      placeholder="BOOKING_API_KEY"
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 disabled:bg-gray-100"
                    />
                  </label>
                  <label className="block text-xs font-medium text-gray-600">
                    Type
                    <select
                      value={environmentEditor.type}
                      onChange={(event) =>
                        setEnvironmentEditor((current) => ({
                          ...current,
                          type: event.target.value as "plain" | "encrypted",
                        }))
                      }
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900"
                    >
                      <option value="plain">Plain text</option>
                      <option value="encrypted">Encrypted secret</option>
                    </select>
                  </label>
                  <label className="block text-xs font-medium text-gray-600 md:col-span-2">
                    Value
                    <input
                      value={environmentEditor.value}
                      onChange={(event) =>
                        setEnvironmentEditor((current) => ({
                          ...current,
                          value: event.target.value,
                        }))
                      }
                      placeholder={
                        environmentEditor.type === "encrypted"
                          ? editingEnvironmentVariable
                            ? "Enter a new secret to replace the stored value"
                            : "Enter the secret value"
                          : "Enter the runtime value"
                      }
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900"
                    />
                  </label>
                  <label className="block text-xs font-medium text-gray-600 md:col-span-2">
                    Description
                    <input
                      value={environmentEditor.description}
                      onChange={(event) =>
                        setEnvironmentEditor((current) => ({
                          ...current,
                          description: event.target.value,
                        }))
                      }
                      placeholder="What this variable is used for"
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900"
                    />
                  </label>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    onClick={submitEnvironmentEditor}
                    disabled={
                      upsertPending ||
                      environmentEditor.key.trim().length === 0 ||
                      environmentEditor.value.trim().length === 0
                    }
                    className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                  >
                    {upsertPending
                      ? "Saving…"
                      : editingEnvironmentVariable
                        ? "Save changes"
                        : "Save variable"}
                  </button>
                  <p className="text-xs text-gray-500">
                    Encrypted values are write-only. Re-enter a new value when
                    rotating a secret.
                  </p>
                </div>
              </div>
            ) : null}

            {isEnvironmentError ? (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Could not load the environment catalog for this site.
              </div>
            ) : null}

            <div className="mt-5">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-slate-400" />
                <h3 className="text-sm font-semibold text-gray-900">
                  Customer-managed variables
                </h3>
              </div>
              <div className="mt-3 space-y-3">
                {isEnvironmentLoading ? (
                  <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-6 text-sm text-gray-500">
                    Loading environment catalog…
                  </div>
                ) : customerEnvironment.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-sm text-gray-500">
                    No customer-managed variables are configured for this site.
                  </div>
                ) : (
                  customerEnvironment.map((variable) => (
                    <EnvironmentVariableCard
                      key={variable.id}
                      variable={variable}
                      canManage={canManageEnvironment}
                      isDeleting={
                        removePending &&
                        environmentDeleteTarget?.id === variable.id
                      }
                      onEdit={() => startEditingEnvironmentVariable(variable)}
                      onDelete={() => setEnvironmentDeleteTarget(variable)}
                    />
                  ))
                )}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-slate-400" />
              <h3 className="text-sm font-semibold text-gray-900">
                Platform-managed variables
              </h3>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              These values are generated from platform configuration and the
              site record. Operators can inspect them here to troubleshoot
              runtime issues, but changes must happen in the platform itself.
            </p>
            <div className="mt-4 space-y-3">
              {isEnvironmentLoading ? (
                <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-6 text-sm text-gray-500">
                  Loading platform variables…
                </div>
              ) : (
                operatorManagedEnvironment.map((variable) => (
                  <EnvironmentVariableCard
                    key={variable.id}
                    variable={variable}
                    canManage={false}
                    isDeleting={false}
                    onEdit={() => undefined}
                    onDelete={() => undefined}
                  />
                ))
              )}
            </div>
          </section>
        </div>
      ) : null}

      <ConfirmDialog
        open={retryTarget !== null}
        title="Retry deployment?"
        message="This will queue a new deployment for the site. The action will be recorded in the audit log."
        confirmLabel="Retry deployment"
        isPending={retryPending}
        onConfirm={() => retryTarget && doRetry(retryTarget)}
        onCancel={() => setRetryTarget(null)}
      />

      <ConfirmDialog
        open={environmentDeleteTarget !== null}
        title="Remove environment variable?"
        message={
          environmentDeleteTarget
            ? `This removes ${environmentDeleteTarget.key} from the selected site and records the action in the audit log.`
            : ""
        }
        confirmLabel="Remove variable"
        isPending={removePending}
        onConfirm={() =>
          environmentDeleteTarget &&
          removeEnvironmentVariable(environmentDeleteTarget.id)
        }
        onCancel={() => setEnvironmentDeleteTarget(null)}
      />
    </div>
  );
}

function EnvironmentVariableCard({
  variable,
  canManage,
  isDeleting,
  onEdit,
  onDelete,
}: {
  variable: AdminDeploymentEnvironmentVariable;
  canManage: boolean;
  isDeleting: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-gray-900">
              {variable.key}
            </p>
            <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
              {variable.type}
            </span>
            <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
              {variable.targets.join(", ")}
            </span>
          </div>
          {variable.description ? (
            <p className="mt-1 text-xs text-gray-500">{variable.description}</p>
          ) : null}
          <p className="mt-3 break-all rounded-lg bg-white px-3 py-2 font-mono text-xs text-gray-700">
            {variable.valuePreview ?? "Stored securely"}
          </p>
          {variable.updatedAt ? (
            <p className="mt-2 text-[11px] text-gray-400">
              Updated {formatRelativeTime(variable.updatedAt)}
            </p>
          ) : null}
        </div>
        {canManage && variable.editable ? (
          <div className="flex items-center gap-2">
            <button
              onClick={onEdit}
              className="rounded-lg p-2 text-gray-400 hover:bg-white hover:text-gray-700"
              title="Edit variable"
            >
              <PencilLine className="h-4 w-4" />
            </button>
            <button
              onClick={onDelete}
              disabled={isDeleting}
              className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
              title="Remove variable"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
