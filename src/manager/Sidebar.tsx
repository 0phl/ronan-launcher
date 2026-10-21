import { useMemo, useState, type DragEvent, type ReactNode } from "react";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { motion } from "motion/react";
import {
  ChevronRight,
  FileText,
  Folder as FolderIcon,
  FolderPlus,
  Hash,
  Layers,
  MoreHorizontal,
  Settings as SettingsIcon,
  SquareCode,
  Star,
  Terminal,
} from "lucide-react";
import { toast } from "sonner";
import { api, errorText } from "../lib/api";
import { buildTree, descendantIds, type FolderNode } from "../lib/tree";
import { shortcutParts } from "../lib/hotkey";
import type { Folder, Item, ItemKind } from "../types";
import { IconButton, Kbd, PromptDialog, cx } from "../components/ui";
import { TrafficLights } from "./TitleControls";

export type Scope =
  | { kind: "all" }
  | { kind: "type"; type: ItemKind }
  | { kind: "favorites" }
  | { kind: "folder"; id: string }
  | { kind: "tag"; tag: string };

export function sameScope(a: Scope, b: Scope) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function filterByScope(items: Item[], folders: Folder[], scope: Scope): Item[] {
  switch (scope.kind) {
    case "all":
      return items;
    case "type":
      return items.filter((i) => i.kind === scope.type);
    case "favorites":
      return items.filter((i) => i.favorite);
    case "tag":
      return items.filter((i) => i.tags.includes(scope.tag));
    case "folder": {
      const ids = descendantIds(folders, scope.id);
      return items.filter((i) => i.folderId && ids.has(i.folderId));
    }
  }
}

export function scopeTitle(scope: Scope, folders: Folder[]): string {
  switch (scope.kind) {
    case "all":
      return "All Items";
    case "favorites":
      return "Favorites";
    case "tag":
      return `#${scope.tag}`;
    case "folder":
      return folders.find((f) => f.id === scope.id)?.name ?? "Folder";
    case "type":
      return { ssh: "SSH Servers", snippet: "Snippets", note: "Notes" }[scope.type];
  }
}

export const DRAG_MIME = "application/x-ronan-item";

function useDrop(onDropItem: (id: string) => void) {
  const [over, setOver] = useState(false);
  return {
    over,
    props: {
      onDragOver: (e: DragEvent) => {
        if (e.dataTransfer.types.includes(DRAG_MIME)) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          setOver(true);
        }
      },
      onDragLeave: () => setOver(false),
      onDrop: (e: DragEvent) => {
        setOver(false);
        const id = e.dataTransfer.getData(DRAG_MIME);
        if (id) onDropItem(id);
      },
    },
  };
}

function NavRow({
  icon,
  label,
  count,
  active,
  onClick,
  depth = 0,
  dropTarget,
  leading,
  trailing,
}: {
  icon: ReactNode;
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
  depth?: number;
  dropTarget?: (id: string) => void;
  leading?: ReactNode;
  trailing?: ReactNode;
}) {
  const drop = useDrop(dropTarget ?? (() => {}));
  return (
    <div
      onClick={onClick}
      {...(dropTarget ? drop.props : {})}
      className={cx(
        "group relative flex h-[30px] items-center gap-2 rounded-md pr-2 text-[13px] transition-colors",
        active ? "text-fg" : "text-fg/90 hover:bg-black/[0.04] dark:hover:bg-white/[0.05]",
        drop.over && "ring-2 ring-accent ring-inset",
      )}
      style={{ paddingLeft: 8 + depth * 14 }}
    >
      {active && (
        <motion.div
          layoutId="sidebar-selection"
          className="absolute inset-0 rounded-md bg-black/[0.08] dark:bg-white/[0.1]"
          transition={{ type: "spring", stiffness: 600, damping: 42 }}
        />
      )}
      <span className="relative flex w-3.5 justify-center">{leading}</span>
      <span className={cx("relative flex", active ? "text-accent" : "text-muted")}>{icon}</span>
      <span className="relative min-w-0 flex-1 truncate">{label}</span>
      <span className="relative flex items-center">
        {trailing}
        {count !== undefined && count > 0 && (
          <span className="ml-1 text-[11.5px] tabular-nums text-faint group-hover:hidden">{count}</span>
        )}
      </span>
    </div>
  );
}

