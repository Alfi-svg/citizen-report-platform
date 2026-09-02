"use client";

import React, { useEffect, useState, useTransition, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { PublicCategory, PublicReportPagination } from "@/lib/types";
import { Language } from "@/lib/i18n";
import PublicReportCard from "@/components/PublicReportCard";

function PublicReportsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Language state
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

  // Categories & Data
  const [categories, setCategories] = useState<PublicCategory[]>([]);
  const [data, setData] = useState<PublicReportPagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters initialized from URL search params
  const initialCategory = searchParams?.get("category") || "";
  const initialQ = searchParams?.get("q") || "";
  const initialLocation = searchParams?.get("location") || "";
  const initialSort = (searchParams?.get("sort") as "latest" | "trending") || "latest";

  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory);
  const [searchQuery, setSearchQuery] = useState<string>(initialQ);
  const [activeSearch, setActiveSearch] = useState<string>(initialQ);
  const [locationQuery, setLocationQuery] = useState<string>(initialLocation);
  const [activeLocation, setActiveLocation] = useState<string>(initialLocation);
  const [sortOrder, setSortOrder] = useState<"latest" | "trending">(initialSort);
  const [page, setPage] = useState<number>(0);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [, startTransition] = useTransition();

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

    // Update browser URL query string smoothly
    startTransition(() => {
      const urlParams = new URLSearchParams();
      if (selectedCategory) urlParams.set("category", selectedCategory);
      if (activeSearch) urlParams.set("q", activeSearch);
      if (activeLocation) urlParams.set("location", activeLocation);
      if (sortOrder !== "latest") urlParams.set("sort", sortOrder);
      const queryString = urlParams.toString();
      router.replace(`/reports${queryString ? `?${queryString}` : ""}`, { scroll: false });
    });

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
  }, [sortOrder, selectedCategory, activeLocation, activeSearch, page, router]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    setActiveSearch(searchQuery);
    setActiveLocation(locationQuery);
  };

  const clearAllFilters = () => {
    setSelectedCategory("");
    setSearchQuery("");
    setActiveSearch("");
    setLocationQuery("");
    setActiveLocation("");
    setSortOrder("latest");
    setPage(0);
  };

  const activeFilterCount =
    (selectedCategory ? 1 : 0) +
    (activeSearch ? 1 : 0) +
    (activeLocation ? 1 : 0) +
    (sortOrder !== "latest" ? 1 : 0);

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 1;

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* 1. Page Header */}
      <div className="space-y-2 border-b border-zinc-200 dark:border-zinc-800 pb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-900/60 mb-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
              <span>{lang === "bn" ? "যাচাইকৃত নাগরিক ফিড" : "Platform-Reviewed Civic Feed"}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">
              {lang === "bn" ? "কমিউনিটি রিপোর্টসমূহ" : "Community Reports"}
            </h1>
            <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              {lang === "bn"
                ? "কমিউনিটি কর্তৃক শেয়ারকৃত প্ল্যাটফর্ম-যাচাইকৃত রিপোর্টগুলো পর্যবেক্ষণ করুন।"
                : "Explore platform-reviewed reports shared by the community across Bangladesh."}
            </p>
          </div>

          <Link
            href="/reports/create"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 active:bg-emerald-800 text-white text-xs font-bold shadow-sm transition self-start sm:self-auto shrink-0"
          >
            <span>+</span>
            <span>{lang === "bn" ? "নতুন রিপোর্ট জমা দিন" : "Submit a Report"}</span>
          </Link>
        </div>
      </div>

      {/* 2. Search & Filter Bar */}
      <div className="space-y-4">
        <form
          onSubmit={handleSearchSubmit}
          className="grid grid-cols-1 sm:grid-cols-12 gap-2 bg-white dark:bg-zinc-900 p-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xs"
        >
          <div className="sm:col-span-6 relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                lang === "bn"
                  ? "রিপোর্ট, স্থান বা ঘটনার কীওয়ার্ড লিখুন..."
                  : "Search reports, places, incidents..."
              }
              className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 px-3.5 py-2.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-700"
            />
          </div>

          <div className="sm:col-span-4 relative">
            <input
              type="text"
              value={locationQuery}
              onChange={(e) => setLocationQuery(e.target.value)}
              placeholder={
                lang === "bn"
                  ? "জেলা বা এলাকা (যেমন: ঢাকা, সিলেট, মিরপুর)..."
                  : "District or Area (e.g. Dhaka, Sylhet, Mirpur)..."
              }
              className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 px-3.5 py-2.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-700"
            />
          </div>

          <div className="sm:col-span-2 flex gap-2">
            <button
              type="submit"
              className="w-full rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white py-2.5 text-xs font-bold transition shadow-2xs"
            >
              {lang === "bn" ? "অনুসন্ধান" : "Search"}
            </button>

            {/* Mobile Filter Sheet Trigger */}
            <button
              type="button"
              onClick={() => setMobileFilterOpen(!mobileFilterOpen)}
              className="sm:hidden px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-xs font-bold"
              title="Filters"
            >
              ⚙️ {activeFilterCount > 0 && `(${activeFilterCount})`}
            </button>
          </div>
        </form>

        {/* Desktop Filter Row: Sort Switcher + Categories Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          {/* Category Chips Bar */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full no-scrollbar">
            <button
              type="button"
              onClick={() => {
                setSelectedCategory("");
                setPage(0);
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition select-none ${
                selectedCategory === ""
                  ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-2xs font-bold"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
              }`}
            >
              {lang === "bn" ? "সকল ক্যাটাগরি" : "All Categories"}
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  setSelectedCategory(cat.id);
                  setPage(0);
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition select-none ${
                  selectedCategory === cat.id
                    ? "bg-emerald-700 text-white shadow-2xs font-bold"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* Sort Switcher */}
          <div className="inline-flex rounded-xl bg-zinc-100 dark:bg-zinc-800 p-1 border border-zinc-200 dark:border-zinc-700 shrink-0 self-end sm:self-auto">
            <button
              type="button"
              onClick={() => {
                setSortOrder("latest");
                setPage(0);
              }}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition select-none ${
                sortOrder === "latest"
                  ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-2xs"
                  : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400"
              }`}
            >
              {lang === "bn" ? "সর্বশেষ" : "Latest"}
            </button>
            <button
              type="button"
              onClick={() => {
                setSortOrder("trending");
                setPage(0);
              }}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition select-none ${
                sortOrder === "trending"
                  ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-2xs"
                  : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400"
              }`}
            >
              {lang === "bn" ? "জনপ্রিয়" : "Trending"}
            </button>
          </div>
        </div>

        {/* 3. Active Filter Summary */}
        {activeFilterCount > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
            <span className="text-zinc-400 font-medium">Active filters:</span>

            {selectedCategory && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 text-xs font-semibold">
                Category: {categories.find((c) => c.id === selectedCategory)?.name || "Selected"}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategory("");
                    setPage(0);
                  }}
                  className="hover:text-emerald-950 dark:hover:text-white"
                >
                  ×
                </button>
              </span>
            )}

            {activeSearch && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200 text-xs font-semibold">
                Keyword: &quot;{activeSearch}&quot;
                <button
                  type="button"
                  onClick={() => {
                    setActiveSearch("");
                    setSearchQuery("");
                    setPage(0);
                  }}
                  className="hover:text-black dark:hover:text-white"
                >
                  ×
                </button>
              </span>
            )}

            {activeLocation && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200 text-xs font-semibold">
                Location: {activeLocation}
                <button
                  type="button"
                  onClick={() => {
                    setActiveLocation("");
                    setLocationQuery("");
                    setPage(0);
                  }}
                  className="hover:text-black dark:hover:text-white"
                >
                  ×
                </button>
              </span>
            )}

            {sortOrder !== "latest" && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 text-xs font-semibold">
                Sort: Trending
                <button
                  type="button"
                  onClick={() => {
                    setSortOrder("latest");
                    setPage(0);
                  }}
                  className="hover:text-blue-950 dark:hover:text-white"
                >
                  ×
                </button>
              </span>
            )}

            <button
              type="button"
              onClick={clearAllFilters}
              className="text-xs text-red-600 dark:text-red-400 hover:underline font-bold ml-1"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* 4. Report Feed Content */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-3 animate-pulse"
            >
              <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-1/3" />
              <div className="h-5 bg-zinc-200 dark:bg-zinc-800 rounded w-3/4" />
              <div className="h-24 bg-zinc-100 dark:bg-zinc-800/50 rounded w-full" />
              <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 p-8 text-center space-y-3">
          <p className="text-sm font-semibold text-red-800 dark:text-red-300">
            Unable to load reports. Please try again.
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
            No Reports Found
          </h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto leading-relaxed">
            No platform-reviewed reports match your search or filter criteria. Try adjusting your search keywords or clearing active filters.
          </p>
          <div className="flex items-center justify-center gap-2 pt-2">
            <button
              type="button"
              onClick={clearAllFilters}
              className="rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-2 text-xs font-bold hover:bg-zinc-50 transition"
            >
              Clear Filters
            </button>
            <Link
              href="/reports/create"
              className="rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-600 transition"
            >
              Submit an Incident
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {data.items.map((report) => (
            <PublicReportCard key={report.id} report={report} />
          ))}
        </div>
      )}

      {/* 5. Pagination */}
      {data && totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-zinc-200 dark:border-zinc-800 pt-6">
          <p className="text-xs text-zinc-500">
            Showing <span className="font-semibold">{data.items.length}</span> of{" "}
            <span className="font-semibold">{data.total}</span> reports
          </p>

          <div className="flex items-center gap-2">
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
        </div>
      )}
    </div>
  );
}

export default function PublicReportsPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-xs text-zinc-400">Loading reports...</div>}>
      <PublicReportsContent />
    </Suspense>
  );
}
