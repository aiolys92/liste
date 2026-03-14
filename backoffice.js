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
  filters: { type:'', category:'', priority:'', state:'', search:'' },
  deleteTarget: null,
  activeTab: 'bugs',
  selected: new Set(),
  openActionMenu: null,

  // ============================================================
  // INIT
  // ============================================================
  async init() {
    this.loadTheme();
    this.bindTabEvents();
    this.bindTableEvents();
    this.bindModalEvents();
    this.bindBulkEvents();
    document.getElementById('themeToggle')?.addEventListener('click', () => this.toggleTheme());
    this.showLoading(true);
    try {
      const [bugs, cfg, members, requests] = await Promise.all([DB.fetchBugs(), DB.fetchConfig(), DB.fetchMembers(), DB.fetchRequests()]);
      this.requests = requests;
      this.bugs    = bugs;
      this.members = members;
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

  showLoading(on) { const el=document.getElementById('loadingRow'); if(el) el.style.display=on?'':'none'; },

  // ============================================================
  // THEME
  // ============================================================
  loadTheme() {
    const t = localStorage.getItem('cp_theme') || 'dark';
    document.body.classList.toggle('light', t === 'light');
    const btn = document.getElementById('themeToggle');
    if (btn) btn.textContent = t === 'light' ? '🌙' : '☀️';
  },
  toggleTheme() {
    const isLight = document.body.classList.toggle('light');
    localStorage.setItem('cp_theme', isLight ? 'light' : 'dark');
    const btn = document.getElementById('themeToggle');
    if (btn) btn.textContent = isLight ? '🌙' : '☀️';
  },

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
    ['filterType','filterCategory','filterPriority','filterState'].forEach(id=>{
      document.getElementById(id)?.addEventListener('change',e=>{
        const map={filterType:'type',filterCategory:'category',filterPriority:'priority',filterState:'state'};
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
      <td><div class="bug-desc"><div class="bug-desc-title">${d(b.title)}</div><div class="bug-desc-detail">${d(b.description)}</div></div></td>
      <td><span class="badge badge-prio-${ts(b.priority)}"><span class="badge-dot"></span>${d(b.priority)}</span></td>
      <td>${this.renderStateDropdown(b)}</td>
      <td style="text-align:center;">${avatarHtml}</td>
      <td>${dueDateHtml}</td>
      <td><div class="date-main">${this.fmtDate(b.date)}</div></td>
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
    // Blocks
    const fb=document.getElementById('fBlocks');
    [...fb.options].forEach(o=>{ o.selected=(bug.blocks||[]).includes(o.value)&&o.value!==id; });
    this.updateBlocksPreview();
    document.getElementById('modalOverlay').classList.remove('hidden');
    document.getElementById('fTitle').focus();
  },

  updateBlocksPreview() {
    const fb=document.getElementById('fBlocks');
    const sel=[...fb.selectedOptions].map(o=>o.value);
    document.getElementById('blocksPreview').innerHTML=sel.map(id=>
      `<span class="block-tag">${id}</span>`
    ).join('');
  },

  closeModal(){ document.getElementById('modalOverlay').classList.add('hidden'); },

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
      due_date:document.getElementById('fDueDate').value||null,
      ref_url: document.getElementById('fRefUrl')?.value.trim()||null,
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
        this.showNotif(`✓ Mission ${id} mise à jour`);
      } else {
        const newId=DB.nextId(this.bugs);
        const created=await DB.insertBug({id:newId,...data});
        await DB.insertHistory(newId,'Admin','création','','Mission créée');
        this.bugs.unshift(Array.isArray(created)?created[0]:{id:newId,...data});
        this.showNotif(`✓ Mission ${newId} créée`);
      }
      this.closeModal(); this.renderStats(); this.render();
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

  renderTimeline() {
    const container = document.getElementById('panelTimeline');
    const tl = this.timeline;

    // Toolbar
    container.innerHTML = `
      <div class="tl-toolbar">
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
          <div class="tl-zoom-group">
            <button class="tl-zoom-btn ${tl.zoom==='week'?'active':''}"    onclick="BO.setTlZoom('week')">Semaine</button>
            <button class="tl-zoom-btn ${tl.zoom==='month'?'active':''}"   onclick="BO.setTlZoom('month')">Mois</button>
            <button class="tl-zoom-btn ${tl.zoom==='quarter'?'active':''}" onclick="BO.setTlZoom('quarter')">Trimestre</button>
          </div>
          <div class="filter-divider" style="height:22px;"></div>
          <div class="filter-group">
            <span class="filter-label">Grouper</span>
            <select class="filter-select" style="min-width:120px;" onchange="BO.setTlGroup(this.value)">
              <option value="category"  ${tl.group==='category' ?'selected':''}>Catégorie</option>
              <option value="assignee"  ${tl.group==='assignee' ?'selected':''}>Assigné</option>
              <option value="none"      ${tl.group==='none'     ?'selected':''}>Sans groupe</option>
            </select>
          </div>
          <div class="filter-divider" style="height:22px;"></div>
          <div class="filter-group">
            <span class="filter-label">Catégorie</span>
            <select class="filter-select" style="min-width:120px;" onchange="BO.setTlFilter('category',this.value)">
              <option value="">Toutes</option>
              ${this.config.categories.map(c=>`<option value="${this.esc(c)}" ${tl.filters.category===c?'selected':''}>${this.esc(c)}</option>`).join('')}
            </select>
          </div>
          <div class="filter-group">
            <span class="filter-label">Assigné</span>
            <select class="filter-select" style="min-width:120px;" onchange="BO.setTlFilter('assignee',this.value)">
              <option value="">Tous</option>
              ${this.members.map(m=>`<option value="${this.esc(m.name)}" ${tl.filters.assignee===m.name?'selected':''}>${this.esc(m.name)}</option>`).join('')}
            </select>
          </div>
          <div class="filter-group">
            <span class="filter-label">État</span>
            <select class="filter-select" style="min-width:120px;" onchange="BO.setTlFilter('state',this.value)">
              <option value="">Tous</option>
              ${this.config.states.map(s=>`<option value="${this.esc(s)}" ${tl.filters.state===s?'selected':''}>${this.esc(s)}</option>`).join('')}
            </select>
          </div>
        </div>
        <button class="btn btn-secondary" style="font-size:11px;padding:5px 12px;" onclick="BO.scrollTlToday()">⊙ Aujourd'hui</button>
      </div>
      <div id="tlBoard"></div>`;

    this._drawTimeline();
  },

  setTlZoom(z)           { this.timeline.zoom=z;                        this._drawTimeline(); },
  setTlGroup(g)          { this.timeline.group=g;                       this._drawTimeline(); },
  setTlFilter(key,val)   { this.timeline.filters[key]=val;              this._drawTimeline(); },
  scrollTlToday()        { document.getElementById('tlBoard')?.querySelector('.tl-today-line')?.scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'}); },

  _drawTimeline() {
    const tl = this.timeline;
    const DAY_PX = tl.zoom==='week' ? 60 : tl.zoom==='month' ? 28 : 12;
    const LABEL_W = 200;

    // Filtrer
    let bugs = this.bugs.filter(b => b.date);
    if (tl.filters.category) bugs = bugs.filter(b => b.category === tl.filters.category);
    if (tl.filters.assignee) bugs = bugs.filter(b => b.assignee === tl.filters.assignee);
    if (tl.filters.state)    bugs = bugs.filter(b => b.state    === tl.filters.state);

    const board = document.getElementById('tlBoard');
    if (!bugs.length) { board.innerHTML='<div class="empty-state" style="padding:48px"><span class="empty-icon">📅</span><p>Aucune mission ne correspond aux filtres.</p></div>'; return; }

    // Plage de dates
    const allDates = bugs.flatMap(b=>[b.date,b.due_date].filter(Boolean)).map(d=>new Date(d));
    let minDate = new Date(Math.min(...allDates));
    let maxDate = new Date(Math.max(...allDates));
    // Étendre
    if (tl.zoom==='week')    { minDate.setDate(minDate.getDate()-3);  maxDate.setDate(maxDate.getDate()+7); }
    else if (tl.zoom==='month') { minDate.setDate(1);                maxDate.setDate(maxDate.getDate()+14); }
    else                     { minDate.setDate(1); minDate.setMonth(minDate.getMonth()-1); maxDate.setMonth(maxDate.getMonth()+2); }

    const totalDays = Math.ceil((maxDate-minDate)/(864e5));
    const totalW    = totalDays * DAY_PX;
    const toX = d  => Math.round((new Date(d)-minDate)/864e5)*DAY_PX;
    const today     = new Date(); today.setHours(0,0,0,0);
    const todayX    = toX(today);

    // Couleurs état
    const stateColors = {'Nouveau':'#40e0b0','En cours':'#50b8ff','Résolu':'#70d060','Fermé':'#7a7464','Rejeté':'#ff5252','En attente':'#ffd040'};
    const prioColors  = {'Critique':'#ff5252','Haute':'#ff9040','Moyenne':'#ffd040','Basse':'#50b8ff','Mineure':'#c060ff'};

    // Générer les ticks (jours/semaines/mois selon zoom)
    const ticks = [];
    const tickLabels = [];
    let cur = new Date(minDate);
    if (tl.zoom === 'week') {
      while (cur <= maxDate) {
        ticks.push({ x: toX(cur), weekend: cur.getDay()===0||cur.getDay()===6 });
        tickLabels.push({ x: toX(cur), label: cur.toLocaleDateString('fr-FR',{weekday:'short',day:'numeric'}) });
        cur.setDate(cur.getDate()+1);
      }
    } else if (tl.zoom === 'month') {
      while (cur <= maxDate) {
        ticks.push({ x: toX(cur), weekend: cur.getDay()===0||cur.getDay()===6 });
        if (cur.getDate()===1 || cur.getDay()===1) tickLabels.push({ x: toX(cur), label: cur.toLocaleDateString('fr-FR',{day:'numeric',month:'short'}) });
        cur.setDate(cur.getDate()+1);
      }
    } else {
      while (cur <= maxDate) {
        if (cur.getDate()===1) tickLabels.push({ x: toX(cur), label: cur.toLocaleDateString('fr-FR',{month:'short',year:'2-digit'}) });
        ticks.push({ x: toX(cur), weekend: cur.getDay()===0||cur.getDay()===6 });
        cur.setDate(cur.getDate()+1);
      }
    }

    // Groupement
    let groups = [];
    if (tl.group === 'category') {
      const cats = [...new Set(bugs.map(b=>b.category))];
      cats.forEach(cat => { const items=bugs.filter(b=>b.category===cat); if(items.length) groups.push({label:cat,items}); });
    } else if (tl.group === 'assignee') {
      const assignees = [...new Set(bugs.map(b=>b.assignee||'Non assigné'))];
      assignees.forEach(a => { const items=bugs.filter(b=>(b.assignee||'Non assigné')===a); if(items.length) groups.push({label:a,items}); });
    } else {
      const po={'Critique':0,'Haute':1,'Moyenne':2,'Basse':3,'Mineure':4};
      bugs.sort((a,b)=>(po[a.priority]??99)-(po[b.priority]??99));
      groups.push({label:null,items:bugs});
    }

    // Rendu
    const weekendBg = ticks.filter(t=>t.weekend).map(t=>`<div class="tl-weekend" style="left:${t.x}px;width:${DAY_PX}px;"></div>`).join('');
    const gridLines = ticks.map(t=>`<div class="tl-grid-line" style="left:${t.x}px;"></div>`).join('');
    const todayLine = `<div class="tl-today-line" style="left:${todayX}px;"><div class="tl-today-label">Auj.</div></div>`;
    const headerTicks = tickLabels.map(t=>`<div class="tl-tick-label" style="left:${LABEL_W+t.x}px;">${t.label}</div>`).join('');

    let rowsHtml = '';
    groups.forEach(group => {
      if (group.label !== null) {
        rowsHtml += `<div class="tl-group-header"><span>${this.esc(group.label)}</span></div>`;
      }
      group.items.forEach(b => {
        const startX = toX(b.date);
        const endX   = b.due_date ? toX(b.due_date) : startX + DAY_PX*3;
        const barW   = Math.max(endX - startX, DAY_PX*0.8);
        const color  = stateColors[b.state] || '#888';
        const pcolor = prioColors[b.priority] || '#888';
        const member = this.members.find(m=>m.name===b.assignee);
        const avatarSvg = member
          ? `<span class="tl-bar-avatar" style="background:${member.color};">${this.esc(member.initials)}</span>`
          : '';
        const isOverdue = b.due_date && new Date(b.due_date)<today && b.state!=='Résolu' && b.state!=='Fermé';
        const ts = this.toSlug;
        // Tooltip data
        const tip = `${b.id} | ${b.priority} | ${b.state}${b.assignee?' | '+b.assignee:''}${b.due_date?' | Échéance: '+this.fmtDate(b.due_date):''}`;

        rowsHtml += `<div class="tl-row">
          <div class="tl-label" title="${this.esc(b.title)}">
            <span class="tl-label-prio" style="background:${pcolor}22;color:${pcolor};border-color:${pcolor}44;">${b.priority.slice(0,3)}</span>
            <span class="tl-label-text">${this.esc(b.title)}</span>
          </div>
          <div class="tl-track" style="width:${totalW}px;">
            ${weekendBg}${gridLines}${todayLine}
            <div class="tl-bar ${isOverdue?'tl-bar-overdue':''}"
              style="left:${startX}px;width:${barW}px;background:${color}30;border:1.5px solid ${color};border-left:3px solid ${pcolor};"
              onclick="BO.openActionModal('${this.esc(b.id)}')"
              data-tip="${this.esc(tip)}">
              ${avatarSvg}
              <span class="tl-bar-label">${barW > 50 ? this.esc(b.title) : this.esc(b.id)}</span>
            </div>
          </div>
        </div>`;
      });
    });

    // No-date list
    const noDates = this.bugs.filter(b=>!b.date);

    board.innerHTML = `
      <div class="tl-wrap" id="tlWrap">
        <div style="min-width:${LABEL_W+totalW}px;position:relative;">
          <div class="tl-header" style="padding-left:${LABEL_W}px;height:32px;position:relative;">
            ${headerTicks}
          </div>
          ${rowsHtml}
        </div>
      </div>
      ${noDates.length ? `<div class="tl-no-date"><span style="color:var(--text-muted);font-size:12px;">⚠ ${noDates.length} mission${noDates.length>1?'s':''} sans date : ${noDates.map(b=>b.id).join(', ')}</span></div>` : ''}
      <div id="tlTooltip" class="tl-tooltip"></div>
    `;

    // Tooltip au survol
    const tooltip = document.getElementById('tlTooltip');
    board.querySelectorAll('.tl-bar').forEach(bar => {
      bar.addEventListener('mouseenter', e => {
        tooltip.textContent = bar.dataset.tip;
        tooltip.classList.add('visible');
      });
      bar.addEventListener('mousemove', e => {
        const rect = board.getBoundingClientRect();
        tooltip.style.left = (e.clientX - rect.left + 14) + 'px';
        tooltip.style.top  = (e.clientY - rect.top  - 10) + 'px';
      });
      bar.addEventListener('mouseleave', () => tooltip.classList.remove('visible'));
    });

    // Scroll auto vers aujourd'hui
    setTimeout(() => {
      const wrap = document.getElementById('tlWrap');
      if (wrap) wrap.scrollLeft = Math.max(0, todayX - 300);
    }, 50);
  },

  // ============================================================
  // CONFIG TAB
  // ============================================================
  renderConfigTab() {
    this.renderConfigSection('types',      'Types de missions', 'Ajouter un type…');
    this.renderConfigSection('categories', 'Catégories',        'Ajouter une catégorie…');
    this.renderMembersSection();
  },

  renderConfigSection(key, label, placeholder) {
    const container=document.getElementById(`config-${key}`);
    const items=this.config[key];
    container.innerHTML=`
      <div class="config-section">
        <div class="config-section-header">
          <span class="config-section-title">${label}</span>
          <span class="config-section-count">${items.length} entrée${items.length>1?'s':''}</span>
        </div>
        <div class="config-items" id="items-${key}">
          ${items.map((item,i)=>`
            <div class="config-item">
              <span class="config-item-drag">⠿</span>
              <input type="text" class="config-item-input" value="${this.esc(item)}"
                onchange="BO.editConfigItem('${key}',${i},this.value)"
                onblur="BO.editConfigItem('${key}',${i},this.value)">
              <button class="config-item-delete" onclick="BO.removeConfigItem('${key}',${i})">×</button>
            </div>`).join('')}
        </div>
        <div class="config-add-row">
          <input type="text" class="form-input config-add-input" id="newItem-${key}" placeholder="${placeholder}" maxlength="40">
          <button class="btn btn-primary config-add-btn" onclick="BO.addConfigItem('${key}')">+ Ajouter</button>
        </div>
        <div class="config-save-row">
          <button class="btn btn-primary" onclick="BO.saveConfig('${key}')">💾 Sauvegarder</button>
        </div>
      </div>`;
    document.getElementById(`newItem-${key}`)?.addEventListener('keydown',e=>{if(e.key==='Enter')this.addConfigItem(key);});
  },

  addConfigItem(key){
    const input=document.getElementById(`newItem-${key}`);
    const val=input.value.trim(); if(!val)return;
    if(this.config[key].includes(val)){this.showNotif(`"${val}" existe déjà.`,true);return;}
    this.config[key].push(val); input.value='';
    this.renderConfigSection(key,key==='types'?'Types de missions':'Catégories',key==='types'?'Ajouter un type…':'Ajouter une catégorie…');
  },
  editConfigItem(key,index,val){const v=val.trim();if(v)this.config[key][index]=v;},
  removeConfigItem(key,index){
    const item=this.config[key][index];
    if(!confirm(`Supprimer "${item}" ?`))return;
    this.config[key].splice(index,1);
    this.renderConfigSection(key,key==='types'?'Types de missions':'Catégories',key==='types'?'Ajouter un type…':'Ajouter une catégorie…');
  },
  async saveConfig(key){
    const btn=document.querySelector(`#config-${key} .config-save-row .btn-primary`);
    btn.textContent='Sauvegarde…';btn.disabled=true;
    try{
      await DB.updateConfig(key,this.config[key]);
      this.populateFilters();this.populateFormSelects();
      this.showNotif(`✓ ${key==='types'?'Types':'Catégories'} sauvegardés`);
    }catch(e){this.showNotif('Erreur : '+e.message,true);}
    finally{btn.textContent='💾 Sauvegarder';btn.disabled=false;}
  },

  // ---- MEMBRES ----
  renderMembersSection(){
    const container=document.getElementById('config-members');
    const COLORS=['#c8a030','#50b8ff','#40e0b0','#ff9040','#c060ff','#70d060','#ff5252','#ffd040'];
    container.innerHTML=`
      <div class="config-section">
        <div class="config-section-header">
          <span class="config-section-title">Membres</span>
          <span class="config-section-count">${this.members.length} membre${this.members.length>1?'s':''}</span>
        </div>
        <div class="config-items">
          ${this.members.map(m=>`
            <div class="config-item">
              <span class="avatar" style="background:${m.color};flex-shrink:0;">${this.esc(m.initials)}</span>
              <span style="flex:1;font-size:13px;color:var(--text-bright);">${this.esc(m.name)}</span>
              <button class="config-item-delete" onclick="BO.deleteMember(${m.id})">×</button>
            </div>`).join('') || '<div style="padding:12px;color:var(--text-faint);font-size:12px;">Aucun membre.</div>'}
        </div>
        <div class="config-add-row" style="flex-direction:column;align-items:stretch;gap:8px;">
          <input type="text" class="form-input" id="newMemberName" placeholder="Nom complet…" maxlength="40">
          <div style="display:flex;gap:8px;">
            <input type="text" class="form-input" id="newMemberInitials" placeholder="Initiales (ex: JD)" maxlength="3" style="width:80px;">
            <select class="form-select" id="newMemberColor" style="flex:1;">
              ${COLORS.map(c=>`<option value="${c}" style="background:${c}">${c}</option>`).join('')}
            </select>
            <button class="btn btn-primary" onclick="BO.addMember()">+ Ajouter</button>
          </div>
        </div>
      </div>`;
  },

  async addMember(){
    const name=document.getElementById('newMemberName').value.trim();
    const initials=document.getElementById('newMemberInitials').value.trim().toUpperCase();
    const color=document.getElementById('newMemberColor').value;
    if(!name||!initials){this.showNotif('Remplissez nom et initiales.',true);return;}
    try{
      const created=await DB.insertMember({name,initials,color});
      this.members.push(Array.isArray(created)?created[0]:{name,initials,color,id:Date.now()});
      this.renderMembersSection();
      this.showNotif(`✓ Membre ${name} ajouté`);
    }catch(e){this.showNotif('Erreur : '+e.message,true);}
  },

  async deleteMember(id){
    if(!confirm('Supprimer ce membre ?'))return;
    try{
      await DB.deleteMember(id);
      this.members=this.members.filter(m=>m.id!==id);
      this.renderMembersSection();
      this.showNotif('✓ Membre supprimé');
    }catch(e){this.showNotif('Erreur : '+e.message,true);}
  },

  // ============================================================
  // EXPORT CSV
  // ============================================================
  exportCSV(){
    const data=this.getSorted(this.getFiltered());
    const headers=['ID','Type','Catégorie','Priorité','Titre','Description','État','Assigné','Date','Échéance'];
    const esc=v=>`"${String(v||'').replace(/"/g,'""')}"`;
    const rows=data.map(b=>[b.id,b.type,b.category,b.priority,b.title,b.description,b.state,b.assignee||'',b.date,b.due_date||''].map(esc).join(','));
    const csv=[headers.join(','),...rows].join('\n');
    const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;a.download=`command-post-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
  },

  // ============================================================
  // UTILS
  // ============================================================

  // ============================================================
  // MODALE ACTIONS (···)
  // ============================================================
  openActionModal(id) {
    const bug = this.bugs.find(b => b.id === id);
    if (!bug) return;
    const d  = this.esc.bind(this);
    const ts = this.toSlug;
    const member = this.members.find(m => m.name === bug.assignee);
    const avatarHtml = member
      ? '<span class="avatar" style="background:' + member.color + ';width:20px;height:20px;font-size:9px;margin-left:4px;">' + d(member.initials) + '</span>'
      : '';
    document.getElementById('actionModalSubtitle').innerHTML =
      '<span class="bug-id">' + d(bug.id) + '</span>' +
      '<span class="badge badge-prio-' + ts(bug.priority) + '" style="margin-left:6px;font-size:10px;"><span class="badge-dot"></span>' + d(bug.priority) + '</span>' +
      avatarHtml;
    document.getElementById('actionModalTitle').textContent = bug.title;
    document.getElementById('actionModalOverlay').dataset.bugId = id;
    document.getElementById('actionModalOverlay').classList.remove('hidden');
  },

  closeActionModal() {
    document.getElementById('actionModalOverlay').classList.add('hidden');
  },

  doAction(action) {
    const id = document.getElementById('actionModalOverlay').dataset.bugId;
    this.closeActionModal();
    setTimeout(() => {
      if (action === 'edit')     this.openEdit(id);
      if (action === 'comments') this.openComments(id);
      if (action === 'history')  this.openHistory(id);
      if (action === 'archive')  this.archiveMission(id);
      if (action === 'delete')   this.openDelete(id);
    }, 80);
  },


  // ============================================================
  // DÉTAIL MISSION
  // ============================================================
  openDetail(id) {
    const bug = this.bugs.find(b => b.id === id);
    if (!bug) return;
    const d  = this.esc.bind(this);
    const ts = this.toSlug;
    const member = this.members.find(m => m.name === bug.assignee);
    const avatarHtml = member
      ? '<span class="avatar" style="background:' + member.color + ';width:22px;height:22px;font-size:9px;">' + d(member.initials) + '</span> ' + d(member.name)
      : '<span style="color:var(--text-faint)">Non assigné</span>';

    const today = new Date(); today.setHours(0,0,0,0);
    let dueDateHtml = '<span style="color:var(--text-faint)">—</span>';
    if (bug.due_date) {
      const diff = Math.ceil((new Date(bug.due_date) - today) / 864e5);
      const done = bug.state === 'Résolu' || bug.state === 'Fermé';
      const cls  = !done && diff < 0 ? 'color:var(--p-critical)' : !done && diff <= 3 ? 'color:var(--p-medium)' : 'color:var(--text-base)';
      const icon = !done && diff < 0 ? '⚠ ' : !done && diff <= 3 ? '⏰ ' : '';
      dueDateHtml = '<span style="' + cls + '">' + icon + this.fmtDate(bug.due_date) + '</span>';
    }

    const blocksHtml = bug.blocks && bug.blocks.length
      ? bug.blocks.map(bid => {
          const b2 = this.bugs.find(x => x.id === bid);
          return '<span class="block-tag">' + d(bid) + (b2 ? ' — ' + d(b2.title.slice(0,30)) : '') + '</span>';
        }).join('')
      : '<span style="color:var(--text-faint)">Aucune</span>';

    document.getElementById('detailModal').innerHTML =
      '<div class="modal detail-modal">' +
        '<div class="detail-header-band">' +
          '<div class="detail-id-row">' +
            '<span class="bug-id">' + d(bug.id) + '</span>' +
            '<span class="badge badge-type-' + ts(bug.type) + '"><span class="badge-dot"></span>' + d(bug.type) + '</span>' +
            '<span class="badge badge-cat-' + ts(bug.category) + '"><span class="badge-dot"></span>' + d(bug.category) + '</span>' +
          '</div>' +
          '<div class="detail-title">' + d(bug.title) + '</div>' +
          '<div class="detail-badges">' +
            '<span class="badge badge-prio-' + ts(bug.priority) + '"><span class="badge-dot"></span>' + d(bug.priority) + '</span>' +
            '<span class="badge badge-state-' + ts(bug.state) + '"><span class="badge-dot"></span>' + d(bug.state) + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="detail-body">' +
          '<div>' +
            '<div class="detail-section-label">Description</div>' +
            '<div class="detail-description">' + d(bug.description) + '</div>' +
          '</div>' +
          '<div class="detail-grid">' +
            '<div class="detail-field"><div class="detail-section-label">Assigné à</div><div class="detail-field-value">' + avatarHtml + '</div></div>' +
            '<div class="detail-field"><div class="detail-section-label">Date arrivée</div><div class="detail-field-value">' + this.fmtDate(bug.date) + '</div></div>' +
            '<div class="detail-field"><div class="detail-section-label">Échéance</div><div class="detail-field-value">' + dueDateHtml + '</div></div>' +
            '<div class="detail-field"><div class="detail-section-label">Priorité</div><div class="detail-field-value"><span class="badge badge-prio-' + ts(bug.priority) + '"><span class="badge-dot"></span>' + d(bug.priority) + '</span></div></div>' +
          '</div>' +
          '<div><div class="detail-section-label">Missions bloquées</div><div class="detail-blocks">' + blocksHtml + '</div></div>' +
          (bug.ref_url ? '<div style="margin-top:12px;"><div class="detail-section-label">Lien de référence</div><a href="' + d(bug.ref_url) + '" target="_blank" rel="noopener" style="font-size:13px;color:var(--blue-bright);word-break:break-all;">' + d(bug.ref_url) + '</a></div>' : '') +
        '</div>' +
        '<div class="detail-footer">' +
          '<button class="btn btn-secondary" onclick="BO.closeDetail()">Fermer</button>' +
          '<button class="btn btn-secondary" onclick="BO.closeDetail();BO.openComments(\'' + d(bug.id) + '\')">💬 Commentaires</button>' +
          '<button class="btn btn-secondary" onclick="BO.closeDetail();BO.openHistory(\'' + d(bug.id) + '\')">📋 Historique</button>' +
          '<button class="btn btn-primary" onclick="BO.closeDetail();BO.openActionModal(\'' + d(bug.id) + '\')">⚡ Actions</button>' +
        '</div>' +
      '</div>';

    document.getElementById('detailOverlay').classList.remove('hidden');
  },

  closeDetail() {
    document.getElementById('detailOverlay').classList.add('hidden');
  },

  logout(){sessionStorage.removeItem('bo_auth');window.location.href='login.html';},
  showNotif(msg,isError=false){
    const el=document.getElementById('notification');
    el.textContent=msg;el.classList.toggle('error',isError);el.classList.remove('hidden');
    clearTimeout(this._notifTimer);
    this._notifTimer=setTimeout(()=>el.classList.add('hidden'),3200);
  },
  toSlug(str){return String(str).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'');},
  fmtDate(d){if(!d)return'—';return new Date(d).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric'});},
  fmtDatetime(d){if(!d)return'—';return new Date(d).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});},
  esc(str){return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')},

  // ============================================================
  // DEMANDES
  // ============================================================
  renderRequestsTab() {
    this.updateReqBadge();
    this.renderReqList();
  },

  updateReqBadge() {
    const pending = this.requests.filter(r => r.status === 'pending').length;
    const badge   = document.getElementById('reqBadge');
    if (badge) { badge.textContent = pending; badge.style.display = pending > 0 ? '' : 'none'; }
    ['pending','accepted','rejected'].forEach(s => {
      const key = s.charAt(0).toUpperCase() + s.slice(1);
      const el  = document.getElementById('reqTabCount' + key);
      if (el) el.textContent = '(' + this.requests.filter(r => r.status === s).length + ')';
    });
  },

  switchReqTab(tab) {
    this.currentReqTab = tab;
    ['pending','accepted','rejected'].forEach(t => {
      const key = t.charAt(0).toUpperCase() + t.slice(1);
      document.getElementById('reqTab' + key)?.classList.toggle('tab-active', t === tab);
    });
    this.renderReqList();
  },

  renderReqList() {
    const el = document.getElementById('reqAdminList');
    if (!el) return;
    const filtered = this.requests.filter(r => r.status === this.currentReqTab);

    if (!filtered.length) {
      const msgs = {
        pending:  'Aucune demande en attente.',
        accepted: 'Aucune demande acceptée.',
        rejected: 'Aucune demande refusée.'
      };
      el.innerHTML = '<div class="empty-state"><span class="empty-icon">📥</span><p>' + msgs[this.currentReqTab] + '</p></div>';
      return;
    }

    el.innerHTML = '<div class="bugs-table-wrapper">' + filtered.map(r => {
      const d   = this.esc.bind(this);
      const ts  = this.toSlug;
      const actions = this.currentReqTab === 'pending'
        ? '<div style="display:flex;gap:7px;flex-shrink:0;">' +
            '<button class="btn btn-primary" style="font-size:12px;padding:6px 14px;" onclick="BO.openAcceptModal(' + r.id + ')">✅ Accepter</button>' +
            '<button class="btn btn-danger"  style="font-size:12px;padding:6px 14px;" onclick="BO.rejectRequest(' + r.id + ')">✕ Refuser</button>' +
          '</div>'
        : '';
      return '<div class="request-admin-item">' +
        '<div class="request-admin-top">' +
          '<div class="request-admin-info">' +
            '<div class="request-admin-title">' + d(r.title) + '</div>' +
            '<div class="request-admin-meta" style="margin-bottom:8px;">' +
              '<span class="badge badge-type-' + ts(r.type) + '" style="font-size:10px;">' + d(r.type) + '</span>' +
              '<span class="badge badge-cat-' + ts(r.category) + '" style="font-size:10px;">' + d(r.category) + '</span>' +
              '<span style="font-size:11px;color:var(--text-muted);">👤 ' + d(r.author_name) + '</span>' +
              '<span style="font-size:11px;color:var(--text-muted);">✉ ' + d(r.author_email) + '</span>' +
              '<span style="font-size:11px;color:var(--text-faint);font-family:DM Mono,monospace;">' + this.fmtDatetime(r.created_at) + '</span>' +
            '</div>' +
          '</div>' +
          actions +
        '</div>' +
        '<div style="font-size:12px;color:var(--text-muted);line-height:1.6;padding:10px 12px;background:var(--bg-raised);border-radius:var(--r-md);border:1px solid var(--border-dim);">' +
          d(r.description) +
        '</div>' +
      '</div>';
    }).join('') + '</div>';
  },

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
