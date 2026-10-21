import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Toaster, toast } from "sonner";
import { Command } from "lucide-react";
import { api, errorText, toInput } from "../lib/api";
import { useLibrary, useSettings, useTauriEvent } from "../lib/hooks";
import { isDark } from "../lib/theme";
import { shortcutParts } from "../lib/hotkey";
import type { Item, ItemInput, ItemKind } from "../types";
import { Kbd } from "../components/ui";
import { Sidebar, filterByScope, scopeTitle, type Scope } from "./Sidebar";
import { ItemList } from "./ItemList";
import { ItemDetail } from "./ItemDetail";
import { SettingsDialog } from "./Settings";

const NEW_ITEM: Record<ItemKind, Pick<ItemInput, "title" | "language">> = {
  ssh: { title: "", language: null },
  snippet: { title: "", language: "shell" },
  note: { title: "", language: null },
};

export function Manager() {
  const { items, folders, loaded } = useLibrary();
  const { view } = useSettings();
  const [scope, setScope] = useState<Scope>({ kind: "all" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newId, setNewId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const scoped = useMemo(() => filterByScope(items, folders, scope), [items, folders, scope]);
  const selected = items.find((i) => i.id === selectedId) ?? null;

  const createItem = useCallback(
    async (kind: ItemKind) => {
      try {
        const folderId = scope.kind === "folder" ? scope.id : null;
        const item = await api.saveItem({
          kind,
          folderId,
          ...NEW_ITEM[kind],
          content: "",
          notes: "",
          sshHost: null,
          sshUser: null,
          sshPort: null,
          sshKeyPath: null,
          tags: scope.kind === "tag" ? [scope.tag] : [],
          favorite: scope.kind === "favorites",
        });
        if (scope.kind === "type" && scope.type !== kind) setScope({ kind: "all" });
        setNewId(item.id);
        setSelectedId(item.id);
      } catch (e) {
        toast.error(errorText(e));
      }
    },
    [scope],
  );

  const deleteItem = async (item: Item) => {
    try {
      const secret = item.hasSecret ? ((await api.getSecret(item.id)) ?? undefined) : undefined;
      await api.deleteItem(item.id);
      if (selectedId === item.id) setSelectedId(null);
      toast(`Deleted “${item.title || "Untitled"}”`, {
        action: {
          label: "Undo",
          onClick: () =>
            api.saveItem({ ...toInput(item), secret }).then((restored) => setSelectedId(restored.id)),
        },
      });
    } catch (e) {
      toast.error(errorText(e));
    }
  };

  const duplicateItem = async (item: Item) => {
    try {
      const secret = item.hasSecret ? ((await api.getSecret(item.id)) ?? undefined) : undefined;
      const { id: _id, ...rest } = toInput(item);
      const copy = await api.saveItem({ ...rest, title: `${item.title || "Untitled"} copy`, secret });
      setSelectedId(copy.id);
    } catch (e) {
      toast.error(errorText(e));
    }
  };

  // navigation requests from the tray / popup ("settings", "new:ssh", "item:<id>")
  useTauriEvent<string>("manager:navigate", (v) => {
    if (v === "settings") setSettingsOpen(true);
    else if (v.startsWith("new:")) createItem(v.slice(4) as ItemKind);
    else if (v.startsWith("item:")) {
      setScope({ kind: "all" });
      setSelectedId(v.slice(5));
    }
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key.toLowerCase() === "n") {
        e.preventDefault();
        createItem(scope.kind === "type" ? scope.type : "ssh");
      } else if (e.key === ",") {
        e.preventDefault();
        setSettingsOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [createItem, scope]);

  const hotkey = view?.settings.hotkey ?? "Ctrl+Shift+Space";

  return (
    <div className="flex h-screen w-screen text-fg">
      <Sidebar
        items={items}
        folders={folders}
        scope={scope}
        onScope={setScope}
        onOpenSettings={() => setSettingsOpen(true)}
        hotkey={hotkey}
      />
      <ItemList
        title={scopeTitle(scope, folders)}
        items={scoped}
        folders={folders}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onNew={createItem}
      />
      <main className="grain relative flex min-w-0 flex-1 bg-bg">
        <AnimatePresence mode="wait" initial={false}>
          {selected ? (
            <motion.div
              key={selected.id}
              className="flex min-w-0 flex-1"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.14 }}
            >
              <ItemDetail
                item={selected}
                folders={folders}
                isNew={selected.id === newId}
                onDelete={deleteItem}
                onDuplicate={duplicateItem}
              />
            </motion.div>
          ) : (
            loaded && <EmptyDetail key="empty" hotkey={hotkey} onNew={() => createItem("ssh")} />
          )}
        </AnimatePresence>
      </main>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} view={view} />
      <Toaster
        position="bottom-right"
        theme={view?.settings.theme === "system" ? "system" : isDark() ? "dark" : "light"}
        toastOptions={{
          className: "!rounded-xl !border !border-line !bg-bg !text-fg !shadow-[var(--shadow-lg)] !font-sans !text-[13px]",
        }}
      />
    </div>
  );
}

function EmptyDetail({ hotkey, onNew }: { hotkey: string; onNew: () => void }) {
  return (
    <motion.div
      data-tauri-drag-region
      className="flex flex-1 flex-col items-center justify-center text-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft text-accent">
        <Command size={26} />
      </div>
      <div className="text-[15px] font-semibold">Everything you need, one shortcut away</div>
      <div className="mt-1.5 flex items-center gap-1 text-[12.5px] text-muted">
        Press
        {shortcutParts(hotkey).map((p) => (
          <Kbd key={p}>{p}</Kbd>
        ))}
        anywhere to search and paste.
      </div>
      <button onClick={onNew} className="mt-4 text-[12.5px] font-medium text-accent hover:underline">
        Add an SSH server
      </button>
    </motion.div>
  );
}
