import { useMemo } from "react";
import { highlightToReact } from "./CodeView";

/**
 * Editable highlighted code: a transparent textarea layered over a highlighted
 * <pre> with identical metrics, so typing stays native but looks highlighted.
 */
export function CodeEditor({
  value,
  onChange,
  language,
  placeholder,
  minRows = 3,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  language?: string | null;
  placeholder?: string;
  minRows?: number;
  autoFocus?: boolean;
}) {
  const nodes = useMemo(() => highlightToReact(value, language), [value, language]);
  const metrics = "font-mono text-[12.5px] leading-[1.6] p-3.5 whitespace-pre-wrap break-all";
  return (
    <div className="relative" style={{ minHeight: `calc(${minRows} * 1.6 * 12.5px + 28px)` }}>
      <pre aria-hidden className={`pointer-events-none m-0 text-fg ${metrics}`}>
        <code>{nodes}</code>
        {/* keeps the last empty line measurable */}
        {"\n"}
      </pre>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        autoFocus={autoFocus}
        placeholder={placeholder}
        onKeyDown={(e) => {
          // Tab inserts two spaces instead of leaving the field
          if (e.key === "Tab" && !e.shiftKey) {
            e.preventDefault();
            const el = e.currentTarget;
            const { selectionStart: s, selectionEnd: end } = el;
            const next = value.slice(0, s) + "  " + value.slice(end);
            onChange(next);
            requestAnimationFrame(() => el.setSelectionRange(s + 2, s + 2));
          }
        }}
        className={`absolute inset-0 h-full w-full resize-none overflow-hidden bg-transparent text-transparent caret-[var(--text)] outline-none placeholder:text-faint ${metrics}`}
      />
    </div>
  );
}
