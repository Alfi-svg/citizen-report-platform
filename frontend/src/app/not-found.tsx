"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";

export default function NotFound() {
  const [lang, setLang] = useState<"en" | "bn">("en");

  useEffect(() => {
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
  }, []);

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

        {/* 404 & Title */}
        <div className="space-y-2">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900">
            Error 404
          </span>
          <h1 className="text-2xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">
            {lang === "bn" ? "পৃষ্ঠাটি পাওয়া যায়নি" : "Page Not Found"}
          </h1>
          <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
            {lang === "bn"
              ? "দুঃখিত, আপনি যে পৃষ্ঠাটি খুঁজছেন তা সরানো হয়েছে অথবা লিংকটি ভুল হতে পারে।"
              : "The page you are looking for might have been moved, renamed, or is temporarily unavailable."}
          </p>
        </div>

        {/* Navigation Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2">
          <Link
            href="/"
            className="w-full sm:w-auto flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 active:bg-emerald-800 text-white px-5 py-3 text-xs sm:text-sm font-bold shadow-xs transition min-h-[44px]"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
            </svg>
            <span>{lang === "bn" ? "হোম পেজে যান" : "Return to Home"}</span>
          </Link>

          <Link
            href="/reports"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-750 text-zinc-800 dark:text-zinc-200 px-4 py-3 text-xs sm:text-sm font-semibold transition min-h-[44px]"
          >
            <span>{lang === "bn" ? "রিপোর্ট দেখুন" : "View Reports"}</span>
          </Link>
        </div>

        {/* Quick Civic Links */}
        <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-center gap-4 text-xs font-semibold text-zinc-500">
          <Link href="/blood-help" className="hover:text-rose-600 transition">
            {lang === "bn" ? "রক্ত সহায়তা" : "Blood Help"}
          </Link>
          <span>•</span>
          <Link href="/safety-map" className="hover:text-emerald-600 transition">
            {lang === "bn" ? "মানচিত্র" : "Safety Map"}
          </Link>
          <span>•</span>
          <Link href="/guard" className="hover:text-emerald-700 transition">
            {lang === "bn" ? "গার্ড" : "Guard"}
          </Link>
        </div>
      </div>
    </div>
  );
}
