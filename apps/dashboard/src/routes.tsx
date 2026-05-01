import { createBrowserRouter } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { ErrorBoundary } from "./components/ErrorBoundary";
import LoginPage from "./pages/LoginPage";
import PagesListPage from "./pages/PagesListPage";
import NewPagePage from "./pages/NewPagePage";
import EditorPage from "./pages/EditorPage";
import PreviewPage from "./pages/PreviewPage";
import SettingsPage from "./pages/SettingsPage";
import DashboardHome from "./pages/DashboardHome";

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
              <ErrorBoundary>
                <DashboardHome />
              </ErrorBoundary>
            ),
          },
          {
            path: "/pages",
            element: (
              <ErrorBoundary>
                <PagesListPage />
              </ErrorBoundary>
            ),
          },
          {
            path: "/pages/new",
            element: <NewPagePage />,
          },
          {
            path: "/settings",
            element: (
              <ProtectedRoute roles={["SUPER_ADMIN"]}>
                <SettingsPage />
              </ProtectedRoute>
            ),
          },
        ],
      },
      {
        path: "/editor/:slug",
        element: (
          <ErrorBoundary>
            <EditorPage />
          </ErrorBoundary>
        ),
      },
      {
        path: "/preview/:slug",
        element: <PreviewPage />,
      },
    ],
  },
]);
