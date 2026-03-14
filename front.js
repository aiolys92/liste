// ============================================
// FRONT - Lecture seule
// ============================================

const Front = {
  currentPage: 1,
  itemsPerPage: 10,
  sortField: 'date',
  sortDir: 'desc',
  filters: { type: '', category: '', priority: '', state: '', search: '' },

  init() {
    this.populateFilters();
    this.bindEvents();
    this.renderStats();
    this.render();
  },

  populateFilters() {
    const sel = (id, arr) => {
      const el = document.getElementById(id);
      arr.forEach(v => { const o = document.createElement('option'); o.value = v; o.textContent = v; el.appendChild(o); });
    };
    sel('filterType', BugData.types);
    sel('filterCategory', BugData.categories);
    sel('filterPriority', BugData.priorities);
    sel('filterState', BugData.states);
  },

  bindEvents() {
    ['filterType','filterCategory','filterPriority','filterState'].forEach(id => {
      document.getElementById(id).addEventListener('change', (e) => {
        const map = { filterType:'type', filterCategory:'category', filterPriority:'priority', filterState:'state' };
        this.filters[map[id]] = e.target.value;
        this.currentPage = 1;
        this.render();
      });
    });

    document.getElementById('searchInput').addEventListener('input', (e) => {
      this.filters.search = e.target.value.toLowerCase();
      this.currentPage = 1;
      this.render();
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
    const total = BugData.bugs.length;
    const critical = BugData.bugs.filter(b => b.priority === 'Critique').length;
    const inProgress = BugData.bugs.filter(b => b.state === 'En cours').length;
    const resolved = BugData.bugs.filter(b => b.state === 'Résolu').length;

    document.getElementById('statsRow').innerHTML = `
      <div class="stat-chip"><strong>${total}</strong> rapports</div>
      <div class="stat-chip" style="color:var(--p-critical)"><strong>${critical}</strong> critiques</div>
      <div class="stat-chip" style="color:var(--s-progress)"><strong>${inProgress}</strong> en cours</div>
      <div class="stat-chip" style="color:var(--s-resolved)"><strong>${resolved}</strong> résolus</div>
    `;
  },

  getFiltered() {
    return BugData.bugs.filter(b => {
      if (this.filters.type && b.type !== this.filters.type) return false;
      if (this.filters.category && b.category !== this.filters.category) return false;
      if (this.filters.priority && b.priority !== this.filters.priority) return false;
      if (this.filters.state && b.state !== this.filters.state) return false;
      if (this.filters.search) {
        const s = this.filters.search;
        if (!b.title.toLowerCase().includes(s) && !b.description.toLowerCase().includes(s) && !b.id.toLowerCase().includes(s)) return false;
      }
      return true;
    });
  },

  getSorted(list) {
    const priorityOrder = { 'Critique': 0, 'Haute': 1, 'Moyenne': 2, 'Basse': 3, 'Mineure': 4 };
    return [...list].sort((a, b) => {
      let va = a[this.sortField], vb = b[this.sortField];
      if (this.sortField === 'priority') { va = priorityOrder[va] ?? 99; vb = priorityOrder[vb] ?? 99; }
      if (va < vb) return this.sortDir === 'asc' ? -1 : 1;
      if (va > vb) return this.sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  },

  render() {
    const filtered = this.getSorted(this.getFiltered());
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / this.itemsPerPage));
    this.currentPage = Math.min(this.currentPage, totalPages);

    const start = (this.currentPage - 1) * this.itemsPerPage;
    const page = filtered.slice(start, start + this.itemsPerPage);

    document.getElementById('filterCount').textContent = `${total} résultat${total > 1 ? 's' : ''}`;

    // Trier visuellement les th
    document.querySelectorAll('[data-sort]').forEach(th => {
      th.classList.toggle('sorted', th.dataset.sort === this.sortField);
      const arrow = th.querySelector('.sort-arrow');
      if (arrow) arrow.textContent = th.dataset.sort === this.sortField ? (this.sortDir === 'asc' ? '↑' : '↓') : '↕';
    });

    const tbody = document.getElementById('bugsTableBody');
    if (page.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">⊘</div>Aucun bug ne correspond aux filtres sélectionnés.</div></td></tr>`;
    } else {
      tbody.innerHTML = page.map(b => this.renderRow(b)).join('');
    }

    this.renderPagination(total, totalPages);
  },

  renderRow(b) {
    const typeSlug = BugData.toSlug(b.type);
    const catSlug = BugData.toSlug(b.category);
    const prioSlug = BugData.toSlug(b.priority);
    const stateSlug = BugData.toSlug(b.state);

    return `
      <tr>
        <td class="col-type"><span class="badge badge-type-${typeSlug}">${b.type}</span></td>
        <td class="col-category"><span class="badge badge-cat-${catSlug}">${b.category}</span></td>
        <td class="col-id"><span class="bug-id">${b.id}</span></td>
        <td class="col-priority"><span class="badge badge-prio-${prioSlug}">${b.priority}</span></td>
        <td class="col-description">
          <div class="bug-desc">
            <div class="bug-desc-title">${this.escape(b.title)}</div>
            <div class="bug-desc-detail">${this.escape(b.description)}</div>
          </div>
        </td>
        <td class="col-state"><span class="badge badge-state-${stateSlug}">${b.state}</span></td>
        <td class="col-date">
          <div class="bug-date">
            <div class="date-main">${BugData.formatDate(b.date)}</div>
          </div>
        </td>
      </tr>
    `;
  },

  renderPagination(total, totalPages) {
    const el = document.getElementById('pagination');
    const start = (this.currentPage - 1) * this.itemsPerPage + 1;
    const end = Math.min(this.currentPage * this.itemsPerPage, total);

    let btns = `<button class="page-btn" onclick="Front.goPage(${this.currentPage - 1})" ${this.currentPage === 1 ? 'disabled' : ''}>‹</button>`;
    for (let i = 1; i <= totalPages; i++) {
      if (totalPages > 7 && Math.abs(i - this.currentPage) > 2 && i !== 1 && i !== totalPages) {
        if (i === 2 || i === totalPages - 1) btns += `<span class="page-btn" style="cursor:default;border:none;">…</span>`;
        continue;
      }
      btns += `<button class="page-btn ${i === this.currentPage ? 'active' : ''}" onclick="Front.goPage(${i})">${i}</button>`;
    }
    btns += `<button class="page-btn" onclick="Front.goPage(${this.currentPage + 1})" ${this.currentPage === totalPages ? 'disabled' : ''}>›</button>`;

    el.innerHTML = `
      <span class="pagination-info">Affichage ${total === 0 ? 0 : start}–${end} sur ${total}</span>
      <div class="pagination-controls">${btns}</div>
    `;
  },

  goPage(p) {
    const filtered = this.getFiltered();
    const totalPages = Math.max(1, Math.ceil(filtered.length / this.itemsPerPage));
    if (p < 1 || p > totalPages) return;
    this.currentPage = p;
    this.render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  escape(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
};

document.addEventListener('DOMContentLoaded', () => Front.init());
