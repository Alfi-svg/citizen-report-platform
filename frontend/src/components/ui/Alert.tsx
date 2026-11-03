"use client";

import React from "react";
import { Info, CircleCheck, TriangleAlert, ShieldAlert, X } from "lucide-react";

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
    { container: string; title: string; text: string; defaultIcon: React.ReactNode }
  > = {
    info: {
      container:
        "bg-blue-50/80 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900/60 text-blue-900 dark:text-blue-200",
      title: "text-blue-950 dark:text-blue-100",
      text: "text-blue-800 dark:text-blue-300",
      defaultIcon: <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" aria-hidden="true" />,
    },
    success: {
      container:
        "bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/60 text-emerald-900 dark:text-emerald-200",
      title: "text-emerald-950 dark:text-emerald-100",
      text: "text-emerald-800 dark:text-emerald-300",
      defaultIcon: <CircleCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />,
    },
    warning: {
      container:
        "bg-amber-50/80 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-200",
      title: "text-amber-950 dark:text-amber-100",
      text: "text-amber-800 dark:text-amber-300",
      defaultIcon: <TriangleAlert className="h-4 w-4 text-amber-600 dark:text-amber-400" aria-hidden="true" />,
    },
    danger: {
      container:
        "bg-red-50/80 dark:bg-red-950/40 border-red-200 dark:border-red-900/60 text-red-900 dark:text-red-200",
      title: "text-red-950 dark:text-red-100",
      text: "text-red-800 dark:text-red-300",
      defaultIcon: <ShieldAlert className="h-4 w-4 text-red-600 dark:text-red-400" aria-hidden="true" />,
    },
  };

  const v = variantStyles[variant];

  return (
    <div
      role="alert"
      className={`relative flex items-start gap-3 rounded-xl border p-4 text-xs ${v.container} ${className}`}
    >
      <div className="shrink-0 mt-0.5">{icon || v.defaultIcon}</div>

      <div className="flex-1 space-y-0.5">
        {title && <p className={`font-bold ${v.title}`}>{title}</p>}
        <div className={`leading-relaxed ${v.text}`}>{children}</div>
      </div>

      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close alert"
          className="shrink-0 p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg transition"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
};
