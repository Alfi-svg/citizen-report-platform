"use client";

import React from "react";
import { Button } from "./Button";

// ==============================================================================
// 1. EMPTY STATE
// ==============================================================================

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = "📋",
  title,
  description,
  actionLabel,
  onAction,
  className = "",
}) => (
  <div
    className={`rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 p-8 sm:p-12 text-center flex flex-col items-center justify-center ${className}`}
  >
    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-2xl shadow-2xs mb-4">
      {icon}
    </div>
    <h3 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
      {title}
    </h3>
    {description && (
      <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1.5 max-w-md leading-relaxed">
        {description}
      </p>
    )}
    {actionLabel && onAction && (
      <div className="mt-6">
        <Button variant="primary" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      </div>
    )}
  </div>
);

// ==============================================================================
// 2. LOADING STATE
// ==============================================================================

export interface LoadingStateProps {
  label?: string;
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  label = "Loading data...",
  className = "",
}) => (
  <div
    className={`flex flex-col items-center justify-center py-12 px-4 text-center space-y-3 ${className}`}
  >
    <div className="relative flex h-10 w-10 items-center justify-center">
      <div className="absolute h-full w-full rounded-full border-2 border-emerald-600/20" />
      <div className="h-full w-full animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
    </div>
    <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 animate-pulse">
      {label}
    </p>
  </div>
);

// ==============================================================================
// 3. ERROR STATE
// ==============================================================================

export interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = "Something went wrong",
  message,
  onRetry,
  retryLabel = "Try Again",
  className = "",
}) => (
  <div
    className={`rounded-2xl border border-red-200 dark:border-red-900/60 bg-red-50/50 dark:bg-red-950/30 p-6 sm:p-8 text-center flex flex-col items-center justify-center ${className}`}
  >
    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100 dark:bg-red-900/60 text-red-600 dark:text-red-300 text-xl shadow-2xs mb-3">
      ⚠️
    </div>
    <h4 className="text-sm font-bold text-red-950 dark:text-red-100">{title}</h4>
    <p className="text-xs text-red-800 dark:text-red-300 mt-1 max-w-md leading-relaxed">
      {message}
    </p>
    {onRetry && (
      <div className="mt-4">
        <Button variant="danger" size="sm" onClick={onRetry}>
          {retryLabel}
        </Button>
      </div>
    )}
  </div>
);

// ==============================================================================
// 4. SKELETON
// ==============================================================================

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  shape?: "rectangle" | "circle";
}

export const Skeleton: React.FC<SkeletonProps> = ({
  shape = "rectangle",
  className = "",
  ...props
}) => {
  const shapeClass = shape === "circle" ? "rounded-full" : "rounded-lg";
  return (
    <div
      className={`animate-pulse bg-zinc-200 dark:bg-zinc-800/80 ${shapeClass} ${className}`}
      {...props}
    />
  );
};
