// ============================================
// RACCOURCIS CLAVIER
// ============================================
const Shortcuts = {
  init(context) {
    // context = 'front' | 'backoffice'
    document.addEventListener('keydown', e => {
      // Ne pas intercepter si focus dans un input/textarea
      const tag = document.activeElement.tagName;
      const inInput = ['INPUT','TEXTAREA','SELECT'].includes(tag);

      // Esc — fermer toute modale ouverte
      if (e.key === 'Escape') {
        const modals = ['modalOverlay','confirmOverlay','commentsModal','historyModal',
                        'actionModalOverlay','stateModalOverlay','acceptModalOverlay','detailOverlay'];
        for (const id of modals) {
          const el = document.getElementById(id);
          if (el && !el.classList.contains('hidden')) {
            el.classList.add('hidden'); return;
          }
        }
      }

      if (inInput) return;

      // N — nouvelle mission (back-office)
      if (e.key === 'n' && context === 'backoffice' && typeof BO !== 'undefined') {
        e.preventDefault(); BO.openCreate();
      }

      // R — rafraîchir les données
      if (e.key === 'r' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        Cache.invalidateAll();
        window.location.reload();
      }

      // 1/2/3 — changer de vue (front)
      if (context === 'front' && typeof Front !== 'undefined') {
        if (e.key === '1') { e.preventDefault(); Front.switchView('list'); }
        if (e.key === '2') { e.preventDefault(); Front.switchView('kanban'); }
        if (e.key === '3') { e.preventDefault(); Front.switchView('timeline'); }
      }

      // ? — afficher l'aide
      if (e.key === '?') { e.preventDefault(); Shortcuts.showHelp(context); }
    });

    // Indicateur de raccourcis dans le footer
    this._addHint();
  },

  showHelp(context) {
    const shortcuts = [
      { key: 'Cmd+K', desc: 'Recherche globale' },
      { key: 'Esc',   desc: 'Fermer la modale' },
      { key: 'R',     desc: 'Rafraîchir' },
      { key: '?',     desc: 'Aide raccourcis' },
    ];
    if (context === 'front') shortcuts.push(
      { key: '1', desc: 'Vue liste' },
      { key: '2', desc: 'Vue kanban' },
      { key: '3', desc: 'Vue timeline' },
    );
    if (context === 'backoffice') shortcuts.push(
      { key: 'N', desc: 'Nouvelle mission' },
    );

    let el = document.getElementById('shortcut-help');
    if (el) { el.remove(); return; } // toggle

    el = document.createElement('div');
    el.id = 'shortcut-help';
    el.style.cssText = `
      position:fixed;bottom:20px;right:20px;z-index:4000;
      background:var(--bg-overlay);border:1px solid var(--border-strong);
      border-radius:var(--r-lg);padding:16px 18px;
      box-shadow:var(--shadow-lg);min-width:220px;
      animation:slideUp 0.2s ease;
    `;
    el.innerHTML = `
      <div style="font-family:'Rajdhani',sans-serif;font-size:14px;font-weight:700;
        letter-spacing:1px;text-transform:uppercase;color:var(--text-bright);margin-bottom:12px;">
        Raccourcis
      </div>
      ${shortcuts.map(s => `
        <div style="display:flex;align-items:center;justify-content:space-between;
          gap:16px;margin-bottom:7px;font-size:12px;">
          <span style="color:var(--text-muted)">${s.desc}</span>
          <kbd style="background:var(--bg-raised);border:1px solid var(--border-base);
            border-radius:4px;padding:2px 7px;font-family:'DM Mono',monospace;
            font-size:11px;color:var(--text-base);">${s.key}</kbd>
        </div>`).join('')}
      <div style="margin-top:10px;font-size:10px;color:var(--text-faint);text-align:center;">
        Appuyez sur ? pour fermer
      </div>
    `;
    document.body.appendChild(el);
    setTimeout(() => { if(document.getElementById('shortcut-help'))el.remove(); }, 5000);
  },

  _addHint() {
    const hint = document.createElement('div');
    hint.style.cssText = `
      position:fixed;bottom:12px;right:16px;z-index:100;
      font-size:10px;color:var(--text-faint);font-family:'DM Mono',monospace;
      cursor:pointer;transition:color 0.15s;
    `;
    hint.textContent = '? raccourcis';
    hint.addEventListener('click', () => Shortcuts.showHelp(Shortcuts._ctx));
    hint.addEventListener('mouseenter', () => hint.style.color = 'var(--text-muted)');
    hint.addEventListener('mouseleave', () => hint.style.color = 'var(--text-faint)');
    document.body.appendChild(hint);
  }
};
