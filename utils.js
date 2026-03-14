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
