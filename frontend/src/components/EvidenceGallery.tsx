"use client";

import React from "react";
import { ReportMedia } from "@/lib/types";

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
  if (!media || media.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 p-6 text-center text-xs text-zinc-500">
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
    const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
    if (downloadUrl.startsWith("http")) return downloadUrl;
    // Strip redundant /api/v1 prefix if already in apiBase
    const normalizedPath = downloadUrl.replace(/^\/api\/v1/, "");
    return `${apiBase}${normalizedPath}`;
  };

  return (
    <div className="space-y-6">
      {/* Images Grid */}
      {images.length > 0 && (
        <div>
          <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">
            Photo Evidence ({images.length})
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {images.map((item) => (
              <div
                key={item.id}
                className="group relative rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/60 overflow-hidden shadow-sm flex flex-col justify-between"
              >
                <div className="aspect-video w-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={getFullUrl(item.download_url)}
                    alt={item.caption || item.file_name}
                    className="h-full w-full object-cover group-hover:scale-105 transition duration-300"
                    loading="lazy"
                  />
                </div>
                <div className="p-3 text-xs">
                  <p className="font-semibold text-zinc-900 dark:text-zinc-100 truncate" title={item.file_name}>
                    {item.file_name}
                  </p>
                  <p className="text-zinc-500 text-[11px] mt-0.5">{formatBytes(item.file_size)}</p>
                  {item.caption && (
                    <p className="mt-1 text-zinc-600 dark:text-zinc-300 italic text-[11px] bg-white dark:bg-zinc-900 p-1.5 rounded border border-zinc-200/50 dark:border-zinc-800">
                      &quot;{item.caption}&quot;
                    </p>
                  )}
                  <div className="mt-2 flex items-center justify-between pt-2 border-t border-zinc-200/60 dark:border-zinc-700/60">
                    <a
                      href={getFullUrl(item.download_url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
                    >
                      View Full Photo ↗
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
            ))}
          </div>
        </div>
      )}

      {/* Videos Section */}
      {videos.length > 0 && (
        <div>
          <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">
            Video Evidence ({videos.length})
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {videos.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/60 overflow-hidden shadow-sm p-3 text-xs"
              >
                <video
                  controls
                  preload="metadata"
                  className="w-full aspect-video rounded-lg bg-black mb-2"
                >
                  <source src={getFullUrl(item.download_url)} type={item.mime_type} />
                  Your browser does not support HTML5 video preview.
                </video>
                <p className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">{item.file_name}</p>
                <p className="text-zinc-500 text-[11px] mt-0.5">{formatBytes(item.file_size)}</p>
                {item.caption && <p className="mt-1 text-zinc-600 dark:text-zinc-300 italic text-[11px]">&quot;{item.caption}&quot;</p>}
                <div className="mt-2 flex items-center justify-between pt-2 border-t border-zinc-200/60 dark:border-zinc-700/60">
                  <a
                    href={getFullUrl(item.download_url)}
                    download={item.file_name}
                    className="font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
                  >
                    Download Video ⭳
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
            ))}
          </div>
        </div>
      )}

      {/* Documents Section */}
      {documents.length > 0 && (
        <div>
          <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">
            Document Evidence ({documents.length})
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {documents.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800/60 p-3.5 shadow-sm text-xs flex flex-col justify-between"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 font-bold text-sm">
                    📄
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-zinc-900 dark:text-zinc-100 truncate" title={item.file_name}>
                      {item.file_name}
                    </p>
                    <p className="text-zinc-400 text-[11px] mt-0.5">{formatBytes(item.file_size)}</p>
                    {item.caption && (
                      <p className="mt-1 text-zinc-600 dark:text-zinc-300 italic text-[11px]">&quot;{item.caption}&quot;</p>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-700/60">
                  <a
                    href={getFullUrl(item.download_url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-1"
                  >
                    Open Document ↗
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
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
