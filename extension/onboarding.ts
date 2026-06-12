interface TourStep {
  target: string | null;
  title: string;
  body: string;
  cardPos: "top" | "bottom" | "right" | "left";
  activate?: () => void;
  deactivate?: () => void;
}

let steps: TourStep[];
let current = 0;

let backdrop: HTMLDivElement | null = null;
let spotlight: HTMLDivElement | null = null;
let card: HTMLDivElement | null = null;
let nudgeBanner: HTMLDivElement | null = null;

export function maybeShowTour(): void {
  chrome.storage.sync.get(["onboardingDone", "stardanceVisited"], data => {
    const tourDone = !!data["onboardingDone"];
    const siteVisited = !!data["stardanceVisited"];

    if (!siteVisited) {
      showNudgeBanner();
      return;
    }

    if (!tourDone) {
      requestAnimationFrame(() => startTour());
    }
  });
}

function showNudgeBanner(): void {
  if (nudgeBanner) return;

  nudgeBanner = document.createElement("div");
  nudgeBanner.className = "nudge-banner";
  nudgeBanner.innerHTML = `
    <div class="nudge-banner__icon"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-triangle-alert-icon lucide-triangle-alert"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg></div>
    <div class="nudge-banner__text">
      <strong>One more step!</strong>
      Open Stardance now to finish setup. Exterstellar boots on page load and will be ready to configure here once you do.
    </div>
  `;

  const listEl = document.getElementById("list");
  listEl?.before(nudgeBanner);

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && changes["stardanceVisited"]?.newValue) {
      nudgeBanner?.remove();
      nudgeBanner = null;
      chrome.storage.local.get("pluginManifest", d => {
        if (d["pluginManifest"]?.length) requestAnimationFrame(() => startTour());
      });
    }
  });
}

function startTour(): void {
  steps = buildSteps();
  current = 0;

  document.body.style.overflow = "hidden";

  backdrop = document.createElement("div");
  backdrop.className = "tour-backdrop";

  spotlight = document.createElement("div");
  spotlight.className = "tour-spotlight";

  card = document.createElement("div");
  card.className = "tour-card";

  backdrop.appendChild(spotlight);
  backdrop.appendChild(card);
  document.body.appendChild(backdrop);
  
  showStep(0);
}

function showStep(idx: number): void {
  if (!card || !spotlight || !backdrop) return;
  const step = steps[idx];
  if (!step) {
    endTour();
    return;
  }

  step.activate?.();

  setTimeout(() => {
    positionSpotlight(step.target);
    renderCard(step, idx);
  }, step.activate ? 80 : 0);
}

