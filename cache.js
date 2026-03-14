// ============================================
// CACHE sessionStorage — TTL 2 minutes
// ============================================
const Cache = {
  TTL: 2 * 60 * 1000, // 2 minutes

  set(key, data) {
    try {
      sessionStorage.setItem('cp_' + key, JSON.stringify({ data, ts: Date.now() }));
    } catch(e) { /* sessionStorage plein ou indisponible */ }
  },

  get(key) {
    try {
      const raw = sessionStorage.getItem('cp_' + key);
      if (!raw) return null;
      const { data, ts } = JSON.parse(raw);
      if (Date.now() - ts > this.TTL) { sessionStorage.removeItem('cp_' + key); return null; }
      return data;
    } catch(e) { return null; }
  },

  invalidate(key) {
    try { sessionStorage.removeItem('cp_' + key); } catch(e) {}
  },

  invalidateAll() {
    try {
      Object.keys(sessionStorage)
        .filter(k => k.startsWith('cp_'))
        .forEach(k => sessionStorage.removeItem(k));
    } catch(e) {}
  },

  // Clés nommées
  keys: {
    config:    'config',
    members:   'members',
    stats:     'stats',
    requests:  'requests',
    archived:  'archived',
  }
};
