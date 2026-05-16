import { useMemo, useState } from "react";
import type React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  UserCircle,
  X,
} from "lucide-react";

import {
  bulkUpdateAuditTasks,
  createAuditTask,
  deleteAuditTask,
  getAuditTaskSummary,
  listAuditTaskAssignees,
  listAuditTasks,
  updateAuditTask,
  type BulkAuditTaskAction,
  type SeoAuditTaskAssigneeDto,
  type SeoAuditTaskDto,
  type SeoAuditTaskPriority,
  type SeoAuditTaskStatus,
} from "../../api/seo";

interface Props {
  siteId: string;
}

const STATUS_LABELS: Record<SeoAuditTaskStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  RESOLVED: "Resolved",
  DISMISSED: "Dismissed",
};

const STATUS_BADGE: Record<SeoAuditTaskStatus, string> = {
  OPEN: "bg-sky-100 text-sky-800 border-sky-200",
  IN_PROGRESS: "bg-violet-100 text-violet-800 border-violet-200",
  RESOLVED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  DISMISSED: "bg-slate-100 text-slate-700 border-slate-200",
};

const PRIORITY_LABELS: Record<SeoAuditTaskPriority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  CRITICAL: "Critical",
};

const PRIORITY_BADGE: Record<SeoAuditTaskPriority, string> = {
  LOW: "bg-slate-100 text-slate-700 border-slate-200",
  MEDIUM: "bg-blue-100 text-blue-800 border-blue-200",
  HIGH: "bg-amber-100 text-amber-800 border-amber-200",
  CRITICAL: "bg-red-100 text-red-800 border-red-200",
};

const STATUSES: (SeoAuditTaskStatus | "ALL")[] = [
  "OPEN",
  "IN_PROGRESS",
  "RESOLVED",
  "DISMISSED",
  "ALL",
];
const PRIORITIES: SeoAuditTaskPriority[] = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL",
];

