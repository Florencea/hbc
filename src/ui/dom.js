const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * Creates an HTML element with attributes, dataset, event listeners, and children.
 * String/number children are always inserted as safe Text nodes (never innerHTML).
 */
export function el(tag, props = null, ...children) {
  const node = document.createElement(tag);
  if (props !== null) {
    for (const [key, value] of Object.entries(props)) {
      if (value === undefined || value === null || value === false) continue;
      if (key === "className") {
        node.className = value;
      } else if (key === "dataset") {
        for (const [dKey, dVal] of Object.entries(value)) {
          if (dVal !== undefined && dVal !== null) {
            node.dataset[dKey] = String(dVal);
          }
        }
      } else if (key === "cssVars") {
        for (const [vKey, vVal] of Object.entries(value)) {
          if (vVal !== undefined && vVal !== null) {
            node.style.setProperty(vKey, String(vVal));
          }
        }
      } else if (key === "on") {
        const signal = props.signal;
        for (const [eventName, handler] of Object.entries(value)) {
          if (typeof handler === "function") {
            node.addEventListener(
              eventName,
              handler,
              signal ? { signal } : undefined,
            );
          }
        }
      } else if (key === "signal") {
        continue;
      } else if (value === true) {
        node.setAttribute(key, "");
      } else if (key === "value" && "value" in node) {
        node.value = String(value);
      } else {
        node.setAttribute(key, String(value));
      }
    }
  }
  for (const child of children.flat()) {
    if (child === undefined || child === null || child === false) continue;
    if (child instanceof Node) {
      node.appendChild(child);
    } else {
      node.appendChild(document.createTextNode(String(child)));
    }
  }
  return node;
}

/**
 * Creates an SVG element under the standard SVG namespace.
 */
export function svgEl(tag, attrs = null, ...children) {
  const node = document.createElementNS(SVG_NS, tag);
  if (attrs !== null) {
    for (const [key, value] of Object.entries(attrs)) {
      if (value === undefined || value === null || value === false) continue;
      if (key === "className") {
        node.setAttribute("class", String(value));
      } else {
        node.setAttribute(key, String(value));
      }
    }
  }
  for (const child of children.flat()) {
    if (child instanceof Node) {
      node.appendChild(child);
    }
  }
  return node;
}

export function setData(node, key, value) {
  if (value === undefined || value === null || value === "") {
    if (key in node.dataset) {
      delete node.dataset[key];
    }
    return;
  }
  const str = String(value);
  if (node.dataset[key] !== str) {
    node.dataset[key] = str;
  }
}

export function setBoolAttr(node, name, enabled) {
  if (enabled) {
    if (!node.hasAttribute(name)) {
      node.setAttribute(name, "");
    }
  } else if (node.hasAttribute(name)) {
    node.removeAttribute(name);
  }
}

export function setCssVar(node, name, value) {
  const str = String(value);
  if (node.style.getPropertyValue(name) !== str) {
    node.style.setProperty(name, str);
  }
}

let cachedDisplayTransitionSupport;

function canTransitionDisplay() {
  if (cachedDisplayTransitionSupport !== undefined) {
    return cachedDisplayTransitionSupport;
  }
  if (
    typeof window === "undefined" ||
    !window.CSS?.supports?.("transition-behavior", "allow-discrete") ||
    !document.body
  ) {
    return false;
  }
  const probe = document.createElement("div");
  probe.style.cssText =
    "transition: display 1s allow-discrete !important; display: block;";
  document.body.appendChild(probe);
  window.getComputedStyle(probe).display;
  probe.style.display = "none";
  cachedDisplayTransitionSupport =
    window.getComputedStyle(probe).display === "block";
  probe.remove();
  return cachedDisplayTransitionSupport;
}

function supportsTopLayerExit() {
  return (
    typeof window !== "undefined" &&
    Boolean(window.CSS?.supports?.("overlay", "auto")) &&
    canTransitionDisplay()
  );
}

/**
 * Closes a native <dialog> smoothly using top-layer transitions when supported,
 * or data-closing + getAnimations() fallback in browsers lacking overlay/discrete display transitions.
 */
export async function closeDialogSmoothly(dialog, returnValue = "") {
  if (!dialog.open) return;
  if (!supportsTopLayerExit()) {
    if (dialog.hasAttribute("data-closing")) return;
    dialog.setAttribute("data-closing", "");
    const animations =
      typeof dialog.getAnimations === "function"
        ? dialog.getAnimations({ subtree: true })
        : [];
    if (animations.length > 0) {
      await Promise.race([
        Promise.allSettled(animations.map((a) => a.finished)),
        new Promise((resolve) => {
          setTimeout(resolve, 400);
        }),
      ]);
    }
    if (!dialog.hasAttribute("data-closing")) return;
    dialog.removeAttribute("data-closing");
  }
  if (dialog.open) {
    dialog.close(returnValue);
  }
}

/**
 * Progressive-enhancement light dismiss for <dialog closedby="any"> when
 * HTMLDialogElement.prototype.closedBy is unsupported.
 */
export function enableLightDismissFallback(dialog, signal) {
  if (
    typeof HTMLDialogElement === "undefined" ||
    "closedBy" in HTMLDialogElement.prototype
  ) {
    return;
  }
  const isOutside = (event) => {
    const rect = dialog.getBoundingClientRect();
    return (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    );
  };
  let pressedOutside = false;
  dialog.addEventListener(
    "pointerdown",
    (event) => {
      pressedOutside = isOutside(event);
    },
    { signal },
  );
  dialog.addEventListener(
    "pointerup",
    (event) => {
      if (pressedOutside && isOutside(event)) {
        void closeDialogSmoothly(dialog);
      }
      pressedOutside = false;
    },
    { signal },
  );
}
