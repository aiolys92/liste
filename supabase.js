// ============================================
// SUPABASE CONFIG
// ============================================
const SUPABASE_URL    = 'https://pmrmeivebuvyynmehyhh.supabase.co';
const SUPABASE_ANON   = 'sb_publishable_oS96m8VAdb2DcfUJby00fw_tpsBXlV-';
const SUPABASE_HEADERS = {
  'Content-Type':  'application/json',
  'apikey':        SUPABASE_ANON,
  'Authorization': `Bearer ${SUPABASE_ANON}`,
  'Prefer':        'return=representation'
};

const DB = {
  // ---- READ ALL ----
  async fetchBugs() {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/bugs?order=date.desc,id.desc`,
      { headers: SUPABASE_HEADERS }
    );
    if (!res.ok) throw new Error(`Fetch error ${res.status}`);
    return res.json();
  },

  // ---- INSERT ----
  async insertBug(bug) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/bugs`, {
      method:  'POST',
      headers: SUPABASE_HEADERS,
      body:    JSON.stringify(bug)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || `Insert error ${res.status}`);
    }
    return res.json();
  },

  // ---- UPDATE ----
  async updateBug(id, data) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/bugs?id=eq.${encodeURIComponent(id)}`,
      {
        method:  'PATCH',
        headers: SUPABASE_HEADERS,
        body:    JSON.stringify(data)
      }
    );
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || `Update error ${res.status}`);
    }
    return res.json();
  },

  // ---- DELETE ----
  async deleteBug(id) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/bugs?id=eq.${encodeURIComponent(id)}`,
      { method: 'DELETE', headers: SUPABASE_HEADERS }
    );
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || `Delete error ${res.status}`);
    }
    return true;
  },

  // ---- NEXT ID ----
  nextId(bugs) {
    if (!bugs.length) return 'DFS-10843';
    const max = Math.max(...bugs.map(b => parseInt(b.id.replace('DFS-', '')) || 0));
    return `DFS-${max + 1}`;
  }
};
