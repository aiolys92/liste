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

  // Pagination serveur — retourne { data, total }
  _buildBugsQuery(filters={}, sort='date', dir='desc', includeArchived=false) {
    let q = includeArchived ? '' : 'or=(archived.eq.false,archived.is.null)&';
    if (filters.type)      q += `type=eq.${encodeURIComponent(filters.type)}&`;
    if (filters.category)  q += `category=eq.${encodeURIComponent(filters.category)}&`;
    if (filters.priority)  q += `priority=eq.${encodeURIComponent(filters.priority)}&`;
    if (filters.state)     q += `state=eq.${encodeURIComponent(filters.state)}&`;
    if (filters.client_id) q += `client_id=eq.${encodeURIComponent(filters.client_id)}&`;
    if (filters.search)    q += `or=(title.ilike.*${encodeURIComponent(filters.search)}*,description.ilike.*${encodeURIComponent(filters.search)}*,id.ilike.*${encodeURIComponent(filters.search)}*)&`;
    const validSort = ['date','id','priority','state','type','category','due_date'].includes(sort) ? sort : 'date';
    q += `order=${validSort}.${dir==='asc'?'asc':'desc'}`;
    return q;
  },

  async fetchBugsPaged({ page=1, perPage=20, filters={}, sort='date', dir='desc', includeArchived=false } = {}) {
    const from  = (page-1)*perPage;
    const to    = from + perPage - 1;
    const q     = this._buildBugsQuery(filters, sort, dir, includeArchived);

    // Fetch data + count en parallèle
    const dataHeaders  = { ...SUPABASE_HEADERS, 'Range': `${from}-${to}`, 'Range-Unit': 'items' };
    const countHeaders = { ...SUPABASE_HEADERS, 'Prefer': 'count=exact', 'Range': '0-0', 'Range-Unit': 'items' };

    const hasFilters = Object.values(filters).some(v => v);
    const cacheKey   = hasFilters ? null : `bugs_count_p${page}`;

    // Pour la page 1 sans filtres, utiliser le cache du count
    let cachedCount = cacheKey && typeof Cache !== 'undefined' ? Cache.get(cacheKey) : null;

    const [dataRes, countRes] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/bugs?${q}`, { headers: dataHeaders }),
      cachedCount !== null ? Promise.resolve(null) : fetch(`${SUPABASE_URL}/rest/v1/bugs?${q}`, { headers: countHeaders })
    ]);

    if (!dataRes.ok) throw new Error(`Fetch paged error ${dataRes.status}`);
    const data = await dataRes.json();

    let total = cachedCount;
    if (countRes) {
      const range = countRes.headers.get('Content-Range') || '';
      total = parseInt(range.split('/')[1]) || data.length;
      if (cacheKey && typeof Cache !== 'undefined') Cache.set(cacheKey, total);
    }

    return { data, total };
  },

  // Stats pour dashboard (compte par état/priorité/catégorie)
  async fetchStats() {
    const cached = typeof Cache !== 'undefined' && Cache.get(Cache.keys.stats);
    if (cached) return cached;
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/bugs?or=(archived.eq.false,archived.is.null)&select=state,priority,category,due_date,created_at,assignee,client_id`,
      { headers: SUPABASE_HEADERS }
    );
    if (!res.ok) throw new Error(`Stats error ${res.status}`);
    const data = await res.json();
    if (typeof Cache !== 'undefined') Cache.set(Cache.keys.stats, data);
    return data;
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
    if (typeof Cache !== 'undefined') Cache.invalidate(Cache.keys.stats);
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
    const cached = typeof Cache !== 'undefined' && Cache.get(Cache.keys.members);
    if (cached) return cached;
    const res = await fetch(`${SUPABASE_URL}/rest/v1/members?order=name.asc`, { headers: SUPABASE_HEADERS });
    if (!res.ok) throw new Error(`Members fetch error ${res.status}`);
    const data = await res.json();
    if (typeof Cache !== 'undefined') Cache.set(Cache.keys.members, data);
    return data;
  },

  async insertMember(data) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/members`, {
      method: 'POST', headers: SUPABASE_HEADERS, body: JSON.stringify(data)
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.message || `Member insert error ${res.status}`); }
    if (typeof Cache !== 'undefined') Cache.invalidate(Cache.keys.members);
    return res.json();
  },

  async deleteMember(id) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/members?id=eq.${id}`, {
      method: 'DELETE', headers: SUPABASE_HEADERS
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.message || `Member delete error ${res.status}`); }
    if (typeof Cache !== 'undefined') Cache.invalidate(Cache.keys.members);
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
    const cached = typeof Cache !== 'undefined' && Cache.get(Cache.keys.config);
    if (cached) return cached;
    const res = await fetch(`${SUPABASE_URL}/rest/v1/config`, { headers: SUPABASE_HEADERS });
    if (!res.ok) throw new Error(`Config fetch error ${res.status}`);
    const rows = await res.json();
    const out = {};
    rows.forEach(r => { out[r.key] = r.values; });
    if (typeof Cache !== 'undefined') Cache.set(Cache.keys.config, out);
    return out;
  },

  async updateConfigCached(key, values) {
    await this.updateConfig(key, values);
    if (typeof Cache !== 'undefined') Cache.invalidate(Cache.keys.config);
  },

  async updateConfig(key, values) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/config?key=eq.${key}`, {
      method: 'PATCH', headers: SUPABASE_HEADERS, body: JSON.stringify({ values })
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
    return true;
  },



  /* ---- CLIENTS ---- */
  async fetchClients() {
    const cached = typeof Cache !== 'undefined' && Cache.get('clients');
    if (cached) return cached;
    const res = await fetch(`${SUPABASE_URL}/rest/v1/clients?order=name.asc`, { headers: SUPABASE_HEADERS });
    if (!res.ok) throw new Error(`Clients fetch error ${res.status}`);
    const data = await res.json();
    if (typeof Cache !== 'undefined') Cache.set('clients', data);
    return data;
  },

  async insertClient(data) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/clients`, {
      method: 'POST', headers: SUPABASE_HEADERS, body: JSON.stringify(data)
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.message || `Client insert error ${res.status}`); }
    if (typeof Cache !== 'undefined') Cache.invalidate('clients');
    return res.json();
  },

  async updateClient(id, data) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/clients?id=eq.${id}`, {
      method: 'PATCH', headers: SUPABASE_HEADERS, body: JSON.stringify(data)
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.message || `Client update error ${res.status}`); }
    if (typeof Cache !== 'undefined') Cache.invalidate('clients');
    return res.json();
  },

  async deleteClient(id) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/clients?id=eq.${id}`, {
      method: 'DELETE', headers: SUPABASE_HEADERS
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.message || `Client delete error ${res.status}`); }
    if (typeof Cache !== 'undefined') Cache.invalidate('clients');
    return true;
  },

  /* ---- REQUESTS ---- */
  async fetchRequests(status = null) {
    const filter = status ? `?status=eq.${status}&order=created_at.desc` : '?order=created_at.desc';
    const res = await fetch(`${SUPABASE_URL}/rest/v1/requests${filter}`, { headers: SUPABASE_HEADERS });
    if (!res.ok) throw new Error(`Requests fetch error ${res.status}`);
    return res.json();
  },

  async insertRequest(data) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/requests`, {
      method: 'POST', headers: SUPABASE_HEADERS, body: JSON.stringify(data)
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.message || `Insert error ${res.status}`); }
    return res.json();
  },

  async updateRequest(id, data) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/requests?id=eq.${id}`, {
      method: 'PATCH', headers: SUPABASE_HEADERS, body: JSON.stringify(data)
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.message || `Update error ${res.status}`); }
    return res.json();
  },

  async deleteRequest(id) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/requests?id=eq.${id}`, {
      method: 'DELETE', headers: SUPABASE_HEADERS
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
