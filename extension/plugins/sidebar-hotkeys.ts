export {};
declare const Exterstellar: import("../types").ExterstellarAPI;

Exterstellar.register({
  id: "sidebar-hotkeys",
  name: "Sidebar Hotkeys",
  description: "Instantly go to a page by using a shortcut on your keyboard!",
  author: "Sabio",
  config: [
    {
      key: "modifier",
      label: "Modifier key",
      type: "select",
      options: [
        {value: "Alt", label: "Alt"},
        {value: "Ctrl", label: "Ctrl"},
        {value: "Meta", label: "Meta (Win/⌘)"}
      ],
      default: "Ctrl"
    },
    {
      key: "scheme",
      label: "Key scheme",
      type: "select",
      options: [
        {value: "letters", label: "Letters"},
        {value: "numbers", label: "Numbers"}
      ],
      default: "numbers"
    },
    {
      key: "showHints",
      label: "Show key hints in sidebar",
      type: "checkbox",
      default: true
    }
  ],

  start() {
    const cfg = Exterstellar.getConfig("sidebar-hotkeys");
    const modifier = cfg.modifier || "Ctrl";
    const scheme = cfg.scheme || "numbers";
    const showHints = cfg.showHints !== false && cfg.showHints !== "false";

    const style = document.createElement("style");
    style.id = "exterstellar-sidebar-hotkeys";
    style.textContent = `
      .sk-hint {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 16px;
        height: 16px;
        padding: 0 4px;
        margin-left: auto;
        flex-shrink: 0;
        border-radius: 4px;
        background: var(--color-space-surface-faint);
        border: 1px solid hsla(228, 18%, 45%, 0.35);
        color: var(--color-space-text-muted);
        font-size: 10px;
        font-weight: 600;
        font-family: monospace;
        letter-spacing: 0.03em;
        line-height: 1;
        pointer-events: none;
        user-select: none;
      }

      .sidebar__nav-link--active .sk-hint {
        background: hsla(265, 95%, 78%, 0.15);
        border-color: hsla(265, 95%, 78%, 0.4);
        color: var(--color-space-accent);
      }
    `;
    document.head.appendChild(style);

    let keyMap: Record<string, HTMLElement> = {};

    function buildKeyMap() {
      document.querySelectorAll(".sk-hint").forEach(h => h.remove());
      keyMap = {};

      const links = [...document.querySelectorAll<HTMLElement>(".sidebar__nav-link")].filter(el => !el.classList.contains("sidebar__nav-link--locked") && !el.classList.contains("sidebar__nav-link--inert"));

      const used = new Set();

      links.forEach((link, idx) => {
        const labelEl = link.querySelector(".sidebar__nav-label");
        const text = labelEl?.textContent.trim().toUpperCase().replace(/[^A-Z0-9]/g, "") ?? "";

        let key;
        if (scheme === "numbers") {
          if (idx >= 9) return;
          key = String(idx + 1);
        } else {
          key = [...text].find(c => !used.has(c));
          if (!key) key = String(idx + 1);
        }

        used.add(key);
        keyMap[key] = link;

        if (showHints) {
          const badge = document.createElement("span");
          badge.className = "sk-hint";
          badge.textContent = key;
          link.appendChild(badge);
        }
      });
    }

    function onKeyDown(e: KeyboardEvent) {
      const modHeld = modifier === "Alt" ? e.altKey : modifier === "Ctrl" ? e.ctrlKey : e.metaKey;
      if (!modHeld) return;
      if (!(e.target instanceof Element)) return;
      if (e.target.matches("input, textarea, select, [contenteditable]")) return;

      const link = keyMap[e.key.toUpperCase()];
      if (!link) return;

      e.preventDefault();
      link.click();
    }

    let rebuildTimer: ReturnType<typeof setTimeout> | undefined;
    const observer = new MutationObserver(() => {
      clearTimeout(rebuildTimer);
      rebuildTimer = setTimeout(() => {
        if (document.querySelector(".sidebar__nav-link")) buildKeyMap();
      }, 120);
    });

    observer.observe(document.documentElement, {childList: true, subtree: true});
    document.addEventListener("keydown", onKeyDown);

    if (document.querySelector(".sidebar__nav-link")) buildKeyMap();

    return function cleanup() {
      clearTimeout(rebuildTimer);
      observer.disconnect();
      document.removeEventListener("keydown", onKeyDown);
      document.querySelectorAll(".sk-hint").forEach(h => h.remove());
      style.remove();
    };
  }
});