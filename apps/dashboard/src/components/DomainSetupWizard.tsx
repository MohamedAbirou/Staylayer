import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  ArrowLeft,
  CircleCheck as CheckCircle2,
  Globe,
  Loader as Loader2,
  Copy,
  Check,
  TriangleAlert as AlertTriangle,
  ExternalLink,
  Plus,
} from "lucide-react";
import { useAuth } from "../auth/useAuth";
import {
  addDomain,
  addDomainCompanion,
  getSiteRuntimeProfile,
  retryDomainVerification,
  type SiteDomain,
} from "../api/domains";
import { classifyHostname, type ClassifiedHostname } from "../lib/hostname";

type WizardStep = "enter" | "dns" | "verify" | "done";

function getInitialStep(existingDomain?: SiteDomain | null): WizardStep {
  if (!existingDomain) {
    return "enter";
  }

  if (existingDomain.status === "ACTIVE" || existingDomain.sslActive) {
    return "done";
  }

  if (
    existingDomain.dnsConfigured ||
    existingDomain.providerAttached ||
    existingDomain.providerVerified ||
    existingDomain.status === "VERIFYING" ||
    existingDomain.status === "PROVIDER_ATTACH_PENDING" ||
    existingDomain.status === "SSL_PROVISIONING"
  ) {
    return "verify";
  }

  return "dns";
}

