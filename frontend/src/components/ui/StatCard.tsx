"use client";

import React from "react";
import { Card } from "./Card";

export interface StatCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: {
    value: string | number;
    isPositive?: boolean;
    label?: string;
  };
  variant?: "emerald" | "amber" | "red" | "blue" | "neutral";
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  subtitle,
  icon,
  trend,
  variant = "neutral",
  className = "",
}) => {
  const iconVariantStyles: Record<string, string> = {
    emerald: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
    amber: "bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
    red: "bg-red-50 text-red-800 dark:bg-red-950/60 dark:text-red-300",
    blue: "bg-blue-50 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300",
    neutral: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  };

  return (
    <Card className={`p-4 sm:p-5 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
            {label}
          </p>
          <p className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">
            {value}
          </p>
          {subtitle && (
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500 leading-tight pt-0.5">
              {subtitle}
            </p>
          )}
          {trend && (
            <div className="flex items-center gap-1 pt-1 text-[11px] font-bold">
              <span className={trend.isPositive ? "text-emerald-600" : "text-red-600"}>
                {trend.isPositive ? "↑" : "↓"} {trend.value}
              </span>
              {trend.label && (
                <span className="text-zinc-400 font-normal">{trend.label}</span>
              )}
            </div>
          )}
        </div>

        {icon && (
          <div
            className={`flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl text-lg font-bold shadow-2xs shrink-0 ${iconVariantStyles[variant]}`}
          >
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
};
