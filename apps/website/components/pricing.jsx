import { BRAND_NAME, DOMAIN_NAME } from "@/lib/brand";

export default function PricingSectionOnePlan() {
  const features = [
    "All features included",
    "No commission",
    "Chat support",
    "Quick setup",
  ];

  return (
    <section className="breakout-section relative isolate overflow-hidden bg-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-30"
      >
        <div className="absolute -top-24 left-1/2 h-[40rem] w-[40rem] -translate-x-1/2 rounded-full bg-cyan-400 blur-[120px]" />
        <div className="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-fuchsia-400 blur-[120px]" />
      </div>

      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50/70 px-3 py-1 text-sm text-slate-600 backdrop-blur">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
            All access plan
          </div>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            One simple plan
          </h2>
          <p className="mt-3 text-base leading-7 text-slate-600 sm:text-lg">
            Clear and predictable pricing. No tiers to compare. No hidden fees.
            You get the full suite from day one.
          </p>
        </div>

        <div className="mx-auto mt-10 max-w-3xl">
          <div className="relative rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl ring-1 ring-slate-100 sm:p-10">
            <div className="grid items-center gap-8 sm:grid-cols-5">
              <div className="sm:col-span-2">
                <div className="flex items-end gap-2 text-slate-900">
                  <span className="text-5xl font-semibold tracking-tight raw">
                    {process.env.NEXT_PUBLIC_PRICE}
                  </span>
                  <span className="text-slate-500 raw">per month</span>
                </div>
                <p className="mt-3 text-slate-600">
                  Full feature access for a flat monthly rate. Cancel any time.
                </p>
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <a
                    href={`https://admin.${DOMAIN_NAME}/join`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-5 py-3 text-white font-semibold shadow hover:bg-slate-800 transition"
                  >
                    Subscribe now
                  </a>
                </div>
              </div>

              <div className="sm:col-span-3">
                <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {features.map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-800"
                    >
                      <span className="text-emerald-500 raw">&#10003;</span>
                      <span className="text-sm leading-6 raw">{item}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-sm text-slate-500">
                  Everything from automation to analytics is included with your
                  subscription.
                </p>
              </div>
            </div>

            <div className="absolute -right-2 -top-2 rounded-full bg-emerald-400 px-3 py-1 text-xs font-semibold text-white shadow">
              Best value
            </div>
          </div>

          <div className="mx-auto mt-10 max-w-3xl text-slate-700">
            <details className="group rounded-2xl border border-slate-200 bg-slate-50 p-5 open:bg-slate-50">
              <summary className="cursor-pointer select-none text-base font-semibold text-slate-900 group-open:mb-3">
                What is included
              </summary>
              <p className="text-sm leading-7 text-slate-600">
                The plan covers property management, channel syncing, automated
                messaging, invoicing, housekeeping, and reporting. You can add
                and manage as many properties as you need. Support is available
                through email and chat.
              </p>
            </details>
          </div>
        </div>
      </div>
    </section>
  );
}
