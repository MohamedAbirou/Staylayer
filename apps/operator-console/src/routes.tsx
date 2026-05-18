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
import OperationsLandingPage from "./pages/OperationsLandingPage";
import OperationsDeploymentsPage from "./pages/OperationsDeploymentsPage";
import OperationsDomainsPage from "./pages/OperationsDomainsPage";
import OperationsFormsPage from "./pages/OperationsFormsPage";
import OperationsAlertsPage from "./pages/OperationsAlertsPage";
import OperationsSeoPage from "./pages/OperationsSeoPage";
import OperationsTranslationsPage from "./pages/OperationsTranslationsPage";
import OperationsNotificationsPage from "./pages/OperationsNotificationsPage";
import AnalyticsLandingPage from "./pages/AnalyticsLandingPage";
import AnalyticsBusinessPage from "./pages/AnalyticsBusinessPage";
import AnalyticsSupportPage from "./pages/AnalyticsSupportPage";
import AnalyticsOperationsPage from "./pages/AnalyticsOperationsPage";
import TenantHealthPage from "./pages/TenantHealthPage";
import ObservabilityPage from "./pages/ObservabilityPage";
import OperatorUsersListPage from "./pages/OperatorUsersListPage";
import OperatorUserNewPage from "./pages/OperatorUserNewPage";
import OperatorUserDetailPage from "./pages/OperatorUserDetailPage";
import PermissionsCatalogPage from "./pages/PermissionsCatalogPage";
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
            element: (
              <PermissionRoute
                anyOf={[
                  OPERATOR_PERMISSIONS.DEPLOYMENT_READ_ALL,
                  OPERATOR_PERMISSIONS.DOMAIN_READ_ALL,
                  OPERATOR_PERMISSIONS.FORM_DELIVERY_READ_ALL,
                  OPERATOR_PERMISSIONS.FORM_SUBMISSION_READ_ALL,
                  OPERATOR_PERMISSIONS.OPERATIONAL_ALERT_READ_ALL,
                  OPERATOR_PERMISSIONS.SEO_READ_ALL,
                  OPERATOR_PERMISSIONS.TRANSLATION_JOB_READ_ALL,
                  OPERATOR_PERMISSIONS.NOTIFICATION_READ_ALL,
                ]}
              />
            ),
            children: [
              {
                path: "/operations",
                element: (
                  <ErrorBoundary>
                    <OperationsLandingPage />
                  </ErrorBoundary>
                ),
              },
            ],
          },
          {
            element: (
              <PermissionRoute
                anyOf={[OPERATOR_PERMISSIONS.DEPLOYMENT_READ_ALL]}
              />
            ),
            children: [
              {
                path: "/operations/deployments",
                element: (
                  <ErrorBoundary>
                    <OperationsDeploymentsPage />
                  </ErrorBoundary>
                ),
              },
            ],
          },
          {
            element: (
              <PermissionRoute anyOf={[OPERATOR_PERMISSIONS.DOMAIN_READ_ALL]} />
            ),
            children: [
              {
                path: "/operations/domains",
                element: (
                  <ErrorBoundary>
                    <OperationsDomainsPage />
                  </ErrorBoundary>
                ),
              },
            ],
          },
          {
            element: (
              <PermissionRoute
                anyOf={[
                  OPERATOR_PERMISSIONS.FORM_DELIVERY_READ_ALL,
                  OPERATOR_PERMISSIONS.FORM_SUBMISSION_READ_ALL,
                ]}
              />
            ),
            children: [
              {
                path: "/operations/forms",
                element: (
                  <ErrorBoundary>
                    <OperationsFormsPage />
                  </ErrorBoundary>
                ),
              },
            ],
          },
          {
            element: (
              <PermissionRoute
                anyOf={[OPERATOR_PERMISSIONS.OPERATIONAL_ALERT_READ_ALL]}
              />
            ),
            children: [
              {
                path: "/operations/alerts",
                element: (
                  <ErrorBoundary>
                    <OperationsAlertsPage />
                  </ErrorBoundary>
                ),
              },
            ],
          },
          {
            element: (
              <PermissionRoute anyOf={[OPERATOR_PERMISSIONS.SEO_READ_ALL]} />
            ),
            children: [
              {
                path: "/operations/seo",
                element: (
                  <ErrorBoundary>
                    <OperationsSeoPage />
                  </ErrorBoundary>
                ),
              },
            ],
          },
          {
            element: (
              <PermissionRoute
                anyOf={[
                  OPERATOR_PERMISSIONS.TRANSLATION_JOB_READ_ALL,
                  OPERATOR_PERMISSIONS.TRANSLATION_GLOSSARY_READ_ALL,
                ]}
              />
            ),
            children: [
              {
                path: "/operations/translations",
                element: (
                  <ErrorBoundary>
                    <OperationsTranslationsPage />
                  </ErrorBoundary>
                ),
              },
            ],
          },
          {
            element: (
              <PermissionRoute
                anyOf={[OPERATOR_PERMISSIONS.NOTIFICATION_READ_ALL]}
              />
            ),
            children: [
              {
                path: "/operations/notifications",
                element: (
                  <ErrorBoundary>
                    <OperationsNotificationsPage />
                  </ErrorBoundary>
                ),
              },
            ],
          },
          {
            element: (
              <PermissionRoute
                anyOf={[
                  OPERATOR_PERMISSIONS.ANALYTICS_READ_ALL,
                  OPERATOR_PERMISSIONS.ANALYTICS_READ_BUSINESS,
                  OPERATOR_PERMISSIONS.ANALYTICS_READ_SUPPORT,
                  OPERATOR_PERMISSIONS.ANALYTICS_READ_OPERATIONS,
                  OPERATOR_PERMISSIONS.OBSERVABILITY_READ_ALL,
                ]}
              />
            ),
            children: [
              {
                path: "/analytics",
                element: (
                  <ErrorBoundary>
                    <AnalyticsLandingPage />
                  </ErrorBoundary>
                ),
              },
            ],
          },
          {
            element: (
              <PermissionRoute
                anyOf={[
                  OPERATOR_PERMISSIONS.ANALYTICS_READ_ALL,
                  OPERATOR_PERMISSIONS.ANALYTICS_READ_BUSINESS,
                ]}
              />
            ),
            children: [
              {
                path: "/analytics/business",
                element: (
                  <ErrorBoundary>
                    <AnalyticsBusinessPage />
                  </ErrorBoundary>
                ),
              },
            ],
          },
          {
            element: (
              <PermissionRoute
                anyOf={[
                  OPERATOR_PERMISSIONS.ANALYTICS_READ_ALL,
                  OPERATOR_PERMISSIONS.ANALYTICS_READ_SUPPORT,
                ]}
              />
            ),
            children: [
              {
                path: "/analytics/support",
                element: (
                  <ErrorBoundary>
                    <AnalyticsSupportPage />
                  </ErrorBoundary>
                ),
              },
            ],
          },
          {
            element: (
              <PermissionRoute
                anyOf={[
                  OPERATOR_PERMISSIONS.ANALYTICS_READ_ALL,
                  OPERATOR_PERMISSIONS.ANALYTICS_READ_OPERATIONS,
                ]}
              />
            ),
            children: [
              {
                path: "/analytics/operations",
                element: (
                  <ErrorBoundary>
                    <AnalyticsOperationsPage />
                  </ErrorBoundary>
                ),
              },
            ],
          },
          {
            element: (
              <PermissionRoute
                anyOf={[OPERATOR_PERMISSIONS.ANALYTICS_READ_ALL]}
              />
            ),
            children: [
              {
                path: "/analytics/tenant-health",
                element: (
                  <ErrorBoundary>
                    <TenantHealthPage />
                  </ErrorBoundary>
                ),
              },
            ],
          },
          {
            element: (
              <PermissionRoute
                anyOf={[OPERATOR_PERMISSIONS.OBSERVABILITY_READ_ALL]}
              />
            ),
            children: [
              {
                path: "/observability",
                element: (
                  <ErrorBoundary>
                    <ObservabilityPage />
                  </ErrorBoundary>
                ),
              },
            ],
          },
          {
            element: (
              <PermissionRoute
                anyOf={[
                  OPERATOR_PERMISSIONS.OPERATOR_USER_READ_ALL,
                  OPERATOR_PERMISSIONS.OPERATOR_USER_MANAGE_ALL,
                ]}
              />
            ),
            children: [
              {
                path: "/operator-users",
                element: (
                  <ErrorBoundary>
                    <OperatorUsersListPage />
                  </ErrorBoundary>
                ),
              },
              {
                path: "/operator-users/:operatorUserId",
                element: (
                  <ErrorBoundary>
                    <OperatorUserDetailPage />
                  </ErrorBoundary>
                ),
              },
            ],
          },
          {
            element: (
              <PermissionRoute
                anyOf={[OPERATOR_PERMISSIONS.OPERATOR_USER_MANAGE_ALL]}
              />
            ),
            children: [
              {
                path: "/operator-users/new",
                element: (
                  <ErrorBoundary>
                    <OperatorUserNewPage />
                  </ErrorBoundary>
                ),
              },
            ],
          },
          {
            element: (
              <PermissionRoute
                anyOf={[OPERATOR_PERMISSIONS.PERMISSION_MANAGE_ALL]}
              />
            ),
            children: [
              {
                path: "/permissions",
                element: (
                  <ErrorBoundary>
                    <PermissionsCatalogPage />
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
