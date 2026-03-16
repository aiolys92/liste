// ============================================
// COMMENTS — modale commentaires
// Partagé entre Front et BO
// ============================================
const Comments = {

  _ctx: null,
  _isAdmin: false,

  setup(ctx, isAdmin = false) {
    this._ctx     = ctx;
    this._isAdmin = isAdmin;
  },

  async open(bugId) {
    const ctx = this._ctx;
    const bugs = ctx._tlBugs || ctx.bugs || [];
    const bug  = bugs.find(b => b.id === bugId);

    document.getElementById('commentsModalTitle').textContent = bug ? bug.title : bugId;
    document.getElementById('commentsBugId').textContent = bugId;
    document.getElementById('commentsList').innerHTML = '<div class="comments-loading">Chargement…</div>';
    document.getElementById('commentsModal').classList.remove('hidden');

    // Afficher/masquer le formulaire selon admin
    const form = document.getElementById('commentForm');
    if (form) form.style.display = this._isAdmin ? '' : '';

    try {
      const comments = await DB.fetchComments(bugId);
      this.render(comments);
    } catch(e) {
      document.getElementById('commentsList').innerHTML = '<div class="comments-error">Erreur de chargement.</div>';
    }
  },

  render(comments) {
    const el = document.getElementById('commentsList');
    if (!el) return;
    if (!comments.length) {
      el.innerHTML = '<div class="comments-empty">Aucun commentaire. Soyez le premier !</div>';
      return;
    }
    el.innerHTML = comments.map(c => `
      <div class="comment-item">
        <div class="comment-header">
          <span class="comment-author">${esc(c.author)}</span>
          <span class="comment-date">${fmtDatetime(c.created_at)}</span>
        </div>
        <div class="comment-content">${esc(c.content)}</div>
      </div>`).join('');
  },

  close() {
    document.getElementById('commentsModal').classList.add('hidden');
  },

  async submit() {
    const bugId  = document.getElementById('commentsBugId').textContent;
    const author = document.getElementById('commentAuthor').value.trim();
    const content= document.getElementById('commentContent').value.trim();
    if (!author || !content) { alert('Merci de remplir votre nom et commentaire.'); return; }
    const btn = document.getElementById('btnSubmitComment');
    btn.textContent = 'Envoi…'; btn.disabled = true;
    try {
      await DB.insertComment(bugId, author, content);
      document.getElementById('commentAuthor').value  = '';
      document.getElementById('commentContent').value = '';
      const comments = await DB.fetchComments(bugId);
      this.render(comments);
    } catch(e) { alert('Erreur : ' + e.message); }
    finally { btn.textContent = 'Publier'; btn.disabled = false; }
  }
};
