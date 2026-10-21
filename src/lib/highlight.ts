import { createLowlight } from "lowlight";
import type { HLJSApi, Language } from "highlight.js";
import powershell from "highlight.js/lib/languages/powershell";
import python from "highlight.js/lib/languages/python";
import sql from "highlight.js/lib/languages/sql";
import yaml from "highlight.js/lib/languages/yaml";
import json from "highlight.js/lib/languages/json";
import ini from "highlight.js/lib/languages/ini";
import nginx from "highlight.js/lib/languages/nginx";
import dockerfile from "highlight.js/lib/languages/dockerfile";
import javascript from "highlight.js/lib/languages/javascript";

/**
 * A terminal-style shell grammar: the command word at the start of each command
 * is green, flags are orange (matches Warp-style runbooks better than hljs bash).
 */
function shell(hljs: HLJSApi): Language {
  const VAR = { scope: "variable", match: /\$(\{[^}]*\}|[A-Za-z_][A-Za-z0-9_]*|[0-9@#?$!*-])/ };
  const STRING = {
    scope: "string",
    variants: [
      { begin: /"/, end: /"/, contains: [hljs.BACKSLASH_ESCAPE, VAR] },
      { begin: /'/, end: /'/ },
    ],
  };
  return {
    name: "Shell",
    aliases: ["bash", "sh", "zsh", "console", "terminal"],
    contains: [
      hljs.HASH_COMMENT_MODE,
      STRING,
      VAR,
      // command word: start of line or after | ; && || ( or a prefix like sudo
      {
        scope: "built_in",
        match: /(?<=^|[|;&(]\s*|\b(?:sudo|time|exec|xargs|nohup|watch)\s+)[A-Za-z_./~][\w./~+-]*(?=\s|$|;)/,
        relevance: 0,
      },
      { scope: "attr", match: /(?<=\s)--?[A-Za-z0-9][\w-]*(=)?/ },
      { scope: "keyword", match: /\b(if|then|else|elif|fi|for|in|do|done|while|case|esac|function)\b/ },
      // standalone numbers only (not parts of IPs, paths or user@host)
      { scope: "number", match: /(?<![\w.@/:-])\d+(?![\w.:/-])/, relevance: 0 },
    ],
  };
}

export const lowlight = createLowlight();
lowlight.register({ shell, powershell, python, sql, yaml, json, ini, nginx, dockerfile, javascript });

export const LANGUAGES: { id: string; label: string }[] = [
  { id: "shell", label: "Shell" },
  { id: "powershell", label: "PowerShell" },
  { id: "python", label: "Python" },
  { id: "sql", label: "SQL" },
  { id: "yaml", label: "YAML" },
  { id: "json", label: "JSON" },
  { id: "nginx", label: "Nginx" },
  { id: "dockerfile", label: "Dockerfile" },
  { id: "ini", label: "INI / Config" },
  { id: "javascript", label: "JavaScript" },
  { id: "plaintext", label: "Plain text" },
];

export function languageLabel(id: string | null | undefined): string {
  if (!id) return "Shell";
  const canonical = normalizeLanguage(id);
  return LANGUAGES.find((l) => l.id === canonical)?.label ?? id;
}

export function normalizeLanguage(id: string | null | undefined): string {
  if (!id) return "shell";
  const lower = id.toLowerCase();
  if (["bash", "sh", "zsh", "console", "terminal"].includes(lower)) return "shell";
  if (["ps", "ps1", "pwsh"].includes(lower)) return "powershell";
  if (["py"].includes(lower)) return "python";
  if (["yml"].includes(lower)) return "yaml";
  if (["text", "txt", "plain"].includes(lower)) return "plaintext";
  return lower;
}
