"use client";

import { useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { registerBackHandler, BackPriority } from "@/lib/backButton";

/**
 * useBackClose
 *
 * Provides Android hardware/gesture Back button and browser back navigation
 * compatibility for modals, drawers, and nested UI overlays.
 *
 * Native Android Behavior:
 * - Registers directly with the centralized priority-ordered Back Handler Registry.
 * - Hardware back dismisses the topmost active modal without polluting or
 *   desynchronizing the WebView browser history stack.
 *
 * Web Browser Behavior:
 * - Pushes a shallow history state ({ modalOverlay: id }).
 * - Intercepts browser 'popstate' to close the overlay cleanly.
 * - Reverts the history entry when closed via UI (close button, backdrop, ESC).
 */
export function useBackClose(
  isOpen: boolean,
  onClose: () => void,
  id: string,
  priority: BackPriority | number = BackPriority.OVERLAY
) {
  const isHandlingPopRef = useRef(false);
  const pushedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || !isOpen) {
      pushedRef.current = false;
      return;
    }

    // 1. Native Android platform: Hook directly into Capacitor Back Priority Registry
    if (Capacitor.isNativePlatform()) {
      const unregister = registerBackHandler(id, priority, () => {
        onClose();
        return true;
      });

      return () => {
        unregister();
      };
    }

    // 2. Web Browser: Use History API pushState / popstate
    const initialPath = window.location.pathname;

    if (!pushedRef.current) {
      window.history.pushState(
        { ...window.history.state, modalOverlay: id },
        ""
      );
      pushedRef.current = true;
    }

    const handlePopState = () => {
      isHandlingPopRef.current = true;
      pushedRef.current = false;
      onClose();
      setTimeout(() => {
        isHandlingPopRef.current = false;
      }, 50);
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);

      // If the overlay is closed via UI (close button, backdrop, link click)
      // and NOT from a popstate event, clean up the pushed history state using
      // replaceState instead of history.back(). Using back() would cancel any
      // navigation that was just triggered by clicking a drawer/modal link.
      if (
        pushedRef.current &&
        !isHandlingPopRef.current &&
        window.history.state?.modalOverlay === id
      ) {
        pushedRef.current = false;
        // Replace current state to remove the overlay marker — does NOT navigate back.
        const { modalOverlay: _removed, ...cleanState } = window.history.state || {};
        window.history.replaceState(cleanState, "");
      }
    };
  }, [isOpen, onClose, id, priority]);
}
