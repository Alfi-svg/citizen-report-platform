"use client";

import React from "react";

export type AlertVariant = "info" | "success" | "warning" | "danger";

export interface AlertProps {
  variant?: AlertVariant;
  title?: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
  onClose?: () => void;
  className?: string;
}

export const Alert: React.FC<AlertProps> = ({
  variant = "info",
  title,
  children,
  icon,
  onClose,
  className = "",
}) => {
  const variantStyles: Record<
    AlertVariant,
    { container: string; title: string; text: string; defaultIcon: string }
  > = {
    info: {
      container:
        "bg-blue-50/80 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900/60 text-blue-900 dark:text-blue-200",
      title: "text-blue-950 dark:text-blue-100",
      text: "text-blue-800 dark:text-blue-300",
      defaultIcon: "ℹ️",
    },
    success: {
      container:
        "bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/60 text-emerald-900 dark:text-emerald-200",
      title: "text-emerald-950 dark:text-emerald-100",
      text: "text-emerald-800 dark:text-emerald-300",
      defaultIcon: "✓",
    },
    warning: {
      container:
        "bg-amber-50/80 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-200",
      title: "text-amber-950 dark:text-amber-100",
      text: "text-amber-800 dark:text-amber-300",
      defaultIcon: "⚠️",
    },
    danger: {
      container:
        "bg-red-50/80 dark:bg-red-950/40 border-red-200 dark:border-red-900/60 text-red-900 dark:text-red-200",
      title: "text-red-950 dark:text-red-100",
      text: "text-red-800 dark:text-red-300",
      defaultIcon: "🚨",
    },
  };

  const v = variantStyles[variant];

  return (
    <div
      role="alert"
      className={`relative flex items-start gap-3 rounded-xl border p-4 text-xs ${v.container} ${className}`}
    >
      <div className="shrink-0 text-sm">{icon || v.defaultIcon}</div>

      <div className="flex-1 space-y-0.5">
        {title && <p className={`font-bold ${v.title}`}>{title}</p>}
        <div className={`leading-relaxed ${v.text}`}>{children}</div>
      </div>

      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close alert"
          className="shrink-0 p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-lg transition"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
};
