import { useEffect } from "react";
import { EditorContent, ReactNodeViewRenderer, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import Placeholder from "@tiptap/extension-placeholder";
import { Markdown } from "@tiptap/markdown";
import { Code, Heading2, Heading3, List, ListOrdered, SquareTerminal, Type } from "lucide-react";
import { lowlight } from "../lib/highlight";
import type { Item, ItemInput } from "../types";
import { IconButton } from "../components/ui";
import { CodeBlockView, NoteContext } from "./CodeBlockView";
import { TitleInput } from "./parts";
import type { Update } from "./ItemDetail";

const CodeBlock = CodeBlockLowlight.extend({
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockView);
  },
}).configure({ lowlight, defaultLanguage: "shell" });

export function NoteEditor({
  item,
  draft,
  update,
  editing,
  autoFocus,
}: {
  item: Item;
  draft: ItemInput;
  update: Update;
  editing: boolean;
  autoFocus: boolean;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false, link: { openOnClick: false } }),
      CodeBlock,
      Placeholder.configure({ placeholder: "Write something… type ``` for a command block, # for a heading" }),
      Markdown,
    ],
    content: draft.content,
    contentType: "markdown",
    editable: editing,
    editorProps: { attributes: { spellcheck: "false" } },
    onUpdate: ({ editor }) => update({ content: editor.getMarkdown() }),
  });

  useEffect(() => {
    editor?.setEditable(editing);
  }, [editor, editing]);

  const active = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e
        ? {
            h2: e.isActive("heading", { level: 2 }),
            h3: e.isActive("heading", { level: 3 }),
            bullet: e.isActive("bulletList"),
            ordered: e.isActive("orderedList"),
            code: e.isActive("code"),
            block: e.isActive("codeBlock"),
          }
        : null,
  });

  const isEmpty = !draft.content.trim();

  return (
    <NoteContext.Provider value={{ itemId: item.id, editing }}>
      {editing ? (
        <TitleInput
          value={draft.title}
          onChange={(title) => update({ title })}
          placeholder="Note title (e.g. Clear moodle temp/cache files)"
          autoFocus={autoFocus}
        />
      ) : (
        <h1 className="text-[26px] font-semibold tracking-[-0.02em]">{draft.title || "Untitled note"}</h1>
      )}

      {editing && editor && (
        <div className="sticky top-0 z-10 -mx-2 mb-2 mt-3 flex items-center gap-0.5 rounded-xl border border-line bg-bg/85 px-1.5 py-1 backdrop-blur-xl">
          <IconButton label="Text" onClick={() => editor.chain().focus().setParagraph().run()}>
            <Type size={15} />
          </IconButton>
          <IconButton label="Heading" active={active?.h2} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
            <Heading2 size={15} />
          </IconButton>
          <IconButton label="Subheading" active={active?.h3} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
            <Heading3 size={15} />
          </IconButton>
          <span className="mx-1 h-4 w-px bg-[var(--border-strong)]" />
          <IconButton label="Bulleted list" active={active?.bullet} onClick={() => editor.chain().focus().toggleBulletList().run()}>
            <List size={15} />
          </IconButton>
          <IconButton label="Numbered list" active={active?.ordered} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
            <ListOrdered size={15} />
          </IconButton>
          <IconButton label="Inline code" active={active?.code} onClick={() => editor.chain().focus().toggleCode().run()}>
            <Code size={15} />
          </IconButton>
          <span className="mx-1 h-4 w-px bg-[var(--border-strong)]" />
          <button
            onClick={() => editor.chain().focus().toggleCodeBlock({ language: "shell" }).run()}
            className={`flex h-7 items-center gap-1.5 rounded-md px-2 text-[12px] font-medium transition-colors hover:bg-surface-2 ${active?.block ? "text-accent" : "text-muted hover:text-fg"}`}
          >
            <SquareTerminal size={14} /> Command block
          </button>
        </div>
      )}

      {!editing && isEmpty ? (
        <p className="mt-6 text-[13px] text-muted">
          This note is empty. Switch to <span className="text-accent">Editing</span> (Ctrl+E) to write your runbook.
        </p>
      ) : (
        <EditorContent editor={editor} className="note-prose mt-5" />
      )}
    </NoteContext.Provider>
  );
}
