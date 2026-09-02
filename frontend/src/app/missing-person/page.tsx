"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { PublicMissingPersonAlertPagination, AlertStatus } from "@/lib/types";
import { translations, Language } from "@/lib/i18n";

export default function MissingPersonsFeedPage() {
  const [lang, setLang] = useState<Language>("en");
  const t = translations[lang];

  const [data, setData] = useState<PublicMissingPersonAlertPagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 12;

  const loadAlerts = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.append("alert_status", statusFilter);
    if (search.trim()) params.append("search", search.trim());
    params.append("limit", PAGE_SIZE.toString());
    params.append("offset", (page * PAGE_SIZE).toString());

    apiFetch<PublicMissingPersonAlertPagination>(`/missing-person/alerts?${params.toString()}`)
      .then((res) => setData(res))
      .catch((err: unknown) => {
        if (err instanceof Error) setError(err.message);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadAlerts();
  }, [statusFilter, search, page]);

  const getStatusBadge = (status: AlertStatus) => {
    switch (status) {
      case "ALERT_ACTIVE":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-3 py-1 text-[11px] font-black text-white shadow-xs animate-pulse">
            🚨 {t.status_active}
          </span>
        );
      case "FOUND":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1 text-[11px] font-black text-white shadow-xs">
            ✅ {t.status_found}
          </span>
        );
      case "EXPIRED":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-zinc-200 dark:bg-zinc-800 px-3 py-1 text-[11px] font-bold text-zinc-700 dark:text-zinc-300">
            ⏳ {t.status_expired}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-950 px-3 py-1 text-[11px] font-bold text-amber-800 dark:text-amber-300">
            🔍 {t.status_pending}
          </span>
        );
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* Top Header & Bilingual Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-red-600 text-white text-xl font-bold shadow-sm">
            🚨
          </span>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">
              {t.missing_person_title}
            </h1>
            <p className="text-xs text-zinc-500">
              {lang === "bn"
                ? "বাংলাদেশ নাগরিক সুরক্ষা নেটওয়ার্ক — যাচাইকৃত নিখোঁজ ব্যক্তি সন্ধান"
                : "Bangladesh Citizen Safety Network — Verified Missing Person Alerts"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
          <Link
            href="/missing-person/create"
            className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 hover:bg-red-500 px-4 py-2 text-xs font-bold text-white transition shadow-sm shrink-0"
          >
            <span>🚨</span>
            <span>{lang === "bn" ? "নিখোঁজ ব্যক্তির তথ্য দিন" : "Report Missing Person"}</span>
          </Link>

          {/* Language Switcher */}
          <div className="inline-flex rounded-xl bg-zinc-100 dark:bg-zinc-800 p-1 border border-zinc-200 dark:border-zinc-700">
            <button
              onClick={() => setLang("en")}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                lang === "en" ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs" : "text-zinc-500 hover:text-zinc-800"
              }`}
            >
              English
            </button>
            <button
              onClick={() => setLang("bn")}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                lang === "bn" ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs" : "text-zinc-500 hover:text-zinc-800"
              }`}
            >
              বাংলা
            </button>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 bg-white dark:bg-zinc-900 p-4 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
        <div className="flex-1">
          <input
            type="text"
            placeholder={lang === "bn" ? "নাম, এলাকা বা পোশাক দিয়ে খুঁজুন..." : "Search by name, location, or clothing..."}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            className="w-full rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-4 py-2.5 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              setStatusFilter("");
              setPage(0);
            }}
            className={`rounded-2xl px-4 py-2 text-xs font-bold transition ${
              statusFilter === ""
                ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-xs"
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200"
            }`}
          >
            {lang === "bn" ? "সকল সতর্কতা" : "All Alerts"}
          </button>
          <button
            onClick={() => {
              setStatusFilter("ALERT_ACTIVE");
              setPage(0);
            }}
            className={`rounded-2xl px-4 py-2 text-xs font-bold transition ${
              statusFilter === "ALERT_ACTIVE"
                ? "bg-red-600 text-white shadow-xs"
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200"
            }`}
          >
            🚨 {lang === "bn" ? "চলমান সন্ধান" : "Active Only"}
          </button>
          <button
            onClick={() => {
              setStatusFilter("FOUND");
              setPage(0);
            }}
            className={`rounded-2xl px-4 py-2 text-xs font-bold transition ${
              statusFilter === "FOUND"
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200"
            }`}
          >
            ✅ {lang === "bn" ? "উদ্ধারকৃত" : "Found"}
          </button>
        </div>
      </div>

      {/* Alerts Grid */}
      {error && (
        <div className="rounded-2xl bg-red-50 dark:bg-red-950/40 p-4 border border-red-200 text-xs text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-red-600 border-t-transparent" />
        </div>
      ) : !data || data.items.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-zinc-300 dark:border-zinc-700 p-12 text-center text-xs text-zinc-500 space-y-3">
          <div className="text-3xl">🕊️</div>
          <p className="font-semibold text-sm">
            {lang === "bn"
              ? "বর্তমানে কোনো সক্রিয় নিখোঁজ ব্যক্তি সতর্কতা নেই।"
              : "No active missing person alerts found matching your criteria."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {data.items.map((alert) => (
            <Link
              key={alert.id}
              href={`/missing-person/${alert.id}`}
              className="group flex flex-col justify-between rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm hover:shadow-md hover:border-red-500/50 transition duration-200"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  {getStatusBadge(alert.status)}
                  {alert.approved_sightings_count > 0 && (
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-md">
                      👁️ {alert.approved_sightings_count} {lang === "bn" ? "তথ্য" : "Sightings"}
                    </span>
                  )}
                </div>

                {/* Photo & Identity */}
                <div className="flex gap-4 items-start">
                  {alert.profile.photo_url ? (
                    <img
                      src={alert.profile.photo_url}
                      alt={alert.profile.full_name}
                      className="h-20 w-20 rounded-2xl object-cover border border-zinc-100 dark:border-zinc-800 shrink-0"
                    />
                  ) : (
                    <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-3xl shrink-0">
                      👤
                    </div>
                  )}

                  <div className="space-y-1">
                    <h3 className="text-base font-extrabold text-zinc-900 dark:text-zinc-100 group-hover:text-red-600 transition">
                      {lang === "bn" && alert.profile.name_bn
                        ? alert.profile.name_bn
                        : alert.profile.full_name}
                    </h3>
                    <div className="flex flex-wrap gap-1.5 text-xs text-zinc-500">
                      {alert.profile.age !== null && alert.profile.age !== undefined && (
                        <span>
                          {t.age}: <strong>{alert.profile.age}</strong>
                        </span>
                      )}
                      {alert.profile.gender && (
                        <span>
                          • {alert.profile.gender}
                        </span>
                      )}
                      {alert.profile.height && (
                        <span>
                          • {alert.profile.height}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Last Seen Info */}
                <div className="rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 p-3 text-xs space-y-1 text-zinc-700 dark:text-zinc-300">
                  <div>
                    <span className="text-zinc-400 font-semibold">{t.last_seen_near}:</span>{" "}
                    <strong>
                      {lang === "bn" && alert.profile.last_seen_location_bn
                        ? alert.profile.last_seen_location_bn
                        : alert.profile.last_seen_location}
                    </strong>
                  </div>
                  {alert.profile.clothing && (
                    <div className="text-[11px] text-zinc-500 line-clamp-1">
                      <span className="font-semibold">{t.clothing}:</span>{" "}
                      {lang === "bn" && alert.profile.clothing_bn
                        ? alert.profile.clothing_bn
                        : alert.profile.clothing}
                    </div>
                  )}
                </div>
              </div>

              {/* Action Prompt */}
              <div className="pt-4 mt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs font-bold text-red-600 dark:text-red-400">
                <span>{t.i_saw_this_person} →</span>
                <span className="text-[11px] text-zinc-400 font-normal">
                  {new Date(alert.created_at).toLocaleDateString()}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
