// ============================================
// FRONT — Mission Board public
// Liste + Kanban + Commentaires + Export CSV + Dark/Light
// ============================================
const Front = {
  bugs: [],
  members: [],
  config: { types:[], categories:[], priorities:['Critique','Haute','Moyenne','Basse','Mineure'], states:['Nouveau','En cours','Résolu','Fermé','Rejeté','En attente'] },
  clients: [],
  view: 'list',
  currentPage: 1,
  perPage: 20,
  totalBugs: 0,
  sortField: 'date',
  sortDir: 'desc',
  filters: { type:'', priority:'', state:'', search:'', client_id:'' },

  async init() {
    this.showLoading(true);
    try {
      // 1. Charger bugs en priorité — afficher le tableau le plus vite possible
      const paged = await DB.fetchBugsPaged({page:1, perPage:this.perPage});
      this.bugs      = paged.data;
      this.totalBugs = paged.total;
      this.showLoading(false);
      this.bindEvents();
      this.renderStats();
      this._skipNextFetch = true;
      this.render();

      // 2. Charger config/members/clients en arrière-plan
      const [cfg, members, clients] = await Promise.all([
        DB.fetchConfig(),
        DB.fetchMembers(),
        DB.fetchClients()
      ]);
      this.members = members;
      this.clients = clients;
      if (cfg.types)      this.config.types      = cfg.types;
      if (cfg.categories) this.config.categories = cfg.categories;
      // Re-rendre avec les membres/clients maintenant disponibles
      this.populateFilters();
      this._skipNextFetch = true;
      this.render();
    } catch(e) {
      this.showLoading(false);
      this.showError('Impossible de charger les données.');
    }
    // Realtime
    if (typeof Realtime !== 'undefined') {
      Realtime.subscribe('bugs', {
        onInsert: (rec) => {
          this.totalBugs = (this.totalBugs||0) + 1;
          this.renderStats();
          if (this.view==='list' && this.currentPage===1) this.renderList();
          Realtime.notify('Nouvelle mission : ' + (rec.title||rec.id), 'info');
        },
        onUpdate: (rec) => {
          if (this.view==='list') this.renderList();
        },
        onDelete: () => {
          this.totalBugs = Math.max(0, (this.totalBugs||1) - 1);
          this.renderStats();
          if (this.view==='list') this.renderList();
        }
      });
    }
  },

  showLoading(on) {
    const tbody = document.getElementById('bugsTableBody');
    if (!tbody) return;
    if (on) {
      tbody.innerHTML = this._skeletonRows(8, ['90px','115px','94px','100%','106px','124px','44px','96px','88px','44px']);
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


  showError(msg){const el=document.getElementById('errorBanner');if(el){el.textContent=msg;el.style.display='block';}},

  populateFilters() {
    const sel=(id,arr,all='Tous')=>{
      const el=document.getElementById(id);if(!el)return;
      el.innerHTML=`<option value="">${all}</option>`;
      arr.forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=v;el.appendChild(o);});
    };
    sel('filterType',this.config.types);
    sel('filterPriority',this.config.priorities);
    sel('filterState',this.config.states);
    const fcl=document.getElementById('filterClient');
    if(fcl){
      const cur=fcl.value; fcl.innerHTML='<option value="">Tous</option>';
      this.clients.forEach(c=>{const o=document.createElement('option');o.value=c.id;o.textContent=c.name;fcl.appendChild(o);});
      if([...fcl.options].some(o=>o.value===cur))fcl.value=cur;
    }
  },

  bindEvents() {
    ['filterType','filterPriority','filterState','filterClient'].forEach(id=>{
      document.getElementById(id)?.addEventListener('change',e=>{
        const map={filterType:'type',filterPriority:'priority',filterState:'state',filterClient:'client_id'};
        this.filters[map[id]]=e.target.value;this.currentPage=1;this.render();
      });
    });
    document.getElementById('searchInput')?.addEventListener('input',e=>{
      this.filters.search=e.target.value.toLowerCase();this.currentPage=1;
      clearTimeout(this._searchTimer);this._searchTimer=setTimeout(()=>this.render(),300);
    });
    document.querySelectorAll('[data-sort]').forEach(th=>{
      th.addEventListener('click',()=>{
        const f=th.dataset.sort;
        if(this.sortField===f)this.sortDir=this.sortDir==='asc'?'desc':'asc';
        else{this.sortField=f;this.sortDir='asc';}
        this.render();
      });
    });
    document.getElementById('btnViewList')?.addEventListener('click',()=>this.switchView('list'));
    document.getElementById('btnViewKanban')?.addEventListener('click',()=>this.switchView('kanban'));
    document.getElementById('btnViewTimeline')?.addEventListener('click',()=>this.switchView('timeline'));
    document.getElementById('btnExportCSV')?.addEventListener('click',()=>this.exportCSV());
        document.getElementById('commentsModal')?.addEventListener('click',e=>{if(e.target===document.getElementById('commentsModal'))this.closeComments();});
    document.getElementById('detailOverlay')?.addEventListener('click',e=>{if(e.target===document.getElementById('detailOverlay'))this.closeDetail();});
  },


  timeline: {
    zoom: 'month',
    group: 'category',
    focusMode: false
  },

  switchView(v) {
    const prev = this.view;
    this.view = v;

    ['list','kanban','timeline'].forEach(name => {
      const btn   = document.getElementById('btnView' + name.charAt(0).toUpperCase() + name.slice(1));
      const panel = document.getElementById('panel'   + name.charAt(0).toUpperCase() + name.slice(1));
      if (btn) btn.classList.toggle('view-btn-active', v === name);
      if (panel) {
        if (v === name) {
          panel.style.display = '';
          panel.classList.remove('view-panel-out');
          panel.classList.add('view-panel');
          // Retirer la classe après l'animation
          setTimeout(() => panel.classList.remove('view-panel'), 300);
        } else {
          panel.style.display = 'none';
          panel.classList.remove('view-panel');
        }
      }
    });

    const fb = document.getElementById('filtersBar');
    if (fb) fb.style.display = v === 'timeline' ? 'none' : '';
    if (v === 'kanban')   this.renderKanban();
    if (v === 'timeline') this.renderTimeline();
  },

  renderStats() {
    const total=this.totalBugs||this.bugs.length;
    const critical=this.bugs.filter(b=>b.priority==='Critique').length;
    const progress=this.bugs.filter(b=>b.state==='En cours').length;
    const resolved=this.bugs.filter(b=>b.state==='Résolu').length;
    const overdue=this.bugs.filter(b=>b.due_date&&new Date(b.due_date)<new Date()&&b.state!=='Résolu'&&b.state!=='Fermé').length;
    document.getElementById('statsRow').innerHTML=`
      <div class="stat-chip"><strong>${total}</strong> missions</div>
      <div class="stat-chip" style="color:var(--p-critical)"><span class="stat-chip-dot"></span><strong>${critical}</strong> critiques</div>
      <div class="stat-chip" style="color:var(--s-progress)"><span class="stat-chip-dot"></span><strong>${progress}</strong> en cours</div>
      <div class="stat-chip" style="color:var(--s-resolved)"><span class="stat-chip-dot"></span><strong>${resolved}</strong> résolus</div>
      ${overdue>0?`<div class="stat-chip" style="color:var(--p-critical);animation:pulse-red 2s infinite"><span class="stat-chip-dot"></span><strong>${overdue}</strong> en retard</div>`:''}
    `;
  },

  getFiltered() {
    return this.bugs.filter(b=>{
      if(this.filters.type     &&b.type    !==this.filters.type)    return false;
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

  render(){if(this.view==='list')this.renderList();else if(this.view==='kanban')this.renderKanban();else if(this.view==='timeline')this.renderTimeline();},

  async renderList() {
    if (this._skipNextFetch) {
      this._skipNextFetch = false;
    } else {
      this.showLoading(true);
      try {
        const result = await DB.fetchBugsPaged({
          page: this.currentPage,
          perPage: this.perPage,
          filters: this.filters,
          sort: this.sortField,
          dir: this.sortDir
        });
        this.bugs = result.data;
        this.totalBugs = result.total;
      } catch(e) {
        this.showError('Erreur chargement : ' + e.message);
        this.showLoading(false);
        return;
      }
      this.showLoading(false);
    }
    const total = this.totalBugs;
    const totalPages = Math.max(1, Math.ceil(total / this.perPage));
    this.currentPage = Math.min(this.currentPage, totalPages);
    document.getElementById('filterCount').textContent = `${total} résultat${total>1?'s':''}`;
    document.querySelectorAll('[data-sort]').forEach(th => {
      th.classList.toggle('sorted', th.dataset.sort === this.sortField);
      const a = th.querySelector('.sort-arrow');
      if (a) a.textContent = th.dataset.sort === this.sortField ? (this.sortDir==='asc'?'↑':'↓') : '↕';
    });
    const tbody = document.getElementById('bugsTableBody');
    tbody.innerHTML = this.bugs.length === 0
      ? `<tr><td colspan="10"><div class="empty-state"><span class="empty-icon">⊘</span><p>Aucune mission.</p></div></td></tr>`
      : this.bugs.map(b => this.renderRow(b)).join('');
    this.renderPagination(total, totalPages);
  },

  renderRow(b) {
    const ts=toSlug,d=esc;
    const member=this.members.find(m=>m.name===b.assignee);
    const avatarHtml=member
      ?`<span class="avatar" style="background:${member.color}" title="${d(member.name)}">${d(member.initials)}</span>`
      :`<span class="avatar avatar-unassigned" title="Non assigné">·</span>`;
    const dueDateHtml=renderDueDate(b.due_date,b.state);
    const blocksHtml=b.blocks?.length?`<span class="block-tag" style="font-size:10px;padding:1px 5px;margin-left:4px;">🔗${b.blocks.length}</span>`:'';
    return `<tr class="clickable-row" onclick="Front.openDetail('${esc(b.id)}')">
      <td><span class="badge badge-type-${ts(b.type)}">${esc(b.type)}</span></td>
      <td><span class="badge badge-cat-${ts(b.category)}">${esc(b.category)}</span></td>
      <td><span class="bug-id" onclick="event.stopPropagation();copyId('${esc(b.id)}',this)" title="Cliquer pour copier">${esc(b.id)}</span>${blocksHtml}</td>
      <td>${clientBadge(b.client_id, this._ctx?.clients||this.clients||[])}</td>
      <td><div class="bug-desc"><div class="bug-desc-title">${esc(b.title)}</div><div class="bug-desc-detail">${esc(b.description)}</div></div></td>
      <td><span class="badge badge-prio-${ts(b.priority)}"><span class="badge-dot"></span>${esc(b.priority)}</span></td>
      <td><span class="badge badge-state-${ts(b.state)}"><span class="badge-dot"></span>${esc(b.state)}</span></td>
      <td style="text-align:center;">${avatarHtml}</td>
      <td><div class="date-main">${b.start_date ? fmtDate(b.start_date) : '<span style="color:var(--text-faint)">—</span>'}</div></td>
      <td>${dueDateHtml}</td>
      <td style="text-align:center;"><button class="comments-btn" onclick="event.stopPropagation();Front.openComments('${esc(b.id)}')" title="Commentaires">💬</button></td>
    </tr>`;
  },

  renderDueDate(due,state){
    if(!due)return'<span class="due-date" style="color:var(--text-faint)">—</span>';
    const today=new Date();today.setHours(0,0,0,0);
    const d=new Date(due);
    const diff=Math.ceil((d-today)/(1000*60*60*24));
    const done=state==='Résolu'||state==='Fermé';
    let cls='ok',label=fmtDate(due);
    if(!done&&diff<0){cls='overdue';label=`⚠ ${fmtDate(due)}`;}
    else if(!done&&diff<=3){cls='due-soon';label=`⏰ ${fmtDate(due)}`;}
    return `<span class="due-date ${cls}">${label}</span>`;
  },

  renderPagination(total,totalPages) {
    const el=document.getElementById('pagination');
    const s=(this.currentPage-1)*this.perPage+1,e=Math.min(this.currentPage*this.perPage,total);
    let btns=`<button class="page-btn" onclick="Front.goPage(${this.currentPage-1})" ${this.currentPage===1?'disabled':''}>‹</button>`;
    for(let i=1;i<=totalPages;i++){
      if(totalPages>7&&Math.abs(i-this.currentPage)>2&&i!==1&&i!==totalPages){if(i===2||i===totalPages-1)btns+=`<span class="page-btn" style="cursor:default;border:none;opacity:.4">…</span>`;continue;}
      btns+=`<button class="page-btn ${i===this.currentPage?'active':''}" onclick="Front.goPage(${i})">${i}</button>`;
    }
    btns+=`<button class="page-btn" onclick="Front.goPage(${this.currentPage+1})" ${this.currentPage===totalPages?'disabled':''}>›</button>`;
    el.innerHTML=`<span class="pagination-info">Affichage ${total===0?0:s}–${e} sur ${total}</span><div class="pagination-controls">${btns}</div>`;
  },

  goPage(p){const t=Math.max(1,Math.ceil(this.totalBugs/this.perPage));if(p<1||p>t)return;this.currentPage=p;this.renderList();window.scrollTo({top:0,behavior:'smooth'});},

  renderKanban() { Kanban.render(); },
  renderKanbanCard(b) { return Kanban.renderCard(b); },

  async openComments(bugId) { await Comments.open(bugId); },
  renderComments(c) { Comments.render(c); },
  closeComments() { Comments.close(); },
  async submitComment() { await Comments.submit(); },


  /* ---- TIMELINE ---- */
  async renderTimeline() { await Timeline.render(); },
  setTlZoom(z)      { this.timeline.zoom=z;                    Timeline._draw(); },
  setTlGroup(g)     { this.timeline.group=g;                   Timeline._draw(); },
  setTlFilter(k,v)  { this.timeline.filters[k]=v;              Timeline._draw(); },
  toggleTlFocus()   { this.timeline.focusMode=!this.timeline.focusMode; Timeline.render(); },
  scrollTlToday()   { Timeline.scrollTlToday(); },
};

document.addEventListener('DOMContentLoaded',()=>Front.init());
