chrome.storage.sync.get(["pluginStates", "pluginConfig"], async data => {
  const states = data.pluginStates ?? {};
  const configs = data.pluginConfig ?? {};

  Exterstellar.loadConfigs(configs);

  const all = Exterstellar.getAll();

  const manifest = all.map(({id, name, description, author, config}) => ({id, name, description, author, config}));
  try {
    await chrome.storage.local.set({pluginManifest: manifest});
  } catch (err) {
    throw new Error("[Exterstellar | Plugin Registrar] Failed to write plugin manifest to session: " + err.message);
  }

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
});