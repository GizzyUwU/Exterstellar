import type { ExportPayload, ManagerSettings, MgrFieldDef, PluginConfigMap, PluginManifestEntry, PluginStateMap } from "./types";

let states: PluginStateMap = {};
let pluginConfigs: PluginConfigMap = {};
let managerSettings: ManagerSettings = {};
let currentPlugins: PluginManifestEntry[] = [];

const save = () => chrome.storage.sync.set({pluginStates: states});
const saveConfigs = () => chrome.storage.sync.set({pluginConfig: pluginConfigs});
const saveMgrSettings = () => chrome.storage.sync.set({managerSettings});

const MGR_FIELDS: MgrFieldDef[] = [
  {
    key: "fontSize",
    label: "Font size",
    default: "13",
    options: ["9", "11", "13", "15", "17"].map(v => ({value: v, label: v + "px"})),
    apply: v => {
      document.body.style.fontSize = v + "px";
      let s = document.getElementById("mgr-font-override");
      if (!s) {
        s = document.createElement("style");
        s.id = "mgr-font-override";
        document.head.appendChild(s);
      }
      const sub = Math.max(9, Number(v) - 2);
      s.textContent = `
        .byline, .count, .cfg-label, .cfg-input, .cfg-select, .blurb {font-size: ${sub}px;}
      `;
    },
  },
  {
    key: "width",
    label: "Popup width",
    default: "340",
    options: ["280", "310", "340", "370", "400", "430"].map(v => ({value: v, label: v + "px"})),
    apply: v => {document.body.style.width = v + "px";},
  },
];

function applyManagerSettings(cfg: ManagerSettings = managerSettings) {
  for (const field of MGR_FIELDS) {
    field.apply(cfg[field.key] ?? field.default);
  }
}

function buildManagerPanel(): HTMLElement {
  const panel = el("div", "mgr-panel");

  for (const field of MGR_FIELDS) {
    const row = el("div", "cfg-row");
    const lbl = el("label", "cfg-label");
    lbl.textContent = field.label;
    lbl.title = field.label;
    lbl.setAttribute("aria-label", field.label);

    const select = document.createElement("select");
    select.className = "cfg-select";
    for (const opt of field.options) {
      const o = document.createElement("option");
      o.value = opt.value;
      o.textContent = opt.label;
      if ((managerSettings[field.key] ?? field.default) === opt.value) o.selected = true;
      select.appendChild(o);
    }

    select.addEventListener("change", () => {
      managerSettings[field.key] = select.value;
      saveMgrSettings();
      field.apply(select.value);
    });

    row.append(lbl, select);
    panel.appendChild(row);
  }

  return panel;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  return node;
}

function buildToggle(id: string, checked: boolean): HTMLLabelElement {
  const label = el("label", "toggle");

  const input = el("input");
  input.type = "checkbox";
  input.checked = checked;
  input.addEventListener("change", () => {
    states[id] = input.checked;
    save();
  });

  const track = el("div", "track");
  label.append(input, track);
  return label;
}

