// ============================================
// DETAIL — modale de détail mission
// Partagé entre Front et BO
// ============================================
const Detail = {

  _ctx: null,

  setup(ctx) { this._ctx = ctx; },

  async open(id) {
    const ctx = this._ctx;
    const bugs = ctx._tlBugs || ctx.bugs || [];
    let bug = bugs.find(b => b.id === id);

    // Si pas trouvé dans le cache local, chercher via DB
    if (!bug) {
      try {
        const res = await DB.fetchBugs();
        bug = res.find(b => b.id === id);
      } catch(e) {}
    }
    if (!bug) return;

    // Charger les clients si absent
    if (!ctx.clients?.length) {
      try { ctx.clients = await DB.fetchClients(); } catch(e) {}
    }

    const ts = toSlug;
    const member = (ctx.members||[]).find(m => m.name === bug.assignee);
    const avatarHtml = member
      ? `<span class="avatar" style="background:${member.color};width:22px;height:22px;font-size:9px;">${esc(member.initials)}</span> ${esc(member.name)}`
      : '<span style="color:var(--text-faint)">Non assigné</span>';

    const dueDateHtml = renderDueDate(bug.due_date, bug.state);
    const clientBadgeHtml = clientBadge(bug.client_id, ctx.clients);

    const blocksHtml = bug.blocks?.length
      ? bug.blocks.map(bid => {
          const b2 = bugs.find(x => x.id === bid);
          return `<span class="block-tag">${esc(bid)}${b2 ? ' — ' + esc(b2.title.slice(0,30)) : ''}</span>`;
        }).join('')
      : '<span style="color:var(--text-faint)">Aucune</span>';

    const isAdmin = typeof BO !== 'undefined' && ctx === BO;
    const prefix  = isAdmin ? 'BO' : 'Front';

    document.getElementById('detailModal').innerHTML = `
      <div class="modal detail-modal">
        <div class="detail-header-band">
          <div class="detail-id-row">
            <span class="bug-id" onclick="event.stopPropagation();copyId('${esc(bug.id)}',this)" title="Copier">${esc(bug.id)}</span>
            <span class="badge badge-type-${ts(bug.type)}">${esc(bug.type)}</span>
            <span class="badge badge-cat-${ts(bug.category)}">${esc(bug.category)}</span>
            ${clientBadgeHtml}
          </div>
          <div class="detail-title">${esc(bug.title)}</div>
          <div class="detail-badges">
            <span class="badge badge-prio-${ts(bug.priority)}"><span class="badge-dot"></span>${esc(bug.priority)}</span>
            <span class="badge badge-state-${ts(bug.state)}"><span class="badge-dot"></span>${esc(bug.state)}</span>
          </div>
        </div>
        <div class="detail-body">
          <div>
            <div class="detail-section-label">Description</div>
            <div class="detail-description">${esc(bug.description)}</div>
          </div>
          <div class="detail-grid">
            <div class="detail-field">
              <div class="detail-section-label">Assigné à</div>
              <div class="detail-field-value">${avatarHtml}</div>
            </div>
            <div class="detail-field">
              <div class="detail-section-label">Client</div>
              <div class="detail-field-value">${clientBadgeHtml || '<span style="color:var(--text-faint)">—</span>'}</div>
            </div>
            <div class="detail-field">
              <div class="detail-section-label">Date de début</div>
              <div class="detail-field-value">${bug.start_date ? fmtDate(bug.start_date) : '<span style="color:var(--text-faint)">—</span>'}</div>
            </div>
            <div class="detail-field">
              <div class="detail-section-label">Échéance</div>
              <div class="detail-field-value">${dueDateHtml}</div>
            </div>
            <div class="detail-field">
              <div class="detail-section-label">Priorité</div>
              <div class="detail-field-value"><span class="badge badge-prio-${ts(bug.priority)}"><span class="badge-dot"></span>${esc(bug.priority)}</span></div>
            </div>
            <div class="detail-field">
              <div class="detail-section-label">Date de création</div>
              <div class="detail-field-value">${fmtDate(bug.date)}</div>
            </div>
          </div>
          <div>
            <div class="detail-section-label">Missions bloquées</div>
            <div class="detail-blocks">${blocksHtml}</div>
          </div>
          ${bug.ref_url ? `<div>
            <div class="detail-section-label">Lien de référence</div>
            <a href="${esc(bug.ref_url)}" target="_blank" onclick="event.stopPropagation()"
              style="font-size:13px;color:var(--blue-bright);word-break:break-all;">${esc(bug.ref_url)}</a>
          </div>` : ''}
          ${bug.target_version ? `<div>
            <div class="detail-section-label">Version cible</div>
            <span class="version-badge" style="margin-top:4px;display:inline-flex;">${esc(bug.target_version)}</span>
          </div>` : ''}
        </div>
        <div class="detail-footer">
          <button class="btn btn-secondary" onclick="Detail.close()">Fermer</button>
          <button class="btn btn-primary" onclick="Detail.close();Comments.open('${esc(bug.id)}')">💬 Commentaires</button>
          ${isAdmin ? `<button class="btn btn-primary" onclick="Detail.close();BO.openActionModal('${esc(bug.id)}')">⚡ Actions</button>` : ''}
        </div>
      </div>`;

    document.getElementById('detailOverlay').classList.remove('hidden');
  },

  close() {
    document.getElementById('detailOverlay').classList.add('hidden');
  }
};