export function AuditTasksPanel({ siteId }: Props): React.ReactElement {
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<SeoAuditTaskStatus | "ALL">(
    "OPEN",
  );
  const [priorityFilter, setPriorityFilter] = useState<
    SeoAuditTaskPriority | "ALL"
  >("ALL");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("ALL");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);

  const summaryQuery = useQuery({
    queryKey: ["seo-audit-task-summary", siteId],
    queryFn: () => getAuditTaskSummary(siteId),
  });

  const assigneesQuery = useQuery({
    queryKey: ["seo-audit-task-assignees", siteId],
    queryFn: () => listAuditTaskAssignees(siteId),
  });

  const tasksQuery = useQuery({
    queryKey: [
      "seo-audit-tasks",
      siteId,
      statusFilter,
      priorityFilter,
      assigneeFilter,
    ],
    queryFn: () =>
      listAuditTasks(siteId, {
        status: statusFilter,
        priority: priorityFilter === "ALL" ? undefined : priorityFilter,
        assigneeUserId:
          assigneeFilter === "ALL" || assigneeFilter === "UNASSIGNED"
            ? undefined
            : assigneeFilter,
        unassigned: assigneeFilter === "UNASSIGNED",
      }),
  });

  const tasks = tasksQuery.data ?? [];
  const visibleIds = useMemo(() => tasks.map((t) => t.id), [tasks]);
  const allSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));

  const invalidate = () => {
    void queryClient.invalidateQueries({
      queryKey: ["seo-audit-tasks", siteId],
    });
    void queryClient.invalidateQueries({
      queryKey: ["seo-audit-task-summary", siteId],
    });
  };

  const bulkMutation = useMutation({
    mutationFn: ({ action }: { action: BulkAuditTaskAction }) =>
      bulkUpdateAuditTasks(siteId, Array.from(selected), action),
    onSuccess: () => {
      setSelected(new Set());
      invalidate();
    },
  });

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(visibleIds));
    }
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const summary = summaryQuery.data;
  const assignees = assigneesQuery.data ?? [];

  return (
    <div className="space-y-6">
      <SummaryCard summary={summary} isLoading={summaryQuery.isLoading} />

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-slate-500" />
            <h2 className="text-lg font-semibold text-slate-900">
              Audit Tasks
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void tasksQuery.refetch()}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
            >
              <Plus className="h-4 w-4" />
              New task
            </button>
          </div>
        </header>

        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-5 py-3">
          <FilterChips
            label="Status"
            options={STATUSES.map((s) => ({
              value: s,
              label: s === "ALL" ? "All" : STATUS_LABELS[s],
            }))}
            value={statusFilter}
            onChange={(v) => setStatusFilter(v as SeoAuditTaskStatus | "ALL")}
          />
          <FilterChips
            label="Priority"
            options={[
              { value: "ALL", label: "All" },
              ...PRIORITIES.map((p) => ({
                value: p,
                label: PRIORITY_LABELS[p],
              })),
            ]}
            value={priorityFilter}
            onChange={(v) =>
              setPriorityFilter(v as SeoAuditTaskPriority | "ALL")
            }
          />
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Assignee
            </span>
            <select
              value={assigneeFilter}
              onChange={(e) => setAssigneeFilter(e.target.value)}
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm"
            >
              <option value="ALL">All</option>
              <option value="UNASSIGNED">Unassigned</option>
              {assignees.map((a) => (
                <option key={a.userId} value={a.userId}>
                  {a.email}
                </option>
              ))}
            </select>
          </div>
        </div>

        {selected.size > 0 && (
          <BulkActionBar
            count={selected.size}
            assignees={assignees}
            disabled={bulkMutation.isPending}
            onAction={(action) => bulkMutation.mutate({ action })}
            onClear={() => setSelected(new Set())}
          />
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-2 text-left">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label="Select all"
                  />
                </th>
                <th className="px-4 py-2 text-left font-medium text-slate-600">
                  Title
                </th>
                <th className="px-4 py-2 text-left font-medium text-slate-600">
                  Page
                </th>
                <th className="px-4 py-2 text-left font-medium text-slate-600">
                  Status
                </th>
                <th className="px-4 py-2 text-left font-medium text-slate-600">
                  Priority
                </th>
                <th className="px-4 py-2 text-left font-medium text-slate-600">
                  Assignee
                </th>
                <th className="px-4 py-2 text-left font-medium text-slate-600">
                  Source
                </th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tasksQuery.isLoading ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-8 text-center text-slate-500"
                  >
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </td>
                </tr>
              ) : tasks.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-8 text-center text-slate-500"
                  >
                    No tasks match the current filters.
                  </td>
                </tr>
              ) : (
                tasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    selected={selected.has(task.id)}
                    onToggle={() => toggleOne(task.id)}
                    siteId={siteId}
                    assignees={assignees}
                    onChanged={invalidate}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {bulkMutation.isError && (
          <div className="border-t border-red-200 bg-red-50 px-5 py-2 text-sm text-red-700">
            {(bulkMutation.error as Error).message ?? "Bulk action failed"}
          </div>
        )}
      </section>

      {creating && (
        <NewTaskModal
          siteId={siteId}
          assignees={assignees}
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            invalidate();
          }}
        />
      )}
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────

function SummaryCard({
  summary,
  isLoading,
}: {
  summary: ReturnType<typeof getAuditTaskSummary> extends Promise<infer R>
    ? R | undefined
    : never;
  isLoading: boolean;
}) {
  const cells: { label: string; value: number | string; emphasis?: boolean }[] =
    [
      { label: "Open", value: summary?.open ?? 0 },
      { label: "In progress", value: summary?.inProgress ?? 0 },
      { label: "Resolved", value: summary?.resolved ?? 0 },
      { label: "Unassigned", value: summary?.unassigned ?? 0 },
      {
        label: "Critical open",
        value: summary?.criticalOpen ?? 0,
        emphasis: (summary?.criticalOpen ?? 0) > 0,
      },
    ];
  return (
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      {cells.map((c) => (
        <div
          key={c.label}
          className={`rounded-xl border bg-white px-4 py-3 shadow-sm ${
            c.emphasis ? "border-red-300" : "border-slate-200"
          }`}
        >
          <div className="text-xs uppercase tracking-wide text-slate-500">
            {c.label}
          </div>
          <div
            className={`mt-1 text-2xl font-semibold ${
              c.emphasis ? "text-red-700" : "text-slate-900"
            }`}
          >
            {isLoading ? "—" : c.value}
          </div>
        </div>
      ))}
    </section>
  );
}

