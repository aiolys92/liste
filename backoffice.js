// ============================================
// BACK-OFFICE - Gestion des bugs
// ============================================

const BO = {
  currentPage: 1,
  itemsPerPage: 10,
  sortField: 'date',
  sortDir: 'desc',
  filters: { type: '', category: '', priority: '', state: '', search: '' },
  deleteTarget: null,

  init() {
    this.populateFilters();
    this.populateFormSelects();
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

  populateFormSelects() {
    const sel = (id, arr) => {
      const el = document.getElementById(id);
      el.innerHTML = '';
      arr.forEach(v => { const o = document.createElement('option'); o.value = v; o.textContent = v; el.appendChild(o); });
    };
    sel('fType', BugData.types);
    sel('fCategory', BugData.categories);
    sel('fPriority', BugData.priorities);
    sel('fState', BugData.states);
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

    // Fermer modal en cliquant l'overlay
    document.getElementById('modalOverlay').addEventListener('click', (e) => {
      if (e.target === document.getElementById('modalOverlay')) this.closeModal();
    });
    document.getElementById('confirmOverlay').addEventListener('click', (e) => {
      if (e.target === document.getElementById('confirmOverlay')) this.closeConfirm();
    });
  },

  renderStats() {
    const total = BugData.bugs.length;
    const critical = BugData.bugs.filter(b => b.priority === 'Critique').length;
    const inProgress = BugData.bugs.filter(b => b.state === 'En cours').length;
    const resolved = BugData.bugs.filter(b => b.state === 'Résolu').length;
    const newCount = BugData.bugs.filter(b => b.state === 'Nouveau').length;

    document.getElementById('statsRow').innerHTML = `
      <div class="stat-chip"><strong>${total}</strong> rapports</div>
      <div class="stat-chip" style="color:var(--s-new)"><strong>${newCount}</strong> nouveaux</div>
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

    document.querySelectorAll('[data-sort]').forEach(th => {
      th.classList.toggle('sorted', th.dataset.sort === this.sortField);
      const arrow = th.querySelector('.sort-arrow');
      if (arrow) arrow.textContent = th.dataset.sort === this.sortField ? (this.sortDir === 'asc' ? '↑' : '↓') : '↕';
    });

    const tbody = document.getElementById('bugsTableBody');
    if (page.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><div class="empty-icon">⊘</div>Aucun bug ne correspond aux filtres sélectionnés.</div></td></tr>`;
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
        <td class="col-type"><span class="badge badge-type-${typeSlug}">${this.esc(b.type)}</span></td>
        <td class="col-category"><span class="badge badge-cat-${catSlug}">${this.esc(b.category)}</span></td>
        <td class="col-id"><span class="bug-id">${this.esc(b.id)}</span></td>
        <td class="col-priority"><span class="badge badge-prio-${prioSlug}">${this.esc(b.priority)}</span></td>
        <td class="col-description">
          <div class="bug-desc">
            <div class="bug-desc-title">${this.esc(b.title)}</div>
            <div class="bug-desc-detail">${this.esc(b.description)}</div>
          </div>
        </td>
        <td class="col-state"><span class="badge badge-state-${stateSlug}">${this.esc(b.state)}</span></td>
        <td class="col-date">
          <div class="bug-date"><div class="date-main">${BugData.formatDate(b.date)}</div></div>
        </td>
        <td class="col-actions">
          <div class="action-cell">
            <button class="action-btn edit" onclick="BO.openEdit('${this.esc(b.id)}')">✏ Édit.</button>
            <button class="action-btn delete" onclick="BO.openDelete('${this.esc(b.id)}')">✕</button>
          </div>
        </td>
      </tr>
    `;
  },

  renderPagination(total, totalPages) {
    const el = document.getElementById('pagination');
    const start = (this.currentPage - 1) * this.itemsPerPage + 1;
    const end = Math.min(this.currentPage * this.itemsPerPage, total);

    let btns = `<button class="page-btn" onclick="BO.goPage(${this.currentPage - 1})" ${this.currentPage === 1 ? 'disabled' : ''}>‹</button>`;
    for (let i = 1; i <= totalPages; i++) {
      if (totalPages > 7 && Math.abs(i - this.currentPage) > 2 && i !== 1 && i !== totalPages) {
        if (i === 2 || i === totalPages - 1) btns += `<span class="page-btn" style="cursor:default;border:none;">…</span>`;
        continue;
      }
      btns += `<button class="page-btn ${i === this.currentPage ? 'active' : ''}" onclick="BO.goPage(${i})">${i}</button>`;
    }
    btns += `<button class="page-btn" onclick="BO.goPage(${this.currentPage + 1})" ${this.currentPage === totalPages ? 'disabled' : ''}>›</button>`;

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

  // ============================================
  // MODAL CRÉATION / ÉDITION
  // ============================================
  openCreate() {
    document.getElementById('modalTitle').textContent = 'Nouveau rapport';
    document.getElementById('editId').value = '';
    document.getElementById('fType').value = BugData.types[0];
    document.getElementById('fCategory').value = BugData.categories[0];
    document.getElementById('fPriority').value = BugData.priorities[2];
    document.getElementById('fState').value = 'Nouveau';
    document.getElementById('fTitle').value = '';
    document.getElementById('fDescription').value = '';
    document.getElementById('fDate').value = new Date().toISOString().slice(0, 10);
    document.getElementById('modalOverlay').classList.remove('hidden');
    document.getElementById('fTitle').focus();
  },

  openEdit(id) {
    const bug = BugData.bugs.find(b => b.id === id);
    if (!bug) return;
    document.getElementById('modalTitle').textContent = `Modifier ${id}`;
    document.getElementById('editId').value = bug.id;
    document.getElementById('fType').value = bug.type;
    document.getElementById('fCategory').value = bug.category;
    document.getElementById('fPriority').value = bug.priority;
    document.getElementById('fState').value = bug.state;
    document.getElementById('fTitle').value = bug.title;
    document.getElementById('fDescription').value = bug.description;
    document.getElementById('fDate').value = bug.date;
    document.getElementById('modalOverlay').classList.remove('hidden');
    document.getElementById('fTitle').focus();
  },

  closeModal() {
    document.getElementById('modalOverlay').classList.add('hidden');
  },

  save() {
    const id = document.getElementById('editId').value;
    const title = document.getElementById('fTitle').value.trim();
    const description = document.getElementById('fDescription').value.trim();
    const date = document.getElementById('fDate').value;

    if (!title || !description || !date) {
      this.showNotif('Veuillez remplir tous les champs obligatoires.', true);
      return;
    }

    const data = {
      type: document.getElementById('fType').value,
      category: document.getElementById('fCategory').value,
      priority: document.getElementById('fPriority').value,
      state: document.getElementById('fState').value,
      title,
      description,
      date
    };

    if (id) {
      // Mise à jour
      const idx = BugData.bugs.findIndex(b => b.id === id);
      if (idx !== -1) BugData.bugs[idx] = { ...BugData.bugs[idx], ...data };
      this.showNotif(`✓ Bug ${id} mis à jour`);
    } else {
      // Création
      const newId = BugData.generateId();
      BugData.bugs.unshift({ id: newId, ...data });
      this.showNotif(`✓ Bug ${newId} créé`);
    }

    this.closeModal();
    this.renderStats();
    this.render();
  },

  // ============================================
  // MODAL SUPPRESSION
  // ============================================
  openDelete(id) {
    const bug = BugData.bugs.find(b => b.id === id);
    if (!bug) return;
    this.deleteTarget = id;
    document.getElementById('confirmBugTitle').textContent = `[${bug.id}] ${bug.title}`;
    document.getElementById('confirmOverlay').classList.remove('hidden');
  },

  closeConfirm() {
    document.getElementById('confirmOverlay').classList.add('hidden');
    this.deleteTarget = null;
  },

  confirmDelete() {
    if (!this.deleteTarget) return;
    const idx = BugData.bugs.findIndex(b => b.id === this.deleteTarget);
    const id = this.deleteTarget;
    if (idx !== -1) BugData.bugs.splice(idx, 1);
    this.closeConfirm();
    this.renderStats();
    this.render();
    this.showNotif(`✓ Bug ${id} supprimé`);
  },

  // ============================================
  // NOTIFICATION
  // ============================================
  showNotif(msg, isError = false) {
    const el = document.getElementById('notification');
    el.textContent = msg;
    el.classList.toggle('error', isError);
    el.classList.remove('hidden');
    clearTimeout(this._notifTimer);
    this._notifTimer = setTimeout(() => el.classList.add('hidden'), 3000);
  },

  esc(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
};

document.addEventListener('DOMContentLoaded', () => BO.init());
