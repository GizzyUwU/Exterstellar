Exterstellar.register({
  id: "themes",
  name: "Themes",
  description: "Change the color theme of Stardance.",
  author: "Sabio",
  config: [
    {
      key: "theme",
      label: "Theme",
      type: "select",
      options: [
        {value: "default", label: "Default"},
        {value: "catppuccin", label: "Catppuccin"}
      ],
      default: "default"
    },
    {
      key: "flavor",
      label: "Catppuccin flavor",
      type: "select",
      showIf: {key: "theme", value: "catppuccin"},
      options: [
        {value: "mocha", label: "Mocha"},
        {value: "macchiato", label: "Macchiato"},
        {value: "frappe", label: "Frappe"},
        {value: "latte", label: "Latte (WIP)"} // (latte is really broken holy)
      ],
      default: "mocha"
    },
    {
      key: "accent",
      label: "Catppuccin accent",
      type: "select",
      showIf: {key: "theme", value: "catppuccin"},
      options: [
        {value: "rosewater", label: "Rosewater"},
        {value: "flamingo", label: "Flamingo"},
        {value: "pink", label: "Pink"},
        {value: "mauve", label: "Mauve"},
        {value: "red", label: "Red"},
        {value: "maroon", label: "Maroon"},
        {value: "peach", label: "Peach"},
        {value: "yellow", label: "Yellow"},
        {value: "green", label: "Green"},
        {value: "teal", label: "Teal"},
        {value: "sky", label: "Sky"},
        {value: "sapphire", label: "Sapphire"},
        {value: "blue", label: "Blue"},
        {value: "lavender", label: "Lavender"},
      ],
      default: "mauve"
    },
    {
      key: "accentAll",
      label: "Use accent color for all colors",
      type: "checkbox",
      showIf: {key: "theme", value: "catppuccin"},
      default: false
    }
  ],

  start() {
    const cfg = Exterstellar.getConfig("themes");
    const theme = cfg.theme || "default";
    if (theme === "default") {
      sessionStorage.removeItem("_ext_themes_pre");
      return;
    }

    const flavor = cfg.flavor || "mocha";
    const accent = cfg.accent || "mauve";
    const accentAll = cfg.accentAll ?? false;

    const base = THEME_PALLETES[theme]?.[flavor];
    if (!base) {
      console.warn(`[Exterstellar | themes] Unknown flavor "${flavor}" for theme "${theme}"`);
      return;
    }

    const vars = {...base};
    const accentHex = CATPPUCCIN_ACCENTS[flavor]?.[accent];
    if (accentHex) {
      vars["--color-space-accent"] = accentHex;
      vars["--color-space-accent-soft"] = `rgb(${hexToRgb(accentHex)} / 0.18)`;
      if (accentAll) {
        Object.assign(vars, deriveAccentPalette(accentHex));
      }
    }

    sessionStorage.setItem("_ext_themes_pre", `${theme}:${flavor}:${accent}:${accentAll ? "1" : "0"}`);

    let style = document.getElementById("exterstellar-themes");
    if (!style) {
      style = document.createElement("style");
      style.id = "exterstellar-themes";
    }
    style.textContent = buildRootBlock(vars);
    document.head.appendChild(style);

    return () => style.remove();
  }
});

