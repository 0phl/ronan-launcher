import { useState, type KeyboardEvent, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { Check, Copy, SquareTerminal, X } from "lucide-react";
import { api, errorText } from "../lib/api";
import { IconButton, cx } from "../components/ui";

/** Copy + ">_ paste into the last window" buttons for a piece of code. */
export function CodeActions({ text, itemId, size = 15 }: { text: string; itemId: string | null; size?: number }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await api.paste(text, itemId, true);
      setCopied(true);
      setTimeout(() => setCopied(false), 1300);
    } catch (e) {
      toast.error(errorText(e));
    }
  };

  const paste = async () => {
    try {
      const outcome = await api.paste(text, itemId, false);
      if (outcome === "copiedNoTarget") toast("No window to paste into yet, so it was copied instead.");
      if (outcome === "copied") toast.success("Copied to clipboard");
    } catch (e) {
      toast.error(errorText(e));
    }
  };

  return (
    <span className="flex items-center gap-0.5">
      <IconButton label={copied ? "Copied" : "Copy"} onClick={copy} disabled={!text.trim()}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={copied ? "y" : "n"}
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.6, opacity: 0 }}
            transition={{ duration: 0.12 }}
            className={cx("flex", copied && "text-[#34c759]")}
          >
            {copied ? <Check size={size} strokeWidth={2.4} /> : <Copy size={size} />}
          </motion.span>
        </AnimatePresence>
      </IconButton>
      <IconButton label="Paste into last window" onClick={paste} disabled={!text.trim()}>
        <SquareTerminal size={size + 1} />
      </IconButton>
    </span>
  );
}

/** Chip-style tag editor. */
export function TagInput({ tags, onChange }: { tags: string[]; onChange: (t: string[]) => void }) {
  const [text, setText] = useState("");
  const add = (raw: string) => {
    const t = raw.trim().replace(/^#/, "").toLowerCase();
    if (t && !tags.includes(t)) onChange([...tags, t]);
    setText("");
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === "," || e.key === " ") {
      e.preventDefault();
      add(text);
    } else if (e.key === "Backspace" && !text && tags.length) {
      onChange(tags.slice(0, -1));
    }
  };
  return (
    <div className="flex min-h-[34px] flex-wrap items-center gap-1.5 rounded-xl border border-line bg-surface px-2 py-1.5">
      <AnimatePresence initial={false}>
        {tags.map((t) => (
          <motion.span
            key={t}
            layout
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            className="flex items-center gap-1 rounded-full bg-accent-soft py-0.5 pl-2 pr-1 text-[11.5px] font-medium text-accent"
          >
            #{t}
            <button onClick={() => onChange(tags.filter((x) => x !== t))} className="rounded-full p-0.5 hover:bg-accent-soft">
              <X size={10} />
            </button>
          </motion.span>
        ))}
      </AnimatePresence>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => text && add(text)}
        placeholder={tags.length ? "" : "Add tags (prod, client-x…)"}
        className="min-w-[90px] flex-1 bg-transparent text-[12.5px] outline-none placeholder:text-faint"
      />
    </div>
  );
}

export function SectionLabel({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-2 mt-7 flex items-center justify-between">
      <h3 className="text-[11.5px] font-semibold uppercase tracking-wide text-muted">{children}</h3>
      {right}
    </div>
  );
}

/** Large borderless title field used at the top of every editor. */
export function TitleInput({
  value,
  onChange,
  placeholder,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  autoFocus?: boolean;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoFocus={autoFocus}
      onFocus={(e) => autoFocus && e.currentTarget.select()}
      spellCheck={false}
      className="w-full bg-transparent text-[26px] font-semibold tracking-[-0.02em] text-fg outline-none placeholder:text-faint"
    />
  );
}

export function relativeDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const days = Math.floor((now.setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86_400_000);
  if (days <= 0) return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (days === 1) return "Yesterday";
  if (days < 7) return d.toLocaleDateString([], { weekday: "long" });
  return d.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
}
