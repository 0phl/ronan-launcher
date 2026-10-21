import { useEffect, useState } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { Download, Upload } from "lucide-react";
import { toast } from "sonner";
import { api, errorText } from "../lib/api";
import { shortcutFromEvent, shortcutParts } from "../lib/hotkey";
import type { Settings, SettingsView } from "../types";
import { Button, Group, Input, Kbd, Modal, Row, Segmented, Switch, cx } from "../components/ui";

export function SettingsDialog({
  open: isOpen,
  onOpenChange,
  view,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  view: SettingsView | null;
}) {
  const [dialog, setDialog] = useState<"export" | "import" | null>(null);
  if (!view) return null;
  const s = view.settings;

  const change = (patch: Partial<Settings>) =>
    api.saveSettings({ ...s, ...patch }).catch((e) => toast.error(errorText(e)));

  return (
    <>
      <Modal open={isOpen} onOpenChange={onOpenChange} title="Settings" width={560}>
        <Group title="Appearance">
          <Row label="Theme">
            <Segmented
              layoutId="theme-seg"
              value={s.theme}
              onChange={(theme) => change({ theme })}
              options={[
                { value: "system", label: "System" },
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
              ]}
            />
          </Row>
        </Group>

        <Group
          title="Launcher"
          footer={
            view.hotkeyError ? (
              <span className="text-danger">{view.hotkeyError}</span>
            ) : (
              "Press the shortcut anywhere in Windows to open the launcher."
            )
          }
        >
          <Row label="Keyboard shortcut">
            <HotkeyRecorder value={s.hotkey} onChange={(hotkey) => change({ hotkey })} />
          </Row>
          <Row label="Start with Windows" hint="Runs quietly in the tray">
            <Switch checked={s.autostart} onChange={(autostart) => change({ autostart })} />
          </Row>
        </Group>

        <Group
          title="Pasting"
          footer="Ronan Launcher never presses Enter for you. Use Shift+Insert for PuTTY and some older terminals."
        >
          <Row label="When you pick an item">
            <Segmented
              layoutId="paste-mode-seg"
              value={s.pasteMode}
              onChange={(pasteMode) => change({ pasteMode })}
              options={[
                { value: "auto", label: "Paste into window" },
                { value: "copy", label: "Copy only" },
              ]}
            />
          </Row>
          <Row label="Paste keystroke">
            <Segmented
              layoutId="paste-key-seg"
              value={s.pasteKey}
              onChange={(pasteKey) => change({ pasteKey })}
              options={[
                { value: "ctrl+v", label: "Ctrl+V" },
                { value: "shift+insert", label: "Shift+Insert" },
              ]}
            />
          </Row>
          <Row label="Restore clipboard after pasting" hint="Puts back what you had copied before">
            <Switch checked={s.restoreClipboard} onChange={(restoreClipboard) => change({ restoreClipboard })} />
          </Row>
        </Group>

        <Group
          title="Your data"
          footer={
            <>
              Stored only on this PC in <span className="select-text font-mono text-[11px]">{view.dataDir}</span>.
              Passwords are encrypted with your Windows account.
            </>
          }
        >
          <Row label="Export library" hint="Password-protected .ronan file for another PC">
            <Button size="sm" onClick={() => setDialog("export")}>
              <Upload size={13} /> Export…
            </Button>
          </Row>
          <Row label="Import library" hint="From a .ronan export file">
            <Button size="sm" onClick={() => setDialog("import")}>
              <Download size={13} /> Import…
            </Button>
          </Row>
        </Group>
      </Modal>

      <ExportDialog open={dialog === "export"} onOpenChange={(o) => !o && setDialog(null)} />
      <ImportDialog open={dialog === "import"} onOpenChange={(o) => !o && setDialog(null)} />
    </>
  );
}

