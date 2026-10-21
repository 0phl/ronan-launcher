import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight, KeyRound, Search, Star } from "lucide-react";
import { api } from "../lib/api";
import { useLibrary, useSettings, useTauriEvent } from "../lib/hooks";
import { blocksOf, buildEntries, createIndex, search, type Entry } from "../lib/search";
import { parseBlocks } from "../lib/markdown";
import { languageLabel } from "../lib/highlight";
import { CodeView } from "../components/CodeView";
import { TypeIcon, kindLabel } from "../components/TypeIcon";
import { Kbd, cx } from "../components/ui";

export function Popup() {
  const { items, folders, loaded, reload } = useLibrary();
  useSettings(); // applies theme
  const [query, setQuery] = useState("");
  const [sel, setSel] = useState(0);
  const [drill, setDrill] = useState<Entry | null>(null);
  const [showKey, setShowKey] = useState(0);
  const [closing, setClosing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const entries = useMemo(() => buildEntries(items, folders), [items, folders]);
  const index = useMemo(() => createIndex(entries), [entries]);

  const results = useMemo(() => {
    if (drill) {
      const blocks = blocksOf(entries, drill.item.id);
      const q = query.trim().toLowerCase();
      return q ? blocks.filter((b) => `${b.heading} ${b.text}`.toLowerCase().includes(q)) : blocks;
    }
    return search(index, entries, query);
  }, [drill, entries, index, query]);

  const current = results[Math.min(sel, results.length - 1)] as Entry | undefined;

  useEffect(() => setSel(0), [query, drill]);

  // keep the selected row visible
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${sel}"]`)?.scrollIntoView({ block: "nearest" });
  }, [sel]);

  const close = useCallback(() => {
    setClosing(true);
    setTimeout(() => {
      api.hidePopup();
    }, 110);
  }, []);

  useTauriEvent("popup:show", () => {
    setClosing(false);
    setQuery("");
    setDrill(null);
    setSel(0);
    setShowKey((k) => k + 1);
    reload();
    requestAnimationFrame(() => inputRef.current?.focus());
  });
  useTauriEvent("popup:close", () => close());

  const enterNote = (e: Entry) => {
    if (blocksOf(entries, e.item.id).length === 0) {
      api.showManager(`item:${e.item.id}`);
      return;
    }
    setDrill(e);
    setQuery("");
  };

  const activate = (e: Entry | undefined, copyOnly: boolean) => {
    if (!e) return;
    if (e.kind === "note") return enterNote(e);
    if (!e.text.trim()) {
      api.showManager(`item:${e.item.id}`);
      return;
    }
    setClosing(true);
    api.paste(e.text, e.item.id, copyOnly).catch(() => setClosing(false));
  };

  const onKeyDown = (ev: React.KeyboardEvent) => {
    const ctrl = ev.ctrlKey || ev.metaKey;
    switch (true) {
      case ev.key === "ArrowDown":
        ev.preventDefault();
        setSel((s) => (results.length ? (s + 1) % results.length : 0));
        break;
      case ev.key === "ArrowUp":
        ev.preventDefault();
        setSel((s) => (results.length ? (s - 1 + results.length) % results.length : 0));
        break;
      case ev.key === "Enter":
        ev.preventDefault();
        activate(current, ev.shiftKey);
        break;
      case (ev.key === "ArrowRight" && inputRef.current?.selectionStart === query.length) || ev.key === "Tab":
        if (current?.kind === "note") {
          ev.preventDefault();
          enterNote(current);
        } else if (ev.key === "Tab") ev.preventDefault();
        break;
      case ev.key === "ArrowLeft" && !!drill && inputRef.current?.selectionStart === 0:
      case ev.key === "Backspace" && !!drill && query === "":
        ev.preventDefault();
        setDrill(null);
        break;
      case ev.key === "Escape":
        ev.preventDefault();
        if (drill) setDrill(null);
        else if (query) setQuery("");
        else close();
        break;
      case ctrl && ev.key.toLowerCase() === "p":
        ev.preventDefault();
        if (current?.item.hasSecret) {
          api.copySecret(current.item.id).then(close);
        }
        break;
      case ctrl && ev.key.toLowerCase() === "e":
        ev.preventDefault();
        if (current) api.showManager(`item:${current.item.id}`);
        break;
      case ctrl && ev.key.toLowerCase() === "n":
        ev.preventDefault();
        api.showManager("new:ssh");
        break;
      case ctrl && ev.key === ",":
        ev.preventDefault();
        api.showManager("settings");
        break;
    }
  };

  return (
    <motion.div
      key={showKey}
      className="flex h-screen w-screen flex-col bg-popup text-fg"
      initial={{ opacity: 0, scale: 0.985, y: -6 }}
      animate={closing ? { opacity: 0, scale: 0.99, y: -4 } : { opacity: 1, scale: 1, y: 0 }}
      transition={closing ? { duration: 0.1, ease: "easeIn" } : { type: "spring", stiffness: 520, damping: 36, mass: 0.7 }}
      onKeyDown={onKeyDown}
      onMouseDown={(e) => {
        if (e.target !== inputRef.current) e.preventDefault(); // keep focus in the search field
      }}
    >
      {/* search bar */}
      <div className="flex h-[58px] shrink-0 items-center gap-3 px-4">
        <AnimatePresence mode="popLayout" initial={false}>
          {drill ? (
            <motion.button
              key="back"
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -6 }}
              onClick={() => setDrill(null)}
              className="flex max-w-[40%] items-center gap-1 rounded-md bg-accent-soft py-1 pl-1 pr-2 text-[12.5px] font-medium text-accent"
            >
              <ChevronLeft size={15} />
              <span className="truncate">{drill.title}</span>
            </motion.button>
          ) : (
            <motion.span key="search" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Search size={19} className="text-muted" />
            </motion.span>
          )}
        </AnimatePresence>
        <input
          ref={inputRef}
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          spellCheck={false}
          placeholder={drill ? "Filter commands in this note…" : "Search servers, snippets and notes…"}
          className="h-full min-w-0 flex-1 bg-transparent text-[19px] font-[450] tracking-[-0.01em] outline-none placeholder:text-faint"
        />
      </div>
      <div className="h-px shrink-0 bg-[var(--border)]" />

      <div className="flex min-h-0 flex-1">
        {/* results */}
        <div ref={listRef} className="w-[44%] shrink-0 overflow-y-auto p-1.5">
          {results.map((e, i) => (
            <ResultRow
              key={e.key}
              entry={e}
              index={i}
              selected={i === sel}
              onHover={() => setSel(i)}
              onClick={() => activate(e, false)}
            />
          ))}
          {loaded && results.length === 0 && <Empty hasItems={items.length > 0} query={query} />}
        </div>

        {/* preview */}
        <div className="min-w-0 flex-1 overflow-y-auto border-l border-line">
          <AnimatePresence mode="wait" initial={false}>
            {current && (
              <motion.div
                key={current.key}
                initial={{ opacity: 0, y: 3 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12 }}
                className="p-5"
              >
                <Preview entry={current} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <Footer entry={current} drilled={!!drill} />
    </motion.div>
  );
}

