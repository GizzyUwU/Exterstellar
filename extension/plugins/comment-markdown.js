import {marked} from "marked";

Exterstellar.register({
  id: "comment-markdown",
  name: "Comment Markdown",
  description: "Renders markdown in comments.",
  author: "Sabio",

  start() {
    marked.use({breaks: true});

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
    };
  }
});