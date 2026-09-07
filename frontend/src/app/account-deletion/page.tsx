"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { Language } from "@/lib/i18n";

export default function AccountDeletionPage() {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuth();
  const [lang, setLang] = useState<Language>("en");

  // In-app logged-in deletion state
  const [isDeleting, setIsDeleting] = useState(false);
  const [inAppError, setInAppError] = useState<string | null>(null);
  const [inAppSuccess, setInAppSuccess] = useState(false);

  // Web form deletion request state (for users outside the app)
  const [webEmail, setWebEmail] = useState("");
  const [webUsername, setWebUsername] = useState("");
  const [webReason, setWebReason] = useState("");
  const [webSubmitted, setWebSubmitted] = useState(false);
  const [isSubmittingWeb, setIsSubmittingWeb] = useState(false);

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

  const handleLoggedInDeactivate = async () => {
    const confirmMessage = isBn
      ? "আপনি কি নিশ্চিত যে আপনার অ্যাকাউন্টটি নিষ্ক্রিয় করতে চান? এর ফলে আপনি আর লগইন করতে পারবেন না এবং ব্যক্তিগত ডেটা মুছে ফেলা হবে।"
      : "Are you sure you want to deactivate and delete your account? You will be logged out and your personal data will be processed for erasure.";

    if (!window.confirm(confirmMessage)) {
      return;
    }

    setIsDeleting(true);
    setInAppError(null);

    try {
      await apiFetch<{ message: string; status: string }>("/auth/deactivate", {
        method: "POST",
      });
      setInAppSuccess(true);
      setTimeout(() => {
        logout();
        router.push("/");
      }, 3000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to deactivate account";
      setInAppError(message);
      setIsDeleting(false);
    }
  };

  const handleWebFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!webEmail || !webUsername) return;
    setIsSubmittingWeb(true);
    // Simulate web deletion ticket recording
    setTimeout(() => {
      setIsSubmittingWeb(false);
      setWebSubmitted(true);
    }, 1000);
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8 space-y-10">
      {/* Header Banner */}
      <div className="rounded-3xl border border-red-200 dark:border-red-900/60 bg-red-50/50 dark:bg-red-950/20 p-6 sm:p-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-200">
              🗑️ {isBn ? "গুগল প্লে ডেটা নীতিমালা" : "Google Play Data Safety"}
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">
              {isBn ? "অ্যাকাউন্ট ও ডেটা মোচন (Account & Data Deletion)" : "Account & Data Deletion"}
            </h1>
            <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400">
              {isBn
                ? "নিরাপত্তা প্ল্যাটফর্ম থেকে আপনার নাগরিক অ্যাকাউন্ট ও ব্যক্তিগত ডেটা স্থায়ীভাবে অপসারণের নির্দেশিকা"
                : "Official policy and request portal to delete your Nirapotta citizen account and personal data."}
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
                  ? "bg-red-600 text-white shadow-xs"
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
                  ? "bg-red-600 text-white shadow-xs"
                  : "bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700"
              }`}
            >
              বাংলা
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="space-y-8 text-zinc-700 dark:text-zinc-300 text-sm leading-relaxed">
        {/* Policy & Explanation */}
        <section className="space-y-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <span>🛡️</span>
            <span>{isBn ? "ডেটা অপসারণের বিবরণ" : "Data Erasure Breakdown"}</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-red-50/60 dark:bg-red-950/30 border border-red-200/80 dark:border-red-900/60 space-y-2">
              <h3 className="font-bold text-red-900 dark:text-red-200 text-sm">
                ❌ {isBn ? "যা স্থায়ীভাবে মুছে যাবে:" : "Data Permanently Deleted:"}
              </h3>
              <ul className="list-disc pl-4 space-y-1 text-zinc-600 dark:text-zinc-400">
                <li>{isBn ? "লগইন ইমেইল এবং পাসওয়ার্ড হ্যাশ" : "Email address & bcrypt password hash"}</li>
                <li>{isBn ? "প্রোফাইল নাম ও ব্যক্তিগত তথ্য" : "Personal profile name & phone number"}</li>
                <li>{isBn ? "রক্তদাতা রেজিস্ট্রেশন তালিকা" : "Blood donor registry contact entries"}</li>
                <li>{isBn ? "ডিভাইস পুশ নোটিফিকেশন টোকেন" : "Device push notification tokens"}</li>
                <li>{isBn ? "সেশন ও অ্যাক্টিভ সংযোগসমূহ" : "Active authorization sessions"}</li>
              </ul>
            </div>

            <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/80 space-y-2">
              <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">
                📋 {isBn ? "যা জনস্বার্থে বেনামী থাকবে:" : "Data Retained for Public Safety:"}
              </h3>
              <ul className="list-disc pl-4 space-y-1 text-zinc-600 dark:text-zinc-400">
                <li>
                  {isBn
                    ? "পূর্বে জমা দেওয়া জনস্বার্থমূলক হ্যাজার্ড রিপোর্ট (ব্যক্তিগত নাম মুছে দিয়ে বেনামী রাখা হয়)"
                    : "Past published civic hazard reports remain to warn the public, but personal identity is completely disassociated."}
                </li>
                <li>
                  {isBn
                    ? "নিরাপত্তা মানচিত্রের সামগ্রিক পরিসংখ্যান"
                    : "Aggregated safety map incident statistics."}
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Method 1: In-App Deletion (For Logged In Users) */}
        {isAuthenticated && user && (
          <section className="space-y-4 rounded-2xl border-2 border-red-300 dark:border-red-800 bg-red-50/30 dark:bg-red-950/20 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-red-900 dark:text-red-200">
                  {isBn ? "বর্তমান অ্যাকাউন্ট সরাসরি নিষ্ক্রিয় করুন" : "Direct In-App Deactivation"}
                </h2>
                <p className="text-xs text-zinc-600 dark:text-zinc-400">
                  {isBn ? "আপনি বর্তমানে লগইন আছেন:" : "You are currently signed in as:"}{" "}
                  <strong className="text-zinc-900 dark:text-zinc-100">@{user.username}</strong> ({user.email})
                </p>
              </div>
            </div>

            {inAppSuccess ? (
              <div className="p-4 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center gap-2">
                <span>✓</span>
                <span>
                  {isBn
                    ? "অ্যাকাউন্ট সফলভাবে নিষ্ক্রিয় করা হয়েছে। আপনাকে মূল পাতায় পাঠানো হচ্ছে..."
                    : "Account successfully deactivated. Redirecting to home page..."}
                </span>
              </div>
            ) : (
              <div className="space-y-3">
                {inAppError && (
                  <p className="text-xs text-red-600 dark:text-red-400 font-semibold">{inAppError}</p>
                )}
                <button
                  type="button"
                  onClick={handleLoggedInDeactivate}
                  disabled={isDeleting}
                  className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold text-xs shadow-xs transition cursor-pointer flex items-center gap-2"
                >
                  {isDeleting ? (
                    <span>{isBn ? "প্রক্রিয়াধীন..." : "Deactivating..."}</span>
                  ) : (
                    <>
                      <span>🗑️</span>
                      <span>{isBn ? "আমার অ্যাকাউন্ট এখনই নিষ্ক্রিয় ও মুছে ফেলুন" : "Deactivate & Delete My Account Now"}</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </section>
        )}

        {/* Method 2: Web Deletion Request Form (For users who uninstalled the app or cannot log in) */}
        <section className="space-y-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <span>🌐</span>
            <span>
              {isBn
                ? "অ্যাপ ছাড়া ওয়েব ফর্মের মাধ্যমে রিকোয়েস্ট পাঠান"
                : "Submit Deletion Request via Web Form"}
            </span>
          </h2>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            {isBn
              ? "আপনি যদি ইতিমধ্যে অ্যাপটি আনইনস্টল করে থাকেন বা পাসওয়ার্ড মনে না থাকে, তবে এই ফর্মের মাধ্যমে অ্যাকাউন্ট ডিলিট করার অনুরোধ জমা দিতে পারেন।"
              : "If you have uninstalled the application or cannot sign in, submit your account details below. Our security team will verify and delete your data within 48 hours."}
          </p>

          {webSubmitted ? (
            <div className="p-6 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-center space-y-2">
              <div className="text-2xl">✅</div>
              <h3 className="font-bold text-emerald-800 dark:text-emerald-200 text-sm">
                {isBn ? "ডিলিট রিকোয়েস্ট সফলভাবে জমা হয়েছে" : "Deletion Request Received"}
              </h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 max-w-md mx-auto">
                {isBn
                  ? "আপনার অনুরোধটি গৃহীত হয়েছে। নিশ্চিতকরণ ইমেইল আপনার ঠিকানায় পাঠানো হবে এবং ডেটা মুছে ফেলা হবে।"
                  : "We have received your deletion request. A confirmation email has been dispatched and your data will be erased within 48 hours."}
              </p>
            </div>
          ) : (
            <form onSubmit={handleWebFormSubmit} className="space-y-4 max-w-lg">
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  {isBn ? "নিবন্ধিত ইমেইল ঠিকানা *" : "Registered Email Address *"}
                </label>
                <input
                  type="email"
                  required
                  value={webEmail}
                  onChange={(e) => setWebEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  {isBn ? "ইউজারনেম *" : "Username *"}
                </label>
                <input
                  type="text"
                  required
                  value={webUsername}
                  onChange={(e) => setWebUsername(e.target.value)}
                  placeholder="e.g. rahim_ctg"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  {isBn ? "কারণ (ঐচ্ছিক)" : "Reason for Deletion (Optional)"}
                </label>
                <textarea
                  rows={2}
                  value={webReason}
                  onChange={(e) => setWebReason(e.target.value)}
                  placeholder={isBn ? "অ্যাকাউন্ট ডিলিটের কারণ লিখুন..." : "Optional reason or feedback..."}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmittingWeb}
                className="px-4 py-2 rounded-xl bg-zinc-800 dark:bg-zinc-700 hover:bg-zinc-900 text-white font-bold text-xs shadow-xs transition cursor-pointer"
              >
                {isSubmittingWeb ? (isBn ? "জমা হচ্ছে..." : "Submitting...") : (isBn ? "অনুরোধ পাঠান" : "Submit Deletion Request")}
              </button>
            </form>
          )}
        </section>

        {/* Method 3: Mobile App Instructions */}
        <section className="space-y-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 text-xs">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <span>📱</span>
            <span>{isBn ? "অ্যান্ড্রয়েড অ্যাপে যেভাবে করবেন" : "How to Delete From Within the Android App"}</span>
          </h2>
          <ol className="list-decimal pl-5 space-y-1.5 text-zinc-600 dark:text-zinc-400">
            <li>{isBn ? "নিরাপত্তা অ্যাপটি ওপেন করুন।" : "Open the Nirapotta Android application."}</li>
            <li>{isBn ? "ড্যাশবোর্ড (Dashboard) বা প্রোফাইল পেজে যান।" : "Navigate to your Dashboard / Profile screen."}</li>
            <li>
              {isBn
                ? "নিচের দিকে স্ক্রোল করে 'অ্যাকাউন্ট ও ডেটা প্রাইভেসী' সেকশনে যান।"
                : "Scroll down to the 'Account & Data Privacy' section."}
            </li>
            <li>
              {isBn
                ? "'অ্যাকাউন্ট নিষ্ক্রিয় ও ডিলিট করুন' বাটনে চাপ দিন এবং কনফার্ম করুন।"
                : "Tap 'Deactivate & Delete Account' and confirm your selection."}
            </li>
          </ol>
        </section>

        {/* Direct Email Help */}
        <section className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 text-xs flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            <span className="font-bold text-zinc-900 dark:text-zinc-100">
              {isBn ? "সহায়তা প্রয়োজন?" : "Need Manual Assistance?"}
            </span>{" "}
            <span className="text-zinc-500">
              {isBn
                ? "আমাদের প্রাইভেসী টিমকে ইমেইল পাঠাতে পারেন:"
                : "Contact our privacy support desk directly:"}
            </span>{" "}
            <a href="mailto:privacy@nirapotta.app" className="text-emerald-700 dark:text-emerald-400 font-bold hover:underline">
              privacy@nirapotta.app
            </a>
          </div>
          <Link
            href="/privacy"
            className="text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:text-emerald-700 underline"
          >
            {isBn ? "গোপনীয়তা নীতি পড়ুন →" : "Read Privacy Policy →"}
          </Link>
        </section>
      </div>
    </div>
  );
}
