import React from "react";
import ReactDOM from "react-dom/client";
import { MotionConfig } from "motion/react";
import * as Tooltip from "@radix-ui/react-tooltip";
import { getCurrentWindow } from "@tauri-apps/api/window";
import "./styles/app.css";
import { Popup } from "./popup/Popup";
import { Manager } from "./manager/Manager";

const isPopup = getCurrentWindow().label === "popup";

// no browser context menu ("Reload", "Inspect") outside text fields in release builds
if (import.meta.env.PROD) {
  document.addEventListener("contextmenu", (e) => {
    const t = e.target as HTMLElement;
    if (!t.closest("input, textarea, [contenteditable='true']")) e.preventDefault();
  });
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <MotionConfig reducedMotion="user">
      <Tooltip.Provider>{isPopup ? <Popup /> : <Manager />}</Tooltip.Provider>
    </MotionConfig>
  </React.StrictMode>,
);