function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mb-0.5 mt-5 flex h-6 items-center justify-between pl-2.5 pr-1">
      <span className="text-[11px] font-semibold text-faint">{title}</span>
      {action}
    </div>
  );
}

export function Sidebar({
  items,
  folders,
  scope,
  onScope,
  onOpenSettings,
  hotkey,
}: {
  items: Item[];
  folders: Folder[];
  scope: Scope;
  onScope: (s: Scope) => void;
  onOpenSettings: () => void;
  hotkey: string;
}) {
  const tree = useMemo(() => buildTree(folders), [folders]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<
    { mode: "new"; parentId: string | null } | { mode: "rename"; folder: Folder } | null
  >(null);

  const tags = useMemo(() => {
    const counts = new Map<string, number>();
    items.forEach((i) => i.tags.forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1)));
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [items]);

  const count = (s: Scope) => filterByScope(items, folders, s).length;
  const move = (folderId: string | null) => (id: string) =>
    api.moveItem(id, folderId).catch((e) => toast.error(errorText(e)));

  const library: { scope: Scope; icon: ReactNode; label: string }[] = [
    { scope: { kind: "all" }, icon: <Layers size={15} />, label: "All Items" },
    { scope: { kind: "type", type: "ssh" }, icon: <Terminal size={15} />, label: "SSH Servers" },
    { scope: { kind: "type", type: "snippet" }, icon: <SquareCode size={15} />, label: "Snippets" },
    { scope: { kind: "type", type: "note" }, icon: <FileText size={15} />, label: "Notes" },
    { scope: { kind: "favorites" }, icon: <Star size={15} />, label: "Favorites" },
  ];

  const renderFolder = (node: FolderNode): ReactNode => {
    const s: Scope = { kind: "folder", id: node.id };
    const open = !collapsed.has(node.id);
    return (
      <div key={node.id}>
        <NavRow
          icon={<FolderIcon size={15} />}
          label={node.name}
          count={count(s)}
          depth={node.depth}
          active={sameScope(scope, s)}
          onClick={() => onScope(s)}
          dropTarget={move(node.id)}
          leading={
            node.children.length > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setCollapsed((c) => {
                    const n = new Set(c);
                    if (n.has(node.id)) n.delete(node.id);
                    else n.add(node.id);
                    return n;
                  });
                }}
                className="text-faint hover:text-fg"
              >
                <ChevronRight size={12} className={cx("transition-transform duration-150", open && "rotate-90")} />
              </button>
            )
          }
          trailing={
            <Menu.Root>
              <Menu.Trigger asChild>
                <button
                  onClick={(e) => e.stopPropagation()}
                  className="hidden rounded p-0.5 text-muted hover:bg-surface-2 hover:text-fg group-hover:flex data-[state=open]:flex"
                >
                  <MoreHorizontal size={14} />
                </button>
              </Menu.Trigger>
              <MenuContent>
                <MenuItem onSelect={() => setDialog({ mode: "new", parentId: node.id })}>New Subfolder</MenuItem>
                <MenuItem onSelect={() => setDialog({ mode: "rename", folder: node })}>Rename…</MenuItem>
                <Menu.Separator className="my-1 h-px bg-[var(--border)]" />
                <MenuItem
                  danger
                  onSelect={() => {
                    if (sameScope(scope, s)) onScope({ kind: "all" });
                    api.deleteFolder(node.id).catch((e) => toast.error(errorText(e)));
                    toast(`Deleted folder “${node.name}”. Its items moved up a level.`);
                  }}
                >
                  Delete Folder
                </MenuItem>
              </MenuContent>
            </Menu.Root>
          }
        />
        {open && node.children.map(renderFolder)}
      </div>
    );
  };

  return (
    <aside className="flex h-full w-[236px] shrink-0 flex-col bg-sidebar">
      <div data-tauri-drag-region className="flex h-[52px] shrink-0 items-center px-4">
        <TrafficLights />
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-3">
        <SectionHeader title="Library" />
        {library.map((l) => (
          <NavRow
            key={l.label}
            icon={l.icon}
            label={l.label}
            count={count(l.scope)}
            active={sameScope(scope, l.scope)}
            onClick={() => onScope(l.scope)}
            dropTarget={l.scope.kind === "all" ? move(null) : undefined}
          />
        ))}

        <SectionHeader
          title="Folders"
          action={
            <IconButton label="New Folder" onClick={() => setDialog({ mode: "new", parentId: null })} className="h-6 w-6">
              <FolderPlus size={14} />
            </IconButton>
          }
        />
        {tree.length === 0 && (
          <button
            onClick={() => setDialog({ mode: "new", parentId: null })}
            className="ml-2.5 text-[12px] text-faint hover:text-accent"
          >
            Create a folder…
          </button>
        )}
        {tree.map(renderFolder)}

        {tags.length > 0 && (
          <>
            <SectionHeader title="Tags" />
            {tags.map(([tag, n]) => (
              <NavRow
                key={tag}
                icon={<Hash size={14} />}
                label={tag}
                count={n}
                active={sameScope(scope, { kind: "tag", tag })}
                onClick={() => onScope({ kind: "tag", tag })}
              />
            ))}
          </>
        )}
      </nav>

      <div className="flex items-center justify-between border-t border-line px-3 py-2.5">
        <button
          onClick={onOpenSettings}
          className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[12.5px] text-muted hover:bg-black/[0.04] hover:text-fg dark:hover:bg-white/[0.05]"
        >
          <SettingsIcon size={14} /> Settings
        </button>
        <span className="flex items-center gap-0.5" title="Open the launcher from anywhere">
          {shortcutParts(hotkey).map((p) => (
            <Kbd key={p}>{p}</Kbd>
          ))}
        </span>
      </div>

      <PromptDialog
        open={dialog !== null}
        onOpenChange={(o) => !o && setDialog(null)}
        title={dialog?.mode === "rename" ? "Rename Folder" : "New Folder"}
        label="Folder name"
        initial={dialog?.mode === "rename" ? dialog.folder.name : ""}
        confirmLabel={dialog?.mode === "rename" ? "Rename" : "Create"}
        onConfirm={(name) => {
          if (!dialog) return;
          const p =
            dialog.mode === "rename"
              ? api.saveFolder(name, dialog.folder.parentId, dialog.folder.id)
              : api.saveFolder(name, dialog.parentId).then((f) => onScope({ kind: "folder", id: f.id }));
          p.catch((e) => toast.error(errorText(e)));
        }}
      />
    </aside>
  );
}

export function MenuContent({ children }: { children: ReactNode }) {
  return (
    <Menu.Portal>
      <Menu.Content
        align="start"
        sideOffset={4}
        className="z-50 min-w-[180px] rounded-xl border border-line bg-bg/95 p-1 shadow-[var(--shadow-lg)] backdrop-blur-xl"
      >
        {children}
      </Menu.Content>
    </Menu.Portal>
  );
}

export function MenuItem({
  children,
  onSelect,
  danger,
  icon,
}: {
  children: ReactNode;
  onSelect: () => void;
  danger?: boolean;
  icon?: ReactNode;
}) {
  return (
    <Menu.Item
      onSelect={onSelect}
      className={cx(
        "flex h-7 cursor-default items-center gap-2 rounded-md px-2 text-[13px] outline-none data-[highlighted]:bg-accent data-[highlighted]:text-white",
        danger ? "text-danger" : "text-fg",
      )}
    >
      {icon}
      {children}
    </Menu.Item>
  );
}
