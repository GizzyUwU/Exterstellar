Exterstellar.register({
  id: "custom-font",
  name: "Custom Font",
  description: "Apply a custom font across Stardance!",
  author: "Sabio",
  config: [
    {
      key: "fontName",
      label: "Font Name",
      type: "text",
      default: "Exo 2",
      placeholder: "The name of the font"
    },
    {
      key: "source",
      label: "Load from",
      type: "select",
      options: ["Google Fonts", "System Fonts"],
      default: "Google Fonts"
    }
  ],

  start() {
    const cfg = Exterstellar.getConfig("custom-font");
    const fontName = cfg.fontName?.trim() || "Exo 2";
    const useGFonts = cfg.source !== "System Fonts";

    let linkEl = null;
    if (useGFonts) {
      linkEl = document.createElement("link");
      linkEl.rel = "stylesheet";
      linkEl.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontName)}:wght@400;500;600;700&display=swap`;
      document.head.appendChild(linkEl);
    }

    const style = document.createElement("style");
    style.id = "exterstellar-custom-font";
    style.textContent = `
      *, *::before, *::after {
        font-family: "${fontName}", sans-serif !important;
      }
    `;
    document.head.appendChild(style);

    return function cleanup() {
      style.remove();
      linkEl?.remove();
    };
  }
});