function ResultRow({
  entry,
  index,
  selected,
  onHover,
  onClick,
}: {
  entry: Entry;
  index: number;
  selected: boolean;
  onHover: () => void;
  onClick: () => void;
}) {
  const mono = entry.kind === "block";
  return (
    <div
      data-index={index}
      onMouseMove={onHover}
      onClick={onClick}
      className="relative flex h-[46px] cursor-default items-center gap-2.5 rounded-lg px-2.5"
    >
      {selected && (
        <motion.div
          layoutId="popup-selection"
          className="absolute inset-0 rounded-lg bg-accent-soft"
          transition={{ type: "spring", stiffness: 700, damping: 45 }}
        />
      )}
      <span className="relative">
        <TypeIcon kind={entry.kind} />
      </span>
      <div className="relative min-w-0 flex-1">
        <div className={cx("truncate text-[13px] font-medium", mono && "font-mono text-[12px]")}>{entry.title}</div>
        {entry.subtitle && <div className="truncate text-[11.5px] text-muted">{entry.subtitle}</div>}
      </div>
      <span className="relative flex items-center gap-1">
        {entry.item.favorite && entry.kind !== "block" && <Star size={12} className="fill-current text-[#ffcc00]" />}
        {entry.kind === "note" && <ChevronRight size={14} className="text-faint" />}
        {selected && entry.kind !== "note" && <Kbd>↵</Kbd>}
      </span>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-faint">{children}</div>;
}

function CodeCard({ code, language }: { code: string; language?: string | null }) {
  return (
    <div className="rounded-xl border border-line bg-code px-3.5 py-3">
      <CodeView code={code} language={language} />
      <div className="mt-2 text-[10.5px] text-faint">{languageLabel(language)}</div>
    </div>
  );
}

function Preview({ entry }: { entry: Entry }) {
  const { item } = entry;
  const header = (
    <div className="mb-4 flex items-start gap-3">
      <TypeIcon kind={entry.kind} size={34} />
      <div className="min-w-0">
        <div className="text-[16px] font-semibold leading-tight tracking-[-0.01em]">
          {entry.kind === "block" ? item.title || "Untitled note" : entry.title}
        </div>
        <div className="mt-0.5 text-[12px] text-muted">
          {entry.kind === "block" ? entry.block?.heading ?? kindLabel("block") : kindLabel(entry.kind)}
          {entry.folder && ` · ${entry.folder}`}
        </div>
      </div>
    </div>
  );

  if (entry.kind === "note") {
    const blocks = parseBlocks(item.content).slice(0, 14);
    return (
      <div>
        {header}
        <div className="space-y-2.5">
          {blocks.map((b, i) =>
            b.type === "heading" ? (
              <div key={i} className="pt-1 text-[13.5px] font-semibold">
                {b.text}
              </div>
            ) : b.type === "code" ? (
              <CodeCard key={i} code={b.code} language={b.lang} />
            ) : (
              <p key={i} className="line-clamp-3 text-[12.5px] text-muted">
                {b.text}
              </p>
            ),
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      {header}
      {entry.kind === "ssh" && (item.sshHost || item.sshUser) && (
        <div className="mb-4 grid grid-cols-[72px_1fr] gap-y-1 text-[12.5px]">
          {item.sshHost && (
            <>
              <span className="text-muted">Host</span>
              <span className="font-mono text-[12px]">{item.sshHost}</span>
            </>
          )}
          {item.sshUser && (
            <>
              <span className="text-muted">User</span>
              <span className="font-mono text-[12px]">{item.sshUser}</span>
            </>
          )}
          {item.sshPort && item.sshPort !== 22 && (
            <>
              <span className="text-muted">Port</span>
              <span className="font-mono text-[12px]">{item.sshPort}</span>
            </>
          )}
          {item.hasSecret && (
            <>
              <span className="text-muted">Password</span>
              <span className="flex items-center gap-1.5 text-muted">
                <KeyRound size={12} /> ••••••••
                <span className="text-[11px] text-faint">Ctrl+P to copy</span>
              </span>
            </>
          )}
        </div>
      )}
      <Label>{entry.kind === "ssh" ? "Command" : "Pastes"}</Label>
      <CodeCard code={entry.text || " "} language={entry.kind === "block" ? entry.block?.lang : item.language} />
      {entry.kind !== "block" && item.notes.trim() && (
        <div className="mt-4">
          <Label>Notes</Label>
          <p className="whitespace-pre-wrap text-[12.5px] leading-relaxed text-muted">{item.notes}</p>
        </div>
      )}
      {item.tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {item.tags.map((t) => (
            <span key={t} className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-muted">
              #{t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function Empty({ hasItems, query }: { hasItems: boolean; query: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <div className="text-[13px] font-medium">{hasItems ? `No results for “${query}”` : "Your library is empty"}</div>
      <div className="mt-1 text-[12px] text-muted">
        Press <Kbd>Ctrl</Kbd> <Kbd>N</Kbd> to add {hasItems ? "it" : "your first server"}
      </div>
    </div>
  );
}

function Hint({ keys, label }: { keys: string[]; label: string }) {
  return (
    <span className="flex items-center gap-1">
      {keys.map((k) => (
        <Kbd key={k}>{k}</Kbd>
      ))}
      <span className="ml-0.5">{label}</span>
    </span>
  );
}

function Footer({ entry, drilled }: { entry?: Entry; drilled: boolean }) {
  return (
    <div className="flex h-9 shrink-0 items-center gap-4 border-t border-line px-3.5 text-[11.5px] text-muted">
      {entry?.kind === "note" ? (
        <Hint keys={["↵"]} label="Open commands" />
      ) : (
        <>
          <Hint keys={["↵"]} label="Paste" />
          <Hint keys={["⇧", "↵"]} label="Copy" />
        </>
      )}
      {entry?.item.hasSecret && entry.kind === "ssh" && <Hint keys={["Ctrl", "P"]} label="Password" />}
      {drilled && <Hint keys={["←"]} label="Back" />}
      <span className="flex-1" />
      <Hint keys={["Ctrl", "E"]} label="Edit" />
      <Hint keys={["Esc"]} label="Close" />
    </div>
  );
}
