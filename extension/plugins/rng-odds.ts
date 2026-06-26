export {};
declare const Exterstellar: import("../types").ExterstellarAPI;

function pExactlyDDigits(d: number): number {
  let pReach = 1;
  for (let tails = 0; tails < d - 1; tails++) {
    pReach *= 4 / (5 + tails);
  }
  if (d === 10) return pReach;
  const pStop = 1 - 4 / (4 + d);
  return pReach  * pStop;
}

function pValueGivenDDigits(d: number, target: number): number {
  const total = Math.pow(10, d);
  const lo = 0;
  const hi = total - 1;
  const clampedTarget = Math.max(lo, Math.min(hi + 1, target));
  const countGte = Math.max(0, hi - clampedTarget + 1);
  return countGte / total;
}

function pAtLeast(target: number): number {
  if (target <= 0) return 1;
  if (target > 2147483647) return 0;

  let prob = 0;
  for (let d = 1; d <= 10; d++) {
    const pD = pExactlyDDigits(d);
    const pV = pValueGivenDDigits(d, target);
    prob += pD * pV;
  }
  return Math.min(1, Math.max(0, prob));
}

function pExact(target: number): number {
  return Math.max(0, pAtLeast(target) - pAtLeast(target + 1));
}

function fmtPct(p: number, decimals = 4): string {
  const pct = p * 100;
  if (pct === 0) return "0%";
  if (pct >= 0.01) return pct.toFixed(decimals < 2 ? 2 : decimals) + "%";
  return pct.toExponential(2) + "%";
}

function fmt1in(p: number): string {
  if (p <= 0) return "impossible";
  if (p >= 1) return "certain";
  const oneIn = Math.round(1 / p);
  return `1 in ${oneIn.toLocaleString()}`;
}

