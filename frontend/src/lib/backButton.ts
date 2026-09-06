"use client";

import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

export enum BackPriority {
  OVERLAY = 100, // Modal dialogs, full-screen lightbox, bottom sheets
  DRAWER_MENU = 80, // Navbar drawer, search modal, dropdowns
  FORM_STEP = 60, // Multi-step form steps (e.g., Review mode)
  FORM_DIRTY = 40, // Unsaved changes confirmation
}

export interface BackHandlerItem {
  id: string;
  priority: BackPriority | number;
  handler: () => boolean | void | Promise<boolean | void>;
  timestamp: number;
}

// In-memory registry of active back handlers
const handlers: Map<string, BackHandlerItem> = new Map();

/**
 * Registers an active UI dismisser with the priority-ordered back button stack.
 * Returns an unregister cleanup function.
 */
export function registerBackHandler(
  id: string,
  priority: BackPriority | number,
  handler: () => boolean | void | Promise<boolean | void>
): () => void {
  handlers.set(id, {
    id,
    priority,
    handler,
    timestamp: Date.now(),
  });

  return () => {
    unregisterBackHandler(id);
  };
}

/**
 * Removes a registered back handler by ID.
 */
export function unregisterBackHandler(id: string): void {
  handlers.delete(id);
}

/**
 * Queries whether any overlay/modal or temporary UI is currently active.
 */
export function hasActiveOverlays(): boolean {
  return handlers.size > 0;
}

let isListenerAttached = false;
let removeCapacitorListener: (() => void) | null = null;

/**
 * Initializes the single, global Capacitor back-button listener for Android.
 * Integrates directly with the Next.js App Router for smooth route navigation.
 */
export function initBackButtonListener(
  router: AppRouterInstance,
  getPathname: () => string
): () => void {
  if (typeof window === "undefined" || !Capacitor.isNativePlatform()) {
    return () => {};
  }

  if (isListenerAttached) {
    return () => {};
  }

  isListenerAttached = true;

  const setupListener = async () => {
    const listenerHandle = await App.addListener("backButton", async () => {
      // 1. Check for active registered overlay / menu / form step handlers
      if (handlers.size > 0) {
        // Sort by priority descending; if tied, most recently registered first (LIFO)
        const sorted = Array.from(handlers.values()).sort((a, b) => {
          if (b.priority !== a.priority) {
            return b.priority - a.priority;
          }
          return b.timestamp - a.timestamp;
        });

        const topHandler = sorted[0];
        try {
          const result = await topHandler.handler();
          // If the handler didn't explicitly return false, consider it handled
          if (result !== false) {
            return;
          }
        } catch (err) {
          console.warn(`[BackButton] Handler '${topHandler.id}' threw an error:`, err);
        }
      }

      // 2. No overlay active -> Handle route navigation
      const currentPath = getPathname();

      // If at root path (/), exit the app cleanly
      if (currentPath === "/") {
        await App.exitApp();
        return;
      }

      // If on a non-root route, navigate back
      // Check if we have browser history stack depth
      const historyIdx = (window.history.state as { idx?: number })?.idx;
      const hasHistory = typeof historyIdx === "number" ? historyIdx > 0 : window.history.length > 1;

      if (hasHistory) {
        router.back();
      } else {
        // Deep-link landing without prior history -> safely navigate to Home
        router.push("/");
      }
    });

    removeCapacitorListener = () => {
      listenerHandle.remove();
      isListenerAttached = false;
    };
  };

  setupListener().catch((err) => {
    console.warn("[BackButton] Failed to attach App.addListener('backButton'):", err);
    isListenerAttached = false;
  });

  return () => {
    if (removeCapacitorListener) {
      removeCapacitorListener();
      removeCapacitorListener = null;
    }
    isListenerAttached = false;
  };
}
