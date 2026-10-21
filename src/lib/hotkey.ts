/** Converts between KeyboardEvents, stored shortcut strings and display chips. */

const MODIFIER_CODES = new Set([
  "ControlLeft",
  "ControlRight",
  "ShiftLeft",
  "ShiftRight",
  "AltLeft",
  "AltRight",
  "MetaLeft",
  "MetaRight",
  "OSLeft",
  "OSRight",
]);

/** Returns e.g. "Ctrl+Shift+Space", or null while only modifiers are held / no modifier is used. */
export function shortcutFromEvent(e: KeyboardEvent): string | null {
  if (MODIFIER_CODES.has(e.code)) return null;
  const mods: string[] = [];
  if (e.ctrlKey) mods.push("Ctrl");
  if (e.altKey) mods.push("Alt");
  if (e.shiftKey) mods.push("Shift");
  if (e.metaKey) mods.push("Super");
  if (mods.length === 0) return null;
  // global-hotkey accepts "A", "1", "Space", "F5", "Backquote", "ArrowUp" ...
  const key = e.code.replace(/^Key/, "").replace(/^Digit/, "");
  return [...mods, key].join("+");
}

const DISPLAY: Record<string, string> = {
  Super: "Win",
  Backquote: "`",
  Minus: "-",
  Equal: "=",
  BracketLeft: "[",
  BracketRight: "]",
  Backslash: "\\",
  Semicolon: ";",
  Quote: "'",
  Comma: ",",
  Period: ".",
  Slash: "/",
  ArrowUp: "↑",
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
};

export function shortcutParts(shortcut: string): string[] {
  return shortcut.split("+").map((p) => DISPLAY[p] ?? p);
}
