Exterstellar.register({
  id: "scrollbar",
  name: "Custom Scrollbar",
  description: "Styles all scrollbars.",
  author: "Sabio",
  config: [
    {
      key: "color",
      label: "Color",
      type: "select",
      options: [
        {value: "--color-space-accent", label: "Lavender"},
        {value: "--color-brand-lilac", label: "Lilac"},
        {value: "--color-brand-mint", label: "Toothpaste"},
        {value: "--color-brand-blue", label: "Cyan"},
        {value: "--color-brand-salmon", label: "Salmon"},
        {value: "--color-brand-yellow", label: "Yellow"},
        {value: "--color-brand-peach", label: "Pastel Orange"},
        {value: "--color-red-450", label: "Pastel Red"},
        {value: "--color-green-450", label: "Leafy Green"},
        {value: "--color-blue-300", label: "Ocean Cyan"},
      ],
      default: "--color-space-accent"
    }
  ],
  start() {
    const cfg = Exterstellar.getConfig("scrollbar");
    const color = cfg.color || "--color-space-accent";

    const style = document.createElement("style");
    style.id = "exterstellar-scrollbar";
    style.textContent = buildCSS(color);
    document.head.appendChild(style);

    return () => style.remove();
  }
});

function buildCSS(colorVar) {
  return `
    * {
      scrollbar-width: thin;
      scrollbar-color: var(${colorVar}) transparent;
    }

    *::-webkit-scrollbar {
      width: 6px;
      height: 6px;
    }

    *::-webkit-scrollbar-track {
      background: transparent;
    }

    *::-webkit-scrollbar-thumb {
      background-color: var(${colorVar});
      border-radius: 100%;
    }

    *::-webkit-scrollbar-thumb:hover {
      background-color: var(${colorVar});
      opacity: 0.6;
    }
  `;
}