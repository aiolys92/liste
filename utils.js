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

// --- Nav hamburger ---
function initHamburger() {
  const nav = document.querySelector('.header-nav');
  if (!nav) return;

  // Wrap des liens dans .nav-links
  const links = [...nav.querySelectorAll('a, button:not(.nav-hamburger)')];
  const wrapper = document.createElement('div');
  wrapper.className = 'nav-links';
  links.forEach(l => wrapper.appendChild(l));
  nav.appendChild(wrapper);

  // Bouton hamburger
  const btn = document.createElement('button');
  btn.className = 'nav-hamburger';
  btn.innerHTML = '☰';
  btn.setAttribute('aria-label', 'Menu');
  btn.addEventListener('click', e => {
    e.stopPropagation();
    wrapper.classList.toggle('open');
    btn.innerHTML = wrapper.classList.contains('open') ? '✕' : '☰';
  });
  nav.insertBefore(btn, wrapper);

  // Fermer au clic extérieur
  document.addEventListener('click', () => {
    wrapper.classList.remove('open');
    btn.innerHTML = '☰';
  });
}

document.addEventListener('DOMContentLoaded', initHamburger);

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
