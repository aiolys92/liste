// ============================================
// TIMELINE — module partagé
// Utilisé par Front (index.html) et BO (backoffice.html)
// ctx = objet principal (Front ou BO)
// prefix = 'Front' ou 'BO' pour les onclick
// ============================================
const Timeline = {

  // Initialiser le contexte
  setup(ctx, prefix) {
    this._ctx    = ctx;
    this._prefix = prefix;
  },

async renderTimeline() {
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
              ${this.config.categories.map(c=>`<option value="${this._ctx.esc(c)}" ${tl.filters.category===c?'selected':''}>${this._ctx.esc(c)}</option>`).join('')}
            </select>
          </div>
          <div class="filter-group">
            <span class="filter-label">Assigné</span>
            <select class="filter-select" style="min-width:120px;" onchange="${this._prefix}.setTlFilter('assignee',this.value)">
              <option value="">Tous</option>
              ${this._ctx.members.map(m=>`<option value="${this._ctx.esc(m.name)}" ${tl.filters.assignee===m.name?'selected':''}>${this._ctx.esc(m.name)}</option>`).join('')}
            </select>
          </div>
          <div class="filter-group">
            <span class="filter-label">État</span>
            <select class="filter-select" style="min-width:120px;" onchange="${this._prefix}.setTlFilter('state',this.value)">
              <option value="">Tous</option>
              ${this.config.states.map(s=>`<option value="${this._ctx.esc(s)}" ${tl.filters.state===s?'selected':''}>${this._ctx.esc(s)}</option>`).join('')}
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
    let bugs = this._ctx.bugs.filter(b => b.date);
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
        rowsHtml += `<div class="tl-group-header"><span>${this._ctx.esc(group.label)}</span></div>`;
      }
      group.items.forEach(b => {
        const startX = toX(b.start_date || b.date);
        const endX   = b.due_date ? toX(b.due_date) : startX + DAY_PX*3;
        const barW   = Math.max(endX - startX, DAY_PX*0.8);
        const color  = stateColors[b.state] || '#888';
        const pcolor = prioColors[b.priority] || '#888';
        const member = this._ctx.members.find(m=>m.name===b.assignee);
        const avatarSvg = member
          ? `<span class="tl-bar-avatar" style="background:${member.color};">${this._ctx.esc(member.initials)}</span>`
          : '';
        const isOverdue = b.due_date && new Date(b.due_date)<today && b.state!=='Résolu' && b.state!=='Fermé';
        const ts = this._ctx.toSlug;
        // Tooltip data
        const tip = `${b.id} | ${b.priority} | ${b.state}${b.assignee?' | '+b.assignee:''}${b.due_date?' | Échéance: '+this._ctx.fmtDate(b.due_date):''}`;

        rowsHtml += `<div class="tl-row">
          <div class="tl-label" title="${this._ctx.esc(b.title)}">
            <span class="tl-label-prio" style="background:${pcolor}22;color:${pcolor};border-color:${pcolor}44;">${b.priority.slice(0,3)}</span>
            <span class="tl-label-text">${this._ctx.esc(b.title)}</span>
          </div>
          <div class="tl-track" style="width:${totalW}px;">
            ${weekendBg}${gridLines}${todayLine}
            <div class="tl-bar ${isOverdue?'tl-bar-overdue':''}"
              style="left:${startX}px;width:${barW}px;background:${color}30;border:1.5px solid ${color};border-left:3px solid ${pcolor};"
              onclick="${this._prefix}.openActionModal('${this._ctx.esc(b.id)}')"
              data-tip="${this._ctx.esc(tip)}">
              ${avatarSvg}
              <span class="tl-bar-label">${barW > 50 ? this._ctx.esc(b.title) : this._ctx.esc(b.id)}</span>
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

  // ============================================================
  // CONFIG TAB
  // ============================================================
  renderConfigTab() {
    this.renderConfigSection('types',      'Types de missions', 'Ajouter un type…');
    this.renderClientsSection();
    this.renderConfigSection('categories', 'Catégories',        'Ajouter une catégorie…');
    this.renderMembersSection();
  },

  renderClientsSection() {
    const container = document.getElementById('config-clients');
    if (!container) return;
    const COLORS = ['#50b8ff','#40e0b0','#ff9040','#c060ff','#70d060','#ff5252','#ffd040','#c8a030','#e090d0','#90b0e8'];
    container.innerHTML = `
      <div class="config-section">
        <div class="config-section-header">
          <span class="config-section-title">Clients</span>
          <span class="config-section-count">${this.clients.length} client${this.clients.length>1?'s':''}</span>
        </div>
        <div class="config-items">
          ${this.clients.map(c => `
            <div class="client-card">
              <span class="client-badge-dot" style="background:${c.color};width:10px;height:10px;border-radius:50%;flex-shrink:0;"></span>
              <div style="flex:1;min-width:0;">
                <div class="client-name">${this._ctx.esc(c.name)}</div>
                ${c.contact ? `<div class="client-contact">${this._ctx.esc(c.contact)}</div>` : ''}
              </div>
              <button class="config-item-delete" onclick="BO.deleteClientItem(${c.id})">×</button>
            </div>`).join('') || '<div style="padding:12px;color:var(--text-faint);font-size:12px;">Aucun client.</div>'}
        </div>
        <div class="config-add-row" style="flex-direction:column;align-items:stretch;gap:8px;">
          <input type="text" class="form-input" id="newClientName" placeholder="Nom du client…" maxlength="60">
          <input type="text" class="form-input" id="newClientContact" placeholder="Contact (optionnel)…" maxlength="80">
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
            <div style="display:flex;gap:6px;flex-wrap:wrap;flex:1;">
              ${COLORS.map((c,i) => `
                <label style="cursor:pointer;position:relative;" title="${c}">
                  <input type="radio" name="clientColor" value="${c}"
                    ${i===0?'checked':''} style="position:absolute;opacity:0;width:0;height:0;">
                  <span onclick="document.querySelectorAll('[name=clientColor]').forEach(r=>r.closest('label').querySelector('span').style.outline='none');this.style.outline='2px solid var(--gold-mid)';this.style.outlineOffset='2px';document.querySelector('[name=clientColor][value=\'${c}\']').checked=true;"
                    style="display:block;width:22px;height:22px;border-radius:50%;background:${c};
                    outline:${i===0?'2px solid var(--gold-mid)':'none'};outline-offset:2px;
                    transition:transform 0.15s,outline 0.15s;"
                    onmouseover="this.style.transform='scale(1.15)'"
                    onmouseout="this.style.transform=''">
                  </span>
                </label>`).join('')}
            </div>
            <button class="btn btn-primary" onclick="BO.addClientItem()">+ Ajouter</button>
          </div>
        </div>
      </div>`;
  },

  async addClientItem() {
    const name    = document.getElementById('newClientName').value.trim();
    const contact = document.getElementById('newClientContact').value.trim();
    const colorRadio = document.querySelector('[name=clientColor]:checked');
    const color = colorRadio ? colorRadio.value : '#50b8ff';
    if (!name) { this.showNotif('Remplissez le nom du client.', true); return; }
    try {
      const created = await DB.insertClient({ name, contact: contact||null, color });
      this.clients.push(Array.isArray(created) ? created[0] : { name, contact, color, id: Date.now() });
      this.renderClientsSection();
      this.populateFilters();
      this.showNotif(`✓ Client ${name} ajouté`);
    } catch(e) { this.showNotif('Erreur : ' + e.message, true); }
  },

  async deleteClientItem(id) {
    if (!confirm('Supprimer ce client ? Les missions liées ne seront pas supprimées.')) return;
    try {
      await DB.deleteClient(id);
      this.clients = this.clients.filter(c => c.id !== id);
      this.renderClientsSection();
      this.populateFilters();
      this.showNotif('✓ Client supprimé');
    } catch(e) { this.showNotif('Erreur : ' + e.message, true); }
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
              <input type="text" class="config-item-input" value="${this._ctx.esc(item)}"
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
      // Invalider le cache pour forcer le rechargement au prochain accès
      if(typeof Cache!=='undefined') Cache.invalidate(Cache.keys.config);
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
          <span class="config-section-count">${this._ctx.members.length} membre${this._ctx.members.length>1?'s':''}</span>
        </div>
        <div class="config-items">
          ${this._ctx.members.map(m=>`
            <div class="config-item">
              <span class="avatar" style="background:${m.color};flex-shrink:0;">${this._ctx.esc(m.initials)}</span>
              <span style="flex:1;font-size:13px;color:var(--text-bright);">${this._ctx.esc(m.name)}</span>
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
      this._ctx.members.push(Array.isArray(created)?created[0]:{name,initials,color,id:Date.now()});
      this.renderMembersSection();
      this.showNotif(`✓ Membre ${name} ajouté`);
    }catch(e){this.showNotif('Erreur : '+e.message,true);}
  },

  async deleteMember(id){
    if(!confirm('Supprimer ce membre ?'))return;
    try{
      await DB.deleteMember(id);
      this._ctx.members=this._ctx.members.filter(m=>m.id!==id);
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
    const bug = this._ctx.bugs.find(b => b.id === id);
    if (!bug) return;
    const d  = this._ctx.esc.bind(this);
    const ts = this._ctx.toSlug;
    const member = this._ctx.members.find(m => m.name === bug.assignee);
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
    const bug = this._ctx.bugs.find(b => b.id === id);
    if (!bug) return;
    const d  = this._ctx.esc.bind(this);
    const ts = this._ctx.toSlug;
    const member = this._ctx.members.find(m => m.name === bug.assignee);
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
      dueDateHtml = '<span style="' + cls + '">' + icon + this._ctx.fmtDate(bug.due_date) + '</span>';
    }

    const blocksHtml = bug.blocks && bug.blocks.length
      ? bug.blocks.map(bid => {
          const b2 = this._ctx.bugs.find(x => x.id === bid);
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
            '<div class="detail-field"><div class="detail-section-label">Date de début</div><div class="detail-field-value">' + (bug.start_date ? this._ctx.fmtDate(bug.start_date) : '<span style="color:var(--text-faint)">—</span>') + '</div></div>' +
          '<div class="detail-field"><div class="detail-section-label">Date de création</div><div class="detail-field-value">' + this._ctx.fmtDate(bug.date) + '</div></div>' +
            '<div class="detail-field"><div class="detail-section-label">Échéance</div><div class="detail-field-value">' + dueDateHtml + '</div></div>' +
            '<div class="detail-field"><div class="detail-section-label">Priorité</div><div class="detail-field-value"><span class="badge badge-prio-' + ts(bug.priority) + '"><span class="badge-dot"></span>' + d(bug.priority) + '</span></div></div>' +
          '</div>' +
          '<div><div class="detail-section-label">Missions bloquées</div><div class="detail-blocks">' + blocksHtml + '</div></div>' +
          (bug.ref_url ? '<div style="margin-top:12px;"><div class="detail-section-label">Lien de référence</div><a href="' + d(bug.ref_url) + '" target="_blank" rel="noopener" style="font-size:13px;color:var(--blue-bright);word-break:break-all;">' + d(bug.ref_url) + '</a></div>' : '') +
          (bug.target_version ? '<div style="margin-top:12px;"><div class="detail-section-label">Version cible</div><span class="version-badge" style="margin-top:4px;display:inline-flex;">' + d(bug.target_version) + '</span></div>' : '') +
        '</div>' +
        '<div class="detail-footer">' +
          '<button class="btn btn-secondary" onclick="BO.closeDetail()">Fermer</button>' +
          '<button class="btn btn-secondary" onclick="BO.closeDetail();BO.openComments(\'' + d(bug.id) + '\')">💬 Commentaires</button>' +
          '<button class="btn btn-secondary" onclick="BO.closeDetail();BO.openHistory(\'' + d(bug.id) + '\')">📋 Historique</button>' +
          '<button class="btn btn-primary" onclick="BO.closeDetail();${this._prefix}.openActionModal(\'' + d(bug.id) + '\')">⚡ Actions</button>' +
        '</div>' +
      '</div>';

    document.getElementById('detailOverlay').classList.remove('hidden');
  },

  closeDetail() {
    document.getElementById('detailOverlay').classList.add('hidden');
  },

  _populateClientSelect(currentId) {
    const el = document.getElementById('fClient');
    if (!el) return;
    el.innerHTML = '<option value="">— Aucun client —</option>';
    this.clients.forEach(c => {
      const o = document.createElement('option');
      o.value = c.id; o.textContent = c.name;
      if (currentId && c.id == currentId) o.selected = true;
      el.appendChild(o);
    });
  },

  _clientBadge(clientId) {
    if (!clientId) return '<span style="color:var(--text-faint);font-size:11px;">—</span>';
    const c = this.clients.find(x => x.id == clientId);
    if (!c) return '<span style="color:var(--text-faint);font-size:11px;">—</span>';
    const bg  = c.color + '20';
    const brd = c.color + '50';
    return `<span class="client-badge" style="background:${bg};border-color:${brd};color:${c.color};">
      <span class="client-badge-dot" style="background:${c.color};"></span>${this._ctx.esc(c.name)}
    </span>`;
  },

  updateCounter(id, max) {
    const el  = document.getElementById(id);
    const cnt = document.getElementById('counter-' + id);
    if (!el || !cnt) return;
    const remaining = max - el.value.length;
    cnt.textContent  = remaining;
    cnt.className    = 'char-counter' + (remaining < 20 ? ' danger' : remaining < 50 ? ' warn' : '');
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
    const d  = this._ctx.esc.bind(this);
    const ts = this._ctx.toSlug;

    // Stats globales en haut
    const pending  = this.requests.filter(r => r.status === 'pending').length;
    const accepted = this.requests.filter(r => r.status === 'accepted').length;
    const rejected = this.requests.filter(r => r.status === 'rejected').length;

    const statsBar = `<div class="req-stats-bar">
      <div class="req-stat">
        <span class="req-stat-num" style="color:#ffd040;">${pending}</span>
        <span>en attente</span>
      </div>
      <div style="width:1px;background:var(--border-dim);"></div>
      <div class="req-stat">
        <span class="req-stat-num" style="color:#70d060;">${accepted}</span>
        <span>acceptées</span>
      </div>
      <div style="width:1px;background:var(--border-dim);"></div>
      <div class="req-stat">
        <span class="req-stat-num" style="color:var(--text-faint);">${rejected}</span>
        <span>refusées</span>
      </div>
    </div>`;

    const filtered = this.requests.filter(r => r.status === this.currentReqTab);

    if (!filtered.length) {
      const msgs = { pending:'Aucune demande en attente.', accepted:'Aucune demande acceptée.', rejected:'Aucune demande refusée.' };
      el.innerHTML = statsBar + '<div class="empty-state"><span class="empty-icon">📥</span><p>' + msgs[this.currentReqTab] + '</p></div>';
      return;
    }

    const items = filtered.map(r => {
      const isPending = r.status === 'pending';
      const accentColor = isPending ? '#ffd040' : r.status === 'accepted' ? '#70d060' : '#555';
      const initials = (r.author_name||'?').split(' ').map(w=>w[0]||'').join('').slice(0,2).toUpperCase();

      const actions = isPending
        ? '<div class="req-item-actions">' +
            '<button class="btn btn-primary" style="font-size:12px;padding:6px 14px;" onclick="BO.openAcceptModal(' + r.id + ')">✅ Accepter</button>' +
            '<button class="btn btn-secondary" style="font-size:12px;padding:6px 14px;color:var(--text-muted);" onclick="BO.rejectRequest(' + r.id + ')">✕ Refuser</button>' +
          '</div>'
        : r.status === 'accepted'
          ? '<span class="req-accepted-label">✓ Acceptée</span>'
          : '<span class="req-rejected-label">✕ Refusée</span>';

      return '<div class="req-item">' +

        '<div class="req-item-head">' +
          '<div class="req-item-accent" style="background:' + accentColor + ';"></div>' +
          '<div class="req-item-body">' +
            '<div class="req-item-title">' + d(r.title) + '</div>' +
            '<div class="req-item-tags">' +
              '<span class="badge badge-type-' + ts(r.type)     + '" style="font-size:10px;">' + d(r.type)     + '</span>' +
              '<span class="badge badge-cat-'  + ts(r.category) + '" style="font-size:10px;">' + d(r.category) + '</span>' +
              (r.client_id ? this._clientBadge(r.client_id) : '') +
            '</div>' +
          '</div>' +
          actions +
        '</div>' +

        '<div class="req-item-desc">' + d(r.description) + '</div>' +

        '<div class="req-item-footer">' +
          '<div class="req-item-author">' +
            '<div class="req-item-initials">' + initials + '</div>' +
            '<strong style="color:var(--text-base);">' + d(r.author_name) + '</strong>' +
            '<span>·</span>' +
            '<span>' + d(r.author_email) + '</span>' +
          '</div>' +
          '<span style="font-size:10px;color:var(--text-faint);font-family:monospace;">' + this._ctx.fmtDatetime(r.created_at) + '</span>' +
        '</div>' +

      '</div>';
    }).join('');

    el.innerHTML = statsBar + '<div class="req-list">' + items + '</div>';
  },
};
