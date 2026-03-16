// ============================================
// HEADER CENTRALISÉ — Command Post
// Usage : Header.init('dashboard') dans chaque page
// ============================================
const Header = {

  // Liens nav publique (ordre fixe)
  _navPublic: [
    { id: 'index',     href: 'index.html',     label: 'Mission Board' },
    { id: 'dashboard', href: 'dashboard.html',  label: 'Dashboard' },
    { id: 'requests',  href: 'requests.html',   label: 'Demandes' },
    { id: 'archives',  href: 'archives.html',   label: 'Archives' },
  ],

  // Liens nav admin
  _navAdmin: [
    { id: 'public',    href: 'index.html',      label: '← Vue publique' },
    { id: 'changelog', href: 'changelog.html',  label: 'Changelog' },
    { id: 'archives',  href: 'archives.html',   label: 'Archives' },
  ],

  init(pageId) {
    this._pageId  = pageId;
    this._isAdmin = pageId === 'backoffice';

    // Injecter le header avant le body
    const existing = document.querySelector('.site-header');
    if (existing) existing.remove();

    const header = document.createElement('header');
    header.className = 'site-header';
    header.innerHTML = this._render();
    document.body.insertAdjacentElement('afterbegin', header);

    // Hamburger mobile
    this._initHamburger();
  },

  _render() {
    const isAdmin = this._isAdmin;
    const pageId  = this._pageId;

    // Logo / titre
    const logo = isAdmin
      ? `<span class="header-title"><span class="header-title-icon">⬡</span>Command Post <span class="backoffice-badge">⚙ Admin</span></span>`
      : `<a href="index.html" class="header-title"><span class="header-title-icon">⬡</span>Command Post</a>`;

    // Liens nav
    const navLinks = isAdmin ? this._navAdmin : this._navPublic;
    const links = navLinks.map(l => {
      const active = l.id === pageId ? ' class="active"' : '';
      return `<a href="${l.href}"${active}>${l.label}</a>`;
    }).join('\n      ');


    // Bouton droit (back-office ou déconnexion)
    const rightBtn = isAdmin
      ? `<a href="#" onclick="typeof BO !== 'undefined' && BO.logout()" style="color:var(--p-critical);border-color:rgba(255,82,82,0.2);">Déconnexion</a>`
      : `<a href="login.html" class="btn-backoffice">⚙ Back-office</a>`;

    return `
    ${logo}
    <nav class="header-nav" id="mainNav">
      ${links}
      ${rightBtn}
    </nav>`;
  },



  _initHamburger() {
    const nav = document.getElementById('mainNav');
    if (!nav) return;

    // Bouton hamburger
    const btn = document.createElement('button');
    btn.className = 'nav-hamburger';
    btn.innerHTML = '☰';
    btn.setAttribute('aria-label', 'Menu');
    btn.addEventListener('click', e => {
      e.stopPropagation();
      nav.classList.toggle('nav-open');
      btn.innerHTML = nav.classList.contains('nav-open') ? '✕' : '☰';
    });

    // Insérer le bouton dans le header (avant la nav)
    const header = document.querySelector('.site-header');
    header.insertBefore(btn, nav);

    // Fermer au clic extérieur
    document.addEventListener('click', () => {
      nav.classList.remove('nav-open');
      btn.innerHTML = '☰';
    });
  }
};
