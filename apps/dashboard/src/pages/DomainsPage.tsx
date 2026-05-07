import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/useAuth";
import { hasActiveSite, hasMembershipRole } from "../auth/access";
import { Link } from "react-router-dom";
import {
  Globe,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Plus,
  ExternalLink,
  Trash2,
  Star,
  RefreshCw,
  Copy,
  Check,
} from "lucide-react";

import { getLatestDeployment } from "../api/deployments";
import {
  getDomains,
  addDomain,
  setDomainPrimary,
  removeDomain,
  retryDomainVerification,
} from "../api/domains";
import type { SiteDomain, DomainStatus } from "../api/domains";

// ─── INFRASTRUCTURE ASSUMPTION (now fulfilled) ────────────────────────────────
// Endpoints provided by apps/api/src/domains/domains.controller.ts:
//   GET    /domains?siteId=...
//   POST   /domains?siteId=...           { hostname: string }
//   PATCH  /domains/:id/primary?siteId=...
//   DELETE /domains/:id?siteId=...
// ─────────────────────────────────────────────────────────────────────────────

const DOMAIN_ADMIN_ROLES = ["OWNER", "ADMIN"] as const;

const STATUS_META: Record<
  DomainStatus,
  { label: string; icon: typeof CheckCircle2; color: string }
> = {
  ACTIVE: {
    label: "Verified",
    icon: CheckCircle2,
    color: "text-emerald-600",
  },
  PENDING: {
    label: "Pending setup",
    icon: Clock,
    color: "text-amber-500",
  },
  DNS_REQUIRED: {
    label: "DNS required",
    icon: AlertTriangle,
    color: "text-amber-600",
  },
  VERIFYING: {
    label: "Verifying",
    icon: RefreshCw,
    color: "text-blue-600",
  },
  PROVIDER_ATTACH_PENDING: {
    label: "Provider attach pending",
    icon: RefreshCw,
    color: "text-blue-600",
  },
  SSL_PROVISIONING: {
    label: "SSL provisioning",
    icon: RefreshCw,
    color: "text-violet-600",
  },
  FAILED: {
    label: "Verification failed",
    icon: AlertTriangle,
    color: "text-red-500",
  },
};

