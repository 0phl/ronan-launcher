import { CornerDownRight, FileText, SquareCode, Terminal } from "lucide-react";
import type { EntryKind } from "../lib/search";

const META: Record<EntryKind, { icon: typeof Terminal; color: string; label: string }> = {
  ssh: { icon: Terminal, color: "var(--t-ssh)", label: "SSH" },
  snippet: { icon: SquareCode, color: "var(--t-snippet)", label: "Snippet" },
  note: { icon: FileText, color: "var(--t-note)", label: "Note" },
  block: { icon: CornerDownRight, color: "var(--t-block)", label: "Command" },
};

export function kindLabel(kind: EntryKind) {
  return META[kind].label;
}

/** Rounded, softly tinted icon tile (like macOS settings icons, but quieter). */
export function TypeIcon({ kind, size = 26 }: { kind: EntryKind; size?: number }) {
  const { icon: Icon, color } = META[kind];
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-[7px]"
      style={{
        width: size,
        height: size,
        color,
        background: `color-mix(in srgb, ${color} 16%, transparent)`,
      }}
    >
      <Icon size={Math.round(size * 0.56)} strokeWidth={2} />
    </span>
  );
}
