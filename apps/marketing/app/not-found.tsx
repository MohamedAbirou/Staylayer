import { OrbitLink } from "@/components/orbit-button";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center">
      <p className="orbit-kicker text-xs text-[rgba(16,42,54,0.55)]">404</p>
      <h1 className="orbit-heading text-5xl text-[var(--orbit-midnight)] sm:text-6xl">
        Page not found
      </h1>
      <p className="max-w-md text-sm leading-6 text-[rgba(16,42,54,0.72)]">
        The page you are looking for does not exist or has been moved. Try the
        home page or browse pricing and solutions.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-4">
        <OrbitLink href="/" tone="primary">
          Go to home
        </OrbitLink>
        <OrbitLink href="/pricing" tone="secondary">
          See pricing
        </OrbitLink>
      </div>
    </div>
  );
}
