export {};
declare const Exterstellar: import("../types").ExterstellarAPI;

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
    style.textContent = buildPreviewCSS(dimRaw, 480);
    document.head.appendChild(style);

    interface MdpInstance {
      overlay: HTMLDivElement;
      wrapper: HTMLDivElement;
      ro: ResizeObserver;
      onWheel: (e: WheelEvent) => void;
    }
    const instances = new Map<HTMLTextAreaElement, MdpInstance>();

    function attach(ta: HTMLTextAreaElement): void {
      if (instances.has(ta)) return;

      const wrapper = document.createElement("div");
      wrapper.className = "mdp-wrap";
      ta.parentNode?.insertBefore(wrapper, ta);

      const overlay = document.createElement("div");
      overlay.className = "mdp-overlay";
      overlay.setAttribute("aria-hidden", "true");
      wrapper.appendChild(overlay);
      wrapper.appendChild(ta);

      const isAutogrow = ta.dataset.action?.includes("autogrow");

      function syncStyles() {
        const cs = getComputedStyle(ta);
        const props = [
          "fontSize", "fontFamily", "fontWeight", "lineHeight", "letterSpacing", "paddingTop", "paddingLeft", "paddingRight", "paddingBottom", "borderTopWidth",
          "borderRightWidth", "borderBottomWidth", "borderLeftWidth", "boxSizing", "textAlign", "wordBreak", "overflowWrap", "whiteSpace",
        ];
        for (const p of props) (overlay.style as unknown as Record<string, string>)[p] = (cs as unknown as Record<string, string>)[p] ?? "";
        overlay.style.width = ta.clientWidth + "px";
        if (isAutogrow) {
          overlay.style.height = ta.offsetHeight + "px";
          wrapper.style.height = Math.min(ta.offsetHeight, 480) + "px";
          ta.style.maxHeight = "";
        }
      }

      function sync() {
        if (!isAutogrow) {
          ta.style.height = "auto";
          ta.style.height = ta.scrollHeight + "px";
        }
        overlay.innerHTML = renderMd(ta.value);
        overlay.scrollTop = wrapper.scrollTop;
      }

      function onWheel(e: WheelEvent): void {
        wrapper.scrollTop += e.deltaY;
        e.preventDefault();
      }

      wrapper.addEventListener("scroll", () => {
        overlay.scrollTop = wrapper.scrollTop;
      });

      ta.addEventListener("input", sync);
      ta.addEventListener("wheel", onWheel, {passive: false});

      const ro = new ResizeObserver(syncStyles);
      ro.observe(ta);

      syncStyles();
      sync();
      instances.set(ta, {overlay, wrapper, ro, onWheel});
    }

    function detach(ta: HTMLTextAreaElement) {
      const inst = instances.get(ta);
      if (!inst) return;
      inst.ro.disconnect();
      ta.removeEventListener("wheel", inst.onWheel);
      inst.overlay.remove();
      inst.wrapper.parentNode?.insertBefore(ta, inst.wrapper);
      inst.wrapper.remove();
      instances.delete(ta);
    }

    const observer = new MutationObserver(mutations => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (!(node instanceof Element)) continue;
          node.querySelectorAll<HTMLTextAreaElement>(".feed-composer__textarea, .devlog-detail__comment-textarea").forEach(attach);
          if (node.matches?.(".feed-composer__textarea, .devlog-detail__comment-textarea")) attach(node as HTMLTextAreaElement);
        }
      }
    });

    observer.observe(document.documentElement, {childList: true, subtree: true});
    document.querySelectorAll<HTMLTextAreaElement>(".feed-composer__textarea, .devlog-detail__comment-textarea").forEach(attach);

    Exterstellar._exports["md-preview"] = {attach, detach};

    return function cleanup() {
      observer.disconnect();
      for (const ta of [...instances.keys()]) detach(ta);
      style.remove();
    };
  }
});

function renderMd(raw: string): string {
  if (!raw) return "";

  let s = raw.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  s = s.replace(/^(#{1,3}) (.+)$/gm, (_: string, hashes: string, txt: string) => {
    const lvl = hashes.length;
    return `<span class="mdp-h mdp-h${lvl}"><span class="mdp-syntax">${hashes} </span>${txt}</span>`;
  });

  s = s.replace(/^([ \t]*)([*\-]) (.+)$/gm,
    (_: string, indent: string, marker: string, text: string) => `${indent}<span class="mdp-li"><span class="mdp-syntax mdp-bullet">•</span> ${text}</span>`
  );

  s = s.replace(/^([ \t]*)(\d+)\. (.+)$/gm,
    (_: string, indent: string, n: string, text: string) => `${indent}<span class="mdp-li"><span class="mdp-syntax">${n}.</span> ${text}</span>`
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

  s = s.replace(/^(---|\*\*\*|___)(\n|$)/gm,
    `<span class="mdp-hr"><span class="mdp-syntax">$1</span></span>`
  );

  s = s.replace(/\n/g, "<br>");
  return s;
}

function buildPreviewCSS(dimRaw: boolean, maxH: number): string {
  return `
    .mdp-wrap {
      display: grid;
      max-height: ${maxH}px;
      overflow-y: auto;
      overflow-x: hidden;
    }

    .mdp-wrap > * {
      grid-area: 1 / 1;
    }

    .mdp-wrap .feed-composer__textarea {
      position: relative;
      z-index: 2;
      align-self: start;
      overflow: hidden !important;
      color: transparent !important;
      caret-color: var(--color-space-text) !important;
      background: transparent !important;
      resize: none !important;
    }

    .mdp-wrap .devlog-detail__comment-textarea {
      position: relative;
      z-index: 2;
      align-self: start;
      overflow: hidden !important;
      color: transparent !important;
      caret-color: var(--color-space-text) !important;
      background: transparent !important;
      resize: none !important;
      border-width: 0 !important;
    }

    ${dimRaw ? `
    .mdp-wrap .feed-composer__textarea,
    .mdp-wrap .devlog-detail__comment-textarea {
      color: rgb(var(--color-space-text-rgb, 205 214 244) / 0.18) !important;
      caret-color: var(--color-space-text) !important;
    }
    ` : ""}

    .mdp-overlay {
      position: relative;
      z-index: 1;
      align-self: start;
      pointer-events: none;
      overflow: hidden;
      color: var(--color-space-text);
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
      color: var(--color-space-accent);
      opacity: 0.9;
    }
    .mdp-bullet {font-style: normal;}

    .mdp-hr {
      display: block;
      position: relative;
    }
    .mdp-hr::after {
      content: "";
      position: absolute;
      left: 0;
      right: 0;
      top: 50%;
      border-top: 1px solid currentColor;
      opacity: 0.25;
    }
    .mdp-hr .mdp-syntax {opacity: 0.1;}
  `;
}