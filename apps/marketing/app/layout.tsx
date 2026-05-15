import type { Metadata } from "next";
import { Instrument_Sans, Syne } from "next/font/google";
import { MarketingShell } from "@/components/marketing-shell";
import { getMarketingContent } from "@/lib/public-api";
import "@/app/globals.css";

// All pages in this app depend on the API at request time. Prevent
// build-time pre-rendering so the build succeeds without a running API.
// In production the CDN handles response caching at the edge.
export const dynamic = "force-dynamic";

const displayFont = Syne({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "700", "800"],
});

const bodyFont = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "StayLayer",
  description:
    "Marketing, pricing, legal, and customer auth for StayLayer's inquiry-first hospitality platform.",
  icons: {
    icon: "/logo-icon.png",
    shortcut: "/logo-icon.png",
    apple: "/logo-icon.png",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const content = await getMarketingContent();

  return (
    <html lang="en">
      <body className={`${displayFont.variable} ${bodyFont.variable}`}>
        <MarketingShell content={content}>{children}</MarketingShell>
      </body>
    </html>
  );
}
