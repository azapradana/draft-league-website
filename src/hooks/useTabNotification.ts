"use client";

import { useEffect } from "react";

/**
 * Appends an unread badge to document.title (e.g. "Round 2 Started! (1)")
 * while the tab is in the background. The original title is restored when the
 * tab regains focus or when `count` drops back to 0.
 */
export function useTabNotification(count: number, message?: string) {
  useEffect(() => {
    if (count <= 0) return;

    const originalTitle = document.title;
    const badgeTitle = `${message ?? originalTitle} (${count})`;
    let applied = false;

    const apply = () => {
      document.title = badgeTitle;
      applied = true;
    };
    const restore = () => {
      if (applied) document.title = originalTitle;
      applied = false;
    };
    const onVisibility = () => (document.hidden ? apply() : restore());

    if (document.hidden) apply();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", restore);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", restore);
      restore();
    };
  }, [count, message]);
}
