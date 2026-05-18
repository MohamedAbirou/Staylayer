import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ChevronRight, LifeBuoy } from "lucide-react";
import {
  createSupportCase,
  fetchGlobalSearch,
  type CreateSupportCaseInput,
  type SupportCaseCategory,
  type SupportCaseChannel,
  type SupportCasePriority,
} from "../api/operator";
import {
  SUPPORT_CATEGORY_LABELS,
  SUPPORT_CATEGORY_VALUES,
  SUPPORT_PRIORITY_LABELS,
  SUPPORT_PRIORITY_VALUES,
} from "../lib/support";
import {
  OPERATOR_PERMISSIONS,
  PermissionButton,
  usePermissions,
} from "../permissions";
import { EmptyState } from "../components/EmptyState";

const CHANNEL_OPTIONS: { value: SupportCaseChannel; label: string }[] = [
  { value: "MANUAL", label: "Manual (operator opened)" },
  { value: "EMAIL", label: "Email" },
  { value: "CUSTOMER_WORKSPACE", label: "Customer workspace" },
  { value: "SYSTEM_ALERT", label: "System alert" },
  { value: "BILLING", label: "Billing" },
  { value: "WEBHOOK", label: "Webhook" },
];

/**
 * Form to open a new support case manually. Hits `POST /operator/support-cases`
 * which is gated by `support_case.create.all` (sensitive, requires reason).
 *
 * Tenant resolution: operators can drop in via Tenant 360 ("Open case") and
 * the tenant is pre-filled from the `tenantId` query param. When the field is
 * empty we use the global search endpoint to find a tenant by name/slug/id.
 */
