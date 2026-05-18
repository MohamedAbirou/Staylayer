import { createBrowserRouter, Link, Navigate } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import {
  BILLING_MEMBERSHIP_ROLES,
  CONTENT_MEMBERSHIP_ROLES,
  hasActiveSite,
  SITE_ADMIN_MEMBERSHIP_ROLES,
} from "./auth/access";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { useAuth } from "./auth/useAuth";
import AuthHandoffPage from "./pages/AuthHandoffPage";
import MarketingLoginRedirectPage from "./pages/MarketingLoginRedirectPage";
import PagesListPage from "./pages/PagesListPage";
import NewPagePage from "./pages/NewPagePage";
import EditorPage from "./pages/EditorPage";
import PreviewPage from "./pages/PreviewPage";
import SettingsPage from "./pages/SettingsPage";
import DashboardHome from "./pages/DashboardHome";
import UsagePage from "./pages/UsagePage";
import FormsPage from "./pages/FormsPage";
import DomainsPage from "./pages/DomainsPage";
import DeploymentsPage from "./pages/DeploymentsPage";
import TranslationCenterPage from "./pages/TranslationCenterPage";
import GlossaryPage from "./pages/GlossaryPage";
import SeoPage from "./pages/SeoPage";
import SearchConsoleCallbackPage from "./pages/SearchConsoleCallbackPage";
import BillingPage from "./pages/BillingPage";
import WorkspaceStudioPage from "./pages/WorkspaceStudioPage";
import ProfilePage from "./pages/ProfilePage";
import NoWorkspacePage from "./pages/NoWorkspacePage";

function LegacyOnboardingRedirect() {
  const { session } = useAuth();

  return (
    <Navigate
      to={hasActiveSite(session) ? "/pages/new" : "/workspace"}
      replace
    />
  );
}

interface NotFoundPageProps {
  title?: string;
  description?: string;
  backTo?: string;
  backLabel?: string;
}

function NotFoundPage({
  title = "Page not found",
  description = "The page you requested does not exist or is no longer available.",
  backTo = "/",
  backLabel = "Back to Dashboard",
}: NotFoundPageProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-16">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-xl shadow-slate-200/60">
        <span className="text-xs font-semibold uppercase tracking-[0.32em] text-sky-600">
          StayLayer
        </span>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">
          {title}
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p>
        <div className="mt-8 flex justify-center">
          <Link
            to={backTo}
            className="inline-flex items-center rounded-full bg-slate-950 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            {backLabel}
          </Link>
        </div>
      </div>
    </div>
  );
}

