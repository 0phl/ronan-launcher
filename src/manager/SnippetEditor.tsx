import { ChevronDown } from "lucide-react";
import { LANGUAGES, languageLabel, normalizeLanguage } from "../lib/highlight";
import type { Item, ItemInput } from "../types";
import { AutoTextarea } from "../components/ui";
import { CodeEditor } from "../components/CodeEditor";
import { TypeIcon } from "../components/TypeIcon";
import { CodeActions, SectionLabel, TagInput, TitleInput } from "./parts";
import type { Update } from "./ItemDetail";

export function LanguageSelect({ value, onChange }: { value: string | null; onChange: (v: string) => void }) {
  return (
    <label className="relative inline-flex items-center">
      <select
        value={normalizeLanguage(value)}
        onChange={(e) => onChange(e.target.value)}
        className="h-6 appearance-none rounded-md bg-transparent pl-1.5 pr-5 text-[11px] text-muted outline-none hover:bg-surface-2 hover:text-fg"
        aria-label="Language"
      >
        {LANGUAGES.map((l) => (
          <option key={l.id} value={l.id}>
            {l.label}
          </option>
        ))}
      </select>
      <ChevronDown size={11} className="pointer-events-none absolute right-1.5 text-faint" />
    </label>
  );
}

export function SnippetEditor({
  item,
  draft,
  update,
  autoFocus,
}: {
  item: Item;
  draft: ItemInput;
  update: Update;
  autoFocus: boolean;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-2 text-[12px] text-muted">
        <TypeIcon kind="snippet" size={20} /> Snippet · {languageLabel(draft.language)}
      </div>
      <TitleInput
        value={draft.title}
        onChange={(title) => update({ title })}
        placeholder="Snippet name (e.g. Restart nginx)"
        autoFocus={autoFocus}
      />

      <SectionLabel>Command or script</SectionLabel>
      <div className="overflow-hidden rounded-xl border border-line bg-code">
        <CodeEditor
          value={draft.content}
          onChange={(content) => update({ content })}
          language={draft.language}
          placeholder="sudo systemctl restart nginx"
          minRows={4}
        />
        <div className="flex items-center justify-between border-t border-line py-1 pl-2 pr-1.5">
          <LanguageSelect value={draft.language} onChange={(language) => update({ language })} />
          <CodeActions text={draft.content} itemId={item.id} />
        </div>
      </div>
      <p className="mt-1.5 text-[11.5px] text-faint">
        Pasting never presses Enter, so you can always review a command before running it.
      </p>

      <SectionLabel>Tags</SectionLabel>
      <TagInput tags={draft.tags} onChange={(tags) => update({ tags })} />

      <SectionLabel>Notes</SectionLabel>
      <div className="rounded-xl border border-line bg-surface px-3.5 py-3">
        <AutoTextarea
          value={draft.notes}
          onChange={(e) => update({ notes: e.target.value })}
          placeholder="When to use it, what it does, gotchas…"
          className="min-h-[60px] text-[13px] leading-relaxed"
        />
      </div>
    </div>
  );
}
