"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { Report, UserReputation, ReputationHistoryResponse } from "@/lib/types";

export default function DashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, logout, isAdmin } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [loadingReports, setLoadingReports] = useState(true);
  const [reputation, setReputation] = useState<UserReputation | null>(null);
  const [loadingReputation, setLoadingReputation] = useState(true);
  const [history, setHistory] = useState<ReputationHistoryResponse | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [deactivateError, setDeactivateError] = useState<string | null>(null);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    let isMounted = true;
    if (isAuthenticated) {
      apiFetch<Report[]>("/reports/mine")
        .then((data) => {
          if (isMounted) setReports(data);
        })
        .catch(() => {})
        .finally(() => {
          if (isMounted) setLoadingReports(false);
        });

      apiFetch<UserReputation>("/reputation/me")
        .then((data) => {
          if (isMounted) setReputation(data);
        })
        .catch(() => {})
        .finally(() => {
          if (isMounted) setLoadingReputation(false);
        });
    }
    return () => {
      isMounted = false;
    };
  }, [isAuthenticated]);

  const toggleHistory = () => {
    if (!showHistory && !history) {
      setLoadingHistory(true);
      apiFetch<ReputationHistoryResponse>("/reputation/history")
        .then((data) => setHistory(data))
        .catch(() => {})
        .finally(() => setLoadingHistory(false));
    }
    setShowHistory(!showHistory);
  };

  const handleDeactivateAccount = async () => {
    setIsDeactivating(true);
    setDeactivateError(null);
    try {
      await apiFetch("/auth/deactivate", { method: "POST" });
      setShowDeactivateModal(false);
      logout();
      router.push("/");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to deactivate account";
      setDeactivateError(msg);
      setIsDeactivating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-700 border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const draftsCount = reports.filter((r) => r.status === "DRAFT").length;
  const inReviewCount = reports.filter(
    (r) => r.status === "SUBMITTED" || r.status === "UNDER_REVIEW"
  ).length;
  const approvedCount = reports.filter((r) => r.status === "APPROVED").length;

  // Next badge tier calculation
  const getBadgeTierInfo = (points: number) => {
    if (points < 50) return { current: "New Contributor", next: "Active Helper", target: 50, progress: (points / 50) * 100 };
    if (points < 200) return { current: "Active Helper", next: "Trusted Contributor", target: 200, progress: ((points - 50) / 150) * 100 };
    if (points < 500) return { current: "Trusted Contributor", next: "Community Guardian", target: 500, progress: ((points - 200) / 300) * 100 };
    if (points < 1000) return { current: "Community Guardian", next: "Nirapotta Champion", target: 1000, progress: ((points - 500) / 500) * 100 };
    return { current: "Nirapotta Champion", next: "Max Tier", target: 1000, progress: 100 };
  };

  const badgeInfo = reputation ? getBadgeTierInfo(reputation.impact_points) : null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* 1. Citizen Profile Banner */}
      <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-8 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-2xl bg-emerald-700 text-white flex items-center justify-center text-2xl font-black shadow-md shadow-emerald-700/20 shrink-0">
              {(user.full_name || user.username).charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">
                  {user.full_name || user.username}
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  {user.role}
                </span>
                {reputation && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300">
                    🏅 {reputation.badge}
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-500 mt-0.5">
                @{user.username} • Verified Citizen Contributor
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {isAdmin && (
              <Link
                href="/admin"
                className="rounded-xl bg-amber-600 hover:bg-amber-500 text-white px-3.5 py-2 text-xs font-bold shadow-xs transition"
              >
                Admin Panel
              </Link>
            )}
            <Link
              href="/reports/create"
              className="rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white px-4 py-2 text-xs font-bold shadow-xs transition"
            >
              + New Report
            </Link>
            <button
              onClick={logout}
              className="rounded-xl border border-zinc-200 dark:border-zinc-700 px-3.5 py-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* Contribution KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-6 pt-6 border-t border-zinc-100 dark:border-zinc-800">
          <div className="rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 p-4 text-center">
            <span className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-zinc-100 block">
              {reports.length}
            </span>
            <span className="text-[11px] text-zinc-500 font-medium">
              Total Submissions
            </span>
          </div>

          <div className="rounded-2xl bg-zinc-100/80 dark:bg-zinc-800/80 p-4 text-center">
            <span className="text-xl sm:text-2xl font-black text-zinc-700 dark:text-zinc-300 block">
              {draftsCount}
            </span>
            <span className="text-[11px] text-zinc-500 font-medium">
              Saved Drafts
            </span>
          </div>

          <div className="rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 p-4 text-center border border-amber-200/40 dark:border-amber-900/40">
            <span className="text-xl sm:text-2xl font-black text-amber-700 dark:text-amber-400 block">
              {inReviewCount}
            </span>
            <span className="text-[11px] text-amber-800/80 dark:text-amber-300 font-medium">
              In Active Review
            </span>
          </div>

          <div className="rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 p-4 text-center border border-emerald-200/40 dark:border-emerald-900/40">
            <span className="text-xl sm:text-2xl font-black text-emerald-700 dark:text-emerald-400 block">
              {approvedCount}
            </span>
            <span className="text-[11px] text-emerald-800/80 dark:text-emerald-300 font-medium">
              Verified & Published
            </span>
          </div>
        </div>
      </div>

      {/* 2. Community Contributor & Reputation Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <span>🛡️</span> Community Standing & Impact
            </h2>
            <p className="text-xs text-zinc-500">
              Reliability score and contributions verified by the Nirapotta community
            </p>
          </div>
          <button
            onClick={toggleHistory}
            className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1"
          >
            {showHistory ? "Hide Activity Log" : "View Activity Log →"}
          </button>
        </div>

        {loadingReputation ? (
          <div className="h-44 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 animate-pulse" />
        ) : reputation ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Trust Score Card */}
              <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 sm:p-6 shadow-2xs space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                      Reliability Score
                    </span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-3xl sm:text-4xl font-black text-zinc-900 dark:text-zinc-100">
                        {reputation.trust_score}
                      </span>
                      <span className="text-sm text-zinc-400 font-medium">/ 100</span>
                      <span
                        className={`ml-2 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          reputation.trust_score >= 80
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            : reputation.trust_score >= 60
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                            : reputation.trust_score >= 40
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                            : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                        }`}
                      >
                        {reputation.trust_level}
                      </span>
                    </div>
                  </div>
                  <div className="h-10 w-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 flex items-center justify-center text-xl shrink-0">
                    🛡️
                  </div>
                </div>

                {/* Progress bar */}
                <div className="space-y-1.5">
                  <div className="h-2.5 w-full rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        reputation.trust_score >= 80
                          ? "bg-emerald-600"
                          : reputation.trust_score >= 60
                          ? "bg-blue-600"
                          : reputation.trust_score >= 40
                          ? "bg-amber-500"
                          : "bg-red-500"
                      }`}
                      style={{ width: `${Math.max(5, reputation.trust_score)}%` }}
                    />
                  </div>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    {reputation.trust_description}
                  </p>
                </div>
              </div>

              {/* Impact Points Card */}
              <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 sm:p-6 shadow-2xs space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                      Community Impact Points
                    </span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-3xl sm:text-4xl font-black text-amber-600 dark:text-amber-400">
                        {reputation.impact_points}
                      </span>
                      <span className="text-sm text-zinc-400 font-medium">pts</span>
                      <span className="ml-2 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300">
                        🏅 {reputation.badge}
                      </span>
                    </div>
                  </div>
                  <div className="h-10 w-10 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center text-xl shrink-0">
                    ⭐
                  </div>
                </div>

                {badgeInfo && (
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-zinc-500">
                      <span>Tier: {badgeInfo.current}</span>
                      <span>Next: {badgeInfo.next} ({badgeInfo.target} pts)</span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-amber-500 transition-all duration-500"
                        style={{ width: `${Math.min(100, Math.max(5, badgeInfo.progress))}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-zinc-500">
                      Earn points by contributing authentic reports (+10), verified blood donations (+50), and missing person sightings (+20).
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Contribution Breakdown Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 text-center">
                <span className="text-2xl font-black text-zinc-900 dark:text-zinc-100 block">
                  {reputation.verified_reports_count}
                </span>
                <span className="text-[11px] text-zinc-500 font-medium">
                  Verified Reports
                </span>
              </div>

              <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 text-center">
                <span className="text-2xl font-black text-rose-600 dark:text-rose-400 block">
                  {reputation.verified_blood_donations_count}
                </span>
                <span className="text-[11px] text-zinc-500 font-medium">
                  Blood Donations
                </span>
              </div>

              <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 text-center">
                <span className="text-2xl font-black text-blue-600 dark:text-blue-400 block">
                  {reputation.missing_person_contributions_count}
                </span>
                <span className="text-[11px] text-zinc-500 font-medium">
                  Missing Sightings
                </span>
              </div>

              <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 text-center">
                <span className="text-2xl font-black text-amber-500 block">
                  {reputation.help_rating > 0 ? `★ ${reputation.help_rating}` : "—"}
                </span>
                <span className="text-[11px] text-zinc-500 font-medium">
                  {reputation.help_rating_count > 0 ? `${reputation.help_rating_count} donor review(s)` : "Donor Rating"}
                </span>
              </div>
            </div>

            {/* Expandable History Drawer */}
            {showHistory && (
              <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 sm:p-6 shadow-2xs space-y-4">
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <span>📜</span> Recent Point Ledger & Trust Score History
                </h3>

                {loadingHistory ? (
                  <div className="py-8 text-center text-xs text-zinc-400 animate-pulse">
                    Loading activity history...
                  </div>
                ) : history && (history.transactions.length > 0 || history.trust_history.length > 0) ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Points transactions */}
                    <div className="space-y-2">
                      <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">
                        Impact Points Log
                      </span>
                      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                        {history.transactions.map((tx) => (
                          <div
                            key={tx.id}
                            className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-800 text-xs flex items-center justify-between gap-2"
                          >
                            <div>
                              <p className="font-semibold text-zinc-800 dark:text-zinc-200">
                                {tx.description}
                              </p>
                              <span className="text-[10px] text-zinc-400">
                                {new Date(tx.created_at).toLocaleDateString()}
                              </span>
                            </div>
                            <span
                              className={`font-black shrink-0 ${
                                tx.points >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"
                              }`}
                            >
                              {tx.points >= 0 ? `+${tx.points}` : tx.points}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Trust history */}
                    <div className="space-y-2">
                      <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">
                        Trust Score Audit Log
                      </span>
                      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                        {history.trust_history.map((th) => (
                          <div
                            key={th.id}
                            className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-800 text-xs flex items-center justify-between gap-2"
                          >
                            <div>
                              <p className="font-semibold text-zinc-800 dark:text-zinc-200">
                                {th.reason}
                              </p>
                              <span className="text-[10px] text-zinc-400">
                                {new Date(th.created_at).toLocaleDateString()} • {th.old_score} → {th.new_score}
                              </span>
                            </div>
                            <span
                              className={`font-black shrink-0 ${
                                th.change >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"
                              }`}
                            >
                              {th.change >= 0 ? `+${th.change}` : th.change}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-zinc-400 py-4 text-center">
                    No history records yet.
                  </p>
                )}
              </div>
            )}
          </div>
        ) : null}
      </section>

      {/* 2. My Reports List */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-zinc-100">
            My Incident Reports
          </h2>
          <span className="text-xs text-zinc-500">
            {reports.length} report{reports.length !== 1 ? "s" : ""} recorded
          </span>
        </div>

        {loadingReports ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="h-20 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 animate-pulse"
              />
            ))}
          </div>
        ) : reports.length === 0 ? (
          <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-12 text-center space-y-3">
            <div className="text-4xl">📝</div>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              You haven&apos;t filed any incident reports yet
            </h3>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto">
              Help keep your neighborhood safe by submitting verified reports of civic hazards or safety incidents.
            </p>
            <Link
              href="/reports/create"
              className="inline-block mt-2 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-600 transition"
            >
              Submit Your First Report
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {reports.map((report) => (
              <div
                key={report.id}
                className="group rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 hover:border-emerald-700/40 dark:hover:border-emerald-500/40 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        report.status === "APPROVED"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                          : report.status === "REJECTED"
                          ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                          : report.status === "DRAFT"
                          ? "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                          : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                      }`}
                    >
                      {report.status}
                    </span>
                    <span className="text-[11px] text-zinc-400">
                      {new Date(report.created_at).toLocaleDateString()}
                    </span>
                    {report.is_anonymous && (
                      <span className="text-[10px] font-semibold text-purple-700 dark:text-purple-300">
                        🛡️ Anonymous
                      </span>
                    )}
                  </div>

                  <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate">
                    <Link href={`/reports/${report.id}`} className="hover:text-emerald-700 dark:hover:text-emerald-400 transition">
                      {report.title}
                    </Link>
                  </h3>

                  <p className="text-xs text-zinc-500 truncate max-w-md">
                    📍 {report.location_text}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    href={`/reports/${report.id}`}
                    className="rounded-xl border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
                  >
                    View Details →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 4. Account & Data Privacy (Google Play Compliance) */}
      <section className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 sm:p-8 space-y-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <span>🛡️</span>
              <span>Account & Data Privacy</span>
            </h2>
            <p className="text-xs text-zinc-500">
              Manage your personal data, review legal policies, or deactivate your citizen account in accordance with Google Play safety standards.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/privacy"
              className="px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
            >
              Privacy Policy
            </Link>
            <Link
              href="/terms"
              className="px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
            >
              Terms of Service
            </Link>
            <Link
              href="/account-deletion"
              className="px-3 py-1.5 rounded-xl border border-red-200 dark:border-red-900/50 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition"
            >
              Data Deletion
            </Link>
          </div>
        </div>

        <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-xs font-bold text-zinc-800 dark:text-zinc-200">Deactivate Account</h3>
            <p className="text-[11px] text-zinc-500">
              Permanently disable your account and queue your personal profile for data erasure.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowDeactivateModal(true)}
            className="px-4 py-2 rounded-xl bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-900 hover:bg-red-100 dark:hover:bg-red-900/60 text-xs font-bold transition self-start sm:self-auto cursor-pointer"
          >
            Deactivate Account
          </button>
        </div>
      </section>

      {/* Deactivate Account Modal */}
      {showDeactivateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 sm:p-8 space-y-4 shadow-xl">
            <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
              <div className="h-10 w-10 rounded-2xl bg-red-100 dark:bg-red-950/60 flex items-center justify-center text-xl font-black">
                ⚠️
              </div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                Deactivate Your Account?
              </h3>
            </div>

            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              This action will immediately log you out and deactivate your account (@{user.username}). You will no longer be able to log in, submit reports, or participate in Blood Help. Your personal identity data will be queued for permanent deletion.
            </p>

            {deactivateError && (
              <p className="text-xs text-red-600 font-semibold">{deactivateError}</p>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDeactivateModal(false)}
                disabled={isDeactivating}
                className="px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeactivateAccount}
                disabled={isDeactivating}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
              >
                {isDeactivating ? "Deactivating..." : "Yes, Deactivate My Account"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

