"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [lang, setLang] = useState<"en" | "bn">("en");

  useEffect(() => {
    // Log non-sensitive error signal to console for debugging
    console.error("[Nirapotta Error Boundary]", error);
    if (typeof window !== "undefined") {
      const saved = (localStorage.getItem("app_lang") as "en" | "bn") || "en";
      setLang(saved);
      const handleLangChange = () => {
        const next = (localStorage.getItem("app_lang") as "en" | "bn") || "en";
        setLang(next);
      };
      window.addEventListener("languagechange", handleLangChange);
      return () => window.removeEventListener("languagechange", handleLangChange);
    }
  }, [error]);

  return (
    <div className="min-h-[75vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full text-center space-y-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 shadow-sm">
        {/* Brand Emblem */}
        <div className="mx-auto h-20 w-20 relative rounded-2xl overflow-hidden shadow-md border-2 border-emerald-500/30 bg-white p-1">
          <Image
            src="/brand/logo-sm.jpg"
            alt="NIRAPOTTA Emblem"
            fill
            className="object-contain p-1"
            priority
          />
        </div>

        {/* Error Badge & Title */}
        <div className="space-y-2">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
            {lang === "bn" ? "সাময়িক সমস্যা" : "Temporary Issue"}
          </span>
          <h1 className="text-2xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">
            {lang === "bn" ? "কিছু একটা ভুল হয়েছে" : "Something Went Wrong"}
          </h1>
          <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
            {lang === "bn"
              ? "একটি অপ্রত্যাশিত ত্রুটি ঘটেছে। দয়া করে পুনরায় চেষ্টা করুন অথবা হোম পেজে ফিরে যান।"
              : "An unexpected issue occurred while processing this request. Please try again or return to safety services."}
          </p>
        </div>

        {/* Navigation / Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2">
          <button
            type="button"
            onClick={() => reset()}
            className="w-full sm:w-auto flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 active:bg-emerald-800 text-white px-5 py-3 text-xs sm:text-sm font-bold shadow-xs transition min-h-[44px] cursor-pointer"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            <span>{lang === "bn" ? "পুনরায় চেষ্টা করুন" : "Try Again"}</span>
          </button>

          <Link
            href="/"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-750 text-zinc-800 dark:text-zinc-200 px-4 py-3 text-xs sm:text-sm font-semibold transition min-h-[44px]"
          >
            <span>{lang === "bn" ? "হোমে যান" : "Return Home"}</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
