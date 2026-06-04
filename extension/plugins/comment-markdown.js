import {marked} from "marked";

Exterstellar.register({
  id: "comment-markdown",
  name: "Comment Markdown",
  description: "Renders markdown in comments.",
  author: "Sabio",
  config: [
    {
      key: "advertise",
      label: "Add 'Use Exterstellar for comment markdown.' to comments using markdown.",
      type: "checkbox",
      default: false
    }
  ],

  start() {
    marked.use({breaks: true});

    const cfg = Exterstellar.getConfig("comment-markdown");
    const advertise = cfg.advertise === true || cfg.advertise === "true";

    function looksLikeMd(text) {
      return /(\*{1,3}|#{1,3} |^[-*] |\[.+\]\()/m.test(text);
    }

    const formListeners = [];

    function attachFormHook(form) {
      if (form.dataset.cmHooked) return;
      const ta = form.querySelector(".devlog-detail__comment-textarea");
      if (!ta) return;

      const suffix = " (Use Exterstellar for comment markdown.)"; // TODO: make this configurable?

      const formatter = Exterstellar.getExport("devlog-formatter");
      if (formatter) {
        ta.classList.add("feed-composer__textarea");
        form.classList.add("feed-composer__field");
        formatter.inject(form);
        ta.classList.remove("feed-composer__textarea");
        form.classList.remove("feed-composer__field");
      }

      const preview = Exterstellar.getExport("md-preview");
      if (preview) {
        preview.attach(ta);
        ta.style.borderWidth = "0px";
      }

      function onSubmit(e) {
        if (!advertise) return;
        if (!looksLikeMd(ta.value)) return;
        if (!ta.value.endsWith(suffix)) ta.value += suffix;
      }

      form.addEventListener("submit", onSubmit);
      formListeners.push({form, onSubmit});
      form.dataset.cmHooked = "1";
    }

    document.querySelectorAll(".devlog-detail__comment-form").forEach(attachFormHook);

    const style = document.createElement("style");
    style.id = "exterstellar-comment-markdown";
    style.textContent = `
      .devlog-comment__body h1,
      .devlog-comment__body h2,
      .devlog-comment__body h3 {
        font-weight: 700;
        line-height: 1.3;
        margin: 0.4em 0 0.15em;
      }
      .devlog-comment__body h1 {font-size: 1.25em;}
      .devlog-comment__body h2 {font-size: 1.1em;}
      .devlog-comment__body h3 {
        font-size: 1.05em;
        color: var(--color-space-text-muted);
      }
      .devlog-comment__body p {margin: 0.2em 0;}
      .devlog-comment__body ul,
      .devlog-comment__body ol {
        padding-left: 1.4em;
        margin: 0.2em 0;
      }
      .devlog-comment__body a {
        color: var(--color-space-accent);
        text-decoration: underline;
        text-underline-offset: 2px;
      }
      .devlog-comment__body code {
        font-family: monospace;
        font-size: 0.9em;
        background: var(--color-space-surface-faint);
        padding: 0.1em 0.3em;
        border-radius: 3px;
      }
    `;
    document.head.appendChild(style);

    const rendered = [];

    function renderBody(body) {
      if (body.dataset.cmDone) return;
      const raw = body.innerText.trim();
      if (!raw) return;
      body.dataset.cmOriginal = body.innerHTML;
      body.innerHTML = marked.parse(raw);
      body.dataset.cmDone = "1";
      rendered.push(body);
    }

    document.querySelectorAll(".devlog-comment__body").forEach(renderBody);

    const observer = new MutationObserver(mutations => {
      for (const {addedNodes} of mutations)
        for (const node of addedNodes)
          if (node instanceof Element) {
            if (node.matches(".devlog-comment__body")) renderBody(node);
            node.querySelectorAll(".devlog-comment__body").forEach(renderBody);
            if (node.matches(".devlog-detail__comment-form")) attachFormHook(node);
            node.querySelectorAll(".devlog-detail__comment-form").forEach(attachFormHook);
          }
    });
    observer.observe(document.documentElement, {childList: true, subtree: true});

    return function cleanup() {
      observer.disconnect();
      for (const body of rendered) {
        if (body.isConnected && body.dataset.cmOriginal) body.innerHTML = body.dataset.cmOriginal;
        delete body.dataset.cmOriginal;
        delete body.dataset.cmDone;
      }
      style.remove();
      for (const {form, onSubmit} of formListeners) {
        form.removeEventListener("submit", onSubmit);
        delete form.dataset.cmHooked;
      }
    };
  }
});