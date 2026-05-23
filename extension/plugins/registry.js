// core registry
// you MUST load this before any plugin files (determined in manifest.json)
// otherwise, anything related to registering plugins will not work :hs:

const Exterstellar = (() => {
  const _store = {};

  function register(plugin) {
    if (!plugin.id || !plugin.name) {
      console.warn("[Exterstellar | Plugin Registrar] Skipping plugin with missing id/name:", plugin);
      return;
    }
    _store[plugin.id] = {...plugin, _active: false, _cleanup: null};
  }

  const getAll = () => Object.values(_store);

  function activate(id) {
    const p = _store[id];
    if (!p) return;
    try {
      const result = p.start?.();
      p._cleanup = typeof result === "function" ? result : null;
      p._active = true;
    } catch (err) {
      console.warn(`[Exterstellar | Plugin Registrar] Plugin "${id}" threw during start:`, err);
    }
  }

  function deactivate(id) {
    const p = _store[id];
    if (!p?._active) return;
    try {
      p._cleanup?.();
    } catch (_) {}
    p._active = false;
    p._cleanup = null;
  }

  function getConfig(id) {
    const p = _store[id];
    if (!p?.config) return {};
    const defaults = {};
    for (const field of p.config) defaults[field.key] = field.default ?? "";
    return {...defaults, ..._cfgStore[id]};
  }

  function loadConfigs(allConfigs) {
    _cfgStore = allConfigs ?? {};
  }

  return {register, getAll, activate, deactivate, getConfig, loadConfigs};
})();

window.Exterstellar = Exterstellar;