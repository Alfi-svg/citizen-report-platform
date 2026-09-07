"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PublicReport, ReactionSummary, ReactionType, ReactionToggleResponse } from "@/lib/types";
import { getApiBaseUrl, apiFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import FlagModal from "@/components/FlagModal";

interface PublicReportCardProps {
  report: PublicReport;
}

export default function PublicReportCard({ report }: PublicReportCardProps) {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [copied, setCopied] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isFlagModalOpen, setIsFlagModalOpen] = useState(false);

  // Reactions state
  const [reactions, setReactions] = useState<ReactionSummary>({
    report_id: report.id,
    support_count: 0,
    important_count: 0,
    user_reactions: [],
  });
  const [isReacting, setIsReacting] = useState(false);

  // Comments count state
  const [commentCount, setCommentCount] = useState<number>(0);

  const apiBase = getApiBaseUrl();
  const firstImage = report.media?.find(
    (m) => m.media_type === "image" || m.mime_type.startsWith("image/")
  );

  const getFullUrl = (downloadUrl: string) => {
    if (downloadUrl.startsWith("http")) return downloadUrl;
    const normalizedPath = downloadUrl.replace(/^\/api\/v1/, "");
    return `${apiBase}${normalizedPath}`;
  };

  // Load reactions & comments count on mount
  useEffect(() => {
    let isMounted = true;

    // Fetch reactions
    apiFetch<ReactionSummary>(`/public/reports/${report.id}/reactions`)
      .then((res) => {
        if (isMounted) setReactions(res);
      })
      .catch(() => {});

    // Fetch comments count
    apiFetch<{ total: number }>(`/public/reports/${report.id}/comments?limit=1`)
      .then((res) => {
        if (isMounted) setCommentCount(res.total || 0);
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [report.id, isAuthenticated]);

  // Toggle reaction
  const handleToggleReaction = async (type: ReactionType, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isAuthenticated) {
      router.push(`/login?redirect=/reports/${report.id}`);
      return;
    }

    if (isReacting) return;
    setIsReacting(true);

    try {
      const res = await apiFetch<ReactionToggleResponse>(
        `/reports/${report.id}/reactions`,
        {
          method: "POST",
          body: JSON.stringify({ reaction_type: type }),
        }
      );
      setReactions(res.summary);
    } catch {
      // Graceful fallback
    } finally {
      setIsReacting(false);
    }
  };

  const hasSupported = reactions.user_reactions.includes("SUPPORT");

  // Share handler
  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const url = `${window.location.origin}/reports/${report.id}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: report.title,
          text: `Platform-Reviewed Citizen Report: ${report.title} in ${report.location_text}`,
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

  // Format date
  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "";
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <>
      <article className="group relative flex flex-col justify-between rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs hover:shadow-md hover:border-emerald-600/50 dark:hover:border-emerald-500/50 transition-all duration-200 overflow-hidden">
        <div>
          {/* 1. Card Top Bar: Category Badge + Author / Time + More Menu */}
          <div className="p-4 pb-3 flex items-center justify-between gap-2 border-b border-slate-100 dark:border-zinc-800/70">
            <div className="flex items-center gap-2 min-w-0">
              {/* Category Pill */}
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-900/60 shrink-0">
                {report.category?.name || "Civic Incident"}
              </span>

              {/* Author / Anonymous Indicator */}
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                {report.is_anonymous ? (
                  <span className="inline-flex items-center gap-1 font-medium">
                    <svg className="h-3.5 w-3.5 text-zinc-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75h-.152c-3.196 0-6.1-1.249-8.25-3.286Zm0 13.036h.008v.008H12v-.008Z" />
                    </svg>
                    <span>Anonymous</span>
                  </span>
                ) : (
                  <span className="font-medium truncate">
                    {report.reporter_display_name || "Citizen"}
                  </span>
                )}
              </span>
            </div>

            {/* More Menu (•••) */}
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowMenu(!showMenu);
                }}
                className="h-7 w-7 rounded-lg text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center text-xs font-bold transition"
                aria-label="More options for this report"
                title="More options"
              >
                •••
              </button>

              {showMenu && (
                <>
                  <div
                    className="fixed inset-0 z-20"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu(false);
                    }}
                  />
                  <div className="absolute right-0 top-8 z-30 w-48 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-1 shadow-lg text-xs space-y-0.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        setShowMenu(false);
                        handleShare(e);
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 flex items-center gap-2.5"
                    >
                      <svg className="h-4 w-4 text-zinc-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
                      </svg>
                      <span>{copied ? "Link Copied!" : "Copy Report Link"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setShowMenu(false);
                        setIsFlagModalOpen(true);
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center gap-2.5"
                    >
                      <svg className="h-4 w-4 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0 2.77-.693a9 9 0 0 1 6.208.682l.108.054a9 9 0 0 0 6.086.71l3.114-.732a.75.75 0 0 0 .574-.73V4.382a.75.75 0 0 0-.916-.73l-2.88.677a9 9 0 0 1-6.086-.71l-.108-.054a9 9 0 0 0-6.208-.682L3 4.5M3 15V4.5" />
                      </svg>
                      <span>Flag / Report Content</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* 2. Title & Short Description */}
          <div className="p-4 space-y-2">
            <h3 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100 line-clamp-2 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition leading-snug">
              <Link href={`/reports/${report.id}`}>
                {report.title}
              </Link>
            </h3>

            <p className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-3 leading-relaxed">
              {report.description}
            </p>

            {/* Metadata: Approximate Location + Date */}
            <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
              <div className="inline-flex items-center gap-1 font-medium bg-slate-100 dark:bg-zinc-800 px-2.5 py-0.5 rounded-lg max-w-full truncate">
                <svg className="h-3 w-3 text-zinc-500 dark:text-zinc-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                </svg>
                <span className="truncate">{report.location_text}</span>
              </div>
              <div className="inline-flex items-center gap-1 font-medium">
                <svg className="h-3 w-3 text-zinc-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                <span>{formatDate(report.created_at)}</span>
              </div>
            </div>
          </div>

          {/* 3. Evidence Preview (if available) */}
          {firstImage && (
            <Link
              href={`/reports/${report.id}`}
              className="block relative aspect-16/9 w-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden border-y border-zinc-100 dark:border-zinc-800"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={getFullUrl(firstImage.download_url)}
                alt={firstImage.caption || report.title}
                className="h-full w-full object-cover group-hover:scale-102 transition duration-300"
                loading="lazy"
              />
              {report.media_count > 1 && (
                <span className="absolute bottom-2 right-2 rounded-md bg-zinc-950/80 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-xs flex items-center gap-1">
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                  </svg>
                  <span>+{report.media_count - 1} more</span>
                </span>
              )}
            </Link>
          )}
        </div>

        {/* 4. Bottom Row: Reactions, Comments, Share, and Platform-Reviewed Badge */}
        <div className="p-3 border-t border-slate-100 dark:border-zinc-800/70 bg-slate-50 dark:bg-zinc-900/50">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            {/* Social Interactions */}
            <div className="flex items-center gap-1 flex-wrap">
              {/* Support / Helpful Reaction */}
              <button
                type="button"
                onClick={(e) => handleToggleReaction("SUPPORT", e)}
                disabled={isReacting}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold active:scale-95 transition ${
                  hasSupported
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 shadow-2xs"
                    : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/70 dark:hover:bg-zinc-700/60"
                }`}
                title={isAuthenticated ? "Support this civic report" : "Sign in to react"}
              >
                <svg className={`h-3.5 w-3.5 ${hasSupported ? "text-emerald-700 dark:text-emerald-400" : "text-zinc-500"}`} fill={hasSupported ? "currentColor" : "none"} viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.633 10.25c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 0 1 2.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 0 0 .322-1.672V2.75a.75.75 0 0 1 .75-.75 2.25 2.25 0 0 1 2.25 2.25c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282m0 0h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 0 1-2.649 7.521c-.388.482-.987.729-1.605.729H13.48c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 0 0-1.423-.23H5.25" />
                </svg>
                <span>{reactions.support_count > 0 ? reactions.support_count : "Support"}</span>
              </button>

              {/* Comments count link */}
              <Link
                href={`/reports/${report.id}#comments`}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/70 dark:hover:bg-zinc-700/60 active:scale-95 transition"
                title="View discussion & comments"
              >
                <svg className="h-3.5 w-3.5 text-zinc-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a.75.75 0 0 1-.774-.954 4.542 4.542 0 0 0 .524-1.636A8.04 8.04 0 0 1 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
                </svg>
                <span>{commentCount > 0 ? commentCount : "Comment"}</span>
              </Link>

              {/* Share button */}
              <button
                type="button"
                onClick={handleShare}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/70 dark:hover:bg-zinc-700/60 active:scale-95 transition"
                title="Share report"
              >
                <svg className="h-3.5 w-3.5 text-zinc-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z" />
                </svg>
                <span>{copied ? "Copied" : "Share"}</span>
              </button>
            </div>

            {/* Platform Reviewed Status Badge */}
            <div className="shrink-0">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/60 dark:border-blue-900/60">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-pulse" />
                <span>Reviewed</span>
              </span>
            </div>
          </div>
        </div>
      </article>

      {/* Flag / Report Modal */}
      {isFlagModalOpen && (
        <FlagModal
          isOpen={isFlagModalOpen}
          onClose={() => setIsFlagModalOpen(false)}
          targetType="REPORT"
          targetId={report.id}
          targetTitleOrSnippet={report.title}
        />
      )}
    </>
  );
}