export function DomainSetupWizard({
  onClose,
  existingDomain,
}: {
  onClose: () => void;
  existingDomain?: SiteDomain | null;
}) {
  const { session } = useAuth();
  const siteId = session?.activeSite?.id ?? null;
  const queryClient = useQueryClient();
  const isExistingDomainFlow = Boolean(existingDomain);

  const [step, setStep] = useState<WizardStep>(() =>
    getInitialStep(existingDomain),
  );
  const [hostname, setHostname] = useState(existingDomain?.hostname ?? "");
  const [domain, setDomain] = useState<SiteDomain | null>(
    existingDomain ?? null,
  );
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [companionAdded, setCompanionAdded] = useState(false);
  const [companionError, setCompanionError] = useState<string | null>(null);

  const { data: runtimeProfile } = useQuery({
    queryKey: ["domains", "runtime-profile", siteId],
    queryFn: () => getSiteRuntimeProfile(siteId!),
    enabled: !!siteId,
    retry: false,
    staleTime: 60_000,
  });

  const classification = useMemo<ClassifiedHostname | null>(
    () => classifyHostname(hostname, runtimeProfile?.platformRootDomain),
    [hostname, runtimeProfile?.platformRootDomain],
  );

  const addMutation = useMutation({
    mutationFn: (h: string) => addDomain(siteId!, h),
    onSuccess: (d) => {
      setDomain(d);
      setError(null);
      setCompanionAdded(false);
      setCompanionError(null);
      setStep("dns");
      void queryClient.invalidateQueries({ queryKey: ["domains", siteId] });
    },
    onError: (err: unknown) => {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Could not add this domain. Check the hostname.",
      );
    },
  });

  const retryMutation = useMutation({
    mutationFn: () => retryDomainVerification(siteId!, domain!.id),
    onSuccess: (d) => {
      setDomain(d);
      void queryClient.invalidateQueries({ queryKey: ["domains", siteId] });
      if (d.status === "ACTIVE") {
        setStep("done");
      } else {
        setStep("verify");
      }
    },
    onError: () => {
      setStep("verify");
    },
  });

  const companionMutation = useMutation({
    mutationFn: () => addDomainCompanion(siteId!, domain!.id),
    onSuccess: () => {
      setCompanionAdded(true);
      setCompanionError(null);
      void queryClient.invalidateQueries({ queryKey: ["domains", siteId] });
    },
    onError: (err: unknown) => {
      setCompanionError(
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Could not add the companion hostname.",
      );
    },
  });

  function handleAdd() {
    const trimmed = hostname.trim().toLowerCase();
    if (!trimmed) return;
    if (classification?.kind === "platform-subdomain") {
      setError(
        "This is a platform subdomain. You can manage it under your site's public subdomain — no custom-domain setup is needed.",
      );
      return;
    }
    addMutation.mutate(trimmed);
  }

  function handleCopy(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const dnsTarget =
    domain?.dnsTarget ?? domain?.recommendedRecords?.[0]?.value ?? null;
  const records = domain?.recommendedRecords ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-xl">
        {/* Progress */}
        <div className="mb-6 flex items-center gap-3">
          {(["enter", "dns", "verify", "done"] as WizardStep[]).map(
            (s, idx) => (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                    step === s
                      ? "bg-blue-600 text-white ring-4 ring-blue-100"
                      : (
                            ["enter", "dns", "verify", "done"] as WizardStep[]
                          ).indexOf(step) > idx
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-400"
                  }`}
                >
                  {(["enter", "dns", "verify", "done"] as WizardStep[]).indexOf(
                    step,
                  ) > idx ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    idx + 1
                  )}
                </div>
                {idx < 3 && (
                  <div
                    className={`h-0.5 w-6 rounded-full ${
                      (
                        ["enter", "dns", "verify", "done"] as WizardStep[]
                      ).indexOf(step) > idx
                        ? "bg-blue-400"
                        : "bg-gray-200"
                    }`}
                  />
                )}
              </div>
            ),
          )}
        </div>

        {step === "enter" && (
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              Connect a custom domain
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              Enter the domain you want guests to use when visiting your
              hospitality site.
            </p>
            <div className="mt-6">
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Domain name
              </label>
              <div className="relative">
                <Globe className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={hostname}
                  onChange={(e) => setHostname(e.target.value.toLowerCase())}
                  onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                  placeholder="www.yourhotel.com"
                  className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
                />
              </div>
              {classification && (
                <HostnameKindPreview classification={classification} />
              )}
              {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
            </div>
            <div className="mt-6 flex items-center justify-between">
              <button
                type="button"
                onClick={onClose}
                className="text-sm text-gray-500 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAdd}
                disabled={!hostname.trim() || addMutation.isPending}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {addMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                Continue
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {step === "dns" && (
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              Configure your DNS
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              Add the following DNS record at your domain registrar. This points
              your domain to our hosting infrastructure.
            </p>

            {records.length > 0 ? (
              <div className="mt-5 space-y-3">
                {records.map((rec, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-gray-200 bg-gray-50 p-4"
                  >
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <p className="font-semibold text-gray-400">Type</p>
                        <p className="mt-1 font-mono text-gray-900">
                          {rec.type}
                        </p>
                      </div>
                      <div>
                        <p className="font-semibold text-gray-400">Name</p>
                        <p className="mt-1 font-mono text-gray-900">
                          {rec.name}
                        </p>
                      </div>
                      <div>
                        <p className="font-semibold text-gray-400">Value</p>
                        <div className="mt-1 flex items-center gap-1">
                          <p className="truncate font-mono text-gray-900">
                            {rec.value}
                          </p>
                          <button
                            type="button"
                            onClick={() => handleCopy(rec.value)}
                            className="shrink-0 rounded p-1 text-gray-400 hover:bg-white hover:text-gray-700"
                          >
                            {copied ? (
                              <Check className="h-3 w-3 text-emerald-600" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : dnsTarget ? (
              <div className="mt-5 rounded-lg border border-gray-200 bg-gray-50 p-4">
                <p className="text-xs font-semibold text-gray-400">
                  Point a CNAME record to:
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <code className="flex-1 rounded bg-white px-3 py-2 font-mono text-sm text-gray-900">
                    {dnsTarget}
                  </code>
                  <button
                    type="button"
                    onClick={() => handleCopy(dnsTarget)}
                    className="rounded-lg border border-gray-200 p-2 text-gray-500 hover:bg-gray-100"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                DNS target is not yet available. The shared website runtime has
                not been fully configured yet, so custom-domain verification
                cannot start.
              </div>
            )}

            <p className="mt-4 text-xs text-gray-500">
              DNS changes can take up to 48 hours to propagate, but typically
              complete within minutes. Click &quot;Verify&quot; once you have
              saved the record.
            </p>

            {domain?.companionHost &&
              !domain.companionDomainId &&
              !companionAdded && (
                <CompanionOffer
                  hostname={domain.hostname}
                  companionHost={domain.companionHost}
                  kind={domain.kind}
                  isPending={companionMutation.isPending}
                  error={companionError}
                  onAdd={() => companionMutation.mutate()}
                />
              )}
            {(companionAdded || domain?.companionDomainId) &&
              domain?.companionHost && (
                <div className="mt-4 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    Companion hostname{" "}
                    <span className="font-mono font-semibold">
                      {domain.companionHost}
                    </span>{" "}
                    is being set up too. It does not consume an extra billing
                    slot.
                  </span>
                </div>
              )}

            <div className="mt-6 flex items-center justify-between">
              {isExistingDomainFlow ? (
                <button
                  type="button"
                  onClick={onClose}
                  className="text-sm text-gray-500 hover:text-gray-800"
                >
                  Close
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setStep("enter")}
                  className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </button>
              )}
              <button
                type="button"
                onClick={() => retryMutation.mutate()}
                disabled={retryMutation.isPending}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {retryMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                Verify DNS
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {step === "verify" && (
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              Verification in progress
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              We checked your DNS records. Here is the current status:
            </p>

            {domain && (
              <div className="mt-5 rounded-lg border border-gray-200 bg-gray-50 p-5">
                <div className="space-y-3 text-sm">
                  <StatusRow label="DNS configured" ok={domain.dnsConfigured} />
                  <StatusRow
                    label="Provider attached"
                    ok={domain.providerAttached}
                  />
                  <StatusRow label="SSL active" ok={domain.sslActive} />
                </div>
                {domain.lastError && (
                  <div className="mt-4 flex items-start gap-2 rounded-lg bg-red-50 p-3 text-xs text-red-700">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {domain.lastError}
                  </div>
                )}
              </div>
            )}

            <p className="mt-4 text-xs text-gray-500">
              If DNS is not yet configured, wait a few minutes for propagation
              and try again. SSL provisioning may take up to 30 minutes after
              DNS is verified.
            </p>

            <div className="mt-6 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep("dns")}
                className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to DNS
              </button>
              <button
                type="button"
                onClick={() => retryMutation.mutate()}
                disabled={retryMutation.isPending}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {retryMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                Re-check
              </button>
            </div>
          </div>
        )}

        {step === "done" && (
          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            </div>
            <h2 className="mt-4 text-xl font-bold text-gray-900">
              Domain connected
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              <span className="font-semibold text-gray-900">
                {domain?.hostname}
              </span>{" "}
              is verified, SSL is active, and guests can now reach your site at
              this address.
            </p>
            {domain?.hostname && (
              <a
                href={`https://${domain.hostname}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-800"
              >
                <ExternalLink className="h-4 w-4" />
                Visit {domain.hostname}
              </a>
            )}
            <div className="mt-6">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-700">{label}</span>
      {ok ? (
        <span className="flex items-center gap-1 text-xs font-semibold text-emerald-700">
          <CheckCircle2 className="h-4 w-4" />
          Yes
        </span>
      ) : (
        <span className="flex items-center gap-1 text-xs font-semibold text-amber-700">
          <AlertTriangle className="h-4 w-4" />
          Not yet
        </span>
      )}
    </div>
  );
}

