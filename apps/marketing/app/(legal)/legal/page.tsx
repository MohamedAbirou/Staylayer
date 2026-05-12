import type { Metadata } from "next";
import Link from "next/link";
import { Reveal } from "@/components/reveal";
import { getLegalDocuments } from "@/lib/public-api";

export const metadata: Metadata = {
  title: "Legal Hub — StayLayer",
  description:
    "Versioned terms, privacy policy, cookie policy, GDPR rights, security handling, subprocessors, and data retention documents for StayLayer customers.",
};

export default async function LegalIndexPage() {
  const documents = await getLegalDocuments();

  return (
    <div className="space-y-10">
      <Reveal>
        <p className="orbit-kicker text-xs text-[rgba(16,42,54,0.55)]">
          Legal hub
        </p>
        <h1 className="orbit-heading mt-4 text-5xl text-[var(--orbit-midnight)] sm:text-6xl">
          Clear legal documents for every customer-facing policy.
        </h1>
      </Reveal>

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {documents.map((document, index) => (
          <Reveal
            key={document.slug}
            delay={index * 0.06}
            className="orbit-card rounded-[2rem] p-6"
          >
            <p className="orbit-kicker text-xs text-[rgba(16,42,54,0.48)]">
              {document.version}
            </p>
            <Link href={`/legal/${document.slug}`}>
              <h2 className="orbit-heading mt-3 text-3xl text-[var(--orbit-midnight)]">
                {document.title}
              </h2>
            </Link>
            <p className="mt-4 text-sm leading-6 text-[rgba(16,42,54,0.74)]">
              {document.summary}
            </p>
            <p className="mt-4 text-xs uppercase tracking-[0.16em] text-[rgba(16,42,54,0.5)]">
              Effective {document.effectiveAt.slice(0, 10)}
            </p>
          </Reveal>
        ))}
      </section>
    </div>
  );
}
