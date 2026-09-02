"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { apiFetch, getApiBaseUrl } from "@/lib/api";
import { MissingPersonSubmissionResponse } from "@/lib/types";

export default function CreateMissingPersonPage() {
  const { isAuthenticated, isLoading, isAdmin } = useAuth();

  // Form State
  const [fullName, setFullName] = useState("");
  const [nameBn, setNameBn] = useState("");
  const [age, setAge] = useState<number | "">("");
  const [approximateAge, setApproximateAge] = useState("");
  const [gender, setGender] = useState("MALE");
  const [height, setHeight] = useState("");
  const [clothing, setClothing] = useState("");
  const [clothingBn, setClothingBn] = useState("");
  const [identifyingFeatures, setIdentifyingFeatures] = useState("");
  const [identifyingFeaturesBn, setIdentifyingFeaturesBn] = useState("");
  const [lastSeenLocation, setLastSeenLocation] = useState("");
  const [lastSeenLocationBn, setLastSeenLocationBn] = useState("");
  const [lastSeenTime, setLastSeenTime] = useState("");
  const [contactInformation, setContactInformation] = useState("");
  const [reportingAuthority, setReportingAuthority] = useState("");
  const [description, setDescription] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isAnonymous, setIsAnonymous] = useState(false);

  // UI State
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successResponse, setSuccessResponse] = useState<MissingPersonSubmissionResponse | null>(null);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!fullName.trim()) {
      setError("Please provide the full name of the missing person.");
      return;
    }

    if (!lastSeenLocation.trim()) {
      setError("Please provide the last seen location.");
      return;
    }

    if (!contactInformation.trim()) {
      setError("Please provide emergency contact info or Police GD number.");
      return;
    }

    setSubmitting(true);

    try {
      // 1. Submit Missing Person details
      const payload = {
        full_name: fullName.trim(),
        name_bn: nameBn.trim() || undefined,
        age: age !== "" ? Number(age) : undefined,
        approximate_age: approximateAge.trim() || undefined,
        gender: gender || undefined,
        height: height.trim() || undefined,
        clothing: clothing.trim() || undefined,
        clothing_bn: clothingBn.trim() || undefined,
        identifying_features: identifyingFeatures.trim() || undefined,
        identifying_features_bn: identifyingFeaturesBn.trim() || undefined,
        last_seen_location: lastSeenLocation.trim(),
        last_seen_location_bn: lastSeenLocationBn.trim() || undefined,
        last_seen_time: lastSeenTime ? new Date(lastSeenTime).toISOString() : undefined,
        contact_information: contactInformation.trim(),
        reporting_authority: reportingAuthority.trim() || undefined,
        description: description.trim() || undefined,
        photo_url: photoUrl.trim() || undefined,
        is_anonymous: isAnonymous,
      };

      const res = await apiFetch<MissingPersonSubmissionResponse>("/missing-person/submit", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      // 2. If user selected a local photo file, upload it as media attachment
      if (photoFile && res.report_id) {
        try {
          const uploadForm = new FormData();
          uploadForm.append("file", photoFile);
          uploadForm.append("caption", `Photo of ${fullName.trim()}`);

          const mediaRes = await apiFetch<{ download_url: string }>(`/reports/${res.report_id}/media`, {
            method: "POST",
            body: uploadForm,
          });

          if (mediaRes && mediaRes.download_url) {
            // Update profile with photo download url
            const fullPhotoUrl = mediaRes.download_url.startsWith("http")
              ? mediaRes.download_url
              : `${getApiBaseUrl()}${mediaRes.download_url.replace(/^\/api\/v1/, "")}`;

            await apiFetch(`/missing-person/reports/${res.report_id}/profile`, {
              method: "POST",
              body: JSON.stringify({
                ...payload,
                photo_url: fullPhotoUrl,
              }),
            });
          }
        } catch {
          // Photo attachment error shouldn't block submission success
        }
      }

      setSuccessResponse(res);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to submit missing person report. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center text-xs text-zinc-500">
        Loading...
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 shadow-sm text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-300 text-2xl font-bold">
            🚨
          </div>
          <h1 className="text-xl font-black text-zinc-900 dark:text-zinc-100">
            Sign In Required to File Missing Person Report
          </h1>
          <p className="text-xs text-zinc-500 leading-relaxed">
            নিখোঁজ ব্যক্তির জরুরি রিপোর্ট বা অ্যালার্ট জারি করার জন্য ব্যবহারকারীর অ্যাকাউন্ট যাচাইকরণ প্রয়োজন। অনুগ্রহ করে সাইন-ইন করুন।
          </p>
          <div className="pt-3 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/login?redirect=/missing-person/create"
              className="w-full sm:w-auto rounded-xl bg-red-600 px-6 py-2.5 text-xs font-bold text-white hover:bg-red-500 transition shadow-sm"
            >
              Sign In to Continue →
            </Link>
            <Link
              href="/missing-person"
              className="w-full sm:w-auto rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-5 py-2.5 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 transition"
            >
              Back to Alerts
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* Header Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <Link href="/missing-person" className="hover:text-zinc-900 dark:hover:text-zinc-100 transition">
          ← Missing Person Network
        </Link>
        <span>/</span>
        <span className="text-zinc-900 dark:text-zinc-100 font-bold">File Missing Person Report</span>
      </div>

      {/* Success Confirmation View */}
      {successResponse ? (
        <div className="rounded-3xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50/70 dark:bg-emerald-950/40 p-8 shadow-sm space-y-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-300 text-3xl font-black">
            ✓
          </div>
          <div>
            <h2 className="text-xl font-black text-emerald-950 dark:text-emerald-100">
              {isAdmin ? "Missing Person Alert Activated!" : "Missing Person Report Submitted!"}
            </h2>
            <p className="text-xs text-emerald-800 dark:text-emerald-300 mt-2 max-w-lg mx-auto leading-relaxed">
              {successResponse.message}
            </p>
          </div>

          <div className="rounded-2xl bg-white dark:bg-zinc-900 p-5 border border-emerald-100 dark:border-emerald-900/60 max-w-md mx-auto text-left space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-zinc-500">Name:</span>
              <span className="font-bold text-zinc-900 dark:text-zinc-100">{successResponse.profile.full_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Last Seen:</span>
              <span className="font-bold text-zinc-900 dark:text-zinc-100">{successResponse.profile.last_seen_location}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Alert Status:</span>
              <span className="font-bold text-emerald-700 dark:text-emerald-400">{successResponse.status}</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link
              href={`/missing-person/${successResponse.alert_id}`}
              className="w-full sm:w-auto rounded-xl bg-emerald-700 px-6 py-2.5 text-xs font-bold text-white hover:bg-emerald-600 transition shadow-sm"
            >
              View Missing Person Alert →
            </Link>
            <Link
              href="/missing-person"
              className="w-full sm:w-auto rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-5 py-2.5 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 transition"
            >
              Return to Alert Feed
            </Link>
          </div>
        </div>
      ) : (
        /* Form Card */
        <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
          {/* Top Banner */}
          <div className="border-b border-zinc-100 dark:border-zinc-800 bg-gradient-to-r from-red-600/10 via-amber-500/5 to-transparent p-6 sm:p-8">
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-600 text-white text-2xl font-bold shadow-sm shrink-0">
                🚨
              </span>
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-zinc-100">
                  নিখোঁজ ব্যক্তির তথ্য দিন (Report Missing Person)
                </h1>
                <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                  Provide accurate details to help law enforcement, safety volunteers, and nearby citizens locate the missing person quickly.
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-8 text-xs">
            {error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40 p-4 text-xs font-semibold text-red-700 dark:text-red-300 flex items-center gap-2">
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            )}

            {/* Section 1: Biographical Information */}
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-2">
                <span>👤</span>
                <span>১. ব্যক্তির পরিচয় ও মৌলিক তথ্য (Identity & Bio)</span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Full Name (নাম ইংরেজিতে) *
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Rafiq Ahmed"
                    className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3.5 py-2.5 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Name in Bangla (নাম বাংলায়)
                  </label>
                  <input
                    type="text"
                    value={nameBn}
                    onChange={(e) => setNameBn(e.target.value)}
                    placeholder="যেমন: রফিক আহমেদ"
                    className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3.5 py-2.5 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Age (বয়স) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="120"
                    value={age}
                    onChange={(e) => setAge(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="e.g. 10"
                    className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3.5 py-2.5 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Approximate Age Range (আনুমানিক বয়স)
                  </label>
                  <input
                    type="text"
                    value={approximateAge}
                    onChange={(e) => setApproximateAge(e.target.value)}
                    placeholder="e.g. 8-10 years"
                    className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3.5 py-2.5 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Gender (লিঙ্গ) *
                  </label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3.5 py-2.5 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                  >
                    <option value="MALE">Male (পুরুষ)</option>
                    <option value="FEMALE">Female (নারী)</option>
                    <option value="OTHER">Other / Child (অন্যান্য / শিশু)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Height (উচ্চতা)
                  </label>
                  <input
                    type="text"
                    value={height}
                    onChange={(e) => setHeight(e.target.value)}
                    placeholder="e.g. 4 ft 8 in / ৪ ফুট ৮ ইঞ্চি"
                    className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3.5 py-2.5 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Photo Upload */}
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-2">
                <span>📸</span>
                <span>২. ব্যক্তির ছবি (Photo)</span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                <div className="space-y-2">
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300">
                    Upload Photo from Device (ডিভাইস থেকে ছবি আপলোড)
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoSelect}
                    className="w-full text-xs text-zinc-500 file:mr-3 file:py-2 file:px-3.5 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 dark:file:bg-emerald-950 dark:file:text-emerald-300"
                  />
                  <p className="text-[11px] text-zinc-400">
                    JPG, PNG, WebP supported. Max 10MB.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300">
                    Or Image URL (অথবা সরাসরি ছবির লিঙ্ক)
                  </label>
                  <input
                    type="url"
                    value={photoUrl}
                    onChange={(e) => setPhotoUrl(e.target.value)}
                    placeholder="https://example.com/photo.jpg"
                    className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3.5 py-2 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                  />
                </div>
              </div>

              {(photoPreview || photoUrl) && (
                <div className="mt-3 flex items-center gap-3 p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photoPreview || photoUrl}
                    alt="Preview"
                    className="h-16 w-16 rounded-xl object-cover border border-zinc-300 dark:border-zinc-600"
                  />
                  <div>
                    <p className="font-bold text-zinc-900 dark:text-zinc-100">Photo Attached</p>
                    <p className="text-[11px] text-zinc-400">This photo will be displayed on the public safety alert card.</p>
                  </div>
                </div>
              )}
            </div>

            {/* Section 3: Disappearance Details */}
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-2">
                <span>📍</span>
                <span>৩. নিখোঁজ হওয়ার স্থান ও বিবরণ (Last Seen & Features)</span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Last Seen Location (সর্বশেষ দেখার স্থান) *
                  </label>
                  <input
                    type="text"
                    required
                    value={lastSeenLocation}
                    onChange={(e) => setLastSeenLocation(e.target.value)}
                    placeholder="e.g. Near Mirpur 10 roundabout, Dhaka"
                    className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3.5 py-2.5 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Last Seen Date & Time (সর্বশেষ দেখার সময়)
                  </label>
                  <input
                    type="datetime-local"
                    value={lastSeenTime}
                    onChange={(e) => setLastSeenTime(e.target.value)}
                    className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3.5 py-2.5 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Clothing Worn (পরনে যা ছিল)
                  </label>
                  <input
                    type="text"
                    value={clothing}
                    onChange={(e) => setClothing(e.target.value)}
                    placeholder="e.g. Blue shirt, black pants, sandals"
                    className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3.5 py-2.5 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Identifying Features / Marks (শনাক্তকারী বিশেষ চিহ্ন)
                  </label>
                  <input
                    type="text"
                    value={identifyingFeatures}
                    onChange={(e) => setIdentifyingFeatures(e.target.value)}
                    placeholder="e.g. Birthmark on left cheek, wears spectacles, scar on forehead"
                    className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3.5 py-2.5 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                  />
                </div>
              </div>
            </div>

            {/* Section 4: Emergency Contacts & Police Info */}
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-2">
                <span>📞</span>
                <span>৪. যোগাযোগের নম্বর ও পুলিশ তথ্য (Emergency Contact & Authority)</span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Emergency Contact Number / Family Contact *
                  </label>
                  <input
                    type="text"
                    required
                    value={contactInformation}
                    onChange={(e) => setContactInformation(e.target.value)}
                    placeholder="e.g. 017xxxxxxxx (Father / Relative)"
                    className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3.5 py-2.5 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Police GD Number & Station (থানার জিডি নম্বর ও থানা)
                  </label>
                  <input
                    type="text"
                    value={reportingAuthority}
                    onChange={(e) => setReportingAuthority(e.target.value)}
                    placeholder="e.g. Mirpur Model Thana GD # 1245/2026"
                    className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3.5 py-2.5 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Additional Information / Circumstances (অতিরিক্ত তথ্য)
                  </label>
                  <textarea
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Provide any mental health status, health concerns, or circumstances surrounding the disappearance..."
                    className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3.5 py-2.5 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                  />
                </div>
              </div>
            </div>

            {/* Section 5: Privacy */}
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 bg-zinc-50/50 dark:bg-zinc-800/30 flex items-center justify-between gap-4">
              <div>
                <p className="font-bold text-zinc-900 dark:text-zinc-100">Anonymous Reporter</p>
                <p className="text-[11px] text-zinc-500">
                  Do not display your user profile name publicly on this alert.
                </p>
              </div>
              <input
                type="checkbox"
                checked={isAnonymous}
                onChange={(e) => setIsAnonymous(e.target.checked)}
                className="h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500"
              />
            </div>

            {/* Submit Action */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
              <Link
                href="/missing-person"
                className="rounded-xl border border-zinc-300 dark:border-zinc-700 px-5 py-2.5 font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 transition"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-xl bg-red-600 hover:bg-red-500 px-6 py-2.5 font-bold text-white transition shadow-sm disabled:opacity-50 flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>Submitting Alert...</span>
                  </>
                ) : (
                  <span>🚨 Publish Missing Person Alert</span>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
