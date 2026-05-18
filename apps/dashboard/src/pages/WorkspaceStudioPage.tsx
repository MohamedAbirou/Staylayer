import { useDeferredValue, useState, type ChangeEvent } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  BedDouble,
  Building2,
  Check,
  Clock3,
  Globe2,
  Home,
  Hotel,
  KeyRound,
  Loader2,
  Mail,
  Plus,
  Search,
  Shield,
  Sparkles,
  Trash2,
  UserMinus,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../auth/useAuth";
import {
  SITE_ADMIN_MEMBERSHIP_ROLES,
  describeMembershipRole,
  hasMembershipRole,
} from "../auth/access";
import { LOCALES } from "../lib/constants";
import { formatDate, formatRelativeTime } from "../lib/formatDate";
import {
  createWorkspaceMember,
  createWorkspaceSite,
  deleteWorkspaceSite,
  getPendingWorkspaceInvitations,
  getWorkspaceMembers,
  getWorkspaceSites,
  inviteWorkspaceMember,
  removeWorkspaceMember,
  resendWorkspaceInvitation,
  revokeWorkspaceInvitation,
  transferWorkspaceOwnership,
  updateWorkspaceMemberRole,
  type CreateWorkspaceMemberPayload,
  type CreateWorkspaceSitePayload,
  type DemotableWorkspaceRole,
  type InviteWorkspaceMemberPayload,
  type WorkspaceInvitationRecord,
  type WorkspaceMemberRecord,
  type WorkspaceMemberRole,
  type WorkspaceSiteRecord,
  type WorkspaceSiteStatus,
  type WorkspaceSiteType,
} from "../api/workspace";
import { ArchivedSitesPanel } from "./workspace/ArchivedSitesPanel";
import { WorkspaceDangerZone } from "./workspace/WorkspaceDangerZone";
const SITE_TYPE_OPTIONS: Array<{
  value: WorkspaceSiteType;
  label: string;
  description: string;
  icon: typeof Home;
}> = [
  {
    value: "VACATION_RENTAL",
    label: "Villa / Rental",
    description: "Private stays, branded villas, and multi-unit escapes.",
    icon: Home,
  },
  {
    value: "BOUTIQUE_HOTEL",
    label: "Boutique hotel",
    description: "Editorial-forward properties with room-led storytelling.",
    icon: Hotel,
  },
  {
    value: "BNB",
    label: "B&B",
    description: "Smaller hospitality brands with direct inquiry conversion.",
    icon: BedDouble,
  },
  {
    value: "GLAMPING",
    label: "Glamping",
    description: "Outdoor-first brands with strong visual launch moments.",
    icon: Sparkles,
  },
  {
    value: "GUEST_HOUSE",
    label: "Guest house",
    description: "Warm, service-led stays with simple room narratives.",
    icon: Building2,
  },
] as const;

const MEMBER_ROLE_OPTIONS: Array<{
  value: WorkspaceMemberRole;
  label: string;
  description: string;
}> = [
  {
    value: "ADMIN",
    label: "Admin",
    description:
      "Can manage sites, settings, domains, deployments, and team ops.",
  },
  {
    value: "EDITOR",
    label: "Editor",
    description: "Can shape content, inquiries, and published page work.",
  },
  {
    value: "BILLING",
    label: "Billing",
    description: "Can review subscription state and financial operations only.",
  },
] as const;

const SITE_STATUS_STYLES: Record<
  WorkspaceSiteStatus,
  { label: string; className: string }
> = {
  ACTIVE: {
    label: "Active",
    className: "bg-emerald-100 text-emerald-700 border-emerald-200",
  },
  DRAFT: {
    label: "Draft",
    className: "bg-amber-100 text-amber-800 border-amber-200",
  },
  SUSPENDED: {
    label: "Suspended",
    className: "bg-rose-100 text-rose-700 border-rose-200",
  },
  ARCHIVED: {
    label: "Archived",
    className: "bg-slate-100 text-slate-600 border-slate-200",
  },
};

