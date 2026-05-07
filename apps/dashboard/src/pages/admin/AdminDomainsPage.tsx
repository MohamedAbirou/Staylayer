import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Globe,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Copy,
  X,
} from "lucide-react";
import { formatDate } from "../../lib/formatDate";
import { useAuth } from "../../auth/useAuth";
import { hasPlatformRole } from "../../auth/access";
import { getAdminDomains, retryDomainVerification } from "../../api/admin";
import toast from "react-hot-toast";
import type {
  AdminDomain,
  AdminDomainVerificationStatus,
} from "../../api/admin";

const V_STATUS_LABELS: Record<AdminDomainVerificationStatus, string> = {
  UNVERIFIED: "Unverified",
  PENDING: "Pending",
  VERIFIED: "Verified",
  FAILED: "Failed",
};

const V_STATUS_COLORS: Record<AdminDomainVerificationStatus, string> = {
  UNVERIFIED: "bg-gray-100 text-gray-600",
  PENDING: "bg-blue-100 text-blue-700",
  VERIFIED: "bg-green-100 text-green-700",
  FAILED: "bg-red-100 text-red-700",
};

function VerificationIcon({
  status,
}: {
  status: AdminDomainVerificationStatus;
}) {
  if (status === "VERIFIED") return <CheckCircle2 className="h-3 w-3" />;
  if (status === "FAILED") return <XCircle className="h-3 w-3" />;
  if (status === "PENDING") return <Clock className="h-3 w-3" />;
  return <AlertTriangle className="h-3 w-3" />;
}

