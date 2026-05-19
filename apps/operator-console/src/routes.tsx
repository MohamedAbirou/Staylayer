import { lazy, type ComponentType } from "react";
import { createBrowserRouter } from "react-router-dom";
import { OperatorLayout } from "./components/OperatorLayout";
import { ProtectedOperatorRoute } from "./auth/ProtectedOperatorRoute";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { PermissionRoute, OPERATOR_PERMISSIONS } from "./permissions";
import LoginPage from "./pages/LoginPage";
import ForbiddenPage from "./pages/ForbiddenPage";
import NotFoundPage from "./pages/NotFoundPage";

/**
 * Route-level code splitting.
 *
 * Each authenticated page is loaded on demand via `React.lazy`, so the
 * initial bundle for the operator console only ships the shell + auth
 * machinery. This both:
 *   - reduces time-to-interactive on the first paint (especially over
 *     slow links — the operator console is used worldwide), and
 *   - narrows the blast radius of any single page bug (a syntax error
 *     in a rarely-visited page no longer breaks login).
 *
 * The shared `Suspense` fallback lives in `OperatorLayout` so navigating
 * between tabs flashes a single spinner instead of unmounting the chrome.
 *
 * Login / Forbidden / NotFound are intentionally eager-loaded — they
 * are tiny and must render even when the network is partitioned.
 */
function lazyPage<T extends ComponentType<unknown>>(
  loader: () => Promise<{ default: T }>,
) {
  return lazy(loader);
}

const CommandCenterPage = lazyPage(() => import("./pages/CommandCenterPage"));
const TenantsListPage = lazyPage(() => import("./pages/TenantsListPage"));
const TenantDetailPage = lazyPage(() => import("./pages/TenantDetailPage"));
const SiteDetailPage = lazyPage(() => import("./pages/SiteDetailPage"));
const AuditLogPage = lazyPage(() => import("./pages/AuditLogPage"));
const GlobalSearchPage = lazyPage(() => import("./pages/GlobalSearchPage"));
const SupportInboxPage = lazyPage(() => import("./pages/SupportInboxPage"));
const SupportCaseDetailPage = lazyPage(
  () => import("./pages/SupportCaseDetailPage"),
);
const SupportCaseNewPage = lazyPage(() => import("./pages/SupportCaseNewPage"));
const BillingOverviewPage = lazyPage(
  () => import("./pages/BillingOverviewPage"),
);
const BillingAccountsListPage = lazyPage(
  () => import("./pages/BillingAccountsListPage"),
);
const BillingAccountDetailPage = lazyPage(
  () => import("./pages/BillingAccountDetailPage"),
);
const BillingActionRequestsPage = lazyPage(
  () => import("./pages/BillingActionRequestsPage"),
);
const BillingWebhooksPage = lazyPage(
  () => import("./pages/BillingWebhooksPage"),
);
const OperationsLandingPage = lazyPage(
  () => import("./pages/OperationsLandingPage"),
);
const OperationsDeploymentsPage = lazyPage(
  () => import("./pages/OperationsDeploymentsPage"),
);
const OperationsDomainsPage = lazyPage(
  () => import("./pages/OperationsDomainsPage"),
);
const OperationsFormsPage = lazyPage(
  () => import("./pages/OperationsFormsPage"),
);
const OperationsAlertsPage = lazyPage(
  () => import("./pages/OperationsAlertsPage"),
);
const OperationsSeoPage = lazyPage(() => import("./pages/OperationsSeoPage"));
const OperationsTranslationsPage = lazyPage(
  () => import("./pages/OperationsTranslationsPage"),
);
const OperationsNotificationsPage = lazyPage(
  () => import("./pages/OperationsNotificationsPage"),
);
const AnalyticsLandingPage = lazyPage(
  () => import("./pages/AnalyticsLandingPage"),
);
const AnalyticsBusinessPage = lazyPage(
  () => import("./pages/AnalyticsBusinessPage"),
);
const AnalyticsSupportPage = lazyPage(
  () => import("./pages/AnalyticsSupportPage"),
);
const AnalyticsOperationsPage = lazyPage(
  () => import("./pages/AnalyticsOperationsPage"),
);
const TenantHealthPage = lazyPage(() => import("./pages/TenantHealthPage"));
const ObservabilityPage = lazyPage(() => import("./pages/ObservabilityPage"));
const OperatorUsersListPage = lazyPage(
  () => import("./pages/OperatorUsersListPage"),
);
const OperatorUserNewPage = lazyPage(
  () => import("./pages/OperatorUserNewPage"),
);
const OperatorUserDetailPage = lazyPage(
  () => import("./pages/OperatorUserDetailPage"),
);
const OperatorMfaEnrollPage = lazyPage(
  () => import("./pages/OperatorMfaEnrollPage"),
);
const PermissionsCatalogPage = lazyPage(
  () => import("./pages/PermissionsCatalogPage"),
);

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
          {
            path: "/account/mfa",
            element: (
              <ErrorBoundary>
                <OperatorMfaEnrollPage />
              </ErrorBoundary>
            ),
          },
        ],
      },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
]);
