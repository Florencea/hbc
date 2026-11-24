import { el } from "./dom.js";

const TOAST_ICONS = Object.freeze({
  error: "⚠️",
  warning: "⚡",
  success: "✅",
  info: "ℹ️",
});

function hasNativePopover(node) {
  return (
    typeof HTMLElement !== "undefined" &&
    Object.hasOwn(HTMLElement.prototype, "popover") &&
    typeof node.showPopover === "function"
  );
}

export function createToastHost(actions, signal) {
  const iconEl = el("span", { "aria-hidden": "true" });
  const msgEl = el("span");
  const closeBtn = el(
    "button",
    {
      type: "button",
      className: "dialog-close-btn",
      "aria-label": "關閉通知",
      signal,
      on: { click: actions.onDismiss },
    },
    "✕",
  );

  const cardEl = el(
    "div",
    { className: "toast-card", dataset: { type: "info" } },
    iconEl,
    msgEl,
    closeBtn,
  );

  const hostEl = el(
    "div",
    {
      className: "toast-host",
      popover: "manual",
      role: "status",
      "aria-live": "polite",
      "aria-atomic": "true",
    },
    cardEl,
  );

  let lastKey = 0;

  function show() {
    if (hasNativePopover(hostEl)) {
      if (!hostEl.matches(":popover-open")) {
        try {
          hostEl.showPopover();
        } catch {
          hostEl.dataset.open = "true";
        }
      }
    } else {
      hostEl.dataset.open = "true";
      hostEl.hidden = false;
    }
  }

  function hide() {
    if (hasNativePopover(hostEl)) {
      if (hostEl.matches(":popover-open")) {
        try {
          hostEl.hidePopover();
        } catch {
          delete hostEl.dataset.open;
        }
      }
    } else {
      delete hostEl.dataset.open;
      hostEl.hidden = true;
    }
  }

  if (!hasNativePopover(hostEl)) {
    hostEl.hidden = true;
  }

  function update(toast) {
    if (!toast) {
      lastKey = 0;
      hide();
      return;
    }
    if (toast.key === lastKey) return;
    lastKey = toast.key;
    cardEl.dataset.type = toast.type;
    iconEl.textContent = TOAST_ICONS[toast.type] ?? "ℹ️";
    msgEl.textContent = toast.message;
    show();
  }

  return { element: hostEl, update };
}
