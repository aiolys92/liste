const SUPABASE_URL   = 'https://pmrmeivebuvyynmehyhh.supabase.co';
const SUPABASE_ANON  = 'sb_publishable_oS96m8VAdb2DcfUJby00fw_tpsBXlV-';
const SUPABASE_HEADERS = {
  'Content-Type':  'application/json',
  'apikey':        SUPABASE_ANON,
  'Authorization': `Bearer ${SUPABASE_ANON}`,
  'Prefer':        'return=representation'
};

const DB = {

  /* ---- BUGS ---- */
  async fetchBugs(includeArchived = false) {
    const url = includeArchived
      ? `${SUPABASE_URL}/rest/v1/bugs?order=date.desc,id.desc`
      : `${SUPABASE_URL}/rest/v1/bugs?or=(archived.eq.false,archived.is.null)&order=date.desc,id.desc`;
    const res = await fetch(url, { headers: SUPABASE_HEADERS });
    if (!res.ok) throw new Error(`Fetch error ${res.status}`);
    return res.json();
  },

  async fetchArchived() {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/bugs?archived=eq.true&order=date.desc,id.desc`,
      { headers: SUPABASE_HEADERS }
    );
    if (!res.ok) throw new Error(`Fetch archived error ${res.status}`);
    return res.json();
  },

  async insertBug(bug) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/bugs`, {
      method: 'POST', headers: SUPABASE_HEADERS, body: JSON.stringify(bug)
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.message || `Insert error ${res.status}`); }
    return res.json();
  },

  async updateBug(id, data) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/bugs?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH', headers: SUPABASE_HEADERS, body: JSON.stringify(data)
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.message || `Update error ${res.status}`); }
    return res.json();
  },

  async archiveBug(id)  { return this.updateBug(id, { archived: true }); },
  async restoreBug(id)  { return this.updateBug(id, { archived: false }); },

  async deleteBug(id) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/bugs?id=eq.${encodeURIComponent(id)}`, {
      method: 'DELETE', headers: SUPABASE_HEADERS
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.message || `Delete error ${res.status}`); }
    return true;
  },

  /* ---- MEMBERS ---- */
  async fetchMembers() {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/members?order=name.asc`, { headers: SUPABASE_HEADERS });
    if (!res.ok) throw new Error(`Members fetch error ${res.status}`);
    return res.json();
  },

  async insertMember(data) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/members`, {
      method: 'POST', headers: SUPABASE_HEADERS, body: JSON.stringify(data)
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.message || `Member insert error ${res.status}`); }
    return res.json();
  },

  async deleteMember(id) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/members?id=eq.${id}`, {
      method: 'DELETE', headers: SUPABASE_HEADERS
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.message || `Member delete error ${res.status}`); }
    return true;
  },

  /* ---- HISTORY ---- */
  async fetchHistory(bugId) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/history?bug_id=eq.${encodeURIComponent(bugId)}&order=created_at.desc`,
      { headers: SUPABASE_HEADERS }
    );
    if (!res.ok) throw new Error(`History fetch error ${res.status}`);
    return res.json();
  },

  async insertHistory(bugId, author, field, oldValue, newValue) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/history`, {
      method: 'POST', headers: SUPABASE_HEADERS,
      body: JSON.stringify({ bug_id: bugId, author, field, old_value: String(oldValue||''), new_value: String(newValue||'') })
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
    return res.json();
  },

  /* ---- COMMENTS ---- */
  async fetchComments(bugId) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/comments?bug_id=eq.${encodeURIComponent(bugId)}&order=created_at.asc`,
      { headers: SUPABASE_HEADERS }
    );
    if (!res.ok) throw new Error(`Comments fetch error ${res.status}`);
    return res.json();
  },

  async insertComment(bugId, author, content) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/comments`, {
      method: 'POST', headers: SUPABASE_HEADERS,
      body: JSON.stringify({ bug_id: bugId, author, content })
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.message || `Comment insert error ${res.status}`); }
    return res.json();
  },

  async deleteComment(id) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/comments?id=eq.${id}`, {
      method: 'DELETE', headers: SUPABASE_HEADERS
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
    return true;
  },

  /* ---- CONFIG ---- */
  async fetchConfig() {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/config`, { headers: SUPABASE_HEADERS });
    if (!res.ok) throw new Error(`Config fetch error ${res.status}`);
    const rows = await res.json();
    const out = {};
    rows.forEach(r => { out[r.key] = r.values; });
    return out;
  },

  async updateConfig(key, values) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/config?key=eq.${key}`, {
      method: 'PATCH', headers: SUPABASE_HEADERS, body: JSON.stringify({ values })
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
    return true;
  },

  /* ---- UTILS ---- */
  nextId(bugs) {
    if (!bugs.length) return 'MSN-001';
    const nums = bugs.map(b => parseInt(b.id.replace(/[^0-9]/g,'')) || 0);
    return `MSN-${String(Math.max(...nums) + 1).padStart(3,'0')}`;
  }
};
