globalThis.__FUELEX_SAMPLE__ = true; // tests use sample staff, customers and suppliers
// Minimal localStorage shim so the repository layer can run under Node
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => { store.set(k, String(v)); },
  removeItem: (k) => { store.delete(k); },
  clear: () => store.clear(),
  key: (i) => Array.from(store.keys())[i] ?? null,
  get length() { return store.size; },
};
globalThis.window = globalThis.window || { localStorage: globalThis.localStorage };
export const resetStorage = () => store.clear();
