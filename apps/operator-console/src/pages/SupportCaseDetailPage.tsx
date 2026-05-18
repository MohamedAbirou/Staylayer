import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeftRight,
  ChevronRight,
  CircleDot,
  Inbox,
  LifeBuoy,
  Link2,
  Lock,
  MessageCircle,
  ScrollText,
  Send,
  StickyNote,
  Tag,
  UserCircle2,
  UserCog,
  X,
} from "lucide-react";
import {
  acknowledgeSupportCaseHandoff,
  addSupportCaseMessage,
  addSupportCaseNote,
  assignSupportCase,
  closeSupportCase,
  closeSupportCaseHandoff,
  fetchSupportCase,
  linkSupportCaseResource,
  openSupportCaseHandoff,
  reopenSupportCase,
  resolveSupportCase,
  setSupportCaseStatus,
  unlinkSupportCaseResource,
  updateSupportCase,
  type SupportCaseActiveStatus,
  type SupportCaseDetail,
  type SupportCaseEvent,
  type SupportCaseMessage,
  type SupportCaseNote,
  type SupportCaseStatus,
  type SupportHandoffTarget,
  type SupportLinkedResourceType,
} from "../api/operator";
import { DataFreshness } from "../components/DataFreshness";
import { EmptyState } from "../components/EmptyState";
import { ReasonModal } from "../components/ReasonModal";
import { Skeleton } from "../components/Skeleton";
import { StatusBadge } from "../components/StatusBadge";
import {
  OPERATOR_PERMISSIONS,
  PermissionButton,
  usePermissions,
} from "../permissions";
import { useOperatorAuth } from "../auth/useOperatorAuth";
import {
  SUPPORT_CATEGORY_LABELS,
  SUPPORT_PRIORITY_LABELS,
  SUPPORT_STATUS_LABELS,
  formatRelativeTime,
  formatSlaDeadline,
  supportHandoffStatusTone,
  supportHandoffTargetLabel,
  supportPriorityTone,
  supportStatusTone,
} from "../lib/support";

type ModalKind =
  | "assign"
  | "status"
  | "resolve"
  | "reopen"
  | "close"
  | "open-handoff"
  | "close-handoff"
  | null;

interface ModalState {
  kind: ModalKind;
  handoffId?: string;
}

const LINKED_RESOURCE_TYPES: {
  value: SupportLinkedResourceType;
  label: string;
}[] = [
  { value: "TENANT", label: "Tenant" },
  { value: "SITE", label: "Site" },
  { value: "DEPLOYMENT", label: "Deployment" },
  { value: "DOMAIN", label: "Domain" },
  { value: "FORM_DEFINITION", label: "Form definition" },
  { value: "FORM_SUBMISSION", label: "Form submission" },
  { value: "SUBSCRIPTION", label: "Subscription" },
  { value: "OPERATIONAL_ALERT", label: "Operational alert" },
  { value: "USER", label: "User" },
];

const STATUS_OPTIONS: SupportCaseActiveStatus[] = [
  "OPEN",
  "PENDING_CUSTOMER",
  "PENDING_INTERNAL",
];

const HANDOFF_TARGETS: SupportHandoffTarget[] = [
  "BILLING",
  "PLATFORM_OWNER",
  "SUPPORT",
];

