"use client";

import React, { useState, useRef } from "react";
import { ReportMedia } from "@/lib/types";
import { getApiBaseUrl } from "@/lib/api";

export interface SelectedFileItem {
  file: File;
  caption: string;
}

interface EvidenceUploaderProps {
  reportId?: string;
  onUploadComplete?: (newMedia: ReportMedia) => void;
  onFilesChange?: (files: SelectedFileItem[]) => void;
  disabled?: boolean;
}

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const MAX_DOCUMENT_SIZE = 20 * 1024 * 1024;
const MAX_VIDEO_SIZE = 50 * 1024 * 1024;

const ALLOWED_EXTENSIONS = [
  ".jpg", ".jpeg", ".png", ".webp",
  ".mp4", ".webm", ".mov",
  ".pdf", ".txt", ".docx"
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function EvidenceUploader({
  reportId,
  onUploadComplete,
  onFilesChange,
  disabled = false,
}: EvidenceUploaderProps) {
  const [selectedItems, setSelectedItems] = useState<SelectedFileItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    if (!e.target.files) return;

    const files = Array.from(e.target.files);
    const newItems: SelectedFileItem[] = [];

    for (const file of files) {
      const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        setError(`File '${file.name}' has an unsupported extension. Allowed: JPEG, PNG, WebP, MP4, WebM, MOV, PDF, TXT, DOCX.`);
        return;
      }

      // Size checks
      const isImg = file.type.startsWith("image/");
      const isVid = file.type.startsWith("video/");
      const maxSize = isImg ? MAX_IMAGE_SIZE : isVid ? MAX_VIDEO_SIZE : MAX_DOCUMENT_SIZE;

      if (file.size > maxSize) {
        setError(`File '${file.name}' (${formatBytes(file.size)}) exceeds maximum limit of ${formatBytes(maxSize)}.`);
        return;
      }

      newItems.push({ file, caption: "" });
    }

    const updated = [...selectedItems, ...newItems];
    setSelectedItems(updated);
    if (onFilesChange) onFilesChange(updated);

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleRemoveItem = (index: number) => {
    const updated = selectedItems.filter((_, i) => i !== index);
    setSelectedItems(updated);
    if (onFilesChange) onFilesChange(updated);
  };

  const handleCaptionChange = (index: number, caption: string) => {
    const updated = selectedItems.map((item, i) => (i === index ? { ...item, caption } : item));
    setSelectedItems(updated);
    if (onFilesChange) onFilesChange(updated);
  };

  const handleUploadAllToReport = async () => {
    if (!reportId || selectedItems.length === 0) return;
    setUploading(true);
    setError(null);

    const apiBase = getApiBaseUrl();
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

    try {
      for (let i = 0; i < selectedItems.length; i++) {
        const item = selectedItems[i];
        setUploadProgress(`Uploading ${i + 1} of ${selectedItems.length}: ${item.file.name}...`);

        const formData = new FormData();
        formData.append("file", item.file);
        if (item.caption.trim()) formData.append("caption", item.caption.trim());

        const res = await fetch(`${apiBase}/reports/${reportId}/media`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token || ""}`,
          },
          body: formData,
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({ detail: res.statusText }));
          throw new Error(errData.detail || `Upload failed for ${item.file.name}`);
        }

        const newMedia: ReportMedia = await res.json();
        if (onUploadComplete) onUploadComplete(newMedia);
      }

      setSelectedItems([]);
      if (onFilesChange) onFilesChange([]);
      setUploadProgress(null);
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* File Drop & Select Button */}
      <div className="rounded-xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50/60 dark:bg-zinc-800/40 p-5 text-center">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".jpg,.jpeg,.png,.webp,.mp4,.webm,.mov,.pdf,.txt,.docx"
          onChange={handleFileSelect}
          disabled={disabled || uploading}
          className="hidden"
          id="evidence-file-input"
        />
        <label
          htmlFor="evidence-file-input"
          className="cursor-pointer inline-flex flex-col items-center justify-center gap-1 text-xs"
        >
          <span className="text-2xl">📎</span>
          <span className="font-semibold text-zinc-900 dark:text-zinc-100 hover:text-emerald-600 dark:hover:text-emerald-400">
            Click to select supporting evidence files
          </span>
          <span className="text-[11px] text-zinc-500">
            Photos (up to 10MB), Videos (up to 50MB), Documents (up to 20MB)
          </span>
        </label>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 p-3 text-xs text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Selected Files List */}
      {selectedItems.length > 0 && (
        <div className="space-y-2">
          <h5 className="text-xs font-bold text-zinc-600 dark:text-zinc-400">
            Selected Attachments ({selectedItems.length})
          </h5>
          <div className="space-y-2">
            {selectedItems.map((item, idx) => (
              <div
                key={idx}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs shadow-sm"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                      {item.file.name}
                    </span>
                    <span className="text-[10px] text-zinc-400">
                      ({formatBytes(item.file.size)})
                    </span>
                  </div>
                  <input
                    type="text"
                    placeholder="Optional description/caption for this file..."
                    value={item.caption}
                    onChange={(e) => handleCaptionChange(idx, e.target.value)}
                    disabled={uploading}
                    className="mt-1 w-full rounded border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 px-2 py-1 text-[11px] text-zinc-900 dark:text-zinc-100"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveItem(idx)}
                  disabled={uploading}
                  className="self-end sm:self-center text-xs font-semibold text-red-600 hover:text-red-700 disabled:opacity-40"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          {/* Upload Button for Direct Report ID Context */}
          {reportId && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-zinc-500 font-medium">
                {uploadProgress || `${selectedItems.length} file(s) ready to upload`}
              </span>
              <button
                type="button"
                onClick={handleUploadAllToReport}
                disabled={uploading || selectedItems.length === 0}
                className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 shadow-sm transition disabled:opacity-50"
              >
                {uploading ? "Uploading..." : "Upload Evidence"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
