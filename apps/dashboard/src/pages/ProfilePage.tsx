import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  LogOut,
  Mail,
  Shield,
  Star,
  Trash2,
  UserCircle2,
  Users,
} from "lucide-react";
import toast from "react-hot-toast";
import axios from "axios";
import { useAuth } from "../auth/useAuth";
import { describeMembershipRole } from "../auth/access";
import { formatDate } from "../lib/formatDate";
import {
  changeProfilePassword,
  deleteOwnAccount,
  getAccountDeletionImpact,
  getProfileOverview,
  leaveWorkspace,
  setDefaultMembership,
  type ProfileMembershipSummary,
  type ProfileOverview,
} from "../api/profile";
import {
  getNotificationPreferences,
  upsertNotificationPreference,
  type NotificationCategory,
  type NotificationChannel,
  type NotificationPreference,
} from "../api/notifications";

const NOTIFICATION_CATEGORIES: {
  value: NotificationCategory;
  label: string;
}[] = [
  { value: "DEPLOYMENT", label: "Deployments" },
  { value: "DOMAIN", label: "Domains" },
  { value: "BILLING", label: "Billing" },
  { value: "FORM_SUBMISSION", label: "Form submissions" },
  { value: "SYSTEM", label: "System & security" },
];

const NOTIFICATION_CHANNELS: { value: NotificationChannel; label: string }[] = [
  { value: "IN_APP", label: "In-app" },
  { value: "EMAIL", label: "Email" },
];

function extractErrorCode(error: unknown): {
  code: string | null;
  message: string;
  details: unknown;
} {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | { code?: string; message?: string; details?: unknown }
      | undefined;
    return {
      code: data?.code ?? null,
      message:
        data?.message ?? error.message ?? "Something went wrong. Please retry.",
      details: data?.details ?? null,
    };
  }
  return {
    code: null,
    message: error instanceof Error ? error.message : "Unexpected error",
    details: null,
  };
}

function SectionCard({
  title,
  description,
  children,
  tone = "default",
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  tone?: "default" | "danger";
}) {
  const border = tone === "danger" ? "border-red-200" : "border-slate-200";
  const headerBg = tone === "danger" ? "bg-red-50/60" : "bg-slate-50/80";
  return (
    <section
      className={`overflow-hidden rounded-3xl border ${border} bg-white shadow-sm`}
    >
      <header className={`border-b ${border} ${headerBg} px-6 py-4`}>
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm text-slate-600">{description}</p>
        ) : null}
      </header>
      <div className="px-6 py-6">{children}</div>
    </section>
  );
}

function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const mutation = useMutation({
    mutationFn: changeProfilePassword,
    onSuccess: () => {
      toast.success("Password updated.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (error) => {
      const { message } = extractErrorCode(error);
      toast.error(message);
    },
  });

  const validation = useMemo(() => {
    if (!newPassword) return null;
    if (newPassword.length < 12)
      return "New password must be at least 12 characters.";
    if (newPassword === currentPassword)
      return "New password must be different from your current one.";
    if (confirmPassword && newPassword !== confirmPassword)
      return "New password and confirmation must match.";
    return null;
  }, [newPassword, currentPassword, confirmPassword]);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (validation) {
      toast.error(validation);
      return;
    }
    if (!currentPassword || !newPassword) {
      toast.error("Both password fields are required.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New password and confirmation must match.");
      return;
    }
    mutation.mutate({ currentPassword, newPassword });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-sm font-medium text-slate-700">
          Current password
        </label>
        <div className="relative mt-1">
          <input
            type={showCurrent ? "text" : "password"}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 pr-10 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
          />
          <button
            type="button"
            onClick={() => setShowCurrent((v) => !v)}
            className="absolute inset-y-0 right-2 my-auto flex h-7 w-7 items-center justify-center rounded text-slate-500 hover:bg-slate-100"
            aria-label="Toggle current password visibility"
          >
            {showCurrent ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700">
          New password
        </label>
        <div className="relative mt-1">
          <input
            type={showNew ? "text" : "password"}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 pr-10 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
          />
          <button
            type="button"
            onClick={() => setShowNew((v) => !v)}
            className="absolute inset-y-0 right-2 my-auto flex h-7 w-7 items-center justify-center rounded text-slate-500 hover:bg-slate-100"
            aria-label="Toggle new password visibility"
          >
            {showNew ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          At least 12 characters. Use a passphrase you don't reuse elsewhere.
        </p>
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700">
          Confirm new password
        </label>
        <input
          type={showNew ? "text" : "password"}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          autoComplete="new-password"
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
        />
      </div>

      {validation ? <p className="text-sm text-red-700">{validation}</p> : null}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={mutation.isPending || !currentPassword || !newPassword}
          className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {mutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Shield className="h-4 w-4" />
          )}
          Update password
        </button>
      </div>
    </form>
  );
}

