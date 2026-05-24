Exterstellar.register({
  id: "better-sidebar",
  name: "Better Sidebar",
  description: "Redesigns the sidebar to look visually better.",
  author: "Sabio",
  config: [
    {
      key: "preload",
      label: "Preload before paint",
      type: "checkbox",
      default: true
    }
  ],
  start() {
    const cfg = Exterstellar.getConfig("better-sidebar");
    const preload = cfg.preload !== false && cfg.preload !== "false";

    sessionStorage.setItem("_ext_better-sidebar_pre", preload ? "1" : "0");

    // if already preloaded, then dont create a new style element
    let style = document.getElementById("exterstellar-better-sidebar");
    if (!style) {
      style = document.createElement("style");
      style.id = "exterstellar-better-sidebar";
      style.textContent = SIDEBAR_CSS;
    }
    document.head.appendChild(style);

    return function cleanup() {
      style.remove();
    };
  }
});

const SIDEBAR_CSS = `
  .sidebar {
    background: var(--color-space-bg) !important;
    border-right: 2px solid var(--color-space-surface-faint) !important;
    padding-inline: 10px;
  }

  .sidebar__logo {
    padding: 18px 4px 6px;
    display: flex;
    justify-content: center;
  }

  .sidebar__logo-img {
    width: 142px;
    height: auto;
  }
    
  .sidebar__nav-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 12px 0;
  }

  .sidebar__nav-link,
  button.sidebar__nav-link {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 12px;
    border-radius: 12px;
    padding: 9px 12px;
    width: 100%;
    transition: background 200ms ease;
    position: relative;
    text-decoration: none !important;
    cursor: pointer;
    border: none;
    background: transparent;
  }

  .sidebar__nav-link:hover:not(.sidebar__nav-link--active):not([aria-disabled="true"]) {
    background: var(--color-space-surface-faint);
  }

  .sidebar__nav-link--active {
    background: var(--color-space-accent-soft) !important;
    border-radius: calc(var(--border-radius) / 1.5);
  }

  .sidebar__nav-link--active .sidebar__nav-label {
    color: var(--color-space-text) !important;
    font-family: "Exo 2", sans-serif;
    font-style: normal !important;
    font-weight: 700 !important;
    font-size: 21px;
  }

  .sidebar__nav-link--active .sidebar__nav-icon-wrapper {
    background: hsla(265, 95%, 78%, 0.14) !important;
  }

  .sidebar__nav-link--locked,
  .sidebar__nav-link--inert {
    opacity: 0.35;
    pointer-events: auto;
    cursor: not-allowed !important;
  }

  .sidebar__nav-link--locked:hover,
  .sidebar__nav-link--inert:hover {
    opacity: 0.5;
    background: var(--color-space-surface-faint) !important;
  }

  .sidebar__nav-icon-wrapper {
    width: 36px;
    height: 36px;
    flex-shrink: 0;
    border-radius: 10px;
    background: var(--color-space-surface-faint);
    display: flex !important;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    position: relative;
    transition: background 200ms;
  }

  .sidebar__nav-icon {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 22px !important;
    height: 22px !important;
    object-fit: contain;
    display: block;
  }

  .sidebar__nav-link:hover:not([aria-disabled="true"]) .sidebar__nav-icon-wrapper {
    background: var(--color-space-surface-soft);
  }

  .sidebar__nav-avatar {
    width: 36px !important;
    height: 36px !important;
    border-radius: 0 !important;
    object-fit: cover;
    display: block;
  }

  .sidebar__nav-label {
    font-size: 19px;
    font-weight: 500;
    color: var(--color-space-text-muted);
    letter-spacing: 0.01em;
    text-transform: capitalize;
    transition: font-size 200ms;
  }

  .sidebar__nav-link:hover:not([aria-disabled="true"]) .sidebar__nav-label {
    color: var(--color-space-text);
  }

  .sidebar__nav-lock {
    margin-left: auto;
    opacity: 0.45;
  }

  .sidebar__nav-lock-icon {
    width: 12px;
    height: 12px;
    display: block;
  }
`;

if (sessionStorage.getItem("_ext_better-sidebar_pre") === "1") {
  const pre = document.createElement("style");
  pre.id = "exterstellar-better-sidebar";
  pre.textContent = SIDEBAR_CSS;
  document.documentElement.appendChild(pre);
}