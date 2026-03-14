// ============================================
// SUPABASE REALTIME — notifications live
// ============================================
const Realtime = {
  ws: null,
  callbacks: {},
  connected: false,
  _hb: null,

  // S'abonner à une table
  // onInsert/onUpdate/onDelete : fonctions callback
  subscribe(table, { onInsert, onUpdate, onDelete } = {}) {
    if (this.ws) return; // déjà connecté

    const url = `wss://pmrmeivebuvyynmehyhh.supabase.co/realtime/v1/websocket?apikey=sb_publishable_oS96m8VAdb2DcfUJby00fw_tpsBXlV-&vsn=1.0.0`;
    this.ws = new WebSocket(url);
    this.callbacks[table] = { onInsert, onUpdate, onDelete };

    this.ws.onopen = () => {
      this.connected = true;
      // Rejoindre le channel
      this.ws.send(JSON.stringify({
        topic: `realtime:public:${table}`,
        event: 'phx_join',
        payload: { config: { broadcast: { self: false }, presence: { key: '' }, postgres_changes: [
          { event: 'INSERT', schema: 'public', table },
          { event: 'UPDATE', schema: 'public', table },
          { event: 'DELETE', schema: 'public', table },
        ]}},
        ref: '1'
      }));
      // Heartbeat toutes les 25s
      this._hb = setInterval(() => {
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: '0' }));
        }
      }, 25000);
      this._showBanner('🔴 Live', 'Mises à jour en temps réel actives', '#40e0b0');
    };

    this.ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.event !== 'postgres_changes') return;
        const { eventType, new: newRecord, old: oldRecord } = msg.payload?.data || {};
        const cb = this.callbacks[table];
        if (!cb) return;
        if (eventType === 'INSERT' && cb.onInsert) cb.onInsert(newRecord);
        if (eventType === 'UPDATE' && cb.onUpdate) cb.onUpdate(newRecord, oldRecord);
        if (eventType === 'DELETE' && cb.onDelete) cb.onDelete(oldRecord);
      } catch(err) {}
    };

    this.ws.onclose = () => {
      this.connected = false;
      clearInterval(this._hb);
      this.ws = null;
      // Reconnexion auto après 5s
      setTimeout(() => this.subscribe(table, this.callbacks[table] || {}), 5000);
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  },

  unsubscribe() {
    clearInterval(this._hb);
    this.ws?.close();
    this.ws = null;
    this.connected = false;
  },

  // Bannière discrète en haut à gauche
  _showBanner(icon, msg, color) {
    let el = document.getElementById('rt-banner');
    if (!el) {
      el = document.createElement('div');
      el.id = 'rt-banner';
      el.style.cssText = `
        position:fixed; bottom:20px; left:20px; z-index:9999;
        display:flex; align-items:center; gap:7px;
        background:var(--bg-overlay); border:1px solid var(--border-strong);
        border-radius:20px; padding:6px 14px 6px 10px;
        font-family:'DM Sans',sans-serif; font-size:12px; font-weight:500;
        box-shadow:var(--shadow-md); transition:opacity 0.4s;
        color:var(--text-muted);
      `;
      document.body.appendChild(el);
    }
    const dot = `<span style="width:6px;height:6px;border-radius:50%;background:${color};display:inline-block;flex-shrink:0;"></span>`;
    el.innerHTML = dot + msg;
    el.style.opacity = '1';
    setTimeout(() => { el.style.opacity = '0'; }, 3000);
  },

  // Toast de notification quand une mission est modifiée
  notify(msg, type = 'info') {
    const colors = { info: '#50b8ff', success: '#70d060', warning: '#ffd040', critical: '#ff5252' };
    this._showBanner('', msg, colors[type] || colors.info);
  }
};
