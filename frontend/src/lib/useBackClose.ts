"use client";

import { useEffect, useRef } from "react";

/**
 * useBackClose
 *
 * Provides Android back-button (and browser back navigation) compatibility for
 * modals, drawers, and nested UI overlays.
 *
 * Expected behavior:
 * - When an overlay opens, a shallow history entry is pushed.
 * - If the user presses the Android back button / gesture, the popstate event
 *   intercepts it, closes the overlay, and keeps the user on the current page.
 * - If the user closes the overlay via UI (e.g. close button, backdrop click, ESC),
 *   the pushed history entry is cleanly reverted so history stays tidy.
 * - If the user navigates to a new route via a Link inside the overlay, history is
 *   preserved for the new route without accidental back-stepping.
 */
export function useBackClose(
  isOpen: boolean,
  onClose: () => void,
  id: string
) {
  const isHandlingPopRef = useRef(false);
  const pushedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (isOpen) {
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

        // If the overlay is closed via UI and NOT from popstate,
        // and user is still on the same page, step back in history to clean up.
        if (
          pushedRef.current &&
          !isHandlingPopRef.current &&
          window.location.pathname === initialPath &&
          window.history.state?.modalOverlay === id
        ) {
          pushedRef.current = false;
          window.history.back();
        }
      };
    } else {
      pushedRef.current = false;
    }
  }, [isOpen, onClose, id]);
}
