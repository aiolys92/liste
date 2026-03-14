// ============================================
// FRONT — Mission Board public
// Liste + Kanban + Commentaires + Export CSV + Dark/Light
// ============================================
const Front = {
  bugs: [],
  members: [],
  config: { types:[], categories:[], priorities:['Critique','Haute','Moyenne','Basse','Mineure'], states:['Nouveau','En cours','Résolu','Fermé','Rejeté','En attente'] },
  view: 'list',
  currentPage: 1,
  itemsPerPage: 10,
  sortField: 'date',
  sortDir: 'desc',
  filters: { type:'', priority:'', state:'', search:'' },

  async init() {
    this.loadTheme();
    this.showLoading(true);
    try {
      const [bugs, cfg, members] = await Promise.all([DB.fetchBugs(), DB.fetchConfig(), DB.fetchMembers()]);
      this.bugs    = bugs;
      this.members = members;
      if (cfg.types)      this.config.types      = cfg.types;
      if (cfg.categories) this.config.categories = cfg.categories;
    } catch(e) { this.showError('Impossible de charger les données.'); }
    this.showLoading(false);
    this.populateFilters();
    this.bindEvents();
    this.renderStats();
    this.render();
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

  showLoading(on){const el=document.getElementById('loadingRow');if(el)el.style.display=on?'':'none';},
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
  },

  bindEvents() {
    ['filterType','filterPriority','filterState'].forEach(id=>{
      document.getElementById(id)?.addEventListener('change',e=>{
        const map={filterType:'type',filterPriority:'priority',filterState:'state'};
        this.filters[map[id]]=e.target.value;this.currentPage=1;this.render();
      });
    });
    document.getElementById('searchInput')?.addEventListener('input',e=>{
      this.filters.search=e.target.value.toLowerCase();this.currentPage=1;this.render();
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
    document.getElementById('btnExportCSV')?.addEventListener('click',()=>this.exportCSV());
    document.getElementById('themeToggle')?.addEventListener('click',()=>this.toggleTheme());
    document.getElementById('commentsModal')?.addEventListener('click',e=>{if(e.target===document.getElementById('commentsModal'))this.closeComments();});
  },


  timeline: {
    zoom: 'month',
    group: 'category'
  },

  switchView(v) {
    this.view=v;
    ['list','kanban','timeline'].forEach(name => {
      const btn = document.getElementById('btnView'+name.charAt(0).toUpperCase()+name.slice(1));
      const panel = document.getElementById('panel'+name.charAt(0).toUpperCase()+name.slice(1));
      if(btn)   btn.classList.toggle('view-btn-active', v===name);
      if(panel) panel.style.display = v===name ? '' : 'none';
    });
    // Masquer les filtres en timeline (la timeline a ses propres contrôles)
    const fb = document.getElementById('filtersBar');
    if(fb) fb.style.display = v==='timeline' ? 'none' : '';
    if(v==='kanban')   this.renderKanban();
    if(v==='timeline') this.renderTimeline();
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

  render(){if(this.view==='list')this.renderList();else this.renderKanban();},

  renderList() {
    const filtered=this.getSorted(this.getFiltered());
    const total=filtered.length;
    const totalPages=Math.max(1,Math.ceil(total/this.itemsPerPage));
    this.currentPage=Math.min(this.currentPage,totalPages);
    const page=filtered.slice((this.currentPage-1)*this.itemsPerPage,(this.currentPage)*this.itemsPerPage);
    document.getElementById('filterCount').textContent=`${total} résultat${total>1?'s':''}`;
    document.querySelectorAll('[data-sort]').forEach(th=>{
      th.classList.toggle('sorted',th.dataset.sort===this.sortField);
      const a=th.querySelector('.sort-arrow');if(a)a.textContent=th.dataset.sort===this.sortField?(this.sortDir==='asc'?'↑':'↓'):'↕';
    });
    const tbody=document.getElementById('bugsTableBody');
    tbody.innerHTML=page.length===0
      ?`<tr><td colspan="9"><div class="empty-state"><span class="empty-icon">⊘</span><p>Aucune mission.</p></div></td></tr>`
      :page.map(b=>this.renderRow(b)).join('');
    this.renderPagination(total,totalPages);
  },

  renderRow(b) {
    const ts=this.toSlug,d=this.esc.bind(this);
    const member=this.members.find(m=>m.name===b.assignee);
    const avatarHtml=member
      ?`<span class="avatar" style="background:${member.color}" title="${d(member.name)}">${d(member.initials)}</span>`
      :`<span class="avatar avatar-unassigned" title="Non assigné">·</span>`;
    const dueDateHtml=this.renderDueDate(b.due_date,b.state);
    const blocksHtml=b.blocks?.length?`<span class="block-tag" style="font-size:10px;padding:1px 5px;margin-left:4px;">🔗${b.blocks.length}</span>`:'';
    return `<tr>
      <td class="col-type"><span class="badge badge-type-${ts(b.type)}"><span class="badge-dot"></span>${d(b.type)}</span></td>
      <td class="col-category"><span class="badge badge-cat-${ts(b.category)}"><span class="badge-dot"></span>${d(b.category)}</span></td>
      <td class="col-id"><span class="bug-id">${d(b.id)}</span>${blocksHtml}</td>
      <td class="col-priority"><span class="badge badge-prio-${ts(b.priority)}"><span class="badge-dot"></span>${d(b.priority)}</span></td>
      <td class="col-description"><div class="bug-desc"><div class="bug-desc-title">${d(b.title)}</div><div class="bug-desc-detail">${d(b.description)}</div></div></td>
      <td class="col-state"><span class="badge badge-state-${ts(b.state)}"><span class="badge-dot"></span>${d(b.state)}</span></td>
      <td class="col-assignee">${avatarHtml}</td>
      <td class="col-due">${dueDateHtml}</td>
      <td class="col-date"><div class="date-main">${this.fmtDate(b.date)}</div></td>
      <td class="col-comments"><button class="comments-btn" onclick="Front.openComments('${d(b.id)}')" title="Commentaires">💬</button></td>
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
    const s=(this.currentPage-1)*this.itemsPerPage+1,e=Math.min(this.currentPage*this.itemsPerPage,total);
    let btns=`<button class="page-btn" onclick="Front.goPage(${this.currentPage-1})" ${this.currentPage===1?'disabled':''}>‹</button>`;
    for(let i=1;i<=totalPages;i++){
      if(totalPages>7&&Math.abs(i-this.currentPage)>2&&i!==1&&i!==totalPages){if(i===2||i===totalPages-1)btns+=`<span class="page-btn" style="cursor:default;border:none;opacity:.4">…</span>`;continue;}
      btns+=`<button class="page-btn ${i===this.currentPage?'active':''}" onclick="Front.goPage(${i})">${i}</button>`;
    }
    btns+=`<button class="page-btn" onclick="Front.goPage(${this.currentPage+1})" ${this.currentPage===totalPages?'disabled':''}>›</button>`;
    el.innerHTML=`<span class="pagination-info">Affichage ${total===0?0:s}–${e} sur ${total}</span><div class="pagination-controls">${btns}</div>`;
  },

  goPage(p){const t=Math.max(1,Math.ceil(this.getFiltered().length/this.itemsPerPage));if(p<1||p>t)return;this.currentPage=p;this.renderList();window.scrollTo({top:0,behavior:'smooth'});},

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
    const ts=this.toSlug,d=this.esc.bind(this);
    const member=this.members.find(m=>m.name===b.assignee);
    const avatarHtml=member?`<span class="avatar" style="background:${member.color};width:20px;height:20px;font-size:9px;" title="${d(member.name)}">${d(member.initials)}</span>`:'';
    const dueHtml=this.renderDueDate(b.due_date,b.state);
    return `<div class="kanban-card kanban-card-prio-${ts(b.priority)}">
      <div class="kanban-card-top">
        <span class="kanban-card-id">${d(b.id)}</span>
        <span class="badge badge-prio-${ts(b.priority)} kanban-card-prio-badge"><span class="badge-dot"></span>${d(b.priority)}</span>
      </div>
      <div class="kanban-card-title">${d(b.title)}</div>
      <div class="kanban-card-desc">${d(b.description)}</div>
      <div class="kanban-card-footer">
        <span class="badge badge-state-${ts(b.state)} kanban-card-state"><span class="badge-dot"></span>${d(b.state)}</span>
        <div style="display:flex;align-items:center;gap:5px;">
          ${avatarHtml}
          ${dueHtml}
          <button class="comments-btn" onclick="Front.openComments('${d(b.id)}')" style="font-size:11px;padding:2px 5px;">💬</button>
        </div>
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
        <button class="btn btn-secondary" style="font-size:11px;padding:5px 12px;" onclick="Front.scrollTlToday()">⊙ Aujourd'hui</button>
      </div>
      <div id="tlBoard"></div>`;

    this._drawTimeline();
  },

  setTlZoom(z)  { this.timeline.zoom=z;  this._drawTimeline(); },
  setTlGroup(g) { this.timeline.group=g; this._drawTimeline(); },
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
      if (group.label !== null) rowsHtml += `<div class="tl-group-header"><span>${this.esc(group.label)}</span></div>`;
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
