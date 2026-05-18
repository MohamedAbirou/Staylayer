import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ShieldCheck,
  KeyRound,
  LogOut,
  UserMinus,
  UserCog,
  Lock,
  Unlock,
  AlertTriangle,
} from "lucide-react";

import {
  fetchOperatorRoleBundles,
  fetchOperatorUser,
  resetOperatorUserPassword,
  revokeOperatorUser,
  revokeOperatorUserSessions,
  unlockOperatorUser,
  updateOperatorUser,
  type OperatorUserDetail,
  type PlatformRole,
} from "../api/operator";
import { useOperatorAuth } from "../auth/useOperatorAuth";
import { OPERATOR_PERMISSIONS, usePermissions } from "../permissions";
import { ReasonModal } from "../components/ReasonModal";

const ROLE_LABEL: Record<PlatformRole, string> = {
  PLATFORM_OWNER: "Platform Owner",
  SUPPORT_ADMIN: "Support Admin",
  FINANCE_ADMIN: "Finance Admin",
};

const PASSWORD_MIN = 12;

type ModalKind =
  | { kind: "role"; nextRole: PlatformRole }
  | { kind: "password" }
  | { kind: "revoke-sessions" }
  | { kind: "unlock" }
  | { kind: "revoke" };

function passwordError(password: string): string | null {
  if (password.length < PASSWORD_MIN)
    return `Must be at least ${PASSWORD_MIN} characters.`;
  if (!/[A-Z]/.test(password)) return "Must include an uppercase letter.";
  if (!/[a-z]/.test(password)) return "Must include a lowercase letter.";
  if (!/[0-9]/.test(password)) return "Must include a digit.";
  if (!/[^A-Za-z0-9]/.test(password)) return "Must include a symbol.";
  return null;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function extractMessage(err: unknown): string | null {
  if (!err || typeof err !== "object") return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (err as any).response?.data;
  return data?.message ?? null;
}

export default function OperatorUserDetailPage() {
  const params = useParams<{ operatorUserId: string }>();
  const operatorUserId = params.operatorUserId!;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { session } = useOperatorAuth();
  const { can } = usePermissions();
  const canManage = can(OPERATOR_PERMISSIONS.OPERATOR_USER_MANAGE_ALL);
  const canViewBundles = can(OPERATOR_PERMISSIONS.PERMISSION_MANAGE_ALL);
  const isSelf = session?.user.id === operatorUserId;

  const detailQuery = useQuery({
    queryKey: ["operator-user", operatorUserId],
    queryFn: () => fetchOperatorUser(operatorUserId),
  });

  const bundlesQuery = useQuery({
    queryKey: ["operator-role-bundles"],
    queryFn: fetchOperatorRoleBundles,
    enabled: canViewBundles,
    staleTime: 5 * 60 * 1000,
  });

  const [modal, setModal] = useState<ModalKind | null>(null);
  const [passwordDraft, setPasswordDraft] = useState("");

  const invalidateAll = () => {
    void qc.invalidateQueries({ queryKey: ["operator-user", operatorUserId] });
    void qc.invalidateQueries({ queryKey: ["operator-users"] });
  };

  const updateRoleMutation = useMutation({
    mutationFn: ({ role, reason }: { role: PlatformRole; reason: string }) =>
      updateOperatorUser(operatorUserId, { platformRole: role, reason }),
    onSuccess: () => {
      invalidateAll();
      setModal(null);
    },
  });

  const resetPwMutation = useMutation({
    mutationFn: ({ password, reason }: { password: string; reason: string }) =>
      resetOperatorUserPassword(operatorUserId, { password, reason }),
    onSuccess: () => {
      invalidateAll();
      setModal(null);
      setPasswordDraft("");
    },
  });

  const revokeSessionsMutation = useMutation({
    mutationFn: ({ reason }: { reason: string }) =>
      revokeOperatorUserSessions(operatorUserId, { reason }),
    onSuccess: () => {
      invalidateAll();
      setModal(null);
    },
  });

  const unlockMutation = useMutation({
    mutationFn: ({ reason }: { reason: string }) =>
      unlockOperatorUser(operatorUserId, { reason }),
    onSuccess: () => {
      invalidateAll();
      setModal(null);
    },
  });

  const revokeMutation = useMutation({
    mutationFn: ({ reason }: { reason: string }) =>
      revokeOperatorUser(operatorUserId, { reason }),
    onSuccess: () => {
      invalidateAll();
      navigate("/operator-users");
    },
  });

  const detail = detailQuery.data;

  return (
    <div className="px-8 py-8">
      <Link
        to="/operator-users"
        className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-cyan-300"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to operator users
      </Link>

      {detailQuery.isLoading ? (
        <p className="mt-8 text-sm text-slate-400">Loading…</p>
      ) : null}
      {detailQuery.isError ? (
        <p className="mt-8 text-sm text-rose-300">
          Failed to load operator user.
        </p>
      ) : null}

      {detail ? (
        <>
          <DetailHeader detail={detail} isSelf={isSelf} />

          <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
            <IdentityCard detail={detail} />
            <RoleCard
              detail={detail}
              isSelf={isSelf}
              canManage={canManage}
              onChange={(role) => setModal({ kind: "role", nextRole: role })}
            />
            <SessionsCard
              detail={detail}
              canManage={canManage}
              onRevokeAll={() => setModal({ kind: "revoke-sessions" })}
              onUnlock={() => setModal({ kind: "unlock" })}
            />
          </div>

          <PermissionsPreview
            detail={detail}
            bundles={bundlesQuery.data?.bundles ?? null}
            canViewBundles={canViewBundles}
          />

          <RecentSessions detail={detail} />

          {canManage ? (
            <DangerZone
              isSelf={isSelf}
              onPasswordReset={() => setModal({ kind: "password" })}
              onRevoke={() => setModal({ kind: "revoke" })}
            />
          ) : null}
        </>
      ) : null}

      {/* Modals */}
      {modal?.kind === "role" && detail ? (
        <ReasonModal
          open
          title={`Change role to ${ROLE_LABEL[modal.nextRole]}`}
          description={`This will revoke ${detail.activeSessions} active session(s) and force re-login with the new permission bundle.`}
          confirmLabel="Apply role change"
          confirmTone="danger"
          highRisk={modal.nextRole === "PLATFORM_OWNER"}
          highRiskToken={
            modal.nextRole === "PLATFORM_OWNER" ? "PROMOTE" : undefined
          }
          minReasonLength={8}
          submitting={updateRoleMutation.isPending}
          error={extractMessage(updateRoleMutation.error)}
          onCancel={() => setModal(null)}
          onConfirm={(reason) =>
            updateRoleMutation.mutateAsync({ role: modal.nextRole, reason })
          }
        />
      ) : null}

      {modal?.kind === "password" ? (
        <ReasonModal
          open
          title="Reset operator password"
          description="Issues a new password and revokes every active operator session."
          confirmLabel="Reset password"
          confirmTone="danger"
          minReasonLength={8}
          extraInvalid={!!passwordError(passwordDraft)}
          submitting={resetPwMutation.isPending}
          error={extractMessage(resetPwMutation.error)}
          slotBefore={
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                New password
              </span>
              <input
                type="password"
                autoComplete="new-password"
                value={passwordDraft}
                onChange={(event) => setPasswordDraft(event.target.value)}
                className="mt-1 w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-cyan-700 focus:outline-none"
              />
              {passwordError(passwordDraft) ? (
                <p className="mt-1 text-[11px] text-rose-300">
                  {passwordError(passwordDraft)}
                </p>
              ) : (
                <p className="mt-1 text-[11px] text-slate-500">
                  Minimum {PASSWORD_MIN} chars with upper/lower/digit/symbol.
                </p>
              )}
            </label>
          }
          onCancel={() => {
            setPasswordDraft("");
            setModal(null);
          }}
          onConfirm={(reason) =>
            resetPwMutation.mutateAsync({ password: passwordDraft, reason })
          }
        />
      ) : null}

      {modal?.kind === "revoke-sessions" && detail ? (
        <ReasonModal
          open
          title="Revoke all operator sessions"
          description={`Forces logout from ${detail.activeSessions} active session(s).`}
          confirmLabel="Revoke sessions"
          confirmTone="danger"
          minReasonLength={8}
          submitting={revokeSessionsMutation.isPending}
          error={extractMessage(revokeSessionsMutation.error)}
          onCancel={() => setModal(null)}
          onConfirm={(reason) => revokeSessionsMutation.mutateAsync({ reason })}
        />
      ) : null}

      {modal?.kind === "unlock" ? (
        <ReasonModal
          open
          title="Clear lockout"
          description="Resets failed-attempt counter and removes the lockout window."
          confirmLabel="Unlock account"
          confirmTone="primary"
          minReasonLength={8}
          submitting={unlockMutation.isPending}
          error={extractMessage(unlockMutation.error)}
          onCancel={() => setModal(null)}
          onConfirm={(reason) => unlockMutation.mutateAsync({ reason })}
        />
      ) : null}

      {modal?.kind === "revoke" && detail ? (
        <ReasonModal
          open
          title="Revoke operator access"
          description="Removes the platform role and revokes every active session. The user record is preserved for audit history. Cannot be undone via this UI."
          confirmLabel="Revoke access"
          confirmTone="danger"
          highRisk
          highRiskToken={detail.email}
          minReasonLength={8}
          submitting={revokeMutation.isPending}
          error={extractMessage(revokeMutation.error)}
          onCancel={() => setModal(null)}
          onConfirm={(reason) => revokeMutation.mutateAsync({ reason })}
        />
      ) : null}
    </div>
  );
}

function DetailHeader({
  detail,
  isSelf,
}: {
  detail: OperatorUserDetail;
  isSelf: boolean;
}) {
  return (
    <header className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-2 text-cyan-400">
          <UserCog className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-mono text-base font-semibold text-white">
            {detail.email}
          </h1>
          <p className="text-xs text-slate-400">
            ID {detail.id}
            {isSelf ? (
              <span className="ml-2 rounded-md border border-amber-800 bg-amber-950 px-1.5 py-0.5 text-[10px] uppercase text-amber-300">
                Your account
              </span>
            ) : null}
          </p>
        </div>
      </div>
    </header>
  );
}

function IdentityCard({ detail }: { detail: OperatorUserDetail }) {
  return (
    <Card title="Identity">
      <KV label="Email" value={detail.email} mono />
      <KV label="Created" value={formatDate(detail.createdAt)} />
      <KV label="Updated" value={formatDate(detail.updatedAt)} />
      <KV label="Last activity" value={formatDate(detail.lastLoginAt)} />
    </Card>
  );
}

function RoleCard({
  detail,
  isSelf,
  canManage,
  onChange,
}: {
  detail: OperatorUserDetail;
  isSelf: boolean;
  canManage: boolean;
  onChange: (role: PlatformRole) => void;
}) {
  const disabled = !canManage || isSelf;
  return (
    <Card title="Platform role">
      <p className="flex items-center gap-2 text-sm font-semibold text-white">
        <ShieldCheck className="h-4 w-4 text-cyan-400" />
        {ROLE_LABEL[detail.platformRole]}
      </p>
      {isSelf ? (
        <p className="mt-2 text-[11px] text-amber-300">
          You cannot change your own role. Ask another Platform Owner.
        </p>
      ) : null}
      <fieldset className="mt-3 space-y-1.5" disabled={disabled}>
        {(
          ["PLATFORM_OWNER", "SUPPORT_ADMIN", "FINANCE_ADMIN"] as PlatformRole[]
        ).map((role) => (
          <button
            key={role}
            type="button"
            onClick={() => onChange(role)}
            disabled={disabled || role === detail.platformRole}
            className="flex w-full items-center justify-between rounded-md border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-left text-xs text-slate-200 hover:border-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span>{ROLE_LABEL[role]}</span>
            {role === detail.platformRole ? (
              <span className="text-[10px] uppercase text-slate-500">
                current
              </span>
            ) : (
              <span className="text-[10px] uppercase text-cyan-400">
                switch →
              </span>
            )}
          </button>
        ))}
      </fieldset>
    </Card>
  );
}

function SessionsCard({
  detail,
  canManage,
  onRevokeAll,
  onUnlock,
}: {
  detail: OperatorUserDetail;
  canManage: boolean;
  onRevokeAll: () => void;
  onUnlock: () => void;
}) {
  return (
    <Card title="Sessions & lockout">
      <KV label="Active sessions" value={String(detail.activeSessions)} />
      <KV label="Failed attempts" value={String(detail.failedAttempts)} />
      <KV
        label="Locked"
        value={detail.locked ? `Until ${formatDate(detail.lockedUntil)}` : "No"}
      />
      {canManage ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onRevokeAll}
            disabled={detail.activeSessions === 0}
            className="inline-flex items-center gap-1 rounded-md border border-slate-800 bg-slate-950 px-2 py-1 text-xs text-slate-200 hover:border-rose-700 disabled:opacity-50"
          >
            <LogOut className="h-3 w-3" /> Revoke sessions
          </button>
          {detail.locked ? (
            <button
              type="button"
              onClick={onUnlock}
              className="inline-flex items-center gap-1 rounded-md border border-slate-800 bg-slate-950 px-2 py-1 text-xs text-slate-200 hover:border-emerald-700"
            >
              <Unlock className="h-3 w-3" /> Clear lockout
            </button>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-md border border-slate-800 bg-slate-950 px-2 py-1 text-[10px] uppercase text-slate-500">
              <Lock className="h-3 w-3" /> Not locked
            </span>
          )}
        </div>
      ) : null}
    </Card>
  );
}

