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
// MARQUEE — défilement auto si texte tronqué
// ============================================
function initMarquee(root) {
  const el = root || document;
  // Cibler tous les éléments susceptibles de déborder
  el.querySelectorAll('.badge, .kanban-card-title, .tl-label-text, .tl-bar-label, .bug-desc-title').forEach(applyMarquee);
}

function applyMarquee(el) {
  // Déjà traité
  if (el.dataset.marqueeInit) return;
  el.dataset.marqueeInit = '1';

  el.addEventListener('mouseenter', () => {
    const overflow = el.scrollWidth - el.clientWidth;
    if (overflow <= 2) return; // Pas de débordement

    // Distance à parcourir (négative = vers la gauche)
    const dist = -(overflow + 8);
    el.style.setProperty('--marquee-dist', dist + 'px');
    el.style.transition = 'none';
    el.style.willChange = 'transform';

    // Petite pause puis défilement
    let start = null;
    const dur  = Math.min(4000, Math.max(1500, overflow * 18)); // vitesse proportionnelle
    const pause = 400;

    function tick(ts) {
      if (!start) start = ts;
      const elapsed = ts - start - pause;
      if (elapsed < 0) { requestAnimationFrame(tick); return; }

      const progress = Math.min(elapsed / dur, 1);
      // Ease in-out
      const ease = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      el.style.transform = `translateX(${dist * ease}px)`;

      if (progress < 1 && el.matches(':hover')) {
        requestAnimationFrame(tick);
      } else if (!el.matches(':hover')) {
        resetMarquee(el);
      }
    }
    requestAnimationFrame(tick);
  });

  el.addEventListener('mouseleave', () => resetMarquee(el));
}

function resetMarquee(el) {
  el.style.transition = 'transform 0.3s ease';
  el.style.transform  = 'translateX(0)';
  setTimeout(() => { el.style.transition = ''; el.style.willChange = ''; }, 300);
}

// Observer les nouveaux éléments ajoutés dynamiquement (re-render)
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
