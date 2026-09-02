"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
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
    const params = new URLSearchParams();
    params.append("sort", sortOrder);
    if (selectedCategory) params.append("category_id", selectedCategory);
    if (activeLocation.trim()) params.append("location", activeLocation.trim());
    if (activeSearch.trim()) params.append("q", activeSearch.trim());
    params.append("limit", PAGE_SIZE.toString());
    params.append("offset", (page * PAGE_SIZE).toString());

    apiFetch<PublicReportPagination>(`/public/reports?${params.toString()}`)
      .then((res) => {
        if (isMounted) setData(res);
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
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* Hero Headline Section */}
      <section className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-gradient-to-b from-emerald-50/50 via-white to-white dark:from-emerald-950/20 dark:via-zinc-900 dark:to-zinc-900 p-8 sm:p-12 shadow-sm text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 mb-4">
          <span>🛡️</span> Verified Public Community Reporting
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100 max-w-3xl mx-auto">
          Bangladesh Citizen Incident & Community Watch Feed
        </h1>
        <p className="mt-4 text-sm sm:text-base text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto leading-relaxed">
          Explore factual, community-reported civic issues verified through the platform moderation process across all divisions of Bangladesh.
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/reports/create"
            className="rounded-xl bg-emerald-600 px-6 py-3 text-xs font-bold text-white shadow-sm hover:bg-emerald-500 transition"
          >
            + Report a Community Incident
          </Link>
          {isAuthenticated ? (
            <Link
              href="/dashboard"
              className="rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-5 py-3 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50"
            >
              Citizen Dashboard ({user?.username})
            </Link>
          ) : (
            <Link
              href="/register"
              className="rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-5 py-3 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50"
            >
              Sign Up as Citizen
            </Link>
          )}
        </div>
      </section>

      {/* Discovery & Filters Bar */}
      <section className="space-y-4">
        {/* Search & Location Filters */}
        <form
          onSubmit={handleSearchSubmit}
          className="grid grid-cols-1 sm:grid-cols-12 gap-3 bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm"
        >
          <div className="sm:col-span-6 relative">
            <input
              type="text"
              placeholder="Search reports by keyword (e.g. road, water, drainage)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3.5 py-2.5 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div className="sm:col-span-4 relative">
            <input
              type="text"
              placeholder="Filter by location (e.g. Dhaka, Chittagong, Sylhet)..."
              value={locationQuery}
              onChange={(e) => setLocationQuery(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3.5 py-2.5 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div className="sm:col-span-2">
            <button
              type="submit"
              className="w-full rounded-xl bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 py-2.5 text-xs font-bold text-white dark:text-zinc-900 transition shadow-sm"
            >
              Search Feed
            </button>
          </div>
        </form>

        {/* Categories Bar & Sort Controls */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* Category Chips */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                setSelectedCategory("");
                setPage(0);
              }}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                selectedCategory === ""
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50"
              }`}
            >
              All Topics
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => {
                  setSelectedCategory(cat.id);
                  setPage(0);
                }}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition inline-flex items-center gap-1.5 ${
                  selectedCategory === cat.id
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50"
                }`}
              >
                <span>{cat.name}</span>
                {cat.approved_reports_count > 0 && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      selectedCategory === cat.id
                        ? "bg-emerald-700 text-white"
                        : "bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300"
                    }`}
                  >
                    {cat.approved_reports_count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-1 bg-white dark:bg-zinc-800 p-1 rounded-xl border border-zinc-200 dark:border-zinc-700 self-start md:self-auto shrink-0">
            <button
              onClick={() => {
                setSortOrder("latest");
                setPage(0);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                sortOrder === "latest"
                  ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900"
              }`}
            >
              Latest Reviewed
            </button>
            <button
              onClick={() => {
                setSortOrder("trending");
                setPage(0);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                sortOrder === "trending"
                  ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900"
              }`}
            >
              Trending Evidence 🔥
            </button>
          </div>
        </div>
      </section>

      {/* Reports Feed Grid */}
      {error && (
        <div className="rounded-2xl bg-red-50 dark:bg-red-950/40 p-4 border border-red-200 dark:border-red-900 text-sm text-red-700 dark:text-red-300">
          Failed to load public feed: {error}
        </div>
      )}

      {loading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
        </div>
      ) : !data || data.items.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-zinc-300 dark:border-zinc-700 p-16 text-center bg-zinc-50/50 dark:bg-zinc-900/30">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-2xl font-bold">
            📰
          </div>
          <h3 className="mt-4 text-base font-bold text-zinc-900 dark:text-zinc-100">
            No Verified Incident Reports Found
          </h3>
          <p className="mt-1 text-xs text-zinc-500 max-w-sm mx-auto">
            {activeSearch || activeLocation || selectedCategory
              ? "No approved reports match your current filters. Try adjusting your search keyword or clearing filters."
              : "No public reports have been verified yet. Be the first citizen to file an incident report."}
          </p>
          <div className="mt-6">
            <Link
              href="/reports/create"
              className="inline-flex rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-emerald-500 transition shadow-sm"
            >
              Submit an Incident Report →
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>
              Showing <strong className="text-zinc-900 dark:text-zinc-100">{data.items.length}</strong> of{" "}
              <strong className="text-zinc-900 dark:text-zinc-100">{data.total}</strong> verified incidents
            </span>
            <span className="text-[11px] text-zinc-400">
              Only platform-reviewed & approved reports are shown
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {data.items.map((report) => (
              <PublicReportCard key={report.id} report={report} />
            ))}
          </div>

          {/* Pagination Controls */}
          <div className="flex items-center justify-between border-t border-zinc-200 dark:border-zinc-800 pt-6">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="rounded-xl border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 disabled:opacity-40 hover:bg-zinc-50"
            >
              ← Previous Page
            </button>
            <span className="text-xs text-zinc-500 font-medium">
              Page {page + 1} of {Math.max(1, totalPages)}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="rounded-xl border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 disabled:opacity-40 hover:bg-zinc-50"
            >
              Next Page →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
