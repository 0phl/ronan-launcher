import { invoke } from "@tauri-apps/api/core";
import type {
  Folder,
  ImportResult,
  Item,
  ItemInput,
  PasteOutcome,
  Settings,
  SettingsView,
} from "../types";

export const api = {
  listItems: () => invoke<Item[]>("list_items"),
  listFolders: () => invoke<Folder[]>("list_folders"),
  saveItem: (item: ItemInput) => invoke<Item>("save_item", { item }),
  deleteItem: (id: string) => invoke<void>("delete_item", { id }),
  moveItem: (id: string, folderId: string | null) => invoke<void>("move_item", { id, folderId }),
  getSecret: (id: string) => invoke<string | null>("get_secret", { id }),
  saveFolder: (name: string, parentId: string | null, id?: string) =>
    invoke<Folder>("save_folder", { id: id ?? null, name, parentId }),
  deleteFolder: (id: string) => invoke<void>("delete_folder", { id }),

  /** Pastes into the last external window (or just copies, see settings / copyOnly). */
  paste: (text: string, itemId: string | null, copyOnly = false) =>
    invoke<PasteOutcome>("paste_text", { text, itemId, copyOnly }),
  copySecret: (id: string) => invoke<boolean>("copy_secret", { id }),

  hidePopup: () => invoke<void>("hide_popup"),
  showManager: (view?: string) => invoke<void>("show_manager", { view: view ?? null }),

  getSettings: () => invoke<SettingsView>("get_settings"),
  saveSettings: (settings: Settings) => invoke<Settings>("save_settings", { settings }),

  exportData: (path: string, password: string) => invoke<number>("export_data", { path, password }),
  importData: (path: string, password: string, replace: boolean) =>
    invoke<ImportResult>("import_data", { path, password, replace }),
};

export function toInput(item: Item): ItemInput {
  const { hasSecret: _h, useCount: _u, lastUsedAt: _l, createdAt: _c, updatedAt: _up, ...rest } = item;
  return rest;
}

export function errorText(e: unknown): string {
  return typeof e === "string" ? e : e instanceof Error ? e.message : JSON.stringify(e);
}
