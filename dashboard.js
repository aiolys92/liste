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
          <div class="db-card-label">Activité — 8 semaines</div>
          ${this._timeline()}
        </div>

      </div>
    `;

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

  _timeline() {
    const b     = this.bugs;
    const today = new Date(); today.setHours(0,0,0,0);
    const weeks = [];
    for (let i=7; i>=0; i--) {
      const from = new Date(today); from.setDate(from.getDate()-i*7);
      const to   = new Date(from);  to.setDate(to.getDate()+7);
      weeks.push({
        label:    from.toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'}),
        created:  b.filter(x => x.created_at && new Date(x.created_at)>=from && new Date(x.created_at)<to).length,
        resolved: b.filter(x => x.created_at && new Date(x.created_at)>=from && new Date(x.created_at)<to && (x.state==='Résolu'||x.state==='Fermé')).length,
      });
    }

    const maxVal = Math.max(...weeks.map(w=>Math.max(w.created,w.resolved)), 1);
    const H=90, W=100, GAP=4, BAR=16;

    const cols = weeks.map((w,i) => {
      const hC = w.created  ? Math.max(3, Math.round((w.created/maxVal)*H))  : 0;
      const hR = w.resolved ? Math.max(3, Math.round((w.resolved/maxVal)*H)) : 0;
      const x  = i*(W+GAP);
      return `<g>
        <!-- Créées -->
        <rect x="${x}" y="${H-hC}" width="${BAR}" height="${hC}" fill="#50b8ff" opacity="0.75" rx="3"
          style="transition:opacity 0.2s" onmouseover="this.nextElementSibling.style.display='block'"
          onmouseout="this.nextElementSibling.style.display='none'">
          <title>${w.label} — Créées: ${w.created}</title></rect>
        <!-- Résolues -->
        <rect x="${x+BAR+2}" y="${H-hR}" width="${BAR}" height="${hR}" fill="#70d060" opacity="0.75" rx="3">
          <title>${w.label} — Résolues: ${w.resolved}</title></rect>
        <!-- Label -->
        <text x="${x+BAR}" y="${H+14}" text-anchor="middle"
          style="font-size:9px;font-family:'DM Mono',monospace;fill:var(--text-faint)">${w.label}</text>
      </g>`;
    }).join('');

    const totalW = 8*(W+GAP)-GAP;

    return `<div style="overflow-x:auto;">
      <svg width="100%" viewBox="0 0 ${totalW} ${H+22}" style="min-width:500px;overflow:visible;">
        <!-- Lignes de grille -->
        ${[0.25,0.5,0.75,1].map(f=>`
          <line x1="0" y1="${H-f*H}" x2="${totalW}" y2="${H-f*H}"
            stroke="var(--border-dim)" stroke-width="0.5" stroke-dasharray="3 3"/>
          <text x="-4" y="${H-f*H+4}" text-anchor="end"
            style="font-size:8px;font-family:'DM Mono',monospace;fill:var(--text-faint)">${Math.round(f*maxVal)}</text>
        `).join('')}
        <line x1="0" y1="${H}" x2="${totalW}" y2="${H}" stroke="var(--border-base)" stroke-width="0.5"/>
        ${cols}
      </svg>
      <div style="display:flex;align-items:center;gap:14px;margin-top:10px;font-size:11px;color:var(--text-muted);">
        <span style="display:flex;align-items:center;gap:5px;">
          <span style="width:10px;height:10px;border-radius:2px;background:#50b8ff;display:inline-block;"></span>Créées
        </span>
        <span style="display:flex;align-items:center;gap:5px;">
          <span style="width:10px;height:10px;border-radius:2px;background:#70d060;display:inline-block;"></span>Résolues
        </span>
      </div>
    </div>`;
  }
};
