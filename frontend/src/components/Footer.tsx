"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Language } from "@/lib/i18n";
import { useAuth } from "@/context/AuthContext";

export default function Footer() {
  const { isAuthenticated, isAdmin } = useAuth();
  const [lang, setLang] = useState<Language>("en");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = (localStorage.getItem("app_lang") as Language) || "en";
      setLang(saved);
      const handleLangChange = () => {
        const next = (localStorage.getItem("app_lang") as Language) || "en";
        setLang(next);
      };
      window.addEventListener("languagechange", handleLangChange);
      return () => window.removeEventListener("languagechange", handleLangChange);
    }
  }, []);

  return (
    <footer className="border-t border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 py-10 text-xs text-zinc-600 dark:text-zinc-400 mt-auto transition-colors">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
          {/* Brand & Mission */}
          <div className="space-y-3 md:col-span-2">
            <div className="flex items-center gap-2.5">
              <div className="relative h-8 w-8 sm:h-9 sm:w-9 rounded-xl overflow-hidden border border-emerald-700/20 shadow-2xs shrink-0">
                <Image
                  src="/brand/logo-icon.jpg"
                  alt="Bangladesh Citizen Report Emblem"
                  width={36}
                  height={36}
                  className="object-cover h-full w-full"
                />
              </div>
              <div>
                <span className="font-extrabold text-sm text-zinc-900 dark:text-zinc-100 block leading-tight">
                  {lang === "bn" ? "বাংলাদেশ সিটিজেন রিপোর্ট" : "Bangladesh Citizen Report"}
                </span>
                <span className="text-[10px] text-zinc-500 dark:text-zinc-400 block leading-none">
                  {lang === "bn" ? "একসাথে গড়ি নিরাপদ বাংলাদেশ" : "Together for a Safer Bangladesh"}
                </span>
              </div>
            </div>

            <p className="leading-relaxed text-zinc-500 dark:text-zinc-400 max-w-md text-xs">
              {lang === "bn"
                ? "নাগরিক সমস্যা ও দুর্ঘটনা রিপোর্ট, যাচাইকৃত নিকটস্থ জরুরি সেবা সন্ধান এবং নিখোঁজ ব্যক্তি অনুসন্ধানের জাতীয় সমন্বিত ডিজিটাল নেটওয়ার্ক।"
                : "A secure, privacy-first civic-tech network enabling citizens across all divisions of Bangladesh to report verified community hazards, discover nearby emergency services, and support missing person searches."}
            </p>

            {/* National Emergency Hotline Badges */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <a
                href="tel:999"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 font-bold text-[11px] border border-red-200/60 dark:border-red-900/60 hover:bg-red-100 transition"
                title="Call 999 Emergency"
              >
                🚨 Emergency: 999
              </a>
              <a
                href="tel:109"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 font-medium text-[11px] border border-emerald-200/60 dark:border-emerald-900/60 hover:bg-emerald-100 transition"
                title="Women & Child Helpline 109"
              >
                📞 Helpline: 109
              </a>
              <a
                href="tel:333"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 font-medium text-[11px] border border-blue-200/60 dark:border-blue-900/60 hover:bg-blue-100 transition"
                title="National Citizen Services 333"
              >
                🏛️ Civic: 333
              </a>
            </div>
          </div>

          {/* Quick Civic Services */}
          <div className="space-y-2.5">
            <h4 className="font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider text-[11px]">
              {lang === "bn" ? "নাগরিক সেবা" : "Platform"}
            </h4>
            <ul className="space-y-2">
              <li>
                <Link href="/" className="hover:text-emerald-700 dark:hover:text-emerald-400 transition">
                  {lang === "bn" ? "নাগরিক ফিড" : "Incident Feed"}
                </Link>
              </li>
              <li>
                <Link href="/reports/create" className="hover:text-emerald-700 dark:hover:text-emerald-400 transition font-semibold text-emerald-700 dark:text-emerald-400">
                  + {lang === "bn" ? "রিপোর্ট করুন" : "Report an Issue"}
                </Link>
              </li>
              <li>
                <Link href="/safety" className="hover:text-red-600 transition font-semibold text-red-600 dark:text-red-400">
                  🚨 {lang === "bn" ? "জরুরি সেবা (৯৯৯)" : "Find Help (999)"}
                </Link>
              </li>
              <li>
                <Link href="/safety-map" className="hover:text-emerald-700 dark:hover:text-emerald-400 transition">
                  🗺️ {lang === "bn" ? "নিরাপত্তা মানচিত্র" : "Safety Map"}
                </Link>
              </li>
              <li>
                <Link href="/missing-person" className="hover:text-amber-600 transition">
                  🔍 {lang === "bn" ? "নিখোঁজ ব্যক্তি অনুসন্ধান" : "Missing Persons"}
                </Link>
              </li>
            </ul>
          </div>

          {/* Transparency & Insights */}
          <div className="space-y-2.5">
            <h4 className="font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider text-[11px]">
              {lang === "bn" ? "স্বচ্ছতা ও তথ্য" : "Transparency"}
            </h4>
            <ul className="space-y-2">
              <li>
                <Link href="/transparency" className="hover:text-blue-600 transition font-semibold">
                  📊 {lang === "bn" ? "ক্রাইম অ্যানালিটিক্স" : "Crime Analysis"}
                </Link>
              </li>
              <li>
                <Link href="/missing-person/create" className="hover:text-zinc-900 dark:hover:text-white transition">
                  {lang === "bn" ? "নিখোঁজ ব্যক্তির তথ্য দিন" : "Submit Missing Alert"}
                </Link>
              </li>
              <li>
                <Link href="/safety" className="hover:text-zinc-900 dark:hover:text-white transition">
                  {lang === "bn" ? "ভেরিফায়েড ডিরেক্টরি" : "Official Directory"}
                </Link>
              </li>
              {isAdmin && (
                <li>
                  <Link href="/admin" className="text-amber-700 dark:text-amber-400 font-bold hover:underline">
                    🛡️ Admin Console
                  </Link>
                </li>
              )}
            </ul>
          </div>

          {/* Account & Profile */}
          <div className="space-y-2.5">
            <h4 className="font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider text-[11px]">
              {lang === "bn" ? "অ্যাকাউন্ট" : "Account"}
            </h4>
            <ul className="space-y-2">
              {isAuthenticated ? (
                <>
                  <li>
                    <Link href="/dashboard" className="hover:text-emerald-700 dark:hover:text-emerald-400 transition font-semibold">
                      {lang === "bn" ? "নাগরিক ড্যাশবোর্ড" : "Citizen Dashboard"}
                    </Link>
                  </li>
                  <li>
                    <Link href="/reports/mine" className="hover:text-zinc-900 dark:hover:text-white transition">
                      {lang === "bn" ? "আমার রিপোর্টসমূহ" : "My Reports"}
                    </Link>
                  </li>
                  <li>
                    <Link href="/notifications" className="hover:text-zinc-900 dark:hover:text-white transition">
                      {lang === "bn" ? "বিজ্ঞপ্তি" : "Notifications"}
                    </Link>
                  </li>
                </>
              ) : (
                <>
                  <li>
                    <Link href="/login" className="hover:text-emerald-700 dark:hover:text-emerald-400 transition font-semibold">
                      {lang === "bn" ? "লগইন" : "Sign In"}
                    </Link>
                  </li>
                  <li>
                    <Link href="/register" className="hover:text-emerald-700 dark:hover:text-emerald-400 transition">
                      {lang === "bn" ? "নিবন্ধন" : "Register"}
                    </Link>
                  </li>
                </>
              )}
            </ul>
          </div>
        </div>

        {/* Footer Bottom Strip */}
        <div className="border-t border-zinc-100 dark:border-zinc-800 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-zinc-400">
          <p>
            © {new Date().getFullYear()} Bangladesh Citizen Report Platform. Together for a safer Bangladesh.
          </p>
          <p className="text-center sm:text-right">
            🔒 Privacy-First Architecture • Coordinates are privacy-sanitized (~110m grid)
          </p>
        </div>
      </div>
    </footer>
  );
}
