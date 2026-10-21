import { useCallback, useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { api } from "./api";
import { applyTheme } from "./theme";
import type { Folder, Item, Settings, SettingsView } from "../types";

/** Subscribes to a backend event for the lifetime of the component. */
export function useTauriEvent<T>(name: string, handler: (payload: T) => void) {
  useEffect(() => {
    let off: (() => void) | undefined;
    let cancelled = false;
    listen<T>(name, (e) => handler(e.payload)).then((u) => {
      if (cancelled) u();
      else off = u;
    });
    return () => {
      cancelled = true;
      off?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);
}

/** Items + folders, kept fresh via the "data:changed" event. */
export function useLibrary() {
  const [items, setItems] = useState<Item[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    const [i, f] = await Promise.all([api.listItems(), api.listFolders()]);
    setItems(i);
    setFolders(f);
    setLoaded(true);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);
  useTauriEvent("data:changed", () => reload());

  return { items, folders, loaded, reload };
}

/** Settings, kept fresh via "settings:changed"; applies the theme. */
export function useSettings() {
  const [view, setView] = useState<SettingsView | null>(null);

  const reload = useCallback(async () => {
    const v = await api.getSettings();
    setView(v);
    applyTheme(v.settings.theme);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);
  useTauriEvent<Settings>("settings:changed", () => reload());

  return { view, reload };
}

/** Debounced callback; flushes on unmount so edits are never lost. */
export function useDebouncedSave<T>(save: (value: T) => void, delay = 450) {
  const [pending, setPending] = useState<{ value: T } | null>(null);
  useEffect(() => {
    if (!pending) return;
    const t = setTimeout(() => {
      save(pending.value);
      setPending(null);
    }, delay);
    return () => clearTimeout(t);
  }, [pending, save, delay]);

  // flush on unmount
  const latest = useLatest(pending);
  const saveRef = useLatest(save);
  useEffect(
    () => () => {
      if (latest.current) saveRef.current(latest.current.value);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return useCallback((value: T) => setPending({ value }), []);
}

function useLatest<T>(value: T) {
  const [ref] = useState(() => ({ current: value }));
  ref.current = value;
  return ref;
}
