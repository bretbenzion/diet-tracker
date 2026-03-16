/**
 * NutriTrack – Store (localStorage persistence)
 * All data lives here. Everything is keyed and versioned.
 */

const STORE_VERSION = 1;
const KEYS = {
  LOG:      'nt_log',       // { "YYYY-MM-DD": [ {id, name, ...macros, servingSize, servingUnit, amount} ] }
  WEIGHT:   'nt_weight',    // [ {id, date:"YYYY-MM-DD", value, unit} ]
  LIBRARY:  'nt_library',   // [ {id, name, servingSize, servingUnit, cal, protein, carbs, fat} ]
  TARGETS:  'nt_targets',   // { cal, protein, proteinDir, carbs, carbsDir, fat, fatDir, weight, weightUnit }
  PREFS:    'nt_prefs',     // { weightUnit }
  APIKEY:   'nt_apikey',    // string (stored locally)
  VERSION:  'nt_version',
};

const Store = {
  // ── Helpers ─────────────────────────────────────
  _get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw !== null ? JSON.parse(raw) : fallback;
    } catch { return fallback; }
  },
  _set(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {
      console.error('Storage error', e);
    }
  },
  _uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  },

  // ── Food Log ─────────────────────────────────────
  getLog(date) {
    const all = this._get(KEYS.LOG, {});
    return all[date] || [];
  },
  getAllLog() {
    return this._get(KEYS.LOG, {});
  },
  addLogEntry(date, entry) {
    const all = this._get(KEYS.LOG, {});
    if (!all[date]) all[date] = [];
    const item = { id: this._uid(), ...entry };
    all[date].push(item);
    this._set(KEYS.LOG, all);
    return item;
  },
  updateLogEntry(date, id, updates) {
    const all = this._get(KEYS.LOG, {});
    if (!all[date]) return;
    const idx = all[date].findIndex(e => e.id === id);
    if (idx !== -1) {
      all[date][idx] = { ...all[date][idx], ...updates };
      this._set(KEYS.LOG, all);
    }
  },
  deleteLogEntry(date, id) {
    const all = this._get(KEYS.LOG, {});
    if (!all[date]) return;
    all[date] = all[date].filter(e => e.id !== id);
    this._set(KEYS.LOG, all);
  },

  // ── Weight ───────────────────────────────────────
  getWeightEntries() {
    return this._get(KEYS.WEIGHT, []).sort((a, b) => a.date.localeCompare(b.date));
  },
  addWeightEntry(date, value, unit) {
    const entries = this._get(KEYS.WEIGHT, []);
    // Replace if same date
    const existing = entries.findIndex(e => e.date === date);
    const item = { id: this._uid(), date, value: parseFloat(value), unit };
    if (existing !== -1) entries[existing] = item;
    else entries.push(item);
    this._set(KEYS.WEIGHT, entries);
    return item;
  },
  updateWeightEntry(id, updates) {
    const entries = this._get(KEYS.WEIGHT, []);
    const idx = entries.findIndex(e => e.id === id);
    if (idx !== -1) {
      entries[idx] = { ...entries[idx], ...updates };
      this._set(KEYS.WEIGHT, entries);
    }
  },
  deleteWeightEntry(id) {
    const entries = this._get(KEYS.WEIGHT, []).filter(e => e.id !== id);
    this._set(KEYS.WEIGHT, entries);
  },

  // ── Food Library ─────────────────────────────────
  getLibrary() {
    return this._get(KEYS.LIBRARY, []);
  },
  addToLibrary(food) {
    const lib = this._get(KEYS.LIBRARY, []);
    const item = { id: this._uid(), ...food };
    lib.push(item);
    this._set(KEYS.LIBRARY, lib);
    return item;
  },
  updateLibraryItem(id, updates) {
    const lib = this._get(KEYS.LIBRARY, []);
    const idx = lib.findIndex(i => i.id === id);
    if (idx !== -1) {
      lib[idx] = { ...lib[idx], ...updates };
      this._set(KEYS.LIBRARY, lib);
    }
  },
  deleteLibraryItem(id) {
    const lib = this._get(KEYS.LIBRARY, []).filter(i => i.id !== id);
    this._set(KEYS.LIBRARY, lib);
  },

  // ── Targets ──────────────────────────────────────
  getTargets() {
    return this._get(KEYS.TARGETS, {
      cal: 2000, protein: 150, proteinDir: 'min',
      carbs: 200, carbsDir: 'max',
      fat: 65, fatDir: 'max',
      weight: null, weightUnit: 'lbs',
    });
  },
  setTargets(targets) {
    this._set(KEYS.TARGETS, targets);
  },

  // ── Prefs ─────────────────────────────────────────
  getPrefs() {
    return this._get(KEYS.PREFS, { weightUnit: 'lbs' });
  },
  setPrefs(prefs) {
    this._set(KEYS.PREFS, prefs);
  },

  // ── API Key ───────────────────────────────────────
  getApiKey() {
    return localStorage.getItem(KEYS.APIKEY) || '';
  },
  setApiKey(key) {
    localStorage.setItem(KEYS.APIKEY, key);
  },

  // ── Import / Export ───────────────────────────────
  exportAll() {
    return {
      version: STORE_VERSION,
      exportedAt: new Date().toISOString(),
      log: this._get(KEYS.LOG, {}),
      weight: this._get(KEYS.WEIGHT, []),
      library: this._get(KEYS.LIBRARY, []),
      targets: this.getTargets(),
      prefs: this.getPrefs(),
    };
  },
  importAll(data) {
    if (!data || typeof data !== 'object') throw new Error('Invalid data');
    if (data.log)     this._set(KEYS.LOG,     data.log);
    if (data.weight)  this._set(KEYS.WEIGHT,  data.weight);
    if (data.library) this._set(KEYS.LIBRARY, data.library);
    if (data.targets) this._set(KEYS.TARGETS, data.targets);
    if (data.prefs)   this._set(KEYS.PREFS,   data.prefs);
  },
  clearAll() {
    Object.values(KEYS).forEach(k => {
      if (k !== KEYS.APIKEY) localStorage.removeItem(k);
    });
  },

  // ── Utils ─────────────────────────────────────────
  /** Get recent unique foods (from log, sorted by recency) */
  getRecentFoods(limit = 30) {
    const all = this._get(KEYS.LOG, {});
    const seen = new Map();
    const dates = Object.keys(all).sort((a,b) => b.localeCompare(a));
    for (const date of dates) {
      for (const entry of (all[date] || [])) {
        const key = entry.name.toLowerCase().trim();
        if (!seen.has(key)) seen.set(key, entry);
        if (seen.size >= limit) break;
      }
      if (seen.size >= limit) break;
    }
    return [...seen.values()];
  },

  /** Compute totals for a day */
  getDayTotals(date) {
    const entries = this.getLog(date);
    return entries.reduce((acc, e) => {
      acc.cal     += (parseFloat(e.cal)     || 0);
      acc.protein += (parseFloat(e.protein) || 0);
      acc.carbs   += (parseFloat(e.carbs)   || 0);
      acc.fat     += (parseFloat(e.fat)     || 0);
      return acc;
    }, { cal: 0, protein: 0, carbs: 0, fat: 0 });
  },
};
