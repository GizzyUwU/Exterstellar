let states = {};
let pluginConfigs = {};

const save = () => chrome.storage.sync.set({pluginStates: states});
const saveConfigs = () => chrome.storage.sync.set({pluginConfig: pluginConfigs});

function el(tag, cls) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  return node;
}

function buildToggle(id, checked) {
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

function buildConfigPanel(plugin) {
  const panel = el("div", "cfg-panel");
  const inputsByKey = {};
  const rowsByKey = {};

  for (const field of plugin.config) {
    const cfgRow = el("div", "cfg-row");
    const lbl = el("label", "cfg-label");
    lbl.textContent = field.label;

    let input;
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
      input.checked = saved === true || saved === "true";
    } else {
      input = document.createElement("input");
      input.className = "cfg-input";
      input.type = field.type === "number" ? "number" : "text";
      input.value = pluginConfigs[plugin.id]?.[field.key] ?? field.default ?? "";
      if (field.placeholder) input.placeholder = field.placeholder;
    }

    input.addEventListener("change", () => {
      if (!pluginConfigs[plugin.id]) pluginConfigs[plugin.id] = {};
      pluginConfigs[plugin.id][field.key] = field.type === "checkbox" ? input.checked : input.value;
      saveConfigs();
    });

    inputsByKey[field.key] = input;
    rowsByKey[field.key] = cfgRow;
    cfgRow.append(lbl, input);
    panel.appendChild(cfgRow);
  }

  for (const field of plugin.config) {
    if (!field.showIf) continue;
    const row = rowsByKey[field.key];
    const guard = inputsByKey[field.showIf.key];
    if (!row || !guard) continue;

    const sync = () => {row.style.display = guard.value === field.showIf.value ? "" : "none";};
    sync();
    guard.addEventListener("change", sync);
  }

  return panel;
}

function buildRow(plugin) {
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

const listEl = document.getElementById("list");
const countEl = document.getElementById("count");

function renderPlugins(plugins) {
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

  const fontName = cfg.fontName?.trim() || "Exo 2";
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
  if (area === "local" && changes.pluginManifest) {
    renderPlugins(changes.pluginManifest.newValue);
  } else if (area === "sync" && changes.pluginStates) {
    states = changes.pluginStates.newValue ?? {};
  } else if (area === "sync" && changes.pluginConfig) {
    pluginConfigs = changes.pluginConfig.newValue ?? {};
  }
});

chrome.storage.sync.get(["pluginStates", "pluginConfig"], syncData => {
  states = syncData.pluginStates ?? {};
  pluginConfigs = syncData.pluginConfig ?? {};
  applyPopupFont();

  chrome.storage.local.get("pluginManifest", localData => {
    renderPlugins(localData.pluginManifest);
  });
});