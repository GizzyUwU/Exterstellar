import type { ExterstellarAPI, PluginConfigMap, PluginDefinition, PluginEntry } from "../types";

const _store: Record<string, PluginEntry> = {};
let _cfgStore: PluginConfigMap = {};

function register(plugin: PluginDefinition): void {
  if (!plugin.id || !plugin.name) {
    console.warn("[Exterstellar | Plugin Registrar] Skipping plugin with missing id/name:", plugin);
    return;
  }
  _store[plugin.id] = {...plugin, _active: false, _cleanup: null};
}

const getAll = (): PluginEntry[] => Object.values(_store);

function activate(id: string): void {
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

function deactivate(id: string): void {
  const p = _store[id];
  if (!p?._active) return;
  try {
    p._cleanup?.();
  } catch (_) {}
  p._active = false;
  p._cleanup = null;
}

function getConfig(id: string): Record<string, string | boolean | number> {
  const p = _store[id];
  if (!p?.config) return {};
  const defaults: Record<string, string | boolean | number> = {};
  for (const field of p.config) defaults[field.key] = field.default ?? "";
  return {...defaults, ..._cfgStore[id]};
}

function loadConfigs(allConfigs: PluginConfigMap): void {
  _cfgStore = allConfigs ?? {};
}

export const Exterstellar: ExterstellarAPI = {
  register,
  getAll,
  activate,
  deactivate,
  getConfig,
  loadConfigs,
  _exports: {},
  getExport(id) {return this._exports[id] ?? null;},
};

(window as unknown as {Exterstellar: ExterstellarAPI}).Exterstellar = Exterstellar;