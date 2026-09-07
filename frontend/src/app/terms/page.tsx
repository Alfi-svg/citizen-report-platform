"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Language } from "@/lib/i18n";

export default function TermsOfServicePage() {
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

  const isBn = lang === "bn";

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8 space-y-10">
      {/* Header Banner */}
      <div className="rounded-3xl border border-emerald-700/20 bg-emerald-50/50 dark:bg-emerald-950/20 p-6 sm:p-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200">
              📜 {isBn ? "কমিউনিটি নির্দেশিকা ও শর্তাবলী" : "Community Rules & Legal Terms"}
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">
              {isBn ? "ব্যবহারের শর্তাবলী (Terms of Service)" : "Terms of Service"}
            </h1>
            <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400">
              {isBn
                ? "সর্বশেষ হালনাগাদ: সেপ্টেম্বর ২০২৬ | দায়িত্বশীল নাগরিক অংশগ্রহণ নিশ্চিতকরণ"
                : "Last Updated: September 2026 | Fostering Responsible Civic Participation"}
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={() => {
                setLang("en");
                localStorage.setItem("app_lang", "en");
                window.dispatchEvent(new Event("languagechange"));
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                lang === "en"
                  ? "bg-emerald-700 text-white shadow-xs"
                  : "bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700"
              }`}
            >
              English
            </button>
            <button
              onClick={() => {
                setLang("bn");
                localStorage.setItem("app_lang", "bn");
                window.dispatchEvent(new Event("languagechange"));
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                lang === "bn"
                  ? "bg-emerald-700 text-white shadow-xs"
                  : "bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700"
              }`}
            >
              বাংলা
            </button>
          </div>
        </div>
      </div>

      {/* Emergency Disclaimer Banner */}
      <div className="rounded-2xl border border-red-300 dark:border-red-900/70 bg-red-50 dark:bg-red-950/30 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-red-800 dark:text-red-300 font-black text-sm">
            <span>🚨</span>
            <span>{isBn ? "জরুরি সতর্কবার্তা ও ডিসক্লেইমার" : "Important Emergency Notice"}</span>
          </div>
          <p className="text-xs text-red-700 dark:text-red-400 leading-relaxed max-w-2xl">
            {isBn
              ? "নিরাপত্তা প্ল্যাটফর্ম বাংলাদেশ পুলিশের ৯৯৯ জরুরি সেবার বিকল্প নয়। তাৎক্ষণিক বিপদ, অগ্নিকাণ্ড বা জরুরি চিকিৎসার ক্ষেত্রে সরাসরি ৯৯৯ নম্বরে ফোন করুন।"
              : "Nirapotta is a civic platform and is NOT a replacement for the National Emergency Hotline (999). In active life-threatening emergencies, dial 999 directly."}
          </p>
        </div>
        <a
          href="tel:999"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs shrink-0 shadow-xs transition"
        >
          <span>📞</span>
          <span>{isBn ? "৯৯৯ কল করুন" : "Call 999"}</span>
        </a>
      </div>

      {/* Main Content */}
      <div className="space-y-8 text-zinc-700 dark:text-zinc-300 text-sm leading-relaxed">
        {/* Section 1: Agreement */}
        <section className="space-y-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <span>1.</span>
            <span>{isBn ? "শর্তাবলীর গ্রহণযোগ্যতা" : "Acceptance of Terms"}</span>
          </h2>
          <p>
            {isBn
              ? "নিরাপত্তা ওয়েবসাইট বা অ্যান্ড্রয়েড অ্যাপ্লিকেশনে প্রবেশ বা অ্যাকাউন্ট তৈরির মাধ্যমে আপনি এই শর্তাবলী এবং কমিউনিটি নির্দেশিকা মেনে চলতে সম্মত হচ্ছেন। আপনি এই শর্তাবলীর সাথে একমত না হলে অ্যাপ্লিকেশনটি ব্যবহার থেকে বিরত থাকুন।"
              : "By accessing or registering an account on Nirapotta (web or Android mobile application), you agree to be bound by these Terms of Service and Community Guidelines. If you do not agree, please discontinue using the service."}
          </p>
        </section>

        {/* Section 2: Prohibited Conduct & Fake Reporting */}
        <section className="space-y-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <span>2.</span>
            <span>{isBn ? "ভুয়া রিপোর্ট ও নিষিদ্ধ কার্যক্রম" : "Zero Tolerance for False Reports & Misuse"}</span>
          </h2>
          <p>
            {isBn
              ? "প্ল্যাটফর্মের স্বচ্ছতা ও নির্ভরযোগ্যতা রক্ষার স্বার্থে নিম্নলিখিত আচরণ সম্পূর্ণ নিষিদ্ধ:"
              : "To protect community welfare and civic resource allocation, the following behaviors are strictly prohibited:"}
          </p>
          <ul className="list-disc pl-5 space-y-2 text-xs">
            <li>
              <strong>{isBn ? "ভুয়া বা বিভ্রান্তিকর রিপোর্ট:" : "False or Fabricated Incidents:"}</strong>{" "}
              {isBn
                ? "উদ্দেশ্যপ্রণোদিত অসত্য তথ্য বা ছবি আপলোড করা কঠোর শাস্তিযোগ্য অপরাধ।"
                : "Fabricating incidents, manipulating coordinates, or uploading doctored media."}
            </li>
            <li>
              <strong>{isBn ? "অহেতুক বিভ্রান্তি বা প্যানিক সৃষ্টি:" : "Emergency Disruption & Panic:"}</strong>{" "}
              {isBn
                ? "জরুরি সেবা বা সাধারণ জনগণের মাঝে বিভ্রান্তি ছড়ানোর চেষ্টা করা।"
                : "Attempting to incite panic or divert critical community resources."}
            </li>
            <li>
              <strong>{isBn ? "হয়রানি ও বিদ্বেষপূর্ণ বক্তব্য:" : "Harassment & Hate Speech:"}</strong>{" "}
              {isBn
                ? "কোনো ব্যক্তি, গোষ্ঠী বা সম্প্রদায়ের বিরুদ্ধে অবমাননাকর মন্তব্য বা আক্রমণ।"
                : "Defamatory, abusive, threatening, or discriminatory remarks against any group or individual."}
            </li>
            <li>
              <strong>{isBn ? "ট্রাস্ট স্কোর প্রতারণা:" : "Reputation Score Manipulation:"}</strong>{" "}
              {isBn
                ? "বট বা একাধিক অ্যাকাউন্টের মাধ্যমে কৃত্রিমভাবে আপভোট বা রেটিং বাড়ানো।"
                : "Using automated bots or multi-accounting to artificially inflate Trust Scores or Impact Points."}
            </li>
          </ul>
        </section>

        {/* Section 3: User Rights & Account Safety */}
        <section className="space-y-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <span>3.</span>
            <span>{isBn ? "নাগরিক অধিকার ও জবাবদিহিতা" : "Citizen Rights & Moderation"}</span>
          </h2>
          <p>
            {isBn
              ? "প্রত্যেক নাগরিকের সত্য ও যাচাইযোগ্য রিপোর্ট প্রকাশের অধিকার রয়েছে। সংবেদনশীল ঘটনায় ব্যক্তি সুরক্ষা নিশ্চিত করতে বেনামী (Anonymous) রিপোর্ট করার সুবিধা প্রদান করা হয়েছে। মডারেশন টিম যেকোনো সময় নীতিবিরুদ্ধ রিপোর্ট অপসারণ এবং সংশ্লিষ্ট অ্যাকাউন্টের বিরুদ্ধে ব্যবস্থা গ্রহণের ক্ষমতা রাখে।"
              : "Every registered citizen is empowered to report hazards and aid neighbors. Anonymous reporting mode is available to safeguard reporters in sensitive contexts. Nirapotta reserves the right to review, moderate, or reject submissions that violate community safety standards."}
          </p>
        </section>

        {/* Section 4: Blood Help & Mutual Aid */}
        <section className="space-y-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <span>4.</span>
            <span>{isBn ? "রক্ত সহায়তা ও মানবিক সাহায্য" : "Blood Help & Mutual Assistance"}</span>
          </h2>
          <p>
            {isBn
              ? "রক্ত সহায়তা সেবায় তথ্য প্রদানের ক্ষেত্রে দাতার ইচ্ছা ও সম্মতি চূড়ান্ত। রক্তদানের জন্য কোনো ধরনের আর্থিক লেনদেন দাবি করা কঠোরভাবে নিষিদ্ধ। এটি একটি অলাভজনক মানবিক সেবা।"
              : "Blood Help operates entirely as voluntary mutual assistance. Demanding commercial or financial payment for blood donation is strictly banned and will result in immediate permanent account ban."}
          </p>
        </section>

        {/* Section 5: Account Termination */}
        <section className="space-y-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <span>5.</span>
            <span>{isBn ? "অ্যাকাউন্ট মোচন ও সমাপ্তি" : "Termination & Deletion"}</span>
          </h2>
          <p>
            {isBn
              ? "আপনি যেকোনো সময় আপনার অ্যাকাউন্ট ডিলিট করতে পারেন আমাদের অ্যাকাউন্ট মোচন পেজ অথবা ড্যাশবোর্ড সেটিংসের মাধ্যমে। শর্তাবলী লঙ্ঘনের কারণে কর্তৃপক্ষ যেকোনো অ্যাকাউন্ট সাময়িক বা স্থায়ীভাবে স্থগিত করতে পারে।"
              : "You may terminate your account at any time through our Account Deletion portal or via the in-app dashboard. Nirapotta may suspend or terminate accounts that breach these terms."}
          </p>
          <div className="pt-2">
            <Link
              href="/account-deletion"
              className="text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline inline-flex items-center gap-1"
            >
              <span>{isBn ? "অ্যাকাউন্ট মোচন পেজে যান →" : "Visit Account Deletion Page →"}</span>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