function LeaveWorkspaceDialog({
  membership,
  onClose,
  onLeft,
}: {
  membership: ProfileMembershipSummary;
  onClose: () => void;
  onLeft: (tenantId: string) => void;
}) {
  const [slug, setSlug] = useState("");
  const mutation = useMutation({
    mutationFn: leaveWorkspace,
    onSuccess: (result) => {
      toast.success(`Left ${result.tenantName}.`);
      onLeft(result.tenantId);
    },
    onError: (error) => {
      const { message } = extractErrorCode(error);
      toast.error(message);
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <h3 className="text-lg font-semibold text-slate-900">
          Leave {membership.tenantName}?
        </h3>
        <p className="mt-2 text-sm text-slate-600">
          You will lose access to this workspace immediately. The remaining
          owners and admins will be notified.
        </p>
        {membership.isFinalOwner ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <p className="font-semibold">You are the only owner.</p>
            <p>
              Promote another member to OWNER or transfer ownership before you
              can leave. You may also permanently delete the workspace from the
              Workspace Studio.
            </p>
          </div>
        ) : null}
        <label className="mt-4 block text-sm font-medium text-slate-700">
          Type the workspace slug{" "}
          <span className="font-mono text-slate-900">
            {membership.tenantSlug}
          </span>{" "}
          to confirm
        </label>
        <input
          type="text"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
          placeholder={membership.tenantSlug}
        />
        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={
              mutation.isPending ||
              membership.isFinalOwner ||
              slug.trim().toLowerCase() !== membership.tenantSlug.toLowerCase()
            }
            onClick={() =>
              mutation.mutate({
                tenantId: membership.tenantId,
                confirmTenantSlug: slug,
              })
            }
            className="inline-flex items-center gap-2 rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {mutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LogOut className="h-4 w-4" />
            )}
            Leave workspace
          </button>
        </div>
      </div>
    </div>
  );
}

