import { createBrowserRouter } from "react-router-dom";
import { OperatorLayout } from "./components/OperatorLayout";
import { ProtectedOperatorRoute } from "./auth/ProtectedOperatorRoute";
import { ErrorBoundary } from "./components/ErrorBoundary";
import LoginPage from "./pages/LoginPage";
import CommandCenterPage from "./pages/CommandCenterPage";
import ForbiddenPage from "./pages/ForbiddenPage";
import NotFoundPage from "./pages/NotFoundPage";

// Phase 1 routing surface. Real resource routes (tenants, support, billing,
// operations, audit, permissions) are added in later phases. This router only
// owns operator UI; it must never include customer dashboard routes.
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
            path: "/",
            element: (
              <ErrorBoundary>
                <CommandCenterPage />
              </ErrorBoundary>
            ),
          },
        ],
      },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
]);