function HotkeyRecorder({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [recording, setRecording] = useState(false);

  useEffect(() => {
    if (!recording) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") return setRecording(false);
      const sc = shortcutFromEvent(e);
      if (sc) {
        setRecording(false);
        if (sc !== value) onChange(sc);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [recording, value, onChange]);

  return (
    <button
      onClick={() => setRecording((r) => !r)}
      className={cx(
        "flex h-8 min-w-[150px] items-center justify-center gap-1 rounded-lg border px-2.5 transition-all",
        recording
          ? "border-accent bg-accent-soft text-accent shadow-[0_0_0_3px_var(--accent-soft)]"
          : "border-line bg-bg hover:bg-surface-2",
      )}
    >
      {recording ? (
        <span className="animate-pulse text-[12px] font-medium">Press new shortcut…</span>
      ) : (
        shortcutParts(value).map((p) => <Kbd key={p}>{p}</Kbd>)
      )}
    </button>
  );
}

function ExportDialog({ open: isOpen, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (isOpen) {
      setPw("");
      setPw2("");
    }
  }, [isOpen]);

  const mismatch = pw2.length > 0 && pw !== pw2;
  const valid = pw.length >= 4 && pw === pw2;

  const run = async () => {
    const date = new Date().toISOString().slice(0, 10);
    const path = await save({
      title: "Export library",
      defaultPath: `ronan-launcher-${date}.ronan`,
      filters: [{ name: "Ronan Launcher export", extensions: ["ronan"] }],
    });
    if (!path) return;
    setBusy(true);
    try {
      const n = await api.exportData(path, pw);
      toast.success(`Exported ${n} item${n === 1 ? "" : "s"}`, { description: path });
      onOpenChange(false);
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={isOpen} onOpenChange={onOpenChange} title="Export Library" width={420}>
      <p className="mb-4 text-[12.5px] text-muted">
        Choose a password for the export file. You'll need it to import the file on your other PC. There's no
        way to recover it if you forget it.
      </p>
      <label className="mb-1.5 block text-[12px] text-muted">Password</label>
      <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />
      <label className="mb-1.5 mt-3 block text-[12px] text-muted">Confirm password</label>
      <Input
        type="password"
        value={pw2}
        onChange={(e) => setPw2(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && valid && run()}
        className={mismatch ? "!border-danger" : ""}
      />
      <div className="mt-1.5 h-4 text-[11.5px] text-danger">
        {mismatch ? "Passwords don't match" : pw && pw.length < 4 ? "At least 4 characters" : ""}
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Button onClick={() => onOpenChange(false)}>Cancel</Button>
        <Button variant="primary" disabled={!valid || busy} onClick={run}>
          {busy ? "Exporting…" : "Choose Location…"}
        </Button>
      </div>
    </Modal>
  );
}

function ImportDialog({ open: isOpen, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [path, setPath] = useState<string | null>(null);
  const [pw, setPw] = useState("");
  const [mode, setMode] = useState<"merge" | "replace">("merge");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (isOpen) {
      setPath(null);
      setPw("");
      setMode("merge");
    }
  }, [isOpen]);

  const pick = async () => {
    const p = await open({
      title: "Import library",
      multiple: false,
      directory: false,
      filters: [{ name: "Ronan Launcher export", extensions: ["ronan"] }],
    });
    if (typeof p === "string") setPath(p);
  };

  const run = async () => {
    if (!path) return;
    setBusy(true);
    try {
      const r = await api.importData(path, pw, mode === "replace");
      toast.success("Import complete", {
        description: `${r.added} new, ${r.updated} updated, ${r.skipped} unchanged${r.backup ? ". A backup of your old library was saved." : ""}`,
      });
      onOpenChange(false);
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={isOpen} onOpenChange={onOpenChange} title="Import Library" width={440}>
      <label className="mb-1.5 block text-[12px] text-muted">Export file</label>
      <div className="flex gap-2">
        <div className="flex h-8 min-w-0 flex-1 items-center truncate rounded-lg border border-line bg-surface px-2.5 font-mono text-[11.5px] text-muted">
          {path ?? "No file chosen"}
        </div>
        <Button onClick={pick}>Choose…</Button>
      </div>

      <label className="mb-1.5 mt-4 block text-[12px] text-muted">Password</label>
      <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} />

      <label className="mb-1.5 mt-4 block text-[12px] text-muted">How to import</label>
      <Segmented
        layoutId="import-mode"
        value={mode}
        onChange={setMode}
        options={[
          { value: "merge", label: "Merge" },
          { value: "replace", label: "Replace everything" },
        ]}
      />
      <p className={cx("mt-2 text-[12px]", mode === "replace" ? "text-danger" : "text-muted")}>
        {mode === "merge"
          ? "Adds new items and updates ones that changed. Newer edits win, and nothing is deleted."
          : "Deletes your current library and replaces it with the file's contents. A backup is saved first."}
      </p>

      <div className="mt-5 flex justify-end gap-2">
        <Button onClick={() => onOpenChange(false)}>Cancel</Button>
        <Button variant={mode === "replace" ? "danger" : "primary"} disabled={!path || !pw || busy} onClick={run}>
          {busy ? "Importing…" : mode === "replace" ? "Replace Library" : "Import"}
        </Button>
      </div>
    </Modal>
  );
}
