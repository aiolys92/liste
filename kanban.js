// ============================================
// KANBAN — vue kanban partagée
// Partagé entre Front et BO
// ============================================
const Kanban = {

  _ctx: null,
  _prefix: null,

  setup(ctx, prefix) {
    this._ctx    = ctx;
    this._prefix = prefix;
  },

  render() {
    const ctx      = this._ctx;
    const filtered = ctx.getFiltered ? ctx.getFiltered() : ctx.bugs;
    const board    = document.getElementById('panelKanban');
    if (!board) return;

    const categories = ctx.config?.categories || [...new Set(filtered.map(b=>b.category))];
    if (!filtered.length) {
      board.innerHTML = '<div class="empty-state"><span class="empty-icon">⊘</span><p>Aucune mission.</p></div>';
      return;
    }

    board.innerHTML = '<div class="kanban-board">' +
      categories.map(cat => {
        const bugs    = filtered.filter(b => b.category === cat);
        if (!bugs.length) return '';
        const critical = bugs.filter(b => b.priority === 'Critique').length;
        const critBadge = critical ? `<span style="background:rgba(255,82,82,0.15);color:#ff5252;font-size:10px;padding:2px 7px;border-radius:10px;font-family:'DM Mono',monospace;">${critical} crit.</span>` : '';
        return `<div class="kanban-col view-panel">
          <div class="kanban-col-header">
            <div class="kanban-col-title-row">
              <span class="badge badge-cat-${toSlug(cat)} kanban-col-badge"><span class="badge-dot"></span>${esc(cat)}</span>
              ${critBadge}
            </div>
            <span class="kanban-col-count">${bugs.length}</span>
          </div>
          <div class="kanban-cards">
            ${bugs.map(b => this.renderCard(b)).join('')}
          </div>
        </div>`;
      }).join('') +
    '</div>';
  },

  renderCard(b) {
    const ctx    = this._ctx;
    const prefix = this._prefix;
    const ts     = toSlug;
    const member = (ctx.members||[]).find(m => m.name === b.assignee);
    const avatarHtml = member
      ? `<span class="avatar" style="background:${member.color};width:20px;height:20px;font-size:9px;flex-shrink:0;" title="${esc(member.name)}">${esc(member.initials)}</span>`
      : '';
    const dueHtml    = renderDueDate(b.due_date, b.state);
    const blocksHtml = b.blocks?.length ? `<span class="kanban-card-blocks">🔗 ${b.blocks.length}</span>` : '';
    const versionHtml= b.target_version ? `<span class="kanban-card-version">v${esc(b.target_version)}</span>` : '';
    const refHtml    = b.ref_url
      ? `<a class="kanban-card-link" href="${esc(b.ref_url)}" target="_blank" onclick="event.stopPropagation()" title="Lien de référence">🔗 Ref</a>` : '';
    const clientHtml = clientBadge(b.client_id, ctx.clients);
    const startHtml  = b.start_date ? `<span style="font-size:10px;color:var(--text-faint);">▶ ${fmtDate(b.start_date)}</span>` : '';

    return `<div class="kanban-card kanban-card-prio-${ts(b.priority)}"
      onclick="${prefix}.openDetail('${esc(b.id)}')"
      style="transition:transform 0.15s,box-shadow 0.15s;">

      <div class="kanban-card-top">
        <div style="display:flex;flex-direction:column;gap:2px;min-width:0;">
          <span class="kanban-card-type">${esc(b.type)}</span>
          <span class="kanban-card-id" onclick="event.stopPropagation();copyId('${esc(b.id)}',this)" title="Copier l'ID" style="cursor:pointer;">${esc(b.id)}</span>
        </div>
        <span class="badge badge-prio-${ts(b.priority)} kanban-card-prio-badge">${esc(b.priority)}</span>
      </div>

      <div class="kanban-card-title">${esc(b.title)}</div>
      <div class="kanban-card-desc">${esc(b.description)}</div>

      <div class="kanban-card-footer" style="margin-top:8px;">
        <span class="badge badge-state-${ts(b.state)} kanban-card-state">${esc(b.state)}</span>
        <div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;">
          ${avatarHtml}
          ${startHtml}
          ${dueHtml}
        </div>
      </div>

      <div class="kanban-card-meta">
        ${clientHtml}
        ${versionHtml}
        ${blocksHtml}
        ${refHtml}
        <button class="comments-btn" style="font-size:11px;padding:2px 6px;margin-left:auto;"
          onclick="event.stopPropagation();Comments.open('${esc(b.id)}')">💬</button>
      </div>
    </div>`;
  }
};
