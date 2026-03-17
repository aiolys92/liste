const Timeline = {

  setup(ctx, prefix) {
    this._ctx    = ctx;
    this._prefix = prefix;
  },

  async render() {
    const container = document.getElementById('panelTimeline');
    // Charger toutes les missions pour la timeline (pas seulement la page courante)
    if (!this._ctx._tlBugsLoaded) {
      container.innerHTML = '<div class="empty-state" style="padding:48px"><span class="empty-icon">📅</span><p>Chargement…</p></div>';
      try {
        const result = await DB.fetchBugs();
        this._ctx._tlBugs = result;
        this._ctx._tlBugsLoaded = true;
      } catch(e) {
        container.innerHTML = '<div class="empty-state" style="padding:48px"><span class="empty-icon">⚠</span><p>Erreur de chargement.</p></div>';
        return;
      }
    }
    const tl = this._ctx.timeline;

    // Toolbar
    container.innerHTML = `
      <div class="tl-toolbar">
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
          <div class="tl-zoom-group">
            <button class="tl-zoom-btn ${tl.zoom==='week'?'active':''}"    onclick="${this._prefix}.setTlZoom('week')">Semaine</button>
            <button class="tl-zoom-btn ${tl.zoom==='month'?'active':''}"   onclick="${this._prefix}.setTlZoom('month')">Mois</button>
            <button class="tl-zoom-btn ${tl.zoom==='quarter'?'active':''}" onclick="${this._prefix}.setTlZoom('quarter')">Trimestre</button>
          </div>
          <div class="filter-divider" style="height:22px;"></div>
          <div class="filter-group">
            <span class="filter-label">Grouper</span>
            <select class="filter-select" style="min-width:120px;" onchange="${this._prefix}.setTlGroup(this.value)">
              <option value="category"  ${tl.group==='category' ?'selected':''}>Catégorie</option>
              <option value="assignee"  ${tl.group==='assignee' ?'selected':''}>Assigné</option>
              <option value="none"      ${tl.group==='none'     ?'selected':''}>Sans groupe</option>
            </select>
          </div>
          <div class="filter-divider" style="height:22px;"></div>
          <div class="filter-group">
            <span class="filter-label">Catégorie</span>
            <select class="filter-select" style="min-width:120px;" onchange="${this._prefix}.setTlFilter('category',this.value)">
              <option value="">Toutes</option>
              ${this._ctx.config.categories.map(c=>`<option value="${esc(c)}" ${tl.filters.category===c?'selected':''}>${esc(c)}</option>`).join('')}
            </select>
          </div>
          <div class="filter-group">
            <span class="filter-label">Assigné</span>
            <select class="filter-select" style="min-width:120px;" onchange="${this._prefix}.setTlFilter('assignee',this.value)">
              <option value="">Tous</option>
              ${this._ctx.members.map(m=>`<option value="${esc(m.name)}" ${tl.filters.assignee===m.name?'selected':''}>${esc(m.name)}</option>`).join('')}
            </select>
          </div>
          <div class="filter-group">
            <span class="filter-label">État</span>
            <select class="filter-select" style="min-width:120px;" onchange="${this._prefix}.setTlFilter('state',this.value)">
              <option value="">Tous</option>
              ${this._ctx.config.states.map(s=>`<option value="${esc(s)}" ${tl.filters.state===s?'selected':''}>${esc(s)}</option>`).join('')}
            </select>
          </div>
        </div>
        <div style="display:flex;gap:6px;align-items:center;">
          <button class="btn btn-secondary" style="font-size:11px;padding:5px 12px;" onclick="${this._prefix}.scrollTlToday()">⊙ Aujourd'hui</button>
          <button class="btn ${tl.focusMode?'btn-primary':'btn-secondary'}" style="font-size:11px;padding:5px 12px;"
            onclick="${this._prefix}.toggleTlFocus()" title="Masquer les missions résolues et fermées">
            ${tl.focusMode ? '👁 Actives seulement' : '👁 Tout afficher'}
          </button>
        </div>
      </div>
      <div id="tlBoard"></div>`;

    this._draw();
  },

  setTlZoom(z)           { this._ctx.timeline.zoom=z;                        this._draw(); },
  setTlGroup(g)          { this._ctx.timeline.group=g;                       this._draw(); },
  setTlFilter(key,val)   { this._ctx.timeline.filters[key]=val;              this._draw(); },
  scrollTlToday()        { document.getElementById('tlBoard')?.querySelector('.tl-today-line')?.scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'}); },

  _draw() {
    const tl = this._ctx.timeline;
    const DAY_PX = tl.zoom==='week' ? 60 : tl.zoom==='month' ? 28 : 12;
    const LABEL_W = 200;

    // Filtrer
    let bugs = (this._ctx._tlBugs || this._ctx.bugs).filter(b => b.date);
    if (tl.filters.category) bugs = bugs.filter(b => b.category === tl.filters.category);
    if (tl.filters.assignee) bugs = bugs.filter(b => b.assignee === tl.filters.assignee);
    if (tl.filters.state)    bugs = bugs.filter(b => b.state    === tl.filters.state);

    const board = document.getElementById('tlBoard');
    if (!bugs.length) { board.innerHTML='<div class="empty-state" style="padding:48px"><span class="empty-icon">📅</span><p>Aucune mission ne correspond aux filtres.</p></div>'; return; }

    // Plage de dates
    const allDates = bugs.flatMap(b=>[b.start_date||b.date, b.due_date].filter(Boolean)).map(d=>new Date(d));
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
        const gcfg = this._ctx.config;
        const isCategory = tl.group === 'category';
        const isBadge    = isCategory && gcfg?.categories?.includes(group.label);
        const labelHtml  = isBadge
          ? `<span class="badge badge-cat-${toSlug(group.label)} tl-group-badge">${esc(group.label)}</span>`
          : `<span class="tl-group-text">${esc(group.label)}</span>`;
        rowsHtml += `<div class="tl-group-row">
          <div class="tl-group-label">${labelHtml}</div>
          <div class="tl-group-track" style="width:${totalW}px;">${weekendBg}${gridLines}</div>
        </div>`;
      }
      group.items.forEach(b => {
        const startX = toX(b.start_date || b.date);
        const endX   = b.due_date ? toX(b.due_date) : startX + DAY_PX*3;
        const barW   = Math.max(endX - startX, DAY_PX*0.8);
        const color  = stateColors[b.state] || '#888';
        const pcolor = prioColors[b.priority] || '#888';
        const member = this._ctx.members.find(m=>m.name===b.assignee);
        const avatarSvg = member
          ? `<span class="tl-bar-avatar" style="background:${member.color};">${esc(member.initials)}</span>`
          : '';
        const isOverdue = b.due_date && new Date(b.due_date)<today && b.state!=='Résolu' && b.state!=='Fermé';
        const ts = toSlug;
        // Tooltip data
        const tip = `${b.id} | ${b.priority} | ${b.state}${b.assignee?' | '+b.assignee:''}${b.due_date?' | Échéance: '+fmtDate(b.due_date):''}`;

        rowsHtml += `<div class="tl-row">
          <div class="tl-label" title="${esc(b.title)}">
            <span class="tl-label-prio" style="background:${pcolor}22;color:${pcolor};border-color:${pcolor}44;">${b.priority.slice(0,3)}</span>
            <span class="tl-label-text">${esc(b.title)}</span>
          </div>
          <div class="tl-track" style="width:${totalW}px;">
            ${weekendBg}${gridLines}${todayLine}
            <div class="tl-bar ${isOverdue?'tl-bar-overdue':''}"
              style="left:${startX}px;width:${barW}px;background:${color}30;border:1.5px solid ${color};border-left:3px solid ${pcolor};"
              onclick="${this._prefix}.openActionModal('${esc(b.id)}')"
              data-tip="${esc(tip)}">
              ${avatarSvg}
              <span class="tl-bar-label">${barW > 50 ? esc(b.title) : esc(b.id)}</span>
            </div>
          </div>
        </div>`;
      });
    });

    // No-date list
    const noDates = (this._ctx._tlBugs || this._ctx.bugs).filter(b=>!b.date);

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

};
