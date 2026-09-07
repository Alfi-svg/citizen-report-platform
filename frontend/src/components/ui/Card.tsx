"use client";

import React, { forwardRef } from "react";

export type CardVariant = "default" | "glass" | "subtle" | "elevated";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
  variant?: CardVariant;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ children, className = "", hoverable = false, variant = "default", ...props }, ref) => {
    const hoverClass = hoverable
      ? "hover:border-emerald-600/50 hover:shadow-xs transition-all duration-150"
      : "";

    const variantStyles: Record<CardVariant, string> = {
      default:
        "bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-2xs",
      glass:
        "bg-white/92 dark:bg-zinc-900/92 backdrop-blur-md border border-slate-200/80 dark:border-white/10 shadow-2xs",
      subtle:
        "bg-slate-50/80 dark:bg-zinc-900/40 border border-slate-200/60 dark:border-zinc-800/60",
      elevated:
        "bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-md",
    };

    return (
      <div
        ref={ref}
        className={`rounded-2xl ${variantStyles[variant]} ${hoverClass} ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Card.displayName = "Card";

export const CardHeader = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ children, className = "", ...props }, ref) => (
    <div
      ref={ref}
      className={`p-4 sm:p-5 border-b border-slate-100/80 dark:border-zinc-800/70 ${className}`}
      {...props}
    >
      {children}
    </div>
  )
);
CardHeader.displayName = "CardHeader";

export const CardTitle = forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ children, className = "", ...props }, ref) => (
    <h3
      ref={ref}
      className={`text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100 tracking-tight ${className}`}
      {...props}
    >
      {children}
    </h3>
  )
);
CardTitle.displayName = "CardTitle";

export const CardDescription = forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ children, className = "", ...props }, ref) => (
    <p
      ref={ref}
      className={`text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed ${className}`}
      {...props}
    >
      {children}
    </p>
  )
);
CardDescription.displayName = "CardDescription";

export const CardContent = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ children, className = "", ...props }, ref) => (
    <div ref={ref} className={`p-4 sm:p-5 ${className}`} {...props}>
      {children}
    </div>
  )
);
CardContent.displayName = "CardContent";

export const CardFooter = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ children, className = "", ...props }, ref) => (
    <div
      ref={ref}
      className={`p-4 sm:p-5 pt-0 flex items-center justify-between gap-3 border-t border-slate-100/80 dark:border-zinc-800/70 pt-4 ${className}`}
      {...props}
    >
      {children}
    </div>
  )
);
CardFooter.displayName = "CardFooter";
