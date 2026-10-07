export {};
declare const Exterstellar: import("../types").ExterstellarAPI;

Exterstellar.register({
  id: "adblock",
  name: "Adblock",
  description: "Hides YSWS promos / ads in the discover rail.",
  author: "Exterstellar",

  config: [
    {
      key: "aggressive",
      label: "Aggressively hide anything promo-like (may hide more)",
      type: "checkbox",
      default: false,
    },
  ],

  start() {
    const cfg = Exterstellar.getConfig("adblock");
    const aggressive = cfg.aggressive === true || cfg.aggressive === "true";

    const style = document.createElement("style");
    style.id = "exterstellar-adblock";
    style.textContent = `
      section[class*="promo" i],
      section[class*="portal" i] { display: none !important; }
      .xtr-ad-hidden { display: none !important; }
    `;
    document.head.appendChild(style);

    const promoSegmentRe = /(^|[-_])(promo|promos|portal|portals)([-_]|$)/i;

    function hasPromoSegment(el: Element): boolean {
      const className = (el as HTMLElement).className;
      const classes: string[] =
        typeof className === "string"
          ? className.split(/\s+/)
          : Array.from((el as HTMLElement).classList ?? []);
      return classes.some((c) => promoSegmentRe.test(c));
    }

    function isSafeLeaf(el: Element): boolean {
      if (el.matches("main, aside, turbo-frame, .app-layout, #home_feed, .feed-shelf")) return false;
      if (el.querySelector("article, main, aside, turbo-frame#home_feed, .feed-post-card")) return false;
      return true;
    }

    function cardFromLink(link: Element): HTMLElement | null {
      const sec = link.closest(
        'section[class*="promo" i], section[class*="portal" i]'
      );
      if (sec instanceof HTMLElement && isSafeLeaf(sec)) return sec;
      const div = link.closest(
        'div[class*="promo" i], div[class*="portal" i]'
      );
      if (div instanceof HTMLElement && isSafeLeaf(div)) return div;
      const fallback = link.closest("section");
      if (
        fallback instanceof HTMLElement &&
        (hasPromoSegment(fallback) || /ysws/i.test(fallback.getAttribute("aria-label") ?? "")) &&
        isSafeLeaf(fallback)
      ) {
        return fallback;
      }
      return null;
    }

    function hide(el: Element): void {
      (el as HTMLElement).classList.add("xtr-ad-hidden");
    }

    function checkOne(el: Element): void {
      if (el.classList.contains("xtr-ad-hidden")) return;
      if (el.matches('a[href^="/promos/"], a[href*="utm_medium=discover" i], a[href*="utm_source=stardance" i]')) {
        const card = cardFromLink(el);
        if (card) {
          hide(card);
          return;
        }
      }
      if (el.matches('section[class*="promo" i], section[class*="portal" i]')) {
        if (hasPromoSegment(el) && isSafeLeaf(el)) {
          hide(el);
          return;
        }
      }
      if (el.tagName === "SECTION" && el.hasAttribute("aria-label")) {
        if (
          /ysws/i.test(el.getAttribute("aria-label") ?? "") &&
          (hasPromoSegment(el) || el.querySelector("a[href]")) &&
          isSafeLeaf(el)
        ) {
          hide(el);
        }
      }
    }

    function sweep(root: ParentNode | Element): void {
      if (root instanceof Element) {
        if (root.closest("article, dialog")) return;
        checkOne(root);
      }
      const scope: ParentNode =
        root instanceof Element ? root : (root as ParentNode);
      scope.querySelectorAll?.(
        'a[href^="/promos/"], a[href*="utm_medium=discover" i], a[href*="utm_source=stardance" i], section[class*="promo" i], section[class*="portal" i], section[aria-label]'
      ).forEach((el) => {
        if (el.closest("article, dialog")) return;
        checkOne(el);
      });

      if (aggressive) {
        scope.querySelectorAll?.(".discover-rail section, .discover-rail div[class]").forEach((el) => {
          if (hasPromoSegment(el) && isSafeLeaf(el)) hide(el);
        });
      }
    }

    sweep(document);

    let scheduled = false;
    const observer = new MutationObserver((mutations) => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        for (const m of mutations) {
          if (m.type === "attributes" && m.target instanceof Element) {
            sweep(m.target);
            continue;
          }
          m.addedNodes.forEach((node) => {
            if (!(node instanceof Element)) return;
            sweep(node);
          });
        }
      });
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "aria-label", "href"],
    });

    return function cleanup() {
      observer.disconnect();
      style.remove();
      document.querySelectorAll(".xtr-ad-hidden").forEach((el) => el.classList.remove("xtr-ad-hidden"));
    };
  },
});
