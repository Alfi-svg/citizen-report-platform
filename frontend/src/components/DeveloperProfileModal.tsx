"use client";

import React, { useEffect, useRef } from "react";
import Image from "next/image";
import { DEVELOPER_CONFIG } from "@/lib/developerConfig";
import { Language } from "@/lib/i18n";

interface DeveloperProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang?: Language;
}

export default function DeveloperProfileModal({
  isOpen,
  onClose,
  lang = "en",
}: DeveloperProfileModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Keyboard accessibility: Escape key closes modal & trap initial focus
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    const timeout = setTimeout(() => closeButtonRef.current?.focus(), 50);

    // Prevent background scroll
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      clearTimeout(timeout);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isBn = lang === "bn";
  const name = isBn ? DEVELOPER_CONFIG.name_bn : DEVELOPER_CONFIG.name;
  const role = isBn ? DEVELOPER_CONFIG.role_bn : DEVELOPER_CONFIG.role;
  const tagline = isBn ? DEVELOPER_CONFIG.tagline_bn : DEVELOPER_CONFIG.tagline;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="developer-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        className="relative w-full max-w-sm rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 sm:p-7 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150"
      >
        {/* Top Close Button */}
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 cursor-pointer"
          aria-label={isBn ? "বন্ধ করুন" : "Close profile modal"}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Profile Header & Avatar */}
        <div className="flex flex-col items-center text-center space-y-3">
          {/* Avatar Container */}
          <div className="relative h-24 w-24 rounded-full overflow-hidden border-2 border-emerald-600/30 dark:border-emerald-500/30 shadow-md bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
            {DEVELOPER_CONFIG.photoUrl ? (
              <Image
                src={DEVELOPER_CONFIG.photoUrl}
                alt={DEVELOPER_CONFIG.name}
                fill
                className="object-cover"
                sizes="96px"
                priority
              />
            ) : (
              /* Professional Silhouette & Initials Placeholder */
              <div className="flex flex-col items-center justify-center text-emerald-800 dark:text-emerald-300">
                <span className="text-2xl font-black tracking-wider">AST</span>
                <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mt-0.5">
                  Creator
                </span>
              </div>
            )}
          </div>

          {/* Name & Role */}
          <div className="space-y-0.5">
            <h2
              id="developer-modal-title"
              className="text-lg font-black text-zinc-900 dark:text-zinc-100 tracking-tight"
            >
              {name}
            </h2>
            <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
              {role}
            </p>
          </div>

          {/* Short Description */}
          <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-xs">
            {tagline}
          </p>
        </div>

        {/* Social Connection Links */}
        <div className="space-y-2 pt-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 text-center">
            {isBn ? "যোগাযোগ ও সোশ্যাল প্রোফাইল" : "Connect & Profiles"}
          </p>

          <div className="grid grid-cols-3 gap-2">
            {/* LinkedIn */}
            <a
              href={DEVELOPER_CONFIG.linkedin || "https://www.linkedin.com/in/alfi-shahrin-talukder-a68450370/"}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center justify-center gap-1.5 p-2.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/60 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:text-blue-600 dark:hover:text-blue-400 transition text-xs font-semibold group shadow-2xs"
              title="LinkedIn Profile"
            >
              <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
                <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9v8.37H9.2V10.9H6.46M7.83 6.64c-.9 0-1.63.73-1.63 1.63 0 .9.73 1.63 1.63 1.63.9 0 1.63-.73 1.63-1.63 0-.9-.73-1.63-1.63-1.63Z" />
              </svg>
              <span className="text-[11px]">LinkedIn</span>
            </a>

            {/* GitHub */}
            <a
              href={DEVELOPER_CONFIG.github || "https://github.com/Alfi-svg"}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center justify-center gap-1.5 p-2.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/60 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:text-zinc-950 dark:hover:text-white transition text-xs font-semibold group shadow-2xs"
              title="GitHub Profile"
            >
              <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0 0 22 12.017C22 6.484 17.522 2 12 2Z" />
              </svg>
              <span className="text-[11px]">GitHub</span>
            </a>

            {/* Facebook */}
            <a
              href={DEVELOPER_CONFIG.facebook || "https://www.facebook.com/alfi.shahrin.talukder"}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center justify-center gap-1.5 p-2.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/60 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:text-blue-500 transition text-xs font-semibold group shadow-2xs"
              title="Facebook Profile"
            >
              <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
              <span className="text-[11px]">Facebook</span>
            </a>
          </div>
        </div>

        {/* Footer Close Button */}
        <div className="pt-2">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-xs font-bold text-zinc-800 dark:text-zinc-200 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 cursor-pointer"
          >
            {isBn ? "বন্ধ করুন" : "Close"}
          </button>
        </div>
      </div>
    </div>
  );
}