Exterstellar.register({
  id: "rng-odds",
  name: "RNG Odds",
  description: "Displays RNG probabilities on your and others numbers. Also displays GPU raffle chances (coming soon).",
  author: "Sabio",
  config: [
    {
      key: "showExact",
      label: "Shows how likely you are to exactly match this number if you were to reroll.",
      type: "checkbox",
      default: false,
    },
    {
      key: "showBoard",
      label: "Show odds on leaderboard for other people.",
      type: "checkbox",
      default: true,
    },
  ],

  start() {
    const cfg = Exterstellar.getConfig("rng-odds");
    const showEx = cfg.showExact === true || cfg.showExact === "true";
    const showBrd = cfg.showBoard !== false && cfg.showBoard !== "false";

    const style = document.createElement("style");
    style.id = "exterstellar-rng-odds";
    style.textContent = `
      .rng-odds {
        font-size: 11px;
        color: var(--color-space-text-muted);
        margin-top: 6px;
        padding: 6px 9px;
        background: var(--color-space-surface-faint);
        border-radius: 8px;
        border-left: 3px solid var(--color-space-accent, #cba6f7);
        line-height: 1.5;
        display: flex;
        flex-direction: column;
        gap: 1px;
      }

      .daily-roll-widget .rng-odds {margin-top: 5px;}
      .rng-hero .rng-odds {
        margin-top: 8px;
        font-size: 12px;
      }

      .rng-odds__row {
        display: flex;
        align-items: baseline;
        gap: 5px;
      }

      .rng-odds__label {
        font-weight: 700;
        font-size: 9px;
        text-transform: uppercase;
        letter-spacing: 0.07em;
        color: var(--color-space-text-muted);
        flex-shrink: 0;
      }

      .rng-odds__value {
        font-weight: 800;
        color: var(--color-space-text);
      }

      .rng-odds__aside {
        color: var(--color-space-text-muted);
        font-size: 10px;
        opacity: 0.75;
      }

      .rng-odds--cosmic .rng-odds__value {color: var(--color-space-accent);}
      .rng-odds--high .rng-odds__value {color: var(--color-brand-blue);}
      .rng-odds--mid .rng-odds__value {color: var(--color-space-text);}
      .rng-odds--low .rng-odds__value {color: var(--color-space-text-muted);}

      .rng-board__value,
      .rng-board__pedestal-value,
      .rng-board__alltime-value {
        display: inline-flex;
        align-items: baseline;
        gap: 5px;
        flex-wrap: wrap;
      }

      .rng-odds-chip {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        font-size: 10px;
        font-weight: 700;
        padding: 1px 5px;
        border-radius: 5px;
        background: var(--color-space-surface-faint);
        border: 1px solid var(--color-space-border);
        color: var(--color-space-text-muted);
        white-space: nowrap;
        line-height: 1.4;
        cursor: default;
        vertical-align: middle;
      }

      .rng-odds-chip__pct {
        color: var(--color-space-text);
        font-weight: 800;
      }

      .rng-odds-chip--cosmic .rng-odds-chip__pct {color: var(--color-space-accent);}
      .rng-odds-chip--high .rng-odds-chip__pct {color: var(--color-brand-blue);}
      .rng-odds-chip--mid .rng-odds-chip__pct {color: var(--color-space-text);}
      .rng-odds-chip--low .rng-odds-chip__pct {color: var(--color-space-text-muted);}

      .rng-board__pedestal .rng-odds-chip {
        font-size: 11px;
        padding: 2px 6px;
      }

      .rng-board__alltime .rng-odds-chip {
        font-size: 10px;
      }

      .rng-board__value {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        flex-wrap: wrap;
      }

      .rng-board__pedestal-value {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 3px;
      }

      .rng-board__alltime-value {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        flex-wrap: wrap;
      }
    `;
    document.head.appendChild(style);

    const qs = (sel: string, root: Element | Document = document) => root.querySelector<HTMLElement>(sel);

    function toneClass(value: number, prefix: string): string {
      if (value >= 1000000) return `${prefix}--cosmic`;
      if (value >= 10000) return `${prefix}--high`;
      if (value >= 100) return `${prefix}--mid`;
      return `${prefix}--low`;
    }

    function parseValue(el: HTMLElement): number {
      return parseInt(el.textContent?.replace(/[^0-9]/g, "") ?? "", 10);
    }

    function buildWidget(value: number): HTMLElement {
      const pGte = pAtLeast(value);
      const pEq = pExact(value);

      const widget = document.createElement("div");
      widget.className = `rng-odds ${toneClass(value, "rng-odds")}`;
      widget.setAttribute("aria-label", `RNG odds for ${value.toLocaleString()}`);

      const rowGte = document.createElement("div");
      rowGte.className = "rng-odds__row";
      rowGte.innerHTML = `
        <span class="rng-odds__label">Chance</span>
        <span class="rng-odds__value">${fmtPct(pGte)}</span>
        <span class="rng-odds__aside">(${fmt1in(pGte)})</span>
      `;
      widget.appendChild(rowGte);

      if (showEx) {
        const rowEq = document.createElement("div");
        rowEq.className = "rng-odds__row";
        rowEq.innerHTML = `
          <span class="rng-odds__label">Exact match</span>
          <span class="rng-odds__value">${fmtPct(pEq, 6)}</span>
          <span class="rng-odds__aside">(${fmt1in(pEq)})</span>
        `;
        widget.appendChild(rowEq);
      }

      return widget;
    }

    function inject(container: HTMLElement): void {
      const raw = container.dataset["dailyRollValueValue"];
      if (!raw) return;
      const value = parseInt(raw, 10);
      if (isNaN(value)) return;

      container.querySelector(".rng-odds")?.remove();

      const widget = buildWidget(value);
      const flavor = qs(".daily-roll-widget__flavor, .rng-hero__flavor", container);
      const number = qs("[data-daily-roll-target='number']", container);
      const anchor = flavor ?? number;
      anchor ? anchor.after(widget) : container.appendChild(widget);
    }

    function injectAll(): void {
      document.querySelectorAll<HTMLElement>("#daily-roll-widget[data-daily-roll-value-value], #rng-hero[data-daily-roll-value-value]").forEach(inject);
    }
    
    function buildChip(value: number): HTMLElement {
      const pGte = pAtLeast(value);
      const chip = document.createElement("span");
      chip.className = `rng-odds-chip ${toneClass(value, "rng-odds-chip")}`;
      chip.dataset["rngOddsChip"] = "1";
      chip.title = `${fmt1in(pGte)} chance of rolling this or higher`;
      chip.innerHTML = `<span class="rng-odds-chip__pct">${fmtPct(pGte)}</span>`;
      return chip;
    }

    function attachChip(valueEl: HTMLElement): void {
      if (valueEl.querySelector("[data-rng-odds-chip]")) return;
      const value = parseValue(valueEl);
      if (isNaN(value)) return;
      valueEl.appendChild(buildChip(value));
    }

    function injectBoard(): void {
      if (!showBrd) return;
      document.querySelectorAll<HTMLElement>(".rng-board__pedestal-value").forEach(attachChip);
      document.querySelectorAll<HTMLElement>(".rng-board__row .rng-board__value").forEach(attachChip);
      document.querySelectorAll<HTMLElement>(".rng-board__alltime-value").forEach(attachChip);
    }

    const observer = new MutationObserver(muts => {
      let boardDirty = false;
      for (const m of muts) {
        if (m.type === "attributes" && m.attributeName === "data-daily-roll-value-value") {
          inject(m.target as HTMLElement);
        }
        if (m.type === "childList") {
          (m.addedNodes as NodeListOf<Node>).forEach(node => {
            if (!(node instanceof HTMLElement)) return;
            if (node.matches?.("[data-daily-roll-value-value]")) inject(node);
            node.querySelectorAll?.<HTMLElement>("[data-daily-roll-value-value]").forEach(inject);
            if (node.matches?.(".rng-board__row, .rng-board__pedestal, .rng-board__alltime, .rng-board__list, .rng-board__podium")) boardDirty = true;
            if (node.querySelector?.(".rng-board__row, .rng-board__pedestal-value")) boardDirty = true;
          });
        }
      }
      if (boardDirty) injectBoard();
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-daily-roll-value-value"],
    });

    const onTurbo = () => {
      injectAll();
      injectBoard();
    };
    document.addEventListener("turbo:load", onTurbo);
    document.addEventListener("turbo:render", onTurbo);

    injectAll();
    injectBoard();

    return function cleanup() {
      observer.disconnect();
      document.removeEventListener("turbo:load", onTurbo);
      document.removeEventListener("turbo:render", onTurbo);
      document.querySelectorAll(".rng-odds, [data-rng-odds-chip]").forEach(el => el.remove());
      style.remove();
    };
  },
});