import { useState, type ReactNode } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { Copy, Eye, EyeOff, FolderOpen, X } from "lucide-react";
import { toast } from "sonner";
import { api, errorText } from "../lib/api";
import { buildSshCommand } from "../lib/ssh";
import type { Item, ItemInput } from "../types";
import { AutoTextarea, IconButton } from "../components/ui";
import { CodeView } from "../components/CodeView";
import { CodeEditor } from "../components/CodeEditor";
import { TypeIcon } from "../components/TypeIcon";
import { CodeActions, SectionLabel, TagInput, TitleInput } from "./parts";
import type { Update } from "./ItemDetail";

function FormRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-[42px] items-center gap-3 px-3.5">
      <span className="w-[100px] shrink-0 text-[12.5px] text-muted">{label}</span>
      <div className="flex min-w-0 flex-1 items-center gap-0.5">{children}</div>
    </div>
  );
}

const field =
  "h-[42px] min-w-0 flex-1 bg-transparent font-mono text-[12.5px] text-fg outline-none placeholder:font-sans placeholder:text-[12.5px] placeholder:text-faint";

export function SshEditor({
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
  const [custom, setCustom] = useState(() => !!draft.content && draft.content !== buildSshCommand(draft));
  const [password, setPassword] = useState<string | null>(null); // null = not loaded / untouched
  const [reveal, setReveal] = useState(false);

  const setField = (patch: Partial<ItemInput>) => {
    const next = { ...draft, ...patch };
    update(custom ? patch : { ...patch, content: buildSshCommand(next) });
  };

  const toggleReveal = async () => {
    if (!reveal && password === null && item.hasSecret) {
      setPassword((await api.getSecret(item.id)) ?? "");
    }
    setReveal((r) => !r);
  };

  const browseKey = async () => {
    const path = await open({ title: "Choose a private key file", multiple: false, directory: false });
    if (typeof path === "string") setField({ sshKeyPath: path });
  };

  return (
    <div>
      <div className="mb-1 flex items-center gap-2 text-[12px] text-muted">
        <TypeIcon kind="ssh" size={20} /> SSH server
      </div>
      <TitleInput
        value={draft.title}
        onChange={(title) => update({ title })}
        placeholder="Server name (e.g. Ronan SSH)"
        autoFocus={autoFocus}
      />

      <SectionLabel>Connection</SectionLabel>
      <div className="divide-y divide-[var(--border)] rounded-xl border border-line bg-surface">
        <FormRow label="Host">
          <input
            className={field}
            value={draft.sshHost ?? ""}
            onChange={(e) => setField({ sshHost: e.target.value || null })}
            placeholder="203.0.113.10 or server.example.com"
            spellCheck={false}
          />
        </FormRow>
        <FormRow label="User">
          <input
            className={field}
            value={draft.sshUser ?? ""}
            onChange={(e) => setField({ sshUser: e.target.value || null })}
            placeholder="root"
            spellCheck={false}
          />
        </FormRow>
        <FormRow label="Port">
          <input
            className={field}
            inputMode="numeric"
            value={draft.sshPort ?? ""}
            onChange={(e) => {
              const n = parseInt(e.target.value.replace(/\D/g, ""), 10);
              setField({ sshPort: Number.isFinite(n) ? n : null });
            }}
            placeholder="22"
          />
        </FormRow>
        <FormRow label="Identity file">
          <input
            className={field}
            value={draft.sshKeyPath ?? ""}
            onChange={(e) => setField({ sshKeyPath: e.target.value || null })}
            placeholder="Optional, e.g. ~/.ssh/id_ed25519"
            spellCheck={false}
          />
          <IconButton label="Browse…" onClick={browseKey}>
            <FolderOpen size={14} />
          </IconButton>
        </FormRow>
        <FormRow label="Password">
          <input
            className={field}
            type={reveal ? "text" : "password"}
            value={password ?? ""}
            onChange={(e) => {
              setPassword(e.target.value);
              update({ secret: e.target.value });
            }}
            placeholder={item.hasSecret ? "Saved, type to replace" : "Optional, stored encrypted"}
            autoComplete="off"
          />
          {(item.hasSecret || password) && (
            <>
              <IconButton label={reveal ? "Hide" : "Show"} onClick={toggleReveal}>
                {reveal ? <EyeOff size={14} /> : <Eye size={14} />}
              </IconButton>
              <IconButton
                label="Copy password"
                onClick={() =>
                  api
                    .copySecret(item.id)
                    .then(() => toast.success("Password copied. It clears from the clipboard in 30 s."))
                    .catch((e) => toast.error(errorText(e)))
                }
              >
                <Copy size={14} />
              </IconButton>
              <IconButton
                label="Remove password"
                onClick={() => {
                  setPassword("");
                  update({ secret: "" });
                }}
              >
                <X size={14} />
              </IconButton>
            </>
          )}
        </FormRow>
      </div>

      <SectionLabel
        right={
          <button
            onClick={() => {
              if (custom) update({ content: buildSshCommand(draft) });
              setCustom(!custom);
            }}
            className="text-[12px] text-accent hover:underline"
          >
            {custom ? "Reset to generated" : "Customize"}
          </button>
        }
      >
        Command
      </SectionLabel>
      <div className="overflow-hidden rounded-xl border border-line bg-code">
        {custom ? (
          <CodeEditor value={draft.content} onChange={(content) => update({ content })} language="shell" minRows={1} />
        ) : (
          <div className="px-3.5 py-3">
            {draft.content ? (
              <CodeView code={draft.content} language="shell" />
            ) : (
              <span className="text-[12.5px] text-faint">Fill in the host to generate the command.</span>
            )}
          </div>
        )}
        <div className="flex items-center justify-between border-t border-line py-1 pl-3.5 pr-1.5">
          <span className="text-[11px] text-faint">Shell</span>
          <CodeActions text={draft.content} itemId={item.id} />
        </div>
      </div>

      <SectionLabel>Tags</SectionLabel>
      <TagInput tags={draft.tags} onChange={(tags) => update({ tags })} />

      <SectionLabel>Notes</SectionLabel>
      <div className="rounded-xl border border-line bg-surface px-3.5 py-3">
        <AutoTextarea
          value={draft.notes}
          onChange={(e) => update({ notes: e.target.value })}
          placeholder="What runs on this server, provider, renewal date…"
          className="min-h-[60px] text-[13px] leading-relaxed"
        />
      </div>
    </div>
  );
}
