// ============================================
// BACK-OFFICE COMPLET
// Assignation, échéance, dépendances, état inline,
// actions groupées, historique, dark/light toggle
// ============================================

if (sessionStorage.getItem('bo_auth') !== 'ok') {
  window.location.href = 'login.html';
}

const BO = {
  bugs: [],
  members: [],
  clients: [],
  requests: [],
  currentReqTab: 'pending',
  serverPage: 1,
  perPage: 20,
  totalBugs: 0,
  config: {
    types:      [],
    categories: [],
    priorities: ['Critique','Haute','Moyenne','Basse','Mineure'],
    states:     ['Nouveau','En cours','Résolu','Fermé','Rejeté','En attente']
  },
  currentPage: 1,
  itemsPerPage: 10,
  sortField: 'date',
  sortDir: 'desc',
  filters: { type:'', category:'', priority:'', state:'', search:'', client_id:'' },
  deleteTarget: null,
  activeTab: 'bugs',
  selected: new Set(),
  openActionMenu: null,

  // ============================================================
  // INIT
  // ============================================================
  async init() {
    Timeline.setup(this, 'BO');
    this.bindTabEvents();
    this.bindTableEvents();
    this.bindModalEvents();
    this.bindBulkEvents();
    this.showLoading(true);
    try {
      const [paged, cfg, members, requests, clients] = await Promise.all([
        DB.fetchBugsPaged({page:1, perPage:this.perPage}),
        DB.fetchConfig(),
        DB.fetchMembers(),
        DB.fetchRequests(),
        DB.fetchClients()
      ]);
      this.bugs      = paged.data;
      this.totalBugs = paged.total;
      this.requests  = requests;
      this.members   = members;
      this.clients   = clients;
      if (cfg.types)      this.config.types      = cfg.types;
      if (cfg.categories) this.config.categories = cfg.categories;
    } catch(e) { this.showNotif('Erreur de chargement : ' + e.message, true); }
    this.showLoading(false);
    this.populateFilters();
    this.populateFormSelects();
    this.renderStats();
    this.render();
    this.renderConfigTab();
    // Fermer dropdown état au clic ailleurs
    document.addEventListener('click', e => {
    });
  },

  showLoading(on) {
    const tbody = document.getElementById('bugsTableBody');
    if (!tbody) return;
    if (on) {
      tbody.innerHTML = this._skeletonRows(8, ['34px','88px','112px','94px','100%','106px','130px','44px','96px','88px','46px']);
    } else {
      const lr = document.getElementById('loadingRow');
      if (lr) lr.style.display = 'none';
    }
  },
  // ---- SKELETON SCREENS ----
  _skeletonRows(count, cols) {
    return Array(count).fill(0).map((_, i) =>
      `<tr class="skeleton-row" style="animation-delay:${i*0.06}s">
        ${cols.map(w => `<td><span class="skeleton-line" style="width:${w};height:18px;display:block;border-radius:4px;"></span></td>`).join('')}
      </tr>`
    ).join('');
  },



  // ============================================================
  // THEME
  // ============================================================

  // ============================================================
  // TABS
  // ============================================================
  bindTabEvents() {
    document.getElementById('tabBugs')?.addEventListener('click',    () => this.switchTab('bugs'));
    document.getElementById('tabConfig')?.addEventListener('click',   () => this.switchTab('config'));
    document.getElementById('tabRequests')?.addEventListener('click', () => this.switchTab('requests'));
    document.getElementById('tabTimeline')?.addEventListener('click',() => this.switchTab('timeline'));
  },

  switchTab(tab) {
    this.activeTab = tab;
    ['bugs','config','timeline','requests'].forEach(t => {
      document.getElementById(`tab${t.charAt(0).toUpperCase()+t.slice(1)}`)?.classList.toggle('tab-active', t===tab);
      document.getElementById(`panel${t.charAt(0).toUpperCase()+t.slice(1)}`)?.style && (document.getElementById(`panel${t.charAt(0).toUpperCase()+t.slice(1)}`).style.display = t===tab?'':'none');
    });
    document.getElementById('btnNewBug').style.display = tab==='bugs' ? '' : 'none';
    if (tab==='requests') this.renderRequestsTab();
    if (tab==='timeline') this.renderTimeline();
  },

  // ============================================================
  // FILTRES
  // ============================================================
  populateFilters() {
    const rebuild = (id, arr, allLabel) => {
      const el = document.getElementById(id); if (!el) return;
      const cur = el.value;
      el.innerHTML = `<option value="">${allLabel}</option>`;
      arr.forEach(v => { const o=document.createElement('option'); o.value=v; o.textContent=v; el.appendChild(o); });
      if ([...el.options].some(o=>o.value===cur)) el.value=cur;
    };
    rebuild('filterType',     this.config.types,      'Tous');
    rebuild('filterCategory', this.config.categories, 'Toutes');
    rebuild('filterPriority', this.config.priorities, 'Toutes');
    rebuild('filterState',    this.config.states,     'Tous');
    const fcl = document.getElementById('filterClient');
    if (fcl) {
      const curCl = fcl.value;
      fcl.innerHTML = '<option value="">Tous</option>';
      this.clients.forEach(c => { const o=document.createElement('option'); o.value=c.id; o.textContent=c.name; fcl.appendChild(o); });
      if ([...fcl.options].some(o=>o.value===curCl)) fcl.value=curCl;
    }
  },

  populateFormSelects() {
    const rebuild = (id, arr) => {
      const el=document.getElementById(id); if(!el)return;
      const cur=el.value; el.innerHTML='';
      arr.forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=v;el.appendChild(o);});
      if([...el.options].some(o=>o.value===cur))el.value=cur;
    };
    rebuild('fType',     this.config.types);
    rebuild('fCategory', this.config.categories);
    rebuild('fPriority', this.config.priorities);
    rebuild('fState',    this.config.states);
    // Assignee select
    const fa = document.getElementById('fAssignee'); if(fa){
      fa.innerHTML = '<option value="">— Non assigné —</option>';
      this.members.forEach(m=>{const o=document.createElement('option');o.value=m.name;o.textContent=m.name;fa.appendChild(o);});
    }
    // Blocks select (multi)
    const fb = document.getElementById('fBlocks'); if(fb){
      fb.innerHTML='';
      this.bugs.forEach(b=>{const o=document.createElement('option');o.value=b.id;o.textContent=`${b.id} — ${b.title.slice(0,40)}`;fb.appendChild(o);});
    }
  },

  bindTableEvents() {
    ['filterType','filterCategory','filterPriority','filterState','filterClient'].forEach(id=>{
      document.getElementById(id)?.addEventListener('change',e=>{
        const map={filterType:'type',filterCategory:'category',filterPriority:'priority',filterState:'state',filterClient:'client_id'};
        this.filters[map[id]]=e.target.value; this.currentPage=1; this.render();
      });
    });
    document.getElementById('searchInput')?.addEventListener('input',e=>{
      this.filters.search=e.target.value.toLowerCase(); this.currentPage=1; clearTimeout(this._searchTimer); this._searchTimer=setTimeout(()=>this.render(),300);
    });
    document.querySelectorAll('[data-sort]').forEach(th=>{
      th.addEventListener('click',()=>{
        const f=th.dataset.sort;
        if(this.sortField===f)this.sortDir=this.sortDir==='asc'?'desc':'asc';
        else{this.sortField=f;this.sortDir='asc';}
        this.render();
      });
    });
  },

  bindModalEvents() {
    document.getElementById('modalOverlay')?.addEventListener('click',e=>{if(e.target===document.getElementById('modalOverlay'))this.closeModal();});
    document.getElementById('confirmOverlay')?.addEventListener('click',e=>{if(e.target===document.getElementById('confirmOverlay'))this.closeConfirm();});
    document.getElementById('commentsModal')?.addEventListener('click',e=>{if(e.target===document.getElementById('commentsModal'))this.closeComments();});
    document.getElementById('historyModal')?.addEventListener('click',e=>{if(e.target===document.getElementById('historyModal'))this.closeHistory();});
    document.getElementById('actionModalOverlay')?.addEventListener('click',e=>{if(e.target===document.getElementById('actionModalOverlay'))this.closeActionModal();});
    document.getElementById('stateModalOverlay')?.addEventListener('click',e=>{if(e.target===document.getElementById('stateModalOverlay'))this.closeStateModal();});
    document.getElementById('acceptModalOverlay')?.addEventListener('click',e=>{if(e.target===document.getElementById('acceptModalOverlay'))this.closeAcceptModal();});
    document.getElementById('detailOverlay')?.addEventListener('click',e=>{if(e.target===document.getElementById('detailOverlay'))this.closeDetail();});
  },

  bindBulkEvents() {
    document.getElementById('selectAll')?.addEventListener('change',e=>{
      const checked = e.target.checked;
      document.querySelectorAll('.row-checkbox').forEach(cb=>{
        cb.checked=checked;
        if(checked)this.selected.add(cb.dataset.id);
        else this.selected.delete(cb.dataset.id);
      });
      this.updateBulkBar();
    });
  },

  // ============================================================
  // STATS
  // ============================================================
  renderStats() {
    const t=this.bugs,total=t.length;
    const nw=t.filter(b=>b.state==='Nouveau').length;
    const cr=t.filter(b=>b.priority==='Critique').length;
    const pr=t.filter(b=>b.state==='En cours').length;
    const rs=t.filter(b=>b.state==='Résolu').length;
    const od=t.filter(b=>b.due_date&&new Date(b.due_date)<new Date()&&b.state!=='Résolu'&&b.state!=='Fermé').length;
    document.getElementById('statsRow').innerHTML=`
      <div class="stat-chip"><strong>${total}</strong> missions</div>
      <div class="stat-chip" style="color:var(--s-new)"><span class="stat-chip-dot"></span><strong>${nw}</strong> nouvelles</div>
      <div class="stat-chip" style="color:var(--p-critical)"><span class="stat-chip-dot"></span><strong>${cr}</strong> critiques</div>
      <div class="stat-chip" style="color:var(--s-progress)"><span class="stat-chip-dot"></span><strong>${pr}</strong> en cours</div>
      <div class="stat-chip" style="color:var(--s-resolved)"><span class="stat-chip-dot"></span><strong>${rs}</strong> résolus</div>
      ${od>0?`<div class="stat-chip" style="color:var(--p-critical);animation:pulse-red 2s infinite"><span class="stat-chip-dot"></span><strong>${od}</strong> en retard</div>`:''}
    `;
  },

  // ============================================================
  // TABLE
  // ============================================================
  getFiltered() {
    return this.bugs.filter(b=>{
      if(this.filters.type     &&b.type    !==this.filters.type)    return false;
      if(this.filters.category &&b.category!==this.filters.category)return false;
      if(this.filters.priority &&b.priority!==this.filters.priority)return false;
      if(this.filters.state    &&b.state   !==this.filters.state)   return false;
      if(this.filters.search){const s=this.filters.search;if(!b.title?.toLowerCase().includes(s)&&!b.description?.toLowerCase().includes(s)&&!b.id?.toLowerCase().includes(s))return false;}
      return true;
    });
  },

  getSorted(list) {
    const po={'Critique':0,'Haute':1,'Moyenne':2,'Basse':3,'Mineure':4};
    return [...list].sort((a,b)=>{
      let va=a[this.sortField],vb=b[this.sortField];
      if(this.sortField==='priority'){va=po[va]??99;vb=po[vb]??99;}
      if(va<vb)return this.sortDir==='asc'?-1:1;
      if(va>vb)return this.sortDir==='asc'?1:-1;
      return 0;
    });
  },

  render() {
    const filtered=this.getSorted(this.getFiltered());
    const total=filtered.length;
    const totalPages=Math.max(1,Math.ceil(total/this.itemsPerPage));
    this.currentPage=Math.min(this.currentPage,totalPages);
    const start=(this.currentPage-1)*this.itemsPerPage;
    const page=filtered.slice(start,start+this.itemsPerPage);
    document.getElementById('filterCount').textContent=`${total} résultat${total>1?'s':''}`;
    document.querySelectorAll('[data-sort]').forEach(th=>{
      th.classList.toggle('sorted',th.dataset.sort===this.sortField);
      const arrow=th.querySelector('.sort-arrow');
      if(arrow)arrow.textContent=th.dataset.sort===this.sortField?(this.sortDir==='asc'?'↑':'↓'):'↕';
    });
    const tbody=document.getElementById('bugsTableBody');
    tbody.innerHTML=page.length===0
      ?`<tr><td colspan="12"><div class="empty-state"><span class="empty-icon">⊘</span><p>Aucune mission.</p></div></td></tr>`
      :page.map(b=>this.renderRow(b)).join('');
    this.renderPagination(total,totalPages);
    this.selected.clear();
    this.updateBulkBar();
  },

  renderRow(b) {
    const ts=this.toSlug,d=this.esc.bind(this);
    const member=this.members.find(m=>m.name===b.assignee);
    const avatarHtml = member
      ? `<span class="avatar" style="background:${member.color}" title="${d(member.name)}">${d(member.initials)}</span>`
      : `<span class="avatar avatar-unassigned" title="Non assigné">·</span>`;
    const dueDateHtml = this.renderDueDate(b.due_date, b.state);
    const blocksHtml  = b.blocks?.length ? `<span class="block-tag" style="font-size:10px;padding:1px 5px;">🔗 ${b.blocks.length}</span>` : '';
    const isChecked   = this.selected.has(b.id);
    return `<tr class="${isChecked?'selected-row':''} clickable-row" onclick="BO.openDetail('${d(b.id)}')">
      <td><input type="checkbox" class="row-checkbox" data-id="${d(b.id)}" ${isChecked?'checked':''} onchange="BO.toggleSelect('${d(b.id)}',this.checked)" onclick="event.stopPropagation()"></td>
      <td><span class="badge badge-type-${ts(b.type)}">${d(b.type)}</span></td>
      <td><span class="badge badge-cat-${ts(b.category)}">${d(b.category)}</span></td>
      <td><span class="bug-id" onclick="event.stopPropagation();copyId('${d(b.id)}',this)" title="Cliquer pour copier">${d(b.id)}</span>${blocksHtml}</td>
      <td>${this._clientBadge(b.client_id)}</td>
      <td><div class="bug-desc"><div class="bug-desc-title">${d(b.title)}</div><div class="bug-desc-detail">${d(b.description)}</div></div></td>
      <td><span class="badge badge-prio-${ts(b.priority)}"><span class="badge-dot"></span>${d(b.priority)}</span></td>
      <td>${this.renderStateDropdown(b)}</td>
      <td style="text-align:center;">${avatarHtml}</td>
      <td><div class="date-main">${b.start_date ? this.fmtDate(b.start_date) : '<span style="color:var(--text-faint)">—</span>'}</div></td>
      <td>${dueDateHtml}</td>
      <td><button class="action-menu-btn" onclick="event.stopPropagation();BO.openActionModal('${d(b.id)}')" title="Actions">···</button></td>
    </tr>`;
  },

  renderDueDate(due, state) {
    if (!due) return '<span class="due-date" style="color:var(--text-faint)">—</span>';
    const today = new Date(); today.setHours(0,0,0,0);
    const d     = new Date(due);
    const diff  = Math.ceil((d-today)/(1000*60*60*24));
    const done  = state==='Résolu'||state==='Fermé';
    let cls='ok', label=this.fmtDate(due);
    if (!done && diff<0)       { cls='overdue';  label=`⚠ ${this.fmtDate(due)}`; }
    else if (!done && diff<=3) { cls='due-soon'; label=`⏰ ${this.fmtDate(due)}`; }
    return `<span class="due-date ${cls}" title="${due}">${label}</span>`;
  },

  renderStateDropdown(b) {
    const ts=this.toSlug,d=this.esc.bind(this);
    return `<span class="badge badge-state-${ts(b.state)} state-badge-btn"
      onclick="event.stopPropagation();BO.openStateModal('${d(b.id)}')"
      title="Changer l'état"><span class="badge-dot"></span>${d(b.state)} ▾</span>`;
  },

  openStateModal(id) {
    const bug = this.bugs.find(b => b.id === id);
    if (!bug) return;
    const d  = this.esc.bind(this);
    const ts = this.toSlug;
    document.getElementById('stateModalSubtitle').innerHTML =
      '<span class="bug-id">' + d(bug.id) + '</span>';
    document.getElementById('stateModalTitle').textContent = bug.title;
    document.getElementById('stateModalOverlay').dataset.bugId = id;
    // Générer les options
    const list = document.getElementById('stateModalList');
    list.innerHTML = this.config.states.map(s => `
      <div class="action-modal-item ${s===bug.state?'state-modal-current':''}" onclick="BO.pickState('${d(s)}')">
        <span class="action-modal-icon"><span class="badge badge-state-${ts(s)}" style="pointer-events:none;"><span class="badge-dot"></span>${d(s)}</span></span>
        <div>
          <div class="action-modal-label" style="${s===bug.state?'color:var(--gold-mid)':''}">${d(s)}</div>
          ${s===bug.state?'<div class="action-modal-desc">État actuel</div>':''}
        </div>
        ${s===bug.state?'<span style="margin-left:auto;color:var(--gold-mid);font-size:12px;">✓</span>':''}
      </div>`).join('');
    document.getElementById('stateModalOverlay').classList.remove('hidden');
  },

  closeStateModal() {
    document.getElementById('stateModalOverlay').classList.add('hidden');
  },

  async pickState(newState) {
    const id  = document.getElementById('stateModalOverlay').dataset.bugId;
    const bug = this.bugs.find(b => b.id === id);
    this.closeStateModal();
    if (!bug || bug.state === newState) return;
    const oldState = bug.state;
    try {
      await DB.updateBug(id, { state: newState });
      await DB.insertHistory(id, 'Admin', 'state', oldState, newState);
      bug.state = newState;
      this.render(); this.renderStats();
      this.showNotif('✓ État : ' + newState);
    } catch(e) { this.showNotif('Erreur : ' + e.message, true); }
  },

  renderPagination(total,totalPages) {
    const el=document.getElementById('pagination');
    const s=(this.currentPage-1)*this.perPage+1;
    const e=Math.min(this.currentPage*this.perPage,total);
    const totalPages2=Math.max(1,Math.ceil(total/this.perPage));
    let btns=`<button class="page-btn" onclick="BO.goPage(${this.currentPage-1})" ${this.currentPage===1?'disabled':''}>‹</button>`;
    for(let i=1;i<=totalPages2;i++){
      if(totalPages2>7&&Math.abs(i-this.currentPage)>2&&i!==1&&i!==totalPages2){
        if(i===2||i===totalPages2-1)btns+=`<span class="page-btn" style="cursor:default;border:none;opacity:.4">…</span>`;
        continue;
      }
      btns+=`<button class="page-btn ${i===this.currentPage?'active':''}" onclick="BO.goPage(${i})">${i}</button>`;
    }
    btns+=`<button class="page-btn" onclick="BO.goPage(${this.currentPage+1})" ${this.currentPage===totalPages2?'disabled':''}>›</button>`;
    el.innerHTML=`<span class="pagination-info">Affichage ${total===0?0:s}–${e} sur ${total}</span><div class="pagination-controls">${btns}</div>`;
  },

  goPage(p){const t=Math.max(1,Math.ceil(this.totalBugs/this.perPage));if(p<1||p>t)return;this.currentPage=p;this.render();window.scrollTo({top:0,behavior:'smooth'});},

  // ============================================================
  // SÉLECTION GROUPÉE
  // ============================================================
  toggleSelect(id, checked) {
    if(checked) this.selected.add(id); else this.selected.delete(id);
    this.updateBulkBar();
  },

  updateBulkBar() {
    const bar=document.getElementById('bulkBar');
    const count=this.selected.size;
    bar.classList.toggle('visible', count>0);
    document.getElementById('bulkCount').textContent=count;
  },

  async bulkChangeState(newState) {
    if(!this.selected.size)return;
    if(!confirm(`Changer l'état de ${this.selected.size} mission(s) en "${newState}" ?`))return;
    try {
      await Promise.all([...this.selected].map(async id=>{
        const bug=this.bugs.find(b=>b.id===id); if(!bug)return;
        await DB.updateBug(id,{state:newState});
        await DB.insertHistory(id,'Admin','state',bug.state,newState);
        bug.state=newState;
      }));
      this.selected.clear();
      this.render(); this.renderStats();
      this.showNotif(`✓ ${this.selected.size||'Toutes les'} missions mises à jour`);
    } catch(e){ this.showNotif('Erreur : '+e.message,true); }
  },

  async bulkArchive() {
    if(!this.selected.size)return;
    if(!confirm(`Archiver ${this.selected.size} mission(s) ?`))return;
    try {
      await Promise.all([...this.selected].map(id=>DB.archiveBug(id)));
      this.bugs=this.bugs.filter(b=>!this.selected.has(b.id));
      this.selected.clear();
      this.render(); this.renderStats();
      this.showNotif(`✓ Missions archivées`);
    } catch(e){ this.showNotif('Erreur : '+e.message,true); }
  },

  // ============================================================
  // MODAL CRÉATION / ÉDITION
  // ============================================================
  openCreate() {
    this.populateFormSelects();
    document.getElementById('modalTitle').textContent='Nouvelle mission';
    document.getElementById('editId').value='';
    document.getElementById('fType').value    =this.config.types[0]||'';
    document.getElementById('fCategory').value=this.config.categories[0]||'';
    document.getElementById('fPriority').value='Moyenne';
    document.getElementById('fState').value   ='Nouveau';
    document.getElementById('fAssignee').value='';
    document.getElementById('fTitle').value='';
    document.getElementById('fDescription').value='';
    document.getElementById('fDate').value=new Date().toISOString().slice(0,10);
    document.getElementById('fDueDate').value='';
    document.getElementById('fBlocks').selectedIndex=-1;
    document.getElementById('blocksPreview').innerHTML='';
    document.getElementById('modalOverlay').classList.remove('hidden');
    document.getElementById('fTitle').focus();
    this._formDirty = false;
    this._bindFormDirty();
    // Contraintes dates
    document.getElementById('fStartDate')?.addEventListener('change', e => {
      const due = document.getElementById('fDueDate');
      if (due) due.min = e.target.value || '';
    });
    document.getElementById('fDueDate')?.addEventListener('change', e => {
      const start = document.getElementById('fStartDate');
      if (start) start.max = e.target.value || '';
    });
  },

  openEdit(id) {
    this.populateFormSelects();
    const bug=this.bugs.find(b=>b.id===id); if(!bug)return;
    document.getElementById('modalTitle').textContent=`Modifier ${id}`;
    document.getElementById('editId').value    =bug.id;
    document.getElementById('fType').value     =bug.type;
    document.getElementById('fCategory').value =bug.category;
    document.getElementById('fPriority').value =bug.priority;
    document.getElementById('fState').value    =bug.state;
    document.getElementById('fAssignee').value =bug.assignee||'';
    document.getElementById('fTitle').value    =bug.title;
    document.getElementById('fDescription').value=bug.description;
    document.getElementById('fDate').value     =bug.date;
    document.getElementById('fDueDate').value  =bug.due_date||'';
    if(document.getElementById('fRefUrl')) document.getElementById('fRefUrl').value=bug.ref_url||'';
    if(document.getElementById('fStartDate')) document.getElementById('fStartDate').value=bug.start_date||'';
    if(document.getElementById('fTargetVersion')) document.getElementById('fTargetVersion').value=bug.target_version||'';
    this._populateClientSelect(bug.client_id||null);
    this.updateCounter('fTitle',120); this.updateCounter('fDescription',2000);
    // Blocks
    const fb=document.getElementById('fBlocks');
    [...fb.options].forEach(o=>{ o.selected=(bug.blocks||[]).includes(o.value)&&o.value!==id; });
    this.updateBlocksPreview();
    document.getElementById('modalOverlay').classList.remove('hidden');
    document.getElementById('fTitle').focus();
    this._formDirty = false;
    this._bindFormDirty();
  },

  updateBlocksPreview() {
    const fb=document.getElementById('fBlocks');
    const sel=[...fb.selectedOptions].map(o=>o.value);
    document.getElementById('blocksPreview').innerHTML=sel.map(id=>
      `<span class="block-tag">${id}</span>`
    ).join('');
  },

  _formDirty: false,

  _bindFormDirty() {
    const fields = ['fTitle','fDescription','fType','fCategory','fPriority','fState','fAssignee','fDueDate','fDate','fRefUrl'];
    fields.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', () => {
        this._formDirty = true;
        // Afficher badge non sauvegardé
        let badge = document.getElementById('unsavedBadge');
        if (!badge) {
          badge = document.createElement('span');
          badge.id = 'unsavedBadge';
          badge.className = 'unsaved-badge';
          badge.textContent = '● Non sauvegardé';
          document.getElementById('modalTitle')?.after(badge);
        }
      }, { once: false });
    });
  },

  closeModal() {
    if (this._formDirty) {
      if (!confirm('Vous avez des modifications non sauvegardées. Quitter quand même ?')) return;
    }
    this._formDirty = false;
    const badge = document.getElementById('unsavedBadge');
    if (badge) badge.remove();
    document.getElementById('modalOverlay').classList.add('hidden');
  },

  async save() {
    const id=document.getElementById('editId').value;
    const title=document.getElementById('fTitle').value.trim();
    const description=document.getElementById('fDescription').value.trim();
    const date=document.getElementById('fDate').value;
    if(!title||!description||!date){this.showNotif('Remplissez tous les champs.',true);return;}
    const fb=document.getElementById('fBlocks');
    const blocks=[...fb.selectedOptions].map(o=>o.value).filter(v=>v!==id);
    const data={
      type:    document.getElementById('fType').value,
      category:document.getElementById('fCategory').value,
      priority:document.getElementById('fPriority').value,
      state:   document.getElementById('fState').value,
      assignee:document.getElementById('fAssignee').value||null,
      title, description, date,
      start_date:      document.getElementById('fStartDate')?.value||null,
      due_date:document.getElementById('fDueDate').value||null,
      ref_url:         document.getElementById('fRefUrl')?.value.trim()||null,
      target_version:  document.getElementById('fTargetVersion')?.value.trim()||null,
      client_id:       document.getElementById('fClient')?.value ? parseInt(document.getElementById('fClient').value) : null,
      blocks:  blocks.length?blocks:null
    };
    const btn=document.querySelector('.modal-footer .btn-primary');
    btn.textContent='Sauvegarde…'; btn.disabled=true;
    try {
      if(id){
        const old=this.bugs.find(b=>b.id===id);
        const fields=['type','category','priority','state','assignee','due_date'];
        await DB.updateBug(id,data);
        // Historique des champs modifiés
        for(const f of fields){
          if(String(old[f]||'')!==String(data[f]||'')){
            await DB.insertHistory(id,'Admin',f,old[f]||'',data[f]||'');
          }
        }
        const idx=this.bugs.findIndex(b=>b.id===id);
        if(idx!==-1)this.bugs[idx]={...this.bugs[idx],...data};
        // Mettre à jour _tlBugs aussi si chargé
        if(this._tlBugs){
          const tlIdx=this._tlBugs.findIndex(b=>b.id===id);
          if(tlIdx!==-1)this._tlBugs[tlIdx]={...this._tlBugs[tlIdx],...data};
        }
        this.showNotif(`✓ Mission ${id} mise à jour`);
      } else {
        const newId=DB.nextId(this.bugs);
        const created=await DB.insertBug({id:newId,...data});
        await DB.insertHistory(newId,'Admin','création','','Mission créée');
        this.bugs.unshift(Array.isArray(created)?created[0]:{id:newId,...data});
        this.showNotif(`✓ Mission ${newId} créée`);
      }
      this._formDirty = false;
      this._tlBugsLoaded = false;
      this.closeModal(); this.renderStats(); this.render();
      if (this.activeTab === 'timeline') this.renderTimeline();
    } catch(e){this.showNotif('Erreur : '+e.message,true);}
    finally{btn.textContent='Enregistrer';btn.disabled=false;}
  },

  // ============================================================
  // SUPPRESSION
  // ============================================================
  openDelete(id){
    const bug=this.bugs.find(b=>b.id===id);if(!bug)return;
    this.deleteTarget=id;
    document.getElementById('confirmBugTitle').textContent=`[${bug.id}] ${bug.title}`;
    document.getElementById('confirmOverlay').classList.remove('hidden');
  },
  closeConfirm(){ document.getElementById('confirmOverlay').classList.add('hidden');this.deleteTarget=null; },
  async confirmDelete(){
    if(!this.deleteTarget)return;
    const id=this.deleteTarget;
    const btn=document.querySelector('#confirmOverlay .btn-danger');
    btn.textContent='Suppression…';btn.disabled=true;
    try{
      await DB.deleteBug(id);
      this.bugs=this.bugs.filter(b=>b.id!==id);
      this.closeConfirm();this.renderStats();this.render();
      this.showNotif(`✓ Mission ${id} supprimée`);
    }catch(e){this.showNotif('Erreur : '+e.message,true);}
    finally{btn.textContent='Supprimer';btn.disabled=false;}
  },

  // ============================================================
  // ARCHIVAGE
  // ============================================================
  async archiveMission(id){
    if(!confirm(`Archiver la mission [${id}] ?`))return;
    try{
      await DB.archiveBug(id);
      await DB.insertHistory(id,'Admin','archived','false','true');
      this.bugs=this.bugs.filter(b=>b.id!==id);
      this.renderStats();this.render();
      this.showNotif(`✓ Mission ${id} archivée`);
      showToast(`📦 Mission ${id} archivée`);
    }catch(e){this.showNotif('Erreur : '+e.message,true);}
  },

  // ============================================================
  // COMMENTAIRES
  // ============================================================
  async openComments(bugId){
    const bug=this.bugs.find(b=>b.id===bugId);if(!bug)return;
    document.getElementById('commentsModalTitle').textContent=bug.title;
    document.getElementById('commentsBugId').textContent=bugId;
    document.getElementById('commentsList').innerHTML='<div class="comments-loading">Chargement…</div>';
    document.getElementById('commentsModal').classList.remove('hidden');
    try{
      const comments=await DB.fetchComments(bugId);
      this._renderComments(comments,true);
    }catch(e){document.getElementById('commentsList').innerHTML='<div class="comments-error">Erreur.</div>';}
  },

  _renderComments(comments,canDelete){
    const el=document.getElementById('commentsList');
    if(!comments.length){el.innerHTML='<div class="comments-empty">Aucun commentaire.</div>';return;}
    el.innerHTML=comments.map(c=>`
      <div class="comment-item" id="comment-${c.id}">
        <div class="comment-header">
          <span class="comment-author">${this.esc(c.author)}</span>
          <span class="comment-date">${this.fmtDatetime(c.created_at)}</span>
          ${canDelete?`<button class="comment-delete" onclick="BO.deleteComment(${c.id})">×</button>`:''}
        </div>
        <div class="comment-content">${this.esc(c.content)}</div>
      </div>`).join('');
  },

  closeComments(){document.getElementById('commentsModal').classList.add('hidden');},

  async submitComment(){
    const bugId=document.getElementById('commentsBugId').textContent;
    const author=document.getElementById('commentAuthor').value.trim();
    const content=document.getElementById('commentContent').value.trim();
    if(!author||!content){this.showNotif('Remplissez tous les champs.',true);return;}
    const btn=document.getElementById('btnSubmitComment');
    btn.textContent='Envoi…';btn.disabled=true;
    try{
      await DB.insertComment(bugId,author,content);
      document.getElementById('commentAuthor').value='';
      document.getElementById('commentContent').value='';
      const comments=await DB.fetchComments(bugId);
      this._renderComments(comments,true);
    }catch(e){this.showNotif('Erreur : '+e.message,true);}
    finally{btn.textContent='Publier';btn.disabled=false;}
  },

  async deleteComment(id){
    if(!confirm('Supprimer ce commentaire ?'))return;
    try{
      await DB.deleteComment(id);
      const bugId=document.getElementById('commentsBugId').textContent;
      const comments=await DB.fetchComments(bugId);
      this._renderComments(comments,true);
      this.showNotif('✓ Commentaire supprimé');
    }catch(e){this.showNotif('Erreur : '+e.message,true);}
  },

  // ============================================================
  // HISTORIQUE
  // ============================================================
  async openHistory(bugId){
    const bug=this.bugs.find(b=>b.id===bugId);if(!bug)return;
    document.getElementById('historyTitle').textContent=`Historique — ${bug.id}`;
    document.getElementById('historyList').innerHTML='<div class="comments-loading">Chargement…</div>';
    document.getElementById('historyModal').classList.remove('hidden');
    try{
      const history=await DB.fetchHistory(bugId);
      const el=document.getElementById('historyList');
      if(!history.length){el.innerHTML='<div class="comments-empty">Aucune modification enregistrée.</div>';return;}
      el.innerHTML=history.map(h=>`
        <div class="history-item">
          <div class="history-dot"></div>
          <div class="history-body">
            <span class="history-author">${this.esc(h.author)}</span>
            <span class="history-field"> · ${this.esc(h.field)}</span>
            <div class="history-values">
              <span class="history-old">${this.esc(h.old_value||'—')}</span>
              <span class="history-arrow">→</span>
              <span class="history-new">${this.esc(h.new_value||'—')}</span>
            </div>
            <div class="history-date">${this.fmtDatetime(h.created_at)}</div>
          </div>
        </div>`).join('');
    }catch(e){document.getElementById('historyList').innerHTML='<div class="comments-error">Erreur.</div>';}
  },

  closeHistory(){document.getElementById('historyModal').classList.add('hidden');},

  // ============================================================
  // TIMELINE — complète
  // ============================================================
  timeline: {
    zoom: 'month',   // 'week' | 'month' | 'quarter'
    group: 'category', // 'category' | 'assignee' | 'none'
    filters: { category: '', assignee: '', state: '' }
  },

  async renderTimeline() { await Timeline.render(); },
  setTlZoom(z)      { this.timeline.zoom=z;                    Timeline._draw(); },
  setTlGroup(g)     { this.timeline.group=g;                   Timeline._draw(); },
  setTlFilter(k,v)  { this.timeline.filters[k]=v;              Timeline._draw(); },
  toggleTlFocus()   { this.timeline.focusMode=!this.timeline.focusMode; Timeline.render(); },
  scrollTlToday()   { Timeline.scrollTlToday(); },

  openAcceptModal(reqId) {
    document.getElementById('acceptReqId').value = reqId;
    const ps = document.getElementById('acceptPriority');
    if (ps) {
      ps.innerHTML = this.config.priorities.map(p => '<option value="' + this.esc(p) + '">' + this.esc(p) + '</option>').join('');
      ps.value = 'Moyenne';
    }
    const ss = document.getElementById('acceptState');
    if (ss) {
      ss.innerHTML = this.config.states.map(s => '<option value="' + this.esc(s) + '">' + this.esc(s) + '</option>').join('');
      ss.value = 'Nouveau';
    }
    const as = document.getElementById('acceptAssignee');
    if (as) {
      as.innerHTML = '<option value="">— Non assigné —</option>' +
        this.members.map(m => '<option value="' + this.esc(m.name) + '">' + this.esc(m.name) + '</option>').join('');
    }
    const dd = document.getElementById('acceptDueDate');
    if (dd) dd.value = '';
    document.getElementById('acceptModalOverlay').classList.remove('hidden');
  },

  closeAcceptModal() {
    document.getElementById('acceptModalOverlay').classList.add('hidden');
  },

  async confirmAccept() {
    const reqId = parseInt(document.getElementById('acceptReqId').value);
    const req   = this.requests.find(r => r.id === reqId);
    if (!req) return;
    const priority = document.getElementById('acceptPriority').value;
    const state    = document.getElementById('acceptState').value;
    const assignee = document.getElementById('acceptAssignee').value || null;
    const dueDate  = document.getElementById('acceptDueDate').value   || null;
    const btn = document.querySelector('#acceptModalOverlay .btn-primary');
    btn.textContent = 'Création…'; btn.disabled = true;
    try {
      const newId  = DB.nextId(this.bugs);
      const created = await DB.insertBug({
        id: newId, type: req.type, category: req.category,
        priority, state, title: req.title, description: req.description,
        date: new Date().toISOString().slice(0, 10),
        assignee, due_date: dueDate, archived: false
      });
      await DB.insertHistory(newId, 'Admin', 'création', '', 'Créée depuis une demande de ' + req.author_name);
      await DB.updateRequest(reqId, { status: 'accepted' });
      this.bugs.unshift(Array.isArray(created) ? created[0] : { id: newId, type: req.type, category: req.category, priority, state, title: req.title, description: req.description, date: new Date().toISOString().slice(0,10) });
      this.requests = this.requests.map(r => r.id === reqId ? Object.assign({}, r, { status: 'accepted' }) : r);
      this.closeAcceptModal();
      this.renderStats();
      this.renderReqList();
      this.updateReqBadge();
      this.showNotif('✓ Demande acceptée — Mission ' + newId + ' créée');
    } catch(e) { this.showNotif('Erreur : ' + e.message, true); }
    finally { btn.textContent = '✅ Créer la mission'; btn.disabled = false; }
  },

  async rejectRequest(reqId) {
    if (!confirm('Refuser cette demande ?')) return;
    try {
      await DB.updateRequest(reqId, { status: 'rejected' });
      this.requests = this.requests.map(r => r.id === reqId ? Object.assign({}, r, { status: 'rejected' }) : r);
      this.renderReqList();
      this.updateReqBadge();
      this.showNotif('✓ Demande refusée');
    } catch(e) { this.showNotif('Erreur : ' + e.message, true); }
  },

};

document.addEventListener('DOMContentLoaded',()=>BO.init());
