"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { Category, Report, DraftReportPreview, DuplicateCandidateItem, DuplicateDetectionResponse } from "@/lib/types";
import EvidenceUploader, { SelectedFileItem } from "@/components/EvidenceUploader";
import AIEmergencyAssistantModal from "@/components/AIEmergencyAssistantModal";
import AIVoiceEmergencyModal from "@/components/AIVoiceEmergencyModal";
import {
  captureCurrentLocation,
  approximateCoordinates,
  suggestNearestArea,
  openNativeAppSettings,
  openNativeLocationSettings,
} from "@/lib/location";
import ReportLocationMap from "@/components/ReportLocationMap";
import { useBackClose } from "@/lib/useBackClose";
import { registerBackHandler, BackPriority } from "@/lib/backButton";
import { Sparkles, Bot, AlertTriangle, MapPin, Map, Shield, X, Info, FileText, User, Paperclip, Check, Mic } from "lucide-react";

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
  const [locationNotice, setLocationNotice] = useState<{
    type: "info" | "warning";
    message: string;
    action?: "app_settings" | "location_settings";
  } | null>(null);

  const [selectedFiles, setSelectedFiles] = useState<SelectedFileItem[]>([]);
  const [isReviewMode, setIsReviewMode] = useState(false);
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [isAIAssistantOpen, setIsAIAssistantOpen] = useState(false);
  const [isVoiceAssistantOpen, setIsVoiceAssistantOpen] = useState(false);
  const [duplicateCandidate, setDuplicateCandidate] = useState<DuplicateCandidateItem | null>(null);

  const handleApplyAIDraft = (draft: DraftReportPreview) => {
    setFormData((prev) => ({
      ...prev,
      title: draft.title || prev.title,
      categoryId: draft.category_id || prev.categoryId,
      description: draft.description || prev.description,
      locationText: draft.location_text || prev.locationText,
      latitude: draft.latitude !== undefined && draft.latitude !== null ? draft.latitude : prev.latitude,
      longitude: draft.longitude !== undefined && draft.longitude !== null ? draft.longitude : prev.longitude,
    }));
    setIsReviewMode(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

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
        action: locError.canOpenSettings
          ? locError.code === "SERVICES_DISABLED"
            ? "location_settings"
            : "app_settings"
          : undefined,
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

  const handleProceedToReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      setIsReviewMode(true);
      window.scrollTo({ top: 0, behavior: "smooth" });

      // Non-blocking duplicate detection scan
      try {
        const dupRes = await apiFetch<DuplicateDetectionResponse>("/reports/duplicate-check", {
          method: "POST",
          body: JSON.stringify({
            title: formData.title.trim(),
            description: formData.description.trim(),
            category_id: formData.categoryId,
            latitude: formData.latitude,
            longitude: formData.longitude,
            location_text: formData.locationText.trim(),
          }),
        });
        if (dupRes.is_potential_duplicate && dupRes.candidates && dupRes.candidates.length > 0) {
          setDuplicateCandidate(dupRes.candidates[0]);
        } else {
          setDuplicateCandidate(null);
        }
      } catch {
        // Continue smoothly if duplicate endpoint fails
      }
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
            className="text-xs font-semibold text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 inline-flex items-center gap-1"
          >
            <X className="h-4 w-4" />
            <span>Cancel</span>
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
        <div className="rounded-2xl bg-red-50 dark:bg-red-950/50 p-4 border border-red-200 dark:border-red-900 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
          <p className="text-xs font-bold text-red-800 dark:text-red-300">{error}</p>
        </div>
      )}

      {!isReviewMode ? (
        <form onSubmit={handleProceedToReview} className="space-y-6">
          {/* AI Emergency Assistant Banner */}
          <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/30 border border-blue-200/80 dark:border-blue-900/60 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-600/10 dark:bg-blue-400/20 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-lg shrink-0">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                  <span>AI Emergency Assistant</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-300 font-semibold">
                    Bangla + English
                  </span>
                </h3>
                <p className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-0.5">
                  Describe what you saw naturally — AI structures your report and verifies key details.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setIsVoiceAssistantOpen(true)}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold rounded-xl shadow transition shrink-0 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Mic className="h-4 w-4" />
                <span>Report with Voice</span>
              </button>
              <button
                type="button"
                onClick={() => setIsAIAssistantOpen(true)}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow transition shrink-0 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="h-4 w-4" />
                <span>Create with AI</span>
              </button>
            </div>
          </div>

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
                  <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0" />
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
                    <Map className="h-3.5 w-3.5" />
                    <span>Pin on Map</span>
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
                      <>
                        <MapPin className="h-3.5 w-3.5" />
                        <span>Use My Location</span>
                      </>
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
                      <Shield className="h-3.5 w-3.5" />
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
                      className="text-zinc-500 hover:text-red-500 font-bold transition text-xs inline-flex items-center gap-1"
                      title="Remove attached GPS coordinates"
                    >
                      <X className="h-3 w-3" />
                      <span>Remove</span>
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
                  className={`flex items-center justify-between gap-2.5 rounded-xl p-2.5 text-[11px] ${
                    locationNotice.type === "warning"
                      ? "bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-200"
                      : "bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-200"
                  }`}
                >
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    {locationNotice.type === "warning" ? (
                      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                    ) : (
                      <Info className="h-4 w-4 shrink-0 text-emerald-600" />
                    )}
                    <span className="break-words leading-relaxed">{locationNotice.message}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {locationNotice.action === "app_settings" && (
                      <button
                        type="button"
                        onClick={() => openNativeAppSettings()}
                        className="px-2 py-1 text-[10px] font-bold rounded-lg bg-amber-600 text-white hover:bg-amber-700 active:scale-95 transition cursor-pointer"
                      >
                        Settings
                      </button>
                    )}
                    {locationNotice.action === "location_settings" && (
                      <button
                        type="button"
                        onClick={() => openNativeLocationSettings()}
                        className="px-2 py-1 text-[10px] font-bold rounded-lg bg-amber-600 text-white hover:bg-amber-700 active:scale-95 transition cursor-pointer"
                      >
                        GPS Settings
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setLocationNotice(null)}
                      className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 font-bold p-1 min-h-[24px] min-w-[24px] flex items-center justify-center cursor-pointer"
                      aria-label="Dismiss notice"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
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
              <span className="font-bold text-purple-900 dark:text-purple-300 flex items-center gap-1.5">
                <Shield className="h-4 w-4" />
                <span>Submit as Anonymous Citizen</span>
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

          {/* Potential Corroborating Duplicate Notice */}
          {duplicateCandidate && (
            <div className="p-3.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 rounded-xl text-xs space-y-1">
              <span className="font-bold text-blue-800 dark:text-blue-300 flex items-center gap-1.5">
                <Info className="h-4 w-4 shrink-0" />
                <span>Corroboration Match: Similar incident reported nearby</span>
              </span>
              <p className="text-zinc-600 dark:text-zinc-400">
                A similar report &quot;{duplicateCandidate.title}&quot; was recently submitted in this area. Submitting your report will corroborate this community event.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-zinc-400 block font-medium">Category</span>
              <span className="font-bold text-zinc-900 dark:text-zinc-100">
                {selectedCategoryObj?.name || "Civic Incident"}
              </span>
            </div>

            <div>
              <span className="text-zinc-400 block font-medium">Location</span>
              <span className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                <span>{formData.locationText}</span>
              </span>
              {formData.latitude !== null && formData.longitude !== null ? (
                <div className="mt-1 space-y-1.5">
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <Shield className="h-3 w-3 shrink-0" />
                    <span>GPS Attached: ~{formData.latitude.toFixed(3)}, {formData.longitude.toFixed(3)} (Fuzzed ~110m)</span>
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
                <span className="text-[10px] text-zinc-400 flex items-center gap-1 mt-0.5">
                  <FileText className="h-3 w-3 shrink-0" />
                  <span>Manual landmark only</span>
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
              <span className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1">
                {formData.isAnonymous ? (
                  <>
                    <Shield className="h-3.5 w-3.5 text-purple-600 shrink-0" />
                    <span>Anonymous Citizen</span>
                  </>
                ) : (
                  <>
                    <User className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                    <span>{user?.username}</span>
                  </>
                )}
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
                      <Paperclip className="h-5 w-5 text-zinc-400 shrink-0" />
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
              className="w-full sm:w-auto rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white px-7 py-2.5 text-xs font-bold shadow-md shadow-emerald-800/20 disabled:opacity-50 transition active:scale-98 min-h-[44px] flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>{submitting ? "Submitting..." : "Submit Incident Report"}</span>
              {!submitting && <Check className="h-4 w-4" />}
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
                <AlertTriangle className="h-5 w-5" />
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
      {/* AI Emergency Assistant Modal */}
      <AIEmergencyAssistantModal
        isOpen={isAIAssistantOpen}
        onClose={() => setIsAIAssistantOpen(false)}
        onApplyDraft={handleApplyAIDraft}
        categories={categories}
        currentLatitude={formData.latitude}
        currentLongitude={formData.longitude}
        currentLocationText={formData.locationText}
      />
      {/* AI Voice Emergency Assistant Modal (Phase E) */}
      <AIVoiceEmergencyModal
        isOpen={isVoiceAssistantOpen}
        onClose={() => setIsVoiceAssistantOpen(false)}
        onApplyDraft={handleApplyAIDraft}
        categories={categories}
        currentLatitude={formData.latitude}
        currentLongitude={formData.longitude}
        currentLocationText={formData.locationText}
      />
    </div>
  );
}
