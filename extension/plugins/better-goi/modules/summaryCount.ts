function getSummaryCountEl(): HTMLElement | null {
  return document.querySelector<HTMLElement>(".ysws-queue__summary-count");
}

function readCount(el: HTMLElement): number | null {
  const n = parseInt(el.textContent?.trim() ?? "", 10);
  return Number.isNaN(n) ? null : n;
}

function ensureBaseline(el: HTMLElement): number | null {
  if (el.dataset.exterstellarCountAdjusted === "1") {
    const base = Number(el.dataset.exterstellarCountBaseline);
    return Number.isNaN(base) ? readCount(el) : base;
  }
  const current = readCount(el);
  if (current === null) return null;
  el.dataset.exterstellarCountBaseline = String(current);
  el.dataset.exterstellarCountAdjusted = "1";
  return current;
}

export function decrementSummaryCount(n = 1): void {
  if (n <= 0) return;
  const el = getSummaryCountEl();
  if (!el) return;
  if (ensureBaseline(el) === null) return;
  const current = readCount(el);
  if (current === null) return;
  el.textContent = String(Math.max(0, current - n));
}

export function incrementSummaryCount(n = 1): void {
  if (n <= 0) return;
  const el = getSummaryCountEl();
  if (!el) return;
  if (ensureBaseline(el) === null) return;
  const current = readCount(el);
  if (current === null) return;
  const baseline = Number(el.dataset.exterstellarCountBaseline);
  const next = current + n;
  el.textContent = String(
    Number.isNaN(baseline) ? next : Math.min(baseline, next),
  );
}

export function resetSummaryCount(): void {
  const el = getSummaryCountEl();
  if (!el) return;
  const baseline = Number(el.dataset.exterstellarCountBaseline);
  if (el.dataset.exterstellarCountAdjusted === "1" && !Number.isNaN(baseline)) {
    el.textContent = String(baseline);
  }
  delete el.dataset.exterstellarCountAdjusted;
  delete el.dataset.exterstellarCountBaseline;
}
