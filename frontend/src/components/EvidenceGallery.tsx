"use client";

import React, { useState } from "react";
import { ReportMedia } from "@/lib/types";
import { getApiBaseUrl } from "@/lib/api";

interface EvidenceGalleryProps {
  media: ReportMedia[];
  canDelete?: boolean;
  onDelete?: (mediaId: string) => void;
  deletingId?: string | null;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function EvidenceGallery({
  media,
  canDelete = false,
  onDelete,
  deletingId = null,
}: EvidenceGalleryProps) {
  const [lightboxImage, setLightboxImage] = useState<{ url: string; title: string; caption?: string | null } | null>(null);

  if (!media || media.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 p-8 text-center text-xs text-zinc-500 dark:text-zinc-400">
        No supporting evidence attached to this report.
      </div>
    );
  }

  const images = media.filter((m) => m.media_type === "image" || m.mime_type.startsWith("image/"));
  const videos = media.filter((m) => m.media_type === "video" || m.mime_type.startsWith("video/"));
  const documents = media.filter(
    (m) => m.media_type === "document" || (!m.mime_type.startsWith("image/") && !m.mime_type.startsWith("video/"))
  );

  const getFullUrl = (downloadUrl: string) => {
    const apiBase = getApiBaseUrl();
    if (downloadUrl.startsWith("http")) return downloadUrl;
    const normalizedPath = downloadUrl.replace(/^\/api\/v1/, "");
    return `${apiBase}${normalizedPath}`;
  };

  return (
    <div className="space-y-6">
      {/* 1. Photo Evidence Section */}
      {images.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
            Photo Evidence ({images.length})
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {images.map((item) => {
              const fullUrl = getFullUrl(item.download_url);
              return (
                <div
                  key={item.id}
                  className="group relative rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/60 overflow-hidden shadow-2xs hover:shadow-md hover:border-emerald-600/40 transition duration-200 flex flex-col justify-between"
                >
                  <button
                    type="button"
                    onClick={() => setLightboxImage({ url: fullUrl, title: item.file_name, caption: item.caption })}
                    className="relative aspect-16/9 w-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden text-left cursor-zoom-in block"
                    title="Click to expand full photo"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={fullUrl}
                      alt={item.caption || item.file_name}
                      className="h-full w-full object-cover group-hover:scale-102 transition duration-300"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-end justify-end p-2">
                      <span className="rounded-md bg-zinc-950/75 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-xs opacity-0 group-hover:opacity-100 transition">
                        🔍 Expand
                      </span>
                    </div>
                  </button>

                  <div className="p-3 text-xs space-y-1.5">
                    <p className="font-semibold text-zinc-900 dark:text-zinc-100 truncate" title={item.file_name}>
                      {item.file_name}
                    </p>
                    <p className="text-zinc-500 dark:text-zinc-400 text-[11px]">{formatBytes(item.file_size)}</p>

                    {item.caption && (
                      <p className="text-zinc-600 dark:text-zinc-300 italic text-[11px] bg-white dark:bg-zinc-900 p-2 rounded-lg border border-zinc-200/60 dark:border-zinc-800">
                        &quot;{item.caption}&quot;
                      </p>
                    )}

                    <div className="pt-2 border-t border-zinc-200/60 dark:border-zinc-700/60 flex items-center justify-between">
                      <a
                        href={fullUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-1"
                      >
                        <span>Full Size</span>
                        <span>↗</span>
                      </a>
                      {canDelete && onDelete && (
                        <button
                          type="button"
                          onClick={() => onDelete(item.id)}
                          disabled={deletingId === item.id}
                          className="text-red-600 hover:text-red-700 font-semibold disabled:opacity-40"
                        >
                          {deletingId === item.id ? "Deleting..." : "Delete"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. Video Evidence Section */}
      {videos.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
            Video Evidence ({videos.length})
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {videos.map((item) => {
              const fullUrl = getFullUrl(item.download_url);
              return (
                <div
                  key={item.id}
                  className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/60 overflow-hidden shadow-2xs p-3 text-xs space-y-2"
                >
                  <video
                    controls
                    preload="metadata"
                    className="w-full aspect-16/9 rounded-xl bg-black"
                  >
                    <source src={fullUrl} type={item.mime_type} />
                    Your browser does not support HTML5 video preview.
                  </video>
                  <p className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">{item.file_name}</p>
                  <p className="text-zinc-500 dark:text-zinc-400 text-[11px]">{formatBytes(item.file_size)}</p>

                  {item.caption && (
                    <p className="text-zinc-600 dark:text-zinc-300 italic text-[11px] bg-white dark:bg-zinc-900 p-2 rounded-lg border border-zinc-200/60 dark:border-zinc-800">
                      &quot;{item.caption}&quot;
                    </p>
                  )}

                  <div className="pt-2 border-t border-zinc-200/60 dark:border-zinc-700/60 flex items-center justify-between">
                    <a
                      href={fullUrl}
                      download={item.file_name}
                      className="font-medium text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-1"
                    >
                      <span>Download Video</span>
                      <span>⭳</span>
                    </a>
                    {canDelete && onDelete && (
                      <button
                        type="button"
                        onClick={() => onDelete(item.id)}
                        disabled={deletingId === item.id}
                        className="text-red-600 hover:text-red-700 font-semibold disabled:opacity-40"
                      >
                        {deletingId === item.id ? "Deleting..." : "Delete"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. Document Evidence Section */}
      {documents.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
            Document Evidence ({documents.length})
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {documents.map((item) => {
              const fullUrl = getFullUrl(item.download_url);
              return (
                <div
                  key={item.id}
                  className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800/60 p-4 shadow-2xs text-xs flex flex-col justify-between space-y-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 font-bold text-base">
                      📄
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-zinc-900 dark:text-zinc-100 truncate" title={item.file_name}>
                        {item.file_name}
                      </p>
                      <p className="text-zinc-500 dark:text-zinc-400 text-[11px] mt-0.5">{formatBytes(item.file_size)}</p>
                      {item.caption && (
                        <p className="mt-1 text-zinc-600 dark:text-zinc-300 italic text-[11px]">&quot;{item.caption}&quot;</p>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-zinc-100 dark:border-zinc-700/60 flex items-center justify-between">
                    <a
                      href={fullUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-1"
                    >
                      <span>Open Document</span>
                      <span>↗</span>
                    </a>
                    {canDelete && onDelete && (
                      <button
                        type="button"
                        onClick={() => onDelete(item.id)}
                        disabled={deletingId === item.id}
                        className="text-red-600 hover:text-red-700 font-semibold disabled:opacity-40"
                      >
                        {deletingId === item.id ? "Deleting..." : "Delete"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Lightbox Modal */}
      {lightboxImage && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
          onClick={() => setLightboxImage(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] flex flex-col items-center space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between w-full text-white text-xs font-semibold px-2">
              <span className="truncate max-w-md">{lightboxImage.title}</span>
              <button
                type="button"
                onClick={() => setLightboxImage(null)}
                className="h-8 w-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center font-bold text-sm transition"
                title="Close viewer"
              >
                ✕
              </button>
            </div>

            <div className="relative max-h-[75vh] w-auto overflow-hidden rounded-xl shadow-2xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={lightboxImage.url}
                alt={lightboxImage.title}
                className="max-h-[75vh] max-w-full object-contain rounded-xl"
              />
            </div>

            {lightboxImage.caption && (
              <p className="text-zinc-300 text-xs italic text-center max-w-lg bg-zinc-900/80 px-4 py-2 rounded-lg border border-zinc-800">
                &quot;{lightboxImage.caption}&quot;
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
