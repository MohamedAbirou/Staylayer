import { clsx } from "clsx";

interface AtmosphereDetail {
  label: string;
  value: string;
}

interface OrbitAtmosphereProps {
  eyebrow: string;
  title: string;
  summary: string;
  badges: string[];
  details: AtmosphereDetail[];
  className?: string;
  tone?: "light" | "dark";
}

export function OrbitAtmosphere({
  eyebrow,
  title,
  summary,
  badges,
  details,
  className,
  tone = "light",
}: OrbitAtmosphereProps) {
  const isDark = tone === "dark";

  return (
    <div
      className={clsx(
        "relative overflow-hidden rounded-3xl p-6 sm:p-8",
        isDark ? "text-white" : "text-[var(--sl-navy)]",
        className,
      )}
      style={
        isDark
          ? {
              background:
                "linear-gradient(158deg, rgba(7,18,32,0.97) 0%, rgba(13,40,64,0.94) 55%, rgba(26,72,112,0.88) 100%)",
              border: "1px solid rgba(224,112,56,0.18)",
              boxShadow:
                "0 0 0 1px rgba(58,152,152,0.12) inset, 0 32px 80px rgba(7,18,32,0.4)",
            }
          : {
              background:
                "linear-gradient(158deg, rgba(255,255,255,0.95) 0%, rgba(250,247,243,0.9) 55%, rgba(243,237,227,0.85) 100%)",
              border: "1px solid rgba(26,72,112,0.08)",
              boxShadow: "0 32px 80px rgba(13,40,64,0.1)",
            }
      }
    >
      {/* Glow orbs */}
      <div
        className="pointer-events-none absolute top-[-15%] right-[-10%] h-48 w-48 rounded-full blur-3xl"
        style={{
          background: isDark ? "rgba(224,112,56,0.2)" : "rgba(224,112,56,0.14)",
        }}
      />
      <div
        className="pointer-events-none absolute bottom-[-12%] left-[-8%] h-40 w-40 rounded-full blur-3xl"
        style={{
          background: isDark
            ? "rgba(58,152,152,0.22)"
            : "rgba(58,152,152,0.16)",
        }}
      />
      <div
        className="pointer-events-none absolute top-[30%] left-[45%] h-32 w-32 rounded-full blur-3xl"
        style={{
          background: isDark ? "rgba(240,176,48,0.12)" : "rgba(240,176,48,0.1)",
        }}
      />

      <div className="relative">
        {/* Visual showcase panel — layered platform graphic */}
        <div
          className="relative mb-8 overflow-hidden rounded-2xl"
          style={{
            height: "220px",
            background: isDark
              ? "linear-gradient(170deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)"
              : "linear-gradient(170deg, rgba(26,72,112,0.06) 0%, rgba(26,72,112,0.02) 100%)",
            border: isDark
              ? "1px solid rgba(255,255,255,0.1)"
              : "1px solid rgba(26,72,112,0.07)",
          }}
        >
          {/* Badges row */}
          <div className="absolute inset-x-5 top-5 flex flex-wrap gap-2">
            {badges.slice(0, 4).map((badge) => (
              <span
                key={badge}
                className={clsx(
                  "rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] backdrop-blur",
                  isDark
                    ? "bg-white/10 border border-white/15 text-[rgba(249,246,239,0.84)]"
                    : "bg-white/80 border border-[rgba(26,72,112,0.1)] text-[rgba(26,72,112,0.65)]",
                )}
              >
                {badge}
              </span>
            ))}
          </div>

          {/* Stacked layer bars — visual metaphor for the platform */}
          <div className="absolute bottom-7 inset-x-8 flex flex-col gap-2 items-center">
            {/* Layer 3 — Marketing (orange) */}
            <div
              className="w-full h-7 rounded-xl flex items-center px-4 gap-2"
              style={{
                background:
                  "linear-gradient(90deg, rgba(224,112,56,0.85) 0%, rgba(240,176,48,0.75) 100%)",
                boxShadow: "0 4px 12px rgba(224,112,56,0.3)",
              }}
            >
              <span className="text-[10px] font-semibold uppercase tracking-widest text-white/90">
                Marketing
              </span>
              <div className="ml-auto flex gap-1">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-1.5 rounded-full bg-white/50"
                    style={{ width: `${10 + i * 6}px` }}
                  />
                ))}
              </div>
            </div>
            {/* Layer 2 — Dashboard (teal) */}
            <div
              className="w-[88%] h-7 rounded-xl flex items-center px-4 gap-2"
              style={{
                background:
                  "linear-gradient(90deg, rgba(58,152,152,0.82) 0%, rgba(86,196,194,0.72) 100%)",
                boxShadow: "0 4px 12px rgba(58,152,152,0.25)",
              }}
            >
              <span className="text-[10px] font-semibold uppercase tracking-widest text-white/90">
                Dashboard
              </span>
              <div className="ml-auto flex gap-1">
                {[1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-1.5 rounded-full bg-white/50"
                    style={{ width: `${12 + i * 5}px` }}
                  />
                ))}
              </div>
            </div>
            {/* Layer 1 — Website runtime (navy) */}
            <div
              className="w-[76%] h-7 rounded-xl flex items-center px-4 gap-2"
              style={{
                background:
                  "linear-gradient(90deg, rgba(26,72,112,0.88) 0%, rgba(13,40,64,0.78) 100%)",
                boxShadow: "0 4px 12px rgba(26,72,112,0.22)",
              }}
            >
              <span className="text-[10px] font-semibold uppercase tracking-widest text-white/90">
                Sites
              </span>
              <div className="ml-auto flex gap-1">
                {[1].map((i) => (
                  <div
                    key={i}
                    className="h-1.5 rounded-full bg-white/40"
                    style={{ width: `${18}px` }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <p
            className={clsx(
              "orbit-kicker text-xs",
              isDark
                ? "text-[rgba(249,246,239,0.55)]"
                : "text-[var(--sl-orange)]",
            )}
          >
            {eyebrow}
          </p>
          <h3 className="orbit-heading text-2xl leading-snug sm:text-3xl">
            {title}
          </h3>
          <p
            className={clsx(
              "text-sm leading-6",
              isDark
                ? "text-[rgba(249,246,239,0.75)]"
                : "text-[rgba(26,72,112,0.7)]",
            )}
          >
            {summary}
          </p>
        </div>

        <div className="mt-6 grid gap-2.5 sm:grid-cols-2">
          {details.map((detail) => (
            <div
              key={`${detail.label}-${detail.value}`}
              className="rounded-xl p-4"
              style={
                isDark
                  ? {
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.1)",
                    }
                  : {
                      background: "rgba(255,255,255,0.72)",
                      border: "1px solid rgba(26,72,112,0.08)",
                    }
              }
            >
              <p
                className={clsx(
                  "text-[10px] font-semibold uppercase tracking-[0.16em]",
                  isDark
                    ? "text-[rgba(249,246,239,0.5)]"
                    : "text-[var(--sl-orange)]",
                )}
              >
                {detail.label}
              </p>
              <p
                className={clsx(
                  "mt-1.5 text-sm leading-6",
                  isDark
                    ? "text-[rgba(249,246,239,0.85)]"
                    : "text-[var(--sl-navy)]",
                )}
              >
                {detail.value}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
