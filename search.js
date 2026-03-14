// ============================================
// RECHERCHE GLOBALE — Cmd+K / Ctrl+K
// ============================================
const GlobalSearch = {
  bugs: [],
  open: false,
  selectedIdx: -1,
  results: [],

  async init() {
    // Charger les bugs pour la recherche
    try {
      const cached = Cache.get('search_bugs');
      if (cached) { this.bugs = cached; }
      else {
        const res = await DB.fetchBugs();
        this.bugs = res;
        Cache.set('search_bugs', res);
      }
    } catch(e) {}

    this._injectUI();
    this._bindKeys();
  },

  _injectUI() {
    const overlay = document.createElement('div');
    overlay.id = 'gs-overlay';
    overlay.style.cssText = `
      position:fixed;inset:0;background:rgba(4,5,8,0.75);backdrop-filter:blur(6px);
      z-index:5000;display:none;align-items:flex-start;justify-content:center;padding-top:80px;
    `;
    overlay.innerHTML = `
      <div id="gs-box" style="
        background:var(--bg-overlay);border:1px solid var(--border-strong);
        border-radius:var(--r-xl);width:100%;max-width:580px;
        box-shadow:0 24px 64px rgba(0,0,0,0.7);overflow:hidden;
        animation:slideUp 0.18s cubic-bezier(0.34,1.56,0.64,1);
      ">
        <div style="display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid var(--border-base);">
          <span style="color:var(--text-muted);font-size:16px;">⌕</span>
          <input id="gs-input" type="text" placeholder="Rechercher une mission, un ID…"
            style="flex:1;background:none;border:none;outline:none;font-family:'DM Sans',sans-serif;
            font-size:15px;color:var(--text-bright);" autocomplete="off">
          <kbd style="font-size:10px;color:var(--text-faint);background:var(--bg-raised);
            border:1px solid var(--border-base);border-radius:4px;padding:2px 6px;">Esc</kbd>
        </div>
        <div id="gs-results" style="max-height:400px;overflow-y:auto;padding:6px;"></div>
        <div style="padding:8px 16px;border-top:1px solid var(--border-dim);
          display:flex;gap:16px;font-size:11px;color:var(--text-faint);">
          <span>↑↓ naviguer</span><span>↵ ouvrir</span><span>Esc fermer</span>
        </div>
      </div>`;
    overlay.addEventListener('click', e => { if(e.target===overlay) this.close(); });
    document.body.appendChild(overlay);

    document.getElementById('gs-input').addEventListener('input', e => this.search(e.target.value));
    document.getElementById('gs-input').addEventListener('keydown', e => this._onKey(e));
  },

  _bindKeys() {
    document.addEventListener('keydown', e => {
      // Cmd+K ou Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); this.toggle(); }
      // / pour focus recherche locale si pas dans un input
      if (e.key === '/' && !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)) {
        e.preventDefault(); this.open ? this.close() : this.show();
      }
      if (e.key === 'Escape' && this.open) this.close();
    });
  },

  toggle() { this.open ? this.close() : this.show(); },

  show() {
    this.open = true;
    const overlay = document.getElementById('gs-overlay');
    overlay.style.display = 'flex';
    document.getElementById('gs-input').value = '';
    document.getElementById('gs-results').innerHTML = this._renderEmpty('Tapez pour rechercher…');
    setTimeout(() => document.getElementById('gs-input').focus(), 50);
  },

  close() {
    this.open = false;
    document.getElementById('gs-overlay').style.display = 'none';
    this.selectedIdx = -1;
  },

  search(q) {
    const query = q.trim().toLowerCase();
    if (!query) { document.getElementById('gs-results').innerHTML = this._renderEmpty('Tapez pour rechercher…'); return; }

    this.results = this.bugs.filter(b =>
      b.title?.toLowerCase().includes(query) ||
      b.description?.toLowerCase().includes(query) ||
      b.id?.toLowerCase().includes(query) ||
      b.category?.toLowerCase().includes(query) ||
      b.assignee?.toLowerCase().includes(query)
    ).slice(0, 12);

    this.selectedIdx = this.results.length ? 0 : -1;
    this._renderResults();
  },

  _renderResults() {
    const el = document.getElementById('gs-results');
    if (!this.results.length) { el.innerHTML = this._renderEmpty('Aucun résultat.'); return; }

    const d  = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const ts = s => String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'');

    el.innerHTML = this.results.map((b, i) => `
      <div class="gs-item ${i===this.selectedIdx?'gs-item-active':''}"
        onclick="GlobalSearch.pick(${i})"
        onmouseenter="GlobalSearch.selectedIdx=${i};GlobalSearch._renderResults()"
        style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:var(--r-md);
        cursor:pointer;transition:background 0.1s;
        background:${i===this.selectedIdx?'var(--bg-hover)':'transparent'};">
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;font-weight:600;color:var(--text-bright);
            white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${d(b.title)}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:2px;display:flex;gap:6px;align-items:center;">
            <span class="bug-id" style="font-size:10px;">${d(b.id)}</span>
            <span class="badge badge-cat-${ts(b.category)}" style="font-size:9px;">${d(b.category)}</span>
            <span class="badge badge-state-${ts(b.state)}" style="font-size:9px;"><span class="badge-dot"></span>${d(b.state)}</span>
          </div>
        </div>
        <span class="badge badge-prio-${ts(b.priority)}" style="font-size:10px;flex-shrink:0;">
          <span class="badge-dot"></span>${d(b.priority)}
        </span>
      </div>`).join('');
  },

  _renderEmpty(msg) {
    return `<div style="text-align:center;padding:32px;color:var(--text-faint);font-size:13px;">${msg}</div>`;
  },

  _onKey(e) {
    if (!this.results.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); this.selectedIdx = Math.min(this.selectedIdx+1, this.results.length-1); this._renderResults(); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); this.selectedIdx = Math.max(this.selectedIdx-1, 0); this._renderResults(); }
    if (e.key === 'Enter')     { e.preventDefault(); this.pick(this.selectedIdx); }
  },

  pick(idx) {
    if (idx < 0 || idx >= this.results.length) return;
    const bug = this.results[idx];
    this.close();
    // Ouvrir la modale de détail si disponible, sinon naviguer
    if (typeof Front !== 'undefined' && Front.openDetail) Front.openDetail(bug.id);
    else if (typeof BO !== 'undefined' && BO.openDetail)  BO.openDetail(bug.id);
  }
};

document.addEventListener('DOMContentLoaded', () => GlobalSearch.init());
