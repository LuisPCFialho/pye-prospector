import { useEffect } from "react";

/** Calls onEscape when the Escape key is pressed (while enabled). */
export function useEscapeKey(onEscape: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") onEscape();
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onEscape, enabled]);
}

/** True if the event target is a text input / textarea / contentEditable. */
function isTyping(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  if (!t) return false;
  const tag = t.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || t.isContentEditable;
}

export interface ShortcutMap {
  [key: string]: () => void;
}

/**
 * Registers global single-key shortcuts (ignored while typing in a field).
 * Keys are matched case-insensitively against e.key.
 */
export function useGlobalShortcuts(shortcuts: ShortcutMap, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    function handler(e: KeyboardEvent) {
      if (isTyping(e) || e.metaKey || e.ctrlKey || e.altKey) return;
      const fn = shortcuts[e.key.toLowerCase()];
      if (fn) { e.preventDefault(); fn(); }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [shortcuts, enabled]);
}
