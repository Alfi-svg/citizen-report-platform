"use client";

import React, { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { initBackButtonListener } from "@/lib/backButton";
import { initAppLifecycleListener } from "@/lib/appLifecycle";

interface AndroidLifecycleProviderProps {
  children: React.ReactNode;
}

/**
 * Top-level provider that manages:
 * 1. The single global Android hardware/gesture back-button listener.
 * 2. Capacitor application lifecycle (foreground/background transitions).
 *
 * Ensures clean setup on mount and proper cleanup on unmount with zero memory leaks.
 */
export default function AndroidLifecycleProvider({
  children,
}: AndroidLifecycleProviderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    // 1. Initialize Android hardware back button handler
    const cleanupBack = initBackButtonListener(router, () => pathnameRef.current);

    // 2. Initialize Android app lifecycle coordinator
    const cleanupLifecycle = initAppLifecycleListener();

    return () => {
      cleanupBack();
      cleanupLifecycle();
    };
  }, [router]);

  return <>{children}</>;
}
