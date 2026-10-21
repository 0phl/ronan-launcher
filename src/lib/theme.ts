import { getCurrentWindow } from "@tauri-apps/api/window";
import type { Theme } from "../types";

const media = window.matchMedia("(prefers-color-scheme: dark)");
let current: Theme = "system";

function resolved(theme: Theme): "light" | "dark" {
  if (theme === "system") return media.matches ? "dark" : "light";
  return theme;
}

/** Applies the theme to the page and to the native window (so Mica/Acrylic match). */
export function applyTheme(theme: Theme) {
  current = theme;
  document.documentElement.dataset.theme = resolved(theme);
  getCurrentWindow()
    .setTheme(theme === "system" ? null : theme)
    .catch(() => {});
}

media.addEventListener("change", () => {
  if (current === "system") applyTheme("system");
});

export function isDark() {
  return document.documentElement.dataset.theme === "dark";
}
