"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { CommentPagination, PublicComment } from "@/lib/types";

interface CommentsSectionProps {
  reportId: string;
}

export default function CommentsSection({ reportId }: CommentsSectionProps) {
  const { isAuthenticated, user } = useAuth();
  const [comments, setComments] = useState<PublicComment[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Submission state
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    apiFetch<CommentPagination>(`/public/reports/${reportId}/comments?limit=50&offset=0`)
      .then((data) => {
        if (isMounted) {
          setComments(data.items);
          setTotal(data.total);
        }
      })
      .catch((err: unknown) => {
        if (isMounted && err instanceof Error) setError(err.message);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [reportId, isAuthenticated]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;

    setSubmitError(null);
    setSubmitting(true);
    try {
      const newComment = await apiFetch<PublicComment>(
        `/reports/${reportId}/comments`,
        {
          method: "POST",
          body: JSON.stringify({ body: body.trim() }),
        }
      );
      setComments((prev) => [...prev, newComment]);
      setTotal((prev) => prev + 1);
      setBody("");
    } catch (err: unknown) {
      if (err instanceof Error) setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!confirm("Are you sure you want to remove your comment?")) return;

    setDeletingId(commentId);
    try {
      await apiFetch(`/comments/${commentId}`, {
        method: "DELETE",
      });
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      setTotal((prev) => Math.max(0, prev - 1));
    } catch (err: unknown) {
      if (err instanceof Error) alert(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section className="space-y-6 pt-4 border-t border-zinc-200 dark:border-zinc-800">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <span>💬 Citizen Discussion / নাগরিক প্রতিক্রিয়া</span>
          <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-2.5 py-0.5 text-xs text-zinc-600 dark:text-zinc-400 font-semibold">
            {total}
          </span>
        </h2>
      </div>

      {/* Comment Input Box (Authenticated) or Prompt */}
      {isAuthenticated ? (
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <textarea
              rows={3}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={1000}
              placeholder="Contribute factual updates, local witness context, or community feedback..."
              className="w-full rounded-2xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 p-3.5 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {submitError && (
            <p className="text-xs text-red-600 dark:text-red-400 font-medium">
              {submitError}
            </p>
          )}

          <div className="flex items-center justify-between">
            <span className="text-[11px] text-zinc-400">
              {body.length} / 1000 characters
            </span>
            <button
              type="submit"
              disabled={submitting || !body.trim()}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500 transition disabled:opacity-40 shadow-sm"
            >
              {submitting ? "Posting..." : "Post Comment / মন্তব্য করুন"}
            </button>
          </div>
        </form>
      ) : (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-800/40 p-5 text-center space-y-3">
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            Sign in to participate in the civic discussion, provide on-the-ground updates, or verify community impact.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link
              href="/login"
              className="rounded-xl bg-zinc-900 dark:bg-zinc-100 px-4 py-2 text-xs font-semibold text-white dark:text-zinc-900 hover:bg-zinc-800"
            >
              Sign In to Comment
            </Link>
            <Link
              href="/register"
              className="rounded-xl border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100"
            >
              Register
            </Link>
          </div>
        </div>
      )}

      {/* Comments List */}
      {loading ? (
        <div className="flex justify-center py-6">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
        </div>
      ) : error ? (
        <p className="text-xs text-red-600">{error}</p>
      ) : comments.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 p-8 text-center text-xs text-zinc-400">
          No comments have been posted yet. Be the first citizen to contribute.
        </div>
      ) : (
        <div className="space-y-3">
          {comments.map((comment) => (
            <div
              key={comment.id}
              className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/40 p-4 space-y-2 text-xs"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-zinc-900 dark:text-zinc-100">
                    👤 {comment.user_display_name}
                  </span>
                  {comment.is_own_comment && (
                    <span className="rounded bg-emerald-100 dark:bg-emerald-950 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800 dark:text-emerald-300">
                      You
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-zinc-400">
                    {new Date(comment.created_at).toLocaleString()}
                  </span>
                  {(comment.is_own_comment || user?.role === "ADMIN") && (
                    <button
                      type="button"
                      onClick={() => handleDelete(comment.id)}
                      disabled={deletingId === comment.id}
                      className="text-red-500 hover:text-red-700 font-medium text-[11px] hover:underline"
                    >
                      {deletingId === comment.id ? "Deleting..." : "Delete"}
                    </button>
                  )}
                </div>
              </div>
              <p className="text-zinc-800 dark:text-zinc-200 leading-relaxed whitespace-pre-wrap">
                {comment.body}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
