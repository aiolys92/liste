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
    this.loadTheme();
    this.showLoading(true);
    try {
      const [paged, cfg, members, clients] = await Promise.all([
        DB.fetchBugsPaged({page:1, perPage:this.perPage}),
        DB.fetchConfig(),
        DB.fetchMembers(),
        DB.fetchClients()
      ]);
      this.bugs      = paged.data;
      this.totalBugs = paged.total;
      this.members   = members;
      this.clients   = clients;
      if (cfg.types)      this.config.types      = cfg.types;
      if (cfg.categories) this.config.categories = cfg.categories;
    } catch(e) { this.showError('Impossible de charger les données.'); }
    this.showLoading(false);
    this.populateFilters();
    this.bindEvents();
    this.renderStats();
    this.render();
    // Realtime
    if (typeof Realtime !== 'undefined') {
      Realtime.subscribe('bugs', {
        onInsert: (rec) => { this.renderStats(); if(this.view==='list') this.renderList(); Realtime.notify('Nouvelle mission : ' + rec.title, 'info'); },
        onUpdate: (rec) => { this.renderStats(); if(this.view==='list') this.renderList(); },
        onDelete: ()    => { this.renderStats(); if(this.view==='list') this.renderList(); }
      });
    }
  },

  loadTheme() {
    const t=localStorage.getItem('cp_theme')||'dark';
    document.body.classList.toggle('light',t==='light');
    const btn=document.getElementById('themeToggle');
    if(btn)btn.textContent=t==='light'?'🌙':'☀️';
  },
  toggleTheme() {
    const isLight=document.body.classList.toggle('light');
    localStorage.setItem('cp_theme',isLight?'light':'dark');
    const btn=document.getElementById('themeToggle');
    if(btn)btn.textContent=isLight?'🌙':'☀️';
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
    document.getElementById('themeToggle')?.addEventListener('click',()=>this.toggleTheme());
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
    const total=this.bugs.length;
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
    const ts=this.toSlug,d=this.esc.bind(this);
    const member=this.members.find(m=>m.name===b.assignee);
    const avatarHtml=member
      ?`<span class="avatar" style="background:${member.color}" title="${d(member.name)}">${d(member.initials)}</span>`
      :`<span class="avatar avatar-unassigned" title="Non assigné">·</span>`;
    const dueDateHtml=this.renderDueDate(b.due_date,b.state);
    const blocksHtml=b.blocks?.length?`<span class="block-tag" style="font-size:10px;padding:1px 5px;margin-left:4px;">🔗${b.blocks.length}</span>`:'';
    return `<tr class="clickable-row" onclick="Front.openDetail('${d(b.id)}')">
      <td><span class="badge badge-type-${ts(b.type)}">${d(b.type)}</span></td>
      <td><span class="badge badge-cat-${ts(b.category)}">${d(b.category)}</span></td>
      <td><span class="bug-id" onclick="event.stopPropagation();copyId('${d(b.id)}',this)" title="Cliquer pour copier">${d(b.id)}</span>${blocksHtml}</td>
      <td>${this._clientBadge(b.client_id)}</td>
      <td><div class="bug-desc"><div class="bug-desc-title">${d(b.title)}</div><div class="bug-desc-detail">${d(b.description)}</div></div></td>
      <td><span class="badge badge-prio-${ts(b.priority)}"><span class="badge-dot"></span>${d(b.priority)}</span></td>
      <td><span class="badge badge-state-${ts(b.state)}"><span class="badge-dot"></span>${d(b.state)}</span></td>
      <td style="text-align:center;">${avatarHtml}</td>
      <td>${dueDateHtml}</td>
      <td><div class="date-main">${this.fmtDate(b.date)}</div></td>
      <td style="text-align:center;"><button class="comments-btn" onclick="event.stopPropagation();Front.openComments('${d(b.id)}')" title="Commentaires">💬</button></td>
    </tr>`;
  },

  renderDueDate(due,state){
    if(!due)return'<span class="due-date" style="color:var(--text-faint)">—</span>';
    const today=new Date();today.setHours(0,0,0,0);
    const d=new Date(due);
    const diff=Math.ceil((d-today)/(1000*60*60*24));
    const done=state==='Résolu'||state==='Fermé';
    let cls='ok',label=this.fmtDate(due);
    if(!done&&diff<0){cls='overdue';label=`⚠ ${this.fmtDate(due)}`;}
    else if(!done&&diff<=3){cls='due-soon';label=`⏰ ${this.fmtDate(due)}`;}
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

  renderKanban() {
    const filtered=this.getFiltered(),board=document.getElementById('kanbanBoard');
    const cols={};this.config.categories.forEach(c=>{cols[c]=[];});
    filtered.forEach(b=>{if(cols[b.category])cols[b.category].push(b);else cols[b.category]=[b];});
    board.innerHTML=this.config.categories.map(cat=>{
      const bugs=cols[cat]||[];
      const po={'Critique':0,'Haute':1,'Moyenne':2,'Basse':3,'Mineure':4};
      bugs.sort((a,b)=>(po[a.priority]??99)-(po[b.priority]??99));
      const critCount=bugs.filter(b=>b.priority==='Critique').length;
      const critBadge=critCount>0?`<span class="kanban-col-alert">${critCount} ⚠</span>`:'';
      return `<div class="kanban-col">
        <div class="kanban-col-header">
          <div class="kanban-col-title-row"><span class="badge badge-cat-${this.toSlug(cat)} kanban-col-badge"><span class="badge-dot"></span>${this.esc(cat)}</span>${critBadge}</div>
          <span class="kanban-col-count">${bugs.length}</span>
        </div>
        <div class="kanban-cards">
          ${bugs.length===0?`<div class="kanban-empty">Aucune mission</div>`:bugs.map(b=>this.renderKanbanCard(b)).join('')}
        </div>
      </div>`;
    }).join('');
  },

  renderKanbanCard(b) {
    const ts=this.toSlug, d=this.esc.bind(this);
    const member = this.members.find(m=>m.name===b.assignee);
    const avatarHtml = member
      ? `<span class="avatar" style="background:${member.color};width:20px;height:20px;font-size:9px;flex-shrink:0;" title="${d(member.name)}">${d(member.initials)}</span>`
      : '';
    const dueHtml = this.renderDueDate(b.due_date, b.state);
    const blocksHtml = b.blocks?.length
      ? `<span class="kanban-card-blocks">🔗 ${b.blocks.length}</span>` : '';
    const clientHtml  = this._clientBadge(b.client_id);
    const versionHtml = b.target_version
      ? `<span class="kanban-card-version">v${d(b.target_version)}</span>` : '';
    const refHtml = b.ref_url
      ? `<a class="kanban-card-link" href="${d(b.ref_url)}" target="_blank"
           onclick="event.stopPropagation()" title="Lien de référence">🔗 Ref</a>` : '';

    return `<div class="kanban-card kanban-card-prio-${ts(b.priority)}"
      onclick="Front.openDetail('${d(b.id)}')"
      style="transition:transform 0.15s,box-shadow 0.15s;">

      <!-- En-tête : type + ID + priorité -->
      <div class="kanban-card-top">
        <div style="display:flex;flex-direction:column;gap:2px;min-width:0;">
          <span class="kanban-card-type">${d(b.type)}</span>
          <span class="kanban-card-id" onclick="event.stopPropagation();copyId('${d(b.id)}',this)"
            title="Copier l'ID" style="cursor:pointer;">${d(b.id)}</span>
        </div>
        <span class="badge badge-prio-${ts(b.priority)} kanban-card-prio-badge">${d(b.priority)}</span>
      </div>

      <!-- Titre -->
      <div class="kanban-card-title">${d(b.title)}</div>

      <!-- Description complète -->
      <div class="kanban-card-desc">${d(b.description)}</div>

      <!-- État + assigné + échéance -->
      <div class="kanban-card-footer" style="margin-top:8px;">
        <span class="badge badge-state-${ts(b.state)} kanban-card-state">${d(b.state)}</span>
        <div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;">
          ${avatarHtml}
          ${dueHtml}
        </div>
      </div>

      <!-- Méta : version, blocs, lien, commentaires -->
      <div class="kanban-card-meta">
        ${versionHtml}
        ${blocksHtml}
        ${refHtml}
        <button class="comments-btn" style="font-size:11px;padding:2px 6px;margin-left:auto;"
          onclick="event.stopPropagation();Front.openComments('${d(b.id)}')">💬</button>
      </div>

    </div>`;
  },

  async openComments(bugId) {
    const bug=this.bugs.find(b=>b.id===bugId);if(!bug)return;
    document.getElementById('commentsModalTitle').textContent=bug.title;
    document.getElementById('commentsBugId').textContent=bugId;
    document.getElementById('commentsList').innerHTML='<div class="comments-loading">Chargement…</div>';
    document.getElementById('commentsModal').classList.remove('hidden');
    try{
      const comments=await DB.fetchComments(bugId);
      this.renderComments(comments);
    }catch(e){document.getElementById('commentsList').innerHTML='<div class="comments-error">Erreur.</div>';}
  },

  renderComments(comments) {
    const el=document.getElementById('commentsList');
    if(!comments.length){el.innerHTML='<div class="comments-empty">Aucun commentaire. Soyez le premier !</div>';return;}
    el.innerHTML=comments.map(c=>`
      <div class="comment-item">
        <div class="comment-header">
          <span class="comment-author">${this.esc(c.author)}</span>
          <span class="comment-date">${this.fmtDatetime(c.created_at)}</span>
        </div>
        <div class="comment-content">${this.esc(c.content)}</div>
      </div>`).join('');
  },

  closeComments(){document.getElementById('commentsModal').classList.add('hidden');},

  async submitComment() {
    const bugId=document.getElementById('commentsBugId').textContent;
    const author=document.getElementById('commentAuthor').value.trim();
    const content=document.getElementById('commentContent').value.trim();
    if(!author||!content){alert('Merci de remplir votre nom et commentaire.');return;}
    const btn=document.getElementById('btnSubmitComment');btn.textContent='Envoi…';btn.disabled=true;
    try{
      await DB.insertComment(bugId,author,content);
      document.getElementById('commentAuthor').value='';document.getElementById('commentContent').value='';
      const comments=await DB.fetchComments(bugId);this.renderComments(comments);
    }catch(e){alert('Erreur : '+e.message);}
    finally{btn.textContent='Publier';btn.disabled=false;}
  },


  /* ---- TIMELINE ---- */
  renderTimeline() {
    const container = document.getElementById('panelTimeline');
    const tl = this.timeline;
    const DAY_PX = tl.zoom==='week' ? 60 : tl.zoom==='month' ? 28 : 12;
    const LABEL_W = 200;

    container.innerHTML = `
      <div class="tl-toolbar">
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
          <div class="tl-zoom-group">
            <button class="tl-zoom-btn ${tl.zoom==='week'?'active':''}"    onclick="Front.setTlZoom('week')">Semaine</button>
            <button class="tl-zoom-btn ${tl.zoom==='month'?'active':''}"   onclick="Front.setTlZoom('month')">Mois</button>
            <button class="tl-zoom-btn ${tl.zoom==='quarter'?'active':''}" onclick="Front.setTlZoom('quarter')">Trimestre</button>
          </div>
          <div class="filter-divider" style="height:22px;"></div>
          <div class="filter-group">
            <span class="filter-label">Grouper par</span>
            <select class="filter-select" style="min-width:120px;" onchange="Front.setTlGroup(this.value)">
              <option value="category" ${tl.group==='category'?'selected':''}>Catégorie</option>
              <option value="assignee" ${tl.group==='assignee'?'selected':''}>Assigné</option>
              <option value="none"     ${tl.group==='none'    ?'selected':''}>Sans groupe</option>
            </select>
          </div>
        </div>
        <div style="display:flex;gap:6px;align-items:center;">
          <button class="btn btn-secondary" style="font-size:11px;padding:5px 12px;" onclick="Front.scrollTlToday()">⊙ Aujourd'hui</button>
          <button class="btn ${tl.focusMode?'btn-primary':'btn-secondary'}" style="font-size:11px;padding:5px 12px;"
            onclick="Front.toggleTlFocus()" title="Masquer les missions résolues et fermées">
            ${tl.focusMode ? '👁 Actives seulement' : '👁 Tout afficher'}
          </button>
        </div>
      </div>
      <div id="tlBoard"></div>`;

    this._drawTimeline();
  },

  setTlZoom(z)      { this.timeline.zoom=z;      this._drawTimeline(); },
  setTlGroup(g)     { this.timeline.group=g;   this._drawTimeline(); },
  toggleTlFocus()   { this.timeline.focusMode=!this.timeline.focusMode; this.renderTimeline(); },
  scrollTlToday() {
    const wrap = document.getElementById('tlWrap');
    const today = document.querySelector('.tl-today-line');
    if(wrap && today) wrap.scrollLeft = Math.max(0, parseInt(today.style.left) - 300);
  },

  _drawTimeline() {
    const tl = this.timeline;
    const DAY_PX  = tl.zoom==='week' ? 60 : tl.zoom==='month' ? 28 : 12;
    const LABEL_W = 200;
    const bugs    = this.bugs.filter(b => b.date);
    const board   = document.getElementById('tlBoard');

    if (!bugs.length) {
      board.innerHTML = '<div class="empty-state" style="padding:48px"><span class="empty-icon">📅</span><p>Aucune mission avec date.</p></div>';
      return;
    }

    const allDates = bugs.flatMap(b=>[b.date,b.due_date].filter(Boolean)).map(d=>new Date(d));
    let minDate = new Date(Math.min(...allDates));
    let maxDate = new Date(Math.max(...allDates));
    if (tl.zoom==='week')    { minDate.setDate(minDate.getDate()-3); maxDate.setDate(maxDate.getDate()+7); }
    else if (tl.zoom==='month') { minDate.setDate(1); maxDate.setDate(maxDate.getDate()+14); }
    else { minDate.setDate(1); minDate.setMonth(minDate.getMonth()-1); maxDate.setMonth(maxDate.getMonth()+2); }

    const totalDays = Math.ceil((maxDate-minDate)/864e5);
    const totalW    = totalDays * DAY_PX;
    const toX = d  => Math.round((new Date(d)-minDate)/864e5)*DAY_PX;
    const today = new Date(); today.setHours(0,0,0,0);
    const todayX = toX(today);

    const stateColors = {'Nouveau':'#40e0b0','En cours':'#50b8ff','Résolu':'#70d060','Fermé':'#7a7464','Rejeté':'#ff5252','En attente':'#ffd040'};
    const prioColors  = {'Critique':'#ff5252','Haute':'#ff9040','Moyenne':'#ffd040','Basse':'#50b8ff','Mineure':'#c060ff'};

    // Ticks
    const ticks = [], tickLabels = [];
    let cur = new Date(minDate);
    while (cur <= maxDate) {
      ticks.push({ x: toX(cur), weekend: cur.getDay()===0||cur.getDay()===6 });
      if (tl.zoom==='week' || (tl.zoom==='month' && (cur.getDate()===1||cur.getDay()===1)) || (tl.zoom==='quarter' && cur.getDate()===1)) {
        const lbl = tl.zoom==='quarter'
          ? cur.toLocaleDateString('fr-FR',{month:'short',year:'2-digit'})
          : cur.toLocaleDateString('fr-FR',{day:'numeric',month:'short'});
        tickLabels.push({ x: toX(cur), label: lbl });
      }
      cur.setDate(cur.getDate()+1);
    }

    // Groupement
    let groups = [];
    if (tl.group==='category') {
      const cats = [...new Set(bugs.map(b=>b.category))];
      cats.forEach(cat => { const items=bugs.filter(b=>b.category===cat); if(items.length) groups.push({label:cat,items}); });
    } else if (tl.group==='assignee') {
      const ass = [...new Set(bugs.map(b=>b.assignee||'Non assigné'))];
      ass.forEach(a => { const items=bugs.filter(b=>(b.assignee||'Non assigné')===a); if(items.length) groups.push({label:a,items}); });
    } else {
      const po={'Critique':0,'Haute':1,'Moyenne':2,'Basse':3,'Mineure':4};
      bugs.sort((a,b)=>(po[a.priority]??99)-(po[b.priority]??99));
      groups.push({label:null,items:bugs});
    }

    const weekendBg = ticks.filter(t=>t.weekend).map(t=>`<div class="tl-weekend" style="left:${t.x}px;width:${DAY_PX}px;"></div>`).join('');
    const gridLines = ticks.map(t=>`<div class="tl-grid-line" style="left:${t.x}px;"></div>`).join('');
    const todayLine = `<div class="tl-today-line" style="left:${todayX}px;"><div class="tl-today-label">Auj.</div></div>`;
    const headerTicks = tickLabels.map(t=>`<div class="tl-tick-label" style="left:${LABEL_W+t.x}px;">${t.label}</div>`).join('');

    let rowsHtml = '';
    groups.forEach(group => {
      if (group.label !== null) {
        rowsHtml += `<div class="tl-group-header-row">
          <div class="tl-label tl-group-label">
            <span style="font-family:'Rajdhani',sans-serif;font-size:12px;font-weight:700;
              letter-spacing:1px;text-transform:uppercase;color:var(--text-muted);">
              ${this.esc(group.label)}
            </span>
          </div>
          <div style="flex:1;background:var(--bg-raised);border-bottom:1px solid var(--border-base);"></div>
        </div>`;
      }
      group.items.forEach(b => {
        const startX = toX(b.date);
        const endX   = b.due_date ? toX(b.due_date) : startX + DAY_PX*3;
        const barW   = Math.max(endX-startX, DAY_PX*0.8);
        const color  = stateColors[b.state] || '#888';
        const pcolor = prioColors[b.priority] || '#888';
        const member = this.members.find(m=>m.name===b.assignee);
        const avatarSvg = member ? `<span class="tl-bar-avatar" style="background:${member.color};">${this.esc(member.initials)}</span>` : '';
        const isOverdue = b.due_date && new Date(b.due_date)<today && b.state!=='Résolu' && b.state!=='Fermé';
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
              data-tip="${this.esc(tip)}">
              ${avatarSvg}
              <span class="tl-bar-label">${barW>50?this.esc(b.title):this.esc(b.id)}</span>
            </div>
          </div>
        </div>`;
      });
    });

    const noDates = this.bugs.filter(b=>!b.date);

    board.innerHTML = `
      <div class="tl-wrap" id="tlWrap">
        <div style="min-width:${LABEL_W+totalW}px;position:relative;">
          <div class="tl-header" style="padding-left:${LABEL_W}px;height:32px;position:relative;">${headerTicks}</div>
          ${rowsHtml}
        </div>
      </div>
      ${noDates.length?`<div class="tl-no-date"><span style="color:var(--text-muted);font-size:12px;">⚠ ${noDates.length} mission${noDates.length>1?'s':''} sans date : ${noDates.map(b=>b.id).join(', ')}</span></div>`:''}
      <div id="tlTooltip" class="tl-tooltip"></div>`;

    // Tooltip
    const tooltip = document.getElementById('tlTooltip');
    board.querySelectorAll('.tl-bar').forEach(bar => {
      bar.addEventListener('mouseenter', () => { tooltip.textContent=bar.dataset.tip; tooltip.classList.add('visible'); });
      bar.addEventListener('mousemove',  e  => {
        const r=board.getBoundingClientRect();
        tooltip.style.left=(e.clientX-r.left+14)+'px';
        tooltip.style.top =(e.clientY-r.top-10) +'px';
      });
      bar.addEventListener('mouseleave', () => tooltip.classList.remove('visible'));
    });

    // Scroll vers aujourd'hui
    setTimeout(() => {
      const wrap=document.getElementById('tlWrap');
      if(wrap) wrap.scrollLeft=Math.max(0, todayX-300);
    }, 50);
  },


  /* ---- DÉTAIL MISSION ---- */
  openDetail(id) {
    const bug = this.bugs.find(b => b.id === id);
    if (!bug) return;
    const d  = this.esc.bind(this);
    const ts = this.toSlug;
    const member = this.members.find(m => m.name === bug.assignee);
    const avatarHtml = member
      ? `<span class="avatar" style="background:${member.color};width:22px;height:22px;font-size:9px;">${d(member.initials)}</span> ${d(member.name)}`
      : '<span style="color:var(--text-faint)">Non assigné</span>';

    const today = new Date(); today.setHours(0,0,0,0);
    let dueDateHtml = '<span style="color:var(--text-faint)">—</span>';
    if (bug.due_date) {
      const diff = Math.ceil((new Date(bug.due_date) - today) / 864e5);
      const done = bug.state === 'Résolu' || bug.state === 'Fermé';
      const cls  = !done && diff < 0 ? 'color:var(--p-critical)' : !done && diff <= 3 ? 'color:var(--p-medium)' : 'color:var(--text-base)';
      const icon = !done && diff < 0 ? '⚠ ' : !done && diff <= 3 ? '⏰ ' : '';
      dueDateHtml = `<span style="${cls}">${icon}${this.fmtDate(bug.due_date)}</span>`;
    }

    const blocksHtml = bug.blocks?.length
      ? bug.blocks.map(bid => {
          const b2 = this.bugs.find(x => x.id === bid);
          return `<span class="block-tag">${d(bid)}${b2 ? ' — ' + d(b2.title.slice(0,30)) : ''}</span>`;
        }).join('')
      : '<span style="color:var(--text-faint)">Aucune</span>';

    document.getElementById('detailModal').innerHTML = `
      <div class="modal detail-modal">
        <div class="detail-header-band">
          <div class="detail-id-row">
            <span class="bug-id">${d(bug.id)}</span>
            <span class="badge badge-type-${ts(bug.type)}"><span class="badge-dot"></span>${d(bug.type)}</span>
            <span class="badge badge-cat-${ts(bug.category)}"><span class="badge-dot"></span>${d(bug.category)}</span>
          </div>
          <div class="detail-title">${d(bug.title)}</div>
          <div class="detail-badges">
            <span class="badge badge-prio-${ts(bug.priority)}"><span class="badge-dot"></span>${d(bug.priority)}</span>
            <span class="badge badge-state-${ts(bug.state)}"><span class="badge-dot"></span>${d(bug.state)}</span>
          </div>
        </div>
        <div class="detail-body">
          <div>
            <div class="detail-section-label">Description</div>
            <div class="detail-description">${d(bug.description)}</div>
          </div>
          <div class="detail-grid">
            <div class="detail-field">
              <div class="detail-section-label">Assigné à</div>
              <div class="detail-field-value">${avatarHtml}</div>
            </div>
            <div class="detail-field">
              <div class="detail-section-label">Date d'arrivée</div>
              <div class="detail-field-value">${this.fmtDate(bug.date)}</div>
            </div>
            <div class="detail-field">
              <div class="detail-section-label">Échéance</div>
              <div class="detail-field-value">${dueDateHtml}</div>
            </div>
            <div class="detail-field">
              <div class="detail-section-label">Priorité</div>
              <div class="detail-field-value"><span class="badge badge-prio-${ts(bug.priority)}"><span class="badge-dot"></span>${d(bug.priority)}</span></div>
            </div>
          </div>
          <div>
            <div class="detail-section-label">Missions bloquées</div>
            <div class="detail-blocks">${blocksHtml}</div>
          </div>
          ${bug.ref_url ? `<div>
            <div class="detail-section-label">Lien de référence</div>
            <a href="${d(bug.ref_url)}" target="_blank" rel="noopener"
              onclick="event.stopPropagation()"
              style="font-size:13px;color:var(--blue-bright);word-break:break-all;">${d(bug.ref_url)}</a>
          </div>` : ''}
          ${bug.target_version ? `<div>
            <div class="detail-section-label">Version cible</div>
            <span class="version-badge" style="margin-top:4px;display:inline-flex;">${d(bug.target_version)}</span>
          </div>` : ''}
        </div>
        <div class="detail-footer">
          <button class="btn btn-secondary" onclick="Front.closeDetail()">Fermer</button>
          <button class="btn btn-primary" onclick="Front.closeDetail();Front.openComments('${d(bug.id)}')">💬 Commentaires</button>
        </div>
      </div>`;

    document.getElementById('detailOverlay').classList.remove('hidden');
  },

  closeDetail() {
    document.getElementById('detailOverlay').classList.add('hidden');
  },

  exportCSV(){
    const data=this.getSorted(this.getFiltered());
    const headers=['ID','Type','Catégorie','Priorité','Titre','Description','État','Assigné','Date','Échéance'];
    const esc=v=>`"${String(v||'').replace(/"/g,'""')}"`;
    const rows=data.map(b=>[b.id,b.type,b.category,b.priority,b.title,b.description,b.state,b.assignee||'',b.date,b.due_date||''].map(esc).join(','));
    const csv=[headers.join(','),...rows].join('\n');
    const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download=`command-post-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
  },

  toSlug(str){return String(str).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'');},
  fmtDate(d){if(!d)return'—';return new Date(d).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric'});},
  fmtDatetime(d){if(!d)return'—';return new Date(d).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});},
  esc(str){return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
};
document.addEventListener('DOMContentLoaded',()=>Front.init());