function positionSpotlight(selector: string | null): void {
  if (!spotlight) return;
  if (!selector) {
    Object.assign(spotlight.style, {top: "50%", left: "50%", width: "0", height: "0", boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.72)"});
    return;
  }

  const el = document.querySelector<HTMLElement>(selector);
  if (!el) {
    positionSpotlight(null);
    return;
  }

  const r = el.getBoundingClientRect();
  Object.assign(spotlight.style, {
    top: `${r.top - 6}px`,
    left: `${r.left - 6}px`,
    width: `${r.width + 12}px`,
    height: `${r.height + 12}px`,
  });
}

function renderCard(step: TourStep, idx: number): void {
  if (!card || !spotlight) return;

  card.innerHTML = `
    <div class="tour-card__step">Step ${idx + 1} of ${steps.length}</div>
    <div class="tour-card__title">${step.title}</div>
    <div class="tour-card__body">${step.body}</div>
    <div class="tour-card__actions">
      <div class="tour-dots">${buildDots(idx)}</div>
      <div class="tour-card__btns">
        ${idx > 0 ? `<button class="tour-btn" id="tour-back">Back</button>`: ""}
        ${idx === steps.length - 1 ? `<button class="tour-btn tour-btn--primary" id="tour-finish">Done</button>` : `<button class="tour-btn tour-btn--primary" id="tour-next">Next</button>`}
        <button class="tour-btn" id="tour-skip">Skip</button>
      </div>
    </div>
  `;

  requestAnimationFrame(() => positionCard(step));

  card.querySelector("#tour-next")?.addEventListener("click", () => advance(idx));
  card.querySelector("#tour-back")?.addEventListener("click", () => goBack(idx));
  card.querySelector("#tour-finish")?.addEventListener("click", endTour);
  card.querySelector("#tour-skip")?.addEventListener("click", endTour);
}

function buildDots(activeIdx: number): string {
  return steps.map((_, i) => `<div class="tour-dot${i === activeIdx ? " tour-dot--active" : ""}"></div>`).join("");
}

function positionCard(step: TourStep): void {
  if (!card) return;

  const vw = document.documentElement.clientWidth;
  const vh = document.documentElement.clientHeight;

  let sr: {top: number; bottom: number; left: number; width: number; height: number};
  const el = step.target ? document.querySelector<HTMLElement>(step.target) : null;
  if (el) {
    const r = el.getBoundingClientRect();
    sr = {
      top: r.top - 6,
      bottom: r.bottom + 6,
      left: r.left - 6,
      width: r.width + 12,
      height: r.height + 12,
    };
  } else {
    sr = {top: vh / 2, bottom: vh / 2, left: vw / 2, width: 0, height: 0};
  }

  const cr = card.getBoundingClientRect();
  const cardH = cr.height || card.offsetHeight;
  const cardW = cr.width || card.offsetWidth;

  const centeredLeft = sr.left + sr.width / 2 - cardW / 2;
  const left = Math.max(4, Math.min(centeredLeft, vw - cardW - 4));

  const spaceAbove = sr.top - 8;
  const spaceBelow = vh - sr.bottom - 8;

  let top: number;
  if (step.cardPos === "top" && spaceAbove >= cardH) {
    top = sr.top - cardH - 8;
  } else if (step.cardPos === "bottom" || spaceBelow >= cardH) {
    top = sr.bottom + 8;
  } else {
    top = sr.bottom + 8;
  }

  top = Math.min(top, vh - cardH - 8);
  top = Math.max(4, top);

  card.setAttribute("data-arrow", top >= sr.bottom ? "bottom" : "top");

  card.style.top = `${top}px`;
  card.style.left = `${left}px`;

  const targetCenterX = sr.left + sr.width / 2;
  const arrowLeft = Math.max(8, Math.min(targetCenterX - left - 4, cardW - 16));
  card.style.setProperty("--arrow-left", `${arrowLeft}px`);
}

function advance(from: number): void {
  steps[from]?.deactivate?.();
  current = from + 1;
  showStep(current);
}

function goBack(from: number): void {
  steps[from]?.deactivate?.();
  current = from - 1;
  showStep(current);
}

function endTour(): void {
  steps[current]?.deactivate?.();
  backdrop?.remove();
  backdrop = null;
  spotlight = null;
  card = null;
  document.body.style.overflow = "";
  chrome.storage.sync.set({["onboardingDone"]: true});
}

function buildSteps(): TourStep[] {
  return [
    {
      target: null,
      title: "Welcome to Exterstellar!",
      body: "This quick tour walks you through how to use Exterstellar's plugin manager system. It only takes around 30 seconds- or skip if you already understand systems like this!",
      cardPos: "bottom",
    },
    {
      target: "#list",
      title: "Plugin list",
      body: "Every plugin available appears here. Use the toggle on the right to enable or disable each one. Changes should apply to pages instantly, but you may need to refresh the page.",
      cardPos: "bottom",
    },
    {
      target: ".row-wrap:first-child .toggle",
      title: "Enable / disable",
      body: "Flipping a toggle to enable or disable the plugin, plugin configuration or manager settings of your choice.",
      cardPos: "top",
      activate() {
        document.querySelector<HTMLElement>(".row-wrap:first-child")?.scrollIntoView({block: "nearest"});
      },
    },
    {
      target: ".row-wrap:first-child .gear-btn",
      title: "Plugin settings",
      body: "Plugins have their own configurations you can choose from to suit your liking. Click the gear to view their settings.",
      cardPos: "bottom",
      activate() {
        const gearBtn = document.querySelector<HTMLButtonElement>(".row-wrap:first-child .gear-btn");
        if (gearBtn && !gearBtn.classList.contains("gear-btn--open")) gearBtn.click();
      },
      deactivate() {
        const gearBtn = document.querySelector<HTMLButtonElement>(".row-wrap:first-child .gear-btn");
        if (gearBtn?.classList.contains("gear-btn--open")) gearBtn.click();
      },
    },
    {
      target: "#mgr-btn",
      title: "Manager settings",
      body: "The cog in the header opens up to configurations that adjusts the popup itself. These are seperate from plugin configs and don't affect the Stardance platform.",
      cardPos: "bottom",
      activate() {
        const btn = document.getElementById("mgr-btn");
        if (btn && !btn.classList.contains("gear-btn--open")) btn.click();
      },
      deactivate() {
        const btn = document.getElementById("mgr-btn");
        if (btn?.classList.contains("gear-btn--open")) btn.click();
      },
    },
    {
      target: ".footer-actions",
      title: "Import / Export",
      body: "Back up your entire config (which includes plugin states, all settings, manager preferences) to a JSON file. You should use this when moving browsers or if you have multiple devices.",
      cardPos: "top",
    },
    {
      target: "null",
      title: "Thanks for onboarding!",
      body: "Toggle plugins on, tweak their settings and select your manager preferences after you finish onboarding. No plugins are on by default.",
      cardPos: "bottom",
    },
  ];
}

export function showPopupNudge(): void {
  const nudge = document.createElement("div");
  nudge.id = "exterstellar-popup-nudge";
  nudge.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-info-icon lucide-info"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
    <span>
      <strong>Exterstellar is installed!</strong>
      Open your <strong>Extensions menu</strong> (usually on the top right) and click on Exterstellar to finish setup.
    </span>
    <button id="exterstellar-nudge-dismiss" title="Dismiss">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-x"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
    </button>
  `;

  const s = document.createElement("style");
  s.textContent = `
    #exterstellar-popup-nudge {
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 999999;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 14px;
      background: #18181b;
      color: #f4f4f5;
      border: 1px solid #a3a3a3;
      border-radius: 10px;
      font-family: "Exo 2", sans-serif;
      font-size: 13px;
      line-height: 1.45;
      max-width: 340px;
    }

    #exterstellar-popup-nudge strong {color: #fff;}

    #exterstellar-popup-nudge > svg {
      width: 24px;
      height: 24px;
      flex-shrink: 0;
    }

    #exterstellar-nudge-dismiss {
      background: none;
      border: none;
      color: #a1a1aa;
      cursor: pointer;
      flex-shrink: 0;
      padding: 0 2px;
      line-height: 1;
    }

    #exterstellar-nudge-dismiss:hover {color: #f4f4f5;}
  `;
  document.head.appendChild(s);
  document.body.appendChild(nudge);

  nudge.querySelector("#exterstellar-nudge-dismiss")?.addEventListener("click", () => nudge.remove());

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && changes["onboardingDone"]?.newValue) nudge.remove();
  });
}