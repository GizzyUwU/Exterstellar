import type { PluginConfigMap, PluginManifestEntry, PluginStateMap } from "./types";

declare const Exterstellar: import("./types").ExterstellarAPI;

let _activeStates: PluginStateMap = {};

chrome.storage.sync.get(["pluginStates", "pluginConfig"], async (data) => {
  const states: PluginStateMap = data["pluginStates"] ?? {};
  const configs: PluginConfigMap = data["pluginConfig"] ?? {};
  _activeStates = {...states};

  Exterstellar.loadConfigs(configs);

  const all = Exterstellar.getAll();
  const manifest: PluginManifestEntry[] = all.map(({id, name, description, author, config}) => ({
    id,
    name,
    ...(description !== undefined && {description}),
    ...(author !== undefined && {author}),
    ...(config !== undefined && {config}),
  }));

  try {
    await chrome.storage.local.set({pluginManifest: manifest});
  } catch (err) {
    throw new Error("[Exterstellar | Plugin Registrar] Failed to write plugin manifest to session: " + (err instanceof Error ? err.message : String(err)));
  }

  Exterstellar._exports = {};

  for (const plugin of all) {
    if (states[plugin.id] === true) Exterstellar.activate(plugin.id);
  }

  for (const plugin of all) {
    if (states[plugin.id] !== true) {
      document.getElementById(`exterstellar-${plugin.id}`)?.remove();
      sessionStorage.removeItem(`_ext_${plugin.id}_pre`);
    }
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;

    if (changes["pluginConfig"]) {
      const newConfigs: PluginConfigMap = changes["pluginConfig"].newValue ?? {};
      Exterstellar.loadConfigs(newConfigs);
      const oldConfigs: PluginConfigMap = changes["pluginConfig"].oldValue ?? {};

      for (const plugin of Exterstellar.getAll()) {
        if (!_activeStates[plugin.id]) continue;
        if (JSON.stringify(oldConfigs[plugin.id] ?? {}) === JSON.stringify(newConfigs[plugin.id] ?? {})) continue;
        Exterstellar.deactivate(plugin.id);
        Exterstellar.activate(plugin.id);
      }
    }

    if (changes["pluginStates"]) {
      const newStates: PluginStateMap = changes["pluginStates"].newValue ?? {};
      for (const plugin of Exterstellar.getAll()) {
        const wasOn = _activeStates[plugin.id] === true;
        const isOn = newStates[plugin.id] === true;
        if (wasOn === isOn) continue;

        if (isOn) {
          Exterstellar.activate(plugin.id);
        } else {
          Exterstellar.deactivate(plugin.id);
          delete Exterstellar._exports[plugin.id];
          document.getElementById(`exterstellar-${plugin.id}`)?.remove();
          sessionStorage.removeItem(`_ext_${plugin.id}_pre`);
        }
      }
      _activeStates = {...newStates};
    }
  });
});