function WorkspaceMembershipsSection({
  overview,
  onMutated,
}: {
  overview: ProfileOverview;
  onMutated: () => Promise<void> | void;
}) {
  const { session, logout, switchWorkspace } = useAuth();
  const queryClient = useQueryClient();
  const [leaveTarget, setLeaveTarget] =
    useState<ProfileMembershipSummary | null>(null);

  const setDefaultMutation = useMutation({
    mutationFn: setDefaultMembership,
    onSuccess: async (data) => {
      toast.success(`${data.tenantName} is now your default workspace.`);
      await queryClient.invalidateQueries({ queryKey: ["profile-overview"] });
    },
    onError: (error) => {
      const { message } = extractErrorCode(error);
      toast.error(message);
    },
  });

  async function handleLeft(tenantId: string) {
    setLeaveTarget(null);
    await queryClient.invalidateQueries({ queryKey: ["profile-overview"] });
    await onMutated();

    if (tenantId === session?.activeTenant?.id) {
      // The user just removed themselves from the workspace they were viewing.
      // Easiest correct behaviour: log them out — the access token references
      // a tenant they no longer belong to.
      await logout();
      return;
    }
    // Refresh session-level data so workspace lists shrink.
    if (session?.activeTenant) {
      try {
        await switchWorkspace({
          tenantId: session.activeTenant.id,
          siteId: session.activeSite?.id ?? undefined,
        });
      } catch {
        // Non-fatal — the profile data was already refreshed above.
      }
    }
  }

  if (overview.memberships.length === 0) {
    return (
      <p className="text-sm text-slate-600">
        You are not a member of any workspace.
      </p>
    );
  }

  return (
    <>
      <ul className="space-y-3">
        {overview.memberships.map((membership) => (
          <li
            key={membership.membershipId}
            className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-base font-semibold text-slate-900">
                  {membership.tenantName}
                </p>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                  {describeMembershipRole(membership.role)}
                </span>
                {membership.isDefault ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                    <Star className="h-3 w-3" /> Default
                  </span>
                ) : null}
                {membership.isFinalOwner ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                    <AlertTriangle className="h-3 w-3" /> Sole owner
                  </span>
                ) : null}
                {membership.tenantStatus !== "ACTIVE" ? (
                  <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700">
                    {membership.tenantStatus}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Slug{" "}
                <span className="font-mono text-slate-700">
                  {membership.tenantSlug}
                </span>{" "}
                · Joined {formatDate(membership.joinedAt)} ·{" "}
                {membership.memberCount} member
                {membership.memberCount === 1 ? "" : "s"} ·{" "}
                {membership.activeSiteCount} active site
                {membership.activeSiteCount === 1 ? "" : "s"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {!membership.isDefault ? (
                <button
                  type="button"
                  onClick={() => setDefaultMutation.mutate(membership.tenantId)}
                  disabled={setDefaultMutation.isPending}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
                >
                  <Star className="h-4 w-4" />
                  Set as default
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setLeaveTarget(membership)}
                className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 transition hover:bg-red-100"
              >
                <LogOut className="h-4 w-4" />
                Leave
              </button>
            </div>
          </li>
        ))}
      </ul>
      {leaveTarget ? (
        <LeaveWorkspaceDialog
          membership={leaveTarget}
          onClose={() => setLeaveTarget(null)}
          onLeft={handleLeft}
        />
      ) : null}
    </>
  );
}

function PendingInvitationsSection({
  overview,
}: {
  overview: ProfileOverview;
}) {
  if (overview.pendingInvitations.length === 0) {
    return (
      <p className="text-sm text-slate-600">
        No pending invitations. When someone invites you to a workspace, it will
        show up here.
      </p>
    );
  }
  return (
    <ul className="space-y-3">
      {overview.pendingInvitations.map((invitation) => (
        <li
          key={invitation.id}
          className="rounded-2xl border border-slate-200 bg-white p-4"
        >
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-semibold text-slate-900">
              {invitation.tenantName}
            </p>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
              {describeMembershipRole(invitation.role)}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {invitation.invitedByEmail
              ? `Invited by ${invitation.invitedByEmail}`
              : "Invited by your team"}
            {" · "}
            Sent {formatDate(invitation.createdAt)} · Expires{" "}
            {formatDate(invitation.expiresAt)}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Open the invitation email and click the secure accept link to join
            this workspace.
          </p>
        </li>
      ))}
    </ul>
  );
}

function NotificationPreferencesSection({ tenantId }: { tenantId: string }) {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["notification-preferences", tenantId],
    queryFn: () => getNotificationPreferences(tenantId),
  });

  const mutation = useMutation({
    mutationFn: (input: {
      category: NotificationCategory;
      channel: NotificationChannel;
      enabled: boolean;
    }) => upsertNotificationPreference(tenantId, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["notification-preferences", tenantId],
      });
    },
    onError: (error) => {
      const { message } = extractErrorCode(error);
      toast.error(message);
    },
  });

  const prefMap = useMemo(() => {
    const map = new Map<string, NotificationPreference>();
    (data ?? []).forEach((p) => {
      map.set(`${p.category}:${p.channel}`, p);
    });
    return map;
  }, [data]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading preferences…
      </div>
    );
  }
  if (isError) {
    return <p className="text-sm text-red-700">Failed to load preferences.</p>;
  }

  function isEnabled(
    category: NotificationCategory,
    channel: NotificationChannel,
  ) {
    const key = `${category}:${channel}`;
    const stored = prefMap.get(key);
    if (!stored) return true; // default-enabled
    return stored.enabled;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead>
          <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <th className="py-2 pr-4">Category</th>
            {NOTIFICATION_CHANNELS.map((ch) => (
              <th key={ch.value} className="px-3 py-2 text-center">
                {ch.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {NOTIFICATION_CATEGORIES.map((cat) => (
            <tr key={cat.value}>
              <td className="py-3 pr-4 font-medium text-slate-800">
                {cat.label}
              </td>
              {NOTIFICATION_CHANNELS.map((ch) => {
                const enabled = isEnabled(cat.value, ch.value);
                return (
                  <td key={ch.value} className="px-3 py-3 text-center">
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={enabled}
                        disabled={mutation.isPending}
                        onChange={(e) =>
                          mutation.mutate({
                            category: cat.value,
                            channel: ch.value,
                            enabled: e.target.checked,
                          })
                        }
                        className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                      />
                    </label>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-xs text-slate-500">
        Changes apply to the active workspace only. Switch workspaces from the
        sidebar to manage preferences elsewhere.
      </p>
    </div>
  );
}

function DangerZoneSection({ userEmail }: { userEmail: string }) {
  const { logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [password, setPassword] = useState("");

  const impactQuery = useQuery({
    queryKey: ["account-deletion-impact"],
    queryFn: getAccountDeletionImpact,
    enabled: open,
  });

  const mutation = useMutation({
    mutationFn: deleteOwnAccount,
    onSuccess: async () => {
      toast.success("Your account has been deleted.");
      await logout();
      window.location.href = "/login";
    },
    onError: (error) => {
      const { code, message } = extractErrorCode(error);
      if (code === "ACCOUNT_DELETION_BLOCKED") {
        toast.error(message);
      } else {
        toast.error(message);
      }
    },
  });

  function reset() {
    setOpen(false);
    setConfirmEmail("");
    setPassword("");
  }

  const blocked = impactQuery.data?.blocked ?? false;

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        Permanently delete your StayLayer account, your memberships, and your
        personal notification preferences. This cannot be undone. Workspaces you
        own jointly are not affected, but you must transfer ownership of any
        workspace where you are the only owner first.
      </p>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-full border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50"
        >
          <Trash2 className="h-4 w-4" />
          Delete my account…
        </button>
      ) : (
        <div className="space-y-4 rounded-2xl border border-red-200 bg-red-50/40 p-4">
          {impactQuery.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Loader2 className="h-4 w-4 animate-spin" /> Checking what will
              happen…
            </div>
          ) : impactQuery.data ? (
            <div className="space-y-2 text-sm">
              <p>
                <span className="font-semibold">Workspaces you belong to:</span>{" "}
                {impactQuery.data.workspaces.length}
              </p>
              {impactQuery.data.finalOwnerWorkspaces.length > 0 ? (
                <div className="rounded-xl border border-red-300 bg-red-100/60 p-3 text-red-800">
                  <p className="font-semibold">
                    You are the only owner of the following workspaces:
                  </p>
                  <ul className="mt-2 list-disc pl-5">
                    {impactQuery.data.finalOwnerWorkspaces.map((w) => (
                      <li key={w.tenantId}>
                        {w.tenantName}{" "}
                        <span className="font-mono text-xs">
                          ({w.tenantSlug})
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs">
                    Transfer ownership or permanently delete each of these
                    workspaces in the Workspace Studio first.
                  </p>
                </div>
              ) : null}
              {impactQuery.data.pendingSentInvitations > 0 ? (
                <p>
                  Pending invitations you sent:{" "}
                  {impactQuery.data.pendingSentInvitations} (they will remain
                  but show no inviter).
                </p>
              ) : null}
              {impactQuery.data.assignedSeoAuditTasks > 0 ? (
                <p>
                  SEO audit tasks assigned to you:{" "}
                  {impactQuery.data.assignedSeoAuditTasks} (assignment will be
                  cleared).
                </p>
              ) : null}
            </div>
          ) : null}

          <div>
            <label className="text-sm font-medium text-slate-700">
              Type your email{" "}
              <span className="font-mono text-slate-900">{userEmail}</span> to
              confirm
            </label>
            <input
              type="email"
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              autoComplete="off"
              className="mt-1 w-full rounded-lg border border-red-300 bg-white px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">
              Current password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="mt-1 w-full rounded-lg border border-red-300 bg-white px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
            />
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={reset}
              className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={
                mutation.isPending ||
                blocked ||
                !password ||
                confirmEmail.trim().toLowerCase() !== userEmail.toLowerCase()
              }
              onClick={() =>
                mutation.mutate({
                  confirmEmail,
                  currentPassword: password,
                })
              }
              className="inline-flex items-center gap-2 rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {mutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Permanently delete account
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProfilePage() {
  const { session } = useAuth();
  const activeTenantId = session?.activeTenant?.id ?? null;

  const overviewQuery = useQuery({
    queryKey: ["profile-overview"],
    queryFn: getProfileOverview,
  });

  if (overviewQuery.isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
      </div>
    );
  }
  if (overviewQuery.isError || !overviewQuery.data) {
    return (
      <div className="p-8 text-sm text-red-700">
        Failed to load your profile. Please refresh.
      </div>
    );
  }

  const overview = overviewQuery.data;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white">
          <UserCircle2 className="h-7 w-7" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
            Account & profile
          </h1>
          <p className="text-sm text-slate-600">
            Manage your sign-in security, workspace memberships, notifications,
            and account.
          </p>
        </div>
      </header>

      <SectionCard title="Account overview">
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Email
            </dt>
            <dd className="mt-1 flex items-center gap-2 text-sm text-slate-900">
              <Mail className="h-4 w-4 text-slate-500" />
              <span className="font-medium">{overview.email}</span>
              {overview.emailVerified ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                  <CheckCircle2 className="h-3 w-3" /> Verified
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                  Unverified
                </span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Member since
            </dt>
            <dd className="mt-1 text-sm text-slate-900">
              {formatDate(overview.createdAt)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Workspaces
            </dt>
            <dd className="mt-1 inline-flex items-center gap-2 text-sm text-slate-900">
              <Users className="h-4 w-4 text-slate-500" />
              {overview.memberships.length}
            </dd>
          </div>
        </dl>
      </SectionCard>

      <SectionCard
        title="Security"
        description="Rotate your password at any time. Use a long passphrase that you don't reuse elsewhere."
      >
        <ChangePasswordForm />
      </SectionCard>

      <SectionCard
        title="Workspace memberships"
        description="Choose your default workspace or leave any workspace you no longer need."
      >
        <WorkspaceMembershipsSection
          overview={overview}
          onMutated={() => overviewQuery.refetch().then(() => undefined)}
        />
      </SectionCard>

      <SectionCard
        title="Pending invitations"
        description="Invitations addressed to your email. Accept them from the email link."
      >
        <PendingInvitationsSection overview={overview} />
      </SectionCard>

      {activeTenantId ? (
        <SectionCard
          title="Notification preferences"
          description="Control how StayLayer notifies you about activity in this workspace."
        >
          <NotificationPreferencesSection tenantId={activeTenantId} />
        </SectionCard>
      ) : null}

      <SectionCard tone="danger" title="Danger zone">
        <DangerZoneSection userEmail={overview.email} />
      </SectionCard>
    </div>
  );
}
