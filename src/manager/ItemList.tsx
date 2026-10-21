import { useMemo, useState } from "react";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { AnimatePresence, motion } from "motion/react";
import { FileText, Plus, Search, SquareCode, Star, Terminal } from "lucide-react";
import type { Folder, Item, ItemKind } from "../types";
import { folderPath } from "../lib/tree";
import { TypeIcon } from "../components/TypeIcon";
import { IconButton, cx } from "../components/ui";
import { DRAG_MIME, MenuContent, MenuItem } from "./Sidebar";
import { relativeDate } from "./parts";

function subtitle(item: Item, folders: Folder[]): string {
  if (item.kind === "ssh") {
    const host = [item.sshUser, item.sshHost].filter(Boolean).join("@");
    return host || "No host yet";
  }
  if (item.kind === "snippet") return item.content.trim().split("\n")[0] || "Empty snippet";
  const firstText = item.content
    .split("\n")
    .map((l) => l.replace(/^#+\s*|^```.*$/g, "").trim())
    .find(Boolean);
  return firstText || folderPath(folders, item.folderId).join(" / ") || "Empty note";
}

export function ItemList({
  title,
  items,
  folders,
  selectedId,
  onSelect,
  onNew,
}: {
  title: string;
  items: Item[];
  folders: Folder[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNew: (kind: ItemKind) => void;
}) {
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? items.filter((i) =>
          [i.title, i.sshHost, i.sshUser, i.content, i.notes, i.tags.join(" ")]
            .join(" ")
            .toLowerCase()
            .includes(q),
        )
      : items;
    return [...filtered].sort(
      (a, b) => Number(b.favorite) - Number(a.favorite) || b.updatedAt.localeCompare(a.updatedAt),
    );
  }, [items, query]);

  return (
    <section className="flex h-full w-[312px] shrink-0 flex-col border-x border-line bg-bg-list">
      <div data-tauri-drag-region className="flex h-[52px] shrink-0 items-center justify-between pl-4 pr-2.5">
        <div data-tauri-drag-region className="min-w-0">
          <div data-tauri-drag-region className="truncate text-[14px] font-semibold tracking-[-0.01em]">
            {title}
          </div>
          <div data-tauri-drag-region className="text-[11px] text-muted">
            {visible.length} item{visible.length === 1 ? "" : "s"}
          </div>
        </div>
        <Menu.Root>
          <Menu.Trigger asChild>
            <IconButton label="New" shortcut="Ctrl+N" className="h-8 w-8">
              <Plus size={17} />
            </IconButton>
          </Menu.Trigger>
          <MenuContent>
            <MenuItem icon={<Terminal size={14} />} onSelect={() => onNew("ssh")}>
              New SSH Server
            </MenuItem>
            <MenuItem icon={<SquareCode size={14} />} onSelect={() => onNew("snippet")}>
              New Snippet
            </MenuItem>
            <MenuItem icon={<FileText size={14} />} onSelect={() => onNew("note")}>
              New Note
            </MenuItem>
          </MenuContent>
        </Menu.Root>
      </div>

      <div className="px-3 pb-2">
        <div className="flex h-8 items-center gap-2 rounded-lg bg-black/[0.045] px-2.5 transition-shadow focus-within:shadow-[0_0_0_3px_var(--accent-soft)] dark:bg-white/[0.06]">
          <Search size={13} className="text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            spellCheck={false}
            className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-faint"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        <AnimatePresence initial={false}>
          {visible.map((item) => {
            const active = item.id === selectedId;
            return (
              <motion.div
                key={item.id}
                layout="position"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.16 }}
              >
              <div
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(DRAG_MIME, item.id);
                  e.dataTransfer.effectAllowed = "move";
                }}
                onClick={() => onSelect(item.id)}
                className={cx(
                  "mb-0.5 flex cursor-default gap-2.5 rounded-lg px-2.5 py-2 transition-colors duration-100",
                  active ? "bg-accent text-white" : "hover:bg-black/[0.035] dark:hover:bg-white/[0.04]",
                )}
              >
                <span className={cx("mt-0.5", active && "[&>span]:!bg-white/20 [&>span]:!text-white")}>
                  <TypeIcon kind={item.kind} size={24} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">
                      {item.title || "Untitled"}
                    </span>
                    {item.favorite && (
                      <Star size={11} className={cx("shrink-0 fill-current", active ? "text-white" : "text-[#ffcc00]")} />
                    )}
                    <span className={cx("shrink-0 text-[11px]", active ? "text-white/75" : "text-faint")}>
                      {relativeDate(item.updatedAt)}
                    </span>
                  </div>
                  <div
                    className={cx(
                      "truncate text-[12px]",
                      item.kind !== "note" && "font-mono text-[11.5px]",
                      active ? "text-white/80" : "text-muted",
                    )}
                  >
                    {subtitle(item, folders)}
                  </div>
                </div>
              </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        {visible.length === 0 && (
          <div className="mt-16 px-6 text-center">
            <div className="text-[13px] font-medium text-muted">{query ? "No matches" : "Nothing here yet"}</div>
            {!query && (
              <button onClick={() => onNew("ssh")} className="mt-1.5 text-[12.5px] text-accent hover:underline">
                Add an SSH server
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
