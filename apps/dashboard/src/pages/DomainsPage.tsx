import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/useAuth";
import { hasActiveSite, hasMembershipRole } from "../auth/access";
import { Link } from "react-router-dom";
import {
  Globe,
  CircleCheck as CheckCircle2,
  TriangleAlert as AlertTriangle,
  Clock,
  ExternalLink,
  Trash2,
  Star,
  RefreshCw,
  Copy,
  Check,
  Wand as Wand2,
} from "lucide-react";

import {
  getDomains,
  getSiteRuntimeProfile,
  setDomainPrimary,
  removeDomain,
  retryDomainVerification,
  setPreferredHostVariant,
  addDomainCompanion,
} from "../api/domains";
import type {
  SiteDomain,
  DomainStatus,
  HostnameKind,
  HostVariant,
} from "../api/domains";
import { DomainSetupWizard } from "../components/DomainSetupWizard";

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
  const [wizardDomain, setWizardDomain] = useState<SiteDomain | null>(null);
  const [showWizard, setShowWizard] = useState(false);

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

  const { data: runtimeProfile } = useQuery({
    queryKey: ["domains", "runtime-profile", siteId],
    queryFn: () => getSiteRuntimeProfile(siteId!),
    enabled: !!siteId,
    retry: false,
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

  const preferredVariantMutation = useMutation({
    mutationFn: (variant: HostVariant) =>
      setPreferredHostVariant(siteId!, variant),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["domains", "runtime-profile", siteId],
      });
      void queryClient.invalidateQueries({ queryKey: ["domains", siteId] });
    },
  });

  const companionMutation = useMutation({
    mutationFn: (domainId: string) => addDomainCompanion(siteId!, domainId),
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

  const activePrimaryDomain = domains.find(
    (domain) => domain.isPrimary && domain.status === "ACTIVE",
  );
  const fallbackDomain = domains.find((domain) => domain.isPrimary) ?? null;
  const dnsTarget =
    runtimeProfile?.websiteProjectTarget ??
    activePrimaryDomain?.dnsTarget ??
    fallbackDomain?.dnsTarget ??
    null;

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
        {canManageDomains && (
          <button
            onClick={() => {
              setWizardDomain(null);
              setShowWizard(true);
            }}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 active:bg-blue-800"
          >
            <Wand2 className="h-4 w-4" />
            Connect domain
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
              provider, checks DNS against the shared website runtime target,
              and waits for HTTPS to become active. It can inspect and explain
              DNS issues, but it cannot repair registrar records automatically
              without a DNS or registrar integration.
            </p>
          </div>
          <Link
            to="/deployments"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Open publishing
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
            label="Default hostname"
            value={runtimeProfile?.defaultHostname ?? "Not assigned yet"}
            detail={
              runtimeProfile?.defaultHostname
                ? "This site already has a shared public hostname you can use before a custom domain is ready."
                : "Assign a public subdomain to give the site a default shared-runtime hostname."
            }
          />
          <DomainSignalTile
            label="DNS target"
            value={dnsTarget ?? "Runtime target unavailable"}
            detail={
              runtimeProfile?.sharedRuntimeReady
                ? "Use this target when your DNS provider asks where the hostname should point."
                : "The shared website runtime still needs its project or root-domain configuration."
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

      {runtimeProfile && canManageDomains && (
        <CanonicalHostnameCard
          domains={domains}
          preferredHostVariant={runtimeProfile.preferredHostVariant}
          isPending={preferredVariantMutation.isPending}
          onChange={(variant) => preferredVariantMutation.mutate(variant)}
          onAddCompanion={(domainId) => companionMutation.mutate(domainId)}
          isCompanionPending={companionMutation.isPending}
        />
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
            onAdd={() => {
              setWizardDomain(null);
              setShowWizard(true);
            }}
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
                onOpenWizard={() => {
                  setWizardDomain(domain);
                  setShowWizard(true);
                }}
                isPrimaryPending={primaryMutation.isPending}
                isRemovePending={removeMutation.isPending}
                isRetryPending={retryMutation.isPending}
              />
            ))}
          </div>
        )}
      </div>

      {showWizard && (
        <DomainSetupWizard
          onClose={() => setShowWizard(false)}
          existingDomain={wizardDomain}
        />
      )}
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
          Connect your first domain →
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
  onOpenWizard,
  isPrimaryPending,
  isRemovePending,
  isRetryPending,
}: {
  domain: SiteDomain;
  canManageDomains: boolean;
  onSetPrimary: () => void;
  onRemove: () => void;
  onRetry: () => void;
  onOpenWizard: () => void;
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
    <div className="flex items-start justify-between px-6 py-4 transition-colors hover:bg-gray-50/70">
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
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-600">
              {hostnameKindLabel(domain.kind)}
            </span>
            {domain.companionDomainId && domain.companionHost && (
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                Pairs with {domain.companionHost}
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
          <DomainDiagnosticsPanel domain={domain} />
        </div>
      </div>
      <div className="flex items-center gap-1">
        {canManageDomains && status !== "ACTIVE" && (
          <button
            onClick={onOpenWizard}
            title="Open setup wizard"
            className="rounded-lg p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600"
          >
            <Wand2 className="h-4 w-4" />
          </button>
        )}
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

function DomainDiagnosticsPanel({ domain }: { domain: SiteDomain }) {
  const records = getDisplayRecommendedRecords(domain);

  if (
    (domain.status === "ACTIVE" || domain.sslActive) &&
    !domain.providerError &&
    !domain.providerMisconfigured
  ) {
    return null;
  }

  if (
    records.length === 0 &&
    !domain.providerConfiguredBy &&
    !domain.providerError
  ) {
    return null;
  }

  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">
          DNS diagnostics
        </p>
        {domain.providerConfiguredBy ? (
          <DomainStateChip
            label={`Provider sees ${domain.providerConfiguredBy}`}
            tone={
              domain.providerMisconfigured ||
              domain.dnsMatchesExpected === false
                ? "warning"
                : "info"
            }
          />
        ) : null}
        {domain.providerMisconfigured ? (
          <DomainStateChip
            label="Provider marked misconfigured"
            tone="warning"
          />
        ) : null}
      </div>

      {records.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100 text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-[0.14em] text-gray-400">
              <tr>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Expected value</th>
                <th className="px-4 py-3 font-semibold">Observed</th>
                <th className="px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {records.map((record, index) => (
                <tr
                  key={`${record.type}-${record.name}-${record.value}-${index}`}
                >
                  <td className="px-4 py-3 text-xs font-semibold text-gray-700">
                    {record.type}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-700">
                    {record.name}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-900">
                    {record.value}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">
                    {getObservedRecordValue(domain, record.type)}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <span
                      className={`rounded-full px-2 py-1 font-semibold ${
                        record.isMatch === true
                          ? "bg-emerald-100 text-emerald-700"
                          : record.isMatch === false
                            ? "bg-red-100 text-red-700"
                            : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {record.isMatch === true
                        ? "Correct"
                        : record.isMatch === false
                          ? "Needs update"
                          : "Unknown"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="px-4 py-3 text-xs text-gray-500">
          The provider has not returned a DNS recommendation yet.
        </p>
      )}

      <div className="space-y-2 border-t border-gray-100 bg-gray-50 px-4 py-3 text-xs text-gray-500">
        {domain.recommendedRecords.length > records.length ? (
          <p>
            The provider returned alternative DNS targets. The table shows the
            matched or highest-priority records to act on.
          </p>
        ) : null}
        {domain.providerAcceptedChallenges.length > 0 ? (
          <p>
            Accepted certificate challenges:{" "}
            {domain.providerAcceptedChallenges.join(", ")}
          </p>
        ) : null}
        <p>
          The platform can inspect provider and DNS state and tell you which
          record is wrong. It cannot change registrar records automatically.
        </p>
      </div>
    </div>
  );
}

function getObservedRecordValue(
  domain: SiteDomain,
  type: SiteDomain["recommendedRecords"][number]["type"],
) {
  if (type === "CNAME") {
    return domain.observedCname ?? "No CNAME detected";
  }

  return domain.observedAddresses.length > 0
    ? domain.observedAddresses.join(", ")
    : "No A record detected";
}

function getDisplayRecommendedRecords(domain: SiteDomain) {
  const grouped = new Map<string, SiteDomain["recommendedRecords"]>();

  for (const record of domain.recommendedRecords) {
    const key = `${record.type}:${record.name}`;
    const current = grouped.get(key) ?? [];
    current.push(record);
    grouped.set(key, current);
  }

  return Array.from(grouped.values()).flatMap((records) => {
    const matching = records.filter((record) => record.isMatch === true);

    if (matching.length > 0) {
      return matching;
    }

    const ranked = records.filter((record) => record.rank !== null);

    if (ranked.length > 0) {
      const bestRank = Math.min(
        ...ranked.map((record) => record.rank ?? Number.MAX_SAFE_INTEGER),
      );

      return ranked.filter((record) => record.rank === bestRank);
    }

    return records.slice(0, 1);
  });
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

function hostnameKindLabel(kind: HostnameKind): string {
  switch (kind) {
    case "apex":
      return "Apex";
    case "www":
      return "WWW";
    case "subdomain":
      return "Subdomain";
    case "platform-subdomain":
      return "Platform";
  }
}

function CanonicalHostnameCard({
  domains,
  preferredHostVariant,
  isPending,
  onChange,
  onAddCompanion,
  isCompanionPending,
}: {
  domains: SiteDomain[];
  preferredHostVariant: HostVariant;
  isPending: boolean;
  onChange: (variant: HostVariant) => void;
  onAddCompanion: (domainId: string) => void;
  isCompanionPending: boolean;
}) {
  // Find apex/www pairs. We only need to show this card when the site has at
  // least one apex or www domain. Pairs are identified by `apexHost`.
  const pairs = new Map<string, { apex?: SiteDomain; www?: SiteDomain }>();
  for (const d of domains) {
    if (d.kind !== "apex" && d.kind !== "www") continue;
    const bucket = pairs.get(d.apexHost) ?? {};
    if (d.kind === "apex") bucket.apex = d;
    else bucket.www = d;
    pairs.set(d.apexHost, bucket);
  }

  if (pairs.size === 0) return null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">
            Canonical hostname
          </p>
          <h2 className="mt-2 text-lg font-semibold text-gray-900">
            Pick which hostname guests see in the address bar
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            When both the root domain and its www companion are connected, the
            platform serves one as canonical and 308-redirects the other to it.
            Search engines and shared links will all converge on the canonical
            hostname.
          </p>
        </div>

        <div className="mt-2 flex flex-wrap gap-3">
          <CanonicalRadio
            value="APEX"
            current={preferredHostVariant}
            label="Use the root domain"
            sublabel="example.com is canonical; www.example.com redirects to it."
            disabled={isPending}
            onSelect={onChange}
          />
          <CanonicalRadio
            value="WWW"
            current={preferredHostVariant}
            label="Use the www subdomain"
            sublabel="www.example.com is canonical; example.com redirects to it."
            disabled={isPending}
            onSelect={onChange}
          />
        </div>

        <div className="mt-4 space-y-2">
          {Array.from(pairs.entries()).map(([apexHost, pair]) => {
            const haveBoth = pair.apex && pair.www;
            const missing = !pair.apex ? "apex" : !pair.www ? "www" : null;
            const sourceDomain = pair.apex ?? pair.www;
            const companionLabel =
              missing === "apex" ? apexHost : `www.${apexHost}`;

            return (
              <div
                key={apexHost}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-600"
              >
                <span className="font-mono text-gray-700">{apexHost}</span>
                {haveBoth ? (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-700">
                    Apex + www connected
                  </span>
                ) : (
                  <>
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-800">
                      Missing {companionLabel}
                    </span>
                    {sourceDomain && (
                      <button
                        type="button"
                        onClick={() => onAddCompanion(sourceDomain.id)}
                        disabled={isCompanionPending}
                        className="rounded-md border border-blue-200 bg-white px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-60"
                      >
                        Add {companionLabel}
                      </button>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CanonicalRadio({
  value,
  current,
  label,
  sublabel,
  disabled,
  onSelect,
}: {
  value: HostVariant;
  current: HostVariant;
  label: string;
  sublabel: string;
  disabled: boolean;
  onSelect: (variant: HostVariant) => void;
}) {
  const selected = current === value;
  return (
    <button
      type="button"
      onClick={() => !selected && onSelect(value)}
      disabled={disabled || selected}
      className={`flex-1 min-w-55 rounded-lg border px-4 py-3 text-left transition ${
        selected
          ? "border-blue-500 bg-blue-50 ring-2 ring-blue-100"
          : "border-gray-200 bg-white hover:border-gray-300"
      } disabled:cursor-default`}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-900">{label}</span>
        {selected && (
          <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-semibold text-white">
            Canonical
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-gray-500">{sublabel}</p>
    </button>
  );
}
