const THEME_STORAGE_KEY = "app-theme";

// Theme-name vocabulary kept stable for backward compat with stored
// values: "default" = the original Prometheus dark; "mono" = the
// light variant. The product default flipped to light per user
// request — fresh visits without a stored preference now land on
// mono. Old users who had explicitly chosen "default" (dark) still
// get dark.
export type ThemeName = "default" | "mono";

const FALLBACK_THEME: ThemeName = "mono";

export function applyTheme(theme: string, persist = false): ThemeName {
  const nextTheme: ThemeName = theme === "default" ? "default" : "mono";
  document.documentElement.dataset.theme = nextTheme;
  if (persist) {
    localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  }
  return nextTheme;
}

export function initStoredTheme(persist = false): ThemeName {
  return applyTheme(localStorage.getItem(THEME_STORAGE_KEY) || FALLBACK_THEME, persist);
}

export function bindThemeSync(onChange?: (theme: ThemeName) => void): void {
  window.addEventListener("storage", (event) => {
    if (event.key !== THEME_STORAGE_KEY) {
      return;
    }
    const nextTheme = applyTheme(event.newValue || FALLBACK_THEME);
    onChange?.(nextTheme);
  });
}

export function getStoredThemeKey(): string {
  return THEME_STORAGE_KEY;
}