export default function AdminDomainsPage() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const canRetry = hasPlatformRole(session, [
    "PLATFORM_OWNER",
    "SUPPORT_ADMIN",
  ]);
  const [statusFilter, setStatusFilter] = useState<
    AdminDomainVerificationStatus | "ALL"
  >("ALL");
  const [selectedDomainId, setSelectedDomainId] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "domains", statusFilter],
    queryFn: () =>
      getAdminDomains(
        statusFilter !== "ALL"
          ? { verificationStatus: statusFilter }
          : undefined,
      ),
    retry: false,
  });

  const retryMutation = useMutation({
    mutationFn: (domainId: string) => retryDomainVerification(domainId),
    onSuccess: () => {
      toast.success("Domain verification retry requested.");
      void queryClient.invalidateQueries({ queryKey: ["admin", "domains"] });
    },
    onError: () => {
      toast.error("Could not retry verification.");
    },
  });

  const domains: AdminDomain[] = data?.data ?? [];
  const failedCount = domains.filter((d) => d.status === "FAILED").length;
  const selectedDomain =
    domains.find((domain) => domain.id === selectedDomainId) ?? null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Domains</h1>
          <p className="mt-1 text-sm text-gray-500">
            Domain verification and SSL state across all sites.
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

      {/* Hospitality incident summary */}
      {failedCount > 0 && !isError && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          <div>
            <p className="text-sm font-medium text-red-800">
              {failedCount} domain{failedCount !== 1 ? "s" : ""} failed
              verification
            </p>
            <p className="mt-0.5 text-sm text-red-700">
              Retry verification or inspect the affected site&apos;s DNS
              records.
            </p>
          </div>
        </div>
      )}

      {isError && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-medium text-amber-800">
              Could not load domains
            </p>
            <p className="mt-0.5 text-sm text-amber-700">
              The admin domains API returned an error. Try refreshing or check
              API health.
            </p>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2">
        {(["ALL", "FAILED", "UNVERIFIED", "PENDING", "VERIFIED"] as const).map(
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
              {s === "ALL" ? "All" : V_STATUS_LABELS[s]}
            </button>
          ),
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-gray-400">
            Loading domains…
          </div>
        ) : domains.length === 0 && !isError ? (
          <div className="flex flex-col items-center gap-3 p-12 text-center">
            <Globe className="h-10 w-10 text-gray-300" />
            <p className="text-sm text-gray-500">No domains found.</p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Domain
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Site / Tenant
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Verification
                </th>
                <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">
                  SSL
                </th>
                <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Primary
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Last checked
                </th>
                <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {domains.map((d) => (
                <tr key={d.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-gray-900">
                      {d.domain}
                    </p>
                    {d.expectedTarget && (
                      <p className="text-xs text-gray-400">
                        Target {d.expectedTarget}
                      </p>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-gray-700">{d.siteName}</p>
                    <p className="text-xs text-gray-400">{d.tenantName}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${V_STATUS_COLORS[d.verificationStatus]}`}
                    >
                      <VerificationIcon status={d.verificationStatus} />
                      {V_STATUS_LABELS[d.verificationStatus]}
                    </span>
                    <div className="mt-2 space-y-1 text-xs text-gray-400">
                      <p>
                        {d.observedCname
                          ? `CNAME ${d.observedCname}`
                          : d.observedAddresses.length > 0
                            ? d.observedAddresses.join(", ")
                            : "No DNS record observed"}
                      </p>
                      {d.lastError && (
                        <p className="text-red-500">{d.lastError}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {d.sslActive ? (
                      <div className="space-y-1">
                        <CheckCircle2 className="mx-auto h-4 w-4 text-green-500" />
                        {d.verifiedAt && (
                          <p className="text-[11px] text-gray-400">
                            {formatDate(d.verifiedAt)}
                          </p>
                        )}
                      </div>
                    ) : (
                      <XCircle className="mx-auto h-4 w-4 text-red-400" />
                    )}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {d.isPrimary ? (
                      <CheckCircle2 className="mx-auto h-4 w-4 text-blue-400" />
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-400">
                    {d.lastCheckedAt ? formatDate(d.lastCheckedAt) : "—"}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() =>
                          setSelectedDomainId((current) =>
                            current === d.id ? null : d.id,
                          )
                        }
                        className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium ${
                          selectedDomainId === d.id
                            ? "border-slate-300 bg-slate-50 text-slate-700"
                            : "border-gray-200 text-gray-600 hover:bg-gray-50"
                        }`}
                      >
                        {selectedDomainId === d.id ? "Hide" : "Support"}
                      </button>
                      {d.verificationStatus !== "VERIFIED" && canRetry && (
                        <button
                          onClick={() => retryMutation.mutate(d.id)}
                          disabled={retryMutation.isPending}
                          title="Retry verification"
                          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                        >
                          <RefreshCw className="h-3 w-3" />
                          Retry
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selectedDomain ? (
        <DomainSupportPanel
          domain={selectedDomain}
          canRetry={canRetry}
          isRetryPending={retryMutation.isPending}
          onRetry={() => retryMutation.mutate(selectedDomain.id)}
          onClose={() => setSelectedDomainId(null)}
        />
      ) : null}
    </div>
  );
}

function DomainSupportPanel({
  domain,
  canRetry,
  isRetryPending,
  onRetry,
  onClose,
}: {
  domain: AdminDomain;
  canRetry: boolean;
  isRetryPending: boolean;
  onRetry: () => void;
  onClose: () => void;
}) {
  const supportChecklist = buildSupportChecklist(domain);

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">
            Domain Support Workflow
          </p>
          <h2 className="mt-2 text-lg font-semibold text-gray-900">
            {domain.domain}
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            {domain.siteName} · {domain.tenantName}
          </p>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg border border-gray-200 p-2 text-gray-400 hover:bg-gray-50 hover:text-gray-600"
          title="Close support workflow"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-500">
          Next action
        </p>
        <p className="mt-2 text-sm font-medium text-blue-900">
          {domain.nextAction}
        </p>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SupportTile
          label="Expected target"
          value={domain.expectedTarget ?? "No live deployment target"}
          detail="Provider target that the customer DNS should resolve to."
          copyValue={domain.expectedTarget}
        />
        <SupportTile
          label="Observed DNS"
          value={
            domain.observedCname
              ? `CNAME ${domain.observedCname}`
              : domain.observedAddresses.length > 0
                ? domain.observedAddresses.join(", ")
                : "No DNS record observed"
          }
          detail="Most recent DNS data the verifier resolved."
        />
        <SupportTile
          label="Provider state"
          value={
            domain.providerVerificationStatus ??
            domain.providerAttachmentStatus ??
            "No provider status"
          }
          detail={
            domain.providerConfiguredBy
              ? `Provider expects ${domain.providerConfiguredBy}-based validation.`
              : "Provider has not reported a validation method yet."
          }
        />
        <SupportTile
          label="SSL state"
          value={domain.sslStatus ?? (domain.sslActive ? "active" : "pending")}
          detail={
            domain.verifiedAt
              ? `Last verified ${formatDate(domain.verifiedAt)}.`
              : domain.lastCheckedAt
                ? `Last checked ${formatDate(domain.lastCheckedAt)}.`
                : "No verification timestamp recorded yet."
          }
        />
      </div>

      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.9fr)]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-gray-900">
              Recommended DNS records
            </p>
            <SupportBadge
              label={
                !domain.dnsConfigured
                  ? "DNS missing"
                  : domain.dnsMatchesExpected === false
                    ? "DNS mismatch"
                    : "DNS aligned"
              }
              tone={
                !domain.dnsConfigured || domain.dnsMatchesExpected === false
                  ? "warning"
                  : "success"
              }
            />
            {domain.providerMisconfigured ? (
              <SupportBadge
                label="Provider flagged misconfigured"
                tone="warning"
              />
            ) : null}
          </div>
          {domain.recommendedRecords.length > 0 ? (
            <div className="mt-3 overflow-hidden rounded-xl border border-gray-200">
              <table className="min-w-full divide-y divide-gray-100 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Host
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Value
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Match
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 bg-white">
                  {domain.recommendedRecords.map((record) => (
                    <tr key={`${record.type}:${record.host}:${record.value}`}>
                      <td className="px-4 py-3 text-xs font-semibold text-gray-700">
                        {record.type}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-600">
                        {record.host}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-600">
                        {record.value}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <SupportBadge
                          label={
                            record.isMatch === true
                              ? "Matched"
                              : record.isMatch === false
                                ? "Mismatch"
                                : "Unknown"
                          }
                          tone={
                            record.isMatch === true
                              ? "success"
                              : record.isMatch === false
                                ? "warning"
                                : "info"
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="mt-3 rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-sm text-gray-500">
              No recommended records were returned for this domain.
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <p className="text-sm font-semibold text-gray-900">
              Operator checklist
            </p>
            <ul className="mt-3 space-y-2 text-sm text-gray-600">
              {supportChecklist.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <p className="text-sm font-semibold text-gray-900">
              Provider hints
            </p>
            <div className="mt-3 space-y-2 text-sm text-gray-600">
              <p>Attachment status: {domain.providerAttachmentStatus ?? "—"}</p>
              <p>
                Verification status: {domain.providerVerificationStatus ?? "—"}
              </p>
              {domain.providerConfiguredBy ? (
                <p>Configured by: {domain.providerConfiguredBy}</p>
              ) : null}
              {domain.providerAcceptedChallenges.length > 0 ? (
                <p>
                  Accepted challenges:{" "}
                  {domain.providerAcceptedChallenges.join(", ")}
                </p>
              ) : null}
              {domain.providerError ? (
                <p className="text-red-600">
                  Provider error: {domain.providerError}
                </p>
              ) : null}
              {domain.lastError ? (
                <p className="text-red-600">Latest error: {domain.lastError}</p>
              ) : null}
            </div>
          </div>

          {canRetry && domain.verificationStatus !== "VERIFIED" ? (
            <button
              onClick={onRetry}
              disabled={isRetryPending}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              <RefreshCw className="h-4 w-4" />
              Retry verification
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function SupportTile({
  label,
  value,
  detail,
  copyValue,
}: {
  label: string;
  value: string;
  detail: string;
  copyValue?: string | null;
}) {
  const [copied, setCopied] = useState(false);

  function copy() {
    if (!copyValue) {
      return;
    }

    void navigator.clipboard.writeText(copyValue).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">
        {label}
      </p>
      <div className="mt-2 flex items-start justify-between gap-3">
        <p className="break-all text-sm font-semibold text-gray-900">{value}</p>
        {copyValue ? (
          <button
            onClick={copy}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-white hover:text-gray-700"
            title="Copy value"
          >
            {copied ? (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </button>
        ) : null}
      </div>
      <p className="mt-2 text-xs text-gray-500">{detail}</p>
    </div>
  );
}

function SupportBadge({
  label,
  tone,
}: {
  label: string;
  tone: "success" | "warning" | "info";
}) {
  const tones = {
    success: "bg-emerald-100 text-emerald-700",
    warning: "bg-amber-100 text-amber-800",
    info: "bg-blue-100 text-blue-700",
  };

  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${tones[tone]}`}
    >
      {label}
    </span>
  );
}

function buildSupportChecklist(domain: AdminDomain): string[] {
  const checklist: string[] = [];

  if (!domain.dnsConfigured) {
    checklist.push(
      "Confirm the customer has added the recommended DNS record and wait for propagation before retrying verification.",
    );
  }

  if (domain.dnsMatchesExpected === false) {
    checklist.push(
      "Ask the customer to replace the current DNS record with the exact recommended value shown above.",
    );
  }

  if (
    domain.providerAttachmentStatus &&
    domain.providerAttachmentStatus !== "attached"
  ) {
    checklist.push(
      "Once DNS matches, retry verification so the provider can re-attach the domain to the project.",
    );
  }

  if (domain.sslStatus === "provisioning") {
    checklist.push(
      "DNS now looks close enough for SSL issuance; wait for certificate provisioning, then retry if it stalls.",
    );
  }

  if (domain.providerError || domain.lastError) {
    checklist.push(
      "Use the provider error and latest error verbatim in the support ticket so the customer knows the exact failure mode.",
    );
  }

  if (checklist.length === 0) {
    checklist.push(
      "Review the provider and DNS state, then retry verification if the customer reports the issue is still active.",
    );
  }

  return checklist;
}
