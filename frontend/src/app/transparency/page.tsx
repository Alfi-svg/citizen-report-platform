"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch, getApiBaseUrl } from "@/lib/api";
import {
  PublicTransparencyOverviewResponse,
} from "@/lib/types";
import { translations, Language } from "@/lib/i18n";

export default function TransparencyDashboardPage() {
  const [lang, setLang] = useState<Language>("en");
  const [data, setData] = useState<PublicTransparencyOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [monthlyViewMode, setMonthlyViewMode] = useState<"CHART" | "TABLE">("CHART");
  const [hoveredMonthIdx, setHoveredMonthIdx] = useState<number | null>(null);

  // Sync language with global app storage & event
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

  const loadData = () => {
    setLoading(true);
    apiFetch<PublicTransparencyOverviewResponse>("/analytics/overview")
      .then((res) => {
        setData(res);
        setError(null);
      })
      .catch((err: unknown) => {
        if (err instanceof Error) setError(err.message);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleExport = (format: "csv" | "json") => {
    const apiUrl = getApiBaseUrl();
    window.open(`${apiUrl}/analytics/export?format=${format}&year=${selectedYear}`, "_blank");
  };

  const t = translations[lang];
  const isBn = lang === "bn";

  if (loading && !data) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
          <p className="text-xs font-bold text-zinc-500">
            {isBn ? "স্বচ্ছতা ও পরিসংখ্যান লোড হচ্ছে..." : "Loading civic transparency analytics..."}
          </p>
        </div>
      </div>
    );
  }

  const kpis = data?.kpis;
  const monthly = data?.monthly;
  const yearly = data?.yearly;
  const catAnalytics = data?.categories;
  const geography = data?.geography;
  const dataSource = data?.data_source;

  // Max count for SVG line chart scaling
  const maxMonthlyCount = monthly
    ? Math.max(1, ...monthly.monthly_data.map((m) => m.count))
    : 10;

  // Clear wording helper for trends: Never "Crime increased", always "Platform reports increased"
  const getTrendWording = (trend: string, defaultLabel: string) => {
    if (isBn) {
      if (trend === "INCREASED") return "প্ল্যাটফর্ম-রিপোর্ট বৃদ্ধি পেয়েছে";
      if (trend === "DECREASED") return "প্ল্যাটফর্ম-রিপোর্ট হ্রাস পেয়েছে";
      if (trend === "STABLE") return "স্থিতিশীল";
      return "অপর্যাপ্ত তথ্য";
    }
    if (trend === "INCREASED") return "Platform reports increased";
    if (trend === "DECREASED") return "Platform reports decreased";
    if (trend === "STABLE") return "Stable";
    return defaultLabel || "Insufficient Data";
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-6">
        <div className="flex items-center gap-3.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-xl font-bold border border-zinc-200 dark:border-zinc-700 shadow-2xs">
            📊
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">
              {isBn ? "স্বচ্ছতা" : "Transparency"}
            </h1>
            <p className="text-xs text-zinc-500 mt-0.5 max-w-xl">
              {isBn
                ? "সারাদেশের প্ল্যাটফর্ম-যাচাইকৃত নাগরিক প্রতিবেদনের বিভিন্ন ধরন ও পরিসংখ্যান জানুন।"
                : "Understand patterns in platform-reviewed citizen reports across Bangladesh."}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Export Actions */}
          <button
            onClick={() => handleExport("csv")}
            className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-xs font-bold text-zinc-700 dark:text-zinc-300 shadow-2xs hover:bg-zinc-50 dark:hover:bg-zinc-700 transition flex items-center gap-1.5 cursor-pointer"
            title="Download CSV dataset"
          >
            <span>📥</span>
            <span>CSV</span>
          </button>
          <button
            onClick={() => handleExport("json")}
            className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-xs font-bold text-zinc-700 dark:text-zinc-300 shadow-2xs hover:bg-zinc-50 dark:hover:bg-zinc-700 transition cursor-pointer"
            title="Download JSON dataset"
          >
            JSON
          </button>

          {/* Bilingual Switcher */}
          <div className="inline-flex rounded-xl bg-zinc-100 dark:bg-zinc-800 p-1 border border-zinc-200 dark:border-zinc-700">
            <button
              onClick={() => changeLanguage("en")}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                lang === "en"
                  ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-2xs"
                  : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
            >
              English
            </button>
            <button
              onClick={() => changeLanguage("bn")}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                lang === "bn"
                  ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-2xs"
                  : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
            >
              বাংলা
            </button>
          </div>
        </div>
      </div>

      {/* 2. Methodology / Disclaimer Notice (Calm & Professional, Not Error-looking) */}
      <div className="rounded-2xl bg-zinc-50 dark:bg-zinc-900/80 p-4 sm:p-5 border border-zinc-200 dark:border-zinc-800 shadow-2xs space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-bold text-zinc-800 dark:text-zinc-200">
            <span>⚖️</span>
            <span>{isBn ? "পদ্ধতি ও নাগরিক সতর্কবার্তা" : "Methodology & Civic Disclaimer"}</span>
          </div>
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200/60 dark:border-emerald-900/60">
            ✓ {isBn ? "১০০% প্ল্যাটফর্ম যাচাইকৃত" : "100% Platform Reviewed"}
          </span>
        </div>

        <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-300 font-normal">
          {isBn
            ? "এই পরিসংখ্যানসমূহ শুধুমাত্র প্ল্যাটফর্ম কর্তৃক পর্যালোচিত ও অনুমোদিত নাগরিক প্রতিবেদনের উপর ভিত্তি করে তৈরি এবং এগুলো কোনোভাবেই সরকারি আনুষ্ঠানিক অপরাধ পরিসংখ্যান নয়।"
            : "These figures represent platform-reviewed citizen reports and are not official government crime statistics."}
        </p>

        <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-zinc-500 border-t border-zinc-200/60 dark:border-zinc-800/60">
          <span>
            <strong>{isBn ? "উৎস:" : "Source:"}</strong>{" "}
            {isBn && dataSource?.source_name_bn ? dataSource.source_name_bn : (dataSource?.source_name || "Platform Reviewed Reports")}
          </span>
          <span>•</span>
          <span>
            <strong>{isBn ? "সর্বশেষ হালনাগাদ:" : "Last Updated:"}</strong>{" "}
            {data ? new Date(data.last_updated_at).toLocaleString() : (isBn ? "রিয়েল-টাইম" : "Real-time")}
          </span>
          {monthly?.sample_size_note && (
            <>
              <span>•</span>
              <span className="italic">{monthly.sample_size_note}</span>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-2xl bg-red-50 dark:bg-red-950/40 p-4 border border-red-200 text-xs text-red-700">
          {error}
        </div>
      )}

      {/* 3. Key Statistics (Compact Statistic Blocks) */}
      {kpis && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-2xs space-y-1">
            <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block">
              {t.kpi_total_reports}
            </span>
            <div className="text-2xl sm:text-3xl font-black text-emerald-700 dark:text-emerald-400">
              {kpis.total_reviewed_reports}
            </div>
            <span className="text-[10px] text-zinc-400 block">
              {isBn ? "যাচাইকৃত ও অনুমোদিত" : "Moderated & Approved"}
            </span>
          </div>

          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-2xs space-y-1">
            <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block">
              {t.kpi_this_month}
            </span>
            <div className="text-2xl sm:text-3xl font-black text-blue-600 dark:text-blue-400">
              {kpis.reports_this_month}
            </div>
            <span className="text-[10px] text-zinc-400 block">
              {isBn ? "চলতি ক্যালেন্ডার মাস" : "Current calendar month"}
            </span>
          </div>

          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-2xs space-y-1">
            <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block">
              {t.kpi_this_year}
            </span>
            <div className="text-2xl sm:text-3xl font-black text-indigo-600 dark:text-indigo-400">
              {kpis.reports_this_year}
            </div>
            <span className="text-[10px] text-zinc-400 block">
              {isBn ? `বছর ${new Date().getFullYear()}` : `Year ${new Date().getFullYear()}`}
            </span>
          </div>

          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-2xs space-y-1">
            <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block">
              {t.kpi_active_missing}
            </span>
            <div className="text-2xl sm:text-3xl font-black text-red-600 dark:text-red-400">
              {kpis.active_missing_alerts}
            </div>
            <span className="text-[10px] text-zinc-400 block">
              {isBn ? "সক্রিয় অনুসন্ধান সতর্কতা" : "Active community alerts"}
            </span>
          </div>

          <div className="col-span-2 sm:col-span-1 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-2xs space-y-1">
            <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block">
              {t.kpi_districts}
            </span>
            <div className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400">
              {kpis.total_districts}
            </div>
            <span className="text-[10px] text-zinc-400 block">
              {isBn ? "সারাদেশে কভারেজ" : "Across Bangladesh"}
            </span>
          </div>
        </div>
      )}

      {/* 4. Trend Overview (Primary Visual Element) */}
      {monthly && (
        <section className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 sm:p-7 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-100 dark:border-zinc-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-extrabold text-zinc-900 dark:text-zinc-100">
                  {t.monthly_trend_title} ({monthly.year})
                </h2>
                <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                  {isBn ? "মাসিক গতিধারা" : "Monthly Series"}
                </span>
              </div>
              <p className="text-xs text-zinc-500 mt-0.5">
                {t.monthly_trend_subtitle}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-2.5 py-1.5 text-xs font-bold text-zinc-700 dark:text-zinc-300 shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 cursor-pointer"
                title={isBn ? "বছর নির্বাচন করুন" : "Select year"}
              >
                {[new Date().getFullYear(), new Date().getFullYear() - 1, new Date().getFullYear() - 2].map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => setMonthlyViewMode("CHART")}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                  monthlyViewMode === "CHART"
                    ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-2xs"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200"
                }`}
              >
                📈 {t.chart_view}
              </button>
              <button
                type="button"
                onClick={() => setMonthlyViewMode("TABLE")}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                  monthlyViewMode === "TABLE"
                    ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-2xs"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200"
                }`}
              >
                📋 {t.table_view}
              </button>
            </div>
          </div>

          {monthlyViewMode === "CHART" ? (
            <div className="space-y-4">
              {/* Responsive SVG Line Chart with Tooltip & Gridlines */}
              <div className="relative w-full h-64 bg-zinc-50/70 dark:bg-zinc-800/30 rounded-2xl p-4 border border-zinc-100 dark:border-zinc-800 flex items-end">
                <svg className="w-full h-full overflow-visible" viewBox="0 0 1200 200" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="transparencyGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#059669" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#059669" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal Grid lines with counts */}
                  <line x1="0" y1="40" x2="1200" y2="40" stroke="#e4e4e7" strokeDasharray="4 4" className="dark:stroke-zinc-750" />
                  <line x1="0" y1="90" x2="1200" y2="90" stroke="#e4e4e7" strokeDasharray="4 4" className="dark:stroke-zinc-750" />
                  <line x1="0" y1="140" x2="1200" y2="140" stroke="#e4e4e7" strokeDasharray="4 4" className="dark:stroke-zinc-750" />
                  <line x1="0" y1="180" x2="1200" y2="180" stroke="#d4d4d8" className="dark:stroke-zinc-700" />

                  {/* Area fill */}
                  <polygon
                    points={`0,180 ${monthly.monthly_data.map((m, idx) => `${idx * 100 + 50},${180 - (m.count / maxMonthlyCount) * 140}`).join(" ")} 1150,180`}
                    fill="url(#transparencyGradient)"
                  />

                  {/* Line stroke */}
                  <polyline
                    fill="none"
                    stroke="#059669"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={monthly.monthly_data.map((m, idx) => `${idx * 100 + 50},${180 - (m.count / maxMonthlyCount) * 140}`).join(" ")}
                  />

                  {/* Interactive Data Points */}
                  {monthly.monthly_data.map((m, idx) => {
                    const cx = idx * 100 + 50;
                    const cy = 180 - (m.count / maxMonthlyCount) * 140;
                    const isHovered = hoveredMonthIdx === idx;
                    return (
                      <g
                        key={m.month}
                        onMouseEnter={() => setHoveredMonthIdx(idx)}
                        onMouseLeave={() => setHoveredMonthIdx(null)}
                        className="cursor-pointer transition-all duration-150"
                      >
                        {/* Hover halo */}
                        {isHovered && (
                          <circle cx={cx} cy={cy} r="12" fill="#059669" fillOpacity="0.2" />
                        )}
                        <circle
                          cx={cx}
                          cy={cy}
                          r={isHovered ? 7 : 5.5}
                          fill="#059669"
                          stroke="white"
                          strokeWidth="2.5"
                          className="transition-all"
                        />
                        <text
                          x={cx}
                          y={cy - 12}
                          textAnchor="middle"
                          fontSize={isHovered ? "13" : "11"}
                          fontWeight="bold"
                          fill={isHovered ? "#047857" : "#059669"}
                          className="dark:fill-emerald-400"
                        >
                          {m.count}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>

              {/* Month Labels Strip */}
              <div className="grid grid-cols-12 text-center text-[11px] font-semibold text-zinc-500">
                {monthly.monthly_data.map((m, idx) => (
                  <button
                    key={m.month}
                    type="button"
                    onMouseEnter={() => setHoveredMonthIdx(idx)}
                    onMouseLeave={() => setHoveredMonthIdx(null)}
                    className={`truncate transition-colors cursor-pointer ${
                      hoveredMonthIdx === idx ? "text-emerald-700 dark:text-emerald-400 font-bold" : ""
                    }`}
                  >
                    {isBn ? m.month_name_bn.slice(0, 4) : m.month_name.slice(0, 3)}
                  </button>
                ))}
              </div>

              {/* Hover Tooltip / Detail Box */}
              {hoveredMonthIdx !== null && monthly.monthly_data[hoveredMonthIdx] && (
                <div className="rounded-xl bg-zinc-100 dark:bg-zinc-800 p-3 text-xs flex flex-wrap items-center justify-between gap-2 border border-zinc-200 dark:border-zinc-700 animate-in fade-in duration-100">
                  <span className="font-bold text-zinc-900 dark:text-zinc-100">
                    📅 {isBn ? monthly.monthly_data[hoveredMonthIdx].month_name_bn : monthly.monthly_data[hoveredMonthIdx].month_name} {monthly.year}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="font-extrabold text-emerald-700 dark:text-emerald-400">
                      {monthly.monthly_data[hoveredMonthIdx].count} {isBn ? "টি রিপোর্ট" : "Reports"}
                    </span>
                    <span className="text-zinc-500">
                      {getTrendWording(monthly.monthly_data[hoveredMonthIdx].trend, monthly.monthly_data[hoveredMonthIdx].trend_label)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Accessible Data Table */
            <div className="overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800">
              <table className="w-full text-left text-xs text-zinc-700 dark:text-zinc-300">
                <thead className="bg-zinc-50 dark:bg-zinc-800 font-semibold text-zinc-900 dark:text-zinc-100">
                  <tr>
                    <th className="p-3.5">{t.month_col}</th>
                    <th className="p-3.5">{t.reports_col}</th>
                    <th className="p-3.5">{t.change_col}</th>
                    <th className="p-3.5">{t.trend_col}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {monthly.monthly_data.map((m) => (
                    <tr key={m.month} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                      <td className="p-3.5 font-bold text-zinc-900 dark:text-zinc-100">
                        {isBn ? m.month_name_bn : m.month_name}
                      </td>
                      <td className="p-3.5 font-semibold text-emerald-700 dark:text-emerald-400">{m.count}</td>
                      <td className="p-3.5 text-zinc-600 dark:text-zinc-400">
                        {m.percentage_change !== null && m.percentage_change !== undefined ? `${m.percentage_change > 0 ? "+" : ""}${m.percentage_change}%` : "—"}
                      </td>
                      <td className="p-3.5">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          m.trend === "INCREASED" ? "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300" : m.trend === "DECREASED" ? "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300" : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                        }`}>
                          {getTrendWording(m.trend, m.trend_label)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* 4.5. Year-over-Year Trend Comparison */}
      {yearly && yearly.yearly_data.length > 0 && (
        <section className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 sm:p-7 shadow-xs space-y-4">
          <div>
            <h2 className="text-lg font-extrabold text-zinc-900 dark:text-zinc-100">
              {isBn ? "বাৎসরিক রিপোর্ট প্রবণতা ও তুলনা" : "Year-over-Year Report Trends"}
            </h2>
            <p className="text-xs text-zinc-500">
              {isBn ? "পূর্ববর্তী বছরের সাথে যাচাইকৃত রিপোর্টের তুলনামূলক পরিসংখ্যান" : "Platform-reviewed civic submissions compared across operational years"}
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            {yearly.yearly_data.map((y) => (
              <div key={y.year} className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 p-4 space-y-1">
                <span className="text-xs font-extrabold text-zinc-500 uppercase tracking-wider">{y.year}</span>
                <div className="text-2xl font-black text-zinc-900 dark:text-zinc-100">{y.count}</div>
                <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                  {y.percentage_change !== null && y.percentage_change !== undefined ? (
                    <span>{y.percentage_change > 0 ? `+${y.percentage_change}%` : `${y.percentage_change}%`}</span>
                  ) : (
                    <span className="text-zinc-400">Baseline</span>
                  )}
                  <span className="text-zinc-400 font-normal">({getTrendWording(y.trend, y.trend_label)})</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 5. Category Analysis */}
      {catAnalytics && (
        <section className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 sm:p-7 shadow-xs space-y-6">
          <div>
            <h2 className="text-lg font-extrabold text-zinc-900 dark:text-zinc-100">
              {t.category_analysis_title}
            </h2>
            <p className="text-xs text-zinc-500">
              {t.category_analysis_subtitle}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Horizontal Bar Visuals */}
            <div className="space-y-3.5">
              {catAnalytics.categories.slice(0, 8).map((cat) => (
                <div key={cat.category_id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-zinc-800 dark:text-zinc-200">{cat.category_name}</span>
                    <span className="text-zinc-500 font-semibold">{cat.count} ({cat.percentage_share}%)</span>
                  </div>
                  <div className="h-2.5 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-600 rounded-full transition-all"
                      style={{ width: `${Math.max(4, cat.percentage_share)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Category Summary Table */}
            <div className="overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800 max-h-80 overflow-y-auto">
              <table className="w-full text-left text-xs text-zinc-700 dark:text-zinc-300">
                <thead className="bg-zinc-50 dark:bg-zinc-800 font-semibold text-zinc-900 dark:text-zinc-100 sticky top-0">
                  <tr>
                    <th className="p-3">{t.category_col}</th>
                    <th className="p-3">{t.reports_col}</th>
                    <th className="p-3">{t.share_col}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {catAnalytics.categories.map((c) => (
                    <tr key={c.category_id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                      <td className="p-3 font-semibold text-zinc-900 dark:text-zinc-100">{c.category_name}</td>
                      <td className="p-3 font-bold text-emerald-700 dark:text-emerald-400">{c.count}</td>
                      <td className="p-3 text-zinc-500">{c.percentage_share}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* 6. Bangladesh Geographic Aggregations */}
      {geography && (
        <section className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 sm:p-7 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-lg font-extrabold text-zinc-900 dark:text-zinc-100">
                {t.geography_title}
              </h2>
              <p className="text-xs text-zinc-500">
                {t.geography_subtitle}
              </p>
            </div>

            <Link
              href="/safety-map"
              className="rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-bold text-white shadow-2xs transition inline-flex items-center gap-1.5 cursor-pointer"
            >
              <span>🗺️</span>
              <span>{isBn ? "কমিউনিটি সেফটি ম্যাপ দেখুন" : "Open Community Safety Map"} →</span>
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            {geography.divisions.map((div) => (
              <div
                key={div.division}
                className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 p-4 space-y-1"
              >
                <div className="text-xs font-extrabold text-zinc-800 dark:text-zinc-200">{div.division}</div>
                <div className="text-lg font-black text-emerald-700 dark:text-emerald-400">{div.report_count}</div>
                <div className="text-[10px] text-zinc-400">
                  {div.percentage_share}% {isBn ? "প্ল্যাটফর্মের মোট শেয়ার" : "of platform total"}
                </div>
              </div>
            ))}
          </div>

          <p className="text-[11px] text-zinc-400">
            🔒 {isBn
              ? "প্রশাসনিক বিভাগ ও জেলা পর্যায়ে সংরক্ষিত। ব্যক্তিগত স্থানাঙ্ক আনুমানিক (~১১০ মিটার গ্রিডে) সীমাবদ্ধ।"
              : "Aggregated at administrative division & district level. Coordinates are fuzzed (~110m grid) for public privacy."}
          </p>
        </section>
      )}

      {/* 7. Methodology & Data Quality */}
      <section className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 sm:p-7 shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-xl">📖</span>
          <h2 className="text-lg font-extrabold text-zinc-900 dark:text-zinc-100">
            {t.methodology_title}
          </h2>
        </div>
        <p className="text-xs text-zinc-500">
          {t.methodology_subtitle}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
          <div className="rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 p-4 border border-zinc-100 dark:border-zinc-800 space-y-1.5">
            <h3 className="font-extrabold text-zinc-900 dark:text-zinc-100">
              1. {isBn ? "প্ল্যাটফর্ম-যাচাইকৃত অবস্থা" : "Platform-Reviewed Status"}
            </h3>
            <p>
              {isBn
                ? "শুধুমাত্র অনুমোদিত (status = APPROVED) রিপোর্টসমূহ গণপরিসংখ্যানে অন্তর্ভুক্ত। যাচাইবিহীন বা ড্রাফট তথ্য কঠোরভাবে বাদ দেওয়া হয়।"
                : "Only reports with status = APPROVED that have been verified by administrators are included in public analytics. Unverified submissions and drafts are strictly excluded."}
            </p>
          </div>

          <div className="rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 p-4 border border-zinc-100 dark:border-zinc-800 space-y-1.5">
            <h3 className="font-extrabold text-zinc-900 dark:text-zinc-100">
              2. {isBn ? "গোপনীয়তা ও স্থানাঙ্ক সুরক্ষা" : "Privacy & Coordinate Fuzzing"}
            </h3>
            <p>
              {isBn
                ? "ভৌগোলিক স্থানাঙ্ক আনুমানিক ~১১০ মিটার গ্রিডে ফাজ করা হয়। কোনো আবাসিক বাসা, ব্যক্তিগত নম্বর বা গোপনীয় তথ্য প্রকাশ করা হয় না।"
                : "Geographic coordinates are rounded to an approximate ~110m grid. Exact residential points, private reporter identities, and confidential evidence attachments are never published."}
            </p>
          </div>

          <div className="rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 p-4 border border-zinc-100 dark:border-zinc-800 space-y-1.5">
            <h3 className="font-extrabold text-zinc-900 dark:text-zinc-100">
              3. {isBn ? "সরকারি অপরাধ পরিসংখ্যান থেকে পার্থক্য" : "Distinction from Official Statistics"}
            </h3>
            <p>
              {isBn
                ? "এই পরিসংখ্যান নাগরিক সচেতনতামূলক উদ্যোগ। এটি কোনো আনুষ্ঠানিক পুলিশ বা বিচার বিভাগীয় অপরাধ পরিসংখ্যানের বিকল্প নয়।"
                : "These figures represent civic reports received by this platform. They do not constitute official police or court crime statistics and should not be used as legal proof of alleged offences."}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
