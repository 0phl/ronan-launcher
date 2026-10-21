import * as Dialog from "@radix-ui/react-dialog";
import * as Tooltip from "@radix-ui/react-tooltip";
import { AnimatePresence, motion } from "motion/react";
import {
  forwardRef,
  useEffect,
  useLayoutEffect,
  useRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import { X } from "lucide-react";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

// ---------- buttons ----------

type Variant = "primary" | "secondary" | "ghost" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-white hover:brightness-110 active:brightness-95 shadow-sm",
  secondary:
    "bg-surface text-fg border border-line hover:bg-surface-2 active:bg-surface-2 shadow-[0_1px_1px_rgba(0,0,0,0.04)]",
  ghost: "text-fg hover:bg-surface-2",
  danger: "bg-danger text-white hover:brightness-110",
};

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md" }
>(function Button({ variant = "secondary", size = "md", className, ...props }, ref) {
  return (
    <button
      ref={ref}
      className={cx(
        "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-[background,filter,transform] duration-150 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none select-none",
        size === "sm" ? "h-7 px-2.5 text-[12px]" : "h-8 px-3.5 text-[13px]",
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
});

export const IconButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean; shortcut?: string }
>(function IconButton({ label, active, shortcut, className, children, ...props }, ref) {
  return (
    <Tip label={label} shortcut={shortcut}>
      <button
        ref={ref}
        aria-label={label}
        className={cx(
          "inline-flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg active:scale-95",
          active && "text-accent",
          className,
        )}
        {...props}
      >
        {children}
      </button>
    </Tip>
  );
});

// ---------- tooltip ----------

export function Tip({ label, shortcut, children }: { label: string; shortcut?: string; children: ReactNode }) {
  return (
    <Tooltip.Root delayDuration={450}>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side="bottom"
          sideOffset={6}
          className="z-50 flex items-center gap-2 rounded-md border border-line bg-surface px-2 py-1 text-[11.5px] text-fg shadow-[var(--shadow)] data-[state=delayed-open]:animate-[fadeIn_120ms_ease-out]"
        >
          {label}
          {shortcut && <span className="text-muted">{shortcut}</span>}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

// ---------- inputs ----------

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      spellCheck={false}
      className={cx(
        "h-8 w-full rounded-lg border border-line bg-bg px-2.5 text-[13px] text-fg placeholder:text-faint outline-none transition-[border,box-shadow] duration-150 focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-soft)]",
        className,
      )}
      {...props}
    />
  );
});

/** Textarea that grows with its content. */
export function AutoTextarea({ className, value, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      value={value}
      rows={1}
      className={cx("w-full resize-none bg-transparent outline-none placeholder:text-faint", className)}
      {...props}
    />
  );
}

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cx(
        "inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[5px] border border-line-strong bg-surface px-1 font-sans text-[10.5px] font-medium text-muted shadow-[0_1px_0_var(--border)]",
        className,
      )}
    >
      {children}
    </kbd>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  layoutId,
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
  layoutId: string;
}) {
  return (
    <div className="inline-flex rounded-lg bg-surface-2 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            "relative h-6 rounded-md px-3 text-[12px] font-medium transition-colors",
            value === o.value ? "text-fg" : "text-muted hover:text-fg",
          )}
        >
          {value === o.value && (
            <motion.span
              layoutId={layoutId}
              className="absolute inset-0 rounded-md bg-bg shadow-[0_1px_3px_rgba(0,0,0,0.12)]"
              transition={{ type: "spring", stiffness: 500, damping: 38 }}
            />
          )}
          <span className="relative">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

export function Switch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cx(
        "relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors duration-200",
        checked ? "bg-[#34c759]" : "bg-surface-2 border border-line",
      )}
    >
      <motion.span
        className="absolute top-[2px] h-[18px] w-[18px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.25)]"
        animate={{ left: checked ? 18 : 2 }}
        transition={{ type: "spring", stiffness: 600, damping: 35 }}
      />
    </button>
  );
}

/** macOS "inset grouped" settings list. */
export function Group({ title, children, footer }: { title?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <section className="mb-5">
      {title && <h3 className="mb-1.5 px-1 text-[11.5px] font-semibold uppercase tracking-wide text-muted">{title}</h3>}
      <div className="divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-line bg-surface">
        {children}
      </div>
      {footer && <p className="mt-1.5 px-1 text-[11.5px] text-muted">{footer}</p>}
    </section>
  );
}

export function Row({ label, hint, children }: { label: ReactNode; hint?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex min-h-[44px] items-center justify-between gap-4 px-3.5 py-2">
      <div className="min-w-0">
        <div className="text-[13px] text-fg">{label}</div>
        {hint && <div className="text-[11.5px] text-muted">{hint}</div>}
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  );
}

// ---------- modal ----------

export function Modal({
  open,
  onOpenChange,
  title,
  children,
  width = 520,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  width?: number;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                className="fixed inset-0 z-40 bg-black/25 dark:bg-black/45"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.16 }}
              />
            </Dialog.Overlay>
            <Dialog.Content
              asChild
              aria-describedby={undefined}
              // don't land on the close button (it would show its tooltip); fields use autoFocus
              onOpenAutoFocus={(e) => e.preventDefault()}
            >
              <motion.div
                className="fixed left-1/2 top-1/2 z-50 flex max-h-[86vh] flex-col overflow-hidden rounded-2xl border border-line bg-bg shadow-[var(--shadow-lg)] outline-none"
                style={{ width, x: "-50%", y: "-50%" }}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ type: "spring", stiffness: 520, damping: 38, mass: 0.8 }}
              >
                <div className="flex h-12 shrink-0 items-center justify-between border-b border-line px-4">
                  <Dialog.Title className="text-[14px] font-semibold">{title}</Dialog.Title>
                  <Dialog.Close asChild>
                    <IconButton label="Close">
                      <X size={15} />
                    </IconButton>
                  </Dialog.Close>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}

/** Small prompt dialog (folder names, passwords). */
export function PromptDialog({
  open,
  onOpenChange,
  title,
  label,
  initial = "",
  confirmLabel = "Save",
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  label: string;
  initial?: string;
  confirmLabel?: string;
  onConfirm: (value: string) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (open) setTimeout(() => ref.current?.select(), 30);
  }, [open]);
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={title} width={380}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const v = ref.current?.value.trim() ?? "";
          if (v) {
            onConfirm(v);
            onOpenChange(false);
          }
        }}
      >
        <label className="mb-1.5 block text-[12px] text-muted">{label}</label>
        <Input ref={ref} defaultValue={initial} autoFocus />
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" variant="primary">
            {confirmLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