function buildRootBlock(vars) {
  return `:root {\n${Object.entries(vars).map(([k, v]) => `  ${k}: ${v};`).join("\n")}\n}`;
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r} ${g} ${b}`;
}

function deriveAccentPalette(accentHex) {
  const rgb = hexToRgb(accentHex);
  return {
    "--color-brand-mint": accentHex,
    "--color-brand-lilac": accentHex,
    "--color-brand-blue": accentHex,
    "--color-brand-salmon": accentHex,
    "--color-brand-yellow": accentHex,
    "--color-brand-peach": accentHex,
    "--color-brand-orange": accentHex,
    "--color-brand-cream": accentHex,
    "--color-brand-ivory": accentHex,
    "--color-brand-off-white": accentHex,
    "--color-brand-highlight": accentHex,
    "--color-brand-highlight-secondary": accentHex,
    "--color-brand-highlight-soft": `rgb(${rgb} / 0.4)`,
    "--color-brand-highlight-faint": `rgb(${rgb} / 0.12)`,
    "--color-brand-mint-soft": `rgb(${rgb} / 0.18)`,
    "--color-brand-lilac-soft": `rgb(${rgb} / 0.18)`,
    "--color-brand-salmon-soft": `rgb(${rgb} / 0.18)`,
    "--color-brand-yellow-soft": `rgb(${rgb} / 0.18)`,
    "--color-brand-orange-soft": `rgb(${rgb} / 0.18)`,
    "--color-yellow-200": accentHex,  
  }
}

const THEME_PALLETES = {
  catppuccin: {
    mocha: {
      "--color-space-bg": "#1e1e2e",
      "--color-space-bg-2": "#181825",
      "--color-space-text": "#cdd6f4",
      "--color-space-text-muted": "rgb(186 194 222 / 0.75)",
      "--color-space-accent": "#cba6f7",
      "--color-space-accent-soft": "rgb(203 166 247 / 0.18)",
      "--color-space-card": "rgb(49 50 68 / 0.45)",
      "--color-space-surface": "#6c7086",
      "--color-space-surface-soft": "rgb(108 112 134 / 0.5)",
      "--color-space-surface-strong": "rgb(108 112 134 / 0.85)",
      "--color-space-surface-faint": "rgb(108 112 134 / 0.18)",
      "--color-space-border": "#45475a",
      "--color-backdrop": "rgb(17 17 27 / 0.7)",
      "--color-shadow-deep": "rgb(17 17 27 / 0.55)",
      "--color-brand-mint": "#89dceb",
      "--color-brand-lilac": "#b4befe",
      "--color-brand-blue": "#74c7ec",
      "--color-brand-salmon": "#eba0ac",
      "--color-brand-yellow": "#f9e2af",
      "--color-brand-peach": "#fab387",
    },
    macchiato: {
      "--color-space-bg": "#24273a",
      "--color-space-bg-2": "#1e2030",
      "--color-space-text": "#cad3f5",
      "--color-space-text-muted": "rgb(184 192 224 / 0.75)",
      "--color-space-accent": "#c6a0f6",
      "--color-space-accent-soft": "rgb(198 160 246 / 0.18)",
      "--color-space-card": "rgb(54 58 79 / 0.45)",
      "--color-space-surface": "#6e738d",
      "--color-space-surface-soft": "rgb(110 115 141 / 0.5)",
      "--color-space-surface-strong": "rgb(110 115 141 / 0.85)",
      "--color-space-surface-faint": "rgb(110 115 141 / 0.18)",
      "--color-space-border": "#494d64",
      "--color-backdrop": "rgb(24 25 38 / 0.7)",
      "--color-shadow-deep": "rgb(24 25 38 / 0.55)",
      "--color-brand-mint": "#91d7e3",
      "--color-brand-lilac": "#b7bdf8",
      "--color-brand-blue": "#7dc4e4",
      "--color-brand-salmon": "#ee99a0",
      "--color-brand-yellow": "#eed49f",
      "--color-brand-peach": "#f5a97f",
    },
    frappe: {
      "--color-space-bg": "#303446",
      "--color-space-bg-2": "#292c3c",
      "--color-space-text": "#c6d0f5",
      "--color-space-text-muted": "rgb(181 191 226 / 0.75)",
      "--color-space-accent": "#ca9ee6",
      "--color-space-accent-soft": "rgb(202 158 230 / 0.18)",
      "--color-space-card": "rgb(65 69 89 / 0.45)",
      "--color-space-surface":  "#737994",
      "--color-space-surface-soft": "rgb(115 121 148 / 0.5)",
      "--color-space-surface-strong": "rgb(115 121 148 / 0.85)",
      "--color-space-surface-faint": "rgb(115 121 148 / 0.18)",
      "--color-space-border": "#51576d",
      "--color-backdrop": "rgb(35 38 52 / 0.7)",
      "--color-shadow-deep": "rgb(35 38 52 / 0.55)",
      "--color-brand-mint": "#99d1db",
      "--color-brand-lilac": "#babbf1",
      "--color-brand-blue": "#85c1dc",
      "--color-brand-salmon": "#ea999c",
      "--color-brand-yellow": "#e5c890",
      "--color-brand-peach": "#ef9f76",
    },
    latte: {
      "--color-space-bg": "#eff1f5",
      "--color-space-bg-2": "#e6e9ef",
      "--color-space-text": "#4c4f69",
      "--color-space-text-muted": "rgb(92 95 119 / 0.85)",
      "--color-space-accent": "#8839ef",
      "--color-space-accent-soft": "rgb(136 57 239 / 0.15)",
      "--color-space-card": "rgb(204 208 218 / 0.6)",
      "--color-space-surface": "#9ca0b0",
      "--color-space-surface-soft": "rgb(156 160 176 / 0.5)",
      "--color-space-surface-strong": "rgb(156 160 176 / 0.85)",
      "--color-space-surface-faint": "rgb(156 160 176 / 0.25)",
      "--color-space-border": "#bcc0cc",
      "--color-backdrop": "rgb(76 79 105 / 0.45)",
      "--color-shadow-deep": "rgb(76 79 105 / 0.35)",
      "--color-overlay-light-soft": "rgb(76 79 105 / 0.05)",
      "--color-overlay-light": "rgb(76 79 105 / 0.1)",
      "--color-border-input": "rgb(76 79 105 / 0.4)",
      "--color-border-input-focus": "rgb(76 79 105 / 0.9)",
      "--color-brand-mint": "#04a5e5",
      "--color-brand-lilac": "#7287fd",
      "--color-brand-blue": "#209fb5",
      "--color-brand-salmon": "#e64553",
      "--color-brand-yellow": "#df8e1d",
      "--color-brand-peach": "#fe640b",
    }
  }
};

const CATPPUCCIN_ACCENTS = {
  mocha: {
    rosewater: "#f5e0dc", flamingo: "#f2cdcd", pink: "#f5c2e7", mauve: "#cba6f7", red: "#f38ba8", maroon: "#eba0ac", peach: "#fab387", yellow: "#f9e2af", green: "#a6e3a1",
    teal: "#94e2d5", sky: "#89dceb", sapphire: "#74c7ec", blue: "#89b4fa", lavender: "#b4befe",
  },
  macchiato: {
    rosewater: "#f4dbd6", flamingo: "#f0c6c6", pink: "#f5bde6", mauve: "#c6a0f6", red: "#ed8796", maroon: "#ee99a0", peach: "#f5a97f", yellow: "#eed49f", green: "#a6da95",
    teal: "#8bd5ca", sky: "#91d7e3", sapphire: "#7dc4e4", blue: "#8aadf4", lavender: "#b7bdf8",
  },
  frappe: {
    rosewater: "#f2d5cf", flamingo: "#eebebe", pink: "#f4b8e4", mauve: "#ca9ee6", red: "#e78284", maroon: "#ea999c", peach: "#ef9f76", yellow: "#e5c890", green: "#a6d189",
    teal: "#81c8be", sky: "#99d1db", sapphire: "#85c1dc", blue: "#8caaee", lavender: "#babbf1",
  },
  latte: {
    rosewater: "#dc8a78", flamingo: "#dd7878", pink: "#ea76cb", mauve: "#8839ef", red: "#d20f39", maroon: "#e64553", peach: "#fe640b", yellow: "#df8e1d", green: "#40a02b",
    teal: "#179299", sky: "#04a5e5", sapphire: "#209fb5", blue: "#1e66f5", lavender: "#7287fd",
  }
};

const _preKey = sessionStorage.getItem("_ext_themes_pre");
if (_preKey) {
  const [_t, _f, _a, _aa] = _preKey.split(":");
  const _base = THEME_PALLETES[_t]?.[_f];
  if (_base) {
    const _vars = { ..._base };
    const _accentHex = CATPPUCCIN_ACCENTS[_f]?.[_a];
    if (_accentHex) {
      _vars["--color-space-accent"] = _accentHex;
      _vars["--color-space-accent-soft"] = `rgb(${hexToRgb(_accentHex)} / 0.18)`;
      if (_aa === "1") {
        Object.assign(_vars, deriveAccentPalette(_accentHex));
      }
    }
    const s = document.createElement("style");
    s.id = "exterstellar-themes";
    s.textContent = buildRootBlock(_vars);
    document.documentElement.appendChild(s);
  }
}