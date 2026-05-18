import { RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import { OperatorAuthProvider } from "./auth/OperatorAuthProvider";
import { PermissionProvider } from "./permissions";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { router } from "./routes";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <OperatorAuthProvider>
        <PermissionProvider>
          <ErrorBoundary>
            <RouterProvider router={router} />
          </ErrorBoundary>
          <Toaster position="top-right" />
        </PermissionProvider>
      </OperatorAuthProvider>
    </QueryClientProvider>
  );
}
