import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  ArrowRight,
  Building2,
  Loader2,
  LogOut,
  Mail,
  PlusCircle,
  UserMinus,
} from "lucide-react";
import {
  createWorkspace,
  getProfileOverview,
  type CreateWorkspacePayload,
} from "../api/profile";
import { useAuth } from "../auth/useAuth";
import {
  describeMembershipRole,
  getDefaultAuthenticatedPath,
} from "../auth/access";
import { LoadingSpinner } from "../components/LoadingSpinner";

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function normalizeSlugPreview(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function extractErrorMessage(error: unknown): string {
  if (typeof error === "object" && error && "response" in error) {
    const response = error as {
      response?: { data?: { message?: string; code?: string } };
    };
    return (
      response.response?.data?.message ||
      response.response?.data?.code ||
      "Unable to create workspace."
    );
  }

  return error instanceof Error ? error.message : "Unable to create workspace.";
}

interface NoWorkspacePageProps {
  mode?: "limbo" | "create";
}

export default function NoWorkspacePage({
  mode = "limbo",
}: NoWorkspacePageProps) {
  const { session, user, logout, switchWorkspace } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [workspaceName, setWorkspaceName] = useState("");
  const [workspaceSlug, setWorkspaceSlug] = useState("");
  const hasExistingWorkspaces = Boolean(session?.memberships.length);
  const isCreateMode = mode === "create" || hasExistingWorkspaces;

  const overviewQuery = useQuery({
    queryKey: ["profile-overview-no-workspace"],
    queryFn: getProfileOverview,
    retry: false,
  });

  const pendingInvitations = overviewQuery.data?.pendingInvitations ?? [];
  const slugPreview = useMemo(
    () => normalizeSlugPreview(workspaceSlug || workspaceName),
    [workspaceName, workspaceSlug],
  );

  const createMutation = useMutation({
    mutationFn: (payload: CreateWorkspacePayload) => createWorkspace(payload),
    onSuccess: async (workspace) => {
      toast.success(`${workspace.tenantName} workspace created.`);
      await queryClient.invalidateQueries({ queryKey: ["profile-overview"] });
      await queryClient.invalidateQueries({
        queryKey: ["profile-overview-no-workspace"],
      });
      const nextSession = await switchWorkspace({
        tenantId: workspace.tenantId,
      });
      navigate(getDefaultAuthenticatedPath(nextSession), { replace: true });
    },
    onError: (error) => {
      toast.error(extractErrorMessage(error));
    },
  });

  const handleCreateWorkspace = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = workspaceName.trim();
    const slug = workspaceSlug.trim();
    if (!name) return;

    createMutation.mutate({
      name,
      ...(slug ? { slug } : {}),
    });
  };

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-[linear-gradient(135deg,rgba(18,57,47,0.08),rgba(14,165,233,0.08),rgba(255,255,255,0.96))] px-6 py-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                {isCreateMode ? "New workspace" : "Workspace setup"}
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
                {isCreateMode
                  ? "Create another workspace"
                  : "Create or join a workspace"}
              </h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {isCreateMode
                  ? "Create a separate tenant with its own billing, members, sites, and settings. After creation, StayLayer will switch you into that workspace."
                  : "Your account is active, but it is not attached to a workspace. Create a new workspace here, accept an invitation, or manage the account from profile settings."}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white/85 px-4 py-3 text-sm shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                Signed in
              </p>
              <p className="mt-1 max-w-xs truncate font-semibold text-slate-900">
                {user?.email}
              </p>
              <button
                type="button"
                onClick={() => void logout()}
                className="mt-3 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign out
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-6 p-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
          <form
            onSubmit={handleCreateWorkspace}
            className="rounded-3xl border border-slate-200 bg-slate-50/80 p-5"
          >
            <div className="flex items-start gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#12392f] text-white shadow-[0_14px_28px_rgba(18,57,47,0.22)]">
                <PlusCircle className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-lg font-semibold text-slate-950">
                  {isCreateMode ? "Workspace details" : "New workspace"}
                </h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Set up the tenant container first. Each workspace starts on
                  the free plan and can be upgraded from its own billing page.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Workspace name
                </span>
                <input
                  value={workspaceName}
                  onChange={(event) => setWorkspaceName(event.target.value)}
                  disabled={createMutation.isPending}
                  placeholder="Acme Hospitality"
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#12392f] focus:ring-2 focus:ring-[#12392f]/10"
                />
              </label>

              <label className="block sm:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Workspace slug
                </span>
                <input
                  value={workspaceSlug}
                  onChange={(event) => setWorkspaceSlug(event.target.value)}
                  disabled={createMutation.isPending}
                  placeholder={slugPreview || "acme-hospitality"}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#12392f] focus:ring-2 focus:ring-[#12392f]/10"
                />
                <p className="mt-2 text-xs text-slate-500">
                  {slugPreview
                    ? `Preview: ${slugPreview}`
                    : "Leave blank to generate one from the workspace name."}
                </p>
              </label>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={!workspaceName.trim() || createMutation.isPending}
                className="inline-flex items-center gap-2 rounded-2xl bg-[#12392f] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(18,57,47,0.22)] transition hover:bg-[#0f3028] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {createMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Building2 className="h-4 w-4" />
                )}
                Create workspace
              </button>
              <span className="text-xs text-slate-500">
                You will be added as the owner and switched automatically.
              </span>
            </div>
          </form>

          <div className="space-y-4">
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                  <Mail className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-base font-semibold text-slate-950">
                    Pending invitations
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Invitation links still arrive by email, but you can review
                    any pending workspace access here.
                  </p>
                </div>
              </div>

              <div className="mt-4">
                {overviewQuery.isLoading ? (
                  <LoadingSpinner />
                ) : overviewQuery.isError ? (
                  <p className="text-xs text-rose-700">
                    Could not load pending invitations. Refresh and try again.
                  </p>
                ) : pendingInvitations.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                    No pending invitations for {user?.email ?? "this account"}.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {pendingInvitations.map((invite) => (
                      <li
                        key={invite.id}
                        className="rounded-2xl border border-slate-200 bg-slate-50 p-3"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <Building2 className="h-4 w-4 text-slate-500" />
                          <span className="text-sm font-semibold text-slate-900">
                            {invite.tenantName}
                          </span>
                          <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-700">
                            {describeMembershipRole(invite.role)}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          {invite.invitedByEmail
                            ? `Invited by ${invite.invitedByEmail}`
                            : "Invited by your team"}
                          {" · "}Expires {formatDate(invite.expiresAt)}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            <Link
              to="/profile"
              className="group flex items-start gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-rose-200 hover:bg-rose-50/40"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-100 text-rose-700">
                <UserMinus className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold text-slate-950">
                  Account settings
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Open your profile to change password, review memberships, or
                  permanently delete your account.
                </p>
              </div>
              <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-slate-400 transition group-hover:text-rose-600" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
