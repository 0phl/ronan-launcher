import type { Folder } from "../types";

export interface FolderNode extends Folder {
  children: FolderNode[];
  depth: number;
}

export function buildTree(folders: Folder[]): FolderNode[] {
  const byId = new Map<string, FolderNode>();
  folders.forEach((f) => byId.set(f.id, { ...f, children: [], depth: 0 }));
  const roots: FolderNode[] = [];
  byId.forEach((node) => {
    const parent = node.parentId ? byId.get(node.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  });
  const setDepth = (nodes: FolderNode[], d: number) =>
    nodes.forEach((n) => {
      n.depth = d;
      n.children.sort((a, b) => a.name.localeCompare(b.name));
      setDepth(n.children, d + 1);
    });
  roots.sort((a, b) => a.name.localeCompare(b.name));
  setDepth(roots, 0);
  return roots;
}

/** "Personal / Notes" style path for a folder id. */
export function folderPath(folders: Folder[], id: string | null): string[] {
  const byId = new Map(folders.map((f) => [f.id, f]));
  const parts: string[] = [];
  let cur = id ? byId.get(id) : undefined;
  const seen = new Set<string>();
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    parts.unshift(cur.name);
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return parts;
}

/** The folder and all its descendants. */
export function descendantIds(folders: Folder[], id: string): Set<string> {
  const ids = new Set([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const f of folders) {
      if (f.parentId && ids.has(f.parentId) && !ids.has(f.id)) {
        ids.add(f.id);
        grew = true;
      }
    }
  }
  return ids;
}
