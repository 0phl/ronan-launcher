import { useCallback, useEffect, useRef, useState } from "react";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { Copy, Eye, FolderInput, MoreHorizontal, Pencil, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api, errorText, toInput } from "../lib/api";
import { useDebouncedSave } from "../lib/hooks";
import { buildTree, folderPath, type FolderNode } from "../lib/tree";
import type { Folder, Item, ItemInput } from "../types";
import { IconButton, cx } from "../components/ui";
import { MenuContent, MenuItem } from "./Sidebar";
import { SshEditor } from "./SshEditor";
import { SnippetEditor } from "./SnippetEditor";
import { NoteEditor } from "./NoteEditor";

export type Update = (patch: Partial<ItemInput>) => void;

const KIND_LABEL = { ssh: "SSH Servers", snippet: "Snippets", note: "Notes" } as const;

export function ItemDetail({
  item,
  folders,
  isNew,
  onDelete,
  onDuplicate,
}: {
  item: Item;
  folders: Folder[];
  isNew: boolean;
  onDelete: (item: Item) => void;
  onDuplicate: (item: Item) => void;
}) {
  const [draft, setDraft] = useState<ItemInput>(() => toInput(item));
  const draftRef = useRef(draft);
  const latest = useRef(item);
  latest.current = item;

  // folder & favourite are changed directly (header, drag & drop): always take them from the latest item
  const save = useCallback((d: ItemInput) => {
    api
      .saveItem({ ...d, folderId: latest.current.folderId, favorite: latest.current.favorite })
      .catch((e) => toast.error(errorText(e)));
  }, []);
  const queueSave = useDebouncedSave(save);

  const update: Update = useCallback(
    (patch) => {
      const next = { ...draftRef.current, ...patch };
      draftRef.current = next;
      setDraft(next);
      queueSave(next);
    },
    [queueSave],
  );

  const [editing, setEditing] = useState(isNew || (item.kind === "note" && !item.content.trim()));

  useEffect(() => {
    if (item.kind !== "note") return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "e") {
        e.preventDefault();
        setEditing((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [item.kind]);

  const toggleFavorite = () =>
    api
      .saveItem({ ...draftRef.current, folderId: item.folderId, favorite: !item.favorite })
      .catch((e) => toast.error(errorText(e)));

  const path = folderPath(folders, item.folderId);
  const crumbs = path.length ? path : [KIND_LABEL[item.kind]];

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col">
      <header data-tauri-drag-region className="flex h-[52px] shrink-0 items-center gap-2 px-5">
        <div data-tauri-drag-region className="min-w-0 flex-1 truncate text-[12px] text-muted">
          {crumbs.join(" / ")}
        </div>

        {item.kind === "note" && (
          <button
            onClick={() => setEditing((v) => !v)}
            className={cx(
              "mr-1 flex h-7 items-center gap-1.5 rounded-md px-2 text-[12px] transition-colors hover:bg-surface-2",
              editing ? "text-accent" : "text-muted",
            )}
            title="Toggle editing (Ctrl+E)"
          >
            {editing ? "Editing" : "Viewing"}
            {editing ? <Pencil size={13} /> : <Eye size={13} />}
          </button>
        )}

        <IconButton label={item.favorite ? "Remove from Favorites" : "Add to Favorites"} onClick={toggleFavorite}>
          <Star size={15} className={item.favorite ? "fill-[#ffcc00] text-[#ffcc00]" : ""} />
        </IconButton>

        <Menu.Root>
          <Menu.Trigger asChild>
            <IconButton label="Move to Folder">
              <FolderInput size={15} />
            </IconButton>
          </Menu.Trigger>
          <MenuContent>
            <MenuItem onSelect={() => api.moveItem(item.id, null)}>
              <span className={cx(!item.folderId && "font-semibold")}>No folder</span>
            </MenuItem>
            {flatten(buildTree(folders)).map((f) => (
              <MenuItem key={f.id} onSelect={() => api.moveItem(item.id, f.id)}>
                <span style={{ paddingLeft: f.depth * 12 }} className={cx(item.folderId === f.id && "font-semibold")}>
                  {f.name}
                </span>
              </MenuItem>
            ))}
          </MenuContent>
        </Menu.Root>

        <Menu.Root>
          <Menu.Trigger asChild>
            <IconButton label="More">
              <MoreHorizontal size={16} />
            </IconButton>
          </Menu.Trigger>
          <MenuContent>
            <MenuItem icon={<Copy size={14} />} onSelect={() => onDuplicate({ ...item, ...draftRef.current } as Item)}>
              Duplicate
            </MenuItem>
            <Menu.Separator className="my-1 h-px bg-[var(--border)]" />
            <MenuItem danger icon={<Trash2 size={14} />} onSelect={() => onDelete(item)}>
              Delete
            </MenuItem>
          </MenuContent>
        </Menu.Root>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[740px] px-10 pb-24 pt-4">
          {item.kind === "ssh" && <SshEditor item={item} draft={draft} update={update} autoFocus={isNew} />}
          {item.kind === "snippet" && <SnippetEditor item={item} draft={draft} update={update} autoFocus={isNew} />}
          {item.kind === "note" && (
            <NoteEditor item={item} draft={draft} update={update} editing={editing} autoFocus={isNew} />
          )}
        </div>
      </div>
    </div>
  );
}

function flatten(nodes: FolderNode[]): FolderNode[] {
  return nodes.flatMap((n) => [n, ...flatten(n.children)]);
}