export default function SupportCaseDetailPage() {
  const { caseId = "" } = useParams<{ caseId: string }>();
  const queryClient = useQueryClient();
  const { session } = useOperatorAuth();
  const permissions = usePermissions();

  const detailQuery = useQuery({
    queryKey: ["operator-support-case", caseId],
    queryFn: () => fetchSupportCase(caseId),
    enabled: caseId.length > 0,
    staleTime: 15_000,
  });

  const detail = detailQuery.data;

  // Reply / note composers
  const [replyBody, setReplyBody] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [linkResourceType, setLinkResourceType] =
    useState<SupportLinkedResourceType>("DOMAIN");
  const [linkResourceId, setLinkResourceId] = useState("");
  const [linkLabel, setLinkLabel] = useState("");

  // Inline updates (priority/category/tags)
  const [tagsRaw, setTagsRaw] = useState("");
  const [tagsDirty, setTagsDirty] = useState(false);

  // Modal state
  const [modal, setModal] = useState<ModalState>({ kind: null });
  const [modalError, setModalError] = useState<string | null>(null);
  const [assignTo, setAssignTo] = useState<string>("");
  const [statusNext, setStatusNext] = useState<SupportCaseActiveStatus>("OPEN");
  const [closingMessage, setClosingMessage] = useState("");
  const [handoffTarget, setHandoffTarget] =
    useState<SupportHandoffTarget>("BILLING");

  const invalidateCase = () =>
    queryClient.invalidateQueries({
      queryKey: ["operator-support-case", caseId],
    });

  const closeModal = () => {
    setModal({ kind: null });
    setModalError(null);
    setClosingMessage("");
  };

  const replyMutation = useMutation({
    mutationFn: () => addSupportCaseMessage(caseId, { body: replyBody.trim() }),
    onSuccess: () => {
      setReplyBody("");
      void invalidateCase();
    },
  });
  const noteMutation = useMutation({
    mutationFn: () => addSupportCaseNote(caseId, { body: noteBody.trim() }),
    onSuccess: () => {
      setNoteBody("");
      void invalidateCase();
    },
  });
  const linkMutation = useMutation({
    mutationFn: () =>
      linkSupportCaseResource(caseId, {
        resourceType: linkResourceType,
        resourceId: linkResourceId.trim(),
        ...(linkLabel.trim() ? { label: linkLabel.trim() } : {}),
      }),
    onSuccess: () => {
      setLinkResourceId("");
      setLinkLabel("");
      void invalidateCase();
    },
  });
  const unlinkMutation = useMutation({
    mutationFn: (linkId: string) => unlinkSupportCaseResource(caseId, linkId),
    onSuccess: () => invalidateCase(),
  });
  const tagsMutation = useMutation({
    mutationFn: (tags: string[]) => updateSupportCase(caseId, { tags }),
    onSuccess: () => {
      setTagsDirty(false);
      void invalidateCase();
    },
  });
  const ackHandoffMutation = useMutation({
    mutationFn: (handoffId: string) =>
      acknowledgeSupportCaseHandoff(caseId, handoffId),
    onSuccess: () => invalidateCase(),
  });

  const assignMutation = useMutation({
    mutationFn: (reason: string) =>
      assignSupportCase(caseId, {
        assigneeUserId: assignTo.trim() || null,
        reason,
      }),
    onSuccess: () => {
      void invalidateCase();
      closeModal();
    },
    onError: (err) => setModalError(extractErrorMessage(err)),
  });
  const statusMutation = useMutation({
    mutationFn: (reason: string) =>
      setSupportCaseStatus(caseId, {
        status: statusNext,
        ...(reason ? { reason } : {}),
      }),
    onSuccess: () => {
      void invalidateCase();
      closeModal();
    },
    onError: (err) => setModalError(extractErrorMessage(err)),
  });
  const resolveMutation = useMutation({
    mutationFn: (reason: string) =>
      resolveSupportCase(caseId, {
        reason,
        ...(closingMessage.trim()
          ? { closingMessage: closingMessage.trim() }
          : {}),
      }),
    onSuccess: () => {
      void invalidateCase();
      closeModal();
    },
    onError: (err) => setModalError(extractErrorMessage(err)),
  });
  const reopenMutation = useMutation({
    mutationFn: (reason: string) => reopenSupportCase(caseId, { reason }),
    onSuccess: () => {
      void invalidateCase();
      closeModal();
    },
    onError: (err) => setModalError(extractErrorMessage(err)),
  });
  const closeCaseMutation = useMutation({
    mutationFn: (reason: string) => closeSupportCase(caseId, { reason }),
    onSuccess: () => {
      void invalidateCase();
      closeModal();
    },
    onError: (err) => setModalError(extractErrorMessage(err)),
  });
  const openHandoffMutation = useMutation({
    mutationFn: (reason: string) =>
      openSupportCaseHandoff(caseId, { target: handoffTarget, reason }),
    onSuccess: () => {
      void invalidateCase();
      closeModal();
    },
    onError: (err) => setModalError(extractErrorMessage(err)),
  });
  const closeHandoffMutation = useMutation({
    mutationFn: (reason: string) =>
      closeSupportCaseHandoff(caseId, modal.handoffId ?? "", { reason }),
    onSuccess: () => {
      void invalidateCase();
      closeModal();
    },
    onError: (err) => setModalError(extractErrorMessage(err)),
  });

  // Loading / error states
  if (detailQuery.isLoading) {
    return (
      <div className="space-y-4 px-8 py-8">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (detailQuery.isError || !detail) {
    return (
      <div className="px-8 py-8">
        <EmptyState
          title="Support case unavailable"
          description="The case could not be loaded. It may have been removed or you may not have permission to view it."
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

  // Permission gating helpers
  const isTerminal = detail.status === "RESOLVED" || detail.status === "CLOSED";
  const isBillingScoped =
    detail.category === "BILLING" ||
    detail.handoffs.some(
      (h) => h.target === "BILLING" && h.status !== "CLOSED",
    );
  const canReply = permissions.canAny([
    OPERATOR_PERMISSIONS.SUPPORT_CASE_REPLY_ALL,
    ...(isBillingScoped
      ? [OPERATOR_PERMISSIONS.SUPPORT_CASE_REPLY_BILLING]
      : []),
  ]);
  const canNote = permissions.canAny([
    OPERATOR_PERMISSIONS.SUPPORT_CASE_NOTE_ALL,
    ...(isBillingScoped
      ? [OPERATOR_PERMISSIONS.SUPPORT_CASE_NOTE_BILLING]
      : []),
  ]);

  const slaResolution = formatSlaDeadline(detail.resolutionDueAt);
  const slaFirst = formatSlaDeadline(detail.firstResponseDueAt);

  return (
    <div className="px-8 py-8">
      <nav className="flex items-center gap-1 text-xs text-slate-500">
        <Link to="/support" className="hover:text-slate-300">
          Support
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-slate-300">#{detail.number}</span>
      </nav>

      <header className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <LifeBuoy className="mt-1 h-5 w-5 text-cyan-400" />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold text-white">
                #{detail.number} · {detail.subject}
              </h1>
              <StatusBadge
                status={SUPPORT_STATUS_LABELS[detail.status]}
                tone={supportStatusTone(detail.status)}
              />
              <StatusBadge
                status={SUPPORT_PRIORITY_LABELS[detail.priority]}
                tone={supportPriorityTone(detail.priority)}
              />
              <StatusBadge
                status={SUPPORT_CATEGORY_LABELS[detail.category]}
                tone="info"
              />
              {detail.slaBreachedFirstResponse ||
              detail.slaBreachedResolution ? (
                <StatusBadge
                  status={
                    <span className="inline-flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      SLA breached
                    </span>
                  }
                  tone="danger"
                />
              ) : null}
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Opened {formatRelativeTime(detail.createdAt)} · Last activity{" "}
              {formatRelativeTime(detail.lastActivityAt)}
            </p>
          </div>
        </div>
        <DataFreshness generatedAt={new Date().toISOString()} />
      </header>

      {/* Action bar */}
      <div className="mt-6 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-800 bg-slate-900 p-3">
        <PermissionButton
          permission={OPERATOR_PERMISSIONS.SUPPORT_CASE_ASSIGN_ALL}
          onClick={() => {
            setAssignTo(detail.assignedOperatorId ?? "");
            setModal({ kind: "assign" });
          }}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-50"
          disabled={isTerminal}
        >
          <UserCog className="h-3.5 w-3.5" />
          Assign
        </PermissionButton>

        <PermissionButton
          permission={OPERATOR_PERMISSIONS.SUPPORT_CASE_RESOLVE_ALL}
          onClick={() => {
            setStatusNext(
              (detail.status === "OPEN"
                ? "PENDING_CUSTOMER"
                : "OPEN") as SupportCaseActiveStatus,
            );
            setModal({ kind: "status" });
          }}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-50"
          disabled={isTerminal}
        >
          <CircleDot className="h-3.5 w-3.5" />
          Status
        </PermissionButton>

        {!isTerminal ? (
          <PermissionButton
            permission={OPERATOR_PERMISSIONS.SUPPORT_CASE_RESOLVE_ALL}
            onClick={() => setModal({ kind: "resolve" })}
            className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:bg-emerald-900 disabled:text-emerald-300"
          >
            Resolve
          </PermissionButton>
        ) : null}

        {detail.status === "RESOLVED" || detail.status === "CLOSED" ? (
          <PermissionButton
            permission={OPERATOR_PERMISSIONS.SUPPORT_CASE_RESOLVE_ALL}
            onClick={() => setModal({ kind: "reopen" })}
            className="inline-flex items-center gap-1.5 rounded-md border border-cyan-700 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/20"
          >
            Reopen
          </PermissionButton>
        ) : null}

        {detail.status === "RESOLVED" ? (
          <PermissionButton
            permission={OPERATOR_PERMISSIONS.SUPPORT_CASE_RESOLVE_ALL}
            onClick={() => setModal({ kind: "close" })}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700"
          >
            Close
          </PermissionButton>
        ) : null}

        <span className="mx-1 h-5 w-px bg-slate-800" />

        <PermissionButton
          permission={OPERATOR_PERMISSIONS.SUPPORT_CASE_TRANSFER_ALL}
          onClick={() => {
            setHandoffTarget("BILLING");
            setModal({ kind: "open-handoff" });
          }}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800"
        >
          <ArrowLeftRight className="h-3.5 w-3.5" />
          Hand off
        </PermissionButton>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Left column: timeline + composers */}
        <section className="lg:col-span-2 space-y-6">
          <CombinedTimeline detail={detail} />

          <Composer
            title="Reply to customer"
            icon={<MessageCircle className="h-4 w-4 text-cyan-400" />}
            hint="Visible to the requester. Sent immediately."
            value={replyBody}
            onChange={setReplyBody}
            disabled={!canReply || replyMutation.isPending || isTerminal}
            disabledReason={
              !canReply
                ? "You do not have permission to reply on this case."
                : isTerminal
                  ? "Case is closed."
                  : undefined
            }
            submitting={replyMutation.isPending}
            submitLabel="Send reply"
            submitIcon={<Send className="h-3.5 w-3.5" />}
            onSubmit={() => {
              if (replyBody.trim().length === 0) return;
              replyMutation.mutate();
            }}
          />

          <Composer
            title="Internal note"
            icon={<StickyNote className="h-4 w-4 text-amber-400" />}
            hint="Internal only. Never visible to the customer."
            value={noteBody}
            onChange={setNoteBody}
            disabled={!canNote || noteMutation.isPending}
            disabledReason={
              !canNote
                ? "You do not have permission to add notes on this case."
                : undefined
            }
            submitting={noteMutation.isPending}
            submitLabel="Save note"
            submitIcon={<Lock className="h-3.5 w-3.5" />}
            tone="amber"
            onSubmit={() => {
              if (noteBody.trim().length === 0) return;
              noteMutation.mutate();
            }}
          />
        </section>

        {/* Right column: cards */}
        <aside className="space-y-4">
          <Card
            icon={<UserCircle2 className="h-4 w-4 text-cyan-400" />}
            title="People"
          >
            <ul className="space-y-2 text-xs text-slate-300">
              <li>
                <span className="text-[10px] uppercase tracking-widest text-slate-500">
                  Assignee
                </span>
                <p className="mt-0.5 text-slate-200">
                  {detail.assignedOperator
                    ? detail.assignedOperator.email
                    : "Unassigned"}
                </p>
              </li>
              <li>
                <span className="text-[10px] uppercase tracking-widest text-slate-500">
                  Requester
                </span>
                <p className="mt-0.5 text-slate-200">
                  {detail.requesterUser?.email ?? detail.requesterEmail ?? "—"}
                </p>
              </li>
              <li>
                <span className="text-[10px] uppercase tracking-widest text-slate-500">
                  Opened by
                </span>
                <p className="mt-0.5 text-slate-200">
                  {detail.createdByOperator?.email ?? "System"}
                </p>
              </li>
            </ul>
          </Card>

          <Card title="Tenant">
            <Link
              to={`/tenants/${detail.tenantId}`}
              className="block text-sm font-medium text-slate-100 hover:text-cyan-300"
            >
              {detail.tenant.name}
            </Link>
            <p className="text-[11px] text-slate-500">{detail.tenant.slug}</p>
            {detail.site ? (
              <div className="mt-3 border-t border-slate-800 pt-2">
                <span className="text-[10px] uppercase tracking-widest text-slate-500">
                  Site
                </span>
                <Link
                  to={`/sites/${detail.site.id}`}
                  className="mt-0.5 block text-sm font-medium text-slate-100 hover:text-cyan-300"
                >
                  {detail.site.name}
                </Link>
                <p className="text-[11px] text-slate-500">{detail.site.slug}</p>
              </div>
            ) : null}
          </Card>

          <Card title="SLA">
            <ul className="space-y-2 text-xs text-slate-300">
              <li className="flex items-center justify-between">
                <span className="text-slate-500">First response</span>
                <StatusBadge
                  status={
                    detail.slaBreachedFirstResponse
                      ? "Breached"
                      : detail.firstResponseAt
                        ? "Met"
                        : slaFirst.label
                  }
                  tone={
                    detail.slaBreachedFirstResponse
                      ? "danger"
                      : detail.firstResponseAt
                        ? "ok"
                        : slaFirst.tone
                  }
                />
              </li>
              <li className="flex items-center justify-between">
                <span className="text-slate-500">Resolution</span>
                <StatusBadge
                  status={
                    detail.slaBreachedResolution
                      ? "Breached"
                      : detail.resolvedAt
                        ? "Resolved"
                        : slaResolution.label
                  }
                  tone={
                    detail.slaBreachedResolution
                      ? "danger"
                      : detail.resolvedAt
                        ? "ok"
                        : slaResolution.tone
                  }
                />
              </li>
            </ul>
          </Card>

          <Card icon={<Tag className="h-4 w-4 text-cyan-400" />} title="Tags">
            <textarea
              rows={2}
              value={tagsDirty ? tagsRaw : detail.tags.join(", ")}
              onChange={(event) => {
                setTagsRaw(event.target.value);
                setTagsDirty(true);
              }}
              placeholder="comma separated"
              className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
            />
            {tagsDirty ? (
              <div className="mt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setTagsDirty(false);
                    setTagsRaw("");
                  }}
                  className="text-[10px] uppercase tracking-widest text-slate-500 hover:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const next = tagsRaw
                      .split(/[,\n]/)
                      .map((t) => t.trim())
                      .filter((t) => t.length > 0)
                      .slice(0, 20);
                    tagsMutation.mutate(next);
                  }}
                  disabled={tagsMutation.isPending}
                  className="rounded-md bg-cyan-600 px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-white hover:bg-cyan-500 disabled:bg-cyan-900"
                >
                  {tagsMutation.isPending ? "Saving…" : "Save"}
                </button>
              </div>
            ) : null}
          </Card>

          <Card
            icon={<Link2 className="h-4 w-4 text-cyan-400" />}
            title="Linked resources"
          >
            {detail.linkedResources.length === 0 ? (
              <p className="text-xs text-slate-500">No linked resources yet.</p>
            ) : (
              <ul className="space-y-1.5 text-xs">
                {detail.linkedResources.map((res) => (
                  <li
                    key={res.id}
                    className="flex items-center justify-between gap-2 rounded-md border border-slate-800 bg-slate-950 px-2 py-1.5"
                  >
                    <span className="min-w-0">
                      <span className="text-[10px] uppercase tracking-widest text-slate-500">
                        {res.resourceType}
                      </span>
                      <span className="ml-2 font-mono text-[11px] text-slate-300">
                        {res.label ?? res.resourceId}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => unlinkMutation.mutate(res.id)}
                      className="rounded p-1 text-slate-500 hover:bg-slate-800 hover:text-rose-300"
                      aria-label="Unlink"
                      disabled={unlinkMutation.isPending}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 space-y-2 border-t border-slate-800 pt-3">
              <select
                value={linkResourceType}
                onChange={(event) =>
                  setLinkResourceType(
                    event.target.value as SupportLinkedResourceType,
                  )
                }
                className="w-full rounded-md border border-slate-800 bg-slate-950 px-2 py-1.5 text-xs text-slate-200"
              >
                {LINKED_RESOURCE_TYPES.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={linkResourceId}
                onChange={(event) => setLinkResourceId(event.target.value)}
                placeholder="Resource id"
                className="w-full rounded-md border border-slate-800 bg-slate-950 px-2 py-1.5 text-xs text-slate-200 placeholder:text-slate-500"
              />
              <input
                type="text"
                value={linkLabel}
                onChange={(event) => setLinkLabel(event.target.value)}
                placeholder="Label (optional)"
                className="w-full rounded-md border border-slate-800 bg-slate-950 px-2 py-1.5 text-xs text-slate-200 placeholder:text-slate-500"
              />
              <button
                type="button"
                disabled={
                  linkResourceId.trim().length === 0 || linkMutation.isPending
                }
                onClick={() => linkMutation.mutate()}
                className="w-full rounded-md bg-slate-800 px-2 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 disabled:opacity-50"
              >
                {linkMutation.isPending ? "Linking…" : "Link resource"}
              </button>
            </div>
          </Card>

          <Card
            icon={<ArrowLeftRight className="h-4 w-4 text-cyan-400" />}
            title="Handoffs"
          >
            {detail.handoffs.length === 0 ? (
              <p className="text-xs text-slate-500">No handoffs.</p>
            ) : (
              <ul className="space-y-2 text-xs">
                {detail.handoffs.map((h) => (
                  <li
                    key={h.id}
                    className="rounded-md border border-slate-800 bg-slate-950 p-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-200">
                        → {supportHandoffTargetLabel(h.target)}
                      </span>
                      <StatusBadge
                        status={h.status}
                        tone={supportHandoffStatusTone(h.status)}
                      />
                    </div>
                    {h.reason ? (
                      <p className="mt-1 text-[11px] text-slate-400">
                        {h.reason}
                      </p>
                    ) : null}
                    <p className="mt-1 text-[10px] text-slate-500">
                      opened {formatRelativeTime(h.createdAt)}
                      {h.acknowledgedAt
                        ? ` · acked ${formatRelativeTime(h.acknowledgedAt)}`
                        : ""}
                      {h.closedAt
                        ? ` · closed ${formatRelativeTime(h.closedAt)}`
                        : ""}
                    </p>
                    {h.status === "OPEN" ? (
                      <button
                        type="button"
                        onClick={() => ackHandoffMutation.mutate(h.id)}
                        disabled={ackHandoffMutation.isPending}
                        className="mt-2 w-full rounded-md bg-slate-800 px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-slate-200 hover:bg-slate-700"
                      >
                        Acknowledge
                      </button>
                    ) : null}
                    {h.status !== "CLOSED" ? (
                      <PermissionButton
                        permission={
                          OPERATOR_PERMISSIONS.SUPPORT_CASE_TRANSFER_ALL
                        }
                        onClick={() =>
                          setModal({ kind: "close-handoff", handoffId: h.id })
                        }
                        className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-slate-300 hover:bg-slate-800"
                      >
                        Close handoff
                      </PermissionButton>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Identifiers">
            <ul className="space-y-1 text-[11px] text-slate-500">
              <li>
                Case id:{" "}
                <span className="font-mono text-slate-300">{detail.id}</span>
              </li>
              <li>
                Channel:{" "}
                <span className="font-mono text-slate-300">
                  {detail.channel}
                </span>
              </li>
              <li>
                Created:{" "}
                <span className="text-slate-300">
                  {new Date(detail.createdAt).toLocaleString()}
                </span>
              </li>
              {detail.resolvedAt ? (
                <li>
                  Resolved:{" "}
                  <span className="text-slate-300">
                    {new Date(detail.resolvedAt).toLocaleString()}
                  </span>
                </li>
              ) : null}
              {detail.closedAt ? (
                <li>
                  Closed:{" "}
                  <span className="text-slate-300">
                    {new Date(detail.closedAt).toLocaleString()}
                  </span>
                </li>
              ) : null}
            </ul>
          </Card>
        </aside>
      </div>

      {/* Modals */}
      <ReasonModal
        open={modal.kind === "assign"}
        title="Reassign case"
        description="Change the operator owning this case."
        confirmLabel="Apply assignment"
        submitting={assignMutation.isPending}
        error={modalError}
        onCancel={closeModal}
        onConfirm={(reason) => assignMutation.mutate(reason)}
        slotBefore={
          <label className="block text-xs text-slate-300">
            <span className="mb-1 block font-medium text-slate-200">
              New assignee operator id
              <span className="ml-1 text-slate-500">
                (leave blank to unassign)
              </span>
            </span>
            <input
              type="text"
              value={assignTo}
              onChange={(event) => setAssignTo(event.target.value)}
              placeholder={session?.user.id ?? "operator user id"}
              className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
            />
            {session?.user.id && session.user.id !== assignTo ? (
              <button
                type="button"
                onClick={() => setAssignTo(session.user.id)}
                className="mt-1 text-[10px] uppercase tracking-widest text-cyan-400 hover:text-cyan-300"
              >
                Assign to me
              </button>
            ) : null}
          </label>
        }
      />

      <ReasonModal
        open={modal.kind === "status"}
        title="Change status"
        description="Move the case between active states (open, pending customer, pending internal)."
        confirmLabel="Update status"
        submitting={statusMutation.isPending}
        error={modalError}
        reasonRequired={false}
        onCancel={closeModal}
        onConfirm={(reason) => statusMutation.mutate(reason)}
        slotBefore={
          <label className="block text-xs text-slate-300">
            <span className="mb-1 block font-medium text-slate-200">
              New status
            </span>
            <select
              value={statusNext}
              onChange={(event) =>
                setStatusNext(event.target.value as SupportCaseActiveStatus)
              }
              className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-cyan-500 focus:outline-none"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {SUPPORT_STATUS_LABELS[s as SupportCaseStatus]}
                </option>
              ))}
            </select>
          </label>
        }
      />

      <ReasonModal
        open={modal.kind === "resolve"}
        title="Resolve case"
        description="Mark this case as resolved. Optionally send a closing message to the customer."
        confirmLabel="Resolve case"
        confirmTone="primary"
        submitting={resolveMutation.isPending}
        error={modalError}
        onCancel={closeModal}
        onConfirm={(reason) => resolveMutation.mutate(reason)}
        secondaryField={{
          label: "Closing message",
          placeholder: "Optional message visible to the customer.",
          value: closingMessage,
          onChange: setClosingMessage,
          rows: 3,
          maxLength: 20000,
        }}
      />

      <ReasonModal
        open={modal.kind === "reopen"}
        title="Reopen case"
        description="Move a resolved/closed case back to active follow-up."
        confirmLabel="Reopen"
        submitting={reopenMutation.isPending}
        error={modalError}
        onCancel={closeModal}
        onConfirm={(reason) => reopenMutation.mutate(reason)}
      />

      <ReasonModal
        open={modal.kind === "close"}
        title="Close case"
        description="Close a resolved case so it falls out of active queues."
        confirmLabel="Close"
        confirmTone="danger"
        submitting={closeCaseMutation.isPending}
        error={modalError}
        onCancel={closeModal}
        onConfirm={(reason) => closeCaseMutation.mutate(reason)}
      />

      <ReasonModal
        open={modal.kind === "open-handoff"}
        title="Hand off case"
        description="Route this case to another internal team. The original team retains visibility."
        confirmLabel="Open handoff"
        submitting={openHandoffMutation.isPending}
        error={modalError}
        onCancel={closeModal}
        onConfirm={(reason) => openHandoffMutation.mutate(reason)}
        slotBefore={
          <label className="block text-xs text-slate-300">
            <span className="mb-1 block font-medium text-slate-200">
              Target team
            </span>
            <select
              value={handoffTarget}
              onChange={(event) =>
                setHandoffTarget(event.target.value as SupportHandoffTarget)
              }
              className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-cyan-500 focus:outline-none"
            >
              {HANDOFF_TARGETS.map((t) => (
                <option key={t} value={t}>
                  {supportHandoffTargetLabel(t)}
                </option>
              ))}
            </select>
          </label>
        }
      />

      <ReasonModal
        open={modal.kind === "close-handoff"}
        title="Close handoff"
        description="Close this handoff entry. Required before a case can fully transition out of a team."
        confirmLabel="Close handoff"
        submitting={closeHandoffMutation.isPending}
        error={modalError}
        onCancel={closeModal}
        onConfirm={(reason) => closeHandoffMutation.mutate(reason)}
      />
    </div>
  );
}

// ─── Subcomponents ─────────────────────────────────────────────────────

function Card({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
      <header className="mb-3 flex items-center gap-2">
        {icon}
        <h2 className="text-sm font-semibold text-white">{title}</h2>
      </header>
      {children}
    </div>
  );
}

function Composer({
  title,
  icon,
  hint,
  value,
  onChange,
  onSubmit,
  submitting,
  submitLabel,
  submitIcon,
  disabled,
  disabledReason,
  tone = "cyan",
}: {
  title: string;
  icon: React.ReactNode;
  hint: string;
  value: string;
  onChange: (next: string) => void;
  onSubmit: () => void;
  submitting?: boolean;
  submitLabel: string;
  submitIcon?: React.ReactNode;
  disabled?: boolean;
  disabledReason?: string;
  tone?: "cyan" | "amber";
}) {
  const submitClass =
    tone === "amber"
      ? "bg-amber-500 text-slate-950 hover:bg-amber-400 disabled:bg-amber-900 disabled:text-amber-200"
      : "bg-cyan-600 text-white hover:bg-cyan-500 disabled:bg-cyan-900 disabled:text-cyan-300";
  const trimmed = value.trim();
  const canSubmit = !disabled && trimmed.length > 0;
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900">
      <header className="flex items-center gap-2 border-b border-slate-800 px-4 py-3">
        {icon}
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <span className="ml-auto text-[10px] uppercase tracking-widest text-slate-500">
          {hint}
        </span>
      </header>
      <div className="p-4">
        <textarea
          rows={4}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          maxLength={20000}
          placeholder={
            disabled
              ? (disabledReason ?? "Not available.")
              : "Type your message…"
          }
          className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none disabled:opacity-60"
        />
        <div className="mt-2 flex items-center justify-between gap-3">
          <span className="text-[10px] uppercase tracking-widest text-slate-500">
            {trimmed.length} chars
          </span>
          <button
            type="button"
            onClick={onSubmit}
            disabled={!canSubmit}
            title={disabled && disabledReason ? disabledReason : undefined}
            className={[
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold",
              submitClass,
            ].join(" ")}
          >
            {submitIcon}
            {submitting ? "Sending…" : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

interface TimelineItem {
  id: string;
  kind: "message" | "note" | "event";
  createdAt: string;
  payload: SupportCaseMessage | SupportCaseNote | SupportCaseEvent;
}

function CombinedTimeline({ detail }: { detail: SupportCaseDetail }) {
  const items = useMemo<TimelineItem[]>(() => {
    const merged: TimelineItem[] = [
      ...detail.messages.map((m) => ({
        id: `m:${m.id}`,
        kind: "message" as const,
        createdAt: m.createdAt,
        payload: m,
      })),
      ...detail.notes.map((n) => ({
        id: `n:${n.id}`,
        kind: "note" as const,
        createdAt: n.createdAt,
        payload: n,
      })),
      ...detail.events.map((e) => ({
        id: `e:${e.id}`,
        kind: "event" as const,
        createdAt: e.createdAt,
        payload: e,
      })),
    ];
    merged.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return merged;
  }, [detail.messages, detail.notes, detail.events]);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900">
      <header className="flex items-center gap-2 border-b border-slate-800 px-4 py-3">
        <ScrollText className="h-4 w-4 text-cyan-400" />
        <h3 className="text-sm font-semibold text-white">Timeline</h3>
        <span className="ml-auto text-[10px] uppercase tracking-widest text-slate-500">
          {items.length} entries
        </span>
      </header>
      {items.length === 0 ? (
        <EmptyState
          icon={<Inbox className="h-5 w-5" />}
          title="No activity yet"
          description="Messages, notes and lifecycle events will appear here."
        />
      ) : (
        <ol className="divide-y divide-slate-800">
          {items.map((item) => (
            <li key={item.id} className="px-4 py-3">
              {renderTimelineItem(item)}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function renderTimelineItem(item: TimelineItem) {
  if (item.kind === "message") {
    const m = item.payload as SupportCaseMessage;
    const isOperator = m.authorIsOperator;
    return (
      <article
        className={[
          "rounded-md border px-3 py-2 text-sm",
          isOperator
            ? "border-cyan-500/30 bg-cyan-500/5"
            : "border-slate-800 bg-slate-950",
        ].join(" ")}
      >
        <header className="mb-1 flex items-center justify-between gap-2 text-[11px] text-slate-400">
          <span className="font-semibold text-slate-200">
            {isOperator ? "Operator reply" : "Customer message"} ·{" "}
            {m.author?.email ?? "—"}
          </span>
          <span>{formatRelativeTime(m.createdAt)}</span>
        </header>
        <pre className="whitespace-pre-wrap font-sans text-sm text-slate-100">
          {m.body}
        </pre>
      </article>
    );
  }
  if (item.kind === "note") {
    const n = item.payload as SupportCaseNote;
    return (
      <article className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm">
        <header className="mb-1 flex items-center justify-between gap-2 text-[11px] text-amber-200">
          <span className="inline-flex items-center gap-1 font-semibold">
            <Lock className="h-3 w-3" />
            Internal note · {n.author?.email ?? "—"}
          </span>
          <span className="text-amber-200/70">
            {formatRelativeTime(n.createdAt)}
          </span>
        </header>
        <pre className="whitespace-pre-wrap font-sans text-sm text-amber-50">
          {n.body}
        </pre>
      </article>
    );
  }
  const e = item.payload as SupportCaseEvent;
  return (
    <article className="flex items-start gap-3 text-xs text-slate-400">
      <span className="mt-1 flex h-2 w-2 shrink-0 rounded-full bg-slate-500" />
      <div className="min-w-0 flex-1">
        <p className="text-slate-300">
          <span className="font-semibold text-slate-200">
            {prettyEventType(e.type)}
          </span>
          {renderEventDelta(e)}
          {e.actor ? (
            <span className="text-slate-500"> · by {e.actor.email}</span>
          ) : null}
          <span className="ml-2 text-slate-500">
            {formatRelativeTime(e.createdAt)}
          </span>
        </p>
        {e.message ? (
          <p className="mt-0.5 text-[11px] text-slate-500">{e.message}</p>
        ) : null}
      </div>
    </article>
  );
}

function prettyEventType(type: SupportCaseEvent["type"]): string {
  return type
    .toLowerCase()
    .split("_")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}

function renderEventDelta(e: SupportCaseEvent): React.ReactNode {
  if (!e.fromValue && !e.toValue) return null;
  return (
    <span className="text-slate-500">
      {" "}
      ·{" "}
      <span className="font-mono text-[10px] text-slate-400">
        {e.fromValue ?? "—"}
      </span>{" "}
      →{" "}
      <span className="font-mono text-[10px] text-slate-200">
        {e.toValue ?? "—"}
      </span>
    </span>
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
  return "Action failed. Please retry.";
}
