"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { Category, Report } from "@/lib/types";
import EvidenceUploader, { SelectedFileItem } from "@/components/EvidenceUploader";

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
    incidentDate: "",
    isAnonymous: false,
  });

  const [selectedFiles, setSelectedFiles] = useState<SelectedFileItem[]>([]);
  const [isReviewMode, setIsReviewMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

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
      setError("Location is required (e.g. Dhanmondi, Dhaka).");
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
    setError(null);
    if (validateForm()) {
      setIsReviewMode(true);
    }
  };

  const handleSaveReport = async (statusToSet: "DRAFT" | "SUBMITTED") => {
    setError(null);
    if (!validateForm()) return;

    setSubmitting(true);
    setUploadStatus("Creating report record...");

    const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

    try {
      const payload = {
        title: formData.title.trim(),
        category_id: formData.categoryId,
        description: formData.description.trim(),
        location_text: formData.locationText.trim(),
        incident_date: formData.incidentDate ? new Date(formData.incidentDate).toISOString() : null,
        is_anonymous: formData.isAnonymous,
        status: statusToSet,
      };

      const created = await apiFetch<Report>("/reports", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      // Upload attached files if any
      if (selectedFiles.length > 0) {
        for (let i = 0; i < selectedFiles.length; i++) {
          const item = selectedFiles[i];
          setUploadStatus(`Uploading evidence ${i + 1} of ${selectedFiles.length}: ${item.file.name}...`);

          const formDataFile = new FormData();
          formDataFile.append("file", item.file);
          if (item.caption.trim()) formDataFile.append("caption", item.caption.trim());

          const res = await fetch(`${apiBase}/reports/${created.id}/media`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token || ""}`,
            },
            body: formDataFile,
          });

          if (!res.ok) {
            const errData = await res.json().catch(() => ({ detail: res.statusText }));
            throw new Error(errData.detail || `Upload failed for ${item.file.name}`);
          }
        }
      }

      router.push(`/reports/${created.id}`);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to create report. Please verify your inputs.");
      }
      setSubmitting(false);
      setUploadStatus(null);
    }
  };

  if (authLoading || categoriesLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  const selectedCategoryObj = categories.find((c) => c.id === formData.categoryId);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link
            href="/reports/mine"
            className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-1 mb-2"
          >
            ← Back to My Reports
          </Link>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            {isReviewMode ? "Review & Confirm Incident Report" : "Submit Community Incident Report"}
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {isReviewMode
              ? "Verify all incident information and evidence attachments before submitting."
              : "Provide clear and factual details regarding the incident."}
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-xl bg-red-50 dark:bg-red-950/50 p-4 border border-red-200 dark:border-red-900">
          <p className="text-sm font-medium text-red-800 dark:text-red-300">{error}</p>
        </div>
      )}

      {isReviewMode ? (
        /* Review Mode */
        <div className="space-y-6 bg-white dark:bg-zinc-900 p-6 sm:p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <div className="border-b border-zinc-200 dark:border-zinc-800 pb-4">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 mb-2">
              {selectedCategoryObj?.name || "Uncategorized"}
            </span>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{formData.title}</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-xs font-medium text-zinc-500 block">Location</span>
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">{formData.locationText}</span>
            </div>
            <div>
              <span className="text-xs font-medium text-zinc-500 block">Incident Date / Time</span>
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                {formData.incidentDate ? new Date(formData.incidentDate).toLocaleString() : "Not specified"}
              </span>
            </div>
            <div className="sm:col-span-2">
              <span className="text-xs font-medium text-zinc-500 block">Reporter Privacy</span>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold mt-1 ${
                  formData.isAnonymous
                    ? "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300"
                    : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                }`}
              >
                {formData.isAnonymous
                  ? "Anonymous Whistleblower Mode (Name hidden from public view)"
                  : `Public Attribution (${user.full_name || user.username})`}
              </span>
            </div>
          </div>

          <div className="pt-2">
            <span className="text-xs font-medium text-zinc-500 block mb-2">Incident Description</span>
            <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800 text-sm whitespace-pre-wrap text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700">
              {formData.description}
            </div>
          </div>

          {/* Attached Evidence Summary */}
          {selectedFiles.length > 0 && (
            <div className="pt-2">
              <span className="text-xs font-medium text-zinc-500 block mb-2">
                Attached Evidence Files ({selectedFiles.length})
              </span>
              <ul className="space-y-1.5 text-xs text-zinc-700 dark:text-zinc-300">
                {selectedFiles.map((item, idx) => (
                  <li key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800">
                    <span>📎</span>
                    <span className="font-semibold truncate">{item.file.name}</span>
                    {item.caption && <span className="text-zinc-500 italic">(&quot;{item.caption}&quot;)</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {uploadStatus && (
            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-900 text-xs font-semibold text-emerald-800 dark:text-emerald-200 animate-pulse">
              {uploadStatus}
            </div>
          )}

          <div className="pt-6 border-t border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setIsReviewMode(false)}
              disabled={submitting}
              className="w-full sm:w-auto rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
            >
              ← Edit Details
            </button>

            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => handleSaveReport("DRAFT")}
                disabled={submitting}
                className="w-full sm:w-auto rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-5 py-2.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition"
              >
                {submitting ? "Saving..." : "Save Draft"}
              </button>
              <button
                type="button"
                onClick={() => handleSaveReport("SUBMITTED")}
                disabled={submitting}
                className="w-full sm:w-auto rounded-lg bg-emerald-600 px-6 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-500 transition"
              >
                {submitting ? "Submitting..." : "Submit for Moderation"}
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Form Edit Mode */
        <form
          onSubmit={handleProceedToReview}
          className="space-y-6 bg-white dark:bg-zinc-900 p-6 sm:p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm"
        >
          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Report Title <span className="text-red-500">*</span>
            </label>
            <input
              name="title"
              type="text"
              required
              value={formData.title}
              onChange={handleChange}
              placeholder="e.g. Broken water pipeline flooding road"
              className="mt-1 block w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* Category & Location */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Incident Category <span className="text-red-500">*</span>
              </label>
              <select
                name="categoryId"
                value={formData.categoryId}
                onChange={handleChange}
                className="mt-1 block w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Location Text <span className="text-red-500">*</span>
              </label>
              <input
                name="locationText"
                type="text"
                required
                value={formData.locationText}
                onChange={handleChange}
                placeholder="e.g. Dhanmondi 27, Dhaka"
                className="mt-1 block w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Incident Date */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Date and Time of Occurrence (Optional)
            </label>
            <input
              name="incidentDate"
              type="datetime-local"
              value={formData.incidentDate}
              onChange={handleChange}
              className="mt-1 block w-full sm:w-1/2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Detailed Description <span className="text-red-500">*</span>
            </label>
            <textarea
              name="description"
              rows={6}
              required
              value={formData.description}
              onChange={handleChange}
              placeholder="Provide a factual, comprehensive description of what occurred, key individuals involved (if known), and public impact..."
              className="mt-1 block w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* Evidence Attachments Uploader */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
              Supporting Evidence Attachments (Optional)
            </label>
            <EvidenceUploader onFilesChange={(files) => setSelectedFiles(files)} />
          </div>

          {/* Privacy & Identity Selector */}
          <div className="space-y-3 pt-2">
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Reporter Identity Preference
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label
                className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition ${
                  !formData.isAnonymous
                    ? "border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20"
                    : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                }`}
              >
                <input
                  type="radio"
                  name="privacyMode"
                  checked={!formData.isAnonymous}
                  onChange={() => setFormData((prev) => ({ ...prev, isAnonymous: false }))}
                  className="mt-1 text-emerald-600 focus:ring-emerald-500"
                />
                <div>
                  <span className="block text-xs font-bold text-zinc-900 dark:text-zinc-100">
                    Publish with My Identity
                  </span>
                  <span className="block text-[11px] text-zinc-500 mt-0.5">
                    Your name will be visible to the public once the report is approved.
                  </span>
                </div>
              </label>

              <label
                className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition ${
                  formData.isAnonymous
                    ? "border-purple-500 bg-purple-50/40 dark:bg-purple-950/20"
                    : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                }`}
              >
                <input
                  type="radio"
                  name="privacyMode"
                  checked={formData.isAnonymous}
                  onChange={() => setFormData((prev) => ({ ...prev, isAnonymous: true }))}
                  className="mt-1 text-purple-600 focus:ring-purple-500"
                />
                <div>
                  <span className="block text-xs font-bold text-zinc-900 dark:text-zinc-100">
                    Submit Anonymously
                  </span>
                  <span className="block text-[11px] text-zinc-500 mt-0.5">
                    Your identity remains confidential from the public. Only authorized moderators see audit metadata.
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* Form Actions */}
          <div className="pt-6 border-t border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => handleSaveReport("DRAFT")}
              disabled={submitting}
              className="w-full sm:w-auto rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-5 py-2.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition"
            >
              Save as Draft
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="w-full sm:w-auto rounded-lg bg-emerald-600 px-6 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-500 transition"
            >
              Review and Submit →
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
