"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Language } from "@/lib/i18n";
import { DEVELOPER_CONFIG } from "@/lib/developerConfig";
import DeveloperProfileModal from "@/components/DeveloperProfileModal";

export default function Footer() {
  const [lang, setLang] = useState<Language>("en");
  const [isDeveloperModalOpen, setIsDeveloperModalOpen] = useState(false);

  // Synchronize language with global storage & event
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

  const changeLanguage = (newLang: Language) => {
    setLang(newLang);
    if (typeof window !== "undefined") {
      localStorage.setItem("app_lang", newLang);
      window.dispatchEvent(new Event("languagechange"));
    }
  };

  const isBn = lang === "bn";

  return (
    <>
      <footer className="border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 py-10 text-xs text-zinc-600 dark:text-zinc-400 mt-auto transition-colors">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-8">
          {/* Main Footer Columns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-8">
            {/* 1. Brand & Mission */}
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
                    {isBn ? "বাংলাদেশ সিটিজেন রিপোর্ট" : "BANGLADESH CITIZEN REPORT"}
                  </span>
                  <span className="text-[10px] text-zinc-500 dark:text-zinc-400 block leading-none">
                    {isBn ? "একসাথে গড়ি নিরাপদ বাংলাদেশ।" : "Together for a safer Bangladesh."}
                  </span>
                </div>
              </div>

              <p className="leading-relaxed text-zinc-500 dark:text-zinc-400 max-w-sm text-xs">
                {isBn
                  ? "নাগরিক সমস্যা ও ঘটনা রিপোর্ট, যাচাইকৃত নিকটস্থ জরুরি সেবা সন্ধান এবং নিখোঁজ ব্যক্তি অনুসন্ধানের সমন্বিত প্ল্যাটফর্ম।"
                  : "Citizen-powered platform for reporting verified civic issues, discovering nearby emergency services, and supporting community searches."}
              </p>
            </div>

            {/* 2. Useful Links */}
            <div className="space-y-2.5">
              <h4 className="font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider text-[11px]">
                {isBn ? "প্রয়োজনীয় লিংক" : "Useful Links"}
              </h4>
              <ul className="space-y-2">
                <li>
                  <Link href="/" className="hover:text-emerald-700 dark:hover:text-emerald-400 transition">
                    {isBn ? "হোম ফিড" : "Home"}
                  </Link>
                </li>
                <li>
                  <Link href="/reports" className="hover:text-emerald-700 dark:hover:text-emerald-400 transition">
                    {isBn ? "রিপোর্টসমূহ" : "Reports"}
                  </Link>
                </li>
                <li>
                  <Link href="/safety" className="hover:text-emerald-700 dark:hover:text-emerald-400 transition">
                    {isBn ? "সুরক্ষা কেন্দ্র" : "Safety Center"}
                  </Link>
                </li>
                <li>
                  <Link href="/safety-map" className="hover:text-emerald-700 dark:hover:text-emerald-400 transition">
                    {isBn ? "নিরাপত্তা মানচিত্র" : "Safety Map"}
                  </Link>
                </li>
                <li>
                  <Link href="/missing-person" className="hover:text-emerald-700 dark:hover:text-emerald-400 transition">
                    {isBn ? "নিখোঁজ ব্যক্তি" : "Missing Persons"}
                  </Link>
                </li>
                <li>
                  <Link href="/transparency" className="hover:text-emerald-700 dark:hover:text-emerald-400 transition">
                    {isBn ? "স্বচ্ছতা ড্যাশবোর্ড" : "Transparency"}
                  </Link>
                </li>
              </ul>
            </div>

            {/* 3. Emergency */}
            <div className="space-y-2.5">
              <h4 className="font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider text-[11px]">
                {isBn ? "জরুরি সেবা" : "Emergency"}
              </h4>
              <ul className="space-y-2">
                <li>
                  <a
                    href="tel:999"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 font-bold border border-red-200/60 dark:border-red-900/60 hover:bg-red-100 transition shadow-2xs"
                    title="Call National Emergency 999"
                  >
                    <span>🚨</span>
                    <span>{isBn ? "জাতীয় হটলাইন: ৯৯৯" : "National: 999"}</span>
                  </a>
                </li>
                <li>
                  <a href="tel:109" className="hover:text-zinc-900 dark:hover:text-zinc-200 transition block">
                    📞 {isBn ? "নারী ও শিশু হেল্পলাইন: ১০৯" : "Women & Child: 109"}
                  </a>
                </li>
                <li>
                  <a href="tel:333" className="hover:text-zinc-900 dark:hover:text-zinc-200 transition block">
                    🏛️ {isBn ? "নাগরিক সেবা: ৩৩৩" : "Citizen Services: 333"}
                  </a>
                </li>
              </ul>
            </div>

            {/* 4. Language */}
            <div className="space-y-2.5">
              <h4 className="font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider text-[11px]">
                {isBn ? "ভাষা নির্বাচন" : "Language"}
              </h4>
              <div className="flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={() => changeLanguage("en")}
                  className={`text-left px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center justify-between ${
                    lang === "en"
                      ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-bold"
                      : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
                  }`}
                >
                  <span>English</span>
                  {lang === "en" && <span className="text-emerald-600 font-bold">✓</span>}
                </button>
                <button
                  type="button"
                  onClick={() => changeLanguage("bn")}
                  className={`text-left px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center justify-between ${
                    lang === "bn"
                      ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-bold"
                      : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
                  }`}
                >
                  <span>বাংলা</span>
                  {lang === "bn" && <span className="text-emerald-600 font-bold">✓</span>}
                </button>
              </div>
            </div>
          </div>

          {/* Subtle Divider */}
          <div className="border-t border-zinc-200/80 dark:border-zinc-800 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-zinc-500">
            {/* Bottom Line: Copyright */}
            <p>
              © {new Date().getFullYear()} {isBn ? "বাংলাদেশ সিটিজেন রিপোর্ট" : "Bangladesh Citizen Report"}. {isBn ? "সর্বস্বত্ব সংরক্ষিত।" : "All rights reserved."}
            </p>

            {/* Clickable Developer Attribution */}
            <div className="flex items-center gap-1 text-center sm:text-right">
              <span>{isBn ? "ডেভেলপমেন্টে:" : "Developed by"}</span>
              <button
                type="button"
                onClick={() => setIsDeveloperModalOpen(true)}
                className="font-bold text-zinc-800 dark:text-zinc-200 hover:text-emerald-700 dark:hover:text-emerald-400 transition underline decoration-dotted underline-offset-4 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 rounded px-1"
                aria-label={isBn ? "ডেভেলপার প্রোফাইল দেখুন" : "View developer profile"}
              >
                {isBn ? DEVELOPER_CONFIG.name_bn : DEVELOPER_CONFIG.name}
              </button>
            </div>
          </div>
        </div>
      </footer>

      {/* Developer Profile Modal */}
      <DeveloperProfileModal
        isOpen={isDeveloperModalOpen}
        onClose={() => setIsDeveloperModalOpen(false)}
        lang={lang}
      />
    </>
  );
}
