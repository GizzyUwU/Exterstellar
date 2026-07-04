export {};
declare const Exterstellar: import("../types").ExterstellarAPI;

Exterstellar.register({
  id: "focus-mode",
  name: "Focus Mode",
  description: "Adds a toggle button to hide sidebars and widen the feed.",
  author: "Sabio",

  config: [
    {
      key: "hideLeft",
      label: "Hide left sidebar",
      type: "checkbox",
      default: true,
    },
    {
      key: "hideRight",
      label: "Hide right sidebar",
      type: "checkbox",
      default: true,
    },
  ],

  start() {
    const cfg = Exterstellar.getConfig("focus-mode");
    const hideLeft = cfg.hideLeft !== false && cfg.hideLeft !== "false";
    const hideRight = cfg.hideRight !== false && cfg.hideRight !== "false";

    const style = document.createElement("style");
    style.id = "exterstellar-focus-mode";
    style.textContent = `
      ${hideLeft ? `body.xtr-focus-active .sidebar {display: none !important;}` : ""}
      ${hideRight ? `body.xtr-focus-active .discover-rail {display: none !important;}` : ""}

      ${hideLeft ? `
      body.xtr-focus-active.signed-in {
        margin-left: 0 !important;
      }
      body.xtr-focus-active .app-layout {
        margin-left: 0 !important;
        padding-left: 0;
      }` : ""}

      ${hideRight ? `
      body.xtr-focus-active.signed-in {
        margin-right: 0 !important;
      }
      body.xtr-focus-active .app-layout {
        margin-right: 0 !important;
        max-width: 100% !important;
        padding-right: 0;
      }` : ""}

      body.xtr-focus-active .app-layout__main {
        max-width: 50dvw !important;
      }

      #exterstellar-focus-btn {
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 9999;
        background: var(--color-space-surface-soft);
        color: var(--color-space-text);
        border: 1px solid var(--color-space-surface-faint);
        border-radius: 999px;
        padding: 8px 14px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 6px;
        transition: all 200ms;
        opacity: 0.7;
        font-family: inherit;
      }

      #exterstellar-focus-btn:hover {
        opacity: 1;
        background: var(--color-space-surface-faint);
      }

      body.xtr-focus-active #exterstellar-focus-btn {
        opacity: 1;
      }
    `;
    document.head.appendChild(style);

    const btn = document.createElement("button");
    btn.id = "exterstellar-focus-btn";
    btn.setAttribute("aria-label", "Toggle focus mode");
    btn.setAttribute("title", "Toggle focus mode");

    function updateBtn(active: boolean) {
      btn.innerHTML = active ? `Exit Focus` : `Focus`;
    }

    let active = sessionStorage.getItem("_ext_focus-mode_on") === "1";
    if (active) document.body.classList.add("xtr-focus-active");
    updateBtn(active);

    btn.addEventListener("click", () => {
      active = !active;
      document.body.classList.toggle("xtr-focus-active", active);
      sessionStorage.setItem("_ext_focus-mode_on", active ? "1" : "0");
      updateBtn(active);
    });

    function ensureBtn() {
      if (!document.getElementById("exterstellar-focus-btn")) {
        document.body.appendChild(btn);
      }
      if (active) document.body.classList.add("xtr-focus-active");
    }

    document.addEventListener("turbo:load", ensureBtn);
    document.addEventListener("turbo:render", ensureBtn);

    document.body.appendChild(btn);

    return function cleanup() {
      document.removeEventListener("turbo:load", ensureBtn);
      document.removeEventListener("turbo:render", ensureBtn);
      style.remove();
      btn.remove();
      document.body.classList.remove("xtr-focus-active");
      sessionStorage.removeItem("_ext_focus-mode_on");
    };
  },
});