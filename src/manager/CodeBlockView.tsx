import { createContext, useContext } from "react";
import { NodeViewContent, NodeViewWrapper, type ReactNodeViewProps } from "@tiptap/react";
import { languageLabel } from "../lib/highlight";
import { CodeActions } from "./parts";
import { LanguageSelect } from "./SnippetEditor";

export const NoteContext = createContext<{ itemId: string | null; editing: boolean }>({
  itemId: null,
  editing: false,
});

/** A note's code block, rendered as a card with Copy and ">_ Paste" (like a Warp runbook). */
export function CodeBlockView({ node, updateAttributes }: ReactNodeViewProps) {
  const { itemId, editing } = useContext(NoteContext);
  const language = (node.attrs.language as string | null) ?? "shell";

  return (
    <NodeViewWrapper className="my-3.5 overflow-hidden rounded-xl border border-line bg-code shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <pre className="m-0 whitespace-pre-wrap break-all px-4 pb-1 pt-3.5 font-mono text-[12.5px] leading-[1.65] text-fg">
        <NodeViewContent<"code"> as="code" />
      </pre>
      <div contentEditable={false} className="flex items-center justify-between py-1 pl-2.5 pr-1.5">
        {editing ? (
          <LanguageSelect value={language} onChange={(l) => updateAttributes({ language: l })} />
        ) : (
          <span className="pl-1.5 text-[11px] text-faint">{languageLabel(language)}</span>
        )}
        <CodeActions text={node.textContent} itemId={itemId} size={14} />
      </div>
    </NodeViewWrapper>
  );
}
