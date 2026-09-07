"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { Category, Report } from "@/lib/types";
import EvidenceUploader, { SelectedFileItem } from "@/components/EvidenceUploader";
import { captureCurrentLocation, approximateCoordinates, suggestNearestArea } from "@/lib/location";
import ReportLocationMap from "@/components/ReportLocationMap";
import { useBackClose } from "@/lib/useBackClose";
import { registerBackHandler, BackPriority } from "@/lib/backButton";

export default function CreateReportPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);

  const [formData, setFormData] = useState({
    title: "",
    categoryId: "",
    description: "",
    locationText: "",
    latitude: null as number | null,
    longitude: null as number | null,
    locationAccuracy: null as number | null,
    incidentDate: "",
    isAnonymous: false,
  });

  const [isLocating, setIsLocating] = useState(false);
  const [locationNotice, setLocationNotice] = useState<{ type: "info" | "warning"; message: string } | null>(null);

  const [selectedFiles, setSelectedFiles] = useState<SelectedFileItem[]>([]);
  const [isReviewMode, setIsReviewMode] = useState(false);
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  // 1. Android Back on Discard Dialog -> Closes the dialog
  useBackClose(showDiscardModal, () => setShowDiscardModal(false), "reportDiscardModal", BackPriority.OVERLAY);

  // 2. Android Back on Review Step -> Returns to edit form without losing inputs
  useBackClose(isReviewMode, () => setIsReviewMode(false), "reportCreateReviewMode", BackPriority.FORM_STEP);

  // 3. Android Back with unsaved draft -> Intercepts and prompts discard confirmation
  const hasUnsavedContent = Boolean(formData.title.trim() || formData.description.trim() || selectedFiles.length > 0);
  useEffect(() => {
    if (!hasUnsavedContent || isReviewMode || showDiscardModal || submitting) return;

    return registerBackHandler("reportDraftSafety", BackPriority.FORM_DIRTY, () => {
      setShowDiscardModal(true);
      return true;
    });
  }, [hasUnsavedContent, isReviewMode, showDiscardModal, submitting]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    let isMounted = true;
    apiFetch<Category[]>("/categories")
      .then((data) => {
        if (isMounted) {
          setCategories(data);
          if (data.length > 0) {
            setFormData((prev) => ({ ...prev, categoryId: data[0].id }));
          }
        }
      })
      .catch((err) => {
        if (isMounted) setError(`Failed to load incident categories: ${err.message}`);
      })
      .finally(() => {
        if (isMounted) setCategoriesLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleUseCurrentLocation = async () => {
    setIsLocating(true);
    setLocationNotice(null);

    const { coordinates, error: locError } = await captureCurrentLocation({
      enableHighAccuracy: true,
      timeoutMs: 10000,
    });

    setIsLocating(false);

    if (locError) {
      setLocationNotice({
        type: "warning",
        message: locError.message,
      });
      return;
    }

    if (coordinates) {
      setFormData((prev) => ({
        ...prev,
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        locationAccuracy: coordinates.accuracy,
        locationText: prev.locationText.trim()
          ? prev.locationText
          : coordinates.suggestedAreaName || `Near ${coordinates.approximateLatitude.toFixed(3)}, ${coordinates.approximateLongitude.toFixed(3)}`,
      }));

      setLocationNotice({
        type: "info",
        message: `Current location attached (~${coordinates.approximateLatitude.toFixed(3)}, ${coordinates.approximateLongitude.toFixed(3)}). Privacy fuzzing applied.`,
      });
    }
  };

  const handleClearLocationCoordinates = () => {
    setFormData((prev) => ({
      ...prev,
      latitude: null,
      longitude: null,
      locationAccuracy: null,
    }));
    setLocationNotice(null);
  };

  const handlePickOnMap = () => {
    if (formData.latitude === null || formData.longitude === null) {
      // Default to Dhaka center (~23.810, 90.412)
      const defaultLat = 23.81;
      const defaultLng = 90.412;
      const suggested = suggestNearestArea(defaultLat, defaultLng);
      setFormData((prev) => ({
        ...prev,
        latitude: defaultLat,
        longitude: defaultLng,
        locationText: prev.locationText.trim()
          ? prev.locationText
          : (suggested || "Dhaka, Bangladesh"),
      }));
      setLocationNotice({
        type: "info",
        message: "Map pin placed. Drag the pin or tap anywhere on the map to adjust location.",
      });
    }
  };

  const handleMapLocationChange = (newLat: number, newLng: number) => {
    const approx = approximateCoordinates(newLat, newLng);
    const suggested = suggestNearestArea(approx.lat, approx.lng);
    setFormData((prev) => ({
      ...prev,
      latitude: approx.lat,
      longitude: approx.lng,
      locationText: prev.locationText.trim()
        ? prev.locationText
        : (suggested || `Near ${approx.lat.toFixed(3)}, ${approx.lng.toFixed(3)}`),
    }));
    setLocationNotice({
      type: "info",
      message: `Pin updated to ~${approx.lat.toFixed(3)}, ${approx.lng.toFixed(3)} (~110m privacy buffer applied).`,
    });
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    if (type === "checkbox") {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
    if (error) setError(null);
  };

  const validateForm = (): boolean => {
    if (!formData.title.trim() || formData.title.trim().length < 5) {
      setError("Title is required and must be at least 5 characters long.");
      return false;
    }
    if (!formData.categoryId) {
      setError("Please select an incident category.");
      return false;
    }
    if (!formData.description.trim() || formData.description.trim().length < 10) {
      setError("Description is required and must be at least 10 characters long.");
      return false;
    }
    if (!formData.locationText.trim() || formData.locationText.trim().length < 3) {
      setError("Location is required (e.g. Dhanmondi 27, Dhaka).");
      return false;
    }
    if (formData.incidentDate) {
      const selected = new Date(formData.incidentDate);
      if (selected > new Date()) {
        setError("Incident date and time cannot be in the future.");
        return false;
      }
    }
    return true;
  };

  const handleProceedToReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      setIsReviewMode(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleFinalSubmit = async () => {
    if (!validateForm()) return;

    setSubmitting(true);
    setError(null);
    setUploadStatus("Creating report draft...");

    try {
      const payload = {
        title: formData.title.trim(),
        category_id: formData.categoryId,
        description: formData.description.trim(),
        location_text: formData.locationText.trim(),
        latitude: formData.latitude,
        longitude: formData.longitude,
        incident_date: formData.incidentDate
          ? new Date(formData.incidentDate).toISOString()
          : null,
        is_anonymous: formData.isAnonymous,
      };

      const createdReport = await apiFetch<Report>("/reports", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      // Upload any selected media files
      if (selectedFiles.length > 0) {
        setUploadStatus(`Uploading ${selectedFiles.length} evidence attachment(s)...`);
        for (let i = 0; i < selectedFiles.length; i++) {
          const item = selectedFiles[i];
          const uploadForm = new FormData();
          uploadForm.append("file", item.file);
          if (item.caption.trim()) {
            uploadForm.append("caption", item.caption.trim());
          }

          await apiFetch(`/reports/${createdReport.id}/media`, {
            method: "POST",
            body: uploadForm,
          });
        }
      }

      // Submit for moderation
      setUploadStatus("Submitting report for moderation review...");
      await apiFetch<Report>(`/reports/${createdReport.id}/submit`, {
        method: "POST",
      });

      router.push(`/reports/${createdReport.id}?submitted=true`);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unexpected error occurred while submitting your report.");
      }
      setSubmitting(false);
      setUploadStatus(null);
    }
  };

  const selectedCategoryObj = categories.find((c) => c.id === formData.categoryId);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      {/* Header & Steps Indicator */}
      <div className="border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">
              Report a Civic Incident
            </h1>
            <p className="text-xs text-zinc-500 mt-0.5">
              Submit verifiable community issues for moderation and public action across Bangladesh.
            </p>
          </div>
          <Link
            href="/"
            className="text-xs font-semibold text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            ✕ Cancel
          </Link>
        </div>

        {/* 2-Step Bar */}
        <div className="grid grid-cols-2 gap-2 mt-4">
          <div
            className={`h-1.5 rounded-full transition ${
              !isReviewMode ? "bg-emerald-700" : "bg-emerald-200 dark:bg-emerald-950"
            }`}
          />
          <div
            className={`h-1.5 rounded-full transition ${
              isReviewMode ? "bg-emerald-700" : "bg-zinc-200 dark:bg-zinc-800"
            }`}
          />
        </div>
        <div className="flex justify-between text-[11px] font-bold text-zinc-500 mt-1">
          <span className={!isReviewMode ? "text-emerald-700 dark:text-emerald-400" : ""}>
            1. Details & Evidence
          </span>
          <span className={isReviewMode ? "text-emerald-700 dark:text-emerald-400" : ""}>
            2. Review & Submit
          </span>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl bg-red-50 dark:bg-red-950/50 p-4 border border-red-200 dark:border-red-900">
          <p className="text-xs font-bold text-red-800 dark:text-red-300">⚠️ {error}</p>
        </div>
      )}

      {!isReviewMode ? (
        <form onSubmit={handleProceedToReview} className="space-y-6">
          {/* Incident Category */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-zinc-900 dark:text-zinc-100">
              Incident Category <span className="text-red-500">*</span>
            </label>
            {categoriesLoading ? (
              <div className="h-10 bg-zinc-100 dark:bg-zinc-800 rounded-xl animate-pulse" />
            ) : (
              <select
                name="categoryId"
                value={formData.categoryId}
                onChange={handleChange}
                required
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3.5 py-2.5 text-xs text-zinc-900 dark:text-zinc-100 font-medium focus:border-emerald-700 focus:outline-none focus:ring-1 focus:ring-emerald-700"
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name} — {cat.description || "Civic Hazard"}
                  </option>
                ))}
              </select>
            )}

            {selectedCategoryObj && (selectedCategoryObj.slug?.includes("missing-person") || selectedCategoryObj.name?.toLowerCase().includes("missing person")) && (
              <div className="rounded-2xl border border-red-200 dark:border-red-900 bg-red-50/80 dark:bg-red-950/50 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs mt-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🚨</span>
                  <span className="text-red-900 dark:text-red-200 font-medium">
                    Reporting a missing person? Use our dedicated alert form to include photo, age, clothing, and physical markings.
                  </span>
                </div>
                <Link
                  href="/missing-person/create"
                  className="rounded-xl bg-red-600 hover:bg-red-500 px-3.5 py-1.5 text-xs font-bold text-white transition shadow-sm shrink-0 self-start sm:self-auto"
                >
                  Open Missing Person Form →
                </Link>
              </div>
            )}
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-zinc-900 dark:text-zinc-100">
              Incident Title <span className="text-red-500">*</span>
            </label>
            <input
              name="title"
              type="text"
              required
              value={formData.title}
              onChange={handleChange}
              placeholder="e.g. Broken water pipeline causing severe flooding near Mirpur 10"
              className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3.5 py-2.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:border-emerald-700 focus:outline-none focus:ring-1 focus:ring-emerald-700"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-zinc-900 dark:text-zinc-100">
              Detailed Description <span className="text-red-500">*</span>
            </label>
            <textarea
              name="description"
              required
              rows={4}
              value={formData.description}
              onChange={handleChange}
              placeholder="Describe what happened, exact landmarks, severity of risk, and how long the issue has persisted..."
              className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3.5 py-2.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:border-emerald-700 focus:outline-none focus:ring-1 focus:ring-emerald-700 leading-relaxed"
            />
          </div>

          {/* Location & Incident Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-zinc-900 dark:text-zinc-100">
                  Location / Landmark <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePickOnMap}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 transition"
                    title="Select pin location on map"
                  >
                    <span>🗺️ Pin on Map</span>
                  </button>
                  <span className="text-zinc-300 dark:text-zinc-600 text-xs">•</span>
                  <button
                    type="button"
                    onClick={handleUseCurrentLocation}
                    disabled={isLocating}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 disabled:opacity-50 transition"
                    title="Detect current device location"
                  >
                    {isLocating ? (
                      <>
                        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                        <span>Locating...</span>
                      </>
                    ) : (
                      <span>📍 Use My Location</span>
                    )}
                  </button>
                </div>
              </div>

              <input
                name="locationText"
                type="text"
                required
                value={formData.locationText}
                onChange={handleChange}
                placeholder="e.g. Road 27, Dhanmondi, Dhaka"
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3.5 py-2.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:border-emerald-700 focus:outline-none focus:ring-1 focus:ring-emerald-700"
              />

              {/* GPS Coordinates Badge */}
              {formData.latitude !== null && formData.longitude !== null && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 px-3 py-1.5 text-[11px]">
                    <div className="flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300">
                      <span>🛡️</span>
                      <span className="font-semibold">GPS:</span>
                      <span>
                        ~{formData.latitude.toFixed(3)}, {formData.longitude.toFixed(3)}
                      </span>
                      <span className="text-emerald-600 dark:text-emerald-400 text-[10px] bg-emerald-100 dark:bg-emerald-900/60 px-1.5 py-0.5 rounded font-medium">
                        Fuzzed ~110m
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleClearLocationCoordinates}
                      className="text-zinc-500 hover:text-red-500 font-bold transition text-xs"
                      title="Remove attached GPS coordinates"
                    >
                      ✕ Remove
                    </button>
                  </div>

                  {/* Interactive Map Preview with Privacy Circle */}
                  <ReportLocationMap
                    latitude={formData.latitude}
                    longitude={formData.longitude}
                    interactive={true}
                    height="180px"
                    onLocationChange={handleMapLocationChange}
                    caption="Tap map or drag pin to adjust location"
                  />
                </div>
              )}

              {/* Location Notice / Error */}
              {locationNotice && (
                <div
                  className={`flex items-start justify-between gap-2 rounded-xl p-2.5 text-[11px] ${
                    locationNotice.type === "warning"
                      ? "bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-200"
                      : "bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-200"
                  }`}
                >
                  <div className="flex items-start gap-1.5">
                    <span>{locationNotice.type === "warning" ? "⚠️" : "ℹ️"}</span>
                    <span>{locationNotice.message}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLocationNotice(null)}
                    className="text-zinc-400 hover:text-zinc-700 font-bold ml-1"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-zinc-900 dark:text-zinc-100">
                Date & Time of Incident (Optional)
              </label>
              <input
                name="incidentDate"
                type="datetime-local"
                value={formData.incidentDate}
                onChange={handleChange}
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3.5 py-2 text-xs text-zinc-900 dark:text-zinc-100 focus:border-emerald-700 focus:outline-none focus:ring-1 focus:ring-emerald-700"
              />
            </div>
          </div>

          {/* Evidence File Uploader */}
          <div className="space-y-2 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md p-4 sm:p-5 shadow-2xs">
            <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
              Photographic / Document Evidence
            </h3>
            <p className="text-[11px] text-zinc-500 leading-relaxed">
              Upload clear images or documents (JPEG, PNG, WebP, PDF, max 10MB). Photos increase verification speed by 80%.
            </p>
            <EvidenceUploader
              onFilesChange={setSelectedFiles}
            />
          </div>

          {/* Anonymous Reporting Checkbox */}
          <div className="rounded-2xl border border-purple-200/80 dark:border-purple-900/60 bg-purple-50/70 dark:bg-purple-950/30 backdrop-blur-xs p-4 flex items-start gap-3 shadow-2xs">
            <input
              type="checkbox"
              id="isAnonymous"
              name="isAnonymous"
              checked={formData.isAnonymous}
              onChange={handleChange}
              className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-purple-600 focus:ring-purple-500"
            />
            <label htmlFor="isAnonymous" className="text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer">
              <span className="font-bold text-purple-900 dark:text-purple-300 block">
                🛡️ Submit as Anonymous Citizen
              </span>
              Your username and identity will be shielded completely from the public feed. Only platform compliance records will note your account securely.
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="submit"
              className="w-full sm:w-auto rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white px-6 py-2.5 text-xs font-bold shadow-md shadow-emerald-700/30 transition active:scale-[0.98] min-h-[44px] flex items-center justify-center cursor-pointer"
            >
              Continue to Review →
            </button>
          </div>
        </form>
      ) : (
        /* Step 2: Review Screen */
        <div className="space-y-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-8 shadow-sm">
          <div className="border-b border-zinc-100 dark:border-zinc-800 pb-4">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Review Before Submission
            </span>
            <h2 className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-zinc-100 mt-1">
              {formData.title}
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-zinc-400 block font-medium">Category</span>
              <span className="font-bold text-zinc-900 dark:text-zinc-100">
                {selectedCategoryObj?.name || "Civic Incident"}
              </span>
            </div>

            <div>
              <span className="text-zinc-400 block font-medium">Location</span>
              <span className="font-bold text-zinc-900 dark:text-zinc-100">
                📍 {formData.locationText}
              </span>
              {formData.latitude !== null && formData.longitude !== null ? (
                <div className="mt-1 space-y-1.5">
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block">
                    🛡️ GPS Attached: ~{formData.latitude.toFixed(3)}, {formData.longitude.toFixed(3)} (Fuzzed ~110m)
                  </span>
                  <ReportLocationMap
                    latitude={formData.latitude}
                    longitude={formData.longitude}
                    interactive={false}
                    height="120px"
                    caption="Verified location (~110m privacy buffer)"
                  />
                </div>
              ) : (
                <span className="text-[10px] text-zinc-400 block mt-0.5">
                  📝 Manual landmark only
                </span>
              )}
            </div>

            <div>
              <span className="text-zinc-400 block font-medium">Date & Time</span>
              <span className="font-bold text-zinc-900 dark:text-zinc-100">
                {formData.incidentDate
                  ? new Date(formData.incidentDate).toLocaleString()
                  : "Not specified (Recent)"}
              </span>
            </div>

            <div>
              <span className="text-zinc-400 block font-medium">Identity Mode</span>
              <span className="font-bold text-zinc-900 dark:text-zinc-100">
                {formData.isAnonymous ? "🛡️ Anonymous Citizen" : `👤 ${user?.username}`}
              </span>
            </div>
          </div>

          <div>
            <span className="text-xs text-zinc-400 block font-medium mb-1">Description</span>
            <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed bg-zinc-50 dark:bg-zinc-800/60 p-3.5 rounded-xl border border-zinc-100 dark:border-zinc-800 whitespace-pre-wrap">
              {formData.description}
            </p>
          </div>

          {selectedFiles.length > 0 && (
            <div>
              <span className="text-xs text-zinc-400 block font-medium mb-2">
                Attached Evidence ({selectedFiles.length} file{selectedFiles.length > 1 ? "s" : ""})
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {selectedFiles.map((f, i) => (
                  <div
                    key={f.id || i}
                    className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 text-[11px] border border-zinc-200 dark:border-zinc-700 flex items-center gap-2.5 shadow-2xs"
                  >
                    {f.previewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={f.previewUrl}
                        alt={f.file.name}
                        className="w-10 h-10 rounded-lg object-cover border border-zinc-200 dark:border-zinc-700 shrink-0"
                      />
                    ) : (
                      <span className="text-xl shrink-0">📎</span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-zinc-800 dark:text-zinc-200 truncate">
                        {f.file.name}
                      </p>
                      {f.caption && (
                        <p className="text-[10px] text-zinc-500 truncate italic">
                          &ldquo;{f.caption}&rdquo;
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {submitting && uploadStatus && (
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 p-3.5 border border-emerald-200 dark:border-emerald-900 flex items-center gap-3">
              <div className="h-4 w-4 rounded-full border-2 border-emerald-700 border-t-transparent animate-spin shrink-0" />
              <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                {uploadStatus}
              </p>
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
            <button
              type="button"
              disabled={submitting}
              onClick={() => setIsReviewMode(false)}
              className="w-full sm:w-auto rounded-xl border border-zinc-200 dark:border-zinc-700 px-5 py-2.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition min-h-[44px] flex items-center justify-center cursor-pointer"
            >
              ← Edit Details
            </button>

            <button
              type="button"
              disabled={submitting}
              onClick={handleFinalSubmit}
              className="w-full sm:w-auto rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white px-7 py-2.5 text-xs font-bold shadow-md shadow-emerald-800/20 disabled:opacity-50 transition active:scale-98 min-h-[44px] flex items-center justify-center cursor-pointer"
            >
              {submitting ? "Submitting..." : "Submit Incident Report ✓"}
            </button>
          </div>
        </div>
      )}

      {/* Discard Draft Confirmation Dialog */}
      {showDiscardModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-xs"
          onClick={() => setShowDiscardModal(false)}
        >
          <div
            className="relative w-full max-w-sm rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 font-bold text-lg">
                ⚠️
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  Discard Report Draft?
                </h3>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  Unsaved changes will be lost
                </p>
              </div>
            </div>

            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              You have started entering incident report details. Are you sure you want to leave and discard this draft?
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowDiscardModal(false)}
                className="rounded-xl border border-zinc-200 dark:border-zinc-700 px-4 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition min-h-[38px]"
              >
                Keep Editing
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDiscardModal(false);
                  router.back();
                }}
                className="rounded-xl bg-red-600 hover:bg-red-700 text-white px-4 py-2 text-xs font-bold transition shadow-xs min-h-[38px]"
              >
                Discard & Exit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