function PermissionsPreview({
  detail,
  bundles,
  canViewBundles,
}: {
  detail: OperatorUserDetail;
  bundles: Array<{ role: PlatformRole; permissions: string[] }> | null;
  canViewBundles: boolean;
}) {
  const grouped = useMemo(() => {
    const out = new Map<string, string[]>();
    for (const key of detail.permissions) {
      const prefix = key.split(".")[0] ?? "other";
      const list = out.get(prefix) ?? [];
      list.push(key);
      out.set(prefix, list);
    }
    return Array.from(out.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [detail.permissions]);

  return (
    <Card className="mt-4" title="Permission bundle (computed)">
      <p className="text-[11px] text-slate-500">
        Derived from the role bundle on the API. Adjusting the role above
        replaces this list and forces re-login.
      </p>
      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        {grouped.map(([prefix, keys]) => (
          <div
            key={prefix}
            className="rounded-md border border-slate-800 bg-slate-950 p-2"
          >
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              {prefix}
            </p>
            <ul className="mt-1 space-y-0.5 text-[11px] font-mono text-slate-300">
              {keys.map((k) => (
                <li key={k}>{k}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {canViewBundles && bundles ? (
        <p className="mt-3 text-[11px] text-slate-500">
          See{" "}
          <Link to="/permissions" className="text-cyan-300">
            /permissions
          </Link>{" "}
          for the full role-bundle catalog.
        </p>
      ) : null}
    </Card>
  );
}

function RecentSessions({ detail }: { detail: OperatorUserDetail }) {
  if (detail.recentSessions.length === 0) {
    return (
      <Card className="mt-4" title="Recent sessions">
        <p className="text-xs text-slate-500">No recorded sessions.</p>
      </Card>
    );
  }
  return (
    <Card className="mt-4" title="Recent sessions (last 10)">
      <div className="overflow-hidden rounded-md border border-slate-800">
        <table className="min-w-full divide-y divide-slate-800 text-xs">
          <thead className="bg-slate-950 text-[10px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-1.5 text-left">Created</th>
              <th className="px-3 py-1.5 text-left">Last used</th>
              <th className="px-3 py-1.5 text-left">Expires</th>
              <th className="px-3 py-1.5 text-left">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 text-slate-300">
            {detail.recentSessions.map((s) => (
              <tr key={s.id}>
                <td className="px-3 py-1.5">{formatDate(s.createdAt)}</td>
                <td className="px-3 py-1.5">{formatDate(s.lastUsedAt)}</td>
                <td className="px-3 py-1.5">{formatDate(s.expiresAt)}</td>
                <td className="px-3 py-1.5">
                  {s.revokedAt ? (
                    <span className="rounded-md border border-rose-800 bg-rose-950 px-1.5 py-0.5 text-[10px] uppercase text-rose-300">
                      revoked
                      {s.revokedReason ? ` · ${s.revokedReason}` : ""}
                    </span>
                  ) : new Date(s.expiresAt) < new Date() ? (
                    <span className="rounded-md border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-[10px] uppercase text-slate-400">
                      expired
                    </span>
                  ) : (
                    <span className="rounded-md border border-emerald-800 bg-emerald-950 px-1.5 py-0.5 text-[10px] uppercase text-emerald-300">
                      active
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function DangerZone({
  isSelf,
  onPasswordReset,
  onRevoke,
}: {
  isSelf: boolean;
  onPasswordReset: () => void;
  onRevoke: () => void;
}) {
  return (
    <section className="mt-6 rounded-2xl border border-rose-900 bg-rose-950/30 p-5">
      <div className="flex items-center gap-2 text-rose-200">
        <AlertTriangle className="h-4 w-4" />
        <h2 className="text-sm font-semibold">Sensitive actions</h2>
      </div>
      <p className="mt-1 text-xs text-rose-200/70">
        Every action requires a reason and is recorded in the operator audit
        log. Revoking access cannot be undone via the console.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onPasswordReset}
          className="inline-flex items-center gap-1 rounded-md border border-amber-800 bg-amber-950 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-900/60"
        >
          <KeyRound className="h-3.5 w-3.5" /> Reset password
        </button>
        <button
          type="button"
          onClick={onRevoke}
          disabled={isSelf}
          className="inline-flex items-center gap-1 rounded-md border border-rose-800 bg-rose-950 px-3 py-1.5 text-xs font-semibold text-rose-200 hover:bg-rose-900/60 disabled:cursor-not-allowed disabled:opacity-50"
          title={isSelf ? "You cannot revoke your own access." : undefined}
        >
          <UserMinus className="h-3.5 w-3.5" /> Revoke operator access
        </button>
      </div>
    </section>
  );
}

function Card({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-slate-800 bg-slate-900 p-5 ${className ?? ""}`}
    >
      <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {title}
      </h2>
      <div className="mt-3 space-y-1.5">{children}</div>
    </section>
  );
}

function KV({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-xs">
      <span className="text-slate-500">{label}</span>
      <span className={`text-right ${mono ? "font-mono" : ""} text-slate-100`}>
        {value}
      </span>
    </div>
  );
}
