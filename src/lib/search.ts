import Fuse, { type Expression, type IFuseOptions } from "fuse.js";
import type { Folder, Item } from "../types";
import { extractCodeBlocks, plainText, type CodeBlock } from "./markdown";
import { folderPath } from "./tree";

export type EntryKind = "ssh" | "snippet" | "note" | "block";

export interface Entry {
  key: string;
  kind: EntryKind;
  item: Item;
  /** Set for "block" entries: one code block inside a note. */
  block?: CodeBlock;
  /** What gets pasted on Enter (empty for notes: Enter drills in). */
  text: string;
  title: string;
  subtitle: string;
  // search fields ("name" is the item's own name; empty for blocks, whose title is their code)
  name: string;
  tags: string[];
  host: string;
  folder: string;
  heading: string;
  body: string;
}

function firstLine(s: string) {
  return s.trim().split("\n")[0] ?? "";
}

export function buildEntries(items: Item[], folders: Folder[]): Entry[] {
  const out: Entry[] = [];
  for (const item of items) {
    const folder = folderPath(folders, item.folderId).join(" / ");
    const host = [item.sshUser, item.sshHost].filter(Boolean).join("@");
    const base = { item, tags: item.tags, host, folder, heading: "" };

    if (item.kind === "note") {
      const blocks = extractCodeBlocks(item.content);
      out.push({
        ...base,
        key: item.id,
        kind: "note",
        name: item.title,
        text: "",
        title: item.title || "Untitled note",
        subtitle: [folder, blocks.length ? `${blocks.length} command${blocks.length > 1 ? "s" : ""}` : ""]
          .filter(Boolean)
          .join(" · "),
        body: plainText(item.content),
      });
      for (const block of blocks) {
        out.push({
          ...base,
          key: `${item.id}#${block.index}`,
          kind: "block",
          name: "",
          block,
          text: block.code,
          title: firstLine(block.code),
          subtitle: [item.title || "Untitled note", block.heading].filter(Boolean).join(" › "),
          heading: block.heading ?? "",
          body: block.code,
        });
      }
    } else {
      out.push({
        ...base,
        key: item.id,
        kind: item.kind,
        name: item.title,
        text: item.content,
        title: item.title || (item.kind === "ssh" ? "Untitled server" : "Untitled snippet"),
        subtitle: item.kind === "ssh" ? host || folder : firstLine(item.content) || folder,
        body: `${item.content}\n${item.notes}`,
      });
    }
  }
  return out;
}

const KEYS = [
  { name: "name", weight: 3 },
  { name: "tags", weight: 1.6 },
  { name: "host", weight: 1.6 },
  { name: "heading", weight: 1.4 },
  { name: "subtitle", weight: 1.2 },
  { name: "folder", weight: 1 },
  { name: "body", weight: 0.6 },
];

const OPTIONS: IFuseOptions<Entry> = {
  keys: KEYS,
  includeScore: true,
  ignoreLocation: true,
  threshold: 0.36,
  minMatchCharLength: 1,
};

export function createIndex(entries: Entry[]) {
  return new Fuse(entries, OPTIONS);
}

function boost(e: Entry): number {
  let b = 0;
  if (e.item.favorite) b += 0.05;
  b += Math.min(e.item.useCount, 25) * 0.004;
  if (e.item.lastUsedAt) {
    const days = (Date.now() - Date.parse(e.item.lastUsedAt)) / 86_400_000;
    if (days < 7) b += 0.04 * (1 - days / 7);
  }
  return b;
}

/** Empty query: favorites and recently/frequently used items first (no note blocks). */
function defaultOrder(entries: Entry[]): Entry[] {
  return entries
    .filter((e) => e.kind !== "block")
    .sort(
      (a, b) =>
        Number(b.item.favorite) - Number(a.item.favorite) ||
        (b.item.lastUsedAt ?? "").localeCompare(a.item.lastUsedAt ?? "") ||
        b.item.useCount - a.item.useCount ||
        a.title.localeCompare(b.title),
    );
}

/** Every word must match some field (so "ronan prod" can match title + tag). */
export function search(index: Fuse<Entry>, entries: Entry[], query: string, limit = 60): Entry[] {
  const words = query.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return defaultOrder(entries).slice(0, limit);

  const expr: Expression = {
    $and: words.map((w) => ({ $or: KEYS.map((k) => ({ [k.name]: w })) })),
  };
  return index
    .search(expr)
    // blocks inherit their note's title as a subtitle, so nudge them below the note itself;
    // they still win when the query matches their code (e.g. "moodle cache")
    .map((r) => ({ e: r.item, score: (r.score ?? 1) - boost(r.item) + (r.item.kind === "block" ? 0.02 : 0) }))
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map((r) => r.e);
}

/** Code blocks of one note, for drill-in. */
export function blocksOf(entries: Entry[], noteId: string): Entry[] {
  return entries.filter((e) => e.kind === "block" && e.item.id === noteId);
}