function buildConfigPanel(plugin: PluginManifestEntry): HTMLElement {
  const panel = el("div", "cfg-panel");
  const inputsByKey: Record<string, HTMLSelectElement | HTMLInputElement> = {};
  const rowsByKey: Record<string, HTMLElement> = {};

  for (const field of plugin.config ?? []) {
    const cfgRow = el("div", "cfg-row");
    const lbl = el("label", "cfg-label");
    lbl.textContent = field.label;
    lbl.title = field.label;
    lbl.setAttribute("aria-label", field.label);

    let input: HTMLSelectElement | HTMLInputElement;
    if (field.type === "select") {
      input = document.createElement("select");
      input.className = "cfg-select";
      for (const opt of (field.options ?? [])) {
        const o = document.createElement("option");
        const val = typeof opt === "object" ? opt.value : opt;
        const label = typeof opt === "object" ? opt.label : opt;
        o.value = val;
        o.textContent = label;
        if ((pluginConfigs[plugin.id]?.[field.key] ?? field.default) === val) o.selected = true;
        input.appendChild(o);
      }
    } else if (field.type === "checkbox") {
      input = document.createElement("input");
      input.className = "cfg-checkbox";
      input.type = "checkbox";
      const saved = pluginConfigs[plugin.id]?.[field.key] ?? field.default;
      (input as HTMLInputElement).checked = saved === true || saved === "true";
    } else {
      input = document.createElement("input");
      input.className = "cfg-input";
      input.type = field.type === "number" ? "number" : "text";
      (input as HTMLInputElement).value = String(pluginConfigs[plugin.id]?.[field.key] ?? field.default ?? "");
      if (field.placeholder) (input as HTMLInputElement).placeholder = field.placeholder;
    }

    input.addEventListener("change", () => {
      const cfg = pluginConfigs[plugin.id] ?? {};
      pluginConfigs[plugin.id] = cfg;
      cfg[field.key] = field.type === "checkbox"
        ? (input as HTMLInputElement).checked
        : input.value;
      saveConfigs();
    });

    inputsByKey[field.key] = input;
    rowsByKey[field.key] = cfgRow;
    cfgRow.append(lbl, input);
    panel.appendChild(cfgRow);
  }

  for (const field of plugin.config ?? []) {
    if (!field.showIf) continue;
    const row = rowsByKey[field.key];
    const guard = inputsByKey[field.showIf.key];
    if (!row || !guard) continue;

    const showIfVal = field.showIf.value;
    const sync = () => { row.style.display = guard.value === showIfVal ? "" : "none"; };
    sync();
    guard.addEventListener("change", sync);
  }

  return panel;
}

function buildRow(plugin: PluginManifestEntry): HTMLElement {
  const wrapper = el("div", "row-wrap");
  const row = el("div", "row");
  const info = el("div", "info");

  const nameEl = el("span", "pname");
  nameEl.textContent = plugin.name;

  const byline = el("div", "byline");
  byline.textContent = plugin.author ? `by ${plugin.author}` : `no author listed`;

  info.append(nameEl, byline);

  if (plugin.description) {
    const blurb = el("p", "blurb");
    blurb.textContent = plugin.description;
    info.appendChild(blurb);
  }

  const controls = el("div", "controls");

  if (plugin.config?.length) {
    const gear = el("button", "gear-btn");
    gear.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-settings-icon lucide-settings">
        <path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/><circle cx="12" cy="12" r="3"/>
      </svg>
    `;
    gear.title = "Plugin settings";
    gear.addEventListener("click", () => {
      const existing = wrapper.querySelector(".cfg-panel");
      if (existing) {
        existing.remove();
        gear.classList.remove("gear-btn--open");
        return;
      }
      wrapper.appendChild(buildConfigPanel(plugin));
      gear.classList.add("gear-btn--open");
    });
    controls.appendChild(gear);
  }

  controls.appendChild(buildToggle(plugin.id, states[plugin.id] === true));
  row.append(info, controls);
  wrapper.appendChild(row);
  return wrapper;
}

const listEl = document.getElementById("list")!;
const countEl = document.getElementById("count")!;
const mgrBtn = document.getElementById("mgr-btn")!;
let mgrPanelEl: HTMLElement | null = null;

mgrBtn.addEventListener("click", () => {
  if (mgrPanelEl) {
    mgrPanelEl.remove();
    mgrPanelEl = null;
    mgrBtn.classList.remove("gear-btn--open");
  } else {
    mgrPanelEl = buildManagerPanel();
    listEl.before(mgrPanelEl);
    mgrBtn.classList.add("gear-btn--open");
  }
});

function renderPlugins(plugins: PluginManifestEntry[] | undefined): void {
  currentPlugins = plugins ?? [];
  listEl.innerHTML = "";

  if (!plugins?.length) {
    const notice = el("p", "empty");
    notice.textContent = "No plugins loaded yet.\nVisit (or refresh) any page first to initialize Exterstellar.";
    listEl.appendChild(notice);
    countEl.textContent = "";
    return;
  }

  countEl.textContent = `${plugins.length} plugin${plugins.length === 1 ? "" : "s"}`;

  plugins
    .filter((_, i) => i >= 0)
    .forEach(p => listEl.appendChild(buildRow(p)));
}

function applyPopupFont() {
  const cfg = pluginConfigs["custom-font"];
  if (!cfg?.applyToPopup) return;

  const fontName = String(cfg.fontName ?? "").trim() || "Exo 2";
  if (cfg.source !== "System Fonts") {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontName)}:wght@400;500;600;700&display=swap`;
    document.head.appendChild(link);
  }

  const style = document.createElement("style");
  style.id = "exterstellar-popup-font";
  style.textContent = `
    *,
    *::before,
    *::after {
      font-family: "${fontName}", sans-serif !important;
    }
  `;
  document.head.appendChild(style);
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes["pluginManifest"]) {
    renderPlugins(changes["pluginManifest"].newValue);
  } else if (area === "sync" && changes["pluginStates"]) {
    states = changes["pluginStates"].newValue ?? {};
  } else if (area === "sync" && changes["pluginConfig"]) {
    pluginConfigs = changes["pluginConfig"].newValue ?? {};
  } else if (area === "sync" && changes["managerSettings"]) {
    managerSettings = changes["managerSettings"].newValue ?? {};
    applyManagerSettings();
  }
});

