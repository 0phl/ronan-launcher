import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Plus, X } from "lucide-react";

/** macOS-style "traffic light" window controls. Close hides the window to the tray. */
export function TrafficLights() {
  const [focused, setFocused] = useState(true);
  useEffect(() => {
    const win = getCurrentWindow();
    const p = win.onFocusChanged(({ payload }) => setFocused(payload));
    return () => {
      p.then((off) => off());
    };
  }, []);

  const win = getCurrentWindow();
  const lights = [
    { color: "#ff5f57", icon: X, label: "Close", onClick: () => win.close() },
    { color: "#febc2e", icon: Minus, label: "Minimize", onClick: () => win.minimize() },
    { color: "#28c840", icon: Plus, label: "Zoom", onClick: () => win.toggleMaximize() },
  ];

  return (
    <div className="group flex items-center gap-2">
      {lights.map(({ color, icon: Icon, label, onClick }) => (
        <button
          key={label}
          aria-label={label}
          onClick={onClick}
          className="flex h-3 w-3 items-center justify-center rounded-full border border-black/10 transition-colors"
          style={{ background: focused ? color : "var(--surface-2)" }}
        >
          <Icon size={8} strokeWidth={3} className="text-black/60 opacity-0 transition-opacity group-hover:opacity-100" />
        </button>
      ))}
    </div>
  );
}
