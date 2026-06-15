export {};
declare const Exterstellar: import("../types").ExterstellarAPI;

Exterstellar.register({
  id: "persistent-devlogs",
  name: "Persistent Devlogs",
  description: "Saves what you're typing in the devlogging area, comments, and quote reposts so refreshing the page doesn't wipe it out.",
  author: "Sabio",
  config: [
    {
      key: "saveComments",
      label: "Also save comments & quote reposts.",
      type: "checkbox",
      default: true
    }
  ],

  start() {
    const cfg = Exterstellar.getConfig("persistent-devlogs");
    const saveComments = cfg.saveComments !== false && cfg.saveComments !== "false";

    const cleanups = new Map<HTMLTextAreaElement, () => void>();

    function isCommentLike(ta: HTMLTextAreaElement): boolean {
      return ta.classList.contains("devlog-detail__comment-textarea") || ta.classList.contains("comment-modal__textarea") || ta.name === "post_repost[body]";
    }

    function draftKey(ta: HTMLTextAreaElement): string | null {
      const form = ta.closest("form");
      if (!form) return null;
      if (!saveComments && isCommentLike(ta)) return null;

      let action = form.getAttribute("action") || "";
      try {
        action = new URL(action, location.href).pathname;
      } catch (_) {}

      const name = ta.getAttribute("name") || "body";
      return `exterstellarDraft::${action}::${name}`;
    }

    function clearDraft(key: string): void {
      chrome.storage.local.remove(key);
    }

    function save(ta: HTMLTextAreaElement, key: string): void {
      if (ta.value) {
        chrome.storage.local.set({[key]: ta.value});
      } else {
        clearDraft(key);
      }
    }

    function attach(ta: HTMLTextAreaElement): void {
      if (cleanups.has(ta)) return;

      const key = draftKey(ta);
      if (!key) return;

      chrome.storage.local.get(key, items => {
        const saved = items[key];
        if (typeof saved === "string" && saved && !ta.value) {
          ta.value = saved;
          ta.dispatchEvent(new Event("input", {bubbles: true}));
        }
      });

      let timer: number | undefined;
      const onInput = () => {
        if (timer) clearTimeout(timer);
        timer = window.setTimeout(() => save(ta, key), 500);
      };

      const onSubmitEnd = (e: Event) => {
        const detail = (e as CustomEvent).detail as {success?: boolean} | undefined;
        if (detail?.success) clearDraft(key);
      };

      ta.addEventListener("input", onInput);

      const form = ta.closest("form");
      form?.addEventListener("turbo:submit-end", onSubmitEnd);

      cleanups.set(ta, () => {
        if (timer) clearTimeout(timer);
        ta.removeEventListener("input", onInput);
        form?.removeEventListener("turbo:submit-end", onSubmitEnd);
      });
    }

    function scan(root: ParentNode): void {
      root.querySelectorAll<HTMLTextAreaElement>(".feed-composer__textarea, .devlog-detail__comment-textarea, .comment-modal__textarea").forEach(attach);
    }

    scan(document);
    document.addEventListener("DOMContentLoaded", () => scan(document), {once: true});

    const observer = new MutationObserver(mutations => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (!(node instanceof Element)) continue;
          if (node.matches?.(".feed-composer__textarea, .devlog-detail__comment-textarea, .comment-modal__textarea")) attach(node as HTMLTextAreaElement);
          scan(node);
        }
      }
    });

    observer.observe(document.documentElement, {childList: true, subtree: true});

    return function cleanup() {
      observer.disconnect();
      for (const fn of cleanups.values()) fn();
      cleanups.clear();
    };
  }
});