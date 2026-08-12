export const KEYBOARD_SHORTCUTS_STORAGE_KEY = "financial-advisor.keyboard-shortcuts.enabled";

export type ShortcutDefinition = {
  id: string;
  label: string;
  keys: string[];
};

export type ShortcutGroup = {
  label: string;
  shortcuts: ShortcutDefinition[];
};

export const APP_SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    label: "General actions",
    shortcuts: [
      { id: "search", label: "Search", keys: ["⌘ / Ctrl", "K"] },
      { id: "close", label: "Close current menu or dialog", keys: ["Esc"] },
      { id: "shortcuts", label: "Open shortcuts", keys: ["?"] },
    ],
  },
  {
    label: "Investment workspace",
    shortcuts: [
      { id: "privacy", label: "Toggle portfolio privacy", keys: ["I"] },
    ],
  },
];

export function keyboardShortcutsEnabled() {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(KEYBOARD_SHORTCUTS_STORAGE_KEY) !== "false";
}

export function setKeyboardShortcutsEnabled(enabled: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEYBOARD_SHORTCUTS_STORAGE_KEY, String(enabled));
  window.dispatchEvent(new CustomEvent("financial-advisor:keyboard-shortcuts-change", { detail: enabled }));
}

export function isEditableShortcutTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && (
    target.isContentEditable
    || target.tagName === "INPUT"
    || target.tagName === "TEXTAREA"
    || target.tagName === "SELECT"
  );
}
