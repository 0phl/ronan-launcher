import { describe, expect, it } from "vitest";
import { extractCodeBlocks, parseBlocks, shortenCommand } from "./markdown";

describe("shortenCommand", () => {
  it("keeps the command and the distinguishing end of the path", () => {
    const cache = shortenCommand("rm -rf /data/content/lms/moodledata/cache/*");
    expect(cache).toMatch(/^rm -rf …\/.*moodledata\/cache\/\*$/);
    expect(cache.length).toBeLessThanOrEqual(34);
    expect(shortenCommand("rm -rf /data/content/lms/moodledata/data/trashdir/*")).toBe("rm -rf …/data/trashdir/*");
  });

  it("leaves short commands alone and never exceeds the limit", () => {
    expect(shortenCommand("df -h")).toBe("df -h");
    const long = "grep 'dataroot' /data/content/lms/moodle/config.php";
    expect(shortenCommand(long).length).toBeLessThanOrEqual(34);
    expect(shortenCommand(long).startsWith("grep 'dataroot' …")).toBe(true);
  });
});

const NOTE = `## Check your moodledata location

\`\`\`shell
grep 'dataroot' /data/content/lms/moodle/config.php
\`\`\`

## Clean temp files from that path

\`\`\`shell
rm -rf /data/content/lms/moodledata/temp/*
\`\`\`

\`\`\`
rm -rf /data/content/lms/moodledata/cache/*
\`\`\`

Some text after.
`;

describe("extractCodeBlocks", () => {
  it("returns each block with the heading above it", () => {
    const blocks = extractCodeBlocks(NOTE);
    expect(blocks).toHaveLength(3);
    expect(blocks[0]).toMatchObject({
      index: 0,
      lang: "shell",
      heading: "Check your moodledata location",
      code: "grep 'dataroot' /data/content/lms/moodle/config.php",
    });
    expect(blocks[1].heading).toBe("Clean temp files from that path");
    expect(blocks[2]).toMatchObject({ lang: null, heading: "Clean temp files from that path" });
  });

  it("keeps multi-line scripts intact and skips empty blocks", () => {
    const md = "```bash\napt update\napt upgrade -y\n```\n\n```\n\n```";
    expect(extractCodeBlocks(md)).toEqual([
      { index: 0, lang: "bash", code: "apt update\napt upgrade -y", heading: null },
    ]);
  });

  it("parses headings and text", () => {
    const blocks = parseBlocks(NOTE);
    expect(blocks[0]).toEqual({ type: "heading", level: 2, text: "Check your moodledata location" });
    expect(blocks.at(-1)).toEqual({ type: "text", text: "Some text after." });
  });
});