function HostnameKindPreview({
  classification,
}: {
  classification: ClassifiedHostname;
}) {
  if (classification.kind === "platform-subdomain") {
    return (
      <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          <span className="font-semibold">Platform subdomain.</span> This
          hostname is served by the platform automatically — manage it from the
          site&apos;s public subdomain settings instead of as a custom domain.
        </span>
      </div>
    );
  }

  const guidance: { headline: string; detail: string } =
    classification.kind === "apex"
      ? {
          headline: "Root domain (apex)",
          detail:
            "Most registrars require an A or ALIAS/ANAME record for the root. Some registrars cannot point an apex with a CNAME — use the records shown on the next step.",
        }
      : classification.kind === "www"
        ? {
            headline: "www subdomain",
            detail:
              "Point a CNAME record for `www` to the DNS target shown on the next step. We will also offer to set up the apex so visitors typing the root domain reach your site.",
          }
        : {
            headline: "Subdomain",
            detail: `Point a CNAME for ${classification.hostname} to the DNS target shown on the next step.`,
          };

  return (
    <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs text-blue-800">
      <p className="font-semibold">{guidance.headline}</p>
      <p className="mt-1 text-blue-700">{guidance.detail}</p>
      {classification.companionHost && (
        <p className="mt-1 text-blue-700">
          Companion hostname:{" "}
          <span className="font-mono font-semibold">
            {classification.companionHost}
          </span>
          . Adding it after verification is free.
        </p>
      )}
    </div>
  );
}

function CompanionOffer({
  hostname,
  companionHost,
  kind,
  isPending,
  error,
  onAdd,
}: {
  hostname: string;
  companionHost: string;
  kind: "apex" | "www" | "subdomain" | "platform-subdomain";
  isPending: boolean;
  error: string | null;
  onAdd: () => void;
}) {
  const reason =
    kind === "apex"
      ? "Add the www companion so visitors typing www. also reach your site."
      : "Add the root domain so visitors typing the bare hostname also reach your site.";

  return (
    <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4 text-xs text-blue-900">
      <p className="text-sm font-semibold text-blue-900">
        Also connect {companionHost}?
      </p>
      <p className="mt-1 text-blue-800">{reason}</p>
      <p className="mt-1 text-blue-700">
        Adding the companion of <span className="font-mono">{hostname}</span> is
        free — it doesn&apos;t consume an extra billing slot.
      </p>
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={onAdd}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Plus className="h-3.5 w-3.5" />
          )}
          Connect {companionHost}
        </button>
        {error ? <span className="text-red-700">{error}</span> : null}
      </div>
    </div>
  );
}
