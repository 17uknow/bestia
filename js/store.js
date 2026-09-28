// Datos locales + sincronización con Dropbox (OAuth PKCE, sin servidor).
// Cada registro (día, sesión, medida, alimento, rutina) lleva `u` (timestamp de última edición);
// al sincronizar se fusiona registro a registro y gana el más reciente, así dos dispositivos no se pisan.
(function () {
  const LS_DATA = 'fit.v1', LS_TOK = 'fit.dbx', LS_PKCE = 'fit.pkce', LS_KEY = 'fit.appkey', LS_SYNC = 'fit.lastsync';
  const DEFAULT_KEY = 'dtd99iaszc7m27m'; // misma app de Dropbox que el Calendario
  const DBX_FILE = '/fitness.json';
  const PHOTO_DIR = '/fitness-fotos';
  const COLLS = ['days', 'sessions', 'measures', 'foods', 'routines'];

  const ls = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} },
  };

  function empty() {
    return {
      v: 1,
      settings: { u: 0, startDate: null, baseWeight: null, kcal: 2700, prot: 180, carb: 330, fat: 78, water: 2.5, sleep: 7, place: 'gym', deloads: [] },
      days: {}, sessions: {}, measures: {}, foods: {}, routines: {},
    };
  }

  function normalize(d) {
    const e = empty();
    if (!d || typeof d !== 'object') return e;
    d.settings = Object.assign(e.settings, d.settings || {});
    for (const c of COLLS) if (!d[c] || typeof d[c] !== 'object') d[c] = {};
    d.v = 1;
    return d;
  }

  function merge(a, b) {
    a = normalize(a); b = normalize(b);
    const out = empty();
    out.settings = (b.settings.u || 0) > (a.settings.u || 0) ? b.settings : a.settings;
    for (const c of COLLS) {
      const keys = new Set([...Object.keys(a[c]), ...Object.keys(b[c])]);
      for (const k of keys) {
        const x = a[c][k], y = b[c][k];
        out[c][k] = !x ? y : !y ? x : ((y.u || 0) > (x.u || 0) ? y : x);
      }
    }
    return out;
  }

  const Store = {
    data: normalize(JSON.parse(ls.get(LS_DATA) || 'null')),
    listeners: [],
    syncState: 'idle', // idle | syncing | ok | error | off
    lastSync: +ls.get(LS_SYNC) || 0,
    lastError: '',
    onChange(fn) { this.listeners.push(fn); },
    emit() { this.listeners.forEach(f => f()); },
    persist() { ls.set(LS_DATA, JSON.stringify(this.data)); },
    // Marca un registro como editado y guarda
    touch(coll, key) {
      if (coll === 'settings') this.data.settings.u = Date.now();
      else if (this.data[coll][key]) this.data[coll][key].u = Date.now();
      this.persist();
      this.scheduleSync();
    },
    remove(coll, key) {
      this.data[coll][key] = { del: true, u: Date.now() };
      this.persist();
      this.scheduleSync();
    },
    live(coll) {
      const o = {};
      for (const [k, v] of Object.entries(this.data[coll])) if (v && !v.del) o[k] = v;
      return o;
    },
    replaceAll(d) { this.data = normalize(d); this.persist(); this.scheduleSync(); this.emit(); },

    // ---------- Dropbox ----------
    appKey() { return ls.get(LS_KEY) || DEFAULT_KEY; },
    setAppKey(k) { if (k) ls.set(LS_KEY, k.trim()); else ls.del(LS_KEY); },
    tokens() { try { return JSON.parse(ls.get(LS_TOK) || 'null'); } catch (e) { return null; } },
    connected() { const t = this.tokens(); return !!(t && t.refresh_token); },
    redirect() { return location.origin + location.pathname; },

    async connect() {
      const b64url = s => btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      const verifier = b64url(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));
      const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
      const challenge = b64url(String.fromCharCode(...new Uint8Array(hash)));
      ls.set(LS_PKCE, verifier);
      location.href = `https://www.dropbox.com/oauth2/authorize?client_id=${this.appKey()}&response_type=code&redirect_uri=${encodeURIComponent(this.redirect())}&code_challenge=${challenge}&code_challenge_method=S256&token_access_type=offline`;
    },

    async handleRedirect() {
      const q = new URLSearchParams(location.search);
      const code = q.get('code');
      if (!code) return false;
      history.replaceState(null, '', location.pathname + location.hash);
      const verifier = ls.get(LS_PKCE);
      if (!verifier) return false;
      const res = await fetch('https://api.dropboxapi.com/oauth2/token', {
        method: 'POST',
        body: new URLSearchParams({ code, grant_type: 'authorization_code', client_id: this.appKey(), redirect_uri: this.redirect(), code_verifier: verifier }),
      });
      const d = await res.json();
      ls.del(LS_PKCE);
      if (d.access_token) {
        ls.set(LS_TOK, JSON.stringify({ access_token: d.access_token, refresh_token: d.refresh_token, exp: Date.now() + (d.expires_in || 14000) * 1000 }));
        return true;
      }
      this.lastError = d.error_description || d.error || 'No se pudo conectar';
      return false;
    },

    disconnect() { ls.del(LS_TOK); this.syncState = 'off'; this.emit(); },

    async accessToken(force) {
      const t = this.tokens();
      if (!t) throw new Error('Dropbox no conectado');
      if (!force && t.access_token && t.exp && Date.now() < t.exp - 60000) return t.access_token;
      const res = await fetch('https://api.dropboxapi.com/oauth2/token', {
        method: 'POST',
        body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: t.refresh_token, client_id: this.appKey() }),
      });
      const d = await res.json();
      if (!d.access_token) {
        if (d.error === 'invalid_grant') this.disconnect();
        throw new Error(d.error_description || 'Token caducado');
      }
      t.access_token = d.access_token;
      t.exp = Date.now() + (d.expires_in || 14000) * 1000;
      ls.set(LS_TOK, JSON.stringify(t));
      return t.access_token;
    },

    async dbx(url, opts, retry = true) {
      const tok = await this.accessToken();
      opts = opts || {};
      opts.headers = Object.assign({}, opts.headers, { Authorization: 'Bearer ' + tok });
      const res = await fetch(url, opts);
      if (res.status === 401 && retry) { await this.accessToken(true); return this.dbx(url, opts, false); }
      return res;
    },

    async download(path) {
      const res = await this.dbx('https://api.dropboxapi.com/2/files/get_temporary_link', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path }),
      });
      if (res.status === 409) return null; // no existe todavía
      if (!res.ok) throw new Error('Dropbox ' + res.status);
      const { link } = await res.json();
      return link;
    },

    async upload(path, body, contentType) {
      const res = await this.dbx('https://content.dropboxapi.com/2/files/upload', {
        method: 'POST',
        headers: { 'Content-Type': contentType || 'application/octet-stream', 'Dropbox-API-Arg': JSON.stringify({ path, mode: 'overwrite', mute: true }) },
        body,
      });
      if (!res.ok) throw new Error('Subida fallida ' + res.status);
      return res.json();
    },

    _timer: null, _running: null,
    scheduleSync() {
      if (!this.connected()) return;
      clearTimeout(this._timer);
      this._timer = setTimeout(() => this.sync(), 1500);
    },

    // Descarga, fusiona y sube. Serializado para que no se solapen dos sincronizaciones.
    async sync() {
      if (!this.connected()) { this.syncState = 'off'; this.emit(); return; }
      if (this._running) { this._again = true; return this._running; }
      this.syncState = 'syncing'; this.emit();
      this._running = (async () => {
        try {
          const link = await this.download(DBX_FILE);
          let remote = null;
          if (link) remote = await (await fetch(link)).json();
          const before = JSON.stringify(this.data);
          const merged = remote ? merge(this.data, remote) : this.data;
          const mergedStr = JSON.stringify(merged);
          if (mergedStr !== before) { this.data = merged; this.persist(); }
          if (!remote || mergedStr !== JSON.stringify(normalize(remote))) {
            await this.upload(DBX_FILE, mergedStr, 'application/octet-stream');
          }
          this.syncState = 'ok';
          this.lastSync = Date.now();
          ls.set(LS_SYNC, String(this.lastSync));
          this.lastError = '';
          if (mergedStr !== before) this.emit();
        } catch (e) {
          this.syncState = 'error';
          this.lastError = e.message || String(e);
        } finally {
          this._running = null;
          this.emit();
          if (this._again) { this._again = false; this.sync(); }
        }
      })();
      return this._running;
    },

    async uploadPhoto(date, blob) {
      const path = `${PHOTO_DIR}/${date}.jpg`;
      await this.upload(path, blob, 'application/octet-stream');
      return path;
    },
    photoCache: {},
    async photoLink(path) {
      if (this.photoCache[path] && this.photoCache[path].t > Date.now() - 3.5 * 3600e3) return this.photoCache[path].l;
      const l = await this.download(path);
      this.photoCache[path] = { l, t: Date.now() };
      return l;
    },
  };

  window.Store = Store;
  window.mergeData = merge;
})();
