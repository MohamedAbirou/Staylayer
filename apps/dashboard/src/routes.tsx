import { createBrowserRouter, Navigate } from "react-router-dom";
import { Layout } from "./components/Layout";
import { AdminLayout } from "./components/AdminLayout";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import {
  BILLING_MEMBERSHIP_ROLES,
  CONTENT_MEMBERSHIP_ROLES,
  SITE_ADMIN_MEMBERSHIP_ROLES,
} from "./auth/access";
import { PLATFORM_ROLES } from "./auth/types";
import { ErrorBoundary } from "./components/ErrorBoundary";
import LoginPage from "./pages/LoginPage";
import PagesListPage from "./pages/PagesListPage";
import NewPagePage from "./pages/NewPagePage";
import EditorPage from "./pages/EditorPage";
import PreviewPage from "./pages/PreviewPage";
import SettingsPage from "./pages/SettingsPage";
import DashboardHome from "./pages/DashboardHome";
import OnboardingPage from "./pages/OnboardingPage";
import FormsPage from "./pages/FormsPage";
import DomainsPage from "./pages/DomainsPage";
import DeploymentsPage from "./pages/DeploymentsPage";
import BillingPage from "./pages/BillingPage";
import WorkspaceStudioPage from "./pages/WorkspaceStudioPage";
import AdminOverviewPage from "./pages/admin/AdminOverviewPage";
import AdminTenantsPage from "./pages/admin/AdminTenantsPage";
import AdminDeploymentsPage from "./pages/admin/AdminDeploymentsPage";
import AdminSubscriptionsPage from "./pages/admin/AdminSubscriptionsPage";
import AdminDomainsPage from "./pages/admin/AdminDomainsPage";
import AdminFormsPage from "./pages/admin/AdminFormsPage";
import AdminAuditPage from "./pages/admin/AdminAuditPage";

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <Layout />,
        children: [
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
            path: "/onboarding",
            element: (
              <ProtectedRoute membershipRoles={CONTENT_MEMBERSHIP_ROLES}>
                <ErrorBoundary>
                  <OnboardingPage />
                </ErrorBoundary>
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
    ],
  },

  // ─── Operator admin console ──────────────────────────────────────────────
  // Completely separate route tree. Guarded exclusively by platform role.
  // No customer membership roles are used within this subtree.
  {
    path: "/admin",
    element: (
      <ProtectedRoute platformRoles={[...PLATFORM_ROLES]}>
        <AdminLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="/admin/overview" replace /> },
      {
        path: "overview",
        element: (
          <ErrorBoundary>
            <AdminOverviewPage />
          </ErrorBoundary>
        ),
      },
      {
        path: "tenants",
        element: (
          <ErrorBoundary>
            <AdminTenantsPage />
          </ErrorBoundary>
        ),
      },
      {
        path: "deployments",
        element: (
          <ErrorBoundary>
            <AdminDeploymentsPage />
          </ErrorBoundary>
        ),
      },
      {
        path: "subscriptions",
        element: (
          <ErrorBoundary>
            <AdminSubscriptionsPage />
          </ErrorBoundary>
        ),
      },
      {
        path: "domains",
        element: (
          <ErrorBoundary>
            <AdminDomainsPage />
          </ErrorBoundary>
        ),
      },
      {
        path: "forms",
        element: (
          <ErrorBoundary>
            <AdminFormsPage />
          </ErrorBoundary>
        ),
      },
      {
        path: "audit",
        element: (
          <ErrorBoundary>
            <AdminAuditPage />
          </ErrorBoundary>
        ),
      },
    ],
  },
]);
