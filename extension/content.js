chrome.storage.sync.get("pluginStates", async data => {
  const states = data.pluginStates ?? {};
  const all = Exterstellar.getAll();

  const manifest = all.map(({id, name, description, author}) => ({id, name, description, author}));
  try {
    await chrome.storage.local.set({pluginManifest: manifest});
  } catch (err) {
    throw new Error("[Exterstellar | Plugin Registrar] Failed to write plugin manifest to session: " + err.message);
  }

  for (const plugin of all) {
    if (states[plugin.id] === true) Exterstellar.activate(plugin.id);
  }
});