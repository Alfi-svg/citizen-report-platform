"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { ReportMedia } from "@/lib/types";
import { apiFetch } from "@/lib/api";
import { Capacitor } from "@capacitor/core";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";

export interface SelectedFileItem {
  id: string;
  file: File;
  caption: string;
  previewUrl?: string;
  mediaType: "image" | "video" | "document";
}

interface EvidenceUploaderProps {
  reportId?: string;
  onUploadComplete?: (newMedia: ReportMedia) => void;
  onFilesChange?: (files: SelectedFileItem[]) => void;
  disabled?: boolean;
}

const MAX_ATTACHMENTS = 5;
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_DOCUMENT_SIZE = 20 * 1024 * 1024; // 20MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB

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

function getMediaType(file: File): "image" | "video" | "document" {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  return "document";
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

  // Hidden inputs for web browser fallbacks and document selection
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const photoGalleryInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Keep a ref of selected items for cleanup on unmount
  const itemsRef = useRef<SelectedFileItem[]>(selectedItems);
  useEffect(() => {
    itemsRef.current = selectedItems;
  }, [selectedItems]);

  // Cleanup object URLs when component unmounts to prevent memory leaks
  useEffect(() => {
    return () => {
      itemsRef.current.forEach((item) => {
        if (item.previewUrl) {
          URL.revokeObjectURL(item.previewUrl);
        }
      });
    };
  }, []);

  const updateSelectedItems = useCallback((newItems: SelectedFileItem[]) => {
    setSelectedItems(newItems);
    if (onFilesChange) {
      onFilesChange(newItems);
    }
  }, [onFilesChange]);

  const addFilesToSelection = useCallback((incomingFiles: File[]) => {
    setError(null);
    if (incomingFiles.length === 0) return;

    if (selectedItems.length + incomingFiles.length > MAX_ATTACHMENTS) {
      setError(`You can attach a maximum of ${MAX_ATTACHMENTS} evidence files per report. Currently selected: ${selectedItems.length}.`);
      return;
    }

    const validNewItems: SelectedFileItem[] = [];

    for (const file of incomingFiles) {
      const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        setError(`File '${file.name}' has an unsupported extension. Allowed: JPEG, PNG, WebP, MP4, WebM, MOV, PDF, TXT, DOCX.`);
        return;
      }

      const mediaType = getMediaType(file);
      const maxSize = mediaType === "image" ? MAX_IMAGE_SIZE : mediaType === "video" ? MAX_VIDEO_SIZE : MAX_DOCUMENT_SIZE;

      if (file.size > maxSize) {
        setError(`File '${file.name}' (${formatBytes(file.size)}) exceeds maximum allowed size of ${formatBytes(maxSize)}.`);
        return;
      }

      const previewUrl = mediaType === "image" ? URL.createObjectURL(file) : undefined;
      validNewItems.push({
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        file,
        caption: "",
        previewUrl,
        mediaType,
      });
    }

    const updated = [...selectedItems, ...validNewItems];
    updateSelectedItems(updated);
  }, [selectedItems, updateSelectedItems]);

  // 1. Take Photo handler (Native Camera with Web Fallback)
  const handleTakePhoto = async () => {
    setError(null);
    if (disabled || uploading) return;

    if (selectedItems.length >= MAX_ATTACHMENTS) {
      setError(`Maximum limit of ${MAX_ATTACHMENTS} attachments reached.`);
      return;
    }

    const isNative = Capacitor.isNativePlatform();

    if (isNative) {
      try {
        // Check and request camera permissions on-demand
        let perm = await Camera.checkPermissions();
        if (perm.camera !== "granted") {
          perm = await Camera.requestPermissions({ permissions: ["camera"] });
        }

        if (perm.camera !== "granted") {
          setError("Camera permission was denied. You can still select photos from your gallery or choose document files.");
          return;
        }

        // Capture photo with optimized resolution (Full HD 1920px max dimension, 85% quality)
        const photo = await Camera.getPhoto({
          resultType: CameraResultType.Uri,
          source: CameraSource.Camera,
          quality: 85,
          width: 1920,
          height: 1920,
          allowEditing: false,
        });

        if (!photo.webPath) {
          return;
        }

        const res = await fetch(photo.webPath);
        const blob = await res.blob();
        const ext = photo.format ? `.${photo.format.toLowerCase()}` : ".jpg";
        const file = new File([blob], `camera_evidence_${Date.now()}${ext}`, {
          type: blob.type || "image/jpeg",
        });

        addFilesToSelection([file]);
      } catch (err: unknown) {
        // Silently ignore user cancellations
        const msg = err instanceof Error ? err.message : String(err);
        if (
          msg.toLowerCase().includes("cancelled") ||
          msg.toLowerCase().includes("canceled") ||
          msg.toLowerCase().includes("no photo")
        ) {
          return;
        }
        setError("Unable to capture photo. Please check your camera settings or use Choose Photo.");
      }
    } else {
      // Browser fallback: trigger file input with environment capture
      if (cameraInputRef.current) {
        cameraInputRef.current.value = "";
        cameraInputRef.current.click();
      }
    }
  };

  // 2. Choose Photo handler (Native Photo Picker with Web Fallback)
  const handleChoosePhoto = async () => {
    setError(null);
    if (disabled || uploading) return;

    if (selectedItems.length >= MAX_ATTACHMENTS) {
      setError(`Maximum limit of ${MAX_ATTACHMENTS} attachments reached.`);
      return;
    }

    const isNative = Capacitor.isNativePlatform();

    if (isNative) {
      try {
        // Uses Android modern photo picker (PickVisualMedia) - zero extra permissions required
        const photo = await Camera.getPhoto({
          resultType: CameraResultType.Uri,
          source: CameraSource.Photos,
          quality: 85,
          width: 1920,
          height: 1920,
        });

        if (!photo.webPath) {
          return;
        }

        const res = await fetch(photo.webPath);
        const blob = await res.blob();
        const ext = photo.format ? `.${photo.format.toLowerCase()}` : ".jpg";
        const file = new File([blob], `gallery_evidence_${Date.now()}${ext}`, {
          type: blob.type || "image/jpeg",
        });

        addFilesToSelection([file]);
      } catch (err: unknown) {
        // Silently ignore user cancellations
        const msg = err instanceof Error ? err.message : String(err);
        if (
          msg.toLowerCase().includes("cancelled") ||
          msg.toLowerCase().includes("canceled") ||
          msg.toLowerCase().includes("no image")
        ) {
          return;
        }
        setError("Unable to select photo from gallery. Please try again.");
      }
    } else {
      // Browser fallback: open image-only file picker
      if (photoGalleryInputRef.current) {
        photoGalleryInputRef.current.value = "";
        photoGalleryInputRef.current.click();
      }
    }
  };

  // 3. Choose File handler (Documents & Media)
  const handleChooseFile = () => {
    setError(null);
    if (disabled || uploading) return;

    if (selectedItems.length >= MAX_ATTACHMENTS) {
      setError(`Maximum limit of ${MAX_ATTACHMENTS} attachments reached.`);
      return;
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  };

  const handleNativeFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    addFilesToSelection(files);
  };

  const handleRemoveItem = (index: number) => {
    const itemToRemove = selectedItems[index];
    if (itemToRemove?.previewUrl) {
      URL.revokeObjectURL(itemToRemove.previewUrl);
    }
    const updated = selectedItems.filter((_, i) => i !== index);
    updateSelectedItems(updated);
  };

  const handleCaptionChange = (index: number, caption: string) => {
    const updated = selectedItems.map((item, i) =>
      i === index ? { ...item, caption } : item
    );
    updateSelectedItems(updated);
  };

  const handleUploadAllToReport = async () => {
    if (!reportId || selectedItems.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      for (let i = 0; i < selectedItems.length; i++) {
        const item = selectedItems[i];
        setUploadProgress(`Uploading ${i + 1} of ${selectedItems.length}: ${item.file.name}...`);

        const formData = new FormData();
        formData.append("file", item.file);
        if (item.caption.trim()) formData.append("caption", item.caption.trim());

        const newMedia = await apiFetch<ReportMedia>(`/reports/${reportId}/media`, {
          method: "POST",
          body: formData,
          timeoutMs: 60000, // Allow 60s for media upload
        });

        if (item.previewUrl) {
          URL.revokeObjectURL(item.previewUrl);
        }

        if (onUploadComplete) onUploadComplete(newMedia);
      }

      updateSelectedItems([]);
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
      {/* Hidden file inputs for web browser fallback and system file selection */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleNativeFileInputChange}
        className="hidden"
        disabled={disabled || uploading}
      />
      <input
        ref={photoGalleryInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        onChange={handleNativeFileInputChange}
        className="hidden"
        disabled={disabled || uploading}
      />
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".jpg,.jpeg,.png,.webp,.mp4,.webm,.mov,.pdf,.txt,.docx"
        onChange={handleNativeFileInputChange}
        className="hidden"
        disabled={disabled || uploading}
      />

      {/* Modern Glassy Action Container */}
      <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-md p-4 sm:p-5 shadow-xs transition">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div>
            <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
              <span>📎</span>
              <span>Attach Incident Evidence</span>
            </h4>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
              Add photos, videos, or documents to substantiate this report
            </p>
          </div>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
            {selectedItems.length}/{MAX_ATTACHMENTS} max
          </span>
        </div>

        {/* Action Buttons: Take Photo | Choose Photo | Choose File */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {/* 1. Take Photo */}
          <button
            type="button"
            onClick={handleTakePhoto}
            disabled={disabled || uploading || selectedItems.length >= MAX_ATTACHMENTS}
            className="flex flex-col items-center justify-center gap-1 p-3 rounded-xl border border-zinc-200/90 dark:border-zinc-700/80 bg-white dark:bg-zinc-800/80 hover:bg-emerald-50/60 dark:hover:bg-emerald-950/30 hover:border-emerald-300 dark:hover:border-emerald-700 active:scale-[0.97] transition disabled:opacity-50 disabled:pointer-events-none cursor-pointer min-h-[72px] shadow-2xs group"
          >
            <span className="text-xl group-hover:scale-110 transition-transform">📷</span>
            <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 group-hover:text-emerald-700 dark:group-hover:text-emerald-400">
              Take Photo
            </span>
            <span className="text-[10px] text-zinc-400 dark:text-zinc-500">Camera</span>
          </button>

          {/* 2. Choose Photo */}
          <button
            type="button"
            onClick={handleChoosePhoto}
            disabled={disabled || uploading || selectedItems.length >= MAX_ATTACHMENTS}
            className="flex flex-col items-center justify-center gap-1 p-3 rounded-xl border border-zinc-200/90 dark:border-zinc-700/80 bg-white dark:bg-zinc-800/80 hover:bg-emerald-50/60 dark:hover:bg-emerald-950/30 hover:border-emerald-300 dark:hover:border-emerald-700 active:scale-[0.97] transition disabled:opacity-50 disabled:pointer-events-none cursor-pointer min-h-[72px] shadow-2xs group"
          >
            <span className="text-xl group-hover:scale-110 transition-transform">🖼️</span>
            <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 group-hover:text-emerald-700 dark:group-hover:text-emerald-400">
              Choose Photo
            </span>
            <span className="text-[10px] text-zinc-400 dark:text-zinc-500">Gallery</span>
          </button>

          {/* 3. Choose File */}
          <button
            type="button"
            onClick={handleChooseFile}
            disabled={disabled || uploading || selectedItems.length >= MAX_ATTACHMENTS}
            className="flex flex-col items-center justify-center gap-1 p-3 rounded-xl border border-zinc-200/90 dark:border-zinc-700/80 bg-white dark:bg-zinc-800/80 hover:bg-emerald-50/60 dark:hover:bg-emerald-950/30 hover:border-emerald-300 dark:hover:border-emerald-700 active:scale-[0.97] transition disabled:opacity-50 disabled:pointer-events-none cursor-pointer min-h-[72px] shadow-2xs group"
          >
            <span className="text-xl group-hover:scale-110 transition-transform">📄</span>
            <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 group-hover:text-emerald-700 dark:group-hover:text-emerald-400">
              Choose File
            </span>
            <span className="text-[10px] text-zinc-400 dark:text-zinc-500">Docs / Video</span>
          </button>
        </div>

        <p className="text-[10px] text-zinc-400 dark:text-zinc-500 text-center mt-3">
          Photos (≤10MB) • Videos (≤50MB) • Documents (≤20MB) • Max 5 files
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="rounded-xl bg-red-50/90 dark:bg-red-950/40 border border-red-200 dark:border-red-900 p-3.5 text-xs text-red-700 dark:text-red-300 flex items-start gap-2 shadow-2xs">
          <span className="text-sm shrink-0">⚠️</span>
          <span className="flex-1">{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-red-500 hover:text-red-700 text-sm font-bold ml-1 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Selected Attachments List with Thumbnail Previews */}
      {selectedItems.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h5 className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
              Attached Evidence ({selectedItems.length})
            </h5>
            <span className="text-[11px] text-zinc-400">
              {selectedItems.reduce((acc, item) => acc + item.file.size, 0) > 0 &&
                formatBytes(selectedItems.reduce((acc, item) => acc + item.file.size, 0))}
            </span>
          </div>

          <div className="space-y-2">
            {selectedItems.map((item, idx) => (
              <div
                key={item.id}
                className="flex items-center gap-3 p-2.5 sm:p-3 rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-850 shadow-2xs transition"
              >
                {/* Thumbnail / Media Icon */}
                <div className="w-14 h-14 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 overflow-hidden shrink-0 flex items-center justify-center">
                  {item.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.previewUrl}
                      alt={item.file.name}
                      className="w-full h-full object-cover"
                    />
                  ) : item.mediaType === "video" ? (
                    <span className="text-2xl">🎥</span>
                  ) : (
                    <span className="text-2xl">📄</span>
                  )}
                </div>

                {/* Details & Caption Input */}
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate block">
                      {item.file.name}
                    </span>
                    <span className="text-[10px] text-zinc-400 dark:text-zinc-500 shrink-0 font-medium">
                      {formatBytes(item.file.size)}
                    </span>
                  </div>

                  <input
                    type="text"
                    placeholder="Optional description/caption for this evidence..."
                    value={item.caption}
                    onChange={(e) => handleCaptionChange(idx, e.target.value)}
                    disabled={uploading}
                    maxLength={200}
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700/80 bg-zinc-50 dark:bg-zinc-900 px-2.5 py-1 text-[11px] text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition"
                  />
                </div>

                {/* Remove Button */}
                <button
                  type="button"
                  onClick={() => handleRemoveItem(idx)}
                  disabled={uploading}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition cursor-pointer shrink-0 disabled:opacity-40"
                  aria-label={`Remove ${item.file.name}`}
                  title="Remove evidence"
                >
                  <span className="text-base font-bold">🗑️</span>
                </button>
              </div>
            ))}
          </div>

          {/* Upload Button for Direct Report Context */}
          {reportId && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-zinc-500 font-medium">
                {uploadProgress || `${selectedItems.length} file(s) ready to attach`}
              </span>
              <button
                type="button"
                onClick={handleUploadAllToReport}
                disabled={uploading || selectedItems.length === 0}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 shadow-sm transition disabled:opacity-50 min-h-[40px] flex items-center justify-center cursor-pointer"
              >
                {uploading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    <span>Uploading...</span>
                  </span>
                ) : (
                  "Upload Evidence"
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
