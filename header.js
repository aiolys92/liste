// ============================================
// HEADER CENTRALISÉ — Command Post
// ============================================
const Header = {

  _navPublic: [
    { id: 'index',     href: 'index.html',    label: 'Mission Board' },
    { id: 'dashboard', href: 'dashboard.html', label: 'Dashboard' },
    { id: 'requests',  href: 'requests.html',  label: 'Demandes' },
    { id: 'archives',  href: 'archives.html',  label: 'Archives' },
  ],

  _navAdmin: [
    { id: 'public',    href: 'index.html',     label: '← Vue publique' },
    { id: 'changelog', href: 'changelog.html', label: 'Changelog' },
    { id: 'archives',  href: 'archives.html',  label: 'Archives' },
  ],

  init(pageId) {
    this._pageId  = pageId;
    this._isAdmin = pageId === 'backoffice';
    this._inject();
    this._initHamburger();
  },

  _inject() {
    // Supprimer l'ancien si présent
    document.querySelector('.site-header')?.remove();

    const isAdmin   = this._isAdmin;
    const pageId    = this._pageId;
    const navLinks  = isAdmin ? this._navAdmin : this._navPublic;

    const logo = isAdmin
      ? `<span class="header-title"><span class="header-title-icon">⬡</span>Command Post <span class="backoffice-badge">⚙ Admin</span></span>`
      : `<a href="index.html" class="header-title"><span class="header-title-icon">⬡</span>Command Post</a>`;

    const links = navLinks.map(l =>
      `<a href="${l.href}"${l.id === pageId ? ' class="active"' : ''}>${l.label}</a>`
    ).join('');

    const rightBtn = isAdmin
      ? `<a href="#" onclick="typeof BO!=='undefined'&&BO.logout()" style="color:var(--p-critical);border-color:rgba(255,82,82,0.2);">Déconnexion</a>`
      : `<a href="login.html" class="btn-backoffice">⚙ Back-office</a>`;

    const header = document.createElement('header');
    header.className = 'site-header';
    header.innerHTML = `${logo}<nav class="header-nav" id="mainNav">${links}${rightBtn}</nav>`;

    // Insérer au tout début du body
    document.body.insertBefore(header, document.body.firstChild);
  },

  _initHamburger() {
    const nav = document.getElementById('mainNav');
    if (!nav) return;

    const btn = document.createElement('button');
    btn.className = 'nav-hamburger';
    btn.setAttribute('aria-label', 'Menu');
    btn.innerHTML = '☰';

    btn.addEventListener('click', e => {
      e.stopPropagation();
      const open = nav.classList.toggle('nav-open');
      btn.innerHTML = open ? '✕' : '☰';
    });

    document.querySelector('.site-header').insertBefore(btn, nav);

    document.addEventListener('click', () => {
      nav.classList.remove('nav-open');
      btn.innerHTML = '☰';
    });
  }
};
