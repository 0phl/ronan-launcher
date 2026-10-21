/** Light-weight markdown block parser used for search indexing and popup previews. */

export type MdBlock =
  | { type: "heading"; level: number; text: string }
  | { type: "code"; lang: string | null; code: string; heading: string | null; index: number }
  | { type: "text"; text: string };

export interface CodeBlock {
  index: number;
  lang: string | null;
  code: string;
  /** Nearest heading above the block, if any. */
  heading: string | null;
}

const FENCE = /^(\s*)(`{3,}|~{3,})\s*([\w+#.-]*)\s*$/;

export function parseBlocks(md: string): MdBlock[] {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out: MdBlock[] = [];
  let heading: string | null = null;
  let codeIndex = 0;
  let para: string[] = [];

  const flushPara = () => {
    const text = para.join(" ").trim();
    if (text) out.push({ type: "text", text });
    para = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fence = line.match(FENCE);
    if (fence) {
      flushPara();
      const marker = fence[2];
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith(marker)) {
        body.push(lines[i]);
        i++;
      }
      out.push({ type: "code", lang: fence[3] || null, code: body.join("\n"), heading, index: codeIndex++ });
      continue;
    }
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      flushPara();
      heading = h[2].trim();
      out.push({ type: "heading", level: h[1].length, text: heading });
      continue;
    }
    if (!line.trim()) {
      flushPara();
      continue;
    }
    para.push(line.replace(/^\s*([-*+]|\d+\.)\s+/, "• "));
  }
  flushPara();
  return out;
}

export function extractCodeBlocks(md: string): CodeBlock[] {
  return parseBlocks(md)
    .filter((b): b is Extract<MdBlock, { type: "code" }> => b.type === "code")
    .filter((b) => b.code.trim().length > 0)
    .map(({ index, lang, code, heading }) => ({ index, lang, code, heading }));
}

/** Plain text (no fences/markers) for search indexing. */
export function plainText(md: string): string {
  return parseBlocks(md)
    .map((b) => (b.type === "code" ? b.code : b.text))
    .join("\n");
}
