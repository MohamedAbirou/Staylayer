export default function NotFound() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-20 text-white">
      <div className="mx-auto flex max-w-3xl flex-col gap-6 rounded-[2rem] border border-white/10 bg-white/5 p-10 shadow-2xl shadow-slate-950/40 backdrop-blur">
        <span className="text-sm font-semibold uppercase tracking-[0.28em] text-sky-300">
          StayLayer Website Runtime
        </span>
        <h1 className="text-4xl font-semibold tracking-tight text-white">
          This site is not available on the requested host.
        </h1>
        <p className="max-w-2xl text-base leading-7 text-slate-300">
          The hostname did not resolve to an active published site, or the site
          is no longer available. Check the connected domain or return to the
          canonical site address.
        </p>
      </div>
    </main>
  );
}
