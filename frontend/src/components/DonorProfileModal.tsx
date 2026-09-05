"use client";

import React, { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { BloodDonorProfile, BloodGroup, DonorAvailability } from "@/lib/types";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";

interface DonorProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdated?: () => void;
}

const BLOOD_GROUPS: BloodGroup[] = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

const BD_DISTRICTS = [
  "Dhaka", "Chattogram", "Sylhet", "Rajshahi", "Khulna", "Barishal", "Rangpur", "Mymensingh",
  "Gazipur", "Narayanganj", "Cumilla", "Bogura", "Cox's Bazar", "Noakhali", "Feni", "Brahmanbaria",
  "Jessore", "Kushtia", "Pabna", "Dinajpur", "Tangail", "Faridpur", "Jamalpur"
];

export default function DonorProfileModal({
  isOpen,
  onClose,
  onUpdated,
}: DonorProfileModalProps) {
  const { isAuthenticated } = useAuth();
  const [profile, setProfile] = useState<BloodDonorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form State
  const [bloodGroup, setBloodGroup] = useState<BloodGroup>("O+");
  const [district, setDistrict] = useState("Dhaka");
  const [area, setArea] = useState("");
  const [availability, setAvailability] = useState<DonorAvailability>("AVAILABLE");
  const [lastDonationDate, setLastDonationDate] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactMethod, setContactMethod] = useState("IN_APP");

  useEffect(() => {
    if (!isOpen || !isAuthenticated) return;
    setLoading(true);
    setError(null);
    setSuccess(null);

    apiFetch<BloodDonorProfile | null>("/blood/donor-profile")
      .then((data) => {
        if (data) {
          setProfile(data);
          setBloodGroup(data.blood_group);
          setDistrict(data.district);
          setArea(data.area);
          setAvailability(data.availability_status);
          setContactMethod(data.preferred_contact_method || "IN_APP");
          setContactPhone(data.contact_phone || "");
          if (data.last_donation_date) {
            setLastDonationDate(new Date(data.last_donation_date).toISOString().slice(0, 10));
          }
        }
      })
      .catch((err: unknown) => {
        if (err instanceof Error) setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [isOpen, isAuthenticated]);

  if (!isOpen) return null;

  const handleToggleAvailability = async () => {
    if (!profile) return;
    const nextStatus: DonorAvailability =
      availability === "AVAILABLE" ? "NOT_AVAILABLE" : "AVAILABLE";
    setSaving(true);
    setError(null);
    try {
      const updated = await apiFetch<BloodDonorProfile>("/blood/donor-profile", {
        method: "PATCH",
        body: JSON.stringify({ availability_status: nextStatus }),
      });
      setProfile(updated);
      setAvailability(updated.availability_status);
      setSuccess(`Status changed to ${nextStatus === "AVAILABLE" ? "Available" : "Not Available"}`);
      if (onUpdated) onUpdated();
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!area.trim()) {
      setError("Please specify your local area or landmark.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    const payload = {
      blood_group: bloodGroup,
      district,
      area: area.trim(),
      availability_status: availability,
      preferred_contact_method: contactMethod,
      contact_phone: contactPhone.trim() || undefined,
      last_donation_date: lastDonationDate ? new Date(lastDonationDate).toISOString() : undefined,
    };

    try {
      const saved = await apiFetch<BloodDonorProfile>("/blood/donor-profile", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setProfile(saved);
      setSuccess("Donor profile saved successfully! Thank you for volunteering.");
      if (onUpdated) onUpdated();
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in overflow-y-auto">
      <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 sm:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 border border-rose-200/60 dark:border-rose-900/60 text-xl font-bold">
              🩸
            </span>
            <div>
              <h2 className="text-lg font-black text-zinc-900 dark:text-zinc-100 tracking-tight">
                {profile ? "My Donor Profile" : "Register as a Community Donor"}
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Support fellow citizens during medical emergencies.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {!isAuthenticated ? (
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 p-6 text-center space-y-3">
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              Please sign in to register as a donor or manage your availability.
            </p>
            <div className="flex justify-center gap-3">
              <Link
                href="/login?redirect=/blood-help"
                className="rounded-xl bg-rose-600 hover:bg-rose-700 px-4 py-2 text-xs font-bold text-white shadow-2xs transition"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="rounded-xl border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
              >
                Register
              </Link>
            </div>
          </div>
        ) : loading ? (
          <div className="py-12 text-center text-xs text-zinc-400">
            Loading donor profile...
          </div>
        ) : (
          <>
            {/* Quick Toggle if profile exists */}
            {profile && (
              <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-800/40 p-4 flex items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 block">
                    Availability Status
                  </span>
                  <span className={`text-[11px] font-semibold ${availability === "AVAILABLE" ? "text-emerald-600" : "text-zinc-400"}`}>
                    {availability === "AVAILABLE" ? "🟢 Ready to donate" : "⚪ Currently unavailable"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleToggleAvailability}
                  disabled={saving}
                  className={`rounded-xl px-4 py-2 text-xs font-bold shadow-2xs transition cursor-pointer ${
                    availability === "AVAILABLE"
                      ? "bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-300"
                      : "bg-emerald-600 text-white hover:bg-emerald-700"
                  }`}
                >
                  {saving ? "Updating..." : availability === "AVAILABLE" ? "Mark Unavailable" : "Mark Available"}
                </button>
              </div>
            )}

            {/* Notifications */}
            {error && (
              <div className="rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 p-3 text-xs text-red-700 dark:text-red-300">
                {error}
              </div>
            )}
            {success && (
              <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 p-3 text-xs text-emerald-700 dark:text-emerald-300">
                {success}
              </div>
            )}

            {/* Profile Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Blood Group */}
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-2">
                  Blood Group
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {BLOOD_GROUPS.map((bg) => (
                    <button
                      type="button"
                      key={bg}
                      onClick={() => setBloodGroup(bg)}
                      className={`rounded-xl py-2 text-xs font-black transition cursor-pointer border ${
                        bloodGroup === bg
                          ? "bg-rose-600 text-white border-rose-600 shadow-2xs"
                          : "bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-750 hover:border-rose-400"
                      }`}
                    >
                      {bg}
                    </button>
                  ))}
                </div>
              </div>

              {/* District & Area */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                    District
                  </label>
                  <select
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-2.5 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-rose-600"
                  >
                    {BD_DISTRICTS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                    Local Area / Landmark
                  </label>
                  <input
                    type="text"
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    placeholder="e.g. Dhanmondi, Mirpur 10"
                    className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-2.5 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-rose-600"
                    required
                  />
                </div>
              </div>

              {/* Last Donation Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                    Last Donation Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={lastDonationDate}
                    onChange={(e) => setLastDonationDate(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-2.5 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-rose-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                    Emergency Phone (Private)
                  </label>
                  <input
                    type="tel"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="e.g. 017xxxxxxxx"
                    className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-2.5 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-rose-600"
                  />
                </div>
              </div>

              {/* Privacy Notice */}
              <div className="rounded-2xl border border-blue-200/80 bg-blue-50/50 dark:border-blue-900/60 dark:bg-blue-950/20 p-3.5 text-[11px] text-blue-800 dark:text-blue-300 leading-relaxed">
                🛡️ <strong>Privacy Protection:</strong> Your phone number and exact coordinates are NEVER published on any open list. Requesters only see your contact details if you explicitly click &ldquo;I Can Help&rdquo; on an active request.
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-rose-600 hover:bg-rose-700 px-5 py-2 text-xs font-bold text-white shadow-2xs transition disabled:opacity-40 cursor-pointer"
                >
                  {saving ? "Saving..." : profile ? "Update Profile" : "Register as Donor"}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
