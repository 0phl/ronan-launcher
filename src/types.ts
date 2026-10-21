export type ItemKind = "ssh" | "snippet" | "note";

export interface Item {
  id: string;
  kind: ItemKind;
  folderId: string | null;
  title: string;
  content: string;
  language: string | null;
  notes: string;
  sshHost: string | null;
  sshUser: string | null;
  sshPort: number | null;
  sshKeyPath: string | null;
  hasSecret: boolean;
  tags: string[];
  favorite: boolean;
  useCount: number;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** `secret`: undefined = keep, "" = clear, otherwise set. */
export interface ItemInput {
  id?: string;
  kind: ItemKind;
  folderId: string | null;
  title: string;
  content: string;
  language: string | null;
  notes: string;
  sshHost: string | null;
  sshUser: string | null;
  sshPort: number | null;
  sshKeyPath: string | null;
  secret?: string;
  tags: string[];
  favorite: boolean;
}

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export type Theme = "system" | "light" | "dark";

export interface Settings {
  hotkey: string;
  theme: Theme;
  pasteMode: "auto" | "copy";
  pasteKey: "ctrl+v" | "shift+insert";
  restoreClipboard: boolean;
  autostart: boolean;
}

export interface SettingsView {
  settings: Settings;
  hotkeyError: string | null;
  dataDir: string;
}

export type PasteOutcome = "pasted" | "copied" | "copiedNoTarget";

export interface ImportResult {
  added: number;
  updated: number;
  skipped: number;
  backup: string | null;
}