const MEMBER_ROLE_STYLES: Record<WorkspaceMemberRole, string> = {
  OWNER: "bg-amber-100 text-amber-800 border-amber-200",
  ADMIN: "bg-blue-100 text-blue-700 border-blue-200",
  EDITOR: "bg-slate-100 text-slate-700 border-slate-200",
  BILLING: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

type MemberComposerMode = "invite" | "create";

function slugifySiteName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function readApiMessage(error: unknown, fallback: string): string {
  return (
    (error as { response?: { data?: { message?: string } } })?.response?.data
      ?.message ?? fallback
  );
}

export default function WorkspaceStudioPage() {
  const { session, user, switchWorkspace } = useAuth();
  const queryClient = useQueryClient();
  const tenantId = session?.activeTenant?.id ?? null;
  const canManageWorkspace = hasMembershipRole(
    session,
    SITE_ADMIN_MEMBERSHIP_ROLES,
  );

  const [memberSearch, setMemberSearch] = useState("");
  const deferredMemberSearch = useDeferredValue(memberSearch);
  const [memberComposerMode, setMemberComposerMode] =
    useState<MemberComposerMode>("invite");
  const [recentSiteId, setRecentSiteId] = useState<string | null>(null);
  const [sitePendingDeletionId, setSitePendingDeletionId] = useState<
    string | null
  >(null);
  const [memberPendingRemovalId, setMemberPendingRemovalId] = useState<
    string | null
  >(null);
  const [invitationPendingRevocationId, setInvitationPendingRevocationId] =
    useState<string | null>(null);
  const [memberRoleEdits, setMemberRoleEdits] = useState<
    Record<string, WorkspaceMemberRole>
  >({});
  const [transferTargetMemberId, setTransferTargetMemberId] = useState<
    string | null
  >(null);
  const [transferDemoteRole, setTransferDemoteRole] =
    useState<DemotableWorkspaceRole>("ADMIN");
  const [transferConfirmEmail, setTransferConfirmEmail] = useState("");
  const [siteForm, setSiteForm] = useState<CreateWorkspaceSitePayload>({
    name: "",
    slug: "",
    publicSubdomain: "",
    templateKey: "",
    primaryLocale: "en",
    enabledLocales: ["en"],
    siteType: "VACATION_RENTAL",
  });
  const [siteSlugTouched, setSiteSlugTouched] = useState(false);
  const [sitePublicSubdomainTouched, setSitePublicSubdomainTouched] =
    useState(false);
  const [inviteForm, setInviteForm] = useState<InviteWorkspaceMemberPayload>({
    email: "",
    role: "ADMIN",
  });
  const [createForm, setCreateForm] = useState<CreateWorkspaceMemberPayload>({
    email: "",
    role: "EDITOR",
  });

  const {
    data: sites = [],
    isLoading: sitesLoading,
    isError: sitesError,
    refetch: refetchSites,
  } = useQuery({
    queryKey: ["workspace-sites", tenantId],
    queryFn: () => getWorkspaceSites(tenantId!),
    enabled: Boolean(tenantId && canManageWorkspace),
    retry: false,
  });

  const {
    data: members = [],
    isLoading: membersLoading,
    isError: membersError,
    refetch: refetchMembers,
  } = useQuery({
    queryKey: ["workspace-members", tenantId],
    queryFn: () => getWorkspaceMembers(tenantId!),
    enabled: Boolean(tenantId && canManageWorkspace),
    retry: false,
  });

  const {
    data: pendingInvitations = [],
    isLoading: pendingInvitationsLoading,
    isError: pendingInvitationsError,
    refetch: refetchPendingInvitations,
  } = useQuery({
    queryKey: ["workspace-invitations", tenantId],
    queryFn: () => getPendingWorkspaceInvitations(tenantId!),
    enabled: Boolean(tenantId && canManageWorkspace),
    retry: false,
    refetchInterval: 15_000,
  });

  const switchSiteMutation = useMutation({
    mutationFn: async (siteId: string) => {
      if (!tenantId) {
        throw new Error("Select a tenant before switching site context.");
      }

      return switchWorkspace({ tenantId, siteId });
    },
    onSuccess: (_nextSession, siteId) => {
      const target = sites.find((site) => site.id === siteId);
      toast.success(
        target
          ? `Workspace switched to ${target.name}.`
          : "Workspace context updated.",
      );
      setRecentSiteId(siteId);
    },
    onError: (error: unknown) => {
      toast.error(
        readApiMessage(error, "Could not switch to that site context."),
      );
    },
  });

  const createSiteMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId) {
        throw new Error("Select a tenant before creating a site.");
      }

      return createWorkspaceSite(tenantId, {
        ...siteForm,
        slug: siteForm.slug?.trim() || undefined,
        publicSubdomain: siteForm.publicSubdomain?.trim() || undefined,
        templateKey: siteForm.templateKey?.trim() || undefined,
      });
    },
    onSuccess: async (site) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["workspace-sites", tenantId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["notifications", "unread-count", tenantId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["notifications", "list", tenantId],
        }),
      ]);
      setRecentSiteId(site.id);
      setSiteForm({
        name: "",
        slug: "",
        publicSubdomain: "",
        templateKey: "",
        primaryLocale: "en",
        enabledLocales: ["en"],
        siteType: "VACATION_RENTAL",
      });
      setSiteSlugTouched(false);
      setSitePublicSubdomainTouched(false);
      toast.success(`Created ${site.name}. Workspace is switching now.`);
      await switchWorkspace({ tenantId: site.tenantId, siteId: site.id });
    },
    onError: (error: unknown) => {
      toast.error(readApiMessage(error, "Unable to create the site."));
    },
  });

  const inviteMemberMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId) {
        throw new Error("Select a tenant before sending an invitation.");
      }

      return inviteWorkspaceMember(tenantId, inviteForm);
    },
    onSuccess: async (member) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["workspace-invitations", tenantId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["notifications", "unread-count", tenantId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["notifications", "list", tenantId],
        }),
      ]);
      setInviteForm({ email: "", role: inviteForm.role });
      toast.success(
        `Invitation sent to ${member.email} as ${describeMembershipRole(member.role)}.`,
      );
    },
    onError: (error: unknown) => {
      toast.error(
        readApiMessage(error, "Unable to send that workspace invitation."),
      );
    },
  });

  const createMemberMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId) {
        throw new Error("Select a tenant before creating a member.");
      }

      return createWorkspaceMember(tenantId, createForm);
    },
    onSuccess: async (member) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["workspace-members", tenantId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["notifications", "unread-count", tenantId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["notifications", "list", tenantId],
        }),
      ]);
      setCreateForm({ email: "", role: createForm.role });
      toast.success(`Setup email sent to ${member.email}.`);
    },
    onError: (error: unknown) => {
      toast.error(
        readApiMessage(error, "Unable to create that member account."),
      );
    },
  });

  const deleteSiteMutation = useMutation({
    mutationFn: async (site: WorkspaceSiteRecord) => {
      if (!tenantId) {
        throw new Error("Select a tenant before deleting a site.");
      }

      return deleteWorkspaceSite(tenantId, site.id);
    },
    onSuccess: async (_deletedSite, deletedSite) => {
      const remainingSites = sites.filter(
        (site) => site.id !== deletedSite.id && site.status !== "ARCHIVED",
      );
      const deletedActiveSite = session?.activeSite?.id === deletedSite.id;

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["workspace-sites", tenantId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["notifications", "unread-count", tenantId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["notifications", "list", tenantId],
        }),
      ]);

      setSitePendingDeletionId(null);
      if (recentSiteId === deletedSite.id) {
        setRecentSiteId(null);
      }

      if (deletedActiveSite) {
        const nextSite = remainingSites[0] ?? null;

        try {
          await switchWorkspace(
            nextSite
              ? { tenantId: deletedSite.tenantId, siteId: nextSite.id }
              : { tenantId: deletedSite.tenantId },
          );
          toast.success(
            nextSite
              ? `${deletedSite.name} deleted. Context moved to ${nextSite.name}.`
              : `${deletedSite.name} deleted. This workspace has no active site now.`,
          );
        } catch (error: unknown) {
          toast.error(
            readApiMessage(
              error,
              `${deletedSite.name} was deleted, but the workspace context could not refresh.`,
            ),
          );
        }
        return;
      }

      toast.success(`${deletedSite.name} deleted.`);
    },
    onError: (error: unknown) => {
      toast.error(readApiMessage(error, "Unable to delete that site."));
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (member: WorkspaceMemberRecord) => {
      if (!tenantId) {
        throw new Error("Select a tenant before removing a member.");
      }

      return removeWorkspaceMember(tenantId, member.id);
    },
    onSuccess: async (member) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["workspace-members", tenantId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["notifications", "unread-count", tenantId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["notifications", "list", tenantId],
        }),
      ]);
      setMemberPendingRemovalId(null);
      toast.success(`${member.email} removed from this workspace.`);
    },
    onError: (error: unknown) => {
      toast.error(readApiMessage(error, "Unable to remove that member."));
    },
  });

  const updateMemberRoleMutation = useMutation({
    mutationFn: async (variables: {
      member: WorkspaceMemberRecord;
      role: WorkspaceMemberRole;
    }) => {
      if (!tenantId) {
        throw new Error("Select a tenant before changing member roles.");
      }

      return updateWorkspaceMemberRole(
        tenantId,
        variables.member.id,
        variables.role,
      );
    },
    onSuccess: async (member) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["workspace-members", tenantId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["notifications", "unread-count", tenantId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["notifications", "list", tenantId],
        }),
      ]);
      setMemberRoleEdits((current) => {
        const next = { ...current };
        delete next[member.id];
        return next;
      });
      toast.success(
        `${member.email} is now ${describeMembershipRole(member.role)}.`,
      );
    },
    onError: (error: unknown) => {
      toast.error(readApiMessage(error, "Unable to update that member role."));
    },
  });

  const transferOwnershipMutation = useMutation({
    mutationFn: async (variables: {
      member: WorkspaceMemberRecord;
      demoteSelfTo: DemotableWorkspaceRole;
    }) => {
      if (!tenantId) {
        throw new Error("Select a tenant before transferring ownership.");
      }

      return transferWorkspaceOwnership(tenantId, variables.member.id, {
        demoteSelfTo: variables.demoteSelfTo,
        confirm: true,
      });
    },
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["workspace-members", tenantId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["notifications", "unread-count", tenantId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["notifications", "list", tenantId],
        }),
      ]);
      setTransferTargetMemberId(null);
      setTransferConfirmEmail("");
      setTransferDemoteRole("ADMIN");
      toast.success(
        `${result.promoted.email} is now the workspace owner. You are now ${describeMembershipRole(result.demoted.role)}.`,
      );
    },
    onError: (error: unknown) => {
      toast.error(
        readApiMessage(error, "Unable to transfer workspace ownership."),
      );
    },
  });

  const resendInvitationMutation = useMutation({
    mutationFn: async (invitation: WorkspaceInvitationRecord) => {
      if (!tenantId) {
        throw new Error("Select a tenant before resending an invitation.");
      }

      return resendWorkspaceInvitation(tenantId, invitation.id);
    },
    onSuccess: async (invitation) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["workspace-invitations", tenantId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["notifications", "unread-count", tenantId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["notifications", "list", tenantId],
        }),
      ]);
      toast.success(`Invitation resent to ${invitation.email}.`);
    },
    onError: (error: unknown) => {
      toast.error(readApiMessage(error, "Unable to resend that invitation."));
    },
  });

  const revokeInvitationMutation = useMutation({
    mutationFn: async (invitation: WorkspaceInvitationRecord) => {
      if (!tenantId) {
        throw new Error("Select a tenant before revoking an invitation.");
      }

      return revokeWorkspaceInvitation(tenantId, invitation.id);
    },
    onSuccess: async (invitation) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["workspace-invitations", tenantId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["notifications", "unread-count", tenantId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["notifications", "list", tenantId],
        }),
      ]);
      setInvitationPendingRevocationId(null);
      toast.success(`Invitation for ${invitation.email} revoked.`);
    },
    onError: (error: unknown) => {
      toast.error(readApiMessage(error, "Unable to revoke that invitation."));
    },
  });

  if (!tenantId) {
    return (
      <div className="rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Workspace Studio</h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
          Select a tenant workspace first. Site and team orchestration only work
          when a customer workspace is active.
        </p>
      </div>
    );
  }

  if (!canManageWorkspace) {
    return (
      <div className="rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Workspace Studio</h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
          Only workspace owners and admins can provision sites or manage team
          access.
        </p>
      </div>
    );
  }

  const filteredMembers = members.filter((member) =>
    member.email
      .toLowerCase()
      .includes(deferredMemberSearch.trim().toLowerCase()),
  );
  const ownerCount = members.filter((member) => member.role === "OWNER").length;
  const adminCount = members.filter((member) => member.role === "ADMIN").length;
  const editorCount = members.filter(
    (member) => member.role === "EDITOR",
  ).length;
  const billingCount = members.filter(
    (member) => member.role === "BILLING",
  ).length;
  const pendingInvitationCount = pendingInvitations.length;
  const activeSite =
    sites.find((site) => site.id === session?.activeSite?.id) ?? null;
  const recentSite = sites.find((site) => site.id === recentSiteId) ?? null;
  const canUseDangerActions = session?.activeMembershipRole === "OWNER";

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-4xl border border-slate-200 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.95),rgba(226,232,240,0.82)_35%,rgba(186,230,253,0.55)_70%,rgba(255,255,255,0.92)_100%)] p-8 shadow-[0_24px_80px_rgba(15,23,42,0.12)]">
        <div className="pointer-events-none absolute -right-20 top-0 h-56 w-56 rounded-full bg-cyan-300/25 blur-3xl" />
        <div className="pointer-events-none absolute -left-12 bottom-0 h-44 w-44 rounded-full bg-amber-300/25 blur-3xl" />
        <div className="relative grid gap-8 lg:grid-cols-[1.4fr_0.9fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">
              Workspace Studio
            </p>
            <h1 className="mt-4 max-w-3xl text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
              Architect the next property, crew, and site handoff from one
              control room.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
              Launch new hospitality sites, route the active site context
              instantly, and assign the right teammates without leaving the
              tenant workspace.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <StatTile
                label="Active workspace"
                value={session?.activeTenant?.name ?? "Customer workspace"}
                hint={
                  activeSite
                    ? `Current site: ${activeSite.name}`
                    : "No site currently selected"
                }
                icon={Building2}
              />
              <StatTile
                label="Sites"
                value={String(sites.length)}
                hint={
                  sites.length === 1
                    ? "One live property canvas"
                    : "Multiple property canvases ready"
                }
                icon={Globe2}
              />
              <StatTile
                label="Team seats"
                value={String(members.length)}
                hint={`${ownerCount} owner · ${adminCount} admin · ${editorCount} editor · ${billingCount} billing${pendingInvitationCount ? ` · ${pendingInvitationCount} pending invite${pendingInvitationCount === 1 ? "" : "s"}` : ""}`}
                icon={Users}
              />
            </div>
          </div>

          <div className="rounded-[28px] border border-white/60 bg-white/70 p-5 backdrop-blur-sm shadow-[0_12px_40px_rgba(148,163,184,0.18)]">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
              Live context
            </p>
            <div className="mt-4 space-y-4">
              <ContextRow
                label="Tenant"
                value={session?.activeTenant?.name ?? "No active tenant"}
                meta={
                  session?.activeTenant?.slug ??
                  "Select from the workspace switcher"
                }
              />
              <ContextRow
                label="Site"
                value={session?.activeSite?.name ?? "No active site selected"}
                meta={
                  session?.activeSite?.slug ??
                  "Choose one below or create a new site"
                }
              />
              <ContextRow
                label="Your role"
                value={
                  session?.activeMembershipRole
                    ? describeMembershipRole(session.activeMembershipRole)
                    : "Unknown"
                }
                meta={user?.email ?? "Signed-in operator"}
              />
            </div>

            {recentSite ? (
              <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 rounded-full bg-emerald-100 p-2 text-emerald-700">
                    <Check className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-emerald-900">
                      {recentSite.name} is ready.
                    </p>
                    <p className="mt-1 text-sm leading-6 text-emerald-800/90">
                      The workspace now knows about your latest site. Jump
                      straight into content, page creation, or site settings.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link
                        to="/pages"
                        className="inline-flex items-center gap-2 rounded-full bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800"
                      >
                        Open pages
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                      <Link
                        to="/settings"
                        className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                      >
                        Tune settings
                      </Link>
                      <Link
                        to="/pages/new"
                        className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                      >
                        Create a page
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section
        id="pending-invitations"
        className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
              Pending invitations
            </p>
            <h2 className="mt-2 text-2xl font-bold text-slate-950">
              Outstanding teammate access
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Track who still has an open invite, when it was sent, and when it
              expires so workspace ownership never loses sight of access
              handoff.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700">
              {pendingInvitationCount} pending
            </div>
            <button
              onClick={() => void refetchPendingInvitations()}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              Refresh
            </button>
          </div>
        </div>

        {pendingInvitationsError ? (
          <div className="mt-6">
            <InlineErrorPanel
              title="Pending invitations could not be loaded"
              body="Retry to sync the latest invitation state from the active workspace."
              actionLabel="Retry"
              onAction={() => void refetchPendingInvitations()}
            />
          </div>
        ) : pendingInvitationsLoading ? (
          <div className="mt-6">
            <LoadingPanel label="Loading outstanding invitations" />
          </div>
        ) : pendingInvitations.length === 0 ? (
          <div className="mt-6 rounded-3xl border border-dashed border-slate-200 bg-slate-50/80 p-6">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl bg-white p-3 text-slate-500 shadow-sm">
                <Mail className="h-5 w-5" />
              </div>
              <div>
                <p className="text-base font-semibold text-slate-900">
                  No invitations are waiting on a response.
                </p>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  New invites will appear here immediately after they are sent,
                  so owners and admins can spot outstanding access at a glance.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 xl:grid-cols-2">
            {pendingInvitations.map((invitation) => {
              const pendingRevocation =
                invitationPendingRevocationId === invitation.id;
              const resending =
                resendInvitationMutation.isPending &&
                resendInvitationMutation.variables?.id === invitation.id;
              const revoking =
                revokeInvitationMutation.isPending &&
                revokeInvitationMutation.variables?.id === invitation.id;

              return (
                <article
                  key={invitation.id}
                  className="rounded-3xl border border-slate-200 bg-[linear-gradient(135deg,rgba(255,255,255,1),rgba(248,250,252,0.96),rgba(226,232,240,0.55))] p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold text-slate-950">
                        {invitation.email}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        Invited as {describeMembershipRole(invitation.role)}
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${MEMBER_ROLE_STYLES[invitation.role]}`}
                    >
                      {describeMembershipRole(invitation.role)}
                    </span>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-white/80 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                        Sent
                      </p>
                      <p className="mt-2 text-sm font-medium text-slate-900">
                        {formatRelativeTime(invitation.createdAt)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {formatDate(invitation.createdAt)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-700/70">
                        Expires
                      </p>
                      <div className="mt-2 flex items-center gap-2 text-sm font-medium text-amber-900">
                        <Clock3 className="h-4 w-4" />
                        {formatRelativeTime(invitation.expiresAt)}
                      </div>
                      <p className="mt-1 text-xs text-amber-800/80">
                        {formatDate(invitation.expiresAt)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                        Sent by
                      </p>
                      <p className="mt-1 text-sm font-medium text-slate-800">
                        {invitation.invitedByEmail ??
                          user?.email ??
                          "Workspace admin"}
                      </p>
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm">
                      <UserPlus className="h-3.5 w-3.5" />
                      Awaiting acceptance
                    </div>
                  </div>

                  {canManageWorkspace ? (
                    <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          resendInvitationMutation.mutate(invitation)
                        }
                        disabled={resending || revoking || pendingRevocation}
                        title={`Resend invitation to ${invitation.email}`}
                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {resending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Mail className="h-3.5 w-3.5" />
                        )}
                        Resend invite
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setInvitationPendingRevocationId(
                            pendingRevocation ? null : invitation.id,
                          )
                        }
                        disabled={resending || revoking}
                        title={`Revoke invitation for ${invitation.email}`}
                        className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {revoking ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                        Revoke
                      </button>
                    </div>
                  ) : null}

                  {pendingRevocation ? (
                    <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4">
                      <div className="flex items-start gap-3">
                        <div className="rounded-full bg-white p-2 text-rose-700 shadow-sm">
                          <AlertTriangle className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-rose-950">
                            Revoke invitation for {invitation.email}?
                          </p>
                          <p className="mt-1 text-xs leading-5 text-rose-800">
                            The invitation link will stop working immediately
                            and this person will need a fresh invite to join.
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                revokeInvitationMutation.mutate(invitation)
                              }
                              disabled={revoking}
                              className="inline-flex items-center gap-2 rounded-full bg-rose-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-800 disabled:cursor-not-allowed disabled:bg-rose-300"
                            >
                              {revoking ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="h-3.5 w-3.5" />
                              )}
                              Revoke invitation
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setInvitationPendingRevocationId(null)
                              }
                              disabled={revoking}
                              className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-800 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <X className="h-3.5 w-3.5" />
                              Cancel
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                Site atlas
              </p>
              <h2 className="mt-2 text-2xl font-bold text-slate-950">
                Every property canvas in {session?.activeTenant?.name}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Switch the active site instantly or review each site’s launch
                posture before handing work to content teams.
              </p>
            </div>
            <button
              onClick={() => void refetchSites()}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              Refresh
            </button>
          </div>

          {sitesError ? (
            <InlineErrorPanel
              title="Site atlas could not be loaded"
              body="Retry the workspace query before provisioning another property."
              actionLabel="Retry"
              onAction={() => void refetchSites()}
            />
          ) : sitesLoading ? (
            <LoadingPanel label="Loading live site atlas" />
          ) : sites.length === 0 ? (
            <EmptyPanel
              title="No sites yet"
              body="Create the first property below. The active workspace switcher will light up as soon as the site is provisioned."
            />
          ) : (
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {sites.map((site) => {
                const Icon = getSiteTypeIcon(site.siteType);
                const isActive = site.id === session?.activeSite?.id;
                const pendingDeletion = sitePendingDeletionId === site.id;
                const deletingSite =
                  deleteSiteMutation.isPending &&
                  deleteSiteMutation.variables?.id === site.id;
                return (
                  <article
                    key={site.id}
                    className={`rounded-3xl border p-5 transition-all ${
                      isActive
                        ? "border-cyan-300 bg-cyan-50/70 shadow-[0_14px_40px_rgba(6,182,212,0.12)]"
                        : "border-slate-200 bg-slate-50/70 hover:border-slate-300 hover:bg-white"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="rounded-2xl bg-white p-3 text-slate-700 shadow-sm ring-1 ring-slate-200">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate text-lg font-semibold text-slate-950">
                              {site.name}
                            </h3>
                            {isActive ? (
                              <span className="rounded-full bg-cyan-100 px-2.5 py-1 text-[11px] font-semibold text-cyan-700">
                                Active context
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 text-sm text-slate-500">
                            /{site.slug}
                          </p>
                          <p className="mt-2 text-xs font-medium uppercase tracking-[0.22em] text-slate-400">
                            Public subdomain
                          </p>
                          <p className="mt-1 text-sm text-slate-600">
                            {site.publicSubdomain ||
                              "Assigned automatically at creation"}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${SITE_STATUS_STYLES[site.status].className}`}
                      >
                        {SITE_STATUS_STYLES[site.status].label}
                      </span>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-2">
                      <MetaChip
                        label={site.primaryLocale.toUpperCase()}
                        tone="accent"
                      />
                      <MetaChip
                        label={`${site.enabledLocales.length} locale${site.enabledLocales.length === 1 ? "" : "s"}`}
                        tone="neutral"
                      />
                      <MetaChip
                        label={readableSiteType(site.siteType)}
                        tone="neutral"
                      />
                    </div>

                    <div className="mt-4 text-xs text-slate-500">
                      Created {formatRelativeTime(site.createdAt)}
                      <span className="ml-1 text-slate-400">
                        ({formatDate(site.createdAt)})
                      </span>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-2">
                      <button
                        onClick={() => switchSiteMutation.mutate(site.id)}
                        disabled={switchSiteMutation.isPending || isActive}
                        className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        {switchSiteMutation.isPending &&
                        switchSiteMutation.variables === site.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <ArrowRight className="h-4 w-4" />
                        )}
                        {isActive ? "Current site" : "Switch context"}
                      </button>
                      {isActive ? (
                        <Link
                          to="/pages"
                          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                        >
                          Open pages
                        </Link>
                      ) : null}
                      {canUseDangerActions ? (
                        <button
                          type="button"
                          onClick={() =>
                            setSitePendingDeletionId(
                              pendingDeletion ? null : site.id,
                            )
                          }
                          disabled={deletingSite}
                          className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {deletingSite ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                          Delete
                        </button>
                      ) : null}
                    </div>

                    {pendingDeletion ? (
                      <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4">
                        <div className="flex items-start gap-3">
                          <div className="rounded-full bg-white p-2 text-rose-700 shadow-sm">
                            <AlertTriangle className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-rose-950">
                              Delete {site.name}?
                            </p>
                            <p className="mt-1 text-xs leading-5 text-rose-800">
                              The site will be removed from this workspace, its
                              default subdomain will be released, and connected
                              domains will be detached.
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => deleteSiteMutation.mutate(site)}
                                disabled={deletingSite}
                                className="inline-flex items-center gap-2 rounded-full bg-rose-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-800 disabled:cursor-not-allowed disabled:bg-rose-300"
                              >
                                {deletingSite ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="h-3.5 w-3.5" />
                                )}
                                Delete site
                              </button>
                              <button
                                type="button"
                                onClick={() => setSitePendingDeletionId(null)}
                                disabled={deletingSite}
                                className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-800 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                <X className="h-3.5 w-3.5" />
                                Cancel
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
            New site
          </p>
          <h2 className="mt-2 text-2xl font-bold text-slate-950">
            Launch a new hospitality canvas
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Provision the next site with the right type, locale footprint, and
            slug before handing off to content and operations.
          </p>

          <div className="mt-6 space-y-5">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Site name
              </label>
              <input
                value={siteForm.name ?? ""}
                onChange={handleSiteNameChange(
                  setSiteForm,
                  siteSlugTouched,
                  setSiteSlugTouched,
                  sitePublicSubdomainTouched,
                )}
                placeholder="Azure Bay Villas"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:bg-white"
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <label className="block text-sm font-semibold text-slate-700">
                  Slug
                </label>
                <span className="text-xs text-slate-400">
                  Auto-generated until you override it
                </span>
              </div>
              <input
                value={siteForm.slug ?? ""}
                onChange={(event) => {
                  setSiteSlugTouched(true);
                  setSiteForm((current) => ({
                    ...current,
                    slug: slugifySiteName(event.target.value),
                  }));
                }}
                placeholder="azure-bay-villas"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:bg-white"
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <label className="block text-sm font-semibold text-slate-700">
                  Public subdomain
                </label>
                <span className="text-xs text-slate-400">
                  Used for the shared default website hostname
                </span>
              </div>
              <input
                value={siteForm.publicSubdomain ?? ""}
                onChange={(event) => {
                  setSitePublicSubdomainTouched(true);
                  setSiteForm((current) => ({
                    ...current,
                    publicSubdomain: slugifySiteName(event.target.value),
                  }));
                }}
                placeholder="azure-bay-villas"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:bg-white"
              />
              <p className="mt-2 text-xs text-slate-500">
                This becomes the shared-runtime hostname label before any custom
                domain is connected.
              </p>
            </div>

            <div>
              <label className="mb-3 block text-sm font-semibold text-slate-700">
                Property type
              </label>
              <div className="grid gap-3">
                {SITE_TYPE_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  const selected = siteForm.siteType === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() =>
                        setSiteForm((current) => ({
                          ...current,
                          siteType: option.value,
                        }))
                      }
                      className={`flex items-start gap-3 rounded-2xl border px-4 py-4 text-left transition ${
                        selected
                          ? "border-cyan-300 bg-cyan-50 shadow-[0_10px_25px_rgba(34,211,238,0.12)]"
                          : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white"
                      }`}
                    >
                      <div className="rounded-2xl bg-white p-2.5 text-slate-700 shadow-sm ring-1 ring-slate-200">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-900">
                            {option.label}
                          </span>
                          {selected ? (
                            <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cyan-700">
                              selected
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-sm leading-6 text-slate-500">
                          {option.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Primary locale
                </label>
                <select
                  value={siteForm.primaryLocale ?? "en"}
                  onChange={(event) =>
                    setSiteForm((current) => {
                      const nextPrimaryLocale = event.target.value;
                      const nextLocales = new Set(
                        current.enabledLocales ?? ["en"],
                      );
                      nextLocales.add(nextPrimaryLocale);
                      return {
                        ...current,
                        primaryLocale: nextPrimaryLocale,
                        enabledLocales: Array.from(nextLocales),
                      };
                    })
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:bg-white"
                >
                  {LOCALES.map((locale) => (
                    <option key={locale} value={locale}>
                      {locale.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Template key
                </label>
                <input
                  value={siteForm.templateKey ?? ""}
                  onChange={(event) =>
                    setSiteForm((current) => ({
                      ...current,
                      templateKey: event.target.value,
                    }))
                  }
                  placeholder="coastal-luxury"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:bg-white"
                />
              </div>
            </div>

            <div>
              <label className="mb-3 block text-sm font-semibold text-slate-700">
                Active locales
              </label>
              <div className="flex flex-wrap gap-2">
                {LOCALES.map((locale) => {
                  const selected = (siteForm.enabledLocales ?? ["en"]).includes(
                    locale,
                  );
                  const locked = locale === siteForm.primaryLocale;
                  return (
                    <button
                      key={locale}
                      type="button"
                      onClick={() => {
                        if (locked) {
                          toast.error(
                            "The primary locale must remain enabled.",
                          );
                          return;
                        }

                        setSiteForm((current) => ({
                          ...current,
                          enabledLocales: toggleLocale(
                            current.enabledLocales ?? ["en"],
                            locale,
                          ),
                        }));
                      }}
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                        selected
                          ? "border-cyan-300 bg-cyan-50 text-cyan-700"
                          : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700"
                      }`}
                    >
                      {locale.toUpperCase()}
                      {locked ? " · primary" : ""}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={() => createSiteMutation.mutate()}
              disabled={createSiteMutation.isPending}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {createSiteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Provision site
            </button>
          </div>
        </div>
      </section>

      {tenantId && canUseDangerActions ? (
        <ArchivedSitesPanel
          tenantId={tenantId}
          canManageDangerActions={canUseDangerActions}
        />
      ) : null}

      {tenantId && canUseDangerActions ? (
        <WorkspaceDangerZone
          tenantId={tenantId}
          canManageDangerActions={canUseDangerActions}
        />
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                Crew board
              </p>
              <h2 className="mt-2 text-2xl font-bold text-slate-950">
                Live team access for this workspace
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Search the current roster, verify role balance, and make sure
                every collaborator lands in the right part of the product.
              </p>
            </div>
            <button
              onClick={() => void refetchMembers()}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              Refresh
            </button>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <MetaChip
              label={`${ownerCount} owner${ownerCount === 1 ? "" : "s"}`}
              tone="neutral"
            />
            <MetaChip
              label={`${adminCount} admin${adminCount === 1 ? "" : "s"}`}
              tone="accent"
            />
            <MetaChip
              label={`${editorCount} editor${editorCount === 1 ? "" : "s"}`}
              tone="neutral"
            />
            <MetaChip
              label={`${billingCount} billing${billingCount === 1 ? "" : "s"}`}
              tone="success"
            />
          </div>

          <div className="relative mt-5">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={memberSearch}
              onChange={(event) => setMemberSearch(event.target.value)}
              placeholder="Filter by email"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:bg-white"
            />
          </div>

          {membersError ? (
            <InlineErrorPanel
              title="Member roster could not be loaded"
              body="Retry the workspace query before changing team access."
              actionLabel="Retry"
              onAction={() => void refetchMembers()}
            />
          ) : membersLoading ? (
            <LoadingPanel label="Loading team roster" />
          ) : filteredMembers.length === 0 ? (
            <EmptyPanel
              title={
                members.length === 0
                  ? "No members yet"
                  : "No matches for this search"
              }
              body={
                members.length === 0
                  ? "Add your first teammate from the composer on the right."
                  : "Try another email fragment or clear the filter."
              }
            />
          ) : (
            <div className="mt-6 space-y-3">
              {filteredMembers.map((member) => {
                const isCurrentUser = member.userId === session?.user.id;
                const isLastOwner = member.role === "OWNER" && ownerCount <= 1;
                const pendingRemoval = memberPendingRemovalId === member.id;
                const removingMember =
                  removeMemberMutation.isPending &&
                  removeMemberMutation.variables?.id === member.id;
                const canRemoveMember =
                  canUseDangerActions && !isCurrentUser && !isLastOwner;
                const actorRole = session?.activeMembershipRole ?? null;
                const isActorOwner = actorRole === "OWNER";
                const ownerInvolvedForActor =
                  member.role === "OWNER" && !isActorOwner;
                const canEditRole =
                  !isCurrentUser &&
                  !ownerInvolvedForActor &&
                  (actorRole === "OWNER" || actorRole === "ADMIN");
                const pendingRole = memberRoleEdits[member.id] ?? member.role;
                const updatingRole =
                  updateMemberRoleMutation.isPending &&
                  updateMemberRoleMutation.variables?.member.id === member.id;
                const roleOptionsForMember = MEMBER_ROLE_OPTIONS.filter(
                  (option) => option.value !== "OWNER" || isActorOwner,
                );
                const roleDirty =
                  pendingRole !== member.role &&
                  roleOptionsForMember.some(
                    (option) => option.value === pendingRole,
                  );
                const promotingFromOwner =
                  member.role === "OWNER" && pendingRole !== "OWNER";
                const blockedByLastOwner = promotingFromOwner && isLastOwner;
                const canTransferOwnership =
                  isActorOwner && !isCurrentUser && member.role !== "OWNER";
                const transferOpen = transferTargetMemberId === member.id;
                const transferring =
                  transferOwnershipMutation.isPending &&
                  transferOwnershipMutation.variables?.member.id === member.id;
                const transferConfirmMatches =
                  transferConfirmEmail.trim().toLowerCase() ===
                  member.email.trim().toLowerCase();

                return (
                  <article
                    key={member.id}
                    className="rounded-[22px] border border-slate-200 bg-slate-50/80 p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold text-slate-900">
                            {member.email}
                          </p>
                          {isCurrentUser ? (
                            <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cyan-700">
                              You
                            </span>
                          ) : null}
                          {member.isDefault ? (
                            <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                              Default workspace
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          Added {formatRelativeTime(member.createdAt)} ·{" "}
                          {formatDate(member.createdAt)}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {canEditRole ? (
                          <div className="flex items-center gap-2">
                            <label
                              className="sr-only"
                              htmlFor={`role-${member.id}`}
                            >
                              Role for {member.email}
                            </label>
                            <select
                              id={`role-${member.id}`}
                              value={pendingRole}
                              onChange={(event) => {
                                const nextRole = event.target
                                  .value as WorkspaceMemberRole;
                                setMemberRoleEdits((current) => ({
                                  ...current,
                                  [member.id]: nextRole,
                                }));
                              }}
                              disabled={updatingRole}
                              className={`rounded-full border px-3 py-1 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:cursor-not-allowed disabled:opacity-60 ${MEMBER_ROLE_STYLES[pendingRole]}`}
                            >
                              {!roleOptionsForMember.some(
                                (option) => option.value === member.role,
                              ) ? (
                                <option value={member.role}>
                                  {describeMembershipRole(member.role)}
                                </option>
                              ) : null}
                              {roleOptionsForMember.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                            {roleDirty ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateMemberRoleMutation.mutate({
                                      member,
                                      role: pendingRole,
                                    })
                                  }
                                  disabled={updatingRole || blockedByLastOwner}
                                  title={
                                    blockedByLastOwner
                                      ? "A workspace must keep at least one owner. Promote another member to Owner first."
                                      : `Save role for ${member.email}`
                                  }
                                  className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                                >
                                  {updatingRole ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Check className="h-3.5 w-3.5" />
                                  )}
                                  Save
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setMemberRoleEdits((current) => {
                                      const next = { ...current };
                                      delete next[member.id];
                                      return next;
                                    })
                                  }
                                  disabled={updatingRole}
                                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  <X className="h-3.5 w-3.5" />
                                  Cancel
                                </button>
                              </>
                            ) : null}
                          </div>
                        ) : (
                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-semibold ${MEMBER_ROLE_STYLES[member.role]}`}
                          >
                            {describeMembershipRole(member.role)}
                          </span>
                        )}
                        {canUseDangerActions ? (
                          <button
                            type="button"
                            onClick={() =>
                              setMemberPendingRemovalId(
                                pendingRemoval ? null : member.id,
                              )
                            }
                            disabled={!canRemoveMember || removingMember}
                            title={
                              isCurrentUser
                                ? "You cannot remove yourself here"
                                : isLastOwner
                                  ? "A workspace must keep one owner"
                                  : `Remove ${member.email}`
                            }
                            className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {removingMember ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <UserMinus className="h-3.5 w-3.5" />
                            )}
                            Remove
                          </button>
                        ) : null}
                        {canTransferOwnership ? (
                          <button
                            type="button"
                            onClick={() => {
                              if (transferOpen) {
                                setTransferTargetMemberId(null);
                                setTransferConfirmEmail("");
                                setTransferDemoteRole("ADMIN");
                              } else {
                                setTransferTargetMemberId(member.id);
                                setTransferConfirmEmail("");
                                setTransferDemoteRole("ADMIN");
                              }
                            }}
                            disabled={transferring}
                            title={`Transfer ownership to ${member.email}`}
                            className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {transferring ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <KeyRound className="h-3.5 w-3.5" />
                            )}
                            Transfer ownership
                          </button>
                        ) : null}
                      </div>
                    </div>

                    {transferOpen ? (
                      <div className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 p-4">
                        <div className="flex items-start gap-3">
                          <div className="rounded-full bg-white p-2 text-amber-800 shadow-sm">
                            <KeyRound className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-amber-950">
                              Transfer ownership to {member.email}?
                            </p>
                            <p className="mt-1 text-xs leading-5 text-amber-900">
                              {member.email} will become the new workspace owner
                              with full control. You will be demoted to the role
                              you choose below and may need to sign back in for
                              permissions to refresh.
                            </p>
                            <div className="mt-3 grid gap-3 sm:grid-cols-2">
                              <label className="block text-xs font-semibold text-amber-900">
                                Your new role
                                <select
                                  value={transferDemoteRole}
                                  onChange={(event) =>
                                    setTransferDemoteRole(
                                      event.target
                                        .value as DemotableWorkspaceRole,
                                    )
                                  }
                                  disabled={transferring}
                                  className="mt-1 w-full rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-60"
                                >
                                  <option value="ADMIN">Admin</option>
                                  <option value="EDITOR">Editor</option>
                                  <option value="BILLING">
                                    Billing contact
                                  </option>
                                </select>
                              </label>
                              <label className="block text-xs font-semibold text-amber-900">
                                Type the member email to confirm
                                <input
                                  value={transferConfirmEmail}
                                  onChange={(event) =>
                                    setTransferConfirmEmail(event.target.value)
                                  }
                                  disabled={transferring}
                                  placeholder={member.email}
                                  className="mt-1 w-full rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-60"
                                />
                              </label>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  transferOwnershipMutation.mutate({
                                    member,
                                    demoteSelfTo: transferDemoteRole,
                                  })
                                }
                                disabled={
                                  transferring || !transferConfirmMatches
                                }
                                title={
                                  transferConfirmMatches
                                    ? `Transfer ownership to ${member.email}`
                                    : "Type the member email to confirm"
                                }
                                className="inline-flex items-center gap-2 rounded-full bg-amber-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-800 disabled:cursor-not-allowed disabled:bg-amber-300"
                              >
                                {transferring ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <KeyRound className="h-3.5 w-3.5" />
                                )}
                                Transfer ownership
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setTransferTargetMemberId(null);
                                  setTransferConfirmEmail("");
                                  setTransferDemoteRole("ADMIN");
                                }}
                                disabled={transferring}
                                className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                <X className="h-3.5 w-3.5" />
                                Cancel
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {pendingRemoval ? (
                      <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4">
                        <div className="flex items-start gap-3">
                          <div className="rounded-full bg-white p-2 text-rose-700 shadow-sm">
                            <AlertTriangle className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-rose-950">
                              Remove {member.email}?
                            </p>
                            <p className="mt-1 text-xs leading-5 text-rose-800">
                              Their access to this workspace ends immediately.
                              Other workspace memberships on the account are not
                              changed.
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  removeMemberMutation.mutate(member)
                                }
                                disabled={removingMember}
                                className="inline-flex items-center gap-2 rounded-full bg-rose-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-800 disabled:cursor-not-allowed disabled:bg-rose-300"
                              >
                                {removingMember ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <UserMinus className="h-3.5 w-3.5" />
                                )}
                                Remove member
                              </button>
                              <button
                                type="button"
                                onClick={() => setMemberPendingRemovalId(null)}
                                disabled={removingMember}
                                className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-800 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                <X className="h-3.5 w-3.5" />
                                Cancel
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
            Team composer
          </p>
          <h2 className="mt-2 text-2xl font-bold text-slate-950">
            Add existing accounts or set up new teammates
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Invite collaborators by email, or create a brand-new teammate
            account and let them choose their own password securely.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setMemberComposerMode("invite")}
              className={`rounded-[22px] border px-4 py-4 text-left transition ${
                memberComposerMode === "invite"
                  ? "border-cyan-300 bg-cyan-50"
                  : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-white p-2.5 text-slate-700 shadow-sm ring-1 ring-slate-200">
                  <UserPlus className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Email invitation
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Best for anyone who might already use StayLayer in another
                    workspace.
                  </p>
                </div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setMemberComposerMode("create")}
              className={`rounded-[22px] border px-4 py-4 text-left transition ${
                memberComposerMode === "create"
                  ? "border-amber-300 bg-amber-50"
                  : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-white p-2.5 text-slate-700 shadow-sm ring-1 ring-slate-200">
                  <Shield className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Send account setup
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Create a brand-new customer login and send a password setup
                    link.
                  </p>
                </div>
              </div>
            </button>
          </div>

          <div className="mt-6 space-y-4">
            {memberComposerMode === "invite" ? (
              <>
                <FieldLabel label="Teammate email" icon={Mail} />
                <p className="text-xs leading-5 text-slate-500">
                  Existing users confirm their password; new users choose a name
                  and password from the invitation flow.
                </p>
                <input
                  value={inviteForm.email}
                  onChange={(event) =>
                    setInviteForm((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                  placeholder="ops@azurebayvillas.com"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:bg-white"
                />

                <RolePicker
                  value={inviteForm.role}
                  onChange={(role) =>
                    setInviteForm((current) => ({
                      ...current,
                      role,
                    }))
                  }
                />

                <button
                  type="button"
                  onClick={() => inviteMemberMutation.mutate()}
                  disabled={inviteMemberMutation.isPending}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {inviteMemberMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <UserPlus className="h-4 w-4" />
                  )}
                  Send invitation
                </button>
              </>
            ) : (
              <>
                <FieldLabel label="New teammate email" icon={Mail} />
                <input
                  value={createForm.email}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                  placeholder="team@azurebayvillas.com"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:bg-white"
                />

                <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">
                  StayLayer will create the account, add workspace access, and
                  send a secure link so this teammate can choose their own
                  password.
                </p>

                <RolePicker
                  value={createForm.role}
                  onChange={(role) =>
                    setCreateForm((current) => ({
                      ...current,
                      role,
                    }))
                  }
                />

                <button
                  type="button"
                  onClick={() => createMemberMutation.mutate()}
                  disabled={createMemberMutation.isPending}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {createMemberMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Shield className="h-4 w-4" />
                  )}
                  Send setup email
                </button>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function handleSiteNameChange(
  setSiteForm: React.Dispatch<React.SetStateAction<CreateWorkspaceSitePayload>>,
  siteSlugTouched: boolean,
  setSiteSlugTouched: React.Dispatch<React.SetStateAction<boolean>>,
  sitePublicSubdomainTouched: boolean,
) {
  return (event: ChangeEvent<HTMLInputElement>) => {
    const nextName = event.target.value;
    setSiteForm((current) => ({
      ...current,
      name: nextName,
      slug: siteSlugTouched ? current.slug : slugifySiteName(nextName),
      publicSubdomain: sitePublicSubdomainTouched
        ? current.publicSubdomain
        : slugifySiteName(nextName),
    }));

    if (!siteSlugTouched && nextName.trim().length === 0) {
      setSiteSlugTouched(false);
    }
  };
}

function toggleLocale(currentLocales: string[], locale: string): string[] {
  if (currentLocales.includes(locale)) {
    return currentLocales.filter((item) => item !== locale);
  }

  return [...currentLocales, locale];
}

function readableSiteType(type: WorkspaceSiteType): string {
  switch (type) {
    case "VACATION_RENTAL":
      return "Villa / Rental";
    case "BOUTIQUE_HOTEL":
      return "Boutique hotel";
    case "BNB":
      return "B&B";
    case "GLAMPING":
      return "Glamping";
    case "GUEST_HOUSE":
      return "Guest house";
  }
}

function getSiteTypeIcon(type: WorkspaceSiteType) {
  switch (type) {
    case "VACATION_RENTAL":
      return Home;
    case "BOUTIQUE_HOTEL":
      return Hotel;
    case "BNB":
      return BedDouble;
    case "GLAMPING":
      return Sparkles;
    case "GUEST_HOUSE":
      return Building2;
  }
}

function StatTile({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint: string;
  icon: typeof Building2;
}) {
  return (
    <div className="rounded-3xl border border-white/70 bg-white/75 p-4 shadow-[0_12px_30px_rgba(148,163,184,0.14)] backdrop-blur-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
            {label}
          </p>
          <p className="mt-2 text-xl font-bold text-slate-950">{value}</p>
        </div>
        <div className="rounded-2xl bg-slate-950 p-2.5 text-white">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-500">{hint}</p>
    </div>
  );
}

function ContextRow({
  label,
  value,
  meta,
}: {
  label: string;
  value: string;
  meta: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{meta}</p>
    </div>
  );
}

function MetaChip({
  label,
  tone,
}: {
  label: string;
  tone: "neutral" | "accent" | "success";
}) {
  const toneClass =
    tone === "accent"
      ? "border-cyan-200 bg-cyan-50 text-cyan-700"
      : tone === "success"
        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
        : "border-slate-200 bg-white text-slate-600";

  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs font-semibold ${toneClass}`}
    >
      {label}
    </span>
  );
}

function InlineErrorPanel({
  title,
  body,
  actionLabel,
  onAction,
}: {
  title: string;
  body: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-5">
      <h3 className="text-sm font-semibold text-rose-900">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-rose-800">{body}</p>
      <button
        onClick={onAction}
        className="mt-4 rounded-full border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-800 hover:bg-rose-100"
      >
        {actionLabel}
      </button>
    </div>
  );
}

function LoadingPanel({ label }: { label: string }) {
  return (
    <div className="mt-6 flex items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-6 py-10 text-sm text-slate-500">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}

function EmptyPanel({ title, body }: { title: string; body: string }) {
  return (
    <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">
        {body}
      </p>
    </div>
  );
}

function RolePicker({
  value,
  onChange,
}: {
  value: WorkspaceMemberRole;
  onChange: (role: WorkspaceMemberRole) => void;
}) {
  return (
    <div>
      <FieldLabel label="Workspace role" icon={Shield} />
      <div className="mt-2 space-y-3">
        {MEMBER_ROLE_OPTIONS.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={`flex w-full items-start gap-3 rounded-2xl border px-4 py-4 text-left transition ${
                selected
                  ? "border-cyan-300 bg-cyan-50"
                  : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white"
              }`}
            >
              <div className="mt-0.5 rounded-full border border-slate-200 bg-white p-2 text-slate-600">
                <Shield className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-900">
                    {option.label}
                  </span>
                  {selected ? (
                    <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cyan-700">
                      selected
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  {option.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FieldLabel({
  label,
  icon: Icon,
}: {
  label: string;
  icon: typeof Mail;
}) {
  return (
    <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
      <Icon className="h-4 w-4 text-slate-400" />
      {label}
    </div>
  );
}
