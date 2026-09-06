"use client";

import { Capacitor } from "@capacitor/core";
import { App, AppState } from "@capacitor/app";

export type AppStateCallback = (isActive: boolean) => void;

const stateListeners: Set<AppStateCallback> = new Set();
let isListening = false;
let currentAppActive = true;

/**
 * Initializes the Capacitor app lifecycle listener for background/foreground transitions.
 */
export function initAppLifecycleListener(): () => void {
  if (typeof window === "undefined" || !Capacitor.isNativePlatform() || isListening) {
    return () => {};
  }

  isListening = true;

  const setup = async () => {
    // Get initial state
    try {
      const state = await App.getState();
      currentAppActive = state.isActive;
    } catch {
      // Ignore
    }

    const handle = await App.addListener("appStateChange", (state: AppState) => {
      currentAppActive = state.isActive;

      // Dispatch custom window events for React components to subscribe easily
      if (typeof window !== "undefined") {
        const eventName = state.isActive ? "app:resume" : "app:pause";
        window.dispatchEvent(new CustomEvent(eventName, { detail: state }));
      }

      stateListeners.forEach((cb) => {
        try {
          cb(state.isActive);
        } catch (err) {
          console.warn("[AppLifecycle] Callback error:", err);
        }
      });
    });

    return () => {
      handle.remove();
      isListening = false;
    };
  };

  let cleanupFn: (() => void) | null = null;
  setup().then((cleaner) => {
    cleanupFn = cleaner;
  });

  return () => {
    if (cleanupFn) {
      cleanupFn();
    }
    isListening = false;
  };
}

/**
 * Subscribes to app active/background state changes.
 */
export function onAppStateChange(callback: AppStateCallback): () => void {
  stateListeners.add(callback);
  return () => {
    stateListeners.delete(callback);
  };
}

/**
 * Returns whether the application is currently active/foregrounded.
 */
export function isAppActive(): boolean {
  if (typeof document !== "undefined" && document.visibilityState === "hidden") {
    return false;
  }
  return currentAppActive;
}
