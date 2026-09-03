"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { PublicMissingPersonAlertResponse, PublicMissingPersonSightingResponse } from "@/lib/types";
import { translations, Language } from "@/lib/i18n";

export default function MissingPersonDetailPage() {
  const params = useParams();
  const alertId = params.id as string;

  const [lang, setLang] = useState<Language>("en");
  const t = translations[lang];

  const [alert, setAlert] = useState<PublicMissingPersonAlertResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // "I Saw This Person" Modal State
  const [isSightingModalOpen, setIsSightingModalOpen] = useState(false);
  const [sightingLocation, setSightingLocation] = useState("");
  const [sightingDate, setSightingDate] = useState(new Date().toISOString().split("T")[0]);
  const [sightingTime, setSightingTime] = useState("");
  const [sightingDesc, setSightingDesc] = useState("");
  const [sightingClothing, setSightingClothing] = useState("");
  const [sightingDirection, setSightingDirection] = useState("");
  const [sightingAdditional, setSightingAdditional] = useState("");
  const [sightingPhotoUrl, setSightingPhotoUrl] = useState("");
  const [sightingLat, setSightingLat] = useState<number | null>(null);
  const [sightingLng, setSightingLng] = useState<number | null>(null);
  const [isLocating, setIsLocating] = useState(false);

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

  // One-time browser geolocation handler (zero continuous tracking)
  const handleGetOneTimeLocation = () => {
    if (typeof window !== "undefined" && !navigator.geolocation) {
      window.alert("Geolocation is not supported by your browser.");
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setSightingLat(pos.coords.latitude);
        setSightingLng(pos.coords.longitude);
        if (!sightingLocation) {
          setSightingLocation(`GPS Coordinates (~${pos.coords.latitude.toFixed(3)}, ~${pos.coords.longitude.toFixed(3)})`);
        }
        setIsLocating(false);
      },
      (err) => {
        console.warn("Location error:", err.message);
        setIsLocating(false);
      },
      { timeout: 10000, enableHighAccuracy: false }
    );
  };

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
            latitude: sightingLat,
            longitude: sightingLng,
            sighting_date: sightingDate ? new Date(sightingDate).toISOString() : null,
            sighting_time: sightingTime.trim() || null,
            description: sightingDesc.trim(),
            clothing: sightingClothing.trim() || null,
            direction: sightingDirection.trim() || null,
            additional_information: sightingAdditional.trim() || null,
            photo_url: sightingPhotoUrl.trim() || null,
          }),
        }
      );
      setSightingSuccess(true);
      setSightingLocation("");
      setSightingTime("");
      setSightingDesc("");
      setSightingClothing("");
      setSightingDirection("");
      setSightingAdditional("");
      setSightingPhotoUrl("");
      setSightingLat(null);
      setSightingLng(null);
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
  const isAlertActive = alert.status === "ALERT_ACTIVE" && alert.is_active;

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

      {/* Inactive / Found Banner */}
      {!isAlertActive && (
        <div className="rounded-3xl bg-blue-50 dark:bg-blue-950/40 p-5 border border-blue-200 dark:border-blue-900/60 shadow-xs flex items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs font-extrabold text-blue-900 dark:text-blue-200 flex items-center gap-1.5 uppercase tracking-wider">
              <span>ℹ️</span>
              <span>{alert.status === "FOUND" ? t.status_found : t.alert_no_longer_active}</span>
            </div>
            <p className="text-xs text-blue-800 dark:text-blue-300">
              {lang === "bn"
                ? "এই সন্ধান সতর্কতার কার্যক্রম সম্পন্ন হয়েছে। নতুন কোনো দেখার তথ্য জমা দেওয়া যাবে না।"
                : "This missing person search has concluded. New sighting submissions are disabled."}
            </p>
          </div>
          <span className="rounded-xl bg-blue-600 text-white font-bold text-xs px-3.5 py-1.5 shadow-xs shrink-0">
            {alert.status}
          </span>
        </div>
      )}

      {/* Main Alert Profile Card */}
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
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
              alert.status === "ALERT_ACTIVE"
                ? "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400"
                : alert.status === "FOUND"
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
                : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
            }`}>
              <span className={`h-2 w-2 rounded-full ${alert.status === "ALERT_ACTIVE" ? "bg-red-500 animate-ping" : "bg-emerald-500"}`} />
              {alert.status === "ALERT_ACTIVE" ? t.status_active : alert.status === "FOUND" ? t.status_found : alert.status}
            </span>
          </div>
        </div>

        {/* Profile Content */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Photo */}
          <div className="md:col-span-1">
            <div className="relative aspect-3/4 w-full rounded-2xl overflow-hidden bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-inner flex items-center justify-center">
              {profile.photo_url ? (
                <img
                  src={profile.photo_url}
                  alt={profile.full_name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="text-center p-4 text-zinc-400">
                  <span className="text-5xl block mb-2">👤</span>
                  <span className="text-xs font-semibold">No Photo Provided</span>
                </div>
              )}
            </div>
          </div>

          {/* Details */}
          <div className="md:col-span-2 space-y-4">
            <div>
              <h1 className="text-2xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">
                {lang === "bn" && profile.name_bn ? profile.name_bn : profile.full_name}
              </h1>
              {profile.name_bn && lang !== "bn" && (
                <p className="text-xs text-zinc-500 font-medium mt-0.5">{profile.name_bn}</p>
              )}
            </div>

            {/* Key Physical Metadata Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {profile.age && (
                <div className="rounded-xl bg-zinc-50 dark:bg-zinc-800/40 p-3 border border-zinc-100 dark:border-zinc-800">
                  <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block">{t.age}</span>
                  <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200">{profile.age} yrs</span>
                </div>
              )}

              {profile.gender && (
                <div className="rounded-xl bg-zinc-50 dark:bg-zinc-800/40 p-3 border border-zinc-100 dark:border-zinc-800">
                  <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block">{t.gender}</span>
                  <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200">{profile.gender}</span>
                </div>
              )}

              {profile.height && (
                <div className="rounded-xl bg-zinc-50 dark:bg-zinc-800/40 p-3 border border-zinc-100 dark:border-zinc-800">
                  <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block">{t.height}</span>
                  <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200">{profile.height}</span>
                </div>
              )}
            </div>

            {/* Location & Time Last Seen */}
            <div className="space-y-2 rounded-2xl bg-red-50/50 dark:bg-red-950/20 p-4 border border-red-100 dark:border-red-900/30 text-xs">
              <div className="flex items-start gap-2">
                <span className="text-red-600 font-bold">📍</span>
                <div>
                  <span className="font-semibold text-zinc-500">{t.last_seen_near}: </span>
                  <span className="font-bold text-zinc-900 dark:text-zinc-100">
                    {lang === "bn" && profile.last_seen_location_bn ? profile.last_seen_location_bn : profile.last_seen_location}
                  </span>
                </div>
              </div>

              {profile.last_seen_time && (
                <div className="flex items-center gap-2">
                  <span className="text-red-600 font-bold">🕒</span>
                  <div>
                    <span className="font-semibold text-zinc-500">{t.last_seen_time}: </span>
                    <span className="font-bold text-zinc-900 dark:text-zinc-100">
                      {new Date(profile.last_seen_time).toLocaleString()}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Clothing & Identifying Features */}
            <div className="space-y-2 text-xs">
              {profile.clothing && (
                <div>
                  <span className="font-bold text-zinc-700 dark:text-zinc-300">{t.clothing}: </span>
                  <span className="text-zinc-600 dark:text-zinc-400">
                    {lang === "bn" && profile.clothing_bn ? profile.clothing_bn : profile.clothing}
                  </span>
                </div>
              )}

              {profile.identifying_features && (
                <div>
                  <span className="font-bold text-zinc-700 dark:text-zinc-300">{t.identifying_details}: </span>
                  <span className="text-zinc-600 dark:text-zinc-400">
                    {lang === "bn" && profile.identifying_features_bn ? profile.identifying_features_bn : profile.identifying_features}
                  </span>
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
        {isAlertActive && (
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

      {/* Chronological Sightings Timeline Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <span>🛡️</span> {t.sightings_timeline_title} ({alert.approved_sightings.length})
          </h2>
          <span className="text-xs font-semibold text-zinc-400">
            {lang === "bn" ? "যাচাইকৃত দেখার তথ্য" : "Platform-Reviewed Sightings"}
          </span>
        </div>

        {alert.approved_sightings.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-zinc-200 dark:border-zinc-800 p-8 text-center text-xs text-zinc-500">
            {t.no_sightings}
          </div>
        ) : (
          <div className="relative border-l-2 border-red-200 dark:border-red-900/60 ml-4 pl-6 space-y-6">
            {alert.approved_sightings.map((sighting) => (
              <div key={sighting.id} className="relative group space-y-2">
                {/* Timeline Node Dot */}
                <div className="absolute -left-[31px] top-1.5 h-3.5 w-3.5 rounded-full border-2 border-white dark:border-zinc-900 bg-red-600 shadow-xs" />

                <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-2 shadow-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-zinc-900 dark:text-zinc-100">
                        {sighting.sighting_date ? new Date(sighting.sighting_date).toLocaleDateString() : new Date(sighting.created_at).toLocaleDateString()}
                        {sighting.sighting_time ? ` — ${sighting.sighting_time}` : ""}
                      </span>
                      <span className="rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 text-[10px] font-bold px-2 py-0.5">
                        {t.platform_reviewed_sighting}
                      </span>
                    </div>
                    <span className="font-bold text-red-600 dark:text-red-400 flex items-center gap-1">
                      <span>📍</span> Reported near {sighting.approximate_location}
                    </span>
                  </div>

                  <p className="text-xs leading-relaxed text-zinc-700 dark:text-zinc-300 font-medium">
                    {sighting.description}
                  </p>

                  {(sighting.clothing || sighting.direction) && (
                    <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-zinc-500">
                      {sighting.clothing && (
                        <div>
                          <strong>{t.sighting_clothing_label}:</strong> {sighting.clothing}
                        </div>
                      )}
                      {sighting.direction && (
                        <div>
                          <strong>{t.sighting_direction_label}:</strong> {sighting.direction}
                        </div>
                      )}
                    </div>
                  )}

                  {sighting.photo_url && (
                    <div className="pt-2">
                      <a
                        href={sighting.photo_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:underline"
                      >
                        <span>📷</span>
                        <span>{lang === "bn" ? "প্রমাণের ছবি দেখুন" : "View Sighting Photo"} →</span>
                      </a>
                    </div>
                  )}
                </div>
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
                  {t.sighting_submitted_confirmation}
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

                {/* Location with 1-time GPS helper */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold text-zinc-700 dark:text-zinc-300">
                      {t.approx_location_label}
                    </label>
                    <button
                      type="button"
                      onClick={handleGetOneTimeLocation}
                      disabled={isLocating}
                      className="text-[11px] font-bold text-emerald-600 hover:text-emerald-500 flex items-center gap-1"
                    >
                      <span>📍</span>
                      <span>{isLocating ? "Getting Location..." : "Use Current Location (1-time)"}</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    placeholder={lang === "bn" ? "উদা: ধানমন্ডি ২৭ মীনা বাজার সংলগ্ন" : "e.g. Near Mirpur-10 round about"}
                    value={sightingLocation}
                    onChange={(e) => setSightingLocation(e.target.value)}
                    className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 p-2.5"
                  />
                </div>

                {/* Date & Time Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Date Seen *
                    </label>
                    <input
                      type="date"
                      required
                      value={sightingDate}
                      onChange={(e) => setSightingDate(e.target.value)}
                      className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 p-2.5"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      {t.sighting_time_label}
                    </label>
                    <input
                      type="text"
                      placeholder={lang === "bn" ? "উদা: আজ সন্ধ্যা ৬:৩০" : "e.g. Around 6:30 PM"}
                      value={sightingTime}
                      onChange={(e) => setSightingTime(e.target.value)}
                      className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 p-2.5"
                    />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    {t.sighting_desc_label}
                  </label>
                  <textarea
                    required
                    rows={3}
                    placeholder={lang === "bn" ? "ব্যক্তিটিকে কী অবস্থায় দেখেছেন, কার সাথে ছিলেন ইত্যাদি লিখুন..." : "Describe what the person was doing, appearance, condition..."}
                    value={sightingDesc}
                    onChange={(e) => setSightingDesc(e.target.value)}
                    className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 p-2.5"
                  />
                </div>

                {/* Optional Details: Clothing & Direction */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      {t.sighting_clothing_label} (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder={lang === "bn" ? "উদা: লাল শার্ট ও জিন্স" : "e.g. Red shirt, jeans"}
                      value={sightingClothing}
                      onChange={(e) => setSightingClothing(e.target.value)}
                      className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 p-2.5"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      {t.sighting_direction_label} (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder={lang === "bn" ? "উদা: বাসে করে গাবতলীর দিকে" : "e.g. Walked towards market"}
                      value={sightingDirection}
                      onChange={(e) => setSightingDirection(e.target.value)}
                      className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 p-2.5"
                    />
                  </div>
                </div>

                {/* Photo / Evidence URL */}
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