export const router = createBrowserRouter([
  {
    path: "/auth/handoff",
    element: <AuthHandoffPage />,
  },
  {
    path: "/login",
    element: <MarketingLoginRedirectPage />,
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <Layout />,
        children: [
          {
            path: "/no-workspace",
            element: <NoWorkspacePage />,
          },
          {
            path: "/workspaces/new",
            element: <NoWorkspacePage mode="create" />,
          },
          {
            path: "/",
            element: (
              <ProtectedRoute
                membershipRoles={CONTENT_MEMBERSHIP_ROLES}
                redirectTo="/settings"
              >
                <ErrorBoundary>
                  <DashboardHome />
                </ErrorBoundary>
              </ProtectedRoute>
            ),
          },
          {
            path: "/pages",
            element: (
              <ProtectedRoute
                membershipRoles={CONTENT_MEMBERSHIP_ROLES}
                requireActiveSite
              >
                <ErrorBoundary>
                  <PagesListPage />
                </ErrorBoundary>
              </ProtectedRoute>
            ),
          },
          {
            path: "/pages/new",
            element: (
              <ProtectedRoute
                membershipRoles={CONTENT_MEMBERSHIP_ROLES}
                requireActiveSite
              >
                <NewPagePage />
              </ProtectedRoute>
            ),
          },
          {
            path: "/settings",
            element: (
              <ProtectedRoute
                membershipRoles={SITE_ADMIN_MEMBERSHIP_ROLES}
                requireActiveSite
              >
                <SettingsPage />
              </ProtectedRoute>
            ),
          },
          {
            path: "/workspace",
            element: (
              <ProtectedRoute membershipRoles={SITE_ADMIN_MEMBERSHIP_ROLES}>
                <ErrorBoundary>
                  <WorkspaceStudioPage />
                </ErrorBoundary>
              </ProtectedRoute>
            ),
          },
          {
            path: "/profile",
            element: (
              <ProtectedRoute>
                <ErrorBoundary>
                  <ProfilePage />
                </ErrorBoundary>
              </ProtectedRoute>
            ),
          },
          {
            path: "/onboarding",
            element: (
              <ProtectedRoute membershipRoles={CONTENT_MEMBERSHIP_ROLES}>
                <LegacyOnboardingRedirect />
              </ProtectedRoute>
            ),
          },
          {
            path: "/forms",
            element: (
              <ProtectedRoute
                membershipRoles={CONTENT_MEMBERSHIP_ROLES}
                requireActiveSite
              >
                <ErrorBoundary>
                  <FormsPage />
                </ErrorBoundary>
              </ProtectedRoute>
            ),
          },
          {
            path: "/domains",
            element: (
              <ProtectedRoute
                membershipRoles={CONTENT_MEMBERSHIP_ROLES}
                requireActiveSite
              >
                <ErrorBoundary>
                  <DomainsPage />
                </ErrorBoundary>
              </ProtectedRoute>
            ),
          },
          {
            path: "/deployments",
            element: (
              <ProtectedRoute
                membershipRoles={CONTENT_MEMBERSHIP_ROLES}
                requireActiveSite
              >
                <ErrorBoundary>
                  <DeploymentsPage />
                </ErrorBoundary>
              </ProtectedRoute>
            ),
          },
          {
            path: "/translation",
            element: (
              <ProtectedRoute
                membershipRoles={CONTENT_MEMBERSHIP_ROLES}
                requireActiveSite
              >
                <ErrorBoundary>
                  <TranslationCenterPage />
                </ErrorBoundary>
              </ProtectedRoute>
            ),
          },
          {
            path: "/glossary",
            element: (
              <ProtectedRoute
                membershipRoles={CONTENT_MEMBERSHIP_ROLES}
                requireActiveSite
              >
                <ErrorBoundary>
                  <GlossaryPage />
                </ErrorBoundary>
              </ProtectedRoute>
            ),
          },
          {
            path: "/seo",
            element: (
              <ProtectedRoute
                membershipRoles={CONTENT_MEMBERSHIP_ROLES}
                requireActiveSite
              >
                <ErrorBoundary>
                  <SeoPage />
                </ErrorBoundary>
              </ProtectedRoute>
            ),
          },
          {
            path: "/seo/search-console/callback",
            element: (
              <ProtectedRoute
                membershipRoles={SITE_ADMIN_MEMBERSHIP_ROLES}
                requireActiveSite
              >
                <ErrorBoundary>
                  <SearchConsoleCallbackPage />
                </ErrorBoundary>
              </ProtectedRoute>
            ),
          },
          {
            path: "/usage",
            element: (
              <ProtectedRoute membershipRoles={CONTENT_MEMBERSHIP_ROLES}>
                <ErrorBoundary>
                  <UsagePage />
                </ErrorBoundary>
              </ProtectedRoute>
            ),
          },
          {
            path: "/billing",
            element: (
              <ProtectedRoute membershipRoles={BILLING_MEMBERSHIP_ROLES}>
                <ErrorBoundary>
                  <BillingPage />
                </ErrorBoundary>
              </ProtectedRoute>
            ),
          },
        ],
      },
      {
        path: "/editor/:slug",
        element: (
          <ProtectedRoute
            membershipRoles={CONTENT_MEMBERSHIP_ROLES}
            requireActiveSite
          >
            <ErrorBoundary>
              <EditorPage />
            </ErrorBoundary>
          </ProtectedRoute>
        ),
      },
      {
        path: "/preview/:slug",
        element: (
          <ProtectedRoute
            membershipRoles={CONTENT_MEMBERSHIP_ROLES}
            requireActiveSite
          >
            <PreviewPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "*",
        element: <NotFoundPage />,
      },
    ],
  },
]);
