"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Language } from "@/lib/i18n";

export default function PrivacyPolicyPage() {
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
              🛡️ {isBn ? "আইনি ও ডেটা সুরক্ষা" : "Legal & Data Safety"}
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">
              {isBn ? "গোপনীয়তা নীতি (Privacy Policy)" : "Privacy Policy"}
            </h1>
            <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400">
              {isBn
                ? "সর্বশেষ হালনাগাদ: সেপ্টেম্বর ২০২৬ | গুগল প্লে স্টোর ও বৈশ্বিক ডেটা নীতিমালার সাথে সংগতিপূর্ণ"
                : "Last Updated: September 2026 | Compliant with Google Play Developer Policies"}
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

      {/* Main Policy Content */}
      <div className="space-y-8 text-zinc-700 dark:text-zinc-300 text-sm leading-relaxed">
        {/* Section 1: Overview */}
        <section className="space-y-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <span>1.</span>
            <span>{isBn ? "ভূমিকা ও প্ল্যাটফর্ম পরিচিতি" : "Introduction & Platform Purpose"}</span>
          </h2>
          <p>
            {isBn
              ? "নিরাপত্তা (Nirapotta) একটি মুক্ত নাগরিক প্ল্যাটফর্ম যা জনগণের নিরাপত্তা, জনদুর্ভোগ নিরসন, জরুরি রক্ত সহায়তা ও নিখোঁজ ব্যক্তি অনুসন্ধানের উদ্দেশ্যে তৈরি। আপনার ব্যক্তিগত তথ্যের গোপনীয়তা রক্ষা করা আমাদের অন্যতম প্রধান দায়িত্ব। এই নীতিমালায় পরিষ্কারভাবে উল্লেখ করা হয়েছে আমরা কী ধরনের তথ্য সংগ্রহ করি, কীভাবে তা ব্যবহার করি এবং কীভাবে আপনার তথ্য সুরক্ষিত রাখা হয়।"
              : "NIRAPOTTA is a citizen-powered community platform created to enhance civil safety, report hazards, facilitate emergency blood donation, and assist in finding missing persons in Bangladesh. We prioritize the security, privacy, and integrity of your personal information. This Privacy Policy outlines what information we collect, how it is processed, and how you retain control over your data."}
          </p>
        </section>

        {/* Section 2: Data We Collect */}
        <section className="space-y-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <span>2.</span>
            <span>{isBn ? "যে সকল তথ্য সংগ্রহ করা হয়" : "Information We Collect"}</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/80 space-y-1.5">
              <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">
                👤 {isBn ? "অ্যাকাউন্ট তথ্য" : "Account Information"}
              </h3>
              <p>
                {isBn
                  ? "নিবন্ধন করার সময় ইউজারনেম, ইমেইল ঠিকানা এবং সুরক্ষিতভাবে হ্যাশ করা পাসওয়ার্ড সংরক্ষিত হয়। প্রোফাইলে পুরো নাম যোগ করা ঐচ্ছিক।"
                  : "Username, email address, and securely hashed passwords upon registration. Full name is optional."}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/80 space-y-1.5">
              <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">
                📍 {isBn ? "স্থান ও ভৌগোলিক তথ্য" : "Location & Geolocation"}
              </h3>
              <p>
                {isBn
                  ? "রিপোর্ট জমা দেওয়ার সময় ভৌগোলিক স্থানাঙ্ক গ্রহণ করা হয়। নাগরিকের ব্যক্তিগত বাড়ি বা অবস্থান গোপনীয় রাখতে পাবলিক ম্যাপে স্থানাঙ্ককে আনুমানিক ১১০ মিটার ফাজি (Fuzzy Obfuscation) করা হয়।"
                  : "Approximate geographic coordinates when submitting reports. To protect personal home locations, public heatmaps apply a ~110-meter privacy fuzzing radius."}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/80 space-y-1.5">
              <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">
                📸 {isBn ? "মিডিয়া ও সাক্ষ্য-প্রমাণ" : "Media & Evidence"}
              </h3>
              <p>
                {isBn
                  ? "ঘটনা প্রমাণের সুবিধার্থে ছবি ও ভিডিও আপলোড করা যায়। সংবেদনশীল ঘটনায় নাগরিকরা পরিচয় গোপন রেখে (Anonymous) রিপোর্ট জমা দিতে পারেন।"
                  : "Photos or videos uploaded as incident proof. Citizens may also submit reports under Anonymous mode to preserve privacy."}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/80 space-y-1.5">
              <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">
                🩸 {isBn ? "রক্ত সহায়তা ও নিখোঁজ ব্যক্তি" : "Blood Help & Missing Person"}
              </h3>
              <p>
                {isBn
                  ? "স্বেচ্ছায় রক্তদানকারী হিসেবে যুক্ত হলে রক্তের গ্রুপ এবং যোগাযোগের নম্বর শুধুমাত্র জরুরি সমন্বয়ের জন্য ব্যবহৃত হয়। কোনো বাণিজ্যিক বিপণনে ব্যবহৃত হয় না।"
                  : "Voluntary donor registration collects blood group and phone number exclusively for emergency life-saving contact."}
              </p>
            </div>
          </div>
        </section>

        {/* Section 3: Android Device Permissions */}
        <section className="space-y-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <span>3.</span>
            <span>{isBn ? "অ্যান্ড্রয়েড অ্যাপ অনুমতি (Device Permissions)" : "Android Permissions Policy"}</span>
          </h2>
          <p>
            {isBn
              ? "গুগল প্লে স্টোর ন্যূনতম বিশেষাধিকার নীতি (Principle of Least Privilege) মেনে আমাদের অ্যান্ড্রয়েড অ্যাপে কেবল প্রয়োজনীয় অনুমতি ব্যবহৃত হয়:"
              : "In accordance with Google Play's Least Privilege policies, Nirapotta requests only strictly necessary permissions:"}
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-xs">
            <li>
              <strong>ACCESS_FINE_LOCATION & ACCESS_COARSE_LOCATION:</strong>{" "}
              {isBn
                ? "রিপোর্টে ঘটনার সঠিক অবস্থান নির্বাচন এবং নিকটস্থ জরুরি সেবা ও রক্তদাতা শনাক্ত করার জন্য।"
                : "Used to tag exact incident coordinates on reports and find nearby blood donors and emergency services."}
            </li>
            <li>
              <strong>CAMERA & READ_MEDIA_IMAGES:</strong>{" "}
              {isBn
                ? "রিপোর্টে ঘটনার সরাসরি ছবি তোলা ও গ্যালারি থেকে প্রমাণ আপলোড করার জন্য।"
                : "Used only when you explicitly capture or upload photographic evidence for an incident report or missing person alert."}
            </li>
            <li>
              <strong>POST_NOTIFICATIONS:</strong>{" "}
              {isBn
                ? "জরুরি রক্ত অনুরোধ, গুরুত্বপূর্ণ এলাকার সতর্কতা এবং রিপোর্টের অবস্থান হালনাগাদ জানানোর জন্য।"
                : "Used to alert you of urgent blood requests, critical localized safety alerts, and report status updates."}
            </li>
            <li>
              <strong>NO CALL_PHONE:</strong>{" "}
              {isBn
                ? "অ্যাপটি কোনো ব্যাকগ্রাউন্ড কল করে না; জরুরি ৯৯৯ নম্বরে ডায়াল প্যাড খোলে ফোনের স্ট্যান্ডার্ড সিস্টেম ডায়ালারে।"
                : "We do not request direct calling permissions. Emergency numbers (999/109/333) launch your standard phone dialer with user confirmation."}
            </li>
          </ul>
        </section>

        {/* Section 4: Data Sharing & Third Parties */}
        <section className="space-y-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <span>4.</span>
            <span>{isBn ? "তথ্য বণ্টন ও তৃতীয় পক্ষ" : "Information Sharing & Third Parties"}</span>
          </h2>
          <p>
            {isBn
              ? "আমরা কোনো অবস্থাতেই আপনার ব্যক্তিগত তথ্য বিজ্ঞাপনদাতা বা কোনো বাণিজ্যিক এজেন্সির কাছে বিক্রি করি না। সর্বজনীন প্ল্যাটফর্মে শুধু সেই তথ্য দৃশ্যমান থাকে যা আপনি নিজে প্রকাশ করার অনুমতি দিয়েছেন (যেমন অনুমোদিত জনস্বার্থ রিপোর্ট)।"
              : "We never sell, rent, or trade your personal data to third parties or advertising networks. Publicly shared content is restricted to information you consciously submit for community benefit (e.g. approved public reports)."}
          </p>
        </section>

        {/* Section 5: Trust Score & Impact Points */}
        <section className="space-y-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <span>5.</span>
            <span>{isBn ? "ট্রাস্ট স্কোর ও সম্মাননা নীতিমালা" : "Trust Score & Reputation Data"}</span>
          </h2>
          <p>
            {isBn
              ? "নাগরিকদের দায়িত্বশীল অবদান মূল্যায়নে ট্রাস্ট স্কোর ও ইমপ্যাক্ট পয়েন্ট অ্যালগরিদম ব্যবহৃত হয়। ভুয়া রিপোর্ট বা স্প্যাম ঠেকাতে নির্ভরযোগ্যতা যাচাই করা হয়। কোনো নাগরিকের অবদানে অযাচিত পেনাল্টি বা অসঙ্গতি দেখা দিলে তা মডারেশন দলের পর্যালোচনায় সংশোধনযোগ্য।"
              : "Nirapotta utilizes an algorithmic Trust Score and Impact Point framework to deter misinformation and recognize reliable civic contributors. Reputation logs are visible in your profile dashboard, and moderation decisions may be appealed."}
          </p>
        </section>

        {/* Section 6: Data Deletion & Account Deactivation */}
        <section className="space-y-4 rounded-2xl border border-red-200 dark:border-red-900/60 bg-red-50/40 dark:bg-red-950/20 p-6">
          <h2 className="text-lg font-bold text-red-900 dark:text-red-200 flex items-center gap-2">
            <span>6.</span>
            <span>{isBn ? "অ্যাকাউন্ট মোচন ও ডেটা ডিলিট অধিকার" : "Account Deletion & Citizen Rights"}</span>
          </h2>
          <p className="text-xs sm:text-sm">
            {isBn
              ? "গুগল প্লে স্টোর ডেটা নীতি এবং ব্যবহারকারীর ব্যক্তিগত অধিকার অনুসারে, আপনি যেকোনো সময় আপনার অ্যাকাউন্ট সম্পূর্ণ ডিলিট বা নিষ্ক্রিয় করার অনুরোধ করতে পারেন।"
              : "In strict compliance with Google Play's User Data & Account Deletion policy, you have the absolute right to delete your account and request complete erasure of your associated personal data."}
          </p>
          <div className="pt-2 flex flex-col sm:flex-row gap-3">
            <Link
              href="/account-deletion"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-xs transition"
            >
              <span>🗑️</span>
              <span>{isBn ? "অ্যাকাউন্ট ও ডেটা ডিলিট পোর্টাল" : "Account & Data Deletion Portal"}</span>
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold text-xs hover:bg-zinc-50 dark:hover:bg-zinc-700 transition"
            >
              <span>⚙️</span>
              <span>{isBn ? "ড্যাশবোর্ড সেটিংস" : "Dashboard Account Settings"}</span>
            </Link>
          </div>
        </section>

        {/* Section 7: Contact Information */}
        <section className="space-y-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 text-xs">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <span>7.</span>
            <span>{isBn ? "যোগাযোগ ও প্রাইভেসী সহায়তা" : "Contact & Privacy Support"}</span>
          </h2>
          <p>
            {isBn
              ? "গোপনীয়তা নীতি সম্পর্কে যেকোনো জিজ্ঞাসা বা ডেটা সুরক্ষার বিষয়ে আমাদের সাথে সরাসরি যোগাযোগ করতে পারেন:"
              : "For any questions, concerns, or data protection inquiries regarding this Privacy Policy, contact our team:"}
          </p>
          <div className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded-xl space-y-1">
            <p>
              <strong>Email:</strong>{" "}
              <a href="mailto:support@nirapotta.app" className="text-emerald-700 dark:text-emerald-400 hover:underline">
                support@nirapotta.app
              </a>
            </p>
            <p>
              <strong>Platform:</strong> Nirapotta (Together for a safer Bangladesh)
            </p>
            <p>
              <strong>Country:</strong> Bangladesh
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
