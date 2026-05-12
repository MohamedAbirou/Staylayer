"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState, type PropsWithChildren } from "react";
import { usePathname } from "next/navigation";
import { OrbitLink } from "@/components/orbit-button";
import {
  buildDashboardAuthHandoffUrl,
  refreshCustomerWorkspaceSession,
  resolveDashboardPath,
  type MarketingContent,
} from "@/lib/public-api";

type AuthAction = {
  href: string;
  label: string;
  tone: "ghost" | "primary";
};

export function MarketingShell({
  content,
  children,
}: PropsWithChildren<{ content: MarketingContent }>) {
  const pathname = usePathname();
  const [dashboardHref, setDashboardHref] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    let active = true;

    void refreshCustomerWorkspaceSession()
      .then((session) => {
        if (!active) {
          return;
        }

        setDashboardHref(
          session
            ? buildDashboardAuthHandoffUrl(
                session,
                resolveDashboardPath(session),
              )
            : null,
        );
      })
      .finally(() => {
        if (active) {
          setAuthReady(true);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const authActions: AuthAction[] = [
    authReady
      ? {
          href: dashboardHref ?? "/login",
          label: dashboardHref ? "Go to Dashboard" : "Sign in",
          tone: "ghost",
        }
      : null,
    { href: "/register", label: "Start free", tone: "primary" },
  ].filter((item): item is AuthAction => Boolean(item));
  const visibleAuthActions = authActions.filter(
    (item) => item.href !== pathname,
  );

  return (
    <div className="orbit-shell min-h-screen">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 pb-16 pt-5 sm:px-6 lg:px-8">
        {/* ── NAV ── */}
        <header
          className="sticky top-4 z-30 mb-12 rounded-2xl px-4 py-3 sm:px-5"
          style={{
            background: "rgba(255,255,255,0.82)",
            border: "1px solid rgba(26,72,112,0.08)",
            boxShadow:
              "0 8px 32px rgba(13,40,64,0.1), 0 1px 0 rgba(224,112,56,0.12) inset",
            backdropFilter: "blur(24px)",
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-2.5 shrink-0">
              <div className="relative h-9 w-9 overflow-hidden rounded-xl">
                <Image
                  src="/logo-icon.png"
                  alt="StayLayer"
                  fill
                  className="object-contain"
                  sizes="36px"
                  priority
                />
              </div>
              <span className="orbit-heading text-lg tracking-tight">
                <span className="sl-stay">Stay</span>
                <span className="sl-layer">Layer</span>
              </span>
            </Link>

            <nav className="flex flex-wrap items-center justify-center gap-1 text-sm">
              {content.navigation.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded-xl px-3.5 py-2 transition-all duration-200 font-medium ${
                      isActive
                        ? "bg-[rgba(224,112,56,0.1)] text-[var(--sl-orange)]"
                        : "text-[rgba(26,72,112,0.75)] hover:bg-[rgba(26,72,112,0.06)] hover:text-[var(--sl-navy)]"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="flex items-center gap-2.5">
              {visibleAuthActions.map((item) => (
                <OrbitLink key={item.href} href={item.href} tone={item.tone}>
                  {item.label}
                </OrbitLink>
              ))}
            </div>
          </div>
        </header>

        <main className="flex-1">{children}</main>

        {/* ── FOOTER ── */}
        <footer
          className="mt-24 overflow-hidden rounded-3xl"
          style={{
            background:
              "linear-gradient(148deg, #081828 0%, #0D2840 55%, #1A4870 100%)",
            boxShadow: "0 -4px 0 rgba(224,112,56,0.15)",
          }}
        >
          {/* Orange accent bar */}
          <div
            className="h-1 w-full"
            style={{
              background:
                "linear-gradient(90deg, var(--sl-orange) 0%, var(--sl-gold) 40%, var(--sl-teal) 100%)",
            }}
          />

          <div className="px-8 py-10 sm:px-10">
            <div className="grid gap-10 lg:grid-cols-[1.3fr_1fr_1fr]">
              {/* Brand column */}
              <div className="space-y-4">
                <div className="flex items-center gap-2.5">
                  <div className="relative h-10 w-10 overflow-hidden rounded-xl">
                    <Image
                      src="/logo-icon.png"
                      alt="StayLayer"
                      fill
                      className="object-contain"
                      sizes="40px"
                    />
                  </div>
                  <span className="orbit-heading text-xl tracking-tight">
                    <span className="text-[var(--sl-orange)]">Stay</span>
                    <span className="text-white">Layer</span>
                  </span>
                </div>
                <p className="text-sm leading-7 text-[rgba(249,246,239,0.62)] max-w-xs">
                  {content.brand.tagline}
                </p>
                <p className="text-xs leading-6 text-[rgba(249,246,239,0.42)] max-w-xs">
                  Inquiry-first hospitality publishing. Your website, your
                  brand, your bookings.
                </p>
              </div>

              {/* Product links */}
              <div>
                <p className="orbit-kicker mb-4 text-xs text-[rgba(249,246,239,0.45)]">
                  Product
                </p>
                <div className="flex flex-col gap-2.5 text-sm text-[rgba(249,246,239,0.72)]">
                  {content.footer.productLinks.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="transition-colors hover:text-[var(--sl-orange)]"
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>

              {/* Legal links */}
              <div>
                <p className="orbit-kicker mb-4 text-xs text-[rgba(249,246,239,0.45)]">
                  Legal
                </p>
                <div className="flex flex-col gap-2.5 text-sm text-[rgba(249,246,239,0.72)]">
                  {content.footer.legalLinks.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="transition-colors hover:text-[var(--sl-teal-bright)]"
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-white/8 pt-6">
              <p className="text-xs text-[rgba(249,246,239,0.38)]">
                © {new Date().getFullYear()} StayLayer. Inquiry-first
                hospitality platform.
              </p>
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--sl-teal-bright)] opacity-80" />
                <p className="text-xs text-[rgba(249,246,239,0.38)]">
                  All systems operational
                </p>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