export default function DomainsPage() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const canManageDomains = hasMembershipRole(session, DOMAIN_ADMIN_ROLES);
  const siteId = session?.activeSite?.id ?? null;
  const [showAddForm, setShowAddForm] = useState(false);
  const [hostname, setHostname] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  const {
    data: domains = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["domains", siteId],
    queryFn: () => getDomains(siteId!),
    enabled: !!siteId,
    retry: false,
  });

  const { data: latestDeployment } = useQuery({
    queryKey: ["domains", "latest-deployment", siteId],
    queryFn: () => getLatestDeployment(siteId!),
    enabled: !!siteId,
    retry: false,
  });

  const addMutation = useMutation({
    mutationFn: (h: string) => addDomain(siteId!, h),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["domains", siteId] });
      setShowAddForm(false);
      setHostname("");
      setAddError(null);
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ??
        "Failed to add domain. Check the hostname and try again.";
      setAddError(msg);
    },
  });

  const primaryMutation = useMutation({
    mutationFn: (domainId: string) => setDomainPrimary(siteId!, domainId),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["domains", siteId] }),
  });

  const removeMutation = useMutation({
    mutationFn: (domainId: string) => removeDomain(siteId!, domainId),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["domains", siteId] }),
  });

  const retryMutation = useMutation({
    mutationFn: (domainId: string) =>
      retryDomainVerification(siteId!, domainId),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["domains", siteId] }),
  });

  if (!hasActiveSite(session)) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900">Domains</h1>
        <p className="mt-2 text-sm text-gray-600">
          Select a site to manage custom domains.
        </p>
      </div>
    );
  }

  const handleAdd = () => {
    setAddError(null);
    const trimmed = hostname.trim().toLowerCase();
    if (!trimmed) return;
    addMutation.mutate(trimmed);
  };

  const activePrimaryDomain = domains.find(
    (domain) => domain.isPrimary && domain.status === "ACTIVE",
  );
  const providerTarget =
    latestDeployment?.providerUrl ?? latestDeployment?.url ?? null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Domains</h1>
          <p className="mt-1 text-sm text-gray-500">
            View the current domain state for your hospitality site.
          </p>
        </div>
        {canManageDomains && !showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 active:bg-blue-800"
          >
            <Plus className="h-4 w-4" />
            Add domain
          </button>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">
              Production Routing
            </p>
            <h2 className="mt-2 text-lg font-semibold text-gray-900">
              Provider attachment, DNS checks, and SSL all run from here
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              When you connect a domain, the platform attaches it at the hosting
              provider, checks DNS against the live deployment target, and waits
              for HTTPS to become active.
            </p>
          </div>
          <Link
            to="/deployments"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Open deployments
          </Link>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <DomainSignalTile
            label="Production domain"
            value={activePrimaryDomain?.hostname ?? "Not verified yet"}
            detail={
              activePrimaryDomain
                ? "Guests can already reach the live site here."
                : "Connect and verify a primary domain before launch."
            }
          />
          <DomainSignalTile
            label="Provider target"
            value={providerTarget ?? "Provision a deployment first"}
            detail={
              providerTarget
                ? "Use this target when your DNS provider asks where to point the domain."
                : "No deployment target exists yet, so DNS cannot be verified."
            }
          />
          <DomainSignalTile
            label="Automation"
            value={
              latestDeployment?.status === "LIVE"
                ? "Checks active"
                : "Waiting on deployment"
            }
            detail={
              latestDeployment?.status === "LIVE"
                ? "DNS, provider attachment, and SSL checks will continue automatically."
                : "Provision the site before expecting domain verification to complete."
            }
          />
        </div>
      </div>

      {!canManageDomains && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-700">
          You can view domain verification state here, but only site admins can
          connect, remove, or change the primary domain.
        </div>
      )}

      {/* Add domain form */}
      {canManageDomains && showAddForm && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-gray-900">
            Add a custom domain
          </h3>
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Globe className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={hostname}
                onChange={(e) =>
                  setHostname(e.target.value.toLowerCase().trim())
                }
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                placeholder="yourdomain.com"
                className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <button
              onClick={handleAdd}
              disabled={!hostname.trim() || addMutation.isPending}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 hover:bg-blue-700"
            >
              {addMutation.isPending ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : null}
              Connect
            </button>
            <button
              onClick={() => {
                setShowAddForm(false);
                setHostname("");
                setAddError(null);
              }}
              className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
          {addError && <p className="mt-2 text-xs text-red-600">{addError}</p>}
          <p className="mt-2 text-xs text-gray-500">
            After connecting, the platform will attach the domain at the hosting
            provider, check DNS automatically, and keep retrying SSL issuance.
            {providerTarget
              ? ` Point your DNS to ${providerTarget}.`
              : " Provision a deployment first so a DNS target exists."}
          </p>
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
          Could not load domains. Please refresh or contact support.
        </div>
      )}

      {/* Domain list */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-sm text-gray-400">
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            Loading domains…
          </div>
        ) : domains.length === 0 ? (
          <EmptyDomains
            canManageDomains={canManageDomains}
            onAdd={() => setShowAddForm(true)}
          />
        ) : (
          <div className="divide-y divide-gray-50">
            {domains.map((domain) => (
              <DomainRow
                key={domain.id}
                domain={domain}
                canManageDomains={canManageDomains}
                onSetPrimary={() => primaryMutation.mutate(domain.id)}
                onRemove={() => removeMutation.mutate(domain.id)}
                onRetry={() => retryMutation.mutate(domain.id)}
                isPrimaryPending={primaryMutation.isPending}
                isRemovePending={removeMutation.isPending}
                isRetryPending={retryMutation.isPending}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function EmptyDomains({
  canManageDomains,
  onAdd,
}: {
  canManageDomains: boolean;
  onAdd: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-50">
        <Globe className="h-7 w-7 text-gray-300" />
      </div>
      <div>
        <p className="text-sm font-semibold text-gray-800">
          No domains connected
        </p>
        <p className="mt-1 text-xs text-gray-500">
          {canManageDomains
            ? "Add a custom domain so guests can reach your hospitality site."
            : "A site admin can connect a custom domain so guests can reach your hospitality site."}
        </p>
      </div>
      {canManageDomains && (
        <button
          onClick={onAdd}
          className="text-sm font-medium text-blue-600 hover:text-blue-800"
        >
          Add your first domain →
        </button>
      )}
    </div>
  );
}

function DomainRow({
  domain,
  canManageDomains,
  onSetPrimary,
  onRemove,
  onRetry,
  isPrimaryPending,
  isRemovePending,
  isRetryPending,
}: {
  domain: SiteDomain;
  canManageDomains: boolean;
  onSetPrimary: () => void;
  onRemove: () => void;
  onRetry: () => void;
  isPrimaryPending: boolean;
  isRemovePending: boolean;
  isRetryPending: boolean;
}) {
  const { hostname, status, isPrimary, dnsTarget, lastCheckedAt, lastError } =
    domain;
  const meta = STATUS_META[status];
  const StatusIcon = meta.icon;
  const detail = getDomainStatusDetail(domain);
  const [copied, setCopied] = useState(false);

  function copyDnsTarget() {
    if (!dnsTarget) return;
    void navigator.clipboard.writeText(dnsTarget).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="flex items-center justify-between px-6 py-4 hover:bg-gray-50/70 transition-colors">
      <div className="flex items-center gap-3">
        <Globe className="h-4 w-4 text-gray-400 shrink-0" />
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-900">
              {hostname}
            </span>
            {isPrimary && (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                Primary
              </span>
            )}
          </div>
          <div
            className={`flex items-center gap-1 mt-0.5 text-xs ${meta.color}`}
          >
            <StatusIcon className="h-3 w-3" />
            {meta.label}
          </div>
          <p className="mt-1 text-xs text-gray-500">{detail}</p>
          <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
            <DomainStateChip
              label={
                domain.dnsConfigured
                  ? domain.dnsMatchesExpected === false
                    ? "DNS mismatch"
                    : "DNS detected"
                  : "DNS missing"
              }
              tone={
                !domain.dnsConfigured || domain.dnsMatchesExpected === false
                  ? "warning"
                  : "success"
              }
            />
            {domain.providerAttachmentStatus ? (
              <DomainStateChip
                label={`Provider ${domain.providerAttachmentStatus}`}
                tone={domain.providerError ? "warning" : "info"}
              />
            ) : null}
            {domain.sslStatus ? (
              <DomainStateChip
                label={`SSL ${domain.sslStatus}`}
                tone={domain.sslActive ? "success" : "info"}
              />
            ) : null}
          </div>
          <p className="mt-2 text-xs font-medium text-gray-700">
            Next: {domain.nextAction}
          </p>
          {(lastCheckedAt || lastError || dnsTarget) && (
            <div className="mt-1 text-[11px] text-gray-400">
              {lastCheckedAt ? (
                `Last checked ${new Date(lastCheckedAt).toLocaleString()}`
              ) : dnsTarget ? (
                <span className="flex items-center gap-1.5">
                  <span>
                    Point DNS to:{" "}
                    <span className="font-mono text-gray-600">{dnsTarget}</span>
                  </span>
                  <button
                    onClick={copyDnsTarget}
                    title="Copy DNS target"
                    className="rounded p-0.5 hover:bg-gray-100 text-gray-400 hover:text-gray-700"
                  >
                    {copied ? (
                      <Check className="h-3 w-3 text-green-500" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </button>
                </span>
              ) : (
                lastError
              )}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1">
        {canManageDomains && !isPrimary && (
          <button
            onClick={onSetPrimary}
            disabled={isPrimaryPending}
            title="Set as primary domain"
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-amber-500 disabled:opacity-50"
          >
            <Star className="h-4 w-4" />
          </button>
        )}
        <a
          href={`https://${hostname}`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          title="Open site"
        >
          <ExternalLink className="h-4 w-4" />
        </a>
        {canManageDomains && status !== "ACTIVE" && (
          <button
            onClick={onRetry}
            disabled={isRetryPending}
            title="Retry verification"
            className="rounded-lg p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600 disabled:opacity-50"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        )}
        {canManageDomains && !isPrimary && (
          <button
            onClick={onRemove}
            disabled={isRemovePending}
            title="Remove domain"
            className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

function DomainSignalTile({
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

function DomainStateChip({
  label,
  tone,
}: {
  label: string;
  tone: "success" | "warning" | "info";
}) {
  const styles = {
    success: "bg-emerald-100 text-emerald-700",
    warning: "bg-amber-100 text-amber-800",
    info: "bg-blue-100 text-blue-700",
  };

  return (
    <span className={`rounded-full px-2 py-0.5 font-medium ${styles[tone]}`}>
      {label}
    </span>
  );
}

function getDomainStatusDetail(domain: SiteDomain) {
  switch (domain.status) {
    case "ACTIVE":
      return "HTTPS is live and guests can reach this domain.";
    case "DNS_REQUIRED":
      return domain.dnsTarget
        ? `Point your DNS at ${domain.dnsTarget} and wait for propagation.`
        : (domain.lastError ?? "DNS records are missing or incorrect.");
    case "VERIFYING":
      return (
        domain.lastError ??
        "DNS is in place. SSL provisioning is still in progress."
      );
    case "PROVIDER_ATTACH_PENDING":
      return (
        domain.providerError ??
        "DNS is set. The deployment provider is still attaching this domain."
      );
    case "SSL_PROVISIONING":
      return (
        domain.lastError ??
        "Provider attachment is complete. SSL certificates are still provisioning."
      );
    case "FAILED":
      return domain.lastError ?? "Verification failed. Review DNS and retry.";
    default:
      return domain.nextAction;
  }
}
