let states = {};

const save = () => chrome.storage.sync.set({pluginStates: states});

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
    // TODO: do something to not require a page refresh :3
  });

  const track = el("div", "track");
  label.append(input, track);
  return label;
}

function buildRow(plugin) {
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

  row.append(info, buildToggle(plugin.id, states[plugin.id] === true));
  return row;
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

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.pluginManifest) {
    renderPlugins(changes.pluginManifest.newValue);
  } else if (area === "sync" && changes.pluginStates) {
    states = changes.pluginStates.newValue ?? {};
  }
});

chrome.storage.sync.get("pluginStates", syncData => {
  states = syncData.pluginStates ?? {};

  chrome.storage.local.get("pluginManifest", localData => {
    renderPlugins(localData.pluginManifest);
  });
});