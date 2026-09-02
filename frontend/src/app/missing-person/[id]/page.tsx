"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { PublicMissingPersonAlertResponse, PublicMissingPersonSightingResponse } from "@/lib/types";
import { translations, Language } from "@/lib/i18n";

export default function MissingPersonDetailPage() {
  const params = useParams();
  const router = useRouter();
  const alertId = params.id as string;

  const [lang, setLang] = useState<Language>("en");
  const t = translations[lang];

  const [alert, setAlert] = useState<PublicMissingPersonAlertResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // "I Saw This Person" Modal State
  const [isSightingModalOpen, setIsSightingModalOpen] = useState(false);
  const [sightingLocation, setSightingLocation] = useState("");
  const [sightingTime, setSightingTime] = useState("");
  const [sightingDesc, setSightingDesc] = useState("");
  const [sightingPhotoUrl, setSightingPhotoUrl] = useState("");
  const [sightingSubmitting, setSightingSubmitting] = useState(false);
  const [sightingSuccess, setSightingSuccess] = useState(false);
  const [sightingError, setSightingError] = useState<string | null>(null);

  const loadAlert = () => {
    if (!alertId) return;
    setLoading(true);
    apiFetch<PublicMissingPersonAlertResponse>(`/missing-person/alerts/${alertId}`)
      .then((res) => setAlert(res))
      .catch((err: unknown) => {
        if (err instanceof Error) setError(err.message);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadAlert();
  }, [alertId]);

  const handleSightingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSightingSubmitting(true);
    setSightingError(null);

    try {
      await apiFetch<PublicMissingPersonSightingResponse>(
        `/missing-person/alerts/${alertId}/sightings`,
        {
          method: "POST",
          body: JSON.stringify({
            approximate_location: sightingLocation.trim(),
            sighting_time: sightingTime.trim() || null,
            description: sightingDesc.trim(),
            photo_url: sightingPhotoUrl.trim() || null,
          }),
        }
      );
      setSightingSuccess(true);
      setSightingLocation("");
      setSightingTime("");
      setSightingDesc("");
      setSightingPhotoUrl("");
    } catch (err: unknown) {
      if (err instanceof Error) setSightingError(err.message);
      else setSightingError("Failed to submit sighting information.");
    } finally {
      setSightingSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-red-600 border-t-transparent" />
      </div>
    );
  }

  if (error || !alert) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-center space-y-4">
        <div className="text-4xl">⚠️</div>
        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
          {error || "Missing person alert not found"}
        </h2>
        <Link
          href="/missing-person"
          className="inline-flex items-center rounded-xl bg-zinc-900 dark:bg-white px-4 py-2 text-xs font-bold text-white dark:text-zinc-900"
        >
          ← Return to Alerts Directory
        </Link>
      </div>
    );
  }

  const { profile } = alert;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* Navigation Breadcrumb & Language Switcher */}
      <div className="flex items-center justify-between">
        <Link
          href="/missing-person"
          className="text-xs font-bold text-zinc-500 hover:text-red-600 transition"
        >
          ← {lang === "bn" ? "নিখোঁজ ব্যক্তি তালিকায় ফিরে যান" : "Back to All Alerts"}
        </Link>

        {/* Bilingual Language Switcher */}
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

      {/* Main Alert Card */}
      <section className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 sm:p-8 shadow-sm space-y-6">
        {/* Status Banner */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-600 text-white text-base font-bold shadow-xs">
              🚨
            </span>
            <span className="text-xs font-black tracking-wider uppercase text-red-600 dark:text-red-400">
              {t.missing_person_badge}
            </span>
          </div>

          <div>
            {alert.status === "ALERT_ACTIVE" ? (
              <span className="rounded-full bg-red-600 text-white px-3.5 py-1 text-xs font-black shadow-xs animate-pulse">
                🚨 {t.status_active}
              </span>
            ) : alert.status === "FOUND" ? (
              <span className="rounded-full bg-emerald-600 text-white px-3.5 py-1 text-xs font-black shadow-xs">
                ✅ {t.status_found}
              </span>
            ) : (
              <span className="rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-3.5 py-1 text-xs font-bold">
                ⏳ {t.status_expired}
              </span>
            )}
          </div>
        </div>

        {/* Profile Details & Photo */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Photo */}
          <div className="md:col-span-4 flex flex-col items-center">
            {profile.photo_url ? (
              <img
                src={profile.photo_url}
                alt={profile.full_name}
                className="w-full max-w-[240px] aspect-square rounded-3xl object-cover border border-zinc-200 dark:border-zinc-800 shadow-md"
              />
            ) : (
              <div className="w-full max-w-[240px] aspect-square rounded-3xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-6xl">
                👤
              </div>
            )}
          </div>

          {/* Profile Specs */}
          <div className="md:col-span-8 space-y-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-zinc-100">
                {lang === "bn" && profile.name_bn ? profile.name_bn : profile.full_name}
              </h1>
              {lang !== "bn" && profile.name_bn && (
                <p className="text-xs text-zinc-500 font-semibold">{profile.name_bn}</p>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div className="rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 p-3">
                <span className="text-zinc-400 block text-[10px] uppercase font-semibold">{t.age}</span>
                <strong className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  {profile.age !== null && profile.age !== undefined ? profile.age : profile.approximate_age || "Unknown"}
                </strong>
              </div>
              <div className="rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 p-3">
                <span className="text-zinc-400 block text-[10px] uppercase font-semibold">{t.gender}</span>
                <strong className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  {profile.gender || "Unknown"}
                </strong>
              </div>
              <div className="rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 p-3">
                <span className="text-zinc-400 block text-[10px] uppercase font-semibold">{t.height}</span>
                <strong className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  {profile.height || "Not specified"}
                </strong>
              </div>
            </div>

            {/* Last Seen Information */}
            <div className="rounded-2xl bg-amber-50 dark:bg-amber-950/30 p-4 border border-amber-200 dark:border-amber-900/50 text-xs space-y-1.5 text-amber-900 dark:text-amber-200">
              <div>
                <span className="font-semibold text-amber-700 dark:text-amber-400">{t.last_seen_near}:</span>{" "}
                <strong className="text-sm">
                  {lang === "bn" && profile.last_seen_location_bn ? profile.last_seen_location_bn : profile.last_seen_location}
                </strong>
              </div>
              {profile.last_seen_time && (
                <div className="text-[11px]">
                  <span className="font-semibold">{t.last_seen_time}:</span>{" "}
                  {new Date(profile.last_seen_time).toLocaleString()}
                </div>
              )}
            </div>

            {/* Clothing & Identifying Marks */}
            <div className="space-y-2 text-xs text-zinc-700 dark:text-zinc-300">
              {profile.clothing && (
                <div>
                  <span className="font-bold text-zinc-900 dark:text-zinc-100">{t.clothing}:</span>{" "}
                  {lang === "bn" && profile.clothing_bn ? profile.clothing_bn : profile.clothing}
                </div>
              )}
              {profile.identifying_features && (
                <div>
                  <span className="font-bold text-zinc-900 dark:text-zinc-100">{t.identifying_details}:</span>{" "}
                  {lang === "bn" && profile.identifying_features_bn ? profile.identifying_features_bn : profile.identifying_features}
                </div>
              )}
              {profile.description && (
                <div className="pt-2 text-zinc-600 dark:text-zinc-400">
                  {profile.description}
                </div>
              )}
            </div>

            {/* Official Authority Contact */}
            {profile.contact_information && (
              <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs">
                <span className="text-zinc-500 font-semibold">{t.contact_authority}:</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  {profile.contact_information}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Action Button: "I Saw This Person" */}
        {alert.status === "ALERT_ACTIVE" && (
          <div className="pt-6 border-t border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <p className="text-xs text-zinc-500 max-w-md">
              {t.sighting_disclaimer}
            </p>
            <button
              onClick={() => {
                setSightingSuccess(false);
                setIsSightingModalOpen(true);
              }}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-red-600 hover:bg-red-500 px-8 py-4 text-sm font-black text-white shadow-md transition active:scale-95 shrink-0"
            >
              <span>👁️</span>
              <span>{t.i_saw_this_person}</span>
            </button>
          </div>
        )}
      </section>

      {/* Community Sightings Section */}
      <section className="space-y-4">
        <h2 className="text-lg font-black text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <span>🛡️</span> {t.community_sightings} ({alert.approved_sightings.length})
        </h2>

        {alert.approved_sightings.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-zinc-200 dark:border-zinc-800 p-8 text-center text-xs text-zinc-500">
            {t.no_sightings}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {alert.approved_sightings.map((sighting) => (
              <div
                key={sighting.id}
                className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-2 shadow-xs"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <span>📍</span> {sighting.approximate_location}
                  </span>
                  <span className="text-[10px] text-zinc-400">
                    {new Date(sighting.created_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-xs text-zinc-700 dark:text-zinc-300">
                  {sighting.description}
                </p>
                {sighting.sighting_time && (
                  <div className="text-[11px] text-zinc-500">
                    <span className="font-semibold">{t.last_seen_time}:</span> {sighting.sighting_time}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* "I Saw This Person" Modal */}
      {isSightingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-zinc-900 p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <h3 className="text-base font-extrabold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <span>👁️</span> {t.submit_sighting}
              </h3>
              <button
                onClick={() => setIsSightingModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {sightingSuccess ? (
              <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 p-6 text-center space-y-3">
                <div className="text-3xl">✅</div>
                <h4 className="text-sm font-bold text-emerald-800 dark:text-emerald-300">
                  {lang === "bn" ? "আপনার তথ্যটি সফলভাবে জমা হয়েছে" : "Sighting Submitted Successfully"}
                </h4>
                <p className="text-xs text-emerald-700 dark:text-emerald-400">
                  {t.sighting_disclaimer}
                </p>
                <button
                  onClick={() => setIsSightingModalOpen(false)}
                  className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow-xs"
                >
                  {lang === "bn" ? "ঠিক আছে" : "Close"}
                </button>
              </div>
            ) : (
              <form onSubmit={handleSightingSubmit} className="space-y-3.5 text-xs">
                {sightingError && (
                  <div className="rounded-xl bg-red-50 dark:bg-red-950/40 p-3 text-red-700">
                    {sightingError}
                  </div>
                )}

                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    {t.approx_location_label}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={lang === "bn" ? "উদা: ধানমন্ডি ২৭ মীনা বাজার সংলগ্ন" : "e.g. Near Mirpur-10 round about"}
                    value={sightingLocation}
                    onChange={(e) => setSightingLocation(e.target.value)}
                    className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 p-2.5"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    {t.sighting_time_label}
                  </label>
                  <input
                    type="text"
                    placeholder={lang === "bn" ? "উদা: আজ সন্ধ্যা আনুমানিক ৬:৩০" : "e.g. Today around 6:30 PM"}
                    value={sightingTime}
                    onChange={(e) => setSightingTime(e.target.value)}
                    className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 p-2.5"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    {t.sighting_desc_label}
                  </label>
                  <textarea
                    required
                    rows={3}
                    placeholder={lang === "bn" ? "ব্যক্তিটির পরনের পোশাক, অবস্থান বা সাথে অন্য কেউ ছিল কিনা লিখুন..." : "Describe appearance, condition, direction of movement..."}
                    value={sightingDesc}
                    onChange={(e) => setSightingDesc(e.target.value)}
                    className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 p-2.5"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    {lang === "bn" ? "ছবি বা প্রমাণের লিংক (ঐচ্ছিক)" : "Photo or evidence URL (optional)"}
                  </label>
                  <input
                    type="url"
                    placeholder="https://..."
                    value={sightingPhotoUrl}
                    onChange={(e) => setSightingPhotoUrl(e.target.value)}
                    className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 p-2.5"
                  />
                </div>

                <div className="pt-2 text-[11px] text-zinc-500">
                  {t.sighting_disclaimer}
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setIsSightingModalOpen(false)}
                    className="rounded-xl border border-zinc-300 dark:border-zinc-700 px-4 py-2 font-semibold text-zinc-700 dark:text-zinc-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={sightingSubmitting}
                    className="rounded-xl bg-red-600 px-5 py-2 font-bold text-white shadow-sm hover:bg-red-500 disabled:opacity-50"
                  >
                    {sightingSubmitting ? "Submitting..." : t.submit_sighting}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
