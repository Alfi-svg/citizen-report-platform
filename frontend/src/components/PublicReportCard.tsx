"use client";

import React, { useState } from "react";
import Link from "next/link";
import { PublicReport } from "@/lib/types";
import { getApiBaseUrl } from "@/lib/api";

interface PublicReportCardProps {
  report: PublicReport;
}

export default function PublicReportCard({ report }: PublicReportCardProps) {
  const [copied, setCopied] = useState(false);
  const firstImage = report.media?.find(
    (m) => m.media_type === "image" || m.mime_type.startsWith("image/")
  );
  const apiBase = getApiBaseUrl();

  const getFullUrl = (downloadUrl: string) => {
    if (downloadUrl.startsWith("http")) return downloadUrl;
    const normalizedPath = downloadUrl.replace(/^\/api\/v1/, "");
    return `${apiBase}${normalizedPath}`;
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const url = `${window.location.origin}/reports/${report.id}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: report.title,
          text: `Verified Citizen Report: ${report.title} in ${report.location_text}`,
          url,
        });
        return;
      } catch {
        // Fallback to clipboard
      }
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <article className="group flex flex-col justify-between rounded-2xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs hover:shadow-md hover:border-emerald-700/30 dark:hover:border-emerald-500/30 transition duration-200 overflow-hidden">
      <div>
        {/* Card Header: Author & Verification Status */}
        <div className="p-4 pb-3 flex items-center justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800/80">
          <div className="flex items-center gap-2.5 min-w-0">
            {report.is_anonymous ? (
              <div className="h-8 w-8 rounded-full bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 flex items-center justify-center text-xs font-bold shrink-0">
                🛡️
              </div>
            ) : (
              <div className="h-8 w-8 rounded-full bg-emerald-700/10 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 flex items-center justify-center text-xs font-bold shrink-0">
                {(report.reporter_display_name || "C").charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex flex-col">
              <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">
                {report.is_anonymous ? "Anonymous Citizen" : report.reporter_display_name || "Citizen Reporter"}
              </span>
              <span className="text-[10px] text-zinc-400">
                {new Date(report.created_at).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200/60 dark:border-blue-900/60">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-pulse" />
              Reviewed
            </span>
          </div>
        </div>

        {/* Optional Image Thumbnail */}
        {firstImage && (
          <Link href={`/reports/${report.id}`} className="block relative aspect-video w-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={getFullUrl(firstImage.download_url)}
              alt={firstImage.caption || report.title}
              className="h-full w-full object-cover group-hover:scale-102 transition duration-300"
              loading="lazy"
            />
            {report.media_count > 1 && (
              <span className="absolute bottom-2 right-2 rounded-md bg-zinc-950/75 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-xs">
                📷 +{report.media_count - 1} more
              </span>
            )}
          </Link>
        )}

        <div className="p-4">
          {/* Category Tag */}
          <div className="mb-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-900/50">
              {report.category?.name || "Civic Incident"}
            </span>
          </div>

          {/* Title */}
          <h3 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100 line-clamp-2 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition mb-1.5 leading-snug">
            <Link href={`/reports/${report.id}`}>
              {report.title}
            </Link>
          </h3>

          {/* Description Excerpt */}
          <p className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-3 leading-relaxed mb-3">
            {report.description}
          </p>

          {/* Location Badge */}
          <div className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded-md max-w-full truncate">
            <span>📍</span>
            <span className="truncate">{report.location_text}</span>
          </div>
        </div>
      </div>

      {/* Footer Social Actions Bar */}
      <div className="p-3 pt-0 border-t border-zinc-100 dark:border-zinc-800 mt-2">
        <div className="flex items-center justify-between pt-2">
          <Link
            href={`/reports/${report.id}`}
            className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline"
          >
            <span>View Details</span>
            <span>→</span>
          </Link>

          <button
            onClick={handleShare}
            type="button"
            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
            title="Share verified report"
          >
            <span>{copied ? "✓" : "🔗"}</span>
            <span>{copied ? "Copied" : "Share"}</span>
          </button>
        </div>
      </div>
    </article>
  );
}
