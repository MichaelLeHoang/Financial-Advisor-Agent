export const SETTINGS_STORAGE_KEY = "financial-advisor.settings";

export type AppThemePreference = "Deep Space" | "White" | "Crimson" | "System";
export type ResolvedAppTheme = Exclude<AppThemePreference, "System">;
export type AppAppearancePreference = "Solid" | "Glass";

export const APP_THEME_OPTIONS = [
  { name: "White", label: "Light", primary: "#fbfcff", secondary: "#7c3aed" },
  { name: "Deep Space", label: "Dark", primary: "#6366f1", secondary: "#22d3ee" },
  { name: "Crimson", label: "Red", primary: "#ef4444", secondary: "#f97316" },
  { name: "System", label: "System", primary: "#a3a3a3", secondary: "#fafafa" },
] as const satisfies ReadonlyArray<{ name: AppThemePreference; label: string; primary: string; secondary: string }>;

export const APP_APPEARANCE_OPTIONS = [
  { name: "Solid", label: "Solid" },
  { name: "Glass", label: "Glass" },
] as const satisfies ReadonlyArray<{ name: AppAppearancePreference; label: string }>;

export function resolveAppTheme(preference: string, prefersDark: boolean): ResolvedAppTheme {
  if (preference === "System") return prefersDark ? "Deep Space" : "White";
  if (preference === "White" || preference === "Crimson") return preference;
  return "Deep Space";
}

export function readThemePreference(): AppThemePreference {
  if (typeof window === "undefined") return "Deep Space";
  try {
    const stored = JSON.parse(window.localStorage.getItem(SETTINGS_STORAGE_KEY) || "{}");
    return APP_THEME_OPTIONS.some((theme) => theme.name === stored.theme) ? stored.theme : "Deep Space";
  } catch {
    return "Deep Space";
  }
}

export function persistThemePreference(theme: AppThemePreference) {
  if (typeof window === "undefined") return;
  try {
    const stored = JSON.parse(window.localStorage.getItem(SETTINGS_STORAGE_KEY) || "{}");
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ ...stored, theme }));
  } catch {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ theme }));
  }
  window.dispatchEvent(new CustomEvent("financial-advisor:theme-change", { detail: theme }));
}

export function resolveAppAppearance(value: unknown): AppAppearancePreference {
  return value === "Glass" ? "Glass" : "Solid";
}

export function readAppearancePreference(): AppAppearancePreference {
  if (typeof window === "undefined") return "Solid";
  try {
    const stored = JSON.parse(window.localStorage.getItem(SETTINGS_STORAGE_KEY) || "{}");
    return resolveAppAppearance(stored.appearance);
  } catch {
    return "Solid";
  }
}

export function persistAppearancePreference(appearance: AppAppearancePreference) {
  if (typeof window === "undefined") return;
  try {
    const stored = JSON.parse(window.localStorage.getItem(SETTINGS_STORAGE_KEY) || "{}");
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ ...stored, appearance }));
  } catch {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ appearance }));
  }
  window.dispatchEvent(new CustomEvent("financial-advisor:appearance-change", { detail: appearance }));
}
