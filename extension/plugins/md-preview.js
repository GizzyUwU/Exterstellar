Exterstellar.register({
  id: "md-preview",
  name: "Markdown Preview",
  description: "Live inline markdown preview in the devlog composer, similar to WhatsApp's or Slack's markdown system.",
  author: "Sabio",
  config: [
    {
      key: "showRaw",
      label: "Dim source text instead of hiding it",
      type: "checkbox",
      default: false
    }
  ],

  start() {
    const cfg = Exterstellar.getConfig("md-preview");
    const dimRaw = cfg.showRaw === true || cfg.showRaw === "true";

    const style = document.createElement("style");
    style.id = "exterstellar-md-preview";
    style.textContent = buildPreviewCSS(dimRaw);
    document.head.appendChild(style);

    const instances = new Map();

    function attach(ta) {
      if (instances.has(ta)) return;

      const wrapper = document.createElement("div");
      wrapper.className = "mdp-wrap";

      ta.parentNode.insertBefore(wrapper, ta);
      wrapper.appendChild(ta);

      const overlay = document.createElement("div");
      overlay.className = "mdp-overlay";
      overlay.setAttribute("aria-hidden", "true");
      wrapper.appendChild(overlay);

      function syncStyles() {
        const cs = getComputedStyle(ta);
        const props = [
          "fontSize", "fontFamily", "fontWeight", "lineHeight", "letterSpacing", "paddingTop", "paddingLeft", "paddingRight", "paddingBottom", "borderTopWidth",
          "borderRightWidth", "borderBottomWidth", "borderLeftWidth", "boxSizing", "textAlign", "wordBreak", "overflowWrap",
        ];
        for (const p of props) overlay.style[p] = cs[p];
        wrapper.style.height = ta.offsetHeight + "px";
      }

      function sync() {
        overlay.innerHTML = renderMd(ta.value);
        wrapper.style.height = ta.style.height || "";
      }

      ta.addEventListener("input", sync);
      ta.addEventListener("scroll", () => {overlay.scrollTop = ta.scrollTop;});

      const ro = new ResizeObserver(() => {syncStyles();});
      ro.observe(ta);

      syncStyles();
      sync();
      instances.set(ta, {overlay, wrapper, ro});
    }

    function detach(ta) {
      const inst = instances.get(ta);
      if (!inst) return;
      inst.ro.disconnect();
      inst.overlay.remove();
      inst.wrapper.parentNode.insertBefore(ta, inst.wrapper);
      inst.wrapper.remove();
      instances.delete(ta);
    }

    const observer = new MutationObserver(mutations => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (!(node instanceof Element)) continue;
          node.querySelectorAll(".feed-composer__textarea").forEach(attach);
          if (node.matches?.(".feed-composer__textarea")) attach(node);
        }
      }
    });

    observer.observe(document.documentElement, {childList: true, subtree: true});
    document.querySelectorAll(".feed-composer__textarea").forEach(attach);

    return function cleanup() {
      observer.disconnect();
      for (const ta of [...instances.keys()]) detach(ta);
      style.remove();
    };
  }
});

function renderMd(raw) {
  // this is the last time i touch regex bro

  if (!raw) return "";

  let s = raw.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  s = s.replace(/^(#{1,3}) (.+)$/gm, (_, hashes, txt) => {
    const lvl = hashes.length;
    return `<span class="mdp-h mdp-h${lvl}"><span class="mdp-syntax">${hashes} </span>${txt}</span>`;
  });

  s = s.replace(/^([ \t]*)([*\-]) (.+)$/gm,
    (_, indent, marker, text) => `${indent}<span class="mdp-li"><span class="mdp-syntax mdp-bullet">•</span> ${text}</span>`
  );

  s = s.replace(/^([ \t]*)(\d+)\. (.+)$/gm,
    (_, indent, n, text) => `${indent}<span class="mdp-li"><span class="mdp-syntax">${n}.</span> ${text}</span>`
  );

  s = s.replace(/(\*{3}|_{3})(.+?)\1/g,
    `<span class="mdp-bold mdp-italic"><span class="mdp-syntax">$1</span><strong><em>$2</em></strong><span class="mdp-syntax">$1</span></span>`
  );

  s = s.replace(/(\*{2}|_{2})(.+?)\1/g,
    `<span class="mdp-bold"><span class="mdp-syntax">$1</span><strong>$2</strong><span class="mdp-syntax">$1</span></span>`
  );

  s = s.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g,
    `<span class="mdp-italic"><span class="mdp-syntax">*</span><em>$1</em><span class="mdp-syntax">*</span></span>`
  );

  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g,
    `<span class="mdp-link"><span class="mdp-syntax">[</span>$1<span class="mdp-syntax">](</span><span class="mdp-url">$2</span><span class="mdp-syntax">)</span></span>`
  );
  
  s = s.replace(/\n/g, "<br>");
  return s;
}

function buildPreviewCSS(dimRaw) {
  return `
    .mdp-wrap {
      position: relative;
      display: block;
    }

    .mdp-wrap .feed-composer__textarea {
      position: relative;
      z-index: 2;
      color: transparent !important;
      caret-color: var(--color-space-text) !important;
      background: transparent !important;
    }

    ${dimRaw ? `
    .mdp-wrap .feed-composer__textarea {
      color: rgb(var(--color-space-text-rgb, 205 214 244) / 0.18) !important;
      caret-color: var(--color-space-text) !important;
    }
    ` : ""}

    .mdp-overlay {
      position: absolute;
      inset:0;
      z-index: 1;
      pointer-events: none;
      overflow: hidden;
      color: var(--color-space-text);
      white-space: pre-wrap;
      overflow-wrap: break-word;
      word-break: break-word;
      box-sizing: border-box;
    }

    .mdp-syntax {
      opacity: 0.35;
      color: var(--color-space-text-muted);
    }

    .mdp-h {display: inline;}
    .mdp-h1 {color: var(--color-space-text);}
    .mdp-h2 {color: var(--color-space-text);}
    .mdp-h3 {color: var(--color-space-text-muted);}

    .mdp-bold {display: inline;}
    .mdp-italic {display: inline;}

    .mdp-link {display: inline;}
    .mdp-url {
      color: var(--color-space-text-muted);
      text-decoration: underline;
      text-underline-offset: 2px;
    }
    
    .mdp-li {display: inline;}
    .mdp-li .mdp-syntax {
      color: var(--color-space-accent)
      opacity: 0.9;
    }
    .mdp-bullet {font-style:normal;}
  `
}