import { createBrowserRouter } from "react-router-dom";
import { OperatorLayout } from "./components/OperatorLayout";
import { ProtectedOperatorRoute } from "./auth/ProtectedOperatorRoute";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { PermissionRoute, OPERATOR_PERMISSIONS } from "./permissions";
import LoginPage from "./pages/LoginPage";
import CommandCenterPage from "./pages/CommandCenterPage";
import TenantsListPage from "./pages/TenantsListPage";
import TenantDetailPage from "./pages/TenantDetailPage";
import SiteDetailPage from "./pages/SiteDetailPage";
import AuditLogPage from "./pages/AuditLogPage";
import GlobalSearchPage from "./pages/GlobalSearchPage";
import SupportInboxPage from "./pages/SupportInboxPage";
import SupportCaseDetailPage from "./pages/SupportCaseDetailPage";
import SupportCaseNewPage from "./pages/SupportCaseNewPage";
import BillingOverviewPage from "./pages/BillingOverviewPage";
import BillingAccountsListPage from "./pages/BillingAccountsListPage";
import BillingAccountDetailPage from "./pages/BillingAccountDetailPage";
import BillingActionRequestsPage from "./pages/BillingActionRequestsPage";
import BillingWebhooksPage from "./pages/BillingWebhooksPage";
import ForbiddenPage from "./pages/ForbiddenPage";
import NotFoundPage from "./pages/NotFoundPage";

// Phase 4 router. Each authenticated route is wrapped in a `PermissionRoute`
// so a session that lacks the relevant permission set is redirected to
// `/forbidden` before the page renders. This mirrors the API guards and
// makes accidental leakage of sensitive data via direct URLs impossible.
export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  { path: "/forbidden", element: <ForbiddenPage /> },
  {
    element: <ProtectedOperatorRoute />,
    children: [
      {
        element: <OperatorLayout />,
        children: [
          {
            element: (
              <PermissionRoute
                anyOf={[
                  OPERATOR_PERMISSIONS.OVERVIEW_READ_ALL,
                  OPERATOR_PERMISSIONS.OVERVIEW_READ_SUPPORT,
                  OPERATOR_PERMISSIONS.OVERVIEW_READ_BILLING,
                ]}
              />
            ),
            children: [
              {
                path: "/",
                element: (
                  <ErrorBoundary>
                    <CommandCenterPage />
                  </ErrorBoundary>
                ),
              },
            ],
          },
          {
            element: (
              <PermissionRoute
                anyOf={[
                  OPERATOR_PERMISSIONS.TENANT_LIST_ALL,
                  OPERATOR_PERMISSIONS.TENANT_READ_ALL,
                ]}
              />
            ),
            children: [
              {
                path: "/tenants",
                element: (
                  <ErrorBoundary>
                    <TenantsListPage />
                  </ErrorBoundary>
                ),
              },
            ],
          },
          {
            element: (
              <PermissionRoute
                anyOf={[
                  OPERATOR_PERMISSIONS.TENANT_READ_ALL,
                  OPERATOR_PERMISSIONS.TENANT_READ_BILLING,
                ]}
              />
            ),
            children: [
              {
                path: "/tenants/:tenantId",
                element: (
                  <ErrorBoundary>
                    <TenantDetailPage />
                  </ErrorBoundary>
                ),
              },
            ],
          },
          {
            element: (
              <PermissionRoute anyOf={[OPERATOR_PERMISSIONS.SITE_READ_ALL]} />
            ),
            children: [
              {
                path: "/sites/:siteId",
                element: (
                  <ErrorBoundary>
                    <SiteDetailPage />
                  </ErrorBoundary>
                ),
              },
            ],
          },
          {
            element: (
              <PermissionRoute
                anyOf={[
                  OPERATOR_PERMISSIONS.AUDIT_READ_ALL,
                  OPERATOR_PERMISSIONS.AUDIT_READ_SUPPORT,
                  OPERATOR_PERMISSIONS.AUDIT_READ_BILLING,
                ]}
              />
            ),
            children: [
              {
                path: "/audit",
                element: (
                  <ErrorBoundary>
                    <AuditLogPage />
                  </ErrorBoundary>
                ),
              },
            ],
          },
          {
            element: (
              <PermissionRoute
                anyOf={[
                  OPERATOR_PERMISSIONS.SUPPORT_CASE_READ_ALL,
                  OPERATOR_PERMISSIONS.SUPPORT_CASE_READ_BILLING,
                  OPERATOR_PERMISSIONS.SUPPORT_CASE_LIST_ALL,
                ]}
              />
            ),
            children: [
              {
                path: "/support",
                element: (
                  <ErrorBoundary>
                    <SupportInboxPage />
                  </ErrorBoundary>
                ),
              },
              {
                path: "/support/:caseId",
                element: (
                  <ErrorBoundary>
                    <SupportCaseDetailPage />
                  </ErrorBoundary>
                ),
              },
            ],
          },
          {
            element: (
              <PermissionRoute
                anyOf={[OPERATOR_PERMISSIONS.SUPPORT_CASE_CREATE_ALL]}
              />
            ),
            children: [
              {
                path: "/support/new",
                element: (
                  <ErrorBoundary>
                    <SupportCaseNewPage />
                  </ErrorBoundary>
                ),
              },
            ],
          },
          {
            element: (
              <PermissionRoute
                anyOf={[
                  OPERATOR_PERMISSIONS.BILLING_ACCOUNT_READ_ALL,
                  OPERATOR_PERMISSIONS.BILLING_SUBSCRIPTION_READ_ALL,
                  OPERATOR_PERMISSIONS.BILLING_INVOICE_READ_ALL,
                ]}
              />
            ),
            children: [
              {
                path: "/billing",
                element: (
                  <ErrorBoundary>
                    <BillingOverviewPage />
                  </ErrorBoundary>
                ),
              },
              {
                path: "/billing/accounts",
                element: (
                  <ErrorBoundary>
                    <BillingAccountsListPage />
                  </ErrorBoundary>
                ),
              },
              {
                path: "/billing/accounts/:tenantId",
                element: (
                  <ErrorBoundary>
                    <BillingAccountDetailPage />
                  </ErrorBoundary>
                ),
              },
              {
                path: "/billing/approvals",
                element: (
                  <ErrorBoundary>
                    <BillingActionRequestsPage />
                  </ErrorBoundary>
                ),
              },
              {
                path: "/billing/webhooks",
                element: (
                  <ErrorBoundary>
                    <BillingWebhooksPage />
                  </ErrorBoundary>
                ),
              },
            ],
          },
          {
            path: "/search",
            element: (
              <ErrorBoundary>
                <GlobalSearchPage />
              </ErrorBoundary>
            ),
          },
        ],
      },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
]);
