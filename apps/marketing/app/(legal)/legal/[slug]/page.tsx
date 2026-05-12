import { notFound } from "next/navigation";
import { getLegalDocument, getLegalDocuments } from "@/lib/public-api";

// Pages are statically generated when the API is reachable at build time.
// When the API is not available (CI without a running backend), this returns
// an empty list and Next.js falls back to on-demand rendering per request.
export const dynamicParams = true;

export async function generateStaticParams() {
  try {
    const documents = await getLegalDocuments();
    return documents.map((document) => ({ slug: document.slug }));
  } catch {
    return [];
  }
}

export default async function LegalDocumentPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  try {
    const document = await getLegalDocument(slug);

    return (
      <div className="space-y-8">
        <div>
          <p className="orbit-kicker text-xs text-[rgba(16,42,54,0.55)]">
            Legal document
          </p>
          <h1 className="orbit-heading mt-4 text-5xl text-[var(--orbit-midnight)] sm:text-6xl">
            {document.title}
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-[rgba(16,42,54,0.74)]">
            {document.summary}
          </p>
          <p className="mt-3 text-sm text-[rgba(16,42,54,0.6)]">
            Version {document.version} effective{" "}
            {document.effectiveAt.slice(0, 10)}
          </p>
        </div>

        <div className="space-y-5">
          {document.sections.map((section) => (
            <section
              key={section.title}
              className="orbit-card rounded-[2rem] p-6 sm:p-8"
            >
              <h2 className="orbit-heading text-3xl text-[var(--orbit-midnight)]">
                {section.title}
              </h2>
              <div className="mt-4 space-y-4 text-sm leading-7 text-[rgba(16,42,54,0.74)]">
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    );
  } catch {
    notFound();
  }
}
