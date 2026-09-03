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

  // Sync language with global storage & event
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

  const t = translations[lang];

  const [data, setData] = useState<PublicTransparencyOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedYear] = useState<number>(new Date().getFullYear());
  const [monthlyViewMode, setMonthlyViewMode] = useState<"CHART" | "TABLE">("CHART");

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

  if (loading && !data) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
          <p className="text-xs font-bold text-zinc-500">Loading civic transparency analytics...</p>
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

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* 1. Header & Language Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-6">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-3xl bg-blue-600 text-white text-2xl font-bold shadow-sm">
            📊
          </span>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">
              {t.transparency_title}
            </h1>
            <p className="text-xs text-zinc-500 mt-0.5">
              {t.transparency_subtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Export Dropdown / Buttons */}
          <button
            type="button"
            onClick={() => handleExport("csv")}
            className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300 shadow-2xs hover:bg-zinc-50 transition flex items-center gap-1.5 cursor-pointer"
          >
            <span>📥</span>
            <span>{t.export_csv}</span>
          </button>
          <button
            type="button"
            onClick={() => handleExport("json")}
            className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300 shadow-2xs hover:bg-zinc-50 transition cursor-pointer"
          >
            JSON
          </button>
        </div>
      </div>

      {/* 2. Mandatory Transparency Principle Notice */}
      <div className="rounded-3xl bg-amber-50 dark:bg-amber-950/40 p-5 border border-amber-200 dark:border-amber-900/60 shadow-xs space-y-2">
        <div className="flex items-center gap-2 text-xs font-extrabold text-amber-900 dark:text-amber-200 uppercase tracking-wider">
          <span>⚖️</span>
          <span>{lang === "bn" ? "নাগরিক স্বচ্ছতা নীতি ও সতর্কবার্তা" : "Civic Transparency Principle & Notice"}</span>
        </div>
        <p className="text-xs leading-relaxed text-amber-950 dark:text-amber-100 font-medium">
          {t.transparency_disclaimer}
        </p>
        <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-amber-800/80 dark:text-amber-300/80">
          <span>🏷️ <strong>Source:</strong> {lang === "bn" && dataSource?.source_name_bn ? dataSource.source_name_bn : (dataSource?.source_name || "Platform Verified Reports")}</span>
          <span>•</span>
          <span>🕒 <strong>Last Updated:</strong> {data ? new Date(data.last_updated_at).toLocaleString() : "Real-time"}</span>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl bg-red-50 dark:bg-red-950/40 p-4 border border-red-200 text-xs text-red-700">
          {error}
        </div>
      )}

      {/* 3. Core KPI Overview Cards */}
      {kpis && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5 sm:gap-4">
          <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-xs space-y-1">
            <span className="text-xs font-semibold text-zinc-500 block">{t.kpi_total_reports}</span>
            <div className="text-2xl sm:text-3xl font-black text-emerald-600">{kpis.total_reviewed_reports}</div>
            <span className="text-[10px] text-zinc-400">100% Moderated & Approved</span>
          </div>

          <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-xs space-y-1">
            <span className="text-xs font-semibold text-zinc-500 block">{t.kpi_this_month}</span>
            <div className="text-2xl sm:text-3xl font-black text-blue-600">{kpis.reports_this_month}</div>
            <span className="text-[10px] text-zinc-400">Current calendar month</span>
          </div>

          <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-xs space-y-1">
            <span className="text-xs font-semibold text-zinc-500 block">{t.kpi_this_year}</span>
            <div className="text-2xl sm:text-3xl font-black text-indigo-600">{kpis.reports_this_year}</div>
            <span className="text-[10px] text-zinc-400">Year {new Date().getFullYear()}</span>
          </div>

          <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-xs space-y-1">
            <span className="text-xs font-semibold text-zinc-500 block">{t.kpi_active_missing}</span>
            <div className="text-2xl sm:text-3xl font-black text-red-600">{kpis.active_missing_alerts}</div>
            <span className="text-[10px] text-zinc-400">Verified community alerts</span>
          </div>

          <div className="col-span-2 sm:col-span-1 rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-xs space-y-1">
            <span className="text-xs font-semibold text-zinc-500 block">{t.kpi_districts}</span>
            <div className="text-2xl sm:text-3xl font-black text-amber-600">{kpis.total_districts}</div>
            <span className="text-[10px] text-zinc-400">Across Bangladesh</span>
          </div>
        </div>
      )}

      {/* 4. Monthly Report Time-Series Analysis */}
      {monthly && (
        <section className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-100 dark:border-zinc-800 pb-4">
            <div>
              <h2 className="text-lg font-extrabold text-zinc-900 dark:text-zinc-100">
                {t.monthly_trend_title} ({monthly.year})
              </h2>
              <p className="text-xs text-zinc-500">
                {t.monthly_trend_subtitle}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setMonthlyViewMode("CHART")}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                  monthlyViewMode === "CHART" ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600"
                }`}
              >
                📈 {t.chart_view}
              </button>
              <button
                onClick={() => setMonthlyViewMode("TABLE")}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                  monthlyViewMode === "TABLE" ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600"
                }`}
              >
                📋 {t.table_view}
              </button>
            </div>
          </div>

          {monthlyViewMode === "CHART" ? (
            <div className="space-y-4">
              {/* Responsive SVG Line Chart */}
              <div className="relative w-full h-64 bg-zinc-50 dark:bg-zinc-800/40 rounded-2xl p-4 border border-zinc-100 dark:border-zinc-800 flex items-end">
                <svg className="w-full h-full overflow-visible" viewBox="0 0 1200 200" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="chartGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#059669" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#059669" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal Grid lines */}
                  <line x1="0" y1="50" x2="1200" y2="50" stroke="#e4e4e7" strokeDasharray="4 4" className="dark:stroke-zinc-700" />
                  <line x1="0" y1="100" x2="1200" y2="100" stroke="#e4e4e7" strokeDasharray="4 4" className="dark:stroke-zinc-700" />
                  <line x1="0" y1="150" x2="1200" y2="150" stroke="#e4e4e7" strokeDasharray="4 4" className="dark:stroke-zinc-700" />

                  {/* Area fill */}
                  <polygon
                    points={`0,180 ${monthly.monthly_data.map((m, idx) => `${idx * 100 + 50},${180 - (m.count / maxMonthlyCount) * 140}`).join(" ")} 1150,180`}
                    fill="url(#chartGrad)"
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

                  {/* Data Points */}
                  {monthly.monthly_data.map((m, idx) => {
                    const cx = idx * 100 + 50;
                    const cy = 180 - (m.count / maxMonthlyCount) * 140;
                    return (
                      <g key={m.month}>
                        <circle cx={cx} cy={cy} r="6" fill="#059669" stroke="white" strokeWidth="2.5" />
                        <text x={cx} y={cy - 12} textAnchor="middle" fontSize="11" fontWeight="bold" fill="#059669">
                          {m.count}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>

              {/* Month Labels */}
              <div className="grid grid-cols-12 text-center text-[10px] font-semibold text-zinc-500">
                {monthly.monthly_data.map((m) => (
                  <div key={m.month} className="truncate">
                    {lang === "bn" ? m.month_name_bn.slice(0, 4) : m.month_name.slice(0, 3)}
                  </div>
                ))}
              </div>

              <div className="text-[11px] text-zinc-400 italic">
                ℹ️ {monthly.sample_size_note}
              </div>
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
                        {lang === "bn" ? m.month_name_bn : m.month_name}
                      </td>
                      <td className="p-3.5 font-semibold text-emerald-600">{m.count}</td>
                      <td className="p-3.5 text-zinc-600 dark:text-zinc-400">
                        {m.percentage_change !== null && m.percentage_change !== undefined ? `${m.percentage_change > 0 ? "+" : ""}${m.percentage_change}%` : "—"}
                      </td>
                      <td className="p-3.5">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          m.trend === "INCREASED" ? "bg-amber-100 text-amber-800" : m.trend === "DECREASED" ? "bg-blue-100 text-blue-800" : "bg-zinc-100 text-zinc-700"
                        }`}>
                          {lang === "bn" ? m.trend_label_bn : m.trend_label}
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
        <section className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 sm:p-8 shadow-sm space-y-4">
          <div>
            <h2 className="text-lg font-extrabold text-zinc-900 dark:text-zinc-100">
              {lang === "bn" ? "বার্ষিক রিপোর্ট প্রবণতা ও তুলনা" : "Year-over-Year Report Trends"}
            </h2>
            <p className="text-xs text-zinc-500">
              {lang === "bn" ? "পূর্ববর্তী বছরের সাথে যাচাইকৃত রিপোর্টের তুলনামূলক পরিসংখ্যান" : "Platform-reviewed civic submissions compared across operational years"}
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            {yearly.yearly_data.map((y) => (
              <div key={y.year} className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 p-4 space-y-1">
                <span className="text-xs font-extrabold text-zinc-500 uppercase tracking-wider">{y.year}</span>
                <div className="text-2xl font-black text-zinc-900 dark:text-zinc-100">{y.count}</div>
                <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                  {y.percentage_change !== null && y.percentage_change !== undefined ? (
                    <span>{y.percentage_change > 0 ? `+${y.percentage_change}%` : `${y.percentage_change}%`}</span>
                  ) : (
                    <span className="text-zinc-400">Baseline</span>
                  )}
                  <span className="text-zinc-400 font-normal">({lang === "bn" ? y.trend_label_bn : y.trend_label})</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 5. Category Breakdown & Share Analysis */}
      {catAnalytics && (
        <section className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 sm:p-8 shadow-sm space-y-6">
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
                      className="h-full bg-emerald-600 rounded-full"
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
                    <tr key={c.category_id}>
                      <td className="p-3 font-semibold text-zinc-900 dark:text-zinc-100">{c.category_name}</td>
                      <td className="p-3 font-bold text-emerald-600">{c.count}</td>
                      <td className="p-3 text-zinc-500">{c.percentage_share}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* 6. Bangladesh Geographic Aggregations & Map Mode Link */}
      {geography && (
        <section className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 sm:p-8 shadow-sm space-y-6">
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
              className="rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-bold text-white shadow-xs transition inline-flex items-center gap-1.5"
            >
              <span>🗺️</span>
              <span>{lang === "bn" ? "কমিউনিটি সেফটি ম্যাপ দেখুন" : "Open Community Safety Map"} →</span>
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            {geography.divisions.map((div) => (
              <div
                key={div.division}
                className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 p-4 space-y-1"
              >
                <div className="text-xs font-extrabold text-zinc-800 dark:text-zinc-200">{div.division}</div>
                <div className="text-lg font-black text-emerald-600">{div.report_count}</div>
                <div className="text-[10px] text-zinc-400">{div.percentage_share}% of platform total</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 7. Transparency Methodology & Civic Guardrails Section */}
      <section className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 sm:p-8 shadow-sm space-y-4">
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
              1. Platform-Reviewed Status
            </h3>
            <p>
              Only reports with <code>status = APPROVED</code> that have been verified by administrators are included in public analytics. Unverified submissions and drafts are strictly excluded.
            </p>
          </div>

          <div className="rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 p-4 border border-zinc-100 dark:border-zinc-800 space-y-1.5">
            <h3 className="font-extrabold text-zinc-900 dark:text-zinc-100">
              2. Privacy & Coordinate Fuzzing
            </h3>
            <p>
              Geographic coordinates are rounded to an approximate ~110m grid. Exact residential points, private reporter identities, and confidential evidence attachments are never published.
            </p>
          </div>

          <div className="rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 p-4 border border-zinc-100 dark:border-zinc-800 space-y-1.5">
            <h3 className="font-extrabold text-zinc-900 dark:text-zinc-100">
              3. Distinction from Official Statistics
            </h3>
            <p>
              These figures represent civic reports received by this platform. They do not constitute official police or court crime statistics and should not be used as legal proof of alleged offences.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
