import { useMemo, type ReactNode } from "react";
import type { Element, ElementContent, Root } from "hast";
import { lowlight, normalizeLanguage } from "../lib/highlight";

function render(nodes: ElementContent[], key = "n"): ReactNode[] {
  return nodes.map((node, i) => {
    if (node.type === "text") return node.value;
    if (node.type === "element") {
      const el = node as Element;
      const cls = el.properties?.className;
      return (
        <span key={`${key}${i}`} className={Array.isArray(cls) ? cls.join(" ") : String(cls ?? "")}>
          {render(el.children, `${key}${i}-`)}
        </span>
      );
    }
    return null;
  });
}

export function highlightToReact(code: string, language: string | null | undefined): ReactNode[] {
  const lang = normalizeLanguage(language);
  if (lang === "plaintext" || !lowlight.registered(lang)) return [code];
  const tree: Root = lowlight.highlight(lang, code);
  return render(tree.children as ElementContent[]);
}

/** Read-only highlighted code. */
export function CodeView({
  code,
  language,
  className,
  wrap = true,
}: {
  code: string;
  language?: string | null;
  className?: string;
  wrap?: boolean;
}) {
  const nodes = useMemo(() => highlightToReact(code, language), [code, language]);
  return (
    <pre
      className={`m-0 font-mono text-[12.5px] leading-[1.6] text-fg ${wrap ? "whitespace-pre-wrap break-all" : "whitespace-pre"} ${className ?? ""}`}
    >
      <code>{nodes}</code>
    </pre>
  );
}
