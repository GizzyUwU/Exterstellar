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

    let savedOrder = [];
    let dragSrc = null;

    const slugOf = li => li.querySelector("[data-slug]")?.dataset.slug ?? null;

    function applyOrder(list) {
      if (!savedOrder.length) return;
      const items = [...list.querySelectorAll(":scope > .sidebar__nav-item")];
      const bySlug = {};
      items.forEach(li => {
        const s = slugOf(li);
        if (s) bySlug[s] = li;
      });
      const ordered = savedOrder.map(s => bySlug[s]).filter(Boolean);
      const knownSet = new Set(ordered);
      const extras = items.filter(li => !knownSet.has(li));
      [...ordered, ...extras].forEach(li => list.appendChild(li));
    }

    function attachDrag(list) {
      [...list.querySelectorAll(".sidebar__nav-item")].forEach(li => {
        li.removeAttribute("draggable");
      });

      [...list.querySelectorAll(".sidebar__nav-item")].forEach(li => {
        li.setAttribute("draggable", "true");
        li.addEventListener("dragstart", onDragStart);
        li.addEventListener("dragover", onDragOver);
        li.addEventListener("dragleave", onDragLeave);
        li.addEventListener("drop", onDrop);
        li.addEventListener("dragend", onDragEnd);
      });
    }

    function onDragStart(e) {
      dragSrc = this;
      this.classList.add("xtr-dragging");
      this.parentElement.classList.add("xtr-dragging-active");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", slugOf(this) ?? "");
    }

    const onDragOver = function(e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (this === dragSrc) return;

      const rect = this.getBoundingClientRect();
      this.classList.remove("xtr-drop-before", "xtr-drop-after");
      this.classList.add(e.clientY < rect.top + rect.height / 2 ? "xtr-drop-before" : "xtr-drop-after");
    };

    const onDragLeave = function() {
      this.classList.remove("xtr-drop-before", "xtr-drop-after");
    };

    function onDrop(e) {
      e.preventDefault();
      const before = this.classList.contains("xtr-drop-before");
      this.classList.remove("xtr-drop-before", "xtr-drop-after");
      if (!dragSrc || dragSrc === this) return;

      const list = this.parentElement;
      if (before) list.insertBefore(dragSrc, this);
      else list.insertBefore(dragSrc, this.nextSibling);

      persistOrder(list);
    }

    function onDragEnd() {
      this.classList.remove("xtr-dragging");
      this.parentElement?.classList.remove("xtr-dragging-active");
      document.querySelectorAll(".xtr-drop-before, .xtr-drop-after").forEach(el => {
        el.classList.remove("xtr-drop-before", "xtr-drop-after");
      });
      dragSrc = null;
    }

    function persistOrder(list) {
      const slugs = [...list.querySelectorAll(":scope > .sidebar__nav-item")].map(slugOf).filter(Boolean);
      savedOrder = slugs;
      chrome.storage.sync.get({["sidebarOrder"]: slugs}, () => {
        if (chrome.runtime.lastError) {
          console.warn("[Exterstellar | sidebar-reorder] Couldnt save order:", chrome.runtime.lastError);
        }
      });
    }

    function init(list) {
      applyOrder(list);
      attachDrag(list);
    }

    chrome.storage.sync.get("sidebarOrder", data => {
      savedOrder = data["sidebarOrder"] ?? [];
      const list = document.querySelector(".sidebar__nav-list");
      if (list) init(list);
    });

    let pending = null;
    const observer = new MutationObserver(() => {
      const list = document.querySelector(".sidebar__nav-list");
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
      document.querySelectorAll(".sidebar__nav-item[draggable]").forEach(li => {
        li.removeAttribute("draggable");
        li.removeAttribute("dragstart", onDragStart);
        li.removeAttribute("dragover", onDragOver);
        li.removeAttribute("dragleave", onDragLeave);
        li.removeAttribute("drop", onDrop);
        li.removeAttribute("dragend", onDragEnd);
      });
      const list = document.querySelector(".sidebar__nav-list");
      if (list) delete list.dataset.xtrReorderBound;
    };
  }
});