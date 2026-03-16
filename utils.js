// ============================================
// UTILITAIRES PARTAGÉS
// ============================================

// --- Copie d'ID avec feedback ---
function copyId(id, el) {
  navigator.clipboard.writeText(id).then(() => {
    el.classList.add('copied');
    showToast('✓ ID copié : ' + id);
    setTimeout(() => el.classList.remove('copied'), 1500);
  }).catch(() => {
    showToast('Impossible de copier', 'error');
  });
}

// --- Toast central ---
let _toastTimer;
function showToast(msg, type = 'success') {
  let el = document.getElementById('actionToast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'actionToast';
    el.className = 'action-toast hidden';
    el.innerHTML = '<span class="toast-dot"></span><span id="actionToastMsg"></span>';
    document.body.appendChild(el);
  }
  el.className = `action-toast ${type === 'error' ? 'toast-error' : type === 'warn' ? 'toast-warn' : ''}`;
  document.getElementById('actionToastMsg').textContent = msg;
  clearTimeout(_toastTimer);
  // Force reflow pour relancer l'animation
  el.offsetHeight;
  _toastTimer = setTimeout(() => el.classList.add('hidden'), 2400);
}

// ============================================
// MARQUEE — défilement du texte si tronqué
// Seul le contenu intérieur bouge, pas le bloc
// ============================================
function initMarquee(root) {
  const el = root || document;
  el.querySelectorAll('.badge, .kanban-card-title, .tl-label-text, .tl-bar-label, .bug-desc-title')
    .forEach(applyMarquee);
}

function applyMarquee(el) {
  if (el.dataset.marqueeInit) return;
  el.dataset.marqueeInit = '1';

  // S'assurer que le conteneur clip son contenu
  el.style.overflow   = 'hidden';
  el.style.position   = 'relative';
  el.style.whiteSpace = 'nowrap';

  el.addEventListener('mouseenter', () => {
    const overflow = el.scrollWidth - el.clientWidth;
    if (overflow <= 2) return; // Pas de débordement, rien à faire

    // Créer un span interne si pas déjà fait
    let inner = el.querySelector('.mq-inner');
    if (!inner) {
      // Wrapper le contenu existant dans un span
      inner = document.createElement('span');
      inner.className = 'mq-inner';
      inner.style.cssText = 'display:inline-block;white-space:nowrap;will-change:transform;';
      // Déplacer tous les enfants dans le span
      while (el.firstChild) inner.appendChild(el.firstChild);
      el.appendChild(inner);
    }

    const dist = -(overflow + 12);
    const dur  = Math.min(4000, Math.max(1500, overflow * 18));
    const pause = 500;
    let start = null;
    let raf;

    function tick(ts) {
      if (!start) start = ts;
      const elapsed = ts - start - pause;
      if (elapsed < 0) { raf = requestAnimationFrame(tick); return; }

      const progress = Math.min(elapsed / dur, 1);
      const ease = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      inner.style.transform = `translateX(${dist * ease}px)`;

      if (progress < 1 && el.matches(':hover')) {
        raf = requestAnimationFrame(tick);
      } else if (!el.matches(':hover')) {
        resetInner(inner);
      }
    }

    raf = requestAnimationFrame(tick);
    el._marqueeRaf = raf;
  });

  el.addEventListener('mouseleave', () => {
    cancelAnimationFrame(el._marqueeRaf);
    const inner = el.querySelector('.mq-inner');
    if (inner) resetInner(inner);
  });
}

function resetInner(inner) {
  inner.style.transition = 'transform 0.25s ease';
  inner.style.transform  = 'translateX(0)';
  setTimeout(() => { inner.style.transition = ''; }, 280);
}

// Observer les nouveaux éléments ajoutés dynamiquement
const _marqueeObserver = new MutationObserver(mutations => {
  mutations.forEach(m => {
    m.addedNodes.forEach(node => {
      if (node.nodeType === 1) initMarquee(node);
    });
  });
});

document.addEventListener('DOMContentLoaded', () => {
  initMarquee();
  _marqueeObserver.observe(document.body, { childList: true, subtree: true });
});

// ============================================
// UTILITAIRES PARTAGÉS — fonctions globales
// ============================================

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric' });
}

function fmtDatetime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
}

function esc(str) {
  return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function toSlug(str) {
  return String(str||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'');
}

function renderDueDate(due, state) {
  if (!due) return '<span style="color:var(--text-faint)">—</span>';
  const today = new Date(); today.setHours(0,0,0,0);
  const diff  = Math.ceil((new Date(due) - today) / 864e5);
  const done  = state === 'Résolu' || state === 'Fermé';
  if (done) return `<span class="due-date ok">${fmtDate(due)}</span>`;
  if (diff < 0)  return `<span class="due-date overdue">⚠ ${fmtDate(due)}</span>`;
  if (diff <= 3) return `<span class="due-date due-soon">⏰ ${fmtDate(due)}</span>`;
  return `<span class="due-date ok">${fmtDate(due)}</span>`;
}

function clientBadge(clientId, clients) {
  if (!clientId || !clients) return '';
  const c = clients.find(x => x.id == clientId);
  if (!c) return '';
  return `<span class="client-badge" style="background:${c.color}20;border:1px solid ${c.color}50;color:${c.color};">${esc(c.name)}</span>`;
}
