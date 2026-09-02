"use client";

import React from "react";
import Link from "next/link";
import { PublicReport } from "@/lib/types";

interface PublicReportCardProps {
  report: PublicReport;
}

export default function PublicReportCard({ report }: PublicReportCardProps) {
  const firstImage = report.media?.find((m) => m.media_type === "image" || m.mime_type.startsWith("image/"));
  const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

  const getFullUrl = (downloadUrl: string) => {
    if (downloadUrl.startsWith("http")) return downloadUrl;
    const normalizedPath = downloadUrl.replace(/^\/api\/v1/, "");
    return `${apiBase}${normalizedPath}`;
  };

  return (
    <article className="group flex flex-col justify-between rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm hover:shadow-md transition duration-200 overflow-hidden">
      <div>
        {/* Optional Image Thumbnail */}
        {firstImage && (
          <div className="relative aspect-video w-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={getFullUrl(firstImage.download_url)}
              alt={firstImage.caption || report.title}
              className="h-full w-full object-cover group-hover:scale-105 transition duration-300"
              loading="lazy"
            />
            {report.media_count > 1 && (
              <span className="absolute bottom-2 right-2 rounded-md bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
                📷 +{report.media_count - 1} photos
              </span>
            )}
          </div>
        )}

        <div className="p-5">
          {/* Badges Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
              {report.category?.name || "Civic Incident"}
            </span>

            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide uppercase bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/60 dark:border-blue-900/60">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
              {report.review_status}
            </span>
          </div>

          {/* Title */}
          <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 line-clamp-2 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition mb-2">
            <Link href={`/reports/${report.id}`}>
              {report.title}
            </Link>
          </h3>

          {/* Description Excerpt */}
          <p className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-3 leading-relaxed mb-4">
            {report.description}
          </p>
        </div>
      </div>

      {/* Footer Info */}
      <div className="p-5 pt-0">
        <div className="space-y-2 border-t border-zinc-100 dark:border-zinc-800 pt-3 text-xs text-zinc-500">
          <div className="flex items-center justify-between">
            <span className="font-medium truncate max-w-[200px]" title={report.location_text}>
              📍 {report.location_text}
            </span>
            <span className="text-[11px] text-zinc-400">
              {new Date(report.created_at).toLocaleDateString()}
            </span>
          </div>

          <div className="flex items-center justify-between text-[11px]">
            {report.is_anonymous ? (
              <span className="font-semibold text-purple-700 dark:text-purple-300">
                🛡️ Anonymous Citizen
              </span>
            ) : (
              <span className="font-medium text-zinc-700 dark:text-zinc-300">
                👤 {report.reporter_display_name || "Citizen"}
              </span>
            )}

            {report.has_evidence && (
              <span className="font-medium text-emerald-600 dark:text-emerald-400">
                📎 {report.media_count} Verified Attachment{report.media_count > 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>

        <div className="mt-4">
          <Link
            href={`/reports/${report.id}`}
            className="block w-full text-center rounded-lg bg-zinc-50 dark:bg-zinc-800/80 hover:bg-zinc-100 dark:hover:bg-zinc-800 py-2 text-xs font-semibold text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 transition"
          >
            Read Verified Incident Report →
          </Link>
        </div>
      </div>
    </article>
  );
}