chrome.storage.sync.get(["pluginStates", "pluginConfig", "managerSettings"], syncData => {
  states = syncData["pluginStates"] ?? {};
  pluginConfigs = syncData["pluginConfig"] ?? {};
  managerSettings = syncData["managerSettings"] ?? {};
  applyManagerSettings();
  applyPopupFont();

  chrome.storage.local.get("pluginManifest", localData => {
    renderPlugins(localData["pluginManifest"]);
  });
});

document.getElementById("export-btn")!.addEventListener("click", () => {
  chrome.storage.sync.get(["pluginStates", "pluginConfig", "managerSettings"], data => {
    const payload: ExportPayload = {
      exterstellar: true,
      version: 1,
      pluginStates: data["pluginStates"] ?? {},
      pluginConfig: data["pluginConfig"] ?? {},
      managerSettings: data["managerSettings"] ?? {},
    };
    const blorb = new Blob([JSON.stringify(payload, null, 2)], {type: "application/json"});
    const url = URL.createObjectURL(blorb);
    const a = document.createElement("a");
    a.href = url;
    a.download = "exterstellar-settings.json";
    a.click();
    URL.revokeObjectURL(url);
  });
});

const importFileEl = document.getElementById("import-file") as HTMLInputElement;

document.getElementById("import-btn")!.addEventListener("click", () => {
  importFileEl.value = "";
  importFileEl.click();
});

importFileEl.addEventListener("change", () => {
  const file = importFileEl.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const raw = (e.target as FileReader).result as string;
      const data = JSON.parse(raw) as Partial<ExportPayload>;
      if (!data.exterstellar) {
        alert("This doesn't look like an Exterstellar settings file. In the future, importing from other extensions will be supported.");
        return;
      }

      const toSave: Partial<ExportPayload> = {};
      if (data.pluginStates) toSave.pluginStates = data.pluginStates;
      if (data.pluginConfig) toSave.pluginConfig = data.pluginConfig;
      if (data.managerSettings) toSave.managerSettings = data.managerSettings;

      chrome.storage.sync.set(toSave, () => {
        if (data.pluginStates) states = data.pluginStates!;
        if (data.pluginConfig) pluginConfigs = data.pluginConfig!;
        if (data.managerSettings) managerSettings = data.managerSettings!;
        applyManagerSettings();
        renderPlugins(currentPlugins);
      });
    } catch {
      alert("Failed to read the file. Make sure it hasn't been tampered and is a valid Exterstellar JSON export.");
    }
  };
  reader.readAsText(file);
});