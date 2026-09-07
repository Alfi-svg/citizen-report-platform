"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { BloodDonationRecord, UserReputation } from "@/lib/types";
import AdminNav from "@/components/AdminNav";
import { useBackClose } from "@/lib/useBackClose";

interface AdminUserReputationItem {
  user_id: string;
  username: string;
  full_name: string | null;
  role: string;
  reputation: UserReputation;
}

export default function AdminReputationPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading, isAdmin } = useAuth();

  const [activeTab, setActiveTab] = useState<"blood" | "users">("blood");

  // Blood Donations State
  const [donations, setDonations] = useState<BloodDonationRecord[]>([]);
  const [bloodTotal, setBloodTotal] = useState(0);
  const [bloodStatusFilter, setBloodStatusFilter] = useState<string>("DISPUTED");
  const [loadingBlood, setLoadingBlood] = useState(true);

  // Selected Donation Moderation State
  const [selectedDonation, setSelectedDonation] = useState<BloodDonationRecord | null>(null);
  const [modAction, setModAction] = useState<"VERIFY" | "REJECT" | "KEEP_DISPUTED">("VERIFY");
  const [adminNotes, setAdminNotes] = useState("");
  const [submittingMod, setSubmittingMod] = useState(false);

  // Users Reputation State
  const [usersList, setUsersList] = useState<AdminUserReputationItem[]>([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [userSearch, setUserSearch] = useState("");
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Adjust Modal State
  const [adjustTargetUser, setAdjustTargetUser] = useState<AdminUserReputationItem | null>(null);
  const [pointsDelta, setPointsDelta] = useState<number>(0);
  const [trustDelta, setTrustDelta] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState("");
  const [submittingAdjust, setSubmittingAdjust] = useState(false);

  // Notifications
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Android back-close for modals
  useBackClose(!!selectedDonation, () => setSelectedDonation(null), "adminDonationModModal");
  useBackClose(!!adjustTargetUser, () => setAdjustTargetUser(null), "adminAdjustRepModal");

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !isAdmin)) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, isAdmin, router]);

  // Load blood donations
  const fetchBloodDonations = async () => {
    setLoadingBlood(true);
    setError(null);
    try {
      const query = bloodStatusFilter !== "ALL" ? `?status_filter=${bloodStatusFilter}` : "";
      const res = await apiFetch<{ items: BloodDonationRecord[]; total: number }>(
        `/admin/blood/donations${query}`
      );
      setDonations(res.items || []);
      setBloodTotal(res.total || 0);
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setLoadingBlood(false);
    }
  };

  // Load users reputation
  const fetchUsersReputation = async () => {
    setLoadingUsers(true);
    setError(null);
    try {
      const query = userSearch.trim() ? `?search=${encodeURIComponent(userSearch.trim())}` : "";
      const res = await apiFetch<{ items: AdminUserReputationItem[]; total: number }>(
        `/admin/reputation/users${query}`
      );
      setUsersList(res.items || []);
      setUsersTotal(res.total || 0);
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      if (activeTab === "blood") {
        fetchBloodDonations();
      } else {
        fetchUsersReputation();
      }
    }
  }, [isAdmin, activeTab, bloodStatusFilter]);

  const handleModerateDonation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDonation) return;
    setSubmittingMod(true);
    setError(null);
    try {
      await apiFetch(`/admin/blood/donations/${selectedDonation.id}/moderate`, {
        method: "POST",
        body: JSON.stringify({
          action: modAction,
          admin_notes: adminNotes.trim() || undefined,
        }),
      });
      setSuccess(`Donation claim successfully moderated with action '${modAction}'.`);
      setSelectedDonation(null);
      setAdminNotes("");
      fetchBloodDonations();
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setSubmittingMod(false);
    }
  };

  const handleAdjustReputation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustTargetUser) return;
    if (adjustReason.trim().length < 3) {
      setError("Audit reason must be at least 3 characters.");
      return;
    }
    setSubmittingAdjust(true);
    setError(null);
    try {
      await apiFetch("/admin/reputation/adjust", {
        method: "POST",
        body: JSON.stringify({
          user_id: adjustTargetUser.user_id,
          points_delta: Number(pointsDelta) || 0,
          trust_score_delta: Number(trustDelta) || 0,
          reason: adjustReason.trim(),
        }),
      });
      setSuccess(`Reputation adjusted successfully for @${adjustTargetUser.username}.`);
      setAdjustTargetUser(null);
      setPointsDelta(0);
      setTrustDelta(0);
      setAdjustReason("");
      fetchUsersReputation();
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setSubmittingAdjust(false);
    }
  };

  if (authLoading || !isAdmin) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-700 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      {/* Admin Nav */}
      <AdminNav />

      {/* Header Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <span>🛡️</span> Reputation & Blood Donation Oversight
          </h1>
          <p className="text-xs text-zinc-500">
            Audit Trust Scores, Impact Points, and resolve disputed blood donations
          </p>
        </div>

        {/* Tab Toggle */}
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
          <button
            type="button"
            onClick={() => setActiveTab("blood")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === "blood"
                ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-2xs"
                : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
            }`}
          >
            🩸 Blood Disputes ({bloodTotal})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("users")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === "users"
                ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-2xs"
                : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
            }`}
          >
            👥 User Reputation ({usersTotal})
          </button>
        </div>
      </div>

      {/* Notifications */}
      {success && (
        <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 p-4 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-700 dark:text-emerald-300">
          {success}
        </div>
      )}
      {error && (
        <div className="rounded-2xl bg-red-50 dark:bg-red-950/40 p-4 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* TAB 1: BLOOD DONATIONS OVERSIGHT */}
      {activeTab === "blood" && (
        <div className="space-y-4">
          {/* Status Filter Bar */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {["DISPUTED", "PENDING_CONFIRMATION", "VERIFIED", "REJECTED", "ALL"].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setBloodStatusFilter(st)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold shrink-0 transition cursor-pointer ${
                  bloodStatusFilter === st
                    ? "bg-rose-600 text-white shadow-2xs"
                    : "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                }`}
              >
                {st === "DISPUTED"
                  ? "⚠️ Disputed Claims"
                  : st === "PENDING_CONFIRMATION"
                  ? "⏳ Pending Confirmation"
                  : st === "VERIFIED"
                  ? "✅ Verified"
                  : st === "REJECTED"
                  ? "❌ Rejected"
                  : "All Records"}
              </button>
            ))}
          </div>

          {/* List of Donations */}
          {loadingBlood ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="h-28 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 animate-pulse"
                />
              ))}
            </div>
          ) : donations.length === 0 ? (
            <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-12 text-center text-xs text-zinc-400">
              No blood donation records found for status: <strong>{bloodStatusFilter}</strong>.
            </div>
          ) : (
            <div className="space-y-3">
              {donations.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                          item.status === "VERIFIED"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            : item.status === "DISPUTED"
                            ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                            : item.status === "PENDING_CONFIRMATION"
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                            : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                        }`}
                      >
                        {item.status}
                      </span>
                      <span className="text-xs font-bold text-rose-600 dark:text-rose-400">
                        {item.blood_group}
                      </span>
                      <span className="text-[11px] text-zinc-400">•</span>
                      <span className="text-[11px] text-zinc-500">
                        {item.hospital_name}, {item.district}
                      </span>
                    </div>

                    <p className="text-xs text-zinc-800 dark:text-zinc-200">
                      Donor: <strong className="text-zinc-900 dark:text-zinc-100">{item.donor_name}</strong> → Recipient:{" "}
                      <strong className="text-zinc-900 dark:text-zinc-100">{item.recipient_name}</strong>
                    </p>

                    {item.dispute_reason && (
                      <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200/60 dark:border-rose-900/40 text-xs text-rose-700 dark:text-rose-300">
                        <strong>Dispute Reason:</strong> &ldquo;{item.dispute_reason}&rdquo;
                      </div>
                    )}

                    {item.admin_notes && (
                      <p className="text-[11px] text-zinc-500 italic">
                        Admin Note: &ldquo;{item.admin_notes}&rdquo;
                      </p>
                    )}

                    {item.donor_rating && (
                      <p className="text-[11px] text-amber-600 dark:text-amber-400 font-bold">
                        Donor Rating: ★ {item.donor_rating} / 5
                        {item.donor_review && ` — "${item.donor_review}"`}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDonation(item);
                        setModAction(item.status === "DISPUTED" ? "VERIFY" : "KEEP_DISPUTED");
                        setAdminNotes(item.admin_notes || "");
                      }}
                      className="px-3.5 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-xs font-bold text-zinc-800 dark:text-zinc-200 transition cursor-pointer"
                    >
                      Moderate Record →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: USERS REPUTATION AUDIT */}
      {activeTab === "users" && (
        <div className="space-y-4">
          {/* Search Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              fetchUsersReputation();
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              placeholder="Search user by username or full name..."
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              className="flex-1 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-2.5 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-700"
            />
            <button
              type="submit"
              className="rounded-2xl bg-emerald-700 hover:bg-emerald-600 text-white px-5 py-2.5 text-xs font-bold shadow-2xs transition cursor-pointer"
            >
              Search
            </button>
          </form>

          {loadingUsers ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="h-28 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 animate-pulse"
                />
              ))}
            </div>
          ) : usersList.length === 0 ? (
            <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-12 text-center text-xs text-zinc-400">
              No users found.
            </div>
          ) : (
            <div className="space-y-3">
              {usersList.map((item) => (
                <div
                  key={item.user_id}
                  className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-2 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-black text-sm text-zinc-900 dark:text-zinc-100">
                        {item.full_name || item.username}
                      </span>
                      <span className="text-xs text-zinc-400">@{item.username}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                        {item.role}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300">
                        🏅 {item.reputation.badge}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-600 dark:text-zinc-400">
                      <div>
                        Trust Score:{" "}
                        <strong className="text-zinc-900 dark:text-zinc-100 font-bold">
                          {item.reputation.trust_score}/100
                        </strong>{" "}
                        ({item.reputation.trust_level})
                      </div>
                      <div>
                        Impact Points:{" "}
                        <strong className="text-amber-600 dark:text-amber-400 font-bold">
                          {item.reputation.impact_points} pts
                        </strong>
                      </div>
                      <div>
                        Reports:{" "}
                        <strong className="text-zinc-900 dark:text-zinc-100">
                          {item.reputation.verified_reports_count}
                        </strong>
                      </div>
                      <div>
                        Blood:{" "}
                        <strong className="text-rose-600 dark:text-rose-400">
                          {item.reputation.verified_blood_donations_count}
                        </strong>
                      </div>
                      <div>
                        Help Rating:{" "}
                        <strong className="text-amber-500">
                          {item.reputation.help_rating > 0 ? `★ ${item.reputation.help_rating}` : "—"}
                        </strong>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setAdjustTargetUser(item);
                        setPointsDelta(0);
                        setTrustDelta(0);
                        setAdjustReason("");
                      }}
                      className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold shadow-2xs transition cursor-pointer"
                    >
                      Adjust Reputation →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: MODERATE BLOOD DONATION */}
      {selectedDonation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in overflow-y-auto">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 sm:p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-black text-zinc-900 dark:text-zinc-100">
                  Moderate Blood Donation Claim
                </h3>
                <p className="text-xs text-zinc-500">
                  Donor: {selectedDonation.donor_name} • Hospital: {selectedDonation.hospital_name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDonation(null)}
                className="rounded-xl p-1.5 text-zinc-400 hover:text-zinc-600"
              >
                ✕
              </button>
            </div>

            {selectedDonation.dispute_reason && (
              <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-800 dark:text-rose-300">
                <strong>Dispute Reported by Recipient:</strong>
                <p className="text-[11px] mt-0.5 italic">&ldquo;{selectedDonation.dispute_reason}&rdquo;</p>
              </div>
            )}

            <form onSubmit={handleModerateDonation} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Administrative Action
                </label>
                <div className="space-y-2">
                  <label className="flex items-start gap-2 p-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/40 text-xs cursor-pointer">
                    <input
                      type="radio"
                      name="modAction"
                      value="VERIFY"
                      checked={modAction === "VERIFY"}
                      onChange={() => setModAction("VERIFY")}
                      className="mt-0.5"
                    />
                    <div>
                      <span className="font-bold text-emerald-700 dark:text-emerald-400 block">
                        VERIFY (Award +50 pts & +5 trust score)
                      </span>
                      <span className="text-[11px] text-zinc-500">
                        Confirms that donor provided blood despite dispute.
                      </span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2 p-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/40 text-xs cursor-pointer">
                    <input
                      type="radio"
                      name="modAction"
                      value="REJECT"
                      checked={modAction === "REJECT"}
                      onChange={() => setModAction("REJECT")}
                      className="mt-0.5"
                    />
                    <div>
                      <span className="font-bold text-rose-600 dark:text-rose-400 block">
                        REJECT (False claim: -10 trust penalty)
                      </span>
                      <span className="text-[11px] text-zinc-500">
                        Donor claim found fraudulent or unsupported.
                      </span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2 p-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/40 text-xs cursor-pointer">
                    <input
                      type="radio"
                      name="modAction"
                      value="KEEP_DISPUTED"
                      checked={modAction === "KEEP_DISPUTED"}
                      onChange={() => setModAction("KEEP_DISPUTED")}
                      className="mt-0.5"
                    />
                    <div>
                      <span className="font-bold text-zinc-700 dark:text-zinc-300 block">
                        KEEP DISPUTED
                      </span>
                      <span className="text-[11px] text-zinc-500">
                        Requires further inquiry; maintains disputed status.
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Internal Audit Notes
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Spoke with hospital ward admin, confirmed blood was provided."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-3 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedDonation(null)}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400 min-h-[40px] flex items-center justify-center cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingMod}
                  className="rounded-xl bg-emerald-700 hover:bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow-2xs transition disabled:opacity-50 min-h-[40px] flex items-center justify-center cursor-pointer"
                >
                  {submittingMod ? "Moderating..." : "Apply Action"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ADJUST USER REPUTATION */}
      {adjustTargetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in overflow-y-auto">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 sm:p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-black text-zinc-900 dark:text-zinc-100">
                  Manual Reputation Adjustment
                </h3>
                <p className="text-xs text-zinc-500">
                  User: @{adjustTargetUser.username} ({adjustTargetUser.full_name || "Citizen"})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAdjustTargetUser(null)}
                className="rounded-xl p-1.5 text-zinc-400 hover:text-zinc-600"
              >
                ✕
              </button>
            </div>

            <div className="p-3 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-xs flex justify-between">
              <span>Current Trust Score: <strong>{adjustTargetUser.reputation.trust_score}/100</strong></span>
              <span>Current Points: <strong>{adjustTargetUser.reputation.impact_points} pts</strong></span>
            </div>

            <form onSubmit={handleAdjustReputation} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Trust Score Delta (-50 to +50)
                </label>
                <input
                  type="number"
                  min={-50}
                  max={50}
                  value={trustDelta}
                  onChange={(e) => setTrustDelta(Number(e.target.value))}
                  className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-3 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Impact Points Delta (-500 to +500)
                </label>
                <input
                  type="number"
                  min={-500}
                  max={500}
                  value={pointsDelta}
                  onChange={(e) => setPointsDelta(Number(e.target.value))}
                  className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-3 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Mandatory Audit Reason <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="State the official justification for this adjustment (logged to audit trail)..."
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-3 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setAdjustTargetUser(null)}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400 min-h-[40px] flex items-center justify-center cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAdjust || adjustReason.trim().length < 3}
                  className="rounded-xl bg-emerald-700 hover:bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow-2xs transition disabled:opacity-50 min-h-[40px] flex items-center justify-center cursor-pointer"
                >
                  {submittingAdjust ? "Applying..." : "Save Adjustment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
