import { Component, type ReactNode } from "react";

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    // Phase 1: log to console. A later phase will forward to observability.
    // eslint-disable-next-line no-console
    console.error("[operator-console] uncaught error", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-16 text-slate-100">
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-8">
            <h1 className="text-lg font-semibold text-white">
              Something went wrong
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              {this.state.error?.message ?? "Unknown error"}
            </p>
            <button
              type="button"
              onClick={() => this.setState({ hasError: false, error: null })}
              className="mt-6 rounded-md bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
