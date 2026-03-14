// ============================================
// DASHBOARD — Stats visuelles
// Utilisé sur index.html (front) et backoffice.html
// ============================================

const Dashboard = {
  bugs: [],
  isAdmin: false,

  async init(isAdmin = false) {
    this.isAdmin = isAdmin;
    this.loadTheme();
    document.getElementById('themeToggle')?.addEventListener('click', () => this.toggleTheme());
    try {
      this.bugs = await DB.fetchStats();
    } catch(e) {
      document.getElementById('dashError').style.display = 'block';
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
    const bugs = this.bugs;
    const total = bugs.length;

    // ---- Compteurs par état ----
    const stateColors = {
      'Nouveau':'#40e0b0','En cours':'#50b8ff','Résolu':'#70d060',
      'Fermé':'#7a7464','Rejeté':'#ff5252','En attente':'#ffd040'
    };
    const stateCounts = {};
    bugs.forEach(b => { stateCounts[b.state] = (stateCounts[b.state]||0)+1; });

    // ---- Compteurs par priorité ----
    const prioColors = {
      'Critique':'#ff5252','Haute':'#ff9040','Moyenne':'#ffd040',
      'Basse':'#50b8ff','Mineure':'#c060ff'
    };
    const prioCounts = {};
    bugs.forEach(b => { prioCounts[b.priority] = (prioCounts[b.priority]||0)+1; });

    // ---- Compteurs par catégorie ----
    const catCounts = {};
    bugs.forEach(b => { catCounts[b.category] = (catCounts[b.category]||0)+1; });

    // ---- Missions en retard ----
    const today = new Date(); today.setHours(0,0,0,0);
    const overdue = bugs.filter(b => b.due_date && new Date(b.due_date) < today && b.state !== 'Résolu' && b.state !== 'Fermé').length;

    // ---- Créées cette semaine ----
    const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate()-7);
    const thisWeek = bugs.filter(b => b.created_at && new Date(b.created_at) >= weekAgo).length;

    // ---- Taux de résolution ----
    const resolved = bugs.filter(b => b.state === 'Résolu' || b.state === 'Fermé').length;
    const resolveRate = total ? Math.round((resolved/total)*100) : 0;

    // ---- Évolution sur 8 semaines ----
    const weeks = [];
    for (let i=7; i>=0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i*7);
      const next = new Date(d); next.setDate(next.getDate()+7);
      weeks.push({
        label: d.toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'}),
        created: bugs.filter(b => b.created_at && new Date(b.created_at) >= d && new Date(b.created_at) < next).length,
        resolved: bugs.filter(b => b.created_at && new Date(b.created_at) >= d && new Date(b.created_at) < next && (b.state==='Résolu'||b.state==='Fermé')).length
      });
    }

    document.getElementById('dashContent').innerHTML = `
      <!-- KPI row -->
      <div class="dash-kpi-row">
        ${this._kpi(total, 'Missions actives', '')}
        ${this._kpi(bugs.filter(b=>b.state==='En cours').length, 'En cours', '#50b8ff')}
        ${this._kpi(bugs.filter(b=>b.priority==='Critique').length, 'Critiques', '#ff5252')}
        ${this._kpi(overdue, 'En retard', overdue>0?'#ff5252':'')}
        ${this._kpi(thisWeek, 'Cette semaine', '#40e0b0')}
        ${this._kpi(resolveRate+'%', 'Taux résolution', '#70d060')}
      </div>

      <!-- Charts row -->
      <div class="dash-charts-row">

        <!-- Donut états -->
        <div class="dash-card">
          <div class="dash-card-title">Par état</div>
          ${this._donut(stateCounts, stateColors, total)}
        </div>

        <!-- Barres priorités -->
        <div class="dash-card">
          <div class="dash-card-title">Par priorité</div>
          ${this._bars(prioCounts, prioColors, total, ['Critique','Haute','Moyenne','Basse','Mineure'])}
        </div>

        <!-- Barres catégories -->
        <div class="dash-card">
          <div class="dash-card-title">Par catégorie</div>
          ${this._bars(catCounts, null, total, Object.keys(catCounts).sort((a,b)=>(catCounts[b]||0)-(catCounts[a]||0)))}
        </div>

      </div>

      <!-- Évolution temporelle -->
      <div class="dash-card dash-card-wide">
        <div class="dash-card-title">Évolution sur 8 semaines</div>
        ${this._timeline(weeks)}
      </div>
    `;
  },

  _kpi(value, label, color) {
    return `<div class="dash-kpi">
      <div class="dash-kpi-value" style="${color?'color:'+color:''}">${value}</div>
      <div class="dash-kpi-label">${label}</div>
    </div>`;
  },

  _donut(counts, colors, total) {
    const entries = Object.entries(counts).filter(([,v])=>v>0);
    if (!entries.length) return '<div class="dash-empty">Aucune donnée</div>';

    const size = 140, cx=70, cy=70, r=50, hole=30;
    let path = '', startAngle = -Math.PI/2;
    const legend = [];

    entries.forEach(([key, val]) => {
      const angle = (val/total)*2*Math.PI;
      const endAngle = startAngle + angle;
      const x1=cx+r*Math.cos(startAngle), y1=cy+r*Math.sin(startAngle);
      const x2=cx+r*Math.cos(endAngle),   y2=cy+r*Math.sin(endAngle);
      const xi1=cx+hole*Math.cos(startAngle), yi1=cy+hole*Math.sin(startAngle);
      const xi2=cx+hole*Math.cos(endAngle),   yi2=cy+hole*Math.sin(endAngle);
      const large = angle > Math.PI ? 1 : 0;
      const color = colors[key] || '#888';
      path += `<path d="M${xi1},${yi1} L${x1},${y1} A${r},${r},0,${large},1,${x2},${y2} L${xi2},${yi2} A${hole},${hole},0,${large},0,${xi1},${yi1} Z"
        fill="${color}" opacity="0.85" stroke="var(--bg-surface)" stroke-width="1.5">
        <title>${key}: ${val}</title></path>`;
      legend.push({ key, val, color });
      startAngle = endAngle;
    });

    const legendHtml = legend.map(l =>
      `<div class="dash-legend-item">
        <span class="dash-legend-dot" style="background:${l.color}"></span>
        <span class="dash-legend-key">${l.key}</span>
        <span class="dash-legend-val">${l.val}</span>
      </div>`
    ).join('');

    return `<div class="dash-donut-wrap">
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="flex-shrink:0">
        ${path}
        <text x="${cx}" y="${cy-6}" text-anchor="middle" style="font-family:'Rajdhani',sans-serif;font-size:22px;font-weight:700;fill:var(--text-bright)">${total}</text>
        <text x="${cx}" y="${cy+12}" text-anchor="middle" style="font-size:10px;fill:var(--text-muted)">total</text>
      </svg>
      <div class="dash-legend">${legendHtml}</div>
    </div>`;
  },

  _bars(counts, colors, total, order) {
    const entries = order.map(k => [k, counts[k]||0]).filter(([,v])=>v>0);
    if (!entries.length) return '<div class="dash-empty">Aucune donnée</div>';
    const max = Math.max(...entries.map(([,v])=>v));

    return `<div class="dash-bars">` + entries.map(([key, val]) => {
      const pct = max ? Math.round((val/max)*100) : 0;
      const color = colors ? (colors[key]||'#888') : this._catColor(key);
      return `<div class="dash-bar-row">
        <div class="dash-bar-label">${key}</div>
        <div class="dash-bar-track">
          <div class="dash-bar-fill" style="width:${pct}%;background:${color}"></div>
        </div>
        <div class="dash-bar-count">${val}</div>
      </div>`;
    }).join('') + `</div>`;
  },

  _timeline(weeks) {
    const maxVal = Math.max(...weeks.map(w => Math.max(w.created, w.resolved)), 1);
    const H=80, W=560, barW=30, gap=W/weeks.length;

    const bars = weeks.map((w, i) => {
      const x = i*gap + gap/2;
      const hC = w.created  ? Math.max(4, Math.round((w.created/maxVal)*H))  : 0;
      const hR = w.resolved ? Math.max(4, Math.round((w.resolved/maxVal)*H)) : 0;
      return `
        <rect x="${x-barW/2-1}" y="${H-hC}" width="${barW/2}" height="${hC}" fill="#50b8ff" opacity="0.7" rx="2">
          <title>Créées: ${w.created}</title></rect>
        <rect x="${x+1}" y="${H-hR}" width="${barW/2}" height="${hR}" fill="#70d060" opacity="0.7" rx="2">
          <title>Résolues: ${w.resolved}</title></rect>
        <text x="${x}" y="${H+16}" text-anchor="middle" style="font-size:9px;fill:var(--text-faint)">${w.label}</text>`;
    }).join('');

    return `<div style="overflow-x:auto;">
      <svg width="100%" viewBox="0 0 ${W} ${H+28}" style="min-width:360px">
        ${bars}
        <line x1="0" y1="${H}" x2="${W}" y2="${H}" stroke="var(--border-base)" stroke-width="0.5"/>
      </svg>
      <div class="dash-timeline-legend">
        <span class="dash-legend-dot" style="background:#50b8ff"></span> Créées
        <span class="dash-legend-dot" style="background:#70d060;margin-left:12px"></span> Résolues
      </div>
    </div>`;
  },

  _catColor(cat) {
    const map = {
      'Gameplay':'#ee9898','Interface':'#72d8d2','Graphismes':'#e090d0',
      'Audio':'#c090e8','Serveur':'#90b0e8','Texte':'#e8cc80',
      'Combat':'#e89090','Quête':'#80e0a8'
    };
    return map[cat] || '#888780';
  }
};
