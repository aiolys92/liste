// ============================================
// DASHBOARD — Refonte complète
// ============================================

const Dashboard = {
  bugs: [],

  async init(isAdmin = false) {
    this.loadTheme();
    document.getElementById('themeToggle')?.addEventListener('click', () => this.toggleTheme());
    try {
      this.bugs = await DB.fetchStats();
    } catch(e) {
      document.getElementById('dashContent').innerHTML =
        '<div style="text-align:center;padding:80px;color:var(--p-critical);font-size:13px;">Erreur de chargement.</div>';
      return;
    }
    this.render();
  },

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

  render() {
    const b = this.bugs;
    const total    = b.length;
    const today    = new Date(); today.setHours(0,0,0,0);
    const weekAgo  = new Date(today); weekAgo.setDate(weekAgo.getDate()-7);
    const inProgress = b.filter(x => x.state === 'En cours').length;
    const critical   = b.filter(x => x.priority === 'Critique').length;
    const resolved   = b.filter(x => x.state === 'Résolu' || x.state === 'Fermé').length;
    const overdue    = b.filter(x => x.due_date && new Date(x.due_date) < today && x.state !== 'Résolu' && x.state !== 'Fermé').length;
    const thisWeek   = b.filter(x => x.created_at && new Date(x.created_at) >= weekAgo).length;
    const rate       = total ? Math.round((resolved/total)*100) : 0;

    const stateColors = { 'Nouveau':'#40e0b0','En cours':'#50b8ff','Résolu':'#70d060','Fermé':'#7a7464','Rejeté':'#ff5252','En attente':'#ffd040' };
    const prioColors  = { 'Critique':'#ff5252','Haute':'#ff9040','Moyenne':'#ffd040','Basse':'#50b8ff','Mineure':'#c060ff' };
    const stateCounts = {}; b.forEach(x => { stateCounts[x.state]     = (stateCounts[x.state]||0)+1; });
    const prioCounts  = {}; b.forEach(x => { prioCounts[x.priority]   = (prioCounts[x.priority]||0)+1; });
    const catCounts   = {}; b.forEach(x => { catCounts[x.category]    = (catCounts[x.category]||0)+1; });

    window._dashBugs = this.bugs;
    document.getElementById('dashContent').innerHTML = `

      <!-- ROW 1 : KPIs -->
      <div class="db-kpi-grid">
        ${this._kpi(total,         'Total',          '',           'Missions actives en ce moment')}
        ${this._kpi(inProgress,    'En cours',       '#50b8ff',    'Actuellement en traitement')}
        ${this._kpi(critical,      'Critiques',      '#ff5252',    'Priorité maximale')}
        ${this._kpi(overdue,       'En retard',      overdue?'#ff5252':'#7a7464', 'Échéance dépassée')}
        ${this._kpi(thisWeek,      'Cette semaine',  '#40e0b0',    'Créées ces 7 derniers jours')}
        ${this._kpi(rate + '%',    'Taux résolu',    '#70d060',    'Résolues + fermées / total')}
      </div>

      <!-- ROW 2 : Donut + Barres priorité + Jauge résolution -->
      <div class="db-row-2">

        <div class="db-card db-card-donut">
          <div class="db-card-label">Répartition par état</div>
          ${this._donut(stateCounts, stateColors, total)}
        </div>

        <div class="db-card db-card-prio">
          <div class="db-card-label">Priorités</div>
          ${this._barsPrio(prioCounts, prioColors)}
        </div>

        <div class="db-card db-card-gauge">
          <div class="db-card-label">Progression globale</div>
          ${this._gauge(rate, resolved, total)}
        </div>

      </div>

      <!-- ROW 3 : Catégories (horizontal) + Timeline -->
      <div class="db-row-3">

        <div class="db-card db-card-cat">
          <div class="db-card-label">Par catégorie</div>
          ${this._catBubbles(catCounts)}
        </div>

        <div class="db-card db-card-timeline">
          <div class="db-card-label" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
            <span>Historique d'activité</span>
            <div style="display:flex;gap:4px;">
              <button id="tlBtnWeek"  onclick="Dashboard.setTimelineMode('week')"
                style="font-size:11px;padding:3px 10px;border-radius:4px;cursor:pointer;font-family:'DM Sans',sans-serif;font-weight:600;border:1px solid var(--gold-dim);background:var(--gold-ghost);color:var(--gold-bright);">
                Semaines
              </button>
              <button id="tlBtnMonth" onclick="Dashboard.setTimelineMode('month')"
                style="font-size:11px;padding:3px 10px;border-radius:4px;cursor:pointer;font-family:'DM Sans',sans-serif;font-weight:600;border:1px solid var(--border-base);background:var(--bg-raised);color:var(--text-muted);">
                Mois
              </button>
            </div>
          </div>
          <div id="tlContent">${this._timeline('week')}</div>
        </div>

      </div>
    `;

    // Stats membres
    if (typeof DB !== 'undefined') {
      DB.fetchMembers().then(members => {
        if (!members.length) return;
        const totalBugs = this.bugs.length || 1;

        // Découper en semaines : S0=cette semaine, S1=semaine prochaine, S2=dans 2 semaines, S3+=au-delà
        const now   = new Date(); now.setHours(0,0,0,0);
        const weekMs = 7 * 24 * 3600 * 1000;
        const weekBound = (n) => new Date(now.getTime() + n * weekMs);

        const memberStats = members.map(m => {
          const assigned   = this.bugs.filter(x => x.assignee === m.name && x.state !== 'Résolu' && x.state !== 'Fermé');
          const allAssigned = this.bugs.filter(x => x.assignee === m.name);
          const done       = allAssigned.filter(x => x.state==='Résolu'||x.state==='Fermé').length;
          const inProgress = assigned.filter(x => x.state==='En cours').length;
          const critical   = assigned.filter(x => x.priority==='Critique').length;

          // Taux de charge hebdomadaire : missions actives avec échéance dans les 7 prochains jours
          const overdue  = assigned.filter(x => x.due_date && new Date(x.due_date) < now).length;
          const thisWeek = assigned.filter(x => x.due_date && new Date(x.due_date) >= now && new Date(x.due_date) < weekBound(1)).length;
          const nextWeek = assigned.filter(x => x.due_date && new Date(x.due_date) >= weekBound(1) && new Date(x.due_date) < weekBound(2)).length;
          const week3    = assigned.filter(x => x.due_date && new Date(x.due_date) >= weekBound(2) && new Date(x.due_date) < weekBound(3)).length;
          const noDue    = assigned.filter(x => !x.due_date).length;

          // Score de charge : missions en retard = 3pts, cette semaine = 2pts, semaine prochaine = 1pt
          const chargeScore = overdue * 3 + thisWeek * 2 + nextWeek * 1;
          const rate        = allAssigned.length ? Math.round(done/allAssigned.length*100) : 0;
          const charge      = Math.round((assigned.length/totalBugs)*100);

          return { ...m, total: assigned.length, allTotal: allAssigned.length, inProgress, done,
                   overdue, thisWeek, nextWeek, week3, noDue, critical, rate, charge, chargeScore };
        }).filter(m => m.allTotal > 0).sort((a,b)=>b.chargeScore-a.chargeScore || b.total-a.total);

        // Normaliser le score de charge sur 100% (relatif au membre le plus chargé)
        const maxScore = Math.max(...memberStats.map(m=>m.chargeScore), 1);
        memberStats.forEach(m => { m.chargeWeekPct = Math.round((m.chargeScore/maxScore)*100); });

        if (!memberStats.length) return;

        const membersHtml = `<div class="db-card" style="margin-top:14px;">
          <div class="db-card-label" style="display:flex;align-items:center;justify-content:space-between;">
            Charge par membre
            <span style="font-size:11px;color:var(--text-faint);font-weight:400;text-transform:none;letter-spacing:0;">
              % = part du total des missions
            </span>
          </div>
          <div class="db-members-grid">
            ${memberStats.map((m, i) => {
              // Couleur de la barre selon la pression
              const barColor = m.chargeWeekPct >= 80 ? '#ff5252' : m.chargeWeekPct >= 50 ? '#ffd040' : '#70d060';
              const pressureLabel = m.chargeWeekPct >= 80 ? '🔴 Surchargé' : m.chargeWeekPct >= 50 ? '🟡 Chargé' : '🟢 Disponible';
              return `
              <div class="db-member-card" onclick="DashboardMemberModal.open(${i})"
                style="cursor:pointer;flex-direction:column;align-items:stretch;gap:10px;">
                <!-- Ligne principale -->
                <div style="display:flex;align-items:center;gap:10px;">
                  <span class="avatar" style="background:${m.color};width:36px;height:36px;font-size:13px;flex-shrink:0;">${m.initials}</span>
                  <div style="flex:1;min-width:0;">
                    <div class="db-member-name">${m.name}</div>
                    <div style="font-size:10px;color:var(--text-faint);">${m.total} active${m.total>1?'s':''} · ${pressureLabel}</div>
                  </div>
                  <div style="text-align:right;flex-shrink:0;">
                    <div style="font-family:'Rajdhani',sans-serif;font-size:22px;font-weight:700;color:${barColor};line-height:1;">${m.chargeWeekPct}%</div>
                    <div style="font-size:9px;color:var(--text-faint);">charge</div>
                  </div>
                </div>
                <!-- Barre de charge hebdo -->
                <div>
                  <div style="background:var(--bg-hover);border-radius:3px;height:6px;overflow:hidden;">
                    <div style="height:100%;border-radius:3px;background:${barColor};width:${m.chargeWeekPct}%;transition:width 0.7s ease;"></div>
                  </div>
                  <!-- Mini timeline semaines -->
                  <div style="display:flex;gap:4px;margin-top:6px;">
                    ${m.overdue  ? `<span style="font-size:9px;background:rgba(255,82,82,0.15);color:#ff5252;border:1px solid rgba(255,82,82,0.3);border-radius:3px;padding:1px 5px;">⚠ ${m.overdue} retard</span>` : ''}
                    ${m.thisWeek ? `<span style="font-size:9px;background:rgba(255,208,64,0.12);color:#ffd040;border:1px solid rgba(255,208,64,0.25);border-radius:3px;padding:1px 5px;">S0 · ${m.thisWeek}</span>` : ''}
                    ${m.nextWeek ? `<span style="font-size:9px;background:rgba(80,184,255,0.1);color:#50b8ff;border:1px solid rgba(80,184,255,0.2);border-radius:3px;padding:1px 5px;">S+1 · ${m.nextWeek}</span>` : ''}
                    ${m.noDue    ? `<span style="font-size:9px;background:var(--bg-raised);color:var(--text-faint);border:1px solid var(--border-dim);border-radius:3px;padding:1px 5px;">Sans date · ${m.noDue}</span>` : ''}
                  </div>
                </div>
              </div>`;
            }).join('')}
          </div>
          <div style="font-size:11px;color:var(--text-faint);text-align:right;margin-top:8px;">
            Cliquer sur un membre pour le détail
          </div>
        </div>`;

        document.getElementById('dashContent').insertAdjacentHTML('beforeend', membersHtml);

        window._dashMemberStats = memberStats;
        window._dashBugsAll = Dashboard.bugs;
      }).catch(()=>{});
    }

    // Animer les compteurs KPI
    this._animateCounters();
    // Animer les barres
    requestAnimationFrame(() => {
      document.querySelectorAll('.db-bar-fill').forEach(el => {
        el.style.width = el.dataset.w;
      });
      document.querySelectorAll('.db-gauge-arc').forEach(el => {
        el.style.strokeDashoffset = el.dataset.offset;
      });
    });
  },

  _kpi(value, key, color, subtitle) {
    const numVal = parseFloat(String(value).replace('%',''));
    return `<div class="db-kpi" style="--kpi-color:${color||'var(--text-bright)'}">
      <div class="db-kpi-num" data-target="${isNaN(numVal)?0:numVal}" data-suffix="${String(value).includes('%')?'%':''}"
        style="color:${color||'var(--text-bright)'}">0${String(value).includes('%')?'%':''}</div>
      <div class="db-kpi-key">${key}</div>
      <div class="db-kpi-sub">${subtitle}</div>
    </div>`;
  },

  _animateCounters() {
    document.querySelectorAll('.db-kpi-num[data-target]').forEach(el => {
      const target  = parseFloat(el.dataset.target) || 0;
      const suffix  = el.dataset.suffix || '';
      const dur     = 900;
      const start   = performance.now();
      const tick    = (now) => {
        const p = Math.min((now - start) / dur, 1);
        const ease = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(target * ease) + suffix;
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  },

  _donut(counts, colors, total) {
    const entries = Object.entries(counts).filter(([,v])=>v>0)
      .sort((a,b)=>b[1]-a[1]);
    if (!entries.length) return '<div class="db-empty">Aucune donnée</div>';

    const R=54, r=32, cx=64, cy=64;
    let paths = '', angle = -Math.PI/2;

    entries.forEach(([key, val], i) => {
      const sweep = (val/total) * 2 * Math.PI;
      const end   = angle + sweep;
      const x1=cx+R*Math.cos(angle), y1=cy+R*Math.sin(angle);
      const x2=cx+R*Math.cos(end),   y2=cy+R*Math.sin(end);
      const ix1=cx+r*Math.cos(angle),iy1=cy+r*Math.sin(angle);
      const ix2=cx+r*Math.cos(end),  iy2=cy+r*Math.sin(end);
      const lg  = sweep > Math.PI ? 1 : 0;
      const col = colors[key] || '#888';
      paths += `<path d="M${ix1},${iy1} L${x1},${y1} A${R},${R},0,${lg},1,${x2},${y2} L${ix2},${iy2} A${r},${r},0,${lg},0,${ix1},${iy1}Z"
        fill="${col}" stroke="var(--bg-surface)" stroke-width="2" opacity="0.9"
        style="transition:opacity 0.2s" onmouseover="this.style.opacity=1;this.style.filter='brightness(1.2)'"
        onmouseout="this.style.opacity=0.9;this.style.filter=''">
        <title>${key} : ${val} (${Math.round(val/total*100)}%)</title></path>`;
      angle = end;
    });

    const legend = entries.slice(0,6).map(([k,v]) =>
      `<div class="db-donut-leg">
        <span style="width:8px;height:8px;border-radius:50%;background:${colors[k]||'#888'};display:inline-block;flex-shrink:0;"></span>
        <span class="db-donut-leg-key">${k}</span>
        <span class="db-donut-leg-val">${Math.round(v/total*100)}%</span>
       </div>`
    ).join('');

    return `<div class="db-donut-wrap">
      <svg width="128" height="128" viewBox="0 0 128 128" style="flex-shrink:0;overflow:visible;">
        ${paths}
        <text x="${cx}" y="${cy-8}"  text-anchor="middle"
          style="font-family:'Rajdhani',sans-serif;font-size:26px;font-weight:700;fill:var(--text-bright)">${total}</text>
        <text x="${cx}" y="${cy+10}" text-anchor="middle"
          style="font-size:10px;fill:var(--text-muted);font-family:'DM Sans',sans-serif;">missions</text>
      </svg>
      <div class="db-donut-legend">${legend}</div>
    </div>`;
  },

  _barsPrio(counts, colors) {
    const order = ['Critique','Haute','Moyenne','Basse','Mineure'];
    const max   = Math.max(...order.map(k => counts[k]||0), 1);
    return `<div class="db-prio-bars">` + order.map(key => {
      const val = counts[key] || 0;
      const pct = Math.round((val/max)*100);
      const col = colors[key];
      return `<div class="db-prio-row">
        <div class="db-prio-label">
          <span class="db-prio-dot" style="background:${col}"></span>${key}
        </div>
        <div class="db-prio-track">
          <div class="db-bar-fill" data-w="${pct}%" style="width:0%;height:100%;border-radius:3px;background:${col};transition:width 0.7s cubic-bezier(0.34,1.2,0.64,1);"></div>
        </div>
        <span class="db-prio-count" style="color:${col}">${val}</span>
      </div>`;
    }).join('') + `</div>`;
  },

  _gauge(rate, resolved, total) {
    // Arc SVG semi-circulaire
    const R   = 70, cx = 90, cy = 90;
    const circ = Math.PI * R; // demi-cercle
    const offset = circ - (rate/100)*circ;
    const stateList = ['Nouveau','En cours','En attente','Rejeté','Résolu','Fermé'];
    const stateColors = { 'Nouveau':'#40e0b0','En cours':'#50b8ff','Résolu':'#70d060','Fermé':'#7a7464','Rejeté':'#ff5252','En attente':'#ffd040' };
    const stateCounts = {}; this.bugs.forEach(x => { stateCounts[x.state]=(stateCounts[x.state]||0)+1; });

    const pills = stateList.filter(s=>stateCounts[s]).map(s =>
      `<div class="db-gauge-pill">
        <span style="width:6px;height:6px;border-radius:50%;background:${stateColors[s]};display:inline-block;"></span>
        ${s} <strong>${stateCounts[s]}</strong>
       </div>`
    ).join('');

    return `<div class="db-gauge-wrap">
      <svg width="180" height="100" viewBox="0 0 180 100" style="overflow:visible;">
        <!-- Track -->
        <path d="M${cx-R},${cy} A${R},${R},0,0,1,${cx+R},${cy}"
          fill="none" stroke="var(--bg-hover)" stroke-width="12" stroke-linecap="round"/>
        <!-- Fill -->
        <path d="M${cx-R},${cy} A${R},${R},0,0,1,${cx+R},${cy}"
          fill="none" stroke="#70d060" stroke-width="12" stroke-linecap="round"
          stroke-dasharray="${circ}"
          class="db-gauge-arc" data-offset="${offset}"
          style="stroke-dashoffset:${circ};transition:stroke-dashoffset 1s cubic-bezier(0.34,1.2,0.64,1);"
          transform="rotate(180 ${cx} ${cy})"/>
        <!-- Centre -->
        <text x="${cx}" y="${cy-14}" text-anchor="middle"
          style="font-family:'Rajdhani',sans-serif;font-size:30px;font-weight:700;fill:#70d060">${rate}%</text>
        <text x="${cx}" y="${cy+2}" text-anchor="middle"
          style="font-size:11px;fill:var(--text-muted);font-family:'DM Sans',sans-serif;">résolution</text>
        <text x="${cx-R+4}" y="${cy+16}" style="font-size:9px;fill:var(--text-faint);font-family:'DM Mono',monospace;">0%</text>
        <text x="${cx+R-4}" y="${cy+16}" text-anchor="end" style="font-size:9px;fill:var(--text-faint);font-family:'DM Mono',monospace;">100%</text>
      </svg>
      <div class="db-gauge-pills">${pills}</div>
    </div>`;
  },

  _catBubbles(counts) {
    const entries = Object.entries(counts).sort((a,b)=>b[1]-a[1]);
    if (!entries.length) return '<div class="db-empty">Aucune donnée</div>';
    const max = Math.max(...entries.map(([,v])=>v), 1);
    const catColors = ['#ee9898','#72d8d2','#e090d0','#c090e8','#90b0e8','#e8cc80','#e89090','#80e0a8','#ffa07a','#87ceeb'];

    return `<div class="db-cat-grid">` + entries.map(([key, val], i) => {
      const size = 36 + Math.round((val/max)*44); // 36–80px
      const col  = catColors[i % catColors.length];
      return `<div class="db-cat-bubble" title="${key}: ${val}"
        style="width:${size}px;height:${size}px;border-radius:50%;
          background:${col}22;border:1.5px solid ${col}55;
          display:flex;flex-direction:column;align-items:center;justify-content:center;
          cursor:default;transition:transform 0.2s,border-color 0.2s;flex-shrink:0;"
        onmouseover="this.style.transform='scale(1.1)';this.style.borderColor='${col}'"
        onmouseout="this.style.transform='';this.style.borderColor='${col}55'">
        <span style="font-family:'Rajdhani',sans-serif;font-size:${Math.max(10,Math.round(size*0.28))}px;
          font-weight:700;color:${col};line-height:1;">${val}</span>
        <span style="font-size:${Math.max(8,Math.round(size*0.14))}px;color:var(--text-muted);
          text-align:center;padding:0 4px;line-height:1.2;max-width:${size-6}px;
          overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${key}</span>
      </div>`;
    }).join('') + `</div>`;
  },

  setTimelineMode(mode) {
    this._tlMode = mode;
    const el = document.getElementById('tlContent');
    if (el) el.innerHTML = this._timeline(mode);
    // Mettre à jour les boutons
    const w = document.getElementById('tlBtnWeek');
    const m = document.getElementById('tlBtnMonth');
    if (w) { w.style.background = mode==='week' ? 'var(--gold-ghost)' : 'var(--bg-raised)'; w.style.color = mode==='week' ? 'var(--gold-bright)' : 'var(--text-muted)'; w.style.borderColor = mode==='week' ? 'var(--gold-dim)' : 'var(--border-base)'; }
    if (m) { m.style.background = mode==='month' ? 'var(--gold-ghost)' : 'var(--bg-raised)'; m.style.color = mode==='month' ? 'var(--gold-bright)' : 'var(--text-muted)'; m.style.borderColor = mode==='month' ? 'var(--gold-dim)' : 'var(--border-base)'; }
  },

  _timeline(mode) {
    mode = mode || this._tlMode || 'week';
    return mode === 'week' ? this._timelineWeeks() : this._timelineMonths();
  },

  _timelineWeeks() {
    const b     = this.bugs;
    const today = new Date(); today.setHours(0,0,0,0);

    // 12 semaines glissantes
    const weeks = [];
    for (let i = 11; i >= 0; i--) {
      const from = new Date(today); from.setDate(from.getDate() - i*7 - from.getDay() + 1); from.setHours(0,0,0,0);
      const to   = new Date(from);  to.setDate(to.getDate()+7);
      const isCurrent = i === 0;
      weeks.push({
        label:    `S${-i||'0'} ${from.toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'})}`,
        short:    from.toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'}),
        created:  b.filter(x => x.created_at && new Date(x.created_at)>=from && new Date(x.created_at)<to).length,
        resolved: b.filter(x => x.created_at && new Date(x.created_at)>=from && new Date(x.created_at)<to && (x.state==='Résolu'||x.state==='Fermé')).length,
        isCurrent
      });
    }

    const maxVal = Math.max(...weeks.map(w=>Math.max(w.created,w.resolved)), 1);
    const H=90, BAR=12, GAP=2, STEP=BAR*2+GAP+4;
    const totalW = 12*STEP;
    const total12  = weeks.reduce((s,w)=>s+w.created,0);
    const resolved12 = weeks.reduce((s,w)=>s+w.resolved,0);
    const trend = weeks[11].created > weeks[10].created ? '↑' : weeks[11].created < weeks[10].created ? '↓' : '→';
    const trendColor = trend==='↑' ? '#ff9040' : trend==='↓' ? '#70d060' : '#888';

    const cols = weeks.map((w,i) => {
      const hC = w.created  ? Math.max(3, Math.round((w.created/maxVal)*H))  : 0;
      const hR = w.resolved ? Math.max(3, Math.round((w.resolved/maxVal)*H)) : 0;
      const x  = i*STEP;
      return `<g>
        ${w.isCurrent ? `<rect x="${x-1}" y="0" width="${STEP+1}" height="${H}" fill="rgba(200,160,48,0.06)" rx="2"/>` : ''}
        <rect x="${x}" y="${H-hC}" width="${BAR}" height="${hC}"
          fill="${w.isCurrent?'#f0c84a':'#50b8ff'}" opacity="0.75" rx="2">
          <title>Sem. ${w.short} — Créées: ${w.created}</title></rect>
        <rect x="${x+BAR+1}" y="${H-hR}" width="${BAR}" height="${hR}"
          fill="#70d060" opacity="0.75" rx="2">
          <title>Sem. ${w.short} — Résolues: ${w.resolved}</title></rect>
        ${i%3===0 || w.isCurrent ? `<text x="${x+BAR}" y="${H+13}" text-anchor="middle"
          style="font-size:8px;font-family:'DM Mono',monospace;fill:${w.isCurrent?'var(--gold-mid)':'var(--text-faint)'}">${w.isCurrent?'Sem. en cours':w.short}</text>` : ''}
      </g>`;
    }).join('');

    return `<div>
      <div style="display:flex;gap:20px;margin-bottom:12px;flex-wrap:wrap;align-items:center;">
        <div style="font-size:12px;color:var(--text-muted);">
          <span style="font-family:'Rajdhani',sans-serif;font-size:22px;font-weight:700;color:#50b8ff;">${total12}</span>
          <span style="margin-left:4px;">créées / 12 sem.</span>
        </div>
        <div style="font-size:12px;color:var(--text-muted);">
          <span style="font-family:'Rajdhani',sans-serif;font-size:22px;font-weight:700;color:#70d060;">${resolved12}</span>
          <span style="margin-left:4px;">résolues</span>
        </div>
        <div style="font-size:12px;color:var(--text-muted);">
          <span style="font-family:'Rajdhani',sans-serif;font-size:22px;font-weight:700;color:${trendColor};">${trend}</span>
          <span style="margin-left:4px;">tendance</span>
        </div>
      </div>
      <div style="overflow-x:auto;">
        <svg width="100%" viewBox="-20 0 ${totalW+24} ${H+20}" style="min-width:400px;overflow:visible;">
          ${[0.25,0.5,1].map(f=>`
            <line x1="0" y1="${H-f*H}" x2="${totalW}" y2="${H-f*H}" stroke="var(--border-dim)" stroke-width="0.5" stroke-dasharray="2 3"/>
            <text x="-4" y="${H-f*H+3}" text-anchor="end" style="font-size:8px;font-family:'DM Mono',monospace;fill:var(--text-faint)">${Math.round(f*maxVal)}</text>
          `).join('')}
          <line x1="0" y1="${H}" x2="${totalW}" y2="${H}" stroke="var(--border-base)" stroke-width="0.5"/>
          ${cols}
        </svg>
      </div>
      <div style="display:flex;align-items:center;gap:14px;margin-top:8px;font-size:11px;color:var(--text-muted);">
        <span style="display:flex;align-items:center;gap:5px;"><span style="width:10px;height:10px;border-radius:2px;background:#50b8ff;display:inline-block;"></span>Créées</span>
        <span style="display:flex;align-items:center;gap:5px;"><span style="width:10px;height:10px;border-radius:2px;background:#70d060;display:inline-block;"></span>Résolues</span>
        <span style="margin-left:auto;font-size:10px;color:var(--text-faint);">12 dernières semaines</span>
      </div>
    </div>`;
  },

  _timelineMonths() {
    const b     = this.bugs;
    const today = new Date();

    // 12 mois glissants
    const months = [];
    for (let i = 11; i >= 0; i--) {
      const d    = new Date(today.getFullYear(), today.getMonth()-i, 1);
      const next = new Date(d.getFullYear(), d.getMonth()+1, 1);
      const isCurrent = i === 0;
      months.push({
        label:    d.toLocaleDateString('fr-FR',{month:'short',year:'2-digit'}),
        created:  b.filter(x => x.created_at && new Date(x.created_at)>=d && new Date(x.created_at)<next).length,
        resolved: b.filter(x => x.created_at && new Date(x.created_at)>=d && new Date(x.created_at)<next && (x.state==='Résolu'||x.state==='Fermé')).length,
        isCurrent
      });
    }

    const maxVal = Math.max(...months.map(m=>Math.max(m.created,m.resolved)), 1);
    const H=90, BAR=14, GAP=3, STEP=BAR*2+GAP+6;
    const totalW = 12*STEP;
    const total12 = months.reduce((s,m)=>s+m.created,0);
    const resolved12 = months.reduce((s,m)=>s+m.resolved,0);
    const avgMonth = (total12/12).toFixed(1);

    // Ligne de tendance (moyenne mobile)
    const avgLine = months.map((m,i) => {
      if (i < 2) return null;
      const avg = (months[i-2].created + months[i-1].created + m.created) / 3;
      const x = i*STEP + BAR;
      const y = H - (avg/maxVal)*H;
      return `${x},${y}`;
    }).filter(Boolean).join(' ');

    const cols = months.map((m,i) => {
      const hC = m.created  ? Math.max(3, Math.round((m.created/maxVal)*H))  : 0;
      const hR = m.resolved ? Math.max(3, Math.round((m.resolved/maxVal)*H)) : 0;
      const x  = i*STEP;
      return `<g>
        ${m.isCurrent ? `<rect x="${x-1}" y="0" width="${STEP+1}" height="${H}" fill="rgba(200,160,48,0.07)" rx="2"/>` : ''}
        <rect x="${x}" y="${H-hC}" width="${BAR}" height="${hC}"
          fill="${m.isCurrent?'#f0c84a':'#50b8ff'}" opacity="0.75" rx="2">
          <title>${m.label} — Créées: ${m.created}</title></rect>
        <rect x="${x+BAR+1}" y="${H-hR}" width="${BAR}" height="${hR}"
          fill="#70d060" opacity="0.75" rx="2">
          <title>${m.label} — Résolues: ${m.resolved}</title></rect>
        <text x="${x+BAR}" y="${H+13}" text-anchor="middle"
          style="font-size:8px;font-family:'DM Mono',monospace;fill:${m.isCurrent?'var(--gold-mid)':'var(--text-faint)'}">${m.label}</text>
      </g>`;
    }).join('');

    return `<div>
      <div style="display:flex;gap:20px;margin-bottom:12px;flex-wrap:wrap;align-items:center;">
        <div style="font-size:12px;color:var(--text-muted);">
          <span style="font-family:'Rajdhani',sans-serif;font-size:22px;font-weight:700;color:#50b8ff;">${total12}</span>
          <span style="margin-left:4px;">créées / 12 mois</span>
        </div>
        <div style="font-size:12px;color:var(--text-muted);">
          <span style="font-family:'Rajdhani',sans-serif;font-size:22px;font-weight:700;color:#70d060;">${resolved12}</span>
          <span style="margin-left:4px;">résolues</span>
        </div>
        <div style="font-size:12px;color:var(--text-muted);">
          <span style="font-family:'Rajdhani',sans-serif;font-size:22px;font-weight:700;color:var(--text-bright);">${avgMonth}</span>
          <span style="margin-left:4px;">/ mois en moyenne</span>
        </div>
      </div>
      <div style="overflow-x:auto;">
        <svg width="100%" viewBox="-20 0 ${totalW+24} ${H+20}" style="min-width:400px;overflow:visible;">
          ${[0.25,0.5,1].map(f=>`
            <line x1="0" y1="${H-f*H}" x2="${totalW}" y2="${H-f*H}" stroke="var(--border-dim)" stroke-width="0.5" stroke-dasharray="2 3"/>
            <text x="-4" y="${H-f*H+3}" text-anchor="end" style="font-size:8px;font-family:'DM Mono',monospace;fill:var(--text-faint)">${Math.round(f*maxVal)}</text>
          `).join('')}
          <line x1="0" y1="${H}" x2="${totalW}" y2="${H}" stroke="var(--border-base)" stroke-width="0.5"/>
          ${cols}
          ${avgLine ? `<polyline points="${avgLine}" fill="none" stroke="rgba(200,160,48,0.5)" stroke-width="1.5" stroke-dasharray="4 2"/>` : ''}
        </svg>
      </div>
      <div style="display:flex;align-items:center;gap:14px;margin-top:8px;font-size:11px;color:var(--text-muted);">
        <span style="display:flex;align-items:center;gap:5px;"><span style="width:10px;height:10px;border-radius:2px;background:#50b8ff;display:inline-block;"></span>Créées</span>
        <span style="display:flex;align-items:center;gap:5px;"><span style="width:10px;height:10px;border-radius:2px;background:#70d060;display:inline-block;"></span>Résolues</span>
        <span style="display:flex;align-items:center;gap:5px;"><span style="width:16px;height:2px;background:rgba(200,160,48,0.6);display:inline-block;border-radius:1px;"></span>Tendance (moy. mobile 3 mois)</span>
        <span style="margin-left:auto;font-size:10px;color:var(--text-faint);">12 derniers mois</span>
      </div>
    </div>`;
  }
};
;
