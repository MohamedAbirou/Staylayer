import Link from "next/link";
import Script from "next/script";
import React from "react";
import { Logo } from "../icons";
import { BRAND_NAME, DOMAIN_NAME } from "@/lib/brand";

export default function Footer() {
  return (
    <>
      <footer className="bg-slate-50 border-t border-slate-200 container-breakout">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10 py-16">
            <div className="col-span-1 md:col-span-2 text-center md:text-left">
              <Link href="/" className="text-2xl font-bold">
                <Logo className="mx-auto md:mx-0 h-10 w-auto" />
              </Link>
              <p className="mt-4 text-sm text-slate-600 max-w-md mx-auto md:mx-0">
                {BRAND_NAME} helps you build faster, scale better, and deliver modern web experiences with ease.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Company</h3>
              <ul className="mt-4 space-y-3 text-sm">
                <li><Link href="/about" className="hover:text-slate-900 text-slate-600">About</Link></li>
                <li><Link href="/contact-us" className="hover:text-slate-900 text-slate-600">Contact</Link></li>
                <li><Link href="/pricing" className="hover:text-slate-900 text-slate-600">Pricing</Link></li>
                <li><Link href="/careers" className="hover:text-slate-900 text-slate-600">Careers</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Resources</h3>
              <ul className="mt-4 space-y-3 text-sm">
                <li><Link href={`https://docs.${DOMAIN_NAME}/`} target="_blank" className="hover:text-slate-900 text-slate-600">Documentation</Link></li>
                {/* <li><Link href="/blog" className="hover:text-slate-900 text-slate-600">Blog</Link></li>
                <li><Link href="/support" className="hover:text-slate-900 text-slate-600">Support</Link></li>
                <li><Link href="/faq" className="hover:text-slate-900 text-slate-600">FAQ</Link></li> */}
              </ul>
            </div>
          </div>

          {/* Copyright */}
          <div className="flex flex-col sm:flex-row justify-between items-center border-t border-slate-200 py-6">
            <p className="text-sm text-slate-500">
              © {new Date().getFullYear()} {BRAND_NAME}. All rights reserved.
            </p>
            <div className="flex gap-4 text-sm text-slate-500 mt-4 sm:mt-0">
              <Link href="/privacy-policy" className="hover:text-slate-900">Privacy Policy</Link>
              <Link href="/customer-agreement" className="hover:text-slate-900">Customer Agreement</Link>
            </div>
          </div>
        </div>
      </footer>

      {/* Chatwoot script */}
      <Script
        id="chatwoot-sdk"
        src="https://app.chatwoot.com/packs/js/sdk.js"
        strategy="afterInteractive"
        onLoad={() => {
          if (typeof window !== "undefined" && window.chatwootSDK && !window.__chatwoot_initialized) {
            window.__chatwoot_initialized = true;
            window.chatwootSDK.run({
              websiteToken: "yJLomssm8eMdBe2ZyiZaHSQy",
              baseUrl: "https://app.chatwoot.com",
            });
          }
        }}
      />
    </>
  );
}
