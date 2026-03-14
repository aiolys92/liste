// ============================================
// FRONT — Lecture seule + Supabase
// ============================================

const Front = {
  bugs: [],
  currentPage: 1,
  itemsPerPage: 10,
  sortField: 'date',
  sortDir: 'desc',
  filters: { type: '', category: '', priority: '', state: '', search: '' },

  types:      ['Bug','Amélioration','Régression'],
  categories: ['Gameplay','Interface','Graphismes','Audio','Serveur','Texte','Combat','Quête'],
  priorities: ['Critique','Haute','Moyenne','Basse','Mineure'],
  states:     ['Nouveau','En cours','Résolu','Fermé','Rejeté','En attente'],

  async init() {
    this.populateFilters();
    this.bindEvents();
    this.showLoading(true);
    try {
      this.bugs = await DB.fetchBugs();
    } catch(e) {
      this.showError('Impossible de charger les données. Vérifiez votre connexion.');
    }
    this.showLoading(false);
    this.renderStats();
    this.render();
  },

  showLoading(on) {
    document.getElementById('loadingRow').style.display = on ? '' : 'none';
  },

  showError(msg) {
    const el = document.getElementById('errorBanner');
    el.textContent = msg;
    el.style.display = 'block';
  },

  populateFilters() {
    const sel = (id, arr) => {
      const el = document.getElementById(id);
      arr.forEach(v => { const o = document.createElement('option'); o.value = v; o.textContent = v; el.appendChild(o); });
    };
    sel('filterType', this.types);
    sel('filterCategory', this.categories);
    sel('filterPriority', this.priorities);
    sel('filterState', this.states);
  },

  bindEvents() {
    ['filterType','filterCategory','filterPriority','filterState'].forEach(id => {
      document.getElementById(id).addEventListener('change', (e) => {
        const map = { filterType:'type', filterCategory:'category', filterPriority:'priority', filterState:'state' };
        this.filters[map[id]] = e.target.value;
        this.currentPage = 1; this.render();
      });
    });
    document.getElementById('searchInput').addEventListener('input', (e) => {
      this.filters.search = e.target.value.toLowerCase();
      this.currentPage = 1; this.render();
    });
    document.querySelectorAll('[data-sort]').forEach(th => {
      th.addEventListener('click', () => {
        const f = th.dataset.sort;
        if (this.sortField === f) this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
        else { this.sortField = f; this.sortDir = 'asc'; }
        this.render();
      });
    });
  },

  renderStats() {
    const total    = this.bugs.length;
    const critical = this.bugs.filter(b => b.priority === 'Critique').length;
    const progress = this.bugs.filter(b => b.state    === 'En cours').length;
    const resolved = this.bugs.filter(b => b.state    === 'Résolu').length;
    document.getElementById('statsRow').innerHTML = `
      <div class="stat-chip"><strong>${total}</strong> rapports</div>
      <div class="stat-chip" style="color:var(--p-critical)"><span class="stat-chip-dot"></span><strong>${critical}</strong> critiques</div>
      <div class="stat-chip" style="color:var(--s-progress)"><span class="stat-chip-dot"></span><strong>${progress}</strong> en cours</div>
      <div class="stat-chip" style="color:var(--s-resolved)"><span class="stat-chip-dot"></span><strong>${resolved}</strong> résolus</div>
    `;
  },

  getFiltered() {
    return this.bugs.filter(b => {
      if (this.filters.type     && b.type     !== this.filters.type)     return false;
      if (this.filters.category && b.category !== this.filters.category) return false;
      if (this.filters.priority && b.priority !== this.filters.priority) return false;
      if (this.filters.state    && b.state    !== this.filters.state)    return false;
      if (this.filters.search) {
        const s = this.filters.search;
        if (!b.title?.toLowerCase().includes(s) &&
            !b.description?.toLowerCase().includes(s) &&
            !b.id?.toLowerCase().includes(s)) return false;
      }
      return true;
    });
  },

  getSorted(list) {
    const po = { 'Critique':0,'Haute':1,'Moyenne':2,'Basse':3,'Mineure':4 };
    return [...list].sort((a, b) => {
      let va = a[this.sortField], vb = b[this.sortField];
      if (this.sortField === 'priority') { va = po[va]??99; vb = po[vb]??99; }
      if (va < vb) return this.sortDir === 'asc' ? -1 : 1;
      if (va > vb) return this.sortDir === 'asc' ?  1 : -1;
      return 0;
    });
  },

  render() {
    const filtered   = this.getSorted(this.getFiltered());
    const total      = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / this.itemsPerPage));
    this.currentPage = Math.min(this.currentPage, totalPages);
    const start = (this.currentPage - 1) * this.itemsPerPage;
    const page  = filtered.slice(start, start + this.itemsPerPage);

    document.getElementById('filterCount').textContent = `${total} résultat${total > 1 ? 's' : ''}`;

    document.querySelectorAll('[data-sort]').forEach(th => {
      th.classList.toggle('sorted', th.dataset.sort === this.sortField);
      const arrow = th.querySelector('.sort-arrow');
      if (arrow) arrow.textContent = th.dataset.sort === this.sortField ? (this.sortDir === 'asc' ? '↑' : '↓') : '↕';
    });

    const tbody = document.getElementById('bugsTableBody');
    if (page.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><span class="empty-icon">⊘</span><p>Aucun bug ne correspond aux filtres sélectionnés.</p></div></td></tr>`;
    } else {
      tbody.innerHTML = page.map(b => this.renderRow(b)).join('');
    }
    this.renderPagination(total, totalPages);
  },

  renderRow(b) {
    const ts = this.toSlug, d = this.esc.bind(this);
    return `
      <tr>
        <td class="col-type"><span class="badge badge-type-${ts(b.type)}"><span class="badge-dot"></span>${d(b.type)}</span></td>
        <td class="col-category"><span class="badge badge-cat-${ts(b.category)}"><span class="badge-dot"></span>${d(b.category)}</span></td>
        <td class="col-id"><span class="bug-id">${d(b.id)}</span></td>
        <td class="col-priority"><span class="badge badge-prio-${ts(b.priority)}"><span class="badge-dot"></span>${d(b.priority)}</span></td>
        <td class="col-description">
          <div class="bug-desc">
            <div class="bug-desc-title">${d(b.title)}</div>
            <div class="bug-desc-detail">${d(b.description)}</div>
          </div>
        </td>
        <td class="col-state"><span class="badge badge-state-${ts(b.state)}"><span class="badge-dot"></span>${d(b.state)}</span></td>
        <td class="col-date"><div class="bug-date"><div class="date-main">${this.fmtDate(b.date)}</div></div></td>
      </tr>`;
  },

  renderPagination(total, totalPages) {
    const el = document.getElementById('pagination');
    const start = (this.currentPage - 1) * this.itemsPerPage + 1;
    const end   = Math.min(this.currentPage * this.itemsPerPage, total);
    let btns = `<button class="page-btn" onclick="Front.goPage(${this.currentPage-1})" ${this.currentPage===1?'disabled':''}>‹</button>`;
    for (let i = 1; i <= totalPages; i++) {
      if (totalPages > 7 && Math.abs(i - this.currentPage) > 2 && i !== 1 && i !== totalPages) {
        if (i === 2 || i === totalPages - 1) btns += `<span class="page-btn" style="cursor:default;border:none;opacity:.4">…</span>`;
        continue;
      }
      btns += `<button class="page-btn ${i===this.currentPage?'active':''}" onclick="Front.goPage(${i})">${i}</button>`;
    }
    btns += `<button class="page-btn" onclick="Front.goPage(${this.currentPage+1})" ${this.currentPage===totalPages?'disabled':''}>›</button>`;
    el.innerHTML = `<span class="pagination-info">Affichage ${total===0?0:start}–${end} sur ${total}</span><div class="pagination-controls">${btns}</div>`;
  },

  goPage(p) {
    const t = Math.max(1, Math.ceil(this.getFiltered().length / this.itemsPerPage));
    if (p < 1 || p > t) return;
    this.currentPage = p; this.render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  toSlug(str) {
    return String(str).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'');
  },

  fmtDate(d) {
    if (!d) return '—';
    const dt = new Date(d);
    return dt.toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric' });
  },

  esc(str) {
    return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
};

document.addEventListener('DOMContentLoaded', () => Front.init());
