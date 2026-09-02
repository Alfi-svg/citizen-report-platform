"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { PublicCategory, PublicReportPagination } from "@/lib/types";
import PublicReportCard from "@/components/PublicReportCard";

export default function HomePage() {
  const { isAuthenticated, user } = useAuth();

  const [categories, setCategories] = useState<PublicCategory[]>([]);
  const [data, setData] = useState<PublicReportPagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & State
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeSearch, setActiveSearch] = useState<string>("");
  const [locationQuery, setLocationQuery] = useState<string>("");
  const [activeLocation, setActiveLocation] = useState<string>("");
  const [sortOrder, setSortOrder] = useState<"latest" | "trending">("latest");
  const [page, setPage] = useState<number>(0);
  const PAGE_SIZE = 9;

  // Load public categories
  useEffect(() => {
    let isMounted = true;
    apiFetch<PublicCategory[]>("/public/categories")
      .then((cats) => {
        if (isMounted) setCategories(cats);
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch approved feed
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    const params = new URLSearchParams();
    params.append("sort", sortOrder);
    if (selectedCategory) params.append("category_id", selectedCategory);
    if (activeLocation.trim()) params.append("location", activeLocation.trim());
    if (activeSearch.trim()) params.append("q", activeSearch.trim());
    params.append("limit", PAGE_SIZE.toString());
    params.append("offset", (page * PAGE_SIZE).toString());

    apiFetch<PublicReportPagination>(`/public/reports?${params.toString()}`)
      .then((res) => {
        if (isMounted) {
          setData(res);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (isMounted && err instanceof Error) setError(err.message);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [sortOrder, selectedCategory, activeLocation, activeSearch, page]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    setActiveSearch(searchQuery);
    setActiveLocation(locationQuery);
  };

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 1;

  return (
    <div className="space-y-10">
      {/* 1. Brand Hero Section with Bangladesh Artwork */}
      <section className="relative overflow-hidden bg-zinc-950 text-white">
        {/* Background Image with Dark Emerald Overlay */}
        <div className="absolute inset-0 z-0">
          <Image
            src="/brand/bangladesh-hero-bg.jpg"
            alt="Bangladesh National Monument and Heritage"
            fill
            className="object-cover object-center opacity-35"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/80 to-emerald-950/70" />
        </div>

        {/* Hero Content */}
        <div className="relative z-10 mx-auto max-w-5xl px-4 py-12 sm:py-20 text-center space-y-5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 backdrop-blur-xs">
            <span>🛡️</span>
            <span>Platform-Verified Citizen Reporting • বাংলাদেশ</span>
          </div>

          <div className="mx-auto h-16 w-16 sm:h-20 sm:w-20 relative rounded-2xl overflow-hidden shadow-xl border-2 border-emerald-500/40">
            <Image
              src="/brand/logo-sm.jpg"
              alt="Bangladesh Citizen Report Emblem"
              fill
              className="object-cover"
              priority
            />
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight max-w-3xl mx-auto leading-tight">
            Bangladesh Citizen Incident & Safety Network
          </h1>

          <p className="text-sm sm:text-base text-zinc-300 max-w-2xl mx-auto leading-relaxed">
            Report civic hazards, track community alerts, find nearby emergency services, and support verified missing person searches with privacy protection across Bangladesh.
          </p>

          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/reports/create"
              className="rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 text-xs sm:text-sm font-bold shadow-lg shadow-emerald-700/30 transition active:scale-95 flex items-center gap-2"
            >
              <span>+</span>
              <span>Report an Incident</span>
            </Link>

            <Link
              href="/safety"
              className="rounded-xl bg-red-600 hover:bg-red-500 text-white px-5 py-3 text-xs sm:text-sm font-bold shadow-lg shadow-red-700/30 transition active:scale-95 flex items-center gap-2"
            >
              <span>🚨</span>
              <span>Find Help Near Me</span>
            </Link>

            <Link
              href="/safety-map"
              className="rounded-xl border border-zinc-700 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-200 px-4 py-3 text-xs sm:text-sm font-semibold transition backdrop-blur-xs flex items-center gap-1.5"
            >
              <span>🗺️</span>
              <span>Safety Map</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Main Container */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-10">
        {/* 2. Civic Services Quick Action Grid */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <Link
            href="/safety"
            className="group rounded-2xl border border-red-200 dark:border-red-950/60 bg-red-50/50 dark:bg-red-950/20 p-4 hover:border-red-400 transition"
          >
            <div className="h-9 w-9 rounded-xl bg-red-600 text-white flex items-center justify-center text-lg mb-2 group-hover:scale-105 transition">
              🚨
            </div>
            <h2 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 leading-tight">
              Safety Navigator
            </h2>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 leading-snug">
              999 hotline & verified nearby police units.
            </p>
          </Link>

          <Link
            href="/missing-person"
            className="group rounded-2xl border border-amber-200 dark:border-amber-950/60 bg-amber-50/50 dark:bg-amber-950/20 p-4 hover:border-amber-400 transition"
          >
            <div className="h-9 w-9 rounded-xl bg-amber-600 text-white flex items-center justify-center text-lg mb-2 group-hover:scale-105 transition">
              🔍
            </div>
            <h2 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 leading-tight">
              Missing Persons
            </h2>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 leading-snug">
              Active search alerts & sighting responses.
            </p>
          </Link>

          <Link
            href="/safety-map"
            className="group rounded-2xl border border-emerald-200 dark:border-emerald-950/60 bg-emerald-50/50 dark:bg-emerald-950/20 p-4 hover:border-emerald-400 transition"
          >
            <div className="h-9 w-9 rounded-xl bg-emerald-700 text-white flex items-center justify-center text-lg mb-2 group-hover:scale-105 transition">
              🗺️
            </div>
            <h2 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 leading-tight">
              Community Map
            </h2>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 leading-snug">
              Geographic hazard clustering & safety alerts.
            </p>
          </Link>

          <Link
            href="/transparency"
            className="group rounded-2xl border border-blue-200 dark:border-blue-950/60 bg-blue-50/50 dark:bg-blue-950/20 p-4 hover:border-blue-400 transition"
          >
            <div className="h-9 w-9 rounded-xl bg-blue-600 text-white flex items-center justify-center text-lg mb-2 group-hover:scale-105 transition">
              📊
            </div>
            <h2 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 leading-tight">
              Transparency
            </h2>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 leading-snug">
              Platform report analytics & annual trends.
            </p>
          </Link>
        </section>

        {/* 3. Community Feed & Search Controls */}
        <section className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-zinc-900 dark:text-zinc-100 tracking-tight">
                Verified Incident Feed
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                Public reports reviewed by authorized moderators across Bangladesh.
              </p>
            </div>

            {/* Sort Order Tabs */}
            <div className="inline-flex rounded-xl bg-zinc-100 dark:bg-zinc-800 p-1 border border-zinc-200 dark:border-zinc-700 self-start md:self-auto">
              <button
                type="button"
                onClick={() => {
                  setSortOrder("latest");
                  setPage(0);
                }}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                  sortOrder === "latest"
                    ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-2xs"
                    : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400"
                }`}
              >
                Latest
              </button>
              <button
                type="button"
                onClick={() => {
                  setSortOrder("trending");
                  setPage(0);
                }}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                  sortOrder === "trending"
                    ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-2xs"
                    : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400"
                }`}
              >
                Trending
              </button>
            </div>
          </div>

          {/* Search & Location Filters */}
          <form
            onSubmit={handleSearchSubmit}
            className="grid grid-cols-1 sm:grid-cols-12 gap-2 bg-white dark:bg-zinc-900 p-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xs"
          >
            <div className="sm:col-span-6 relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search incident keywords (e.g. fire, road, water)..."
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 px-3.5 py-2.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-700"
              />
            </div>

            <div className="sm:col-span-4 relative">
              <input
                type="text"
                value={locationQuery}
                onChange={(e) => setLocationQuery(e.target.value)}
                placeholder="District or Area (e.g. Dhaka, Mirpur)..."
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 px-3.5 py-2.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-700"
              />
            </div>

            <div className="sm:col-span-2">
              <button
                type="submit"
                className="w-full rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white py-2.5 text-xs font-bold transition shadow-xs"
              >
                Search
              </button>
            </div>
          </form>

          {/* Category Chips Bar */}
          {categories.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory("");
                  setPage(0);
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${
                  selectedCategory === ""
                    ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-2xs"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                }`}
              >
                All Incident Types
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setSelectedCategory(cat.id);
                    setPage(0);
                  }}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${
                    selectedCategory === cat.id
                      ? "bg-emerald-700 text-white shadow-2xs"
                      : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          )}

          {/* Feed Content Grid */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-3 animate-pulse"
                >
                  <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-1/3" />
                  <div className="h-5 bg-zinc-200 dark:bg-zinc-800 rounded w-3/4" />
                  <div className="h-16 bg-zinc-100 dark:bg-zinc-800/50 rounded w-full" />
                  <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 p-6 text-center">
              <p className="text-sm font-semibold text-red-800 dark:text-red-300 mb-2">
                {error}
              </p>
              <button
                onClick={() => setPage(0)}
                className="px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-500 transition"
              >
                Retry Loading Feed
              </button>
            </div>
          ) : !data || data.items.length === 0 ? (
            <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-12 text-center space-y-3">
              <div className="text-4xl">📋</div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                No Verified Reports Found
              </h3>
              <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                There are currently no approved community reports matching your search or filter criteria.
              </p>
              <Link
                href="/reports/create"
                className="inline-block mt-2 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-600 transition"
              >
                Submit First Report
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {data.items.map((report) => (
                <PublicReportCard key={report.id} report={report} />
              ))}
            </div>
          )}

          {/* Pagination */}
          {data && totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <button
                type="button"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-semibold disabled:opacity-40 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition"
              >
                ← Previous
              </button>
              <span className="text-xs text-zinc-500 px-2 font-medium">
                Page {page + 1} of {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-semibold disabled:opacity-40 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition"
              >
                Next →
              </button>
            </div>
          )}
        </section>

        {/* 4. Trust & Civic Moderation Pipeline */}
        <section className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 sm:p-10 shadow-2xs space-y-6">
          <div className="text-center max-w-xl mx-auto">
            <h2 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">
              How Citizen Reports Are Verified
            </h2>
            <p className="text-xs text-zinc-500 mt-1">
              Every report on this platform undergoes rigorous checks before public publication.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
            <div className="rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 p-5 space-y-2 border border-zinc-100 dark:border-zinc-800">
              <div className="h-8 w-8 rounded-lg bg-emerald-700 text-white flex items-center justify-center font-bold text-sm">
                1
              </div>
              <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                Evidence Submission
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Citizens submit reports with verifiable photographic or document evidence. Anonymous reporting protects reporter identity.
              </p>
            </div>

            <div className="rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 p-5 space-y-2 border border-zinc-100 dark:border-zinc-800">
              <div className="h-8 w-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
                2
              </div>
              <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                Moderator Review
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Authorized moderators review media authenticity, verify location data, and inspect reports against hoax and duplicate signals.
              </p>
            </div>

            <div className="rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 p-5 space-y-2 border border-zinc-100 dark:border-zinc-800">
              <div className="h-8 w-8 rounded-lg bg-purple-600 text-white flex items-center justify-center font-bold text-sm">
                3
              </div>
              <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                Public Action & Safety
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Approved reports appear on the public feed, community safety map, and civic transparency dashboard with full location privacy.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
