// ============================================
// BACK-OFFICE — Supabase + Auth + Config
// ============================================

if (sessionStorage.getItem('bo_auth') !== 'ok') {
  window.location.href = 'login.html';
}

const BO = {
  bugs: [],
  config: { types: [], categories: [], priorities: ['Critique','Haute','Moyenne','Basse','Mineure'], states: ['Nouveau','En cours','Résolu','Fermé','Rejeté','En attente'] },
  currentPage: 1,
  itemsPerPage: 10,
  sortField: 'date',
  sortDir: 'desc',
  filters: { type:'', category:'', priority:'', state:'', search:'' },
  deleteTarget: null,
  activeTab: 'bugs', // 'bugs' | 'config'

  // ============================================================
  // INIT
  // ============================================================
  async init() {
    this.bindTabEvents();
    this.bindTableEvents();
    this.bindModalEvents();
    this.showLoading(true);
    try {
      const [bugs, cfg] = await Promise.all([DB.fetchBugs(), DB.fetchConfig()]);
      this.bugs = bugs;
      if (cfg.types)      this.config.types      = cfg.types;
      if (cfg.categories) this.config.categories = cfg.categories;
    } catch(e) {
      this.showNotif('Erreur de chargement : ' + e.message, true);
    }
    this.showLoading(false);
    this.populateFilters();
    this.populateFormSelects();
    this.renderStats();
    this.render();
    this.renderConfigTab();
  },

  showLoading(on) {
    document.getElementById('loadingRow').style.display = on ? '' : 'none';
  },

  // ============================================================
  // TABS
  // ============================================================
  bindTabEvents() {
    document.getElementById('tabBugs').addEventListener('click',   () => this.switchTab('bugs'));
    document.getElementById('tabConfig').addEventListener('click', () => this.switchTab('config'));
  },

  switchTab(tab) {
    this.activeTab = tab;
    document.getElementById('tabBugs').classList.toggle('tab-active',   tab === 'bugs');
    document.getElementById('tabConfig').classList.toggle('tab-active', tab === 'config');
    document.getElementById('panelBugs').style.display   = tab === 'bugs'   ? '' : 'none';
    document.getElementById('panelConfig').style.display = tab === 'config' ? '' : 'none';
    document.getElementById('btnNewBug').style.display   = tab === 'bugs'   ? '' : 'none';
  },

  // ============================================================
  // FILTRES & SELECTS
  // ============================================================
  populateFilters() {
    const rebuild = (id, arr, allLabel) => {
      const el = document.getElementById(id);
      const cur = el.value;
      el.innerHTML = `<option value="">${allLabel}</option>`;
      arr.forEach(v => { const o = document.createElement('option'); o.value = v; o.textContent = v; el.appendChild(o); });
      if ([...el.options].some(o => o.value === cur)) el.value = cur;
    };
    rebuild('filterType',     this.config.types,      'Tous');
    rebuild('filterCategory', this.config.categories, 'Toutes');
    rebuild('filterPriority', this.config.priorities, 'Toutes');
    rebuild('filterState',    this.config.states,     'Tous');
  },

  populateFormSelects() {
    const rebuild = (id, arr) => {
      const el = document.getElementById(id);
      const cur = el.value;
      el.innerHTML = '';
      arr.forEach(v => { const o = document.createElement('option'); o.value = v; o.textContent = v; el.appendChild(o); });
      if ([...el.options].some(o => o.value === cur)) el.value = cur;
    };
    rebuild('fType',     this.config.types);
    rebuild('fCategory', this.config.categories);
    rebuild('fPriority', this.config.priorities);
    rebuild('fState',    this.config.states);
  },

  bindTableEvents() {
    ['filterType','filterCategory','filterPriority','filterState'].forEach(id => {
      document.getElementById(id).addEventListener('change', (e) => {
        const map = { filterType:'type', filterCategory:'category', filterPriority:'priority', filterState:'state' };
        this.filters[map[id]] = e.target.value; this.currentPage = 1; this.render();
      });
    });
    document.getElementById('searchInput').addEventListener('input', (e) => {
      this.filters.search = e.target.value.toLowerCase(); this.currentPage = 1; this.render();
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

  bindModalEvents() {
    document.getElementById('modalOverlay').addEventListener('click',   e => { if (e.target === document.getElementById('modalOverlay'))   this.closeModal(); });
    document.getElementById('confirmOverlay').addEventListener('click', e => { if (e.target === document.getElementById('confirmOverlay')) this.closeConfirm(); });
  },

  // ============================================================
  // STATS
  // ============================================================
  renderStats() {
    const t = this.bugs, total = t.length;
    const nw = t.filter(b => b.state==='Nouveau').length;
    const cr = t.filter(b => b.priority==='Critique').length;
    const pr = t.filter(b => b.state==='En cours').length;
    const rs = t.filter(b => b.state==='Résolu').length;
    document.getElementById('statsRow').innerHTML = `
      <div class="stat-chip"><strong>${total}</strong> rapports</div>
      <div class="stat-chip" style="color:var(--s-new)"><span class="stat-chip-dot"></span><strong>${nw}</strong> nouveaux</div>
      <div class="stat-chip" style="color:var(--p-critical)"><span class="stat-chip-dot"></span><strong>${cr}</strong> critiques</div>
      <div class="stat-chip" style="color:var(--s-progress)"><span class="stat-chip-dot"></span><strong>${pr}</strong> en cours</div>
      <div class="stat-chip" style="color:var(--s-resolved)"><span class="stat-chip-dot"></span><strong>${rs}</strong> résolus</div>
    `;
  },

  // ============================================================
  // TABLE BUGS
  // ============================================================
  getFiltered() {
    return this.bugs.filter(b => {
      if (this.filters.type     && b.type     !== this.filters.type)     return false;
      if (this.filters.category && b.category !== this.filters.category) return false;
      if (this.filters.priority && b.priority !== this.filters.priority) return false;
      if (this.filters.state    && b.state    !== this.filters.state)    return false;
      if (this.filters.search) {
        const s = this.filters.search;
        if (!b.title?.toLowerCase().includes(s) && !b.description?.toLowerCase().includes(s) && !b.id?.toLowerCase().includes(s)) return false;
      }
      return true;
    });
  },

  getSorted(list) {
    const po = {'Critique':0,'Haute':1,'Moyenne':2,'Basse':3,'Mineure':4};
    return [...list].sort((a,b) => {
      let va = a[this.sortField], vb = b[this.sortField];
      if (this.sortField==='priority') { va=po[va]??99; vb=po[vb]??99; }
      if (va<vb) return this.sortDir==='asc'?-1:1;
      if (va>vb) return this.sortDir==='asc'?1:-1;
      return 0;
    });
  },

  render() {
    const filtered   = this.getSorted(this.getFiltered());
    const total      = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total/this.itemsPerPage));
    this.currentPage = Math.min(this.currentPage, totalPages);
    const start = (this.currentPage-1)*this.itemsPerPage;
    const page  = filtered.slice(start, start+this.itemsPerPage);

    document.getElementById('filterCount').textContent = `${total} résultat${total>1?'s':''}`;
    document.querySelectorAll('[data-sort]').forEach(th => {
      th.classList.toggle('sorted', th.dataset.sort===this.sortField);
      const arrow = th.querySelector('.sort-arrow');
      if (arrow) arrow.textContent = th.dataset.sort===this.sortField?(this.sortDir==='asc'?'↑':'↓'):'↕';
    });

    const tbody = document.getElementById('bugsTableBody');
    tbody.innerHTML = page.length === 0
      ? `<tr><td colspan="8"><div class="empty-state"><span class="empty-icon">⊘</span><p>Aucun bug ne correspond aux filtres.</p></div></td></tr>`
      : page.map(b => this.renderRow(b)).join('');

    this.renderPagination(total, totalPages);
  },

  renderRow(b) {
    const ts=this.toSlug, d=this.esc.bind(this);
    return `<tr>
      <td class="col-type"><span class="badge badge-type-${ts(b.type)}"><span class="badge-dot"></span>${d(b.type)}</span></td>
      <td class="col-category"><span class="badge badge-cat-${ts(b.category)}"><span class="badge-dot"></span>${d(b.category)}</span></td>
      <td class="col-id"><span class="bug-id">${d(b.id)}</span></td>
      <td class="col-priority"><span class="badge badge-prio-${ts(b.priority)}"><span class="badge-dot"></span>${d(b.priority)}</span></td>
      <td class="col-description"><div class="bug-desc"><div class="bug-desc-title">${d(b.title)}</div><div class="bug-desc-detail">${d(b.description)}</div></div></td>
      <td class="col-state"><span class="badge badge-state-${ts(b.state)}"><span class="badge-dot"></span>${d(b.state)}</span></td>
      <td class="col-date"><div class="bug-date"><div class="date-main">${this.fmtDate(b.date)}</div></div></td>
      <td class="col-actions"><div class="action-cell">
        <button class="action-btn edit"   onclick="BO.openEdit('${d(b.id)}')">✏ Édit.</button>
        <button class="action-btn delete" onclick="BO.openDelete('${d(b.id)}')">✕</button>
      </div></td>
    </tr>`;
  },

  renderPagination(total, totalPages) {
    const el = document.getElementById('pagination');
    const s  = (this.currentPage-1)*this.itemsPerPage+1;
    const e  = Math.min(this.currentPage*this.itemsPerPage, total);
    let btns = `<button class="page-btn" onclick="BO.goPage(${this.currentPage-1})" ${this.currentPage===1?'disabled':''}>‹</button>`;
    for (let i=1; i<=totalPages; i++) {
      if (totalPages>7 && Math.abs(i-this.currentPage)>2 && i!==1 && i!==totalPages) {
        if (i===2||i===totalPages-1) btns+=`<span class="page-btn" style="cursor:default;border:none;opacity:.4">…</span>`;
        continue;
      }
      btns+=`<button class="page-btn ${i===this.currentPage?'active':''}" onclick="BO.goPage(${i})">${i}</button>`;
    }
    btns+=`<button class="page-btn" onclick="BO.goPage(${this.currentPage+1})" ${this.currentPage===totalPages?'disabled':''}>›</button>`;
    el.innerHTML=`<span class="pagination-info">Affichage ${total===0?0:s}–${e} sur ${total}</span><div class="pagination-controls">${btns}</div>`;
  },

  goPage(p) {
    const t = Math.max(1, Math.ceil(this.getFiltered().length/this.itemsPerPage));
    if (p<1||p>t) return;
    this.currentPage=p; this.render();
    window.scrollTo({top:0,behavior:'smooth'});
  },

  // ============================================================
  // MODAL BUGS
  // ============================================================
  openCreate() {
    document.getElementById('modalTitle').textContent = 'Nouveau rapport';
    document.getElementById('editId').value = '';
    document.getElementById('fType').value     = this.config.types[0] || '';
    document.getElementById('fCategory').value = this.config.categories[0] || '';
    document.getElementById('fPriority').value = 'Moyenne';
    document.getElementById('fState').value    = 'Nouveau';
    document.getElementById('fTitle').value       = '';
    document.getElementById('fDescription').value = '';
    document.getElementById('fDate').value = new Date().toISOString().slice(0,10);
    document.getElementById('modalOverlay').classList.remove('hidden');
    document.getElementById('fTitle').focus();
  },

  openEdit(id) {
    const bug = this.bugs.find(b=>b.id===id); if (!bug) return;
    document.getElementById('modalTitle').textContent = `Modifier ${id}`;
    document.getElementById('editId').value           = bug.id;
    document.getElementById('fType').value            = bug.type;
    document.getElementById('fCategory').value        = bug.category;
    document.getElementById('fPriority').value        = bug.priority;
    document.getElementById('fState').value           = bug.state;
    document.getElementById('fTitle').value           = bug.title;
    document.getElementById('fDescription').value     = bug.description;
    document.getElementById('fDate').value            = bug.date;
    document.getElementById('modalOverlay').classList.remove('hidden');
    document.getElementById('fTitle').focus();
  },

  closeModal() { document.getElementById('modalOverlay').classList.add('hidden'); },

  async save() {
    const id          = document.getElementById('editId').value;
    const title       = document.getElementById('fTitle').value.trim();
    const description = document.getElementById('fDescription').value.trim();
    const date        = document.getElementById('fDate').value;
    if (!title||!description||!date) { this.showNotif('Remplissez tous les champs.', true); return; }
    const data = {
      type:     document.getElementById('fType').value,
      category: document.getElementById('fCategory').value,
      priority: document.getElementById('fPriority').value,
      state:    document.getElementById('fState').value,
      title, description, date
    };
    const btn = document.querySelector('.modal-footer .btn-primary');
    btn.textContent='Sauvegarde…'; btn.disabled=true;
    try {
      if (id) {
        await DB.updateBug(id, data);
        const idx=this.bugs.findIndex(b=>b.id===id);
        if (idx!==-1) this.bugs[idx]={...this.bugs[idx],...data};
        this.showNotif(`✓ Bug ${id} mis à jour`);
      } else {
        const newId=DB.nextId(this.bugs);
        const created=await DB.insertBug({id:newId,...data});
        this.bugs.unshift(Array.isArray(created)?created[0]:{id:newId,...data});
        this.showNotif(`✓ Bug ${newId} créé`);
      }
      this.closeModal(); this.renderStats(); this.render();
    } catch(e) { this.showNotif('Erreur : '+e.message, true); }
    finally { btn.textContent='Enregistrer'; btn.disabled=false; }
  },

  openDelete(id) {
    const bug=this.bugs.find(b=>b.id===id); if (!bug) return;
    this.deleteTarget=id;
    document.getElementById('confirmBugTitle').textContent=`[${bug.id}] ${bug.title}`;
    document.getElementById('confirmOverlay').classList.remove('hidden');
  },

  closeConfirm() { document.getElementById('confirmOverlay').classList.add('hidden'); this.deleteTarget=null; },

  async confirmDelete() {
    if (!this.deleteTarget) return;
    const id=this.deleteTarget;
    const btn=document.querySelector('#confirmOverlay .btn-danger');
    btn.textContent='Suppression…'; btn.disabled=true;
    try {
      await DB.deleteBug(id);
      this.bugs=this.bugs.filter(b=>b.id!==id);
      this.closeConfirm(); this.renderStats(); this.render();
      this.showNotif(`✓ Bug ${id} supprimé`);
    } catch(e) { this.showNotif('Erreur : '+e.message, true); }
    finally { btn.textContent='Supprimer'; btn.disabled=false; }
  },

  // ============================================================
  // ONGLET CONFIG
  // ============================================================
  renderConfigTab() {
    this.renderConfigSection('types',      'Types de rapports',  'Ajouter un type…');
    this.renderConfigSection('categories', 'Catégories',         'Ajouter une catégorie…');
  },

  renderConfigSection(key, label, placeholder) {
    const container = document.getElementById(`config-${key}`);
    const items = this.config[key];
    container.innerHTML = `
      <div class="config-section">
        <div class="config-section-header">
          <span class="config-section-title">${label}</span>
          <span class="config-section-count">${items.length} entrée${items.length>1?'s':''}</span>
        </div>
        <div class="config-items" id="items-${key}">
          ${items.map((item, i) => this.renderConfigItem(key, item, i)).join('')}
        </div>
        <div class="config-add-row">
          <input type="text" class="form-input config-add-input" id="newItem-${key}" placeholder="${placeholder}" maxlength="40">
          <button class="btn btn-primary config-add-btn" onclick="BO.addConfigItem('${key}')">+ Ajouter</button>
        </div>
        <div class="config-save-row">
          <button class="btn btn-primary" onclick="BO.saveConfig('${key}')">💾 Sauvegarder les ${label.toLowerCase()}</button>
        </div>
      </div>
    `;

    // Enter pour ajouter
    document.getElementById(`newItem-${key}`).addEventListener('keydown', e => {
      if (e.key === 'Enter') this.addConfigItem(key);
    });
  },

  renderConfigItem(key, item, index) {
    return `
      <div class="config-item" id="ci-${key}-${index}">
        <span class="config-item-drag">⠿</span>
        <input type="text" class="config-item-input" value="${this.esc(item)}"
          onchange="BO.editConfigItem('${key}', ${index}, this.value)"
          onblur="BO.editConfigItem('${key}', ${index}, this.value)">
        <button class="config-item-delete" onclick="BO.removeConfigItem('${key}', ${index})" title="Supprimer">×</button>
      </div>
    `;
  },

  addConfigItem(key) {
    const input = document.getElementById(`newItem-${key}`);
    const val   = input.value.trim();
    if (!val) return;
    if (this.config[key].includes(val)) { this.showNotif(`"${val}" existe déjà.`, true); return; }
    this.config[key].push(val);
    input.value = '';
    this.renderConfigSection(key, key==='types'?'Types de rapports':'Catégories', key==='types'?'Ajouter un type…':'Ajouter une catégorie…');
  },

  editConfigItem(key, index, newVal) {
    const val = newVal.trim();
    if (!val) return;
    this.config[key][index] = val;
  },

  removeConfigItem(key, index) {
    const item = this.config[key][index];
    if (!confirm(`Supprimer "${item}" ? Les bugs qui l'utilisent ne seront pas modifiés.`)) return;
    this.config[key].splice(index, 1);
    this.renderConfigSection(key, key==='types'?'Types de rapports':'Catégories', key==='types'?'Ajouter un type…':'Ajouter une catégorie…');
  },

  async saveConfig(key) {
    const btn = document.querySelector(`#config-${key} .config-save-row .btn-primary`);
    btn.textContent = 'Sauvegarde…'; btn.disabled = true;
    try {
      await DB.updateConfig(key, this.config[key]);
      this.populateFilters();
      this.populateFormSelects();
      this.showNotif(`✓ ${key==='types'?'Types':'Catégories'} sauvegardés`);
    } catch(e) { this.showNotif('Erreur : '+e.message, true); }
    finally { btn.textContent = `💾 Sauvegarder les ${key==='types'?'types de rapports':'catégories'}`; btn.disabled=false; }
  },

  // ============================================================
  // UTILITAIRES
  // ============================================================
  logout() { sessionStorage.removeItem('bo_auth'); window.location.href='login.html'; },

  showNotif(msg, isError=false) {
    const el=document.getElementById('notification');
    el.textContent=msg; el.classList.toggle('error',isError); el.classList.remove('hidden');
    clearTimeout(this._notifTimer);
    this._notifTimer=setTimeout(()=>el.classList.add('hidden'), 3200);
  },

  toSlug(str) {
    return String(str).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'');
  },
  fmtDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric'});
  },
  esc(str) {
    return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
};

document.addEventListener('DOMContentLoaded', () => BO.init());