export default function SupportCaseNewPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const permissions = usePermissions();

  const [tenantId, setTenantId] = useState(params.get("tenantId") ?? "");
  const [tenantQuery, setTenantQuery] = useState("");
  const [siteId, setSiteId] = useState(params.get("siteId") ?? "");
  const [subject, setSubject] = useState("");
  const [initialMessage, setInitialMessage] = useState("");
  const [channel, setChannel] = useState<SupportCaseChannel>("MANUAL");
  const [priority, setPriority] = useState<SupportCasePriority>("NORMAL");
  const [category, setCategory] = useState<SupportCaseCategory>("OTHER");
  const [tagsRaw, setTagsRaw] = useState("");
  const [assignedOperatorId, setAssignedOperatorId] = useState("");
  const [requesterEmail, setRequesterEmail] = useState("");
  const [reason, setReason] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canCreate = permissions.can(
    OPERATOR_PERMISSIONS.SUPPORT_CASE_CREATE_ALL,
  );

  const tenantSearchQuery = useQuery({
    queryKey: ["operator-support-new-tenant-search", tenantQuery],
    queryFn: () => fetchGlobalSearch(tenantQuery, 8),
    enabled: tenantQuery.trim().length >= 2,
    staleTime: 30_000,
  });

  const tags = useMemo(
    () =>
      tagsRaw
        .split(/[,\n]/)
        .map((t) => t.trim())
        .filter((t) => t.length > 0)
        .slice(0, 20),
    [tagsRaw],
  );

  const mutation = useMutation({
    mutationFn: async () => {
      const input: CreateSupportCaseInput = {
        tenantId: tenantId.trim(),
        subject: subject.trim(),
        channel,
        priority,
        category,
        ...(siteId.trim() ? { siteId: siteId.trim() } : {}),
        ...(initialMessage.trim()
          ? { initialMessage: initialMessage.trim() }
          : {}),
        ...(tags.length ? { tags } : {}),
        ...(assignedOperatorId.trim()
          ? { assignedOperatorId: assignedOperatorId.trim() }
          : {}),
        ...(requesterEmail.trim()
          ? { requesterEmail: requesterEmail.trim() }
          : {}),
        ...(reason.trim() ? { reason: reason.trim() } : {}),
      };
      return createSupportCase(input);
    },
    onSuccess: (data) => {
      navigate(`/support/${data.id}`);
    },
    onError: (err: unknown) => {
      setErrorMessage(extractErrorMessage(err));
    },
  });

  const submitDisabled =
    !canCreate ||
    !tenantId.trim() ||
    !subject.trim() ||
    !reason.trim() ||
    mutation.isPending;

  if (!canCreate) {
    return (
      <div className="px-8 py-8">
        <EmptyState
          title="Insufficient permission"
          description="You do not have permission to open new support cases."
          action={
            <Link
              to="/support"
              className="text-xs text-cyan-400 hover:underline"
            >
              Back to inbox
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="px-8 py-8">
      <nav className="flex items-center gap-1 text-xs text-slate-500">
        <Link to="/support" className="hover:text-slate-300">
          Support
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-slate-300">New case</span>
      </nav>

      <header className="mt-3 flex items-center gap-3">
        <LifeBuoy className="h-5 w-5 text-cyan-400" />
        <div>
          <h1 className="text-xl font-semibold text-white">
            Open support case
          </h1>
          <p className="text-xs text-slate-400">
            Manually file a case on behalf of a tenant. The action is recorded
            in the operator audit log.
          </p>
        </div>
      </header>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (submitDisabled) return;
          setErrorMessage(null);
          mutation.mutate();
        }}
        className="mt-6 grid gap-6 lg:grid-cols-3"
      >
        <section className="lg:col-span-2 space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <Field label="Tenant" required hint="Workspace this case belongs to.">
            <div className="space-y-2">
              <input
                type="text"
                value={tenantId}
                onChange={(event) => setTenantId(event.target.value)}
                placeholder="Tenant id (cuid)"
                className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
              />
              <input
                type="search"
                value={tenantQuery}
                onChange={(event) => setTenantQuery(event.target.value)}
                placeholder="Search by name, slug or id…"
                className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-300 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
              />
              {tenantSearchQuery.data?.tenants?.length ? (
                <ul className="max-h-48 overflow-y-auto rounded-md border border-slate-800 bg-slate-950 text-xs">
                  {tenantSearchQuery.data.tenants.map((t) => (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setTenantId(t.id);
                          setTenantQuery("");
                        }}
                        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-slate-800/60"
                      >
                        <span className="text-slate-200">{t.name}</span>
                        <span className="font-mono text-[10px] text-slate-500">
                          {t.slug}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </Field>

          <Field label="Site id" hint="Optional. Restricts to a specific site.">
            <input
              type="text"
              value={siteId}
              onChange={(event) => setSiteId(event.target.value)}
              placeholder="Site id (optional)"
              className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
            />
          </Field>

          <Field label="Subject" required>
            <input
              type="text"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              maxLength={200}
              required
              placeholder="Short summary of the issue"
              className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
            />
          </Field>

          <Field
            label="Initial message"
            hint="Optional. Visible to the customer."
          >
            <textarea
              rows={5}
              value={initialMessage}
              onChange={(event) => setInitialMessage(event.target.value)}
              maxLength={20000}
              placeholder="Customer-visible context for the case…"
              className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
            />
          </Field>

          <Field
            label="Requester email"
            hint="Optional. Used when there is no linked customer user yet."
          >
            <input
              type="email"
              value={requesterEmail}
              onChange={(event) => setRequesterEmail(event.target.value)}
              placeholder="customer@example.com"
              className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
            />
          </Field>

          <Field
            label="Reason for opening this case"
            required
            hint="Recorded in the operator audit log (sensitive action)."
          >
            <textarea
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={2000}
              placeholder="Why is this case being opened manually?"
              className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
            />
          </Field>
        </section>

        <aside className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <Field label="Channel">
            <select
              value={channel}
              onChange={(event) =>
                setChannel(event.target.value as SupportCaseChannel)
              }
              className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-cyan-500 focus:outline-none"
            >
              {CHANNEL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Priority">
            <select
              value={priority}
              onChange={(event) =>
                setPriority(event.target.value as SupportCasePriority)
              }
              className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-cyan-500 focus:outline-none"
            >
              {SUPPORT_PRIORITY_VALUES.map((value) => (
                <option key={value} value={value}>
                  {SUPPORT_PRIORITY_LABELS[value]}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Category">
            <select
              value={category}
              onChange={(event) =>
                setCategory(event.target.value as SupportCaseCategory)
              }
              className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-cyan-500 focus:outline-none"
            >
              {SUPPORT_CATEGORY_VALUES.map((value) => (
                <option key={value} value={value}>
                  {SUPPORT_CATEGORY_LABELS[value]}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Tags" hint="Comma or newline separated. Max 20.">
            <textarea
              rows={3}
              value={tagsRaw}
              onChange={(event) => setTagsRaw(event.target.value)}
              placeholder="vip, dns, escalated"
              className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
            />
            {tags.length > 0 ? (
              <p className="mt-1 flex flex-wrap gap-1 text-[10px] text-slate-500">
                {tags.map((t) => (
                  <span key={t} className="rounded bg-slate-800 px-1.5 py-0.5">
                    #{t}
                  </span>
                ))}
              </p>
            ) : null}
          </Field>

          <Field
            label="Assignee operator id"
            hint="Optional. Leave blank to leave unassigned."
          >
            <input
              type="text"
              value={assignedOperatorId}
              onChange={(event) => setAssignedOperatorId(event.target.value)}
              placeholder="operator user id"
              className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
            />
          </Field>

          {errorMessage ? (
            <p
              role="alert"
              className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300"
            >
              {errorMessage}
            </p>
          ) : null}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => navigate("/support")}
              className="rounded-md border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800"
            >
              Cancel
            </button>
            <PermissionButton
              permission={OPERATOR_PERMISSIONS.SUPPORT_CASE_CREATE_ALL}
              type="submit"
              disabled={submitDisabled}
              className="rounded-md bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-500 disabled:bg-cyan-900 disabled:text-cyan-300"
            >
              {mutation.isPending ? "Creating…" : "Open case"}
            </PermissionButton>
          </div>
        </aside>
      </form>
    </div>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-xs text-slate-300">
      <span className="mb-1 block font-medium text-slate-200">
        {label}
        {required ? <span className="ml-1 text-rose-400">*</span> : null}
      </span>
      {children}
      {hint ? (
        <span className="mt-1 block text-[10px] text-slate-500">{hint}</span>
      ) : null}
    </label>
  );
}

function extractErrorMessage(err: unknown): string {
  if (typeof err === "object" && err !== null) {
    const maybeAxios = err as {
      response?: { data?: { message?: string | string[] } };
      message?: string;
    };
    const msg = maybeAxios.response?.data?.message;
    if (Array.isArray(msg)) return msg.join("; ");
    if (typeof msg === "string") return msg;
    if (maybeAxios.message) return maybeAxios.message;
  }
  return "Failed to create support case.";
}
