/**
 * localStorage wrapper that survives private/locked-down browser modes.
 * A plain localStorage call throws in some contexts (private mode, certain
 * security policies) and would crash the app. These helpers degrade silently.
 */
export const safeLocalStorage = {
  get(key: string, fallback = ""): string {
    try {
      return localStorage.getItem(key) ?? fallback;
    } catch {
      return fallback;
    }
  },
  set(key: string, value: string): boolean {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  },
  remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch { /* ignore */ }
  },
};
