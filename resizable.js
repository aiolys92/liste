// ============================================
// COLONNES REDIMENSIONNABLES
// À inclure sur index.html et backoffice.html
// ============================================

function initResizableColumns(tableSelector) {
  const table = document.querySelector(tableSelector);
  if (!table) return;

  // Attendre que le tableau soit rendu
  function setup() {
    const ths = table.querySelectorAll('thead th');
    if (!ths.length) return;

    // S'assurer que table-layout est fixed
    table.style.tableLayout = 'fixed';

    // Initialiser les largeurs depuis le colgroup ou les colonnes actuelles
    ths.forEach(th => {
      const w = th.offsetWidth;
      th.style.width = w + 'px';
    });

    // Ajouter le resizer sur chaque th sauf le dernier
    ths.forEach((th, i) => {
      // Pas de resizer sur la dernière colonne
      if (i === ths.length - 1) return;
      // Eviter les doublons
      if (th.querySelector('.col-resizer')) return;

      const resizer = document.createElement('div');
      resizer.className = 'col-resizer';
      resizer.addEventListener('mousedown', (e) => startResize(e, th, table));
      resizer.addEventListener('click', e => e.stopPropagation());
      th.appendChild(resizer);
    });
  }

  let startX, startW, currentTh;

  function startResize(e, th, tbl) {
    e.preventDefault();
    e.stopPropagation();
    startX  = e.clientX;
    startW  = th.offsetWidth;
    currentTh = th;

    tbl.classList.add('resizing');
    th.querySelector('.col-resizer').classList.add('resizing');

    document.addEventListener('mousemove', onResize);
    document.addEventListener('mouseup', stopResize);
  }

  function onResize(e) {
    if (!currentTh) return;
    const delta = e.clientX - startX;
    const newW  = Math.max(50, startW + delta);
    currentTh.style.width = newW + 'px';
  }

  function stopResize() {
    if (!currentTh) return;
    table.classList.remove('resizing');
    const resizer = currentTh.querySelector('.col-resizer');
    if (resizer) resizer.classList.remove('resizing');
    currentTh = null;
    document.removeEventListener('mousemove', onResize);
    document.removeEventListener('mouseup', stopResize);
  }

  // Observer pour re-init si le tbody est re-rendu (après chargement des données)
  const observer = new MutationObserver(() => {
    const ths = table.querySelectorAll('thead th');
    const hasResizers = [...ths].every(th => th.querySelector('.col-resizer') || th === ths[ths.length-1]);
    if (!hasResizers) setup();
  });
  observer.observe(table, { childList: true, subtree: true });

  // Premier setup
  setup();
  // Retry après rendu initial
  setTimeout(setup, 300);
}

document.addEventListener('DOMContentLoaded', () => {
  initResizableColumns('.bugs-table');
});