function FilterChips<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <div className="inline-flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
              value === opt.value
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function BulkActionBar({
  count,
  assignees,
  disabled,
  onAction,
  onClear,
}: {
  count: number;
  assignees: SeoAuditTaskAssigneeDto[];
  disabled: boolean;
  onAction: (action: BulkAuditTaskAction) => void;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-slate-50 px-5 py-2 text-sm">
      <span className="font-medium text-slate-700">{count} selected</span>

      <div className="flex items-center gap-1">
        <span className="text-xs text-slate-500">Status:</span>
        {(
          [
            "OPEN",
            "IN_PROGRESS",
            "RESOLVED",
            "DISMISSED",
          ] as SeoAuditTaskStatus[]
        ).map((s) => (
          <button
            key={s}
            type="button"
            disabled={disabled}
            onClick={() => onAction({ kind: "STATUS", status: s })}
            className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-xs hover:bg-slate-100 disabled:opacity-50"
          >
            {STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1">
        <span className="text-xs text-slate-500">Priority:</span>
        {PRIORITIES.map((p) => (
          <button
            key={p}
            type="button"
            disabled={disabled}
            onClick={() => onAction({ kind: "PRIORITY", priority: p })}
            className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-xs hover:bg-slate-100 disabled:opacity-50"
          >
            {PRIORITY_LABELS[p]}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1">
        <span className="text-xs text-slate-500">Assign:</span>
        <select
          disabled={disabled}
          onChange={(e) => {
            const v = e.target.value;
            if (!v) return;
            onAction({
              kind: "ASSIGN",
              assigneeUserId: v === "__none__" ? null : v,
            });
            e.target.value = "";
          }}
          className="rounded-md border border-slate-300 bg-white px-2 py-0.5 text-xs"
          defaultValue=""
        >
          <option value="">Pick…</option>
          <option value="__none__">Unassign</option>
          {assignees.map((a) => (
            <option key={a.userId} value={a.userId}>
              {a.email}
            </option>
          ))}
        </select>
      </div>

      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (
            window.confirm(`Delete ${count} task${count === 1 ? "" : "s"}?`)
          ) {
            onAction({ kind: "DELETE" });
          }
        }}
        className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-white px-2 py-0.5 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50"
      >
        <Trash2 className="h-3 w-3" />
        Delete
      </button>

      <button
        type="button"
        onClick={onClear}
        className="ml-auto inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900"
      >
        <X className="h-3 w-3" /> Clear selection
      </button>
    </div>
  );
}

function TaskRow({
  task,
  selected,
  onToggle,
  siteId,
  assignees,
  onChanged,
}: {
  task: SeoAuditTaskDto;
  selected: boolean;
  onToggle: () => void;
  siteId: string;
  assignees: SeoAuditTaskAssigneeDto[];
  onChanged: () => void;
}) {
  const updateMutation = useMutation({
    mutationFn: (patch: Parameters<typeof updateAuditTask>[2]) =>
      updateAuditTask(siteId, task.id, patch),
    onSuccess: onChanged,
  });
  const deleteMutation = useMutation({
    mutationFn: () => deleteAuditTask(siteId, task.id),
    onSuccess: onChanged,
  });

  return (
    <tr className={selected ? "bg-sky-50" : "hover:bg-slate-50"}>
      <td className="px-4 py-2 align-top">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          aria-label="Select task"
        />
      </td>
      <td className="px-4 py-2 align-top">
        <div className="font-medium text-slate-900">{task.title}</div>
        {task.description && (
          <div className="mt-0.5 text-xs text-slate-500">
            {task.description}
          </div>
        )}
      </td>
      <td className="px-4 py-2 align-top text-xs text-slate-600">
        <div className="font-mono">{task.slug}</div>
        <div className="text-slate-400">{task.locale}</div>
      </td>
      <td className="px-4 py-2 align-top">
        <select
          value={task.status}
          disabled={updateMutation.isPending}
          onChange={(e) =>
            updateMutation.mutate({
              status: e.target.value as SeoAuditTaskStatus,
            })
          }
          className={`rounded-md border px-2 py-0.5 text-xs ${STATUS_BADGE[task.status]}`}
        >
          {(Object.keys(STATUS_LABELS) as SeoAuditTaskStatus[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </td>
      <td className="px-4 py-2 align-top">
        <select
          value={task.priority}
          disabled={updateMutation.isPending}
          onChange={(e) =>
            updateMutation.mutate({
              priority: e.target.value as SeoAuditTaskPriority,
            })
          }
          className={`rounded-md border px-2 py-0.5 text-xs ${PRIORITY_BADGE[task.priority]}`}
        >
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABELS[p]}
            </option>
          ))}
        </select>
      </td>
      <td className="px-4 py-2 align-top">
        <select
          value={task.assigneeUserId ?? ""}
          disabled={updateMutation.isPending}
          onChange={(e) =>
            updateMutation.mutate({
              assigneeUserId: e.target.value || null,
            })
          }
          className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-xs"
        >
          <option value="">Unassigned</option>
          {assignees.map((a) => (
            <option key={a.userId} value={a.userId}>
              {a.email}
            </option>
          ))}
        </select>
      </td>
      <td className="px-4 py-2 align-top">
        {task.source === "ALERT" ? (
          <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs text-amber-800">
            <AlertCircle className="h-3 w-3" /> Alert
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-700">
            <UserCircle className="h-3 w-3" /> Manual
          </span>
        )}
      </td>
      <td className="px-4 py-2 align-top text-right">
        <button
          type="button"
          onClick={() => {
            if (window.confirm(`Delete task "${task.title}"?`)) {
              deleteMutation.mutate();
            }
          }}
          disabled={deleteMutation.isPending}
          className="text-xs text-red-600 hover:text-red-800 disabled:opacity-50"
          aria-label="Delete task"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </td>
    </tr>
  );
}

function NewTaskModal({
  siteId,
  assignees,
  onClose,
  onCreated,
}: {
  siteId: string;
  assignees: SeoAuditTaskAssigneeDto[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("/");
  const [locale, setLocale] = useState("en");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<SeoAuditTaskPriority>("MEDIUM");
  const [assigneeUserId, setAssigneeUserId] = useState<string>("");

  const mutation = useMutation({
    mutationFn: () =>
      createAuditTask(siteId, {
        title: title.trim(),
        slug: slug.trim(),
        locale: locale.trim(),
        description: description.trim() || null,
        priority,
        assigneeUserId: assigneeUserId || null,
      }),
    onSuccess: onCreated,
  });

  const canSubmit =
    title.trim().length > 0 &&
    slug.trim().length > 0 &&
    locale.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h3 className="text-lg font-semibold text-slate-900">
            New audit task
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-500 hover:text-slate-900"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="space-y-3 px-5 py-4 text-sm">
          <Field label="Title">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-2 py-1"
              placeholder="Investigate CWV regression on /home"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Slug">
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-2 py-1 font-mono"
              />
            </Field>
            <Field label="Locale">
              <input
                type="text"
                value={locale}
                onChange={(e) => setLocale(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-2 py-1"
              />
            </Field>
          </div>
          <Field label="Description">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-slate-300 px-2 py-1"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Priority">
              <select
                value={priority}
                onChange={(e) =>
                  setPriority(e.target.value as SeoAuditTaskPriority)
                }
                className="w-full rounded-md border border-slate-300 px-2 py-1"
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_LABELS[p]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Assignee">
              <select
                value={assigneeUserId}
                onChange={(e) => setAssigneeUserId(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-2 py-1"
              >
                <option value="">Unassigned</option>
                {assignees.map((a) => (
                  <option key={a.userId} value={a.userId}>
                    {a.email}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          {mutation.isError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {(mutation.error as Error).message ?? "Failed to create task"}
            </div>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSubmit || mutation.isPending}
            onClick={() => mutation.mutate()}
            className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {mutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            Create task
          </button>
        </footer>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}
