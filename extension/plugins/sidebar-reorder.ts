export {};
declare const Exterstellar: import("../types").ExterstellarAPI;

Exterstellar.register({
  id: "sidebar-reorder",
  name: "Sidebar Reorder",
  description: "Drag and drop sidebar items into any order you want.",
  author: "Sabio",

  start() {
    const style = document.createElement("style");
    style.id = "exterstellar-sidebar-reorder";
    style.textContent = `
      .sidebar__nav-item[draggable] {
        cursor: grab !important;
        user-select: none;
      }

      .sidebar__nav-item[draggable]:active {
        cursor: grabbing !important;
      }

      .sidebar__nav-item.xtr-dragging {
        opacity: 0.35;
      }

      .xtr-dragging-active .sidebar__nav-item {
        position: relative;
      }

      .xtr-dragging-active .sidebar__nav-item.xtr-drop-before::before,
      .xtr-dragging-active .sidebar__nav-item.xtr-drop-after::after {
        content: "";
        position: absolute;
        left: 10px;
        right: 10px;
        height: 2px;
        border-radius: 1px;
        background: var(--color-space-accent);
        pointer-events: none;
      }

      .xtr-dragging-active .sidebar__nav-item.xtr-drop-before::before {
        top: -1px;
      }

      .xtr-dragging-active .sidebar__nav-item.xtr-drop-after::after {
        bottom: -1px;
      }
    `;
    document.head.appendChild(style);

    let savedOrder: string[] = [];
    let dragSrc: HTMLElement | null = null;

    const slugOf = (li: Element): string | null => (li.querySelector("[data-slug]") as HTMLElement | null)?.dataset["slug"] ?? null;

    function applyOrder(list: Element): void {
      if (!savedOrder.length) return;
      const items = [...list.querySelectorAll(":scope > .sidebar__nav-item")];
      const bySlug: Record<string, Element> = {};
      items.forEach(li => {
        const s = slugOf(li);
        if (s) bySlug[s] = li;
      });
      const ordered = savedOrder.map(s => bySlug[s]).filter((x): x is Element => x !== undefined);
      const knownSet = new Set(ordered);
      const extras = items.filter(li => !knownSet.has(li));
      [...ordered, ...extras].forEach(li => list.appendChild(li));
    }

    function attachDrag(list: Element): void {
      [...list.querySelectorAll<HTMLElement>(".sidebar__nav-item")].forEach(li => {
        li.removeAttribute("draggable");
      });

      [...list.querySelectorAll<HTMLElement>(".sidebar__nav-item")].forEach(li => {
        li.setAttribute("draggable", "true");
        li.addEventListener("dragstart", onDragStart);
        li.addEventListener("dragover", onDragOver);
        li.addEventListener("dragleave", onDragLeave);
        li.addEventListener("drop", onDrop);
        li.addEventListener("dragend", onDragEnd);
      });
    }

    function onDragStart(e: DragEvent): void {
      const el = e.currentTarget as HTMLElement;
      dragSrc = el;
      el.classList.add("xtr-dragging");
      el.parentElement?.classList.add("xtr-dragging-active");
      e.dataTransfer?.setData("text/plain", slugOf(el) ?? "");
    }

    const onDragOver = function(e: DragEvent): void {
      e.preventDefault();
      e.dataTransfer!.dropEffect = "move";
      const el = e.currentTarget as HTMLElement;
      if (el === dragSrc) return;
      const rect = el.getBoundingClientRect();
      el.classList.remove("xtr-drop-before", "xtr-drop-after");
      el.classList.add(e.clientY < rect.top + rect.height / 2 ? "xtr-drop-before" : "xtr-drop-after");
    };

    const onDragLeave = function(e: Event): void {
      (e.currentTarget as HTMLElement).classList.remove("xtr-drop-before", "xtr-drop-after");
    };

    function onDrop(e: DragEvent): void {
      e.preventDefault();
      const el = e.currentTarget as HTMLElement;
      const before = el.classList.contains("xtr-drop-before");
      el.classList.remove("xtr-drop-before", "xtr-drop-after");
      if (!dragSrc || dragSrc === el) return;
      const list = el.parentElement;
      if (!list) return;
      if (before) list.insertBefore(dragSrc, el);
      else list.insertBefore(dragSrc, el.nextSibling);
      persistOrder(list);
    }

    function onDragEnd(e: Event): void {
      const el = e.currentTarget as HTMLElement;
      el.classList.remove("xtr-dragging");
      el.parentElement?.classList.remove("xtr-dragging-active");
      document.querySelectorAll(".xtr-drop-before, .xtr-drop-after").forEach(x => {
        x.classList.remove("xtr-drop-before", "xtr-drop-after");
      });
      dragSrc = null;
    }

    function persistOrder(list: Element): void {
      const slugs = [...list.querySelectorAll(":scope > .sidebar__nav-item")].map(slugOf).filter((s): s is string => s !== null);
      savedOrder = slugs;
      chrome.storage.sync.get({["sidebarOrder"]: slugs}, () => {
        if (chrome.runtime.lastError) {
          console.warn("[Exterstellar | sidebar-reorder] Couldnt save order:", chrome.runtime.lastError);
        }
      });
    }

    function init(list: Element): void {
      applyOrder(list);
      attachDrag(list);
    }

    chrome.storage.sync.get("sidebarOrder", data => {
      savedOrder = data["sidebarOrder"] ?? [];
      const list = document.querySelector<HTMLElement>(".sidebar__nav-list");
      if (list) init(list);
    });

    let pending: ReturnType<typeof setTimeout> | undefined;
    const observer = new MutationObserver(() => {
      const list = document.querySelector<HTMLElement>(".sidebar__nav-list");
      if (!list || list.dataset.xtrReorderBound) return;
      list.dataset.xtrReorderBound = "1";
      clearTimeout(pending);
      pending = setTimeout(() => init(list), 80);
    });
    observer.observe(document.documentElement, {childList: true, subtree: true});

    return function cleanup() {
      clearTimeout(pending);
      observer.disconnect();
      style.remove();
      document.querySelectorAll<HTMLElement>(".sidebar__nav-item[draggable]").forEach(li => {
        li.removeAttribute("draggable");
        li.removeEventListener("dragstart", onDragStart);
        li.removeEventListener("dragover", onDragOver);
        li.removeEventListener("dragleave", onDragLeave);
        li.removeEventListener("drop", onDrop);
        li.removeEventListener("dragend", onDragEnd);
      });
      const list = document.querySelector<HTMLElement>(".sidebar__nav-list");
      if (list) delete list.dataset.xtrReorderBound;
    };
  }
});