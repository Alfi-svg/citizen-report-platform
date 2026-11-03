"use client";

import React, { useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { BloodAssistantResponse, BloodDonorResultItem } from "@/lib/types";
import { Language } from "@/lib/i18n";

interface AIBloodSearchCardProps {
  lang: Language;
  onSelectDonor?: (donor: BloodDonorResultItem) => void;
}

const PRESET_QUERIES_EN = [
  "Need O+ blood in Dhanmondi",
  "Urgently need B+ blood in Mirpur",
  "A- donor near Sylhet",
  "Looking for AB+ blood in Chattogram",
];

const PRESET_QUERIES_BN = [
  "ধানমন্ডিতে জরুরি O+ রক্ত লাগবে",
  "মিরপুরে B+ রক্তদাতার সন্ধান চাই",
  "সিলেটে A- রক্ত প্রয়োজন",
  "জরুরী ও পজিটিভ রক্ত লাগবে",
];

export default function AIBloodSearchCard({ lang, onSelectDonor }: AIBloodSearchCardProps) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BloodAssistantResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const isBn = lang === "bn";
  const presets = isBn ? PRESET_QUERIES_BN : PRESET_QUERIES_EN;

  const handleSearch = async (overrideQuery?: string) => {
    const q = overrideQuery || query;
    if (!q.trim() || loading) return;

    setLoading(true);
    setError(null);
    setIsExpanded(true);

    try {
      const res = await apiFetch<BloodAssistantResponse>("/blood/ai-assistant", {
        method: "POST",
        body: JSON.stringify({
          query: q.trim(),
          lang,
        }),
      });
      setResult(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to search blood donors");
    } finally {
      setLoading(false);
    }
  };

  const handleClarifyBloodGroup = (bg: string) => {
    const refined = `${query} ${bg}`;
    setQuery(refined);
    handleSearch(refined);
  };

  return (
    <div className="rounded-3xl border border-rose-200 dark:border-rose-900/60 bg-gradient-to-b from-rose-50/60 via-white to-white dark:from-rose-950/30 dark:via-zinc-900 dark:to-zinc-900 p-5 sm:p-7 shadow-xs space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-rose-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
            🤖
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <span>{isBn ? "এআই রক্তদাতা অনুসন্ধান" : "AI Blood Donor Discovery"}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-300 font-extrabold uppercase tracking-wider">
                Natural Language
              </span>
            </h2>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              {isBn
                ? "স্বাভাবিক বাংলায় বা ইংরেজিতে লিখুন — ডেটাবেস থেকে প্রস্তুত রক্তদাতাদের তথ্য খুঁজে দেওয়া হবে।"
                : "Type your blood requirement in plain words — searches verified registered donors from the real database."}
            </p>
          </div>
        </div>

        {result && (
          <button
            type="button"
            onClick={() => {
              setResult(null);
              setQuery("");
              setIsExpanded(false);
            }}
            className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 font-semibold self-start sm:self-auto"
          >
            ✕ {isBn ? "রিসেট করুন" : "Clear Search"}
          </button>
        )}
      </div>

      {/* Query Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSearch();
        }}
        className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
      >
        <div className="relative flex-1">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              isBn
                ? "যেমন: ধানমন্ডিতে জরুরি O+ রক্ত লাগবে / Mirpur এ B- রক্তদাতা চাই..."
                : "e.g., I need O positive blood in Dhanmondi / Urgent B- in Mirpur..."
            }
            className="w-full px-4 py-3 pl-10 text-xs sm:text-sm rounded-2xl border border-rose-300/80 dark:border-rose-900 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-rose-600 shadow-2xs font-medium"
          />
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-rose-500 text-sm">
            🔍
          </span>
        </div>

        <button
          type="submit"
          disabled={!query.trim() || loading}
          className="px-6 py-3 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-bold text-xs sm:text-sm rounded-2xl shadow-sm transition disabled:opacity-40 flex items-center justify-center gap-2 shrink-0 cursor-pointer"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>{isBn ? "অনুসন্ধান চলছে..." : "Searching..."}</span>
            </>
          ) : (
            <>
              <span>✨</span>
              <span>{isBn ? "দাতা খুঁজুন" : "Find Donors"}</span>
            </>
          )}
        </button>
      </form>

      {/* Preset Query Chips */}
      {!result && (
        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
          <span className="text-zinc-400 font-semibold">{isBn ? "উদাহরণ:" : "Suggestions:"}</span>
          {presets.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => {
                setQuery(preset);
                handleSearch(preset);
              }}
              className="px-2.5 py-1 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:border-rose-400 text-[11px] font-medium transition cursor-pointer shadow-2xs"
            >
              {preset}
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-xl text-xs text-red-600 dark:text-red-400">
          ⚠️ {error}
        </div>
      )}

      {/* Results View */}
      {isExpanded && result && (
        <div className="pt-3 border-t border-rose-100 dark:border-rose-950/60 space-y-4 animate-in fade-in duration-200">
          {/* Clarification Alert if blood group was missing */}
          {result.is_clarification_needed && (
            <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 rounded-2xl space-y-3">
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold text-xs">
                <span>⚠️</span>
                <span>{result.clarification_question}</span>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                {isBn
                  ? "সঠিক রক্তদাতা খুঁজে পেতে নির্দিষ্ট রক্তের গ্রুপ সিলেক্ট করুন:"
                  : "Please select the exact blood group to search registered donors:"}
              </p>
              <div className="flex flex-wrap gap-2">
                {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((bg) => (
                  <button
                    key={bg}
                    type="button"
                    onClick={() => handleClarifyBloodGroup(bg)}
                    className="px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-900 border border-amber-300 dark:border-amber-700 text-xs font-black text-zinc-900 dark:text-zinc-100 hover:bg-rose-600 hover:text-white hover:border-rose-600 transition cursor-pointer"
                  >
                    {bg}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* AI Grounded Explanation Banner */}
          {!result.is_clarification_needed && (
            <div className="p-4 bg-white dark:bg-zinc-800/60 border border-rose-200/80 dark:border-zinc-800 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-md text-xs font-black bg-rose-600 text-white">
                    {result.parsed_blood_group}
                  </span>
                  {result.parsed_district && (
                    <span className="text-xs font-bold text-zinc-600 dark:text-zinc-300">
                      📍 {result.parsed_district}
                    </span>
                  )}
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    ({result.total_donors_found} {isBn ? "জন প্রস্তুত" : "available"})
                  </span>
                </div>
                <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
                  {result.explanation}
                </p>
              </div>

              {result.total_donors_found === 0 && (
                <Link
                  href={`/blood-help/request?blood_group=${result.parsed_blood_group || ""}&district=${result.parsed_district || ""}`}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 shrink-0"
                >
                  <span>🚨</span>
                  <span>{isBn ? "রক্ত রিকোয়েস্ট পোস্ট করুন" : "Post Blood Request"}</span>
                </Link>
              )}
            </div>
          )}

          {/* Donor Cards Grid */}
          {result.donors && result.donors.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                {isBn ? "নিবন্ধিত সক্রিয় রক্তদাতাগণ:" : "Available Registered Donors:"}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {result.donors.map((donor) => (
                  <div
                    key={donor.donor_id}
                    className="p-3.5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xs flex flex-col justify-between space-y-2.5"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-zinc-900 dark:text-zinc-100 truncate">
                          {donor.display_name}
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-xs font-black bg-rose-600 text-white shrink-0">
                          {donor.blood_group}
                        </span>
                      </div>

                      <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 space-y-0.5">
                        <p>📍 {donor.area}, {donor.district}</p>
                        <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                          ✓ {donor.availability_status === "AVAILABLE" ? (isBn ? "রক্তদানে প্রস্তুত" : "Available to Donate") : donor.availability_status}
                        </p>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs">
                      <span className="text-[11px] text-zinc-500 font-medium">
                        {donor.contact_phone || "In-app request"}
                      </span>
                      {onSelectDonor && (
                        <button
                          type="button"
                          onClick={() => onSelectDonor(donor)}
                          className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 transition cursor-pointer"
                        >
                          {isBn ? "বিস্তারিত" : "Details"}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Medical Disclaimer */}
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 italic pt-1">
            ⚖️ {result.disclaimer}
          </p>
        </div>
      )}
    </div>
  );
}
