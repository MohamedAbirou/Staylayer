import { ActivitySquare } from "lucide-react";

// Phase 1 placeholder for the Command Center described in
// operator-console-docs/01-architecture-and-tech-stack.md. Real widgets,
// metrics, and drilldowns are implemented in Phase 4 and beyond.
export default function CommandCenterPage() {
  return (
    <div className="px-8 py-8">
      <header className="flex items-center gap-3">
        <ActivitySquare className="h-5 w-5 text-cyan-400" />
        <div>
          <h1 className="text-xl font-semibold text-white">Command Center</h1>
          <p className="text-xs text-slate-400">
            Operator overview. Widgets land in Phase 4.
          </p>
        </div>
      </header>

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        {["Tenants", "Open support cases", "Billing risk"].map((label) => (
          <div
            key={label}
            className="rounded-2xl border border-slate-800 bg-slate-900 p-5"
          >
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              {label}
            </p>
            <p className="mt-3 text-2xl font-semibold text-white">—</p>
            <p className="mt-1 text-xs text-slate-500">No data yet</p>
          </div>
        ))}
      </section>
    </div>
  );
}
