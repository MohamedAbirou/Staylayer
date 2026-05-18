import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Building2, LogOut, Mail, PlusCircle, UserMinus } from "lucide-react";
import { getProfileOverview } from "../api/profile";
import { useAuth } from "../auth/useAuth";
import { describeMembershipRole } from "../auth/access";
import { MARKETING_APP_URL } from "../lib/constants";
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

/**
 * Standalone limbo page shown to authenticated users with zero workspace
 * memberships. Mirrors the Vercel / Linear / Notion "no team" pattern.
 * The user can:
 *   1. Create a new workspace (sends them to marketing /register).
 *   2. Review pending invitations they need to accept via email.
 *   3. Permanently delete their account (deep-links into /profile).
 */
export default function NoWorkspacePage() {
  const { user, logout } = useAuth();

  const overviewQuery = useQuery({
    queryKey: ["profile-overview-no-workspace"],
    queryFn: getProfileOverview,
    retry: false,
  });

  const pendingInvitations = overviewQuery.data?.pendingInvitations ?? [];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <span className="text-xs font-semibold uppercase tracking-[0.32em] text-sky-600">
            StayLayer
          </span>
          <button
            type="button"
            onClick={() => void logout()}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
            You aren’t a member of any workspace
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {user?.email ? (
              <>
                You’re signed in as{" "}
                <span className="font-medium text-slate-900">{user.email}</span>
                .
              </>
            ) : (
              "You’re signed in."
            )}{" "}
            Pick one of the options below to keep going.
          </p>
        </div>

        <div className="mt-6 grid gap-4">
          {/* Create a new workspace */}
          <a
            href={`${MARKETING_APP_URL}/register`}
            className="group flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-6 transition hover:border-sky-300 hover:shadow-md"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-100 text-sky-700">
              <PlusCircle className="h-5 w-5" />
            </span>
            <div className="flex-1">
              <p className="text-base font-semibold text-slate-900">
                Create a new workspace
              </p>
              <p className="mt-1 text-sm text-slate-600">
                Start fresh — set up a new tenant, pick a plan, and launch your
                first site.
              </p>
            </div>
          </a>

          {/* Pending invitations */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex items-start gap-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <Mail className="h-5 w-5" />
              </span>
              <div className="flex-1">
                <p className="text-base font-semibold text-slate-900">
                  Accept a pending invitation
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  When a workspace owner invites you, the accept link arrives by
                  email. Open it to join.
                </p>
              </div>
            </div>

            <div className="mt-4">
              {overviewQuery.isLoading ? (
                <LoadingSpinner />
              ) : overviewQuery.isError ? (
                <p className="text-xs text-rose-700">
                  Could not load your pending invitations. Try refreshing.
                </p>
              ) : pendingInvitations.length === 0 ? (
                <p className="text-xs text-slate-500">
                  No pending invitations for{" "}
                  <span className="font-medium">
                    {user?.email ?? "your account"}
                  </span>
                  .
                </p>
              ) : (
                <ul className="space-y-2">
                  {pendingInvitations.map((invite) => (
                    <li
                      key={invite.id}
                      className="rounded-xl border border-slate-200 bg-slate-50 p-3"
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
                      <p className="mt-1 text-xs text-slate-500">
                        Check your inbox for the accept link.
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          {/* Delete account */}
          <Link
            to="/profile"
            className="group flex items-start gap-4 rounded-2xl border border-rose-200 bg-white p-6 transition hover:border-rose-300 hover:shadow-md"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-100 text-rose-700">
              <UserMinus className="h-5 w-5" />
            </span>
            <div className="flex-1">
              <p className="text-base font-semibold text-slate-900">
                Permanently delete my account
              </p>
              <p className="mt-1 text-sm text-slate-600">
                If you’re done with StayLayer, you can delete your account from
                your profile settings. This cannot be undone.
              </p>
            </div>
          </Link>
        </div>
      </main>
    </div>
  );
}
