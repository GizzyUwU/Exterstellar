Exterstellar.register({
  id: "devlog-formatter",
  name: "Devlog Formatter",
  description: "Adds a markdown formatting toolbar to the devlog composer.",
  author: "Sabio",
  config: [
    {
      key: "showLabels",
      label: "Show button labels",
      type: "checkbox",
      default: false
    }
  ],

  start() {
    const cfg = Exterstellar.getConfig("devlog-formatter");
    const showLabels = cfg.showLabels === true || cfg.showLabels === "true";

    const style = document.createElement("style");
    style.id = "exterstellar-devlog-formatter";
    style.textContent = `
      .has-fmt-bar .feed-composer__textarea {
        border-top-left-radius: 0 !important;
        border-top-right-radius: 0 !important;
      }

      .fmt-bar {
        display: flex;
        align-items: center;
        gap: 2px;
        padding: 5px 6px;
        background: var(--color-space-bg-2);
        border: 1px solid var(--color-space-surface-faint);
        border-bottom: none;
        border-radius: 8px 8px 0 0;
        flex-wrap: wrap;
        margin-bottom: 8px;
      }

      .fmt-btn {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 3px 6px;
        border: none;
        background: transparent;
        color: var(--color-space-text-muted);
        border-radius: 5px;
        cursor: pointer;
        font-family: var(--font-family-text, sans-serif);
        font-size: 11px;
        line-height: 1;
        transition: all 200ms;
      }

      .fmt-btn:hover {
        background: var(--color-space-surface-faint);
        color: var(--color-space-text);
      }

      .fmt-btn svg {
        width: 14px;
        height: 14px;
        flex-shrink: 0;
      }

      .fmt-btn--heading {
        font-weight: 700;
        letter-spacing: 0.03em;
      }

      .fmt-sep {
        width: 1px;
        height: 14px;
        background: var(--color-space-surface-faint);
        margin: 0 3px;
        flex-shrink: 0;
      }
    `;
    document.head.appendChild(style);

    function inject(field) {
      if (field.querySelector(".fmt-bar")) return;
      const ta = field.querySelector(".feed-composer__textarea");
      if (!ta) return;
      ta.parentNode.insertBefore(buildBar(ta, showLabels), ta);
      field.classList.add("has-fmt-bar");
    }

    const observer = new MutationObserver(mutations => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (!(node instanceof Element)) continue;
          if (node.matches(".feed-composer__field")) inject(node);
          node.querySelectorAll(".feed-composer__field").forEach(inject);
        }
      }
    });

    observer.observe(document.documentElement, {childList: true, subtree: true});
    document.addEventListener("DOMContentLoaded", () => {
      document.querySelectorAll(".feed-composer__field").forEach(inject);
    }, {once: true});

    return function cleanup() {
      observer.disconnect();
      document.querySelectorAll(".fmt-bar").forEach(b => b.remove());
      document.querySelectorAll(".has-fmt-bar").forEach(f => f.classList.remove("has-fmt-bar"));
      style.remove();
    };
  }
});

function wrapSel(ta, before, after, placeholder) {
  const start = ta.selectionStart;
  const end = ta.selectionEnd;
  const sel = ta.value.slice(start, end) || placeholder;
  ta.setRangeText(before + sel + after, start, end, "select");
  ta.dispatchEvent(new Event("input", {bubbles: true}));
  ta.focus();
}

function prefixLines(ta, getPrefix) {
  const start = ta.selectionStart;
  const end = ta.selectionEnd;
  const sel = ta.value.slice(start, end) || "Item";
  const replacement = sel.split("\n").map((l, i) => getPrefix(l, i) + l).join("\n");
  ta.setRangeText(replacement, start, end, "select");
  ta.dispatchEvent(new Event("input", {bubbles: true}));
  ta.focus();
}

function buildBar(ta, showLabels) {
  const bar = document.createElement("div");
  bar.className = "fmt-bar";

  const GROUPS = [
    [
      {
        title: "Bold",
        svg: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-bold-icon lucide-bold"><path d="M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8"/></svg>`,
        run: () => wrapSel(ta, "**", "**", "bold text")
      },
      {
        title: "Italic",
        svg: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-italic-icon lucide-italic"><line x1="19" x2="10" y1="4" y2="4"/><line x1="14" x2="5" y1="20" y2="20"/><line x1="15" x2="9" y1="4" y2="20"/></svg>`,
        run: () => wrapSel(ta, "*", "*", "italic text")
      },
    ],
    [
      {title: "Heading 1", label: "H1", run: () => prefixLines(ta, () => "# ")},
      {title: "Heading 2", label: "H2", run: () => prefixLines(ta, () => "## ")},
      {title: "Heading 3", label: "H3", run: () => prefixLines(ta, () => "### ")},
    ],
    [
      {
        title: "Bullet List",
        svg: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-list-icon lucide-list"><path d="M3 5h.01"/><path d="M3 12h.01"/><path d="M3 19h.01"/><path d="M8 5h13"/><path d="M8 12h13"/><path d="M8 19h13"/></svg>`,
        run: () => prefixLines(ta, () => "* ")
      },
      {
        title: "Ordered List",
        svg: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-list-ordered-icon lucide-list-ordered"><path d="M11 5h10"/><path d="M11 12h10"/><path d="M11 19h10"/><path d="M4 4h1v5"/><path d="M4 9h2"/><path d="M6.5 20H3.4c0-1 2.6-1.925 2.6-3.5a1.5 1.5 0 0 0-2.6-1.02"/></svg>`,
        run: () => prefixLines(ta, (_, i) => `${i + 1}. `)
      },
    ],
    [
      {
        title: "Link",
        svg: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-link-icon lucide-link"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`,
        run: () => wrapSel(ta, "[", "](url)", "link text")
      },
      {
        title: "Image",
        svg: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-image-icon lucide-image"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>`,
        run: () => wrapSel(ta, "![", "](url)", "alt text")
      },
    ],
  ];

  for (const [gi, group] of GROUPS.entries()) {
    if (gi > 0) {
      const sep = document.createElement("div");
      sep.className = "fmt-sep";
      bar.appendChild(sep);
    }

    for (const btn of group) {
      const b = document.createElement("button");
      b.type = "button";
      b.title = btn.title;
      b.addEventListener("click", btn.run);

      if (btn.svg) {
        b.className = "fmt-btn";
        b.innerHTML = btn.svg;
        if (showLabels) {
          const lbl = document.createElement("span");
          lbl.textContent = btn.title;
          b.appendChild(lbl);
        }
      } else {
        b.className = "fmt-btn fmt-btn--heading";
        b.textContent = btn.label;
      }

      bar.appendChild(b);
    }
  }

  return bar;
}