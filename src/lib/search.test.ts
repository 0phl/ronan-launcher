import { describe, expect, it } from "vitest";
import type { Item } from "../types";
import { blocksOf, buildEntries, createIndex, search } from "./search";

let n = 0;
function item(p: Partial<Item>): Item {
  n++;
  return {
    id: `id${n}`,
    kind: "ssh",
    folderId: null,
    title: "",
    content: "",
    language: null,
    notes: "",
    sshHost: null,
    sshUser: null,
    sshPort: null,
    sshKeyPath: null,
    hasSecret: false,
    tags: [],
    favorite: false,
    useCount: 0,
    lastUsedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...p,
  };
}

const items: Item[] = [
  item({ title: "Ronan SSH", sshHost: "10.0.0.5", sshUser: "root", content: "ssh root@10.0.0.5", tags: ["prod"] }),
  item({ title: "Staging box", sshHost: "staging.example.com", content: "ssh deploy@staging.example.com" }),
  item({ kind: "snippet", title: "Disk usage", content: "df -h" }),
  item({
    kind: "note",
    title: "Clear moodle temp/cache files",
    content:
      "## Check your moodledata location\n\n```shell\ngrep 'dataroot' /lms/moodle/config.php\n```\n\n## Clean temp files\n\n```shell\nrm -rf /moodledata/temp/*\n```\n\n```shell\nrm -rf /moodledata/cache/*\n```",
  }),
];

const entries = buildEntries(items, []);
const index = createIndex(entries);

describe("search", () => {
  it("finds an SSH entry by partial name", () => {
    expect(search(index, entries, "ron")[0].title).toBe("Ronan SSH");
  });

  it("matches words across fields (title + tag)", () => {
    expect(search(index, entries, "ronan prod")[0].title).toBe("Ronan SSH");
  });

  it("finds a code block inside a note", () => {
    const top = search(index, entries, "moodle cache").find((e) => e.kind === "block");
    expect(top?.text).toBe("rm -rf /moodledata/cache/*");
  });

  it("matches blocks by their own code, not just their note's title", () => {
    const blocks = search(index, entries, "moodle temp").filter((e) => e.kind === "block");
    expect(blocks[0].text).toBe("rm -rf /moodledata/temp/*");
    expect(search(index, entries, "dataroot")[0].text).toContain("grep 'dataroot'");
  });

  it("ranks a note above its own blocks when only the note title matches", () => {
    expect(search(index, entries, "moodle")[0].kind).toBe("note");
  });

  it("empty query lists items (not blocks), favourites and recent first", () => {
    const fav = item({ title: "Zeta", favorite: true });
    const recent = item({ title: "Alpha", lastUsedAt: new Date().toISOString(), useCount: 3 });
    const all = buildEntries([...items, fav, recent], []);
    const res = search(createIndex(all), all, "");
    expect(res.every((e) => e.kind !== "block")).toBe(true);
    expect(res[0].title).toBe("Zeta");
    expect(res[1].title).toBe("Alpha");
  });

  it("frequently used items rank higher among equal matches", () => {
    const a = item({ title: "web server 1" });
    const b = item({ title: "web server 2", useCount: 20 });
    const all = buildEntries([a, b], []);
    expect(search(createIndex(all), all, "web server")[0].title).toBe("web server 2");
  });

  it("lists a note's blocks for drill-in", () => {
    const note = items[3];
    const blocks = blocksOf(entries, note.id);
    expect(blocks.map((b) => b.subtitle)).toEqual([
      "Clear moodle temp/cache files › Check your moodledata location",
      "Clear moodle temp/cache files › Clean temp files",
      "Clear moodle temp/cache files › Clean temp files",
    ]);
  });
});
