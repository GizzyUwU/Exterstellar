let _activeStates = {};

chrome.storage.sync.get(["pluginStates", "pluginConfig"], async data => {
  const states = data.pluginStates ?? {};
  const configs = data.pluginConfig ?? {};
  _activeStates = {...states};

  Exterstellar.loadConfigs(configs);

  const all = Exterstellar.getAll();

  const manifest = all.map(({id, name, description, author, config}) => ({id, name, description, author, config}));
  try {
    await chrome.storage.local.set({pluginManifest: manifest});
  } catch (err) {
    throw new Error("[Exterstellar | Plugin Registrar] Failed to write plugin manifest to session: " + err.message);
  }

  Exterstellar._exports = {};
  Exterstellar.getExport = function(id) {
    return Exterstellar._exports?.[id] ?? null;
  };

  for (const plugin of all) {
    if (states[plugin.id] === true) Exterstellar.activate(plugin.id);
  }

  // removes any preloaded sytles belonging to plugins that are currently off
  for (const plugin of all) {
    if (states[plugin.id] !== true) {
      document.getElementById(`exterstellar-${plugin.id}`)?.remove();
      sessionStorage.removeItem(`_ext_${plugin.id}_pre`);
    }
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;

    if (changes.pluginConfig) {
      const newConfigs = changes.pluginConfig.newValue ?? {};
      Exterstellar.loadConfigs(newConfigs);

      const oldConfigs = changes.pluginConfig.oldValue ?? {};
      for (const plugin of Exterstellar.getAll()) {
        if (!_activeStates[plugin.id]) continue;
        const oldSer = JSON.stringify(oldConfigs[plugin.id] ?? {});
        const newSer = JSON.stringify(newConfigs[plugin.id] ?? {});
        if (oldSer === newSer) continue;

        Exterstellar.deactivate(plugin.id);
        Exterstellar.activate(plugin.id);
      }
    }

    if (changes.pluginStates) {
      const newStates = changes.pluginStates.newValue ?? {};

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