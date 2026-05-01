import Link from "next/link";
import React from "react";
import SEOHead from "@/components/seoHead";

export default function Custom404() {
  const pageSeo = {
    pageTitle: "404 - Page Not Found",
    pageDescription: "The page you are looking for does not exist.",
    pageKeywords: "404, not found, error",
  };
  return (
    <>
      <SEOHead {...pageSeo} />

      <div className="min-h-screen breakout-section flex flex-col justify-center items-center bg-slate-50 px-4">
        <div className="text-center">
          <h1 className="text-7xl font-extrabold text-slate-800 mb-4">404</h1>
          <h2 className="text-2xl font-semibold text-slate-700 mb-2">
            Page Not Found
          </h2>
          <p className="text-slate-500 mb-8">
            Sorry, the page you are looking for does not exist or has been moved.
          </p>
          <Link
            href="/"
            className="inline-block px-6 py-2 bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-700 transition"
          >
            Go Home
          </Link>
        </div>
      </div>
    </>
  );
}
