/* OrderEase — supplier ordering for the restaurants.  Plain JavaScript, no build step. */
'use strict';

const APP_NAME = 'OrderEase';
const state = { boot: null, products: {}, ob: null, lastHash: '' };
const COLORS = ['#282828', '#5A4636', '#D7A46E', '#E8902A', '#C2362B', '#B0437A', '#6D5BA8', '#1F5FA8', '#2B8A9A', '#3F7D63', '#2E8B57', '#8A6D3B'];

// ---------- small helpers ----------
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cur = () => (state.boot && state.boot.settings.currency) || 'SAR';
const fmtNum = (v, d = 2) => Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtQty = (v) => Number(v || 0).toLocaleString('en-US', { maximumFractionDigits: 3 });
const money = (v) => (v ? `${cur()} ${fmtNum(v)}` : '—');
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_L = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const fmtDate = (iso) => { if (!iso) return '—'; const [y, m, d] = iso.split('-'); return `${Number(d)} ${MONTHS[Number(m) - 1]} ${y}`; };
const fmtMonth = (ym) => { const [y, m] = ym.split('-'); return `${MONTHS[Number(m) - 1]} ${y}`; };
const fmtTs = (ts) => { if (!ts) return '—'; const d = new Date(ts * 1000); return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const addDays = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const lastDay = (ym) => { const [y, m] = ym.split('-').map(Number); return `${ym}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`; };
const initials = (s) => String(s || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
const today = () => state.boot ? state.boot.today : new Date().toISOString().slice(0, 10);
const isAdmin = () => state.boot && state.boot.user.role === 'admin';
const restById = (id) => state.boot.restaurants.find((r) => r.id === Number(id));
const supById = (id) => state.boot.suppliers.find((s) => s.id === Number(id));
const activeRest = () => state.boot.restaurants.filter((r) => r.active);
const activeSup = () => state.boot.suppliers.filter((s) => s.active);
const safeName = (s) => String(s).replace(/[\\/:*?"<>|]+/g, '-').trim();

const ICON = {
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
  sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
  box: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
  truck: '<path d="M3 6h11v10H3zM14 9h4l3 3v4h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17.5" cy="17.5" r="1.8"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  out: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>',
  pdf: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M9 14h6M9 17h4"/>',
  print: '<path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v7H6z"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4z"/>',
  again: '<path d="M3 12a9 9 0 0 1 15.5-6.3L21 8M21 3v5h-5M21 12a9 9 0 0 1-15.5 6.3L3 16M3 21v-5h5"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 6-10 7L2 6"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  word: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="m8 12 1.5 5 2.5-4 2.5 4 1.5-5"/>',
  excel: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="m9 12 6 6M15 12l-6 6"/>',
  wa: '<path d="M3 21l1.6-4.7A8.5 8.5 0 1 1 8 19.6z"/><path d="M9 9.5c.3 2 2.5 4.6 5 5.2l1.2-1.2 1.8.8c-.1 1-1 1.8-2 1.8-3.6 0-7-3.5-7-7 0-1 .8-1.9 1.8-2l.8 1.8z"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>',
  more: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
  cart: '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.6 12.4a2 2 0 0 0 2 1.6h8.7a2 2 0 0 0 2-1.6L22 7H6"/>',
  note: '<path d="M4 4h16v12l-4 4H4z"/><path d="M16 20v-4h4M8 9h8M8 13h5"/>',
  star: '<path d="m12 3 2.8 5.8 6.2.9-4.5 4.4 1 6.2L12 17.4l-5.5 2.9 1-6.2L3 9.7l6.2-.9z"/>',
  alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01"/>',
};
const ic = (n, cls = 'ico') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[n] || ''}</svg>`;
const markHtml = () => '<div class="mark">Oe<b>.</b></div>';

function toast(msg, bad = false) {
  const t = $('#toast');
  t.textContent = msg; t.className = 'show' + (bad ? ' bad' : '');
  clearTimeout(toast._t); toast._t = setTimeout(() => { t.className = ''; }, bad ? 4200 : 2600);
}

async function api(path, opts = {}) {
  const res = await fetch('/api/' + path, {
    method: opts.method || 'GET',
    headers: opts.body ? { 'content-type': 'application/json' } : {},
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    credentials: 'same-origin',
  });
  let data = {};
  try { data = await res.json(); } catch { data = {}; }
  if (res.status === 401 && path !== 'login' && path !== 'status') {
    state.boot = null; showLogin('Your session has ended. Please log in again.');
    throw new Error('Session ended');
  }
  if (!res.ok) throw new Error(data.error || 'Something went wrong (' + res.status + ')');
  return data;
}
async function act(btn, fn) {
  if (btn) { if (btn.disabled) return; btn.disabled = true; }
  try { await fn(); } catch (e) { if (e.message !== 'Session ended') toast(e.message, true); } finally { if (btn && btn.isConnected) btn.disabled = false; }
}

// ---------- modal ----------
function modal({ title, body, foot = '', wide = false, onOpen }) {
  const root = $('#modal-root');
  root.innerHTML = `<div class="modal-bg"><div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="modal-head"><h3>${esc(title)}</h3><button class="x" data-close aria-label="Close">×</button></div>
    <div class="modal-body">${body}</div>${foot ? `<div class="modal-foot">${foot}</div>` : ''}</div></div>`;
  const bg = $('.modal-bg', root);
  bg.addEventListener('mousedown', (e) => { if (e.target === bg) closeModal(); });
  $$('[data-close]', root).forEach((b) => b.addEventListener('click', closeModal));
  const first = $('input, select, textarea', root); if (first) setTimeout(() => first.focus(), 30);
  if (onOpen) onOpen($('.modal', root));
  return $('.modal', root);
}
function closeModal() { $('#modal-root').innerHTML = ''; }
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && $('#modal-root').innerHTML) closeModal(); });
function confirmBox(title, text, okLabel = 'Yes', danger = false) {
  return new Promise((resolve) => {
    const m = modal({ title, body: `<p style="margin:0">${text}</p>`, foot: `<button class="btn ghost" data-close>Cancel</button><button class="btn ${danger ? 'danger' : ''}" id="cf-ok">${esc(okLabel)}</button>` });
    $('#cf-ok', m).onclick = () => { closeModal(); resolve(true); };
    $$('[data-close]', m).forEach((b) => b.addEventListener('click', () => resolve(false)));
  });
}

// ---------- start ----------
async function start() {
  try {
    const st = await api('status');
    if (st.setup_needed) return showSetup();
    if (!st.user) return showLogin();
    await loadBoot();
    route();
  } catch (e) {
    $('#app').innerHTML = `<div class="boot"><div class="card card-pad" style="max-width:460px"><h3>Cannot open the website</h3><p class="muted">${esc(e.message)}</p><button class="btn" onclick="location.reload()">Try again</button></div></div>`;
  }
}
async function loadBoot() {
  state.boot = await api('bootstrap');
  state.products = {};
  idle.start(state.boot.user.idle || 1800);
  live.build = null; checkChanges(); refreshBell();
}
window.addEventListener('hashchange', () => { if (state.boot) route(); });

// ---------- auth screens ----------
function authShell(inner) {
  $('#app').innerHTML = `<div class="auth">
    <section class="auth-brand">
      ${spinLogo()}
      ${desertScene()}
      <div class="brand-row auth-logo">${brandBadge()}<div><div class="wordmark wm-anim">${'OrderEase'.split('').map((c, i) => `<i style="--i:${i}">${c}</i>`).join('')}<b class="wm-dot">.</b></div>
        <div class="tagline tag-rot"><span class="tr-text">every order, one tap away</span><span class="tr-caret"></span></div></div></div>
      <div>
        <h1>Supplier orders for all four restaurants — <em class="typer">without typing codes.</em></h1>
        <p>Search the catalog, tap the quantity, and send the order to Gulfwest, Bidfood or any supplier with every code already filled in.</p>
        <div class="auth-steps">
          <div><span>01</span>Pick the restaurant and the supplier</div>
          <div><span>02</span>Search and tap items — codes come with them</div>
          <div><span>03</span>Send on WhatsApp or as a PDF purchase order</div>
        </div>
      </div>
      <div class="tagline">Daily Edition · The Plane · Bupa</div>
      <div class="auth-road" aria-hidden="true"><i class="road-line"></i><span class="auth-truck">${TRUCK}</span></div>
    </section>
    <section class="auth-form">
      <div class="af-float" aria-hidden="true">${FLOATERS}</div>
      <div class="auth-card">${welcomeTruck()}${inner}</div></section>
  </div>`;
  rotateTagline(); parkTruck(); paintDesert();
  $$('.pw-wrap button').forEach((b) => b.addEventListener('click', () => {
    const i = b.previousElementSibling; i.type = i.type === 'password' ? 'text' : 'password'; b.textContent = i.type === 'password' ? 'Show' : 'Hide';
  }));
}
function showLogin(msg) {
  idle.stop(); closeModal();
  authShell(`<h2>Welcome back</h2><p class="sub">Log in to place and track supplier orders.</p>
    ${msg ? `<div class="form-error" style="background:var(--warn-bg);color:var(--warn)">${esc(msg)}</div>` : ''}
    <form id="lf" autocomplete="on">
      <div id="lf-err"></div>
      <div class="field"><label for="lu">Username or full name</label><input class="input" id="lu" name="username" autocomplete="username" required /></div>
      <div class="field"><label for="lp">Password</label><div class="pw-wrap"><input class="input" id="lp" name="password" type="password" autocomplete="current-password" required /><button type="button">Show</button></div></div>
      <button class="btn block" type="submit">${ic('lock')} Log in</button>
    </form>
    <div class="auth-foot">${ic('lock')} Locks for 10 minutes after 5 wrong passwords · auto log-out when idle</div>`);
  $('#lu').focus();
  $('#lf').onsubmit = (e) => {
    e.preventDefault();
    act($('#lf button[type=submit]'), async () => {
      try {
        await api('login', { method: 'POST', body: { username: $('#lu').value, password: $('#lp').value } });
        await truckLeaves();
        await loadBoot();
        if (!location.hash || location.hash === '#') location.hash = '#/dashboard';
        route();
      } catch (er) { $('#lf-err').innerHTML = `<div class="form-error">${esc(er.message)}</div>`; shake(); }
    });
  };
  $$('#lf .input').forEach((i) => i.addEventListener('input', () => { const t = $('.wt-truck'); if (t) { t.classList.remove('honk'); void t.offsetWidth; t.classList.add('honk'); } }));
}
function showSetup() {
  authShell(`<h2>First-time setup</h2><p class="sub">Create the Admin account. You can add staff accounts afterwards in Settings.</p>
    <form id="sf"><div id="sf-err"></div>
      <div class="field"><label>Full name</label><input class="input" id="sn" placeholder="e.g. Michael" required /></div>
      <div class="field"><label>Username</label><input class="input" id="su" placeholder="e.g. michael" autocomplete="username" required /></div>
      <div class="field"><label>Password (6+ characters)</label><div class="pw-wrap"><input class="input" id="sp" type="password" autocomplete="new-password" required /><button type="button">Show</button></div></div>
      <button class="btn block" type="submit">Create Admin and open OrderEase</button>
    </form>`);
  $('#sf').onsubmit = (e) => {
    e.preventDefault();
    act($('#sf button[type=submit]'), async () => {
      try {
        await api('setup', { method: 'POST', body: { name: $('#sn').value, username: $('#su').value, password: $('#sp').value } });
        await truckLeaves(); await loadBoot(); location.hash = '#/dashboard'; route();
      } catch (er) { $('#sf-err').innerHTML = `<div class="form-error">${esc(er.message)}</div>`; shake(); }
    });
  };
}


// ---------- login: desert with a camel rider (sky follows Jeddah time) ----------
const CAMEL = `<g class="camel">
  <g class="cm-leg back l1"><path d="M40 58 L38 72 L41 86"/><path d="M38 86h6"/></g>
  <g class="cm-leg front l1"><path d="M80 58 L82 72 L80 86"/><path d="M78 86h6"/></g>
  <g class="cm-bob">
    <path class="cm-body" d="M28 56 Q27 44 40 42 Q46 29 57 36 Q63 29 71 40 Q76 46 82 44 L89 31 Q92 24 99 25 L104 28 Q104 31 100 32 L96 33 L89 56 Q85 63 74 63 L40 63 Q30 63 28 56 Z"/>
    <path d="M28 52 q-6 4 -4 13"/><circle cx="99" cy="28" r=".9" class="cm-eye"/>
    <path class="cm-rug" d="M47 39 Q57 33 66 39 L64 47 Q56 44 49 47 Z"/>
    <path class="cm-tassel" d="M49 47 v5 M54 46 v5 M59 46 v5 M64 47 v5"/>
    <g class="cm-rider">
      <path class="cm-robe" d="M53 37 L51 20 Q55 16 59 20 L60 37 Z"/>
      <circle cx="55" cy="14" r="4.2" class="cm-head"/>
      <path class="cm-ghutra" d="M50.5 12 Q55 7 59.5 12 L60 16 L56 15 L48 23 Z"/>
      <path d="M58 24 Q74 26 98 29" class="cm-rein"/>
      <path d="M57 36 L63 46 L61 50"/>
    </g>
  </g>
  <g class="cm-leg back l2"><path d="M44 58 L45 72 L43 86"/><path d="M41 86h6"/></g>
  <g class="cm-leg front l2"><path d="M76 58 L74 72 L76 86"/><path d="M74 86h6"/></g>
</g>`;
function desertScene() {
  const stars = [[60, 22], [140, 48], [210, 16], [300, 38], [380, 14], [450, 44], [520, 20], [600, 36], [660, 12], [250, 70], [560, 66]]
    .map(([x, y], i) => `<circle class="ds-star" cx="${x}" cy="${y}" r="1.2" style="animation-delay:${(i * .37) % 3}s"/>`).join('');
  return `<div class="desert" aria-hidden="true"><svg class="dz-svg" viewBox="0 0 700 230" preserveAspectRatio="xMidYMax slice">
    <defs><linearGradient id="dz-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#D7A46E" stop-opacity="0"/><stop offset="1" stop-color="#D7A46E" stop-opacity=".22"/></linearGradient></defs>
    <rect class="dz-glow" width="700" height="230" fill="url(#dz-sky)"/>
    <g class="dz-stars">${stars}</g>
    <g class="dz-sun"><circle r="14" class="dz-sun-disc"/><circle r="22" class="dz-sun-ring"/></g>
    <g class="dz-moon"><path d="M7 -12a13 13 0 1 0 0 24a10 10 0 1 1 0 -24z"/></g>
    <path class="dz-bird b1" d="M0 0 q4 -4 8 0 q4 -4 8 0"/><path class="dz-bird b2" d="M0 0 q3 -3 6 0 q3 -3 6 0"/>
    <path class="dz-mtn far" d="M0 150 L60 112 L95 128 L150 86 L205 124 L250 104 L300 132 L360 92 L420 126 L470 100 L530 130 L590 96 L650 122 L700 108 L700 230 L0 230 Z"/>
    <path class="dz-mtn mid" d="M0 168 L80 136 L130 152 L190 124 L260 156 L330 138 L400 160 L480 132 L560 158 L630 140 L700 154 L700 230 L0 230 Z"/>
    <path class="dz-dune d1" d="M0 186 Q120 160 240 178 T480 172 T700 176 L700 230 L0 230 Z"/>
    <g class="dz-palms"><path d="M612 182c1-12 0-22-3-30"/><path d="M609 152c-8-5-16-3-21 2M609 152c-3-7-10-10-16-9M609 152c6-6 14-7 20-3M609 152c4-6 10-8 16-5"/>
      <path d="M632 184c-1-9 0-16 3-22"/><path d="M635 162c-6-3-12-2-16 2M635 162c5-4 11-4 15-1M635 162c-2-5-6-7-10-7"/></g>
    <g class="dz-walk"><g transform="translate(0 104) scale(1.06)">${CAMEL}</g></g>
    <path class="dz-dune d2" d="M0 204 Q160 186 330 200 T700 196 L700 230 L0 230 Z"/>
    <g class="dz-sand"><circle cx="40" cy="200" r="1"/><circle cx="160" cy="194" r="1.2"/><circle cx="300" cy="206" r=".9"/><circle cx="420" cy="198" r="1.1"/><circle cx="560" cy="204" r="1"/></g>
  </svg></div>`;
}
function paintDesert() {
  const svg = $('.dz-svg'); if (!svg) return;
  const { t } = jeddahNow();
  const arc = (p) => ({ x: 40 + p * 620, y: 150 - Math.sin(p * Math.PI) * 120 });
  const sun = arc(Math.min(1, Math.max(0, (t - 6) / 12.5)));
  const moon = arc(Math.min(1, Math.max(0, (t >= 18.5 ? t - 18.5 : t + 5.5) / 11.5)));
  $('.dz-sun', svg).setAttribute('transform', `translate(${sun.x} ${sun.y})`);
  $('.dz-moon', svg).setAttribute('transform', `translate(${moon.x} ${moon.y})`);
  svg.dataset.night = t < 5.75 || t >= 18.75 ? '1' : '0';
  svg.dataset.glow = (t >= 5.5 && t < 7.5) || (t >= 16.5 && t < 19.25) ? '1' : '0';
}

// ---------- login page decoration ----------
function brandBadge() {
  return `<span class="brand-badge" aria-hidden="true"><svg viewBox="0 0 100 100">
    <defs><path id="bb-c" d="M50 50m-38 0a38 38 0 1 1 76 0a38 38 0 1 1-76 0"/></defs>
    <circle cx="50" cy="50" r="49" fill="#F3F0EA"/>
    <g class="bb-ring"><text font-family="Space Mono, monospace" font-size="8.6" fill="#5A4636"><textPath href="#bb-c" textLength="236" lengthAdjust="spacing">ORDEREASE · ORDER · SEND · RECEIVE ·</textPath></text></g>
    <circle cx="50" cy="50" r="27" fill="#282828"/>
    <text x="47" y="57" text-anchor="middle" font-family="Space Mono, monospace" font-size="19" fill="#F3F0EA">Oe</text>
    <circle class="bb-dot" cx="66" cy="55" r="2.6" fill="#D7A46E"/></svg></span>`;
}
const TAGLINES = ['every order, one tap away', 'codes filled in for you', 'WhatsApp or PDF in one tap', 'four restaurants, one place', 'daily · monthly · yearly reports'];
let tagTimer = null;
function rotateTagline() {
  clearInterval(tagTimer);
  const el = $('.tr-text'); if (!el || calm()) return;
  let i = 0;
  const typeTo = async (txt) => {
    const box = $('.tr-text'); if (!box) return clearInterval(tagTimer);
    for (let k = box.textContent.length; k >= 0; k--) { box.textContent = box.textContent.slice(0, k); await new Promise((r) => setTimeout(r, 18)); }
    for (let k = 1; k <= txt.length; k++) { if (!$('.tr-text')) return; box.textContent = txt.slice(0, k); await new Promise((r) => setTimeout(r, 45)); }
  };
  tagTimer = setInterval(() => { if (!$('.tr-text')) return clearInterval(tagTimer); i = (i + 1) % TAGLINES.length; typeTo(TAGLINES[i]); }, 4200);
}
const FLOATERS = [['box', 8, 14, 0], ['list', 82, 10, 1.5], ['truck', 76, 78, 3], ['cart', 12, 72, 2.2], ['pdf', 88, 44, .8], ['check', 6, 42, 3.6]]
  .map(([n, x, y, d]) => `<span class="aff" style="left:${x}%;top:${y}%;animation-delay:-${d}s">${ic(n)}</span>`).join('');
function welcomeTruck() {
  const h = new Date().getHours();
  const hi = h < 5 ? 'Late shift? 🌙' : h < 12 ? 'Good morning ☀️' : h < 17 ? 'Good afternoon 👋' : 'Good evening 🌙';
  return `<div class="welcome-truck" aria-hidden="true"><div class="wt-move"><span class="wt-sign"><span>${hi}</span></span><i class="wt-rope"></i><span class="wt-truck">${TRUCK}</span></div><i class="wt-road"></i></div>`;
}
function parkTruck() {
  const m = $('.wt-move'); if (!m) return;
  if (calm()) { m.closest('.welcome-truck').classList.add('parked'); return; }
  m.addEventListener('animationend', () => m.closest('.welcome-truck').classList.add('parked'), { once: true });
}
function truckLeaves() {
  const w = $('.welcome-truck'); if (!w || calm()) return Promise.resolve();
  w.classList.remove('parked'); w.classList.add('leave');
  return new Promise((r) => setTimeout(r, 650));
}
function shake() { const c = $('.auth-card'); if (!c || calm()) return; c.classList.remove('shake'); void c.offsetWidth; c.classList.add('shake'); }

async function logout(msg) {
  idle.stop();
  try { await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' }); } catch { /* offline */ }
  state.boot = null; showLogin(msg);
}

// ---------- idle auto log-out ----------
const idle = {
  limit: 1800, last: Date.now(), timer: null,
  start(sec) {
    this.limit = sec; this.last = Date.now(); this.stop();
    this.timer = setInterval(() => this.tick(), 5000);
    if (!this.bound) {
      this.bound = true;
      ['click', 'keydown', 'touchstart', 'scroll'].forEach((ev) => window.addEventListener(ev, () => { this.last = Date.now(); const w = $('.idle-warn'); if (w) w.remove(); }, { passive: true }));
    }
  },
  stop() { clearInterval(this.timer); this.timer = null; const w = $('.idle-warn'); if (w) w.remove(); },
  tick() {
    const left = this.limit - (Date.now() - this.last) / 1000;
    if (left <= 0) { logout(`You were logged out after ${Math.round(this.limit / 60)} minutes without activity.`); return; }
    if (left <= 60 && !$('.idle-warn')) {
      const d = document.createElement('div'); d.className = 'idle-warn';
      d.innerHTML = `${ic('lock')}<span>You will be logged out in 1 minute.</span><button class="btn sm crema">Stay logged in</button>`;
      document.body.appendChild(d);
      $('button', d).onclick = () => { this.last = Date.now(); d.remove(); api('bootstrap').catch(() => {}); };
    }
  },
};

// ---------- app shell ----------
const NAV = [
  { h: 'dashboard', t: 'Dashboard', i: 'home' },
  { h: 'orders', t: 'Orders', i: 'list' },
  { h: 'catalog', t: 'Catalog', i: 'box' },
  { h: 'suppliers', t: 'Suppliers', i: 'truck' },
  { h: 'reports', t: 'Reports', i: 'chart' },
  { h: 'settings', t: 'Settings', i: 'gear' },
];
function shell(active, content) {
  const u = state.boot.user;
  $('#app').innerHTML = `<div class="shell">
    <aside class="side">
      <div class="brand-row">${markHtml()}<div><div class="wordmark">OrderEase<b>.</b></div><div class="tagline">${esc(state.boot.settings.company)}</div></div></div>
      <a class="nav cta" href="#/new">${ic('plus')} New order</a>
      ${NAV.map((n) => `<a class="nav ${active === n.h ? 'on' : ''}" href="#/${n.h}">${ic(n.i)}${n.t}</a>`).join('')}
      <button class="bell-link" data-bell>${ic('bell')}<span>Notifications</span><span class="bell-badge red" data-alert-n hidden></span><span class="bell-badge" data-bell-n hidden></span></button>
      <div class="side-foot"><a href="#/settings/account" title="My account">${avatarHtml(u.name, u.photo, 'mini')}</a><div class="who"><b>${esc(u.name)}</b><span>${esc(u.position || (u.role === 'admin' ? 'Admin' : 'Staff'))}</span></div>
        <button id="lo" title="Log out" aria-label="Log out">${ic('out')}</button></div>
    </aside>
    <header class="topbar"><div class="brand-row">${markHtml()}<div class="wordmark">OrderEase<b>.</b></div></div><div style="display:flex;gap:8px"><button class="bell-m" data-bell aria-label="Notifications">${ic('bell')}<span class="bell-badge red" data-alert-n hidden></span><span class="bell-badge" data-bell-n hidden></span></button><button id="lo2">${ic('out')} Log out</button></div></header>
    <main class="main" id="main">${content}</main>
    <nav class="bottomnav">
      <a href="#/dashboard" class="${active === 'dashboard' ? 'on' : ''}">${ic('home')}Home</a>
      <a href="#/orders" class="${active === 'orders' ? 'on' : ''}">${ic('list')}Orders</a>
      <a href="#/new" class="cta ${active === 'new' ? 'on' : ''}"><span class="ic">${ic('plus')}</span>New</a>
      <a href="#/reports" class="${active === 'reports' ? 'on' : ''}">${ic('chart')}Reports</a>
      <a href="#/more" class="${['catalog', 'suppliers', 'settings', 'more'].includes(active) ? 'on' : ''}">${ic('more')}More</a>
    </nav>
  </div>`;
  $('#lo').onclick = () => logout();
  $('#lo2').onclick = () => logout();
  $$('[data-bell]').forEach((b) => b.onclick = () => openBell());
  paintBell();
  window.scrollTo(0, 0);
  return $('#main');
}
function pageHead(title, sub, actions = '', eyebrow = '', deco = null) {
  if (deco) return `<div class="pbanner pb-${deco.kind}" style="--pc:${deco.color || '#D7A46E'}">${decoLayer(deco)}
    <div class="pb-title">${deco.logo || `<span class="pb-ic">${ic(deco.icon || 'box')}</span>`}<div>${eyebrow ? `<div class="eyebrow">${eyebrow}</div>` : ''}<h1>${title}</h1>${sub ? `<p class="sub">${sub}</p>` : ''}</div></div>
    <div class="actions">${actions}</div></div>`;
  return `<div class="page-head"><div>${eyebrow ? `<div class="eyebrow">${eyebrow}</div>` : ''}<h1>${title}</h1>${sub ? `<p class="sub">${sub}</p>` : ''}</div><div class="actions">${actions}</div></div>`;
}
const loading = () => '<div class="card card-pad muted">Loading…</div>';

function route() {
  if (!state.boot) return;
  const h = location.hash.replace(/^#\/?/, '').split('?')[0] || 'dashboard';
  const [p, id] = h.split('/');
  closeModal();
  const pages = { dashboard: pageDashboard, new: () => pageNewOrder(), orders: () => (id ? pageOrder(Number(id)) : pageOrders()), edit: () => pageNewOrder(Number(id)),
    catalog: pageCatalog, suppliers: pageSuppliers, reports: pageReports, settings: () => pageSettings(id), more: pageMore };
  (pages[p] || pageDashboard)();
}


// ================= ANIMATION & DECORATION =================
const calm = () => document.documentElement.classList.contains('no-motion') || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
// line-drawn delivery truck (faces right)
const TRUCK = `<svg class="truck" viewBox="0 0 72 40" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path class="tk-body" d="M3 30V9h40v21M43 15h13l9 9v6H43"/><path d="M47 18h7l5 6H47z"/>
  <path class="tk-logo" d="M14 16h18M14 22h12"/>
  <g class="tk-wheel"><circle cx="15" cy="32" r="5"/><path d="M15 28v8M11 32h8"/></g>
  <g class="tk-wheel w2"><circle cx="55" cy="32" r="5"/><path d="M55 28v8M51 32h8"/></g>
  <path class="tk-puff p1" d="M-2 28a2 2 0 1 0 0 .1"/><path class="tk-puff p2" d="M-6 25a3 3 0 1 0 0 .1"/></svg>`;
const EMPTY_BOX = `<svg class="empty-box" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M10 24l22-10 22 10v24L32 58 10 48z"/><path d="M10 24l22 10 22-10M32 34v24"/><path class="eb-lid" d="M10 24L4 14l22-10 6 10M54 24l6-10-22-10-6 10"/></svg>`;
function spinLogo() {
  const txt = 'ORDEREASE · EVERY ORDER, ONE TAP AWAY · ';
  return `<div class="spin-logo" aria-hidden="true"><svg viewBox="0 0 200 200">
    <defs><path id="sl-c" d="M100 100m-78 0a78 78 0 1 1 156 0a78 78 0 1 1-156 0"/></defs>
    <circle cx="100" cy="100" r="98" fill="#282828"/>
    <g class="sl-ring"><text font-family="Space Mono, monospace" font-size="13.5" letter-spacing="2.2" fill="#EDE7DD"><textPath href="#sl-c">${txt}${txt}</textPath></text></g>
    <text x="100" y="114" text-anchor="middle" font-family="Space Mono, monospace" font-size="40" fill="#F3F0EA">Oe<tspan fill="#D7A46E">.</tspan></text></svg></div>`;
}
function heroHtml(title, sub) {
  return `<section class="hero"><div class="hero-txt"><div class="eyebrow" style="color:#9C968C">${esc(state.boot.settings.company)}</div><h1>${title}</h1><p>${sub}</p>
    <a class="btn crema" href="#/new">${ic('plus')} New order</a></div><div class="hero-scene">${deliveryScene()}</div></section>`;
}
// Jeddah street at the hero: supplier warehouse → truck → the restaurants. Sky follows real Jeddah time.
function deliveryScene() {
  const rs = activeRest().slice(0, 4);
  const stars = [[40, 18], [110, 40], [170, 14], [250, 30], [300, 12], [360, 26], [430, 14], [490, 38], [560, 20], [610, 44]]
    .map(([x, y], i) => `<circle class="ds-star" cx="${x}" cy="${y}" r="1.3" style="animation-delay:${(i * 0.41) % 3}s"/>`).join('');
  const shops = rs.map((r, i) => { const x = 420 + i * 54; return `<g class="ds-shop" style="--c:${r.color}">
      <path class="ds-awn" d="M${x} 82h48l-3 9q-3.5 4-7 0q-3.5 4-7 0q-3.5 4-7 0q-3.5 4-7 0q-3.5 4-7 0q-3.5 4-7 0z"/>
      <path d="M${x + 3} 91v27h42V91M${x + 9} 118v-17h11v17M${x + 26} 100h13v9h-13z"/>
      <text x="${x + 24}" y="79" text-anchor="middle">${esc(r.short || '')}</text>
      <circle class="ds-lamp" cx="${x + 32}" cy="104" r="1.6" style="animation-delay:${i * .5}s"/></g>`; }).join('');
  return `<svg class="ds-svg" viewBox="0 0 640 150" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
    <defs><radialGradient id="ds-glow" cx="50%" cy="100%" r="80%"><stop offset="0%" stop-color="#D7A46E" stop-opacity=".28"/><stop offset="100%" stop-color="#D7A46E" stop-opacity="0"/></radialGradient></defs>
    <rect class="ds-glowr" width="640" height="150" fill="url(#ds-glow)"/>
    <g class="ds-stars">${stars}</g>
    <g class="ds-sun"><circle r="10" class="ds-sun-disc"/><circle r="16" class="ds-sun-ring"/></g>
    <g class="ds-moon"><path d="M6 -10a11 11 0 1 0 0 20a8.5 8.5 0 1 1 0 -20z"/></g>
    <g class="ds-clouds"><path class="ds-cloud c1" d="M0 0h34a8 8 0 0 0-8-8a10 10 0 0 0-18-2a7 7 0 0 0-8 10z"/><path class="ds-cloud c2" d="M0 0h26a6 6 0 0 0-6-6a8 8 0 0 0-14-1a5 5 0 0 0-6 7z"/></g>
    <g class="ds-line">
      <path d="M18 118V74l46-20 46 20v44"/><path d="M34 118V92h60v26M34 99h60M34 106h60M34 113h60"/><path d="M42 80h44"/>
      <text class="ds-sign" x="64" y="76" text-anchor="middle">SUPPLIER</text>
      <g class="ds-boxes"><path d="M116 118v-10h12v10zM130 118v-10h12v10zM123 108v-10h12v10z"/></g>
      <path d="M176 118c2-14 1-28-3-40"/><path d="M173 78c-10-6-20-4-26 2M173 78c-4-9-12-13-20-12M173 78c8-8 18-9 25-4M173 78c5-8 13-10 20-7"/>
      <g class="ds-jet"><path d="M300 117V40"/><path class="ds-spray" d="M300 40c-8 1-13 11-15 26M300 40c8 1 13 11 15 26"/></g><path d="M290 118c3-3 17-3 20 0"/>
      <circle class="ds-drop d1" cx="293" cy="68" r="1.2"/><circle class="ds-drop d2" cx="307" cy="70" r="1.2"/><circle class="ds-drop d3" cx="298" cy="74" r="1"/>
      <path d="M352 118V96h36v22M358 96a12 12 0 0 1 24 0M370 84v-4M396 118V70M392 74h8M394 70l2-6l2 6"/>
      ${shops}
      <path d="M0 120h640"/>
    </g>
    <path class="ds-dash" d="M0 136h640"/>
    <g class="ds-truck-move"><g class="ds-truck" transform="translate(0 99) scale(.82)">${TRUCK.replace('<svg class="truck" viewBox="0 0 72 40"', '<svg x="0" y="0" width="72" height="40" viewBox="0 0 72 40" class="truck"')}</g></g>
  </svg>
  <div class="ds-label"><span class="ds-dot"></span>JEDDAH · <b class="ds-time">--:--</b> · <span class="ds-phase"></span></div>`;
}
function jeddahNow() {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Riyadh', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date());
  const h = +parts.find((p) => p.type === 'hour').value % 24, m = +parts.find((p) => p.type === 'minute').value;
  return { t: h + m / 60, label: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}` };
}
function updateScene() {
  const svg = $('.ds-svg'); if (!svg) return false;
  const { t, label } = jeddahNow();
  const phase = t < 5 ? 'Night' : t < 7 ? 'Sunrise' : t < 11 ? 'Morning' : t < 15 ? 'Afternoon' : t < 17.5 ? 'Late afternoon' : t < 19 ? 'Sunset' : 'Night';
  const arc = (p) => ({ x: 30 + p * 580, y: 108 - Math.sin(p * Math.PI) * 84 });
  const sun = arc(Math.min(1, Math.max(0, (t - 6) / 12.5)));
  const moon = arc(Math.min(1, Math.max(0, (t >= 18.5 ? t - 18.5 : t + 5.5) / 11.5)));
  $('.ds-sun', svg).setAttribute('transform', `translate(${sun.x} ${sun.y})`);
  $('.ds-moon', svg).setAttribute('transform', `translate(${moon.x} ${moon.y})`);
  svg.dataset.night = t < 5.75 || t >= 18.75 ? '1' : '0';
  svg.dataset.glow = (t >= 5.5 && t < 7.5) || (t >= 16.75 && t < 19.25) ? '1' : '0';
  $('.ds-time').textContent = label; $('.ds-phase').textContent = phase;
  return true;
}
let sceneTimer = null;
function startScene() { clearInterval(sceneTimer); if (updateScene()) sceneTimer = setInterval(() => { if (!updateScene()) clearInterval(sceneTimer); }, 30000); }
// numbers roll up from 0
function countUp(root) {
  $$('[data-count]', root).forEach((el) => {
    const end = Number(el.dataset.count) || 0, dec = Number(el.dataset.dec) || 0;
    const show = (v) => { el.textContent = dec ? fmtNum(v, dec) : Math.round(v).toLocaleString('en-US'); };
    if (calm() || !end) return show(end);
    const t0 = performance.now(), dur = 900;
    const step = (now) => { const k = Math.min(1, (now - t0) / dur); show(end * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  });
}
// cart: a little truck that fills with boxes as items are added
function cartTruck(n) {
  const boxes = Math.min(n, 6);
  const pos = [[6, 18], [16, 18], [26, 18], [36, 18], [11, 9], [21, 9]];
  return `<span class="cart-truck ${n ? 'loaded' : ''}" title="${n} item${n === 1 ? '' : 's'} in the order"><svg viewBox="-2 0 74 44" fill="none" aria-hidden="true">
    ${pos.slice(0, boxes).map(([x, y], i) => `<rect class="ct-box ${i === boxes - 1 && state.ob && state.ob.bump ? 'new' : ''}" x="${x}" y="${y}" width="9" height="9" rx="1.5"/>`).join('')}
    <g stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 30v-3h42v3M45 15h11l9 9v6H45z"/><path d="M48 18h7l5 6H48z"/>
    <circle class="ct-w" cx="15" cy="33" r="5"/><circle class="ct-w" cx="55" cy="33" r="5"/></g></svg></span>`;
}
// small burst of brand-coloured confetti
function confetti(from) {
  if (calm() || !from) return;
  const r = from.getBoundingClientRect(), cols = ['#D7A46E', '#5A4636', '#E8902A', '#3F7D63', '#6D5BA8', '#282828'];
  const layer = document.createElement('div'); layer.className = 'confetti'; layer.style.left = r.left + r.width / 2 + 'px'; layer.style.top = r.top + 'px';
  layer.innerHTML = Array.from({ length: 26 }, (_, i) => { const a = (i / 26) * Math.PI * 2, d = 60 + Math.random() * 70;
    return `<i style="--x:${Math.cos(a) * d}px;--y:${Math.sin(a) * d - 50}px;--r:${Math.random() * 540}deg;background:${cols[i % cols.length]};animation-delay:${Math.random() * .08}s"></i>`; }).join('');
  document.body.appendChild(layer); setTimeout(() => layer.remove(), 1300);
}


// ================= RESTAURANT LOGOS & PAGE BANNERS =================
const PLANE_MARK = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" transform="rotate(45 12 12)" d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z"/></svg>`;
function restKind(r) { const n = String(r && r.name || '').toLowerCase(); return /plane/.test(n) ? 'plane' : /daily|edition/.test(n) ? 'edition' : /bupa/.test(n) ? 'bupa' : 'rest'; }
function restLogo(r, size = '') {
  if (!r) return '';
  const k = restKind(r), cls = `rlogo ${size}`;
  if (k === 'plane') return `<span class="${cls} plane" style="--c:${r.color}" title="${esc(r.name)}">${PLANE_MARK}</span>`;
  if (k === 'edition') return `<img class="${cls}" src="img/logo-round.png" alt="" title="${esc(r.name)}">`;
  if (k === 'bupa') return `<img class="${cls} ghaya" src="img/ghaya.png" alt="" title="${esc(r.name)}">`;
  return `<span class="${cls} txt" style="--c:${r.color}" title="${esc(r.name)}">${esc(r.short || initials(r.name))}</span>`;
}
const CUP = `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 28h34v8a17 17 0 0 1-34 0z"/><path d="M46 31h4a6 6 0 0 1 0 12h-5"/><path class="i-steam" d="M22 22c-3-4 3-6 0-10"/><path class="i-steam s2" d="M30 22c-3-4 3-6 0-10"/><path class="i-steam s3" d="M38 22c-3-4 3-6 0-10"/></svg>`;
function decoLayer(d) {
  const k = d.kind;
  if (k === 'plane') return `<div class="deco-layer" aria-hidden="true"><i class="dc-cloud a"></i><i class="dc-cloud b"></i><i class="dc-cloud c"></i>
    <svg class="dc-path" viewBox="0 0 600 80" preserveAspectRatio="none"><path d="M0 62 C 150 70, 260 20, 600 26"/></svg><span class="dc-plane">${PLANE_MARK}</span></div>`;
  if (k === 'edition') return `<div class="deco-layer" aria-hidden="true"><span class="dc-cup">${CUP}</span><i class="dc-bean b1"></i><i class="dc-bean b2"></i><i class="dc-bean b3"></i><i class="dc-bean b4"></i></div>`;
  if (k === 'bupa') return `<div class="deco-layer" aria-hidden="true"><svg class="dc-star" viewBox="0 0 100 100"><path d="M50 4l13 33 33 13-33 13-13 33-13-33L4 50l33-13z"/><rect x="26" y="26" width="48" height="48" transform="rotate(45 50 50)"/><circle cx="50" cy="50" r="8"/></svg><i class="dc-shine"></i></div>`;
  if (k === 'orders') return `<div class="deco-layer" aria-hidden="true"><svg class="dc-road" viewBox="0 0 400 80" preserveAspectRatio="none"><path d="M0 64 C 120 70, 220 30, 400 34"/></svg><span class="dc-truck">${TRUCK}</span>
    <svg class="dc-receipt" viewBox="0 0 40 52" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 3h28v46l-5-4-5 4-4-4-4 4-5-4-5 4z"/><path class="rl r1" d="M12 14h16"/><path class="rl r2" d="M12 22h16"/><path class="rl r3" d="M12 30h10"/></svg></div>`;
  if (k === 'catalog') return `<div class="deco-layer" aria-hidden="true"><div class="dc-boxes"><i class="bx b1"></i><i class="bx b2"></i><i class="bx b3"></i></div>
    <svg class="dc-barcode" viewBox="0 0 90 40"><path d="M4 4v32M10 4v32M14 4v32M22 4v32M26 4v32M32 4v32M40 4v32M44 4v32M52 4v32M56 4v32M62 4v32M70 4v32M74 4v32M82 4v32M86 4v32"/></svg><i class="dc-scan"></i></div>`;
  if (k === 'suppliers') return `<div class="deco-layer" aria-hidden="true"><svg class="dc-house" viewBox="0 0 80 56" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"><path d="M4 54V22L40 6l36 16v32"/><path d="M18 54V32h44v22M18 39h44M18 46h44"/></svg><span class="dc-truck out">${TRUCK}</span><i class="dc-dash"></i></div>`;
  if (k === 'reports') return `<div class="deco-layer" aria-hidden="true"><div class="dc-bars"><i style="--h:40%"></i><i style="--h:68%"></i><i style="--h:52%"></i><i style="--h:86%"></i><i style="--h:64%"></i></div>
    <svg class="dc-line" viewBox="0 0 120 50" preserveAspectRatio="none"><path d="M2 42 L30 30 L58 34 L86 14 L118 8"/></svg></div>`;
  if (k === 'settings') return `<div class="deco-layer" aria-hidden="true"><svg class="dc-gear g1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4">${ICON.gear}</svg><svg class="dc-gear g2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4">${ICON.gear}</svg></div>`;
  return `<div class="deco-layer" aria-hidden="true"><span class="dc-cartbob">${ic('cart')}</span><i class="dc-dot d1"></i><i class="dc-dot d2"></i><i class="dc-dot d3"></i></div>`;
}

// ---- page change: a dallah pours Arabic coffee into a finjan, a gold star pattern sweeps across the top ----
const DALLAH = `<svg class="dl-svg" viewBox="0 0 120 70" aria-hidden="true">
  <g class="dl-pot">
    <path class="dl-body" d="M30 60 Q22 60 22 52 Q22 40 30 36 L32 26 Q30 22 34 20 L46 20 Q50 22 48 26 L50 36 Q58 40 58 52 Q58 60 50 60 Z"/>
    <path class="dl-band" d="M24 46 H56"/>
    <path class="dl-lid" d="M34 20 Q40 12 46 20 M40 14 V9"/><circle class="dl-knob" cx="40" cy="8" r="2.2"/>
    <path class="dl-spout" d="M56 44 Q66 40 68 30 Q70 22 78 20"/>
    <path class="dl-handle" d="M24 44 Q12 40 18 28 Q20 24 30 28"/>
  </g>
  <path class="dl-pour" d="M79 21 Q86 30 88 46"/>
  <g class="dl-cup"><path class="dl-finjan" d="M80 48 H98 L95 60 Q89 63 83 60 Z"/><path class="dl-coffee" d="M81.5 50 H96.5"/>
    <path class="dl-steam s1" d="M85 44 q-2 -4 0 -8"/><path class="dl-steam s2" d="M90 43 q-2 -4 0 -8"/><path class="dl-steam s3" d="M95 44 q-2 -4 0 -8"/></g>
</svg>`;
const STAR8 = (x) => `<rect x="${x - 4.6}" y="5.4" width="9.2" height="9.2"/><rect x="${x - 4.6}" y="5.4" width="9.2" height="9.2" transform="rotate(45 ${x} 10)"/>`;
function flyby() {
  if (calm()) return;
  let f = $('#flyby');
  if (!f) {
    f = document.createElement('div'); f.id = 'flyby'; f.setAttribute('aria-hidden', 'true');
    f.innerHTML = `<div class="fb-stars"><svg viewBox="0 0 400 20" preserveAspectRatio="xMidYMid meet">${Array.from({ length: 13 }, (_, i) => STAR8(14 + i * 31)).join('')}</svg></div>
      <div class="fb-dallah">${DALLAH}</div>`;
    f.addEventListener('animationend', (e) => { if (e.target.classList.contains('fb-dallah')) f.classList.remove('go'); });
    document.body.appendChild(f);
  }
  if (f.classList.contains('go')) return;
  void f.offsetWidth; f.classList.add('go');
}
document.addEventListener('click', (e) => {
  const a = e.target.closest && e.target.closest('.nav, .bottomnav a');
  if (a && !a.classList.contains('on')) flyby();
});

// ================= LIVE UPDATES (someone else saved) =================
const live = { build: null, changed: null, notif: null, busy: false };
const busyNow = () => !!$('#modal-root').innerHTML.trim() || (state.ob && state.ob.items && state.ob.items.size > 0 && /#\/(new|edit)/.test(location.hash));
async function checkChanges() {
  if (!state.boot || document.hidden || live.busy) return;
  live.busy = true;
  let d; try { d = await api('changes'); } catch { live.busy = false; return; }
  live.busy = false;
  if (live.build === null) {
    live.build = d.build; live.changed = d.changed; live.notif = d.notif;
    return;
  }
  if (d.notif !== live.notif) { live.notif = d.notif; refreshBell(true); }
  if (d.build !== 'dev' && live.build !== 'dev' && d.build !== live.build) { applyUpdate(); return; }
  if (d.changed !== live.changed) {
    live.changed = d.changed;
    if (busyNow()) { showUpdateBar(false); return; }
    if (/#\/(dashboard|orders|catalog|suppliers|reports)?$|#\/orders\/\d+$|^$/.test(location.hash.split('?')[0])) { const y = scrollY; route(); setTimeout(() => scrollTo(0, y), 400); toast('Updated with the latest changes'); }
  }
}
// ---------- automatic website update ----------
// Checks the website files every 30 s (also on the login page). When a new version is deployed the page
// reloads by itself, staying on the same screen. If someone is in the middle of something (a form being
// typed, an open window, an order with items), it waits until they are done.
const ver = { tag: null, pending: false };
async function assetTag() {
  const tags = await Promise.all(['app.js', 'styles.css'].map(async (f) => {
    const r = await fetch(f + '?check=' + Date.now(), { method: 'HEAD', cache: 'no-store' });
    return r.headers.get('etag') || r.headers.get('last-modified') || r.headers.get('content-length') || '';
  }));
  return tags.join('|');
}
function typingNow() {
  const a = document.activeElement;
  const authTyped = $$('.auth-card input').some((i) => i.value);
  return authTyped || (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.value && !a.closest('.filters, .log-filters, .search, .rep-ctrl'));
}
function applyUpdate() {
  ver.pending = true;
  if (busyNow() || typingNow()) { showUpdateBar(true); return; }
  try { sessionStorage.setItem('oe_updated', String(Date.now())); sessionStorage.setItem('oe_scroll', String(scrollY)); } catch {}
  location.reload();
}
async function checkVersion() {
  if (document.hidden) return;
  if (ver.pending) { if (!busyNow() && !typingNow()) applyUpdate(); return; }
  let t; try { t = await assetTag(); } catch { return; }
  if (!t.replace(/\|/g, '')) return;
  if (ver.tag === null) { ver.tag = t; return; }
  if (t !== ver.tag) applyUpdate();
}
setInterval(checkVersion, 30000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkVersion(); });
addEventListener('focus', checkVersion);
checkVersion();
(() => {   // just reloaded after an update
  let up = null, y = 0; try { up = sessionStorage.getItem('oe_updated'); y = Number(sessionStorage.getItem('oe_scroll')) || 0; sessionStorage.removeItem('oe_updated'); sessionStorage.removeItem('oe_scroll'); } catch {}
  if (up && Date.now() - Number(up) < 60000) setTimeout(() => { scrollTo(0, y); toast('✨ Updated to the newest version'); }, 900);
})();
function showUpdateBar(reload) {
  if ($('#updbar')) return;
  const bar = document.createElement('div'); bar.id = 'updbar';
  bar.innerHTML = `<span>${reload ? 'A new version is ready — it will refresh by itself when you finish.' : 'New changes were saved on another device.'}</span><button class="btn sm crema">Refresh now</button>`;
  $('button', bar).onclick = () => { bar.remove(); if (reload) { ver.pending = false; saveDraft(); try { sessionStorage.setItem('oe_updated', String(Date.now())); } catch {} location.reload(); } else route(); };
  document.body.appendChild(bar);
}
setInterval(checkChanges, 15000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkChanges(); });

// ================= BELL: alerts + activity + what's new =================
const bell = { unread: 0, alerts: null, keys: null };
function alertCopy(a) {
  const n = a.items ? a.items.length : 0, s = n > 1 ? 's' : '';
  if (a.kind === 'late') return { emoji: '🔴', title: `${n} delivery${n > 1 ? ' deliveries' : ''} overdue`, text: 'The delivery date has passed but these orders are not marked as received. Call the supplier, or tap the order and Mark as received.', btn: 'Open orders', go: '#/orders' };
  if (a.kind === 'today') return { emoji: '🚚', title: `${n} delivery${n > 1 ? ' deliveries' : ''} expected today`, text: 'When the goods arrive, check them against the order and tap Mark as received.', btn: 'Open orders', go: '#/orders' };
  if (a.kind === 'waiting') return { emoji: '⏳', title: `${n} order${s} waiting 3+ days`, text: 'These orders have no delivery date and are still waiting. Check with the supplier.', btn: 'Open orders', go: '#/orders' };
  if (a.kind === 'nocode') return { emoji: '🏷️', title: `${a.supplier}: ${n} item${s} without a code`, text: 'The supplier only sees the name for these items. Add the code from the catalog book.', btn: 'Add codes', go: '#/catalog', sid: a.sid };
  return { emoji: '📱', title: `${n} supplier${s} without a WhatsApp number`, text: 'Add the number so the WhatsApp button opens their chat directly.', btn: 'Open suppliers', go: '#/suppliers' };
}
function alertCard(a) {
  const c = alertCopy(a), max = 5;
  const line = (x) => a.kind === 'nocode' ? `<li><b>${esc(x.name)}</b><span>${esc(x.pack || '')}</span></li>`
    : a.kind === 'nophone' ? `<li><b>${esc(x.name)}</b><span>${x.n} order${x.n > 1 ? 's' : ''} in 30 days</span></li>`
    : `<li><a href="#/orders/${x.id}" data-close-modal><b class="mono">${esc(x.no)}</b></a><span><span class="dot" style="--c:${x.color}"></span> ${esc(x.restaurant)} → ${esc(x.supplier)}${x.delivery ? ` · due ${fmtDate(x.delivery)}` : ` · ordered ${fmtDate(x.date)}`}</span></li>`;
  return `<div class="al-card sev-${a.sev}"><div class="al-h"><span class="al-t">${c.emoji} ${esc(c.title)}</span></div>
    <div class="al-b"><p>${c.text}</p><ul class="al-items">${(a.items || []).slice(0, max).map(line).join('')}${n(a) > max ? `<li class="al-more">+ ${n(a) - max} more</li>` : ''}</ul>
    <a class="btn al-go" href="${c.go}" data-close-modal ${c.sid ? `data-cat-sid="${c.sid}"` : ''}>${c.btn}</a></div>
    <div class="al-f">Automatic check · updates by itself</div></div>`;
}
const n = (a) => (a.items ? a.items.length : 0);
function paintBell() {
  $$('[data-bell-n]').forEach((el) => { el.hidden = !bell.unread; el.textContent = bell.unread > 99 ? '99+' : bell.unread; });
  const all = bell.alerts ? bell.alerts.alerts : [];
  $$('[data-alert-n]').forEach((el) => { el.hidden = !all.length; el.textContent = all.length; });
  const strip = $('#alert-strip');
  if (strip) {
    const urgent = all.filter((x) => x.sev !== 'info' || x.kind === 'today');
    strip.hidden = !urgent.length;
    if (urgent.length) strip.innerHTML = `<span class="as-ico">⚠️</span><span><b>${urgent.length} alert${urgent.length > 1 ? 's' : ''}</b> need${urgent.length > 1 ? '' : 's'} attention — ${urgent.slice(0, 2).map((x) => esc(alertCopy(x).title)).join(' · ')}${urgent.length > 2 ? ' …' : ''}</span><button class="btn sm crema" data-bell-alerts>View</button>`;
    const b = $('[data-bell-alerts]', strip); if (b) b.onclick = () => openBell('alerts');
  }
}
async function refreshBell(announce) {
  if (!state.boot) return;
  try {
    const before = bell.unread;
    const [d, al] = await Promise.all([api('notifications?count=1'), api('alerts')]);
    bell.unread = d.unread; bell.alerts = al;
    const keys = al.alerts.map((x) => x.kind + ':' + (x.sid || '') + ':' + n(x));
    const fresh = bell.keys ? al.alerts.filter((x, i) => !bell.keys.includes(keys[i]) && x.sev !== 'info') : [];
    bell.keys = keys;
    paintBell();
    if (fresh.length) toast(`⚠️ ${alertCopy(fresh[0]).title} — tap the bell`);
    else if (announce && d.unread > before) toast(`🔔 ${d.unread - before} new update${d.unread - before > 1 ? 's' : ''} — tap the bell`);
  } catch { /* offline */ }
}
const NOTE_VERB = { order_created: 'placed', order_edited: 'edited', order_received: 'received', order_cancelled: 'cancelled' };
async function openBell(tab) {
  let d, al; try { [d, al] = await Promise.all([api('notifications'), api('alerts')]); } catch (e) { return toast(e.message, true); }
  bell.alerts = al;
  if (typeof tab !== 'string') tab = al.alerts.length ? 'alerts' : 'activity';
  const seen = d.seen, maxId = d.items.reduce((m, x) => Math.max(m, x.id), 0);
  const itemHTML = (x) => {
    const isNew = x.id > seen, [no, ...rest] = String(x.detail || '').split(' · ');
    if (x.action === 'login_failed') return `<div class="nt warn ${isNew ? 'new' : ''}"><span class="nt-ico">${ic('lock')}</span><div class="nt-b"><div class="nt-t"><b>${esc(x.name || x.username)}</b>’s account was locked${isNew ? ' <span class="nt-dot">new</span>' : ''}</div><div class="nt-s">Too many wrong passwords. Unlock it in Settings → Users if needed.</div><div class="nt-time">${fmtTs(x.ts)}</div></div></div>`;
    return `<div class="nt ${isNew ? 'new' : ''} act-${x.action}">${avatarHtml(x.name || x.username, x.photo)}
      <div class="nt-b"><div class="nt-t"><b>${esc(x.name || x.username || 'Someone')}</b> ${NOTE_VERB[x.action] || x.action} order ${x.ref ? `<a href="#/orders/${x.ref}" data-close-modal class="mono">${esc(no)}</a>` : `<span class="mono">${esc(no)}</span>`}${isNew ? ' <span class="nt-dot">new</span>' : ''}</div>
      ${rest.length ? `<div class="nt-s">${esc(rest.join(' · '))}</div>` : ''}<div class="nt-time">${fmtTs(x.ts)}</div></div></div>`;
  };
  const rel = (d.releases || []).map((r) => ({ ...r, isNew: r.v > (d.relSeen || 0) }));
  const relHTML = (r) => `<div class="nt sys ${r.isNew ? 'new' : ''}"><span class="nt-ico sys">✨</span><div class="nt-b"><div class="nt-t">Website updated — <b>${esc(r.title)}</b>${r.isNew ? ' <span class="nt-dot">new</span>' : ''}</div><div class="nt-s">${esc(r.text)}</div><div class="nt-time">${fmtTs(r.ts)}</div></div></div>`;
  const merged = [...d.items.map((x) => ({ x, ts: x.ts })), ...rel.map((r) => ({ r, ts: r.ts }))].sort((a, b) => b.ts - a.ts);
  const list = merged.length ? merged.map((m) => (m.r ? relHTML(m.r) : itemHTML(m.x))).join('') : `<div class="empty">${EMPTY_BOX}<b>Nothing yet</b>Orders placed by ${isAdmin() ? 'staff' : 'your team'} will show here.</div>`;
  const newCount = d.items.filter((x) => x.id > seen).length + rel.filter((r) => r.isNew).length;
  const alertList = al.alerts.length ? al.alerts.map(alertCard).join('')
    : `<div class="empty al-empty">${EMPTY_BOX}<b>All good ✓</b>Nothing needs your attention right now.<small>Checks: overdue deliveries · deliveries today · orders waiting 3+ days · items without a code · suppliers without WhatsApp</small></div>`;
  const markSeen = () => { if (newCount) { api('notifications', { method: 'POST', body: { seen: maxId } }).catch(() => {}); bell.unread = 0; paintBell(); } };
  const m = modal({ title: 'Notifications', wide: true, body: `
    <div class="bell-tabs" role="tablist"><button data-bt="alerts" class="${tab === 'alerts' ? 'on' : ''}">⚠️ Alerts${al.alerts.length ? ` <span class="bt-n red">${al.alerts.length}</span>` : ''}</button>
      <button data-bt="activity" class="${tab === 'activity' ? 'on' : ''}">🕘 Activity${newCount ? ` <span class="bt-n">${newCount}</span>` : ''}</button></div>
    <div data-bp="alerts" ${tab === 'alerts' ? '' : 'hidden'}><div class="al-list">${alertList}</div></div>
    <div data-bp="activity" ${tab === 'activity' ? '' : 'hidden'}><p class="bt-help">${isAdmin() ? 'What staff did' : 'What your team did'} and website updates — newest first.</p><div class="nt-list">${list}</div></div>`,
    foot: `${isAdmin() ? '<a class="btn ghost" href="#/settings/log" data-close-modal>Activity log</a>' : ''}<button class="btn crema" data-close>Close</button>` });
  if (tab === 'activity') markSeen();
  $$('[data-bt]', m).forEach((b) => b.onclick = () => {
    $$('[data-bt]', m).forEach((x) => x.classList.toggle('on', x === b));
    $$('[data-bp]', m).forEach((p) => { p.hidden = p.dataset.bp !== b.dataset.bt; });
    if (b.dataset.bt === 'activity') markSeen();
  });
  $$('[data-close-modal]', m).forEach((a) => a.addEventListener('click', () => { if (a.dataset.catSid) cat.sid = Number(a.dataset.catSid); closeModal(); }));
}

// ================= ACTIVITY LOG =================
const LOG_LABEL = { login: 'Signed in', logout: 'Logged out', login_failed: 'Failed sign-in', setup: 'First setup', password_changed: 'Changed password', profile_saved: 'Updated profile',
  order_created: 'Placed order', order_edited: 'Edited order', order_received: 'Received order', order_cancelled: 'Cancelled order', order_ordered: 'Re-opened order', order_deleted: 'Deleted order',
  product_added: 'Added item', product_saved: 'Edited item', product_hidden: 'Hid item', product_deleted: 'Deleted item', products_imported: 'Imported Excel',
  supplier_added: 'Added supplier', supplier_saved: 'Edited supplier', restaurant_added: 'Added restaurant', restaurant_saved: 'Edited restaurant',
  user_added: 'Added user', user_saved: 'Edited user', settings_saved: 'Changed settings' };
const LOG_TYPES = [['', 'All actions'], ['orders', 'Orders'], ['order_created', 'Placed order'], ['order_received', 'Received order'], ['order_edited', 'Edited order'], ['order_cancelled', 'Cancelled order'],
  ['catalog', 'Catalog & suppliers'], ['sign', 'Sign in / out'], ['login_failed', 'Failed sign-in'], ['settings', 'Settings & users']];
const LOG_ICON = (a) => /^order_/.test(a) ? 'list' : /^product|supplier/.test(a) ? 'box' : /login|logout|password|setup/.test(a) ? 'lock' : 'gear';
async function tabLog(el) {
  const { log } = await api('audit');
  const users = [...new Map(log.filter((l) => l.username).map((l) => [l.username.toLowerCase(), l.name || l.username])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const f = { user: '', type: '', rest: '', days: '', hideSign: false };
  const sel = (id, opts, aria) => `<select class="select lf-sel" id="${id}" aria-label="${aria}">${opts.map(([v, t]) => `<option value="${esc(v)}">${esc(t)}</option>`).join('')}</select>`;
  el.innerHTML = `<div class="card"><div class="log-filters">
      <div class="lf-row">${ic('sliders')}
        ${sel('lf-user', [['', 'Everyone'], ...users], 'User')}${sel('lf-type', LOG_TYPES, 'Action')}
        ${sel('lf-rest', [['', 'All restaurants'], ...state.boot.restaurants.map((r) => [String(r.id), r.name])], 'Restaurant')}
        ${sel('lf-days', [['', 'Any time'], ['1', 'Today'], ['7', 'Last 7 days'], ['30', 'Last 30 days']], 'When')}
        <label class="check"><input type="checkbox" id="lf-hide"> Hide sign in / out</label><span style="flex:1"></span>
        <button class="btn ghost sm" id="lf-xlsx" type="button">${ic('excel')} Excel</button></div>
      <div class="hint" id="lf-count" style="margin-top:8px"></div></div>
    <div class="table-wrap"><table class="t log-t"><thead><tr><th>When</th><th>User</th><th>Action</th><th class="hide-sm">Details</th><th class="r">View</th></tr></thead><tbody id="lf-body"></tbody></table></div></div>
    <p class="hint" style="margin-top:10px">Shows the latest 1,000 events. “View details” shows the whole order and what was changed.</p>`;
  const typeOk = (l) => !f.type ? true : f.type === 'orders' ? /^order_/.test(l.action) : f.type === 'sign' ? ['login', 'logout'].includes(l.action)
    : f.type === 'catalog' ? /^(product|supplier)/.test(l.action) : f.type === 'settings' ? /^(user_|restaurant_|settings_|password_|profile_|setup)/.test(l.action) : l.action === f.type;
  const today0 = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime() / 1000; })();
  const filtered = () => log.filter((l) => (!f.user || (l.username || '').toLowerCase() === f.user) && typeOk(l) && (!f.rest || String(l.rid) === f.rest)
    && (!f.days || l.ts >= today0 - (Number(f.days) - 1) * 86400) && (!f.hideSign || !['login', 'logout'].includes(l.action)));
  const paint = () => {
    const rows = filtered();
    $('#lf-body', el).innerHTML = rows.map((l) => `<tr class="${l.action === 'login_failed' ? 'warn-row' : ''}"><td class="muted" style="white-space:nowrap;font-size:13px">${fmtTs(l.ts)}</td>
      <td><div class="u-cell">${avatarHtml(l.name || l.username || '?', l.photo, 'mini')}<b style="font-size:14px">${esc(l.name || l.username || '—')}</b></div></td>
      <td><span class="lg-act a-${(l.action || '').split('_')[0]} ${l.action === 'login_failed' ? 'bad' : ''}">${ic(LOG_ICON(l.action))}${esc(LOG_LABEL[l.action] || l.action)}</span></td>
      <td class="hide-sm muted" style="font-size:13px;max-width:420px">${esc(l.detail || '')}</td>
      <td class="r">${l.ref ? `<button class="btn ghost sm" data-log="${l.id}">${ic('eye')} View details</button>` : ''}</td></tr>`).join('')
      || `<tr><td colspan="5"><div class="empty">${EMPTY_BOX}<b>No activity matches these filters</b></div></td></tr>`;
    $('#lf-count', el).textContent = rows.length === log.length ? `${log.length} events` : `Showing ${rows.length} of ${log.length} events`;
  };
  [['lf-user', 'user'], ['lf-type', 'type'], ['lf-rest', 'rest'], ['lf-days', 'days']].forEach(([id, k]) => { $('#' + id, el).onchange = (e) => { f[k] = e.target.value; paint(); }; });
  $('#lf-hide', el).onchange = (e) => { f.hideSign = e.target.checked; paint(); };
  $('#lf-body', el).onclick = (e) => { const b = e.target.closest('[data-log]'); if (b) showLogDetail(log.find((l) => l.id === Number(b.dataset.log))); };
  $('#lf-xlsx', el).onclick = () => act($('#lf-xlsx', el), async () => {
    const wb = needExcel(); wb.creator = APP_NAME;
    const ws = wb.addWorksheet('Activity log');
    ws.columns = [{ header: 'When', width: 20 }, { header: 'User', width: 22 }, { header: 'Username', width: 14 }, { header: 'Action', width: 18 }, { header: 'Restaurant', width: 20 }, { header: 'Details', width: 90 }];
    filtered().forEach((l) => ws.addRow([fmtTs(l.ts), l.name || l.username || '', l.username || '', LOG_LABEL[l.action] || l.action, l.rid ? (restById(l.rid)?.name || '') : '', l.detail || '']));
    styleHeader(ws);
    await saveWb(wb, `OrderEase activity log - ${today()}.xlsx`); toast('Excel downloaded');
  });
  paint();
}
async function showLogDetail(l) {
  if (!l || !l.ref) return;
  let d; try { d = await api('orders/' + l.ref); } catch { return toast('That order was deleted.', true); }
  const o = d.order, [, ...changes] = String(l.detail || '').split(' · ');
  const m = modal({ title: `${LOG_LABEL[l.action] || l.action} · ${o.order_no}`, wide: true, body: `
    <p style="margin-top:0"><b>${esc(l.name || l.username)}</b> · ${fmtTs(l.ts)} · ${restLogo(restById(o.restaurant_id), 'xs')} ${esc(o.restaurant)} → ${esc(o.supplier)} · <span class="pill ${o.status}">${o.status}</span></p>
    ${l.action === 'order_edited' && changes.length ? `<div class="ld-list">${changes.map((c) => `<div class="ld-item">${esc(c).replace('→', '→ <b>').replace(/$/, c.includes('→') ? '</b>' : '')}</div>`).join('')}</div><div class="label" style="margin:14px 0 6px">The order now</div>` : ''}
    <div class="card"><div class="table-wrap"><table class="t"><thead><tr><th>Code</th><th>Item</th><th class="r">Qty</th></tr></thead><tbody>
    ${d.items.map((it) => `<tr><td>${codeHtml(it.code)}</td><td>${esc(it.name)} <span class="muted">${esc(it.pack || '')}</span></td><td class="r num"><b>${fmtQty(it.qty)}</b> ${esc(it.unit || '')}</td></tr>`).join('')}</tbody></table></div></div>`,
    foot: `<a class="btn ghost" href="#/orders/${o.id}" data-close-modal>Open order</a><button class="btn crema" data-close>Close</button>` });
  $$('[data-close-modal]', m).forEach((a) => a.addEventListener('click', closeModal));
}

// ================= DASHBOARD =================
async function pageDashboard() {
  const u = state.boot.user;
  const hr = new Date().getHours();
  const hi = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
  const hero = (dt) => heroHtml(`${hi}, ${esc(u.name.split(' ')[0])}`, `${fmtDate(dt)} · here is how ordering looks this month.`);
  const main = shell('dashboard', hero(today()) + loading());
  startScene();
  try {
    const d = await api('dashboard');
    const rmap = Object.fromEntries(d.by_restaurant.map((r) => [r.id, r]));
    const max14 = Math.max(1, ...d.days.map((x) => x.total || 0));
    const days = Array.from({ length: 14 }, (_, i) => addDays(d.today, i - 13));
    const dmap = Object.fromEntries(d.days.map((x) => [x.d, x]));
    main.innerHTML = hero(d.today) + `<div class="alert-strip" id="alert-strip" hidden></div>` + `
      <div class="kpis">
        <div class="card kpi dark"><div class="k">Spent in ${MONTHS_L[Number(d.month.slice(5)) - 1]}</div><div class="v"><span data-count="${d.month_totals.total}" data-dec="2">0</span><small>${cur()}</small></div></div>
        <div class="card kpi"><div class="k">${ic('list')} Orders this month</div><div class="v"><span data-count="${d.month_totals.orders}">0</span></div></div>
        <div class="card kpi ${d.open ? 'warn' : ''}"><div class="k">${ic('truck')} Waiting for delivery</div><div class="v"><span data-count="${d.open}">0</span></div></div>
        <a class="card kpi ${d.no_code ? 'warn' : ''}" href="#/catalog" style="text-decoration:none;color:inherit"><div class="k">${ic('alert')} Items with no code</div><div class="v"><span data-count="${d.no_code}">0</span></div></a>
      </div>
      <div class="rest-grid">${activeRest().map((r) => { const x = rmap[r.id] || { orders: 0, total: 0 }; return `
        <a class="card rest" style="--c:${r.color};text-decoration:none;color:inherit" href="#/new?r=${r.id}" data-rest="${r.id}">
          <div class="rn">${restLogo(r)}${esc(r.name)}</div>
          <div><div class="rv">${money(x.total)}</div><div class="rm">${x.orders} order${x.orders === 1 ? '' : 's'} this month${x.last ? ' · last ' + fmtDate(x.last) : ''}</div></div>
        </a>`; }).join('')}</div>
      <div class="cols">
        <div class="card"><div class="card-head"><h3>Recent orders</h3><a class="btn ghost sm" href="#/orders">See all</a></div>
          ${d.recent.length ? `<div class="table-wrap"><table class="t"><thead><tr><th>Order</th><th>Restaurant</th><th>Supplier</th><th class="hide-sm">Date</th><th>Status</th></tr></thead><tbody>
          ${d.recent.map((o) => `<tr class="click" data-go="#/orders/${o.id}"><td><span class="mono" style="font-size:13px">${esc(o.order_no)}</span></td>
            <td><span class="tag"><span class="dot" style="--c:${o.restaurant_color}"></span>${esc(o.restaurant)}</span></td><td>${esc(o.supplier)}</td>
            <td class="hide-sm">${fmtDate(o.order_date)}</td><td><span class="pill ${o.status}">${o.status}</span></td></tr>`).join('')}
          </tbody></table></div>` : `<div class="empty">${EMPTY_BOX}<b>No orders yet</b>Tap “New order” to make the first one.</div>`}
        </div>
        <div class="card"><div class="card-head"><h3>Last 14 days</h3><span class="muted" style="font-size:12.5px">${cur()} per day</span></div>
          <div style="padding:16px 18px">
            ${vbars(days.map((dd, i) => ({ v: (dmap[dd] && dmap[dd].total) || 0, label: i % 2 === 1 || i === 13 ? String(Number(dd.slice(8))) : '',
              hi: dd === d.today, title: `${fmtDate(dd)}: ${money((dmap[dd] && dmap[dd].total) || 0)} · ${(dmap[dd] && dmap[dd].orders) || 0} orders` })), max14, 180)}
            <p class="hint" style="margin:6px 0 0">Spending counts items that have a price in the catalog. Add prices in Catalog to see full totals.</p>
          </div>
        </div>
      </div>`;
    $$('[data-go]', main).forEach((tr) => tr.onclick = () => { location.hash = tr.dataset.go; });
    startScene(); countUp(main); paintBell(); refreshBell();
  } catch (e) { if (e.message !== 'Session ended') main.innerHTML += `<div class="form-error">${esc(e.message)}</div>`; }
}

// simple vertical bar chart (HTML, so labels never stretch)
function vbars(pts, max, height) {
  return `<div class="vbars" style="height:${height}px">${pts.map((p) => `<div class="vb" title="${esc(p.title)}">
    <div class="vb-bar ${p.hi ? 'hi' : ''} ${p.v ? '' : 'zero'}" style="height:${p.v ? Math.max(3, (p.v / (max || 1)) * 100) : 0}%"></div>
    <div class="vb-l">${esc(p.label)}</div></div>`).join('')}</div>`;
}

function pageMore() {
  const main = shell('more', pageHead('More', ''));
  main.innerHTML += `<div class="stack">${NAV.filter((n) => !['dashboard', 'orders', 'reports'].includes(n.h)).map((n) => `
    <a class="card card-pad" href="#/${n.h}" style="display:flex;gap:14px;align-items:center;text-decoration:none;color:inherit;font-weight:800">${ic(n.i)} ${n.t}</a>`).join('')}
    <button class="btn ghost block" id="lo3">${ic('out')} Log out</button></div>`;
  $('#lo3').onclick = () => logout();
}

// ================= NEW / EDIT ORDER =================
async function loadProducts(sid, force = false) {
  if (!state.products[sid] || force) state.products[sid] = (await api('products?supplier=' + sid)).products;
  return state.products[sid];
}
const DRAFT_KEY = 'oe_drafts_v1';
function drafts() { try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}'); } catch { return {}; } }
function saveDraft() {
  const ob = state.ob; if (!ob || ob.editId || !ob.rid || !ob.sid) return;
  try {
    const all = drafts(); const k = ob.rid + '|' + ob.sid;
    if (ob.items.size) all[k] = { items: [...ob.items.values()], note: ob.note, delivery: ob.delivery, at: Date.now() };
    else delete all[k];
    localStorage.setItem(DRAFT_KEY, JSON.stringify(all));
  } catch { /* storage blocked */ }
}
function clearDraft(rid, sid) { try { const all = drafts(); delete all[rid + '|' + sid]; localStorage.setItem(DRAFT_KEY, JSON.stringify(all)); } catch {} }

async function pageNewOrder(editId) {
  const params = new URLSearchParams((location.hash.split('?')[1]) || '');
  const rests = activeRest();
  state.ob = { rid: null, sid: null, items: new Map(), note: '', delivery: addDays(today(), 1), orderDate: today(), q: '', cat: '', usualOnly: false, usual: {}, last: {}, editId: editId || null, editNo: '' };
  const ob = state.ob;
  const main = shell(editId ? 'orders' : 'new', loading());
  if (editId) {
    try {
      const d = await api('orders/' + editId);
      ob.rid = d.order.restaurant_id; ob.sid = d.order.supplier_id; ob.note = d.order.note || ''; ob.delivery = d.order.delivery_date || ''; ob.orderDate = d.order.order_date; ob.editNo = d.order.order_no;
      d.items.forEach((it, i) => ob.items.set(it.product_id ? 'p' + it.product_id : 'x' + i, { product_id: it.product_id, code: it.code, name: it.name, pack: it.pack, unit: it.unit, price: it.price, qty: it.qty }));
    } catch (e) { main.innerHTML = `<div class="form-error">${esc(e.message)}</div>`; return; }
  } else {
    ob.rid = Number(params.get('r')) || (rests.length === 1 ? rests[0].id : null);
    ob.sid = Number(params.get('s')) || null;
    if (params.get('again')) {
      try {
        const d = await api('orders/' + Number(params.get('again')));
        ob.rid = d.order.restaurant_id; ob.sid = d.order.supplier_id;
        d.items.forEach((it, i) => ob.items.set(it.product_id ? 'p' + it.product_id : 'x' + i, { product_id: it.product_id, code: it.code, name: it.name, pack: it.pack, unit: it.unit, price: it.price, qty: it.qty }));
      } catch { /* start empty */ }
    }
  }
  renderBuilder();
}

function renderBuilder() {
  const ob = state.ob, main = $('#main');
  const r = ob.rid && restById(ob.rid), s = ob.sid && supById(ob.sid);
  const title = ob.editId ? `Edit order <span class="mono" style="font-size:20px">${esc(ob.editNo)}</span>` : 'New order';
  if (!r || !s) {
    main.innerHTML = pageHead(title, 'Choose where the order is for and who it goes to.', '', 'Step 1 of 2', { kind: 'cart', icon: 'cart' }) + `
      <div class="card card-pad stack">
        <div><p class="step-label"><i>1</i>Restaurant</p><div class="choose">${activeRest().map((x) => `
          <button class="tile ${ob.rid === x.id ? 'on' : ''}" style="--c:${x.color}" data-r="${x.id}">${restLogo(x)}<div><b>${esc(x.name)}</b></div></button>`).join('')}</div></div>
        <div><p class="step-label"><i>2</i>Supplier</p><div class="choose">${activeSup().map((x) => `
          <button class="tile ${ob.sid === x.id ? 'on' : ''}" style="--c:${x.color}" data-s="${x.id}"><span class="dot" style="--c:${x.color};width:14px;height:14px"></span><div><b>${esc(x.name)}</b><span>${x.products} items${x.no_code ? ` · ${x.no_code} without code` : ''}</span></div></button>`).join('')}</div></div>
        ${(() => { const dr = Object.entries(drafts()); return dr.length ? `<div><p class="step-label">${ic('note')} Unfinished orders on this device</p><div class="chips">${dr.map(([k, v]) => { const [ri, si] = k.split('|'); const rr = restById(ri), ss = supById(si); return rr && ss ? `<button class="chip" data-draft="${k}"><span class="dot" style="--c:${rr.color}"></span>${esc(rr.name)} → ${esc(ss.name)} · ${v.items.length} items</button>` : ''; }).join('')}</div></div>` : ''; })()}
      </div>`;
    $$('[data-r]', main).forEach((b) => b.onclick = () => { ob.rid = Number(b.dataset.r); pickedPair(); });
    $$('[data-s]', main).forEach((b) => b.onclick = () => { ob.sid = Number(b.dataset.s); pickedPair(); });
    $$('[data-draft]', main).forEach((b) => b.onclick = () => { const [ri, si] = b.dataset.draft.split('|'); ob.rid = Number(ri); ob.sid = Number(si); pickedPair(); });
    return;
  }
  main.innerHTML = pageHead(title, `${esc(r.name)} → ${esc(s.name)}`, `<button class="btn ghost sm" id="chg">${ic('again')} Change restaurant / supplier</button>`, 'Step 2 of 2', { kind: restKind(r), color: r.color, logo: restLogo(r, 'pb') }) + `
    <div class="builder">
      <div class="card">
        <div class="toolbar">
          <span class="tag" style="font-size:14px">${restLogo(r, 'sm')}${esc(r.name)}</span>
          <span class="muted">→</span><span class="tag" style="font-size:14px"><span class="dot" style="--c:${s.color}"></span>${esc(s.name)}</span>
        </div>
        <div class="toolbar">
          <div class="search">${ic('search')}<input class="input" id="pq" placeholder="Search name or code… e.g. wagyu, monin, FBDMN" value="${esc(ob.q)}" autocomplete="off" /></div>
          <button class="btn ghost sm" id="addx">${ic('plus')} Item not in list</button>
        </div>
        <div class="cat-row" id="cats"></div>
        <div class="plist" id="plist"><div class="empty">Loading catalog…</div></div>
      </div>
      <aside class="card cart" id="cart"></aside>
    </div>
    <button class="cartbar" id="cartbar"></button>`;
  $('#chg').onclick = () => { saveDraft(); ob.sid = null; ob.items = new Map(); renderBuilder(); };
  $('#pq').oninput = (e) => { ob.q = e.target.value; renderProductList(); };
  $('#addx').onclick = addCustomItem;
  $('#cartbar').onclick = () => { $('#cart').classList.add('open'); renderCart(); };
  renderCart();
  loadProducts(ob.sid).then(() => { renderCats(); renderProductList(); }).catch((e) => toast(e.message, true));
}
async function pickedPair() {
  const ob = state.ob;
  if (!ob.rid || !ob.sid) return renderBuilder();
  const d = drafts()[ob.rid + '|' + ob.sid];
  if (d && !ob.items.size) {
    d.items.forEach((it, i) => ob.items.set(it.product_id ? 'p' + it.product_id : 'x' + i, it));
    ob.note = d.note || ''; ob.delivery = d.delivery || ob.delivery;
    toast('Your unfinished order was brought back.');
  }
  try {
    const u = await api(`products/usual?restaurant=${ob.rid}&supplier=${ob.sid}`);
    ob.usual = Object.fromEntries(u.usual.map((x) => [x.product_id, x.times]));
    ob.last = Object.fromEntries(u.last.map((x) => [x.product_id, x.qty]));
  } catch { ob.usual = {}; ob.last = {}; }
  renderBuilder();
}
function renderCats() {
  const ob = state.ob, list = state.products[ob.sid] || [];
  const cats = [...new Set(list.map((p) => p.category).filter(Boolean))];
  const hasUsual = Object.keys(ob.usual).length > 0;
  $('#cats').innerHTML = `<button class="chip ${!ob.cat && !ob.usualOnly ? 'on' : ''}" data-c="">All · ${list.length}</button>
    ${hasUsual ? `<button class="chip ${ob.usualOnly ? 'on' : ''}" data-u="1">★ Usual for this restaurant</button>` : ''}
    ${cats.map((c) => `<button class="chip ${ob.cat === c ? 'on' : ''}" data-c="${esc(c)}">${esc(c)}</button>`).join('')}`;
  $$('#cats [data-c]').forEach((b) => b.onclick = () => { ob.cat = b.dataset.c; ob.usualOnly = false; renderCats(); renderProductList(); });
  $$('#cats [data-u]').forEach((b) => b.onclick = () => { ob.usualOnly = !ob.usualOnly; ob.cat = ''; renderCats(); renderProductList(); });
}
function productMatches(p, q) {
  if (!q) return true;
  const hay = `${p.code || ''} ${p.name} ${p.category || ''} ${p.pack || ''}`.toLowerCase();
  return q.toLowerCase().split(/\s+/).filter(Boolean).every((w) => hay.includes(w));
}
const thumbHtml = (p) => p.has_image ? `<div class="thumb"><img src="/api/products/${p.id}/image?v=${p.updated_at}" alt="" loading="lazy" /></div>` : `<div class="thumb">${esc(initials(p.name))}</div>`;
const codeHtml = (code) => code ? `<span class="code">${esc(code)}</span>` : '<span class="code missing">No code</span>';
function renderProductList() {
  const ob = state.ob, el = $('#plist'); if (!el) return;
  let list = (state.products[ob.sid] || []).filter((p) => productMatches(p, ob.q));
  if (ob.cat) list = list.filter((p) => p.category === ob.cat);
  if (ob.usualOnly) list = list.filter((p) => ob.usual[p.id]);
  list = [...list].sort((a, b) => (ob.usual[b.id] || 0) - (ob.usual[a.id] || 0) || String(a.name).localeCompare(b.name));
  if (!list.length) {
    el.innerHTML = `<div class="empty">${EMPTY_BOX}<b>${(state.products[ob.sid] || []).length ? 'Nothing matches' : 'No items for this supplier yet'}</b>
      ${isAdmin() ? `Add items in <a href="#/catalog">Catalog</a> or import an Excel file.` : 'Ask an Admin to add items to the catalog.'}
      <div style="margin-top:12px"><button class="btn ghost sm" id="addx2">${ic('plus')} Add “${esc(ob.q || 'an item')}” to this order</button></div></div>`;
    $('#addx2').onclick = () => addCustomItem(ob.q);
    return;
  }
  el.innerHTML = list.map((p) => {
    const it = ob.items.get('p' + p.id);
    return `<div class="prow ${it ? 'in' : ''} ${ob.flash === p.id ? 'flash' : ''}" data-p="${p.id}">${thumbHtml(p)}
      <div><div class="pname">${esc(p.name)}</div><div class="pmeta">${codeHtml(p.code)}${p.pack ? `<span>${esc(p.pack)}</span>` : ''}${p.unit ? `<span>/ ${esc(p.unit)}</span>` : ''}${p.price ? `<span>· ${money(p.price)}</span>` : ''}
        ${ob.usual[p.id] ? `<span class="star">★ ordered ${ob.usual[p.id]}×${ob.last[p.id] ? ` · last ${fmtQty(ob.last[p.id])}` : ''}</span>` : ''}</div></div>
      <div class="ctl">${it ? stepperHtml(it.qty, p.id) : `<button class="add-btn" data-add="${p.id}">+ Add</button>`}</div></div>`;
  }).join('');
  $$('[data-add]', el).forEach((b) => b.onclick = () => { const p = (state.products[ob.sid] || []).find((x) => x.id === Number(b.dataset.add)); setQty(p, ob.last[p.id] || 1); });
  bindSteppers(el, (pid, q) => { const p = (state.products[ob.sid] || []).find((x) => x.id === Number(pid)); setQty(p, q); });
}
const stepperHtml = (q, key) => `<div class="stepper" data-k="${key}"><button type="button" data-d="-1" aria-label="Less">−</button><input type="number" inputmode="decimal" min="0" step="any" value="${fmtQty(q).replace(/,/g, '')}" aria-label="Quantity" /><button type="button" data-d="1" aria-label="More">+</button></div>`;
function bindSteppers(root, cb) {
  $$('.stepper', root).forEach((st) => {
    const inp = $('input', st), k = st.dataset.k;
    $$('button', st).forEach((b) => b.onclick = () => { const v = Math.max(0, (Number(inp.value) || 0) + Number(b.dataset.d)); cb(k, v); });
    inp.onchange = () => cb(k, Math.max(0, Number(inp.value) || 0));
    inp.onfocus = () => inp.select();
  });
}
function setQty(p, q) {
  const ob = state.ob, key = 'p' + p.id;
  ob.bump = !ob.items.has(key) && q > 0; ob.flash = q > 0 && !ob.items.has(key) ? p.id : null;
  if (q > 0) {
    const cur = ob.items.get(key);
    if (cur) cur.qty = q; else ob.items.set(key, { product_id: p.id, code: p.code, name: p.name, pack: p.pack, unit: p.unit, price: p.price, qty: q });
  } else ob.items.delete(key);
  saveDraft(); renderProductList(); renderCart();
}
function addCustomItem(prefill) {
  const m = modal({ title: 'Add an item that is not in the catalog', body: `
    <div class="field"><label>Item name</label><input class="input" id="cx-n" value="${esc(typeof prefill === 'string' ? prefill : '')}" placeholder="e.g. Fresh mint" /></div>
    <div class="grid3"><div class="field"><label>Code (if known)</label><input class="input" id="cx-c" /></div>
      <div class="field"><label>Pack size</label><input class="input" id="cx-p" placeholder="e.g. 1 kg" /></div>
      <div class="field"><label>Quantity</label><input class="input" id="cx-q" type="number" min="0" step="any" value="1" /></div></div>
    ${isAdmin() ? `<label class="check"><input type="checkbox" id="cx-save" checked /> Also save it to the catalog for next time</label>` : ''}`,
  foot: `<button class="btn ghost" data-close>Cancel</button><button class="btn" id="cx-ok">Add to order</button>` });
  $('#cx-ok', m).onclick = () => act($('#cx-ok', m), async () => {
    const name = $('#cx-n', m).value.trim(), qty = Number($('#cx-q', m).value) || 0;
    if (!name || qty <= 0) throw new Error('Enter the item name and a quantity.');
    const item = { product_id: null, code: $('#cx-c', m).value.trim() || null, name, pack: $('#cx-p', m).value.trim() || null, unit: null, price: null, qty };
    const ob = state.ob;
    if ($('#cx-save', m) && $('#cx-save', m).checked) {
      const r = await api('products', { method: 'POST', body: { supplier_id: ob.sid, code: item.code, name, pack: item.pack } });
      item.product_id = r.id; await loadProducts(ob.sid, true); renderCats();
      ob.items.set('p' + r.id, item);
    } else ob.items.set('x' + Date.now(), item);
    closeModal(); saveDraft(); renderProductList(); renderCart(); toast('Added to the order.');
  });
}
function renderCart() {
  const ob = state.ob, el = $('#cart'); if (!el) return;
  const items = [...ob.items.entries()];
  const total = items.reduce((s, [, it]) => s + (it.price ? it.price * it.qty : 0), 0);
  const noCode = items.filter(([, it]) => !it.code).length;
  const r = restById(ob.rid), s = supById(ob.sid);
  el.innerHTML = `<div class="cart-head"><h3>${ic('cart')} Order <span class="count ${ob.bump ? 'bump' : ''}">${items.length}</span></h3>${cartTruck(items.length)}<button class="x" id="cart-close" aria-label="Close" style="display:none">×</button></div>
    <div class="cart-to"><span><b>For</b> ${esc(r.name)}</span><span><b>To</b> ${esc(s.name)}</span></div>
    <div class="cart-items">${items.length ? items.map(([k, it]) => `<div class="citem"><div><div class="n">${esc(it.name)}</div>
      <div class="m">${codeHtml(it.code)}${it.pack ? esc(it.pack) : ''}</div></div>${stepperHtml(it.qty, k)}</div>`).join('')
      : `<div class="cart-empty">${ic('cart')}<br>Tap <b>+ Add</b> on an item.<br>Codes are filled in for you.</div>`}</div>
    <div class="cart-foot">
      ${noCode ? `<div class="hint" style="color:var(--warn)">${ic('alert')} ${noCode} item${noCode > 1 ? 's have' : ' has'} no code — the supplier will see the name only.</div>` : ''}
      <div class="grid2"><div class="field" style="margin:0"><label>Order date</label><input class="input" type="date" id="od" value="${esc(ob.orderDate)}" /></div>
        <div class="field" style="margin:0"><label>Delivery date</label><input class="input" type="date" id="dd" value="${esc(ob.delivery)}" /></div></div>
      <div class="field" style="margin:0"><label>Note to supplier</label><textarea class="textarea" id="on" style="min-height:60px" placeholder="e.g. Deliver before 10 am">${esc(ob.note)}</textarea></div>
      <div class="cart-total"><span>Estimated total</span><span class="v">${money(total)}</span></div>
      <button class="btn block crema" id="place" ${items.length ? '' : 'disabled'}>${ic('check')} ${ob.editId ? 'Save changes' : 'Place order'}</button>
    </div>`;
  bindSteppers(el, (k, q) => {
    const it = ob.items.get(k); if (!it) return;
    if (q > 0) it.qty = q; else ob.items.delete(k);
    saveDraft(); renderCart(); renderProductList();
  });
  $('#od').onchange = (e) => { ob.orderDate = e.target.value || today(); };
  $('#dd').onchange = (e) => { ob.delivery = e.target.value; saveDraft(); };
  $('#on').oninput = (e) => { ob.note = e.target.value; saveDraft(); };
  $('#place').onclick = () => placeOrder($('#place'));
  if (el.classList.contains('open')) $('#cart-close').style.display = '';
  $('#cart-close').onclick = () => el.classList.remove('open');
  const bar = $('#cartbar');
  if (bar) { bar.style.display = items.length ? '' : 'none'; bar.innerHTML = `<span>${ic('cart')} ${items.length} item${items.length === 1 ? '' : 's'} · ${money(total)}</span><span>Review →</span>`; }
}
function placeOrder(btn) {
  const ob = state.ob;
  act(btn, async () => {
    const body = { restaurant_id: ob.rid, supplier_id: ob.sid, order_date: ob.orderDate, delivery_date: ob.delivery, note: ob.note, items: [...ob.items.values()] };
    if (ob.editId) {
      await api('orders/' + ob.editId, { method: 'PUT', body });
      toast('Order saved.'); location.hash = '#/orders/' + ob.editId;
    } else {
      const r = await api('orders', { method: 'POST', body });
      clearDraft(ob.rid, ob.sid);
      const tr = $('.cart-truck'); if (tr && !calm()) { tr.classList.add('go'); await new Promise((res) => setTimeout(res, 750)); }
      toast(`Order ${r.order_no} placed.`); location.hash = '#/orders/' + r.id + '?sent=1';
    }
  });
}

// ================= ORDER DETAIL =================
function waText(o, items) {
  const st = state.boot.settings;
  const lines = items.map((it, i) => `${i + 1}. ${it.code ? it.code + ' — ' : ''}${it.name}${it.pack ? ' (' + it.pack + ')' : ''} × ${fmtQty(it.qty)}${it.unit ? ' ' + it.unit : ''}`);
  return [`${st.greeting},`, '', `*Order ${o.order_no}* for *${o.restaurant}*`, `Order date: ${fmtDate(o.order_date)}`, o.delivery_date ? `Delivery: ${fmtDate(o.delivery_date)}` : null, '',
    ...lines, '', o.note ? `Note: ${o.note}` : null, o.note ? '' : null, `${st.signoff}`, `${o.created_by || ''} · ${st.company}`].filter((x) => x !== null).join('\n');
}
async function pageOrder(id) {
  const main = shell('orders', loading());
  let d;
  try { d = await api('orders/' + id); } catch (e) { main.innerHTML = `<div class="form-error">${esc(e.message)}</div>`; return; }
  const o = d.order, items = d.items, msg = waText(o, items);
  const justSent = /sent=1/.test(location.hash);
  if (justSent) history.replaceState(null, '', '#/orders/' + id);
  const phone = String(o.supplier_phone || '').replace(/[^\d]/g, '');
  const canEdit = o.status === 'ordered' || isAdmin();
  main.innerHTML = pageHead(`<span class="mono">${esc(o.order_no)}</span>`, `${esc(o.restaurant)} → ${esc(o.supplier)}`, `
      <span class="pill ${o.status}" style="font-size:13px;padding:6px 12px">${o.status === 'ordered' ? 'Waiting for delivery' : o.status}</span>`,
      `<a href="#/orders" style="color:inherit">← Orders</a>`, { kind: 'orders', color: o.restaurant_color, logo: restLogo(restById(o.restaurant_id) || { name: o.restaurant, color: o.restaurant_color, short: o.restaurant_short }, 'pb') }) + `
    ${justSent ? `<div class="card sent-banner"><div class="sb-road" aria-hidden="true"><i class="road-line"></i><span class="sb-truck">${TRUCK}</span></div><div class="sb-text"><b>Order saved.</b> Now send it to ${esc(o.supplier)}: copy the message or open WhatsApp.</div></div>` : ''}
    <div class="cols">
      <div class="stack">
        <div class="card">
          <div class="od-head">
            <div><span class="label">Restaurant</span><b class="tag" style="font-size:15px"><span class="dot" style="--c:${o.restaurant_color}"></span>${esc(o.restaurant)}</b></div>
            <div><span class="label">Supplier</span><b>${esc(o.supplier)}</b></div>
            <div><span class="label">Order date</span><b>${fmtDate(o.order_date)}</b></div>
            <div><span class="label">Delivery</span><b>${fmtDate(o.delivery_date)}</b></div>
          </div>
          <div class="table-wrap"><table class="t"><thead><tr><th>#</th><th>Code</th><th>Item</th><th class="hide-sm">Pack</th><th class="r">Qty</th><th class="r hide-sm">Price</th><th class="r">Amount</th></tr></thead>
            <tbody>${items.map((it, i) => `<tr><td class="muted">${i + 1}</td><td>${codeHtml(it.code)}</td><td><b>${esc(it.name)}</b></td><td class="hide-sm">${esc(it.pack || '')}</td>
              <td class="r num"><b>${fmtQty(it.qty)}</b> ${esc(it.unit || '')}</td><td class="r num hide-sm">${it.price ? fmtNum(it.price) : '—'}</td><td class="r num">${it.price ? fmtNum(it.price * it.qty) : '—'}</td></tr>`).join('')}</tbody>
            <tfoot><tr><td colspan="4" class="hide-sm"></td><td colspan="2" class="r">Total</td><td class="r num">${money(o.total)}</td></tr></tfoot></table></div>
          ${o.note ? `<div class="note-box"><b>Note:</b> ${esc(o.note)}</div>` : ''}
          <div class="card-pad muted" style="font-size:12.5px;padding-top:6px">Placed by ${esc(o.created_by || '—')} · ${fmtTs(o.created_at)}${o.received_at ? ` · Received by ${esc(o.received_by)} · ${fmtTs(o.received_at)}` : ''}</div>
        </div>
        <div class="actions no-print">
          ${o.status === 'ordered' ? `<button class="btn" id="rcv">${ic('check')} Mark as received</button>` : ''}
          ${canEdit ? `<a class="btn ghost" href="#/edit/${o.id}">${ic('edit')} Edit</a>` : ''}
          <a class="btn ghost" href="#/new?again=${o.id}">${ic('again')} Order again</a>
          ${o.status === 'ordered' ? `<button class="btn danger" id="cnl">${ic('x')} Cancel order</button>` : ''}
          ${o.status !== 'ordered' && isAdmin() ? `<button class="btn ghost" id="reopen">Set back to “waiting”</button>` : ''}
          ${isAdmin() ? `<button class="btn danger" id="del">${ic('trash')} Delete</button>` : ''}
        </div>
      </div>
      <div class="card no-print">
        <div class="card-head"><h3>Send to ${esc(o.supplier)}</h3></div>
        <div class="card-pad stack" style="gap:12px">
          <div class="msg" id="msg">${esc(msg)}</div>
          <div class="actions">
            <button class="btn" id="cp">${ic('copy')} Copy message</button>
            <a class="btn wa" target="_blank" rel="noopener" href="https://wa.me/${phone}?text=${encodeURIComponent(msg)}">${ic('wa')} WhatsApp${phone ? '' : ' (pick chat)'}</a>
          </div>
          <div class="actions">
            <button class="btn ghost" id="po">${ic('pdf')} Purchase order PDF</button>
            ${o.supplier_email ? `<a class="btn ghost" href="mailto:${esc(o.supplier_email)}?subject=${encodeURIComponent('Order ' + o.order_no + ' — ' + o.restaurant)}&body=${encodeURIComponent(msg.replace(/\*/g, ''))}">${ic('mail')} Email</a>` : ''}
          </div>
          ${phone ? '' : `<p class="hint" style="margin:0">Add the supplier’s WhatsApp number in <a href="#/suppliers">Suppliers</a> so this button opens their chat directly.</p>`}
        </div>
      </div>
    </div>`;
  $('#cp').onclick = async () => {
    try { await navigator.clipboard.writeText(msg); toast('Message copied — paste it in WhatsApp.'); }
    catch { const r = document.createRange(); r.selectNodeContents($('#msg')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); toast('Press Copy on the highlighted text.'); }
  };
  $('#po').onclick = () => act($('#po'), () => poPdf(o, items));
  const setStatus = (s, label) => act(null, async () => { await api(`orders/${o.id}/status`, { method: 'POST', body: { status: s } }); toast(label); pageOrder(o.id); });
  if ($('#rcv')) $('#rcv').onclick = () => { confetti($('#rcv')); setStatus('received', 'Marked as received. ✓'); };
  if ($('#cnl')) $('#cnl').onclick = async () => { if (await confirmBox('Cancel this order?', 'It stays in the history but is left out of reports.', 'Cancel order', true)) setStatus('cancelled', 'Order cancelled.'); };
  if ($('#reopen')) $('#reopen').onclick = () => setStatus('ordered', 'Order is waiting for delivery again.');
  if ($('#del')) $('#del').onclick = async () => {
    if (await confirmBox('Delete this order for good?', 'This cannot be undone. Use “Cancel order” if you only want to keep it out of reports.', 'Delete', true)) {
      act(null, async () => { await api('orders/' + o.id, { method: 'DELETE' }); toast('Order deleted.'); location.hash = '#/orders'; });
    }
  };
}

// ---------- PDF helpers ----------
let logoData = null;
async function getLogo() {
  if (logoData !== null) return logoData;
  try {
    const blob = await (await fetch('img/ghaya.png')).blob();
    logoData = await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(blob); });
  } catch { logoData = ''; }
  return logoData;
}
function needPdf() { if (!window.jspdf || !window.jspdf.jsPDF) throw new Error('PDF tool did not load. Refresh the page and try again.'); return new window.jspdf.jsPDF({ unit: 'pt', format: 'a4' }); }
const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
async function poPdf(o, items) {
  const doc = needPdf(), st = state.boot.settings, W = doc.internal.pageSize.getWidth();
  const logo = await getLogo();
  if (logo) doc.addImage(logo, 'PNG', 40, 30, 62, 62);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.text(st.company, logo ? 112 : 40, 56);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(110); doc.text(o.restaurant, logo ? 112 : 40, 72);
  doc.setTextColor(40); doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.text('PURCHASE ORDER', W - 40, 56, { align: 'right' });
  doc.setFont('courier', 'bold'); doc.setFontSize(12); doc.text(o.order_no, W - 40, 74, { align: 'right' });
  doc.setDrawColor(215, 164, 110); doc.setLineWidth(1.5); doc.line(40, 104, W - 40, 104);
  const box = (x, label, lines) => { doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(140); doc.text(label.toUpperCase(), x, 126); doc.setTextColor(30); doc.setFontSize(11); lines.filter(Boolean).forEach((l, i) => { doc.setFont('helvetica', i ? 'normal' : 'bold'); doc.text(String(l), x, 142 + i * 14); }); };
  box(40, 'Supplier', [o.supplier, o.supplier_contact, o.supplier_phone, o.supplier_email]);
  box(230, 'Deliver to', [o.restaurant, restById(o.restaurant_id) && restById(o.restaurant_id).address]);
  box(410, 'Dates', [`Order: ${fmtDate(o.order_date)}`, `Delivery: ${fmtDate(o.delivery_date)}`]);
  const hasPrice = items.some((it) => it.price);
  doc.autoTable({
    startY: 200, margin: { left: 40, right: 40 },
    head: [['#', 'Code', 'Item', 'Pack', 'Qty', 'Unit', ...(hasPrice ? ['Price', 'Amount'] : [])]],
    body: items.map((it, i) => [i + 1, it.code || '—', it.name, it.pack || '', fmtQty(it.qty), it.unit || '', ...(hasPrice ? [it.price ? fmtNum(it.price) : '—', it.price ? fmtNum(it.price * it.qty) : '—'] : [])]),
    foot: hasPrice ? [['', '', '', '', '', '', 'Total', `${cur()} ${fmtNum(o.total)}`]] : undefined,
    styles: { fontSize: 9.5, cellPadding: 6, lineColor: [227, 221, 210], lineWidth: 0.5 },
    headStyles: { fillColor: [40, 40, 40], textColor: 255, fontStyle: 'bold' },
    footStyles: { fillColor: [246, 234, 219], textColor: 30, fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 24 }, 1: { font: 'courier', fontStyle: 'bold', cellWidth: 74 }, 4: { halign: 'right', fontStyle: 'bold' }, 6: { halign: 'right' }, 7: { halign: 'right' } },
    alternateRowStyles: { fillColor: [251, 249, 245] },
  });
  let y = doc.lastAutoTable.finalY + 24;
  if (o.note) { doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.text('Note', 40, y); doc.setFont('helvetica', 'normal'); const t = doc.splitTextToSize(o.note, W - 80); doc.text(t, 40, y + 14); y += 20 + t.length * 12; }
  y = Math.max(y + 30, doc.internal.pageSize.getHeight() - 110);
  doc.setDrawColor(180); doc.setLineWidth(.5);
  [['Ordered by', o.created_by || ''], ['Received by', o.received_by || '']].forEach(([l, n], i) => { const x = 40 + i * 270; doc.line(x, y, x + 200, y); doc.setFontSize(9); doc.setTextColor(120); doc.text(`${l}${n ? ': ' + n : ''}`, x, y + 14); });
  pdfFooter(doc);
  doc.save(safeName(`PO ${o.order_no} - ${o.restaurant} - ${o.supplier}.pdf`));
}
function pdfFooter(doc) {
  const n = doc.getNumberOfPages(), W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= n; i++) { doc.setPage(i); doc.setFontSize(8); doc.setTextColor(150); doc.setFont('helvetica', 'normal'); doc.text(`OrderEase · ${state.boot.settings.company} · printed ${fmtDate(today())}`, 40, H - 24); doc.text(`Page ${i} of ${n}`, W - 40, H - 24, { align: 'right' }); }
}

// ================= ORDERS LIST =================
const ordersFilter = { from: '', to: '', restaurant: '', supplier: '', status: '', q: '' };
async function pageOrders() {
  if (!ordersFilter.from) { ordersFilter.from = addDays(today(), -30); ordersFilter.to = today(); }
  const f = ordersFilter;
  const main = shell('orders', pageHead('Orders', 'Every order from all restaurants. Tap one to send, print or mark as received.', `<a class="btn crema" href="#/new">${ic('plus')} New order</a>`, 'Purchasing', { kind: 'orders', icon: 'list' }) + '<div class="alert-strip" id="alert-strip" hidden></div>' + `
    <div class="card">
      <div class="filters">
        <div class="field"><label>From</label><input class="input" type="date" id="f-from" value="${f.from}" /></div>
        <div class="field"><label>To</label><input class="input" type="date" id="f-to" value="${f.to}" /></div>
        <div class="field"><label>Restaurant</label><select class="select" id="f-r"><option value="">All</option>${state.boot.restaurants.map((r) => `<option value="${r.id}" ${String(r.id) === f.restaurant ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select></div>
        <div class="field"><label>Supplier</label><select class="select" id="f-s"><option value="">All</option>${state.boot.suppliers.map((s) => `<option value="${s.id}" ${String(s.id) === f.supplier ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></div>
        <div class="field"><label>Status</label><select class="select" id="f-st"><option value="">All</option>${['ordered', 'received', 'cancelled'].map((s) => `<option value="${s}" ${s === f.status ? 'selected' : ''}>${s === 'ordered' ? 'Waiting for delivery' : s[0].toUpperCase() + s.slice(1)}</option>`).join('')}</select></div>
        <div class="field" style="flex:1"><label>Search</label><input class="input" id="f-q" placeholder="Order no., item or code" value="${esc(f.q)}" /></div>
      </div>
      <div id="olist"><div class="empty">Loading…</div></div>
    </div>`);
  const load = async () => {
    const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v));
    try {
      const { orders } = await api('orders?' + qs);
      const el = $('#olist'); if (!el) return;
      el.innerHTML = orders.length ? `<div class="table-wrap"><table class="t"><thead><tr><th>Order</th><th>Date</th><th>Restaurant</th><th>Supplier</th><th class="r hide-sm">Items</th><th class="r">Total</th><th>Status</th></tr></thead><tbody>
        ${orders.map((o) => `<tr class="click" data-go="#/orders/${o.id}"><td class="mono" style="font-size:13px">${esc(o.order_no)}</td><td>${fmtDate(o.order_date)}</td>
          <td><span class="tag"><span class="dot" style="--c:${o.restaurant_color}"></span>${esc(o.restaurant)}</span></td><td>${esc(o.supplier)}</td>
          <td class="r num hide-sm">${o.items_count}</td><td class="r num">${money(o.total)}</td><td><span class="pill ${o.status}">${o.status}</span></td></tr>`).join('')}</tbody></table></div>`
        : `<div class="empty">${EMPTY_BOX}<b>No orders found</b>Try a wider date range or clear the filters.</div>`;
      $$('[data-go]', el).forEach((tr) => tr.onclick = () => { location.hash = tr.dataset.go; });
    } catch (e) { toast(e.message, true); }
  };
  const bind = (id, k) => { $(id).onchange = (e) => { f[k] = e.target.value; load(); }; };
  paintBell(); refreshBell();
  bind('#f-from', 'from'); bind('#f-to', 'to'); bind('#f-r', 'restaurant'); bind('#f-s', 'supplier'); bind('#f-st', 'status');
  let t; $('#f-q').oninput = (e) => { f.q = e.target.value; clearTimeout(t); t = setTimeout(load, 300); };
  load();
}

// ================= CATALOG =================
const cat = { sid: null, q: '', showHidden: false };
async function pageCatalog() {
  if (!cat.sid || !supById(cat.sid)) cat.sid = (activeSup()[0] || state.boot.suppliers[0] || {}).id;
  const main = shell('catalog', pageHead('Catalog', 'Every item with its supplier code. Add items one by one or import an Excel file.', isAdmin() ? `
      <button class="btn ghost" id="tpl">${ic('download')} Excel template</button>
      <button class="btn ghost" id="imp">${ic('upload')} Import Excel</button>
      <button class="btn" id="addp">${ic('plus')} Add item</button>` : '', 'Products & codes', { kind: 'catalog', icon: 'box' }) + `
    <div class="card">
      <div class="toolbar"><div class="chips" id="sup-chips">${state.boot.suppliers.map((s) => `<button class="chip ${s.id === cat.sid ? 'on' : ''}" data-s="${s.id}"><span class="dot" style="--c:${s.color}"></span>${esc(s.name)}</button>`).join('')}</div></div>
      <div class="toolbar"><div class="search">${ic('search')}<input class="input" id="cq" placeholder="Search name, code or category" value="${esc(cat.q)}" /></div>
        ${isAdmin() ? `<label class="check"><input type="checkbox" id="ch" ${cat.showHidden ? 'checked' : ''}/> Show hidden items</label><button class="btn ghost sm" id="exp">${ic('excel')} Export</button>` : ''}</div>
      <div id="clist"><div class="empty">Loading…</div></div>
    </div>`);
  $$('#sup-chips [data-s]').forEach((b) => b.onclick = () => { cat.sid = Number(b.dataset.s); pageCatalog(); });
  $('#cq').oninput = (e) => { cat.q = e.target.value; drawCatalog(); };
  if (isAdmin()) {
    $('#ch').onchange = (e) => { cat.showHidden = e.target.checked; loadCatalog(); };
    $('#addp').onclick = () => productForm(null);
    $('#tpl').onclick = () => act($('#tpl'), downloadTemplate);
    $('#imp').onclick = importExcel;
    $('#exp').onclick = () => act($('#exp'), exportCatalog);
  }
  loadCatalog();
}
let catRows = [];
async function loadCatalog() {
  try { catRows = (await api(`products?supplier=${cat.sid}${cat.showHidden ? '&all=1' : ''}`)).products; drawCatalog(); } catch (e) { toast(e.message, true); }
}
function drawCatalog() {
  const el = $('#clist'); if (!el) return;
  const rows = catRows.filter((p) => productMatches(p, cat.q));
  const missing = catRows.filter((p) => p.active && !p.code).length;
  el.innerHTML = (missing ? `<div style="padding:12px 16px;background:var(--warn-bg);color:var(--warn);font-size:13.5px;font-weight:600">${ic('alert')} ${missing} item${missing > 1 ? 's' : ''} still need a code. Tap an item to add it.</div>` : '') +
    (rows.length ? `<div class="table-wrap"><table class="t"><thead><tr><th></th><th>Code</th><th>Item</th><th class="hide-sm">Category</th><th class="hide-sm">Pack</th><th class="r">Price</th><th class="r hide-sm">Ordered</th></tr></thead><tbody>
      ${rows.map((p) => `<tr class="${isAdmin() ? 'click' : ''} ${p.active ? '' : 'off'}" data-p="${p.id}"><td style="width:58px">${thumbHtml(p)}</td><td>${codeHtml(p.code)}</td><td><b>${esc(p.name)}</b>${p.active ? '' : ' <span class="muted">(hidden)</span>'}${p.unit ? `<div class="muted" style="font-size:12.5px">per ${esc(p.unit)}</div>` : ''}</td>
        <td class="hide-sm">${esc(p.category || '')}</td><td class="hide-sm">${esc(p.pack || '')}</td><td class="r num">${p.price ? fmtNum(p.price) : '—'}</td><td class="r num hide-sm">${p.used || ''}</td></tr>`).join('')}</tbody></table></div>`
    : `<div class="empty">${EMPTY_BOX}<b>${catRows.length ? 'Nothing matches' : 'No items for this supplier yet'}</b>${isAdmin() ? 'Use “Add item” or “Import Excel”.' : ''}</div>`);
  if (isAdmin()) $$('[data-p]', el).forEach((tr) => tr.onclick = () => productForm(catRows.find((p) => p.id === Number(tr.dataset.p))));
}
function productForm(p) {
  const isNew = !p; p = p || { supplier_id: cat.sid, active: 1 };
  let image; // undefined = unchanged, '' = removed, dataURL = new
  const cats = state.boot.categories;
  const m = modal({ title: isNew ? 'Add item' : 'Edit item', wide: true, body: `
    <div class="img-drop field"><div class="thumb" id="pf-th">${p.has_image ? `<img src="/api/products/${p.id}/image?v=${p.updated_at}" alt="" />` : esc(initials(p.name || '+'))}</div>
      <div class="actions"><label class="btn ghost sm" style="cursor:pointer">${ic('upload')} Photo<input type="file" accept="image/*" id="pf-img" hidden /></label>${p.has_image ? '<button class="btn ghost sm" id="pf-rm">Remove photo</button>' : ''}</div></div>
    <div class="grid2">
      <div class="field"><label>Supplier</label><select class="select" id="pf-s">${state.boot.suppliers.map((s) => `<option value="${s.id}" ${s.id === p.supplier_id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></div>
      <div class="field"><label>Supplier code</label><input class="input mono" id="pf-c" value="${esc(p.code || '')}" placeholder="e.g. FBDMN031" /></div>
    </div>
    <div class="field"><label>Item name</label><input class="input" id="pf-n" value="${esc(p.name || '')}" placeholder="e.g. Wagyu trimmings 65/35" /></div>
    <div class="grid3">
      <div class="field"><label>Category</label><input class="input" id="pf-cat" list="pf-cats" value="${esc(p.category || '')}" placeholder="e.g. Meat" /><datalist id="pf-cats">${cats.map((c) => `<option value="${esc(c)}">`).join('')}</datalist></div>
      <div class="field"><label>Pack size</label><input class="input" id="pf-pk" value="${esc(p.pack || '')}" placeholder="e.g. 4 x 2 kg" /></div>
      <div class="field"><label>Order unit</label><input class="input" id="pf-u" value="${esc(p.unit || '')}" placeholder="carton, box, kg…" /></div>
    </div>
    <div class="grid2"><div class="field"><label>Price per unit (${cur()}) — optional</label><input class="input" id="pf-pr" type="number" step="0.01" min="0" value="${p.price ?? ''}" /></div>
      <div class="field"><label>&nbsp;</label><label class="check"><input type="checkbox" id="pf-a" ${p.active ? 'checked' : ''} /> Show this item when ordering</label></div></div>`,
  foot: `${!isNew ? `<button class="btn danger" id="pf-del" style="margin-right:auto">${ic('trash')} ${p.used ? 'Hide' : 'Delete'}</button>` : ''}<button class="btn ghost" data-close>Cancel</button><button class="btn" id="pf-ok">Save</button>` });
  $('#pf-img', m).onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { image = await shrinkImage(f, 320); $('#pf-th', m).innerHTML = `<img src="${image}" alt="" />`; } catch { toast('Could not read that photo.', true); }
  };
  if ($('#pf-rm', m)) $('#pf-rm', m).onclick = () => { image = ''; $('#pf-th', m).textContent = initials(p.name); };
  $('#pf-ok', m).onclick = () => act($('#pf-ok', m), async () => {
    const body = { supplier_id: Number($('#pf-s', m).value), code: $('#pf-c', m).value, name: $('#pf-n', m).value, category: $('#pf-cat', m).value, pack: $('#pf-pk', m).value,
      unit: $('#pf-u', m).value, price: $('#pf-pr', m).value, active: $('#pf-a', m).checked };
    if (image !== undefined) body.image = image;
    await api(isNew ? 'products' : 'products/' + p.id, { method: isNew ? 'POST' : 'PUT', body });
    closeModal(); toast('Item saved.'); await refreshBoot(); loadCatalog();
  });
  if ($('#pf-del', m)) $('#pf-del', m).onclick = () => act($('#pf-del', m), async () => {
    if (!(await confirmBox(p.used ? 'Hide this item?' : 'Delete this item?', p.used ? 'It was used in past orders, so it will be hidden (old orders stay correct).' : 'It has never been ordered and will be removed.', p.used ? 'Hide' : 'Delete', true))) return;
    await api('products/' + p.id, { method: 'DELETE' }); toast(p.used ? 'Item hidden.' : 'Item deleted.'); await refreshBoot(); loadCatalog();
  });
}
function shrinkImage(file, max) {
  return new Promise((res, rej) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      res(c.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = rej; img.src = url;
  });
}
async function refreshBoot() { const b = await api('bootstrap'); Object.assign(state.boot, b); state.products = {}; }
function needExcel() { if (!window.ExcelJS) throw new Error('Excel tool did not load. Refresh the page and try again.'); return new window.ExcelJS.Workbook(); }
async function saveWb(wb, name) {
  const buf = await wb.xlsx.writeBuffer();
  downloadBlob(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), name);
}
function downloadBlob(blob, name) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = safeName(name);
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
const CAT_COLS = [['Supplier', 'supplier', 18], ['Code', 'code', 16], ['Item name', 'name', 42], ['Category', 'category', 16], ['Pack size', 'pack', 14], ['Unit', 'unit', 12], ['Price', 'price', 10]];
function styleHeader(ws) {
  const r = ws.getRow(1); r.font = { bold: true, color: { argb: 'FFFFFFFF' } }; r.height = 22;
  r.eachCell((c) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF282828' } }; c.alignment = { vertical: 'middle' }; });
  ws.views = [{ state: 'frozen', ySplit: 1 }];
}
async function downloadTemplate() {
  const wb = needExcel(); wb.creator = APP_NAME;
  const ws = wb.addWorksheet('Items');
  ws.columns = CAT_COLS.map(([h, k, w]) => ({ header: h, key: k, width: w }));
  ws.addRow({ supplier: 'Gulfwest', code: 'FBDMN031', name: 'Wagyu trimmings 65/35', category: 'Meat', pack: '25 kg', unit: 'carton', price: '' });
  ws.addRow({ supplier: 'Bidfood', code: '449221', name: 'Monin Peach syrup', category: 'Syrups', pack: '70 cl', unit: 'bottle', price: '' });
  styleHeader(ws);
  const h = wb.addWorksheet('How to fill');
  h.columns = [{ width: 100 }];
  ['How to fill this file', '', '• One row per item. Only “Supplier” and “Item name” are needed — the rest can be added later.',
    '• Supplier must match a supplier name in OrderEase. A new name creates a new supplier.',
    '• If the code (or the name, when there is no code) already exists for that supplier, the item is updated instead of added twice.',
    '• Price is optional. Leave it empty to keep the price already in OrderEase.',
    '• Delete the 2 example rows, then upload with Catalog → Import Excel.'].forEach((t, i) => { const r = h.addRow([t]); if (!i) r.font = { bold: true, size: 14 }; });
  await saveWb(wb, 'OrderEase - catalog template.xlsx');
}
async function exportCatalog() {
  const wb = needExcel(); wb.creator = APP_NAME;
  const ws = wb.addWorksheet('Items');
  ws.columns = CAT_COLS.map(([h, k, w]) => ({ header: h, key: k, width: w }));
  for (const s of state.boot.suppliers) {
    const { products } = await api('products?supplier=' + s.id);
    products.forEach((p) => ws.addRow({ ...p, supplier: s.name, price: p.price ?? '' }));
  }
  styleHeader(ws);
  await saveWb(wb, `OrderEase catalog - ${today()}.xlsx`);
}
function importExcel() {
  const m = modal({ title: 'Import items from Excel', wide: true, body: `
    <p style="margin-top:0">Use the <b>Excel template</b> (columns: Supplier, Code, Item name, Category, Pack size, Unit, Price). Items that already exist are updated, new ones are added.</p>
    <div class="field"><label>Excel file (.xlsx)</label><input class="input" type="file" id="ix-f" accept=".xlsx" /></div>
    <div class="field"><label>Supplier for every row (only if the file has no Supplier column)</label><select class="select" id="ix-s"><option value="">Use the Supplier column</option>${state.boot.suppliers.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select></div>
    <div id="ix-prev"></div>`,
  foot: `<button class="btn ghost" data-close>Cancel</button><button class="btn" id="ix-ok" disabled>Import</button>` });
  let rows = [];
  $('#ix-f', m).onchange = (e) => act(null, async () => {
    const f = e.target.files[0]; if (!f) return;
    const wb = needExcel(); await wb.xlsx.load(await f.arrayBuffer());
    const ws = wb.worksheets[0];
    const head = []; ws.getRow(1).eachCell({ includeEmpty: true }, (c, i) => { head[i] = String(c.text || '').trim().toLowerCase(); });
    const find = (...names) => head.findIndex((h) => h && names.some((n) => h.includes(n)));
    const col = { supplier: find('supplier'), code: find('code', 'sku', 'item no'), name: find('item name', 'name', 'description', 'item'), category: find('category', 'group'), pack: find('pack', 'size'), unit: find('unit', 'uom'), price: find('price', 'cost') };
    if (col.name < 1) throw new Error('Could not find an “Item name” column in the first row.');
    rows = [];
    ws.eachRow((r, i) => { if (i === 1) return; const g = (k) => (col[k] > 0 ? String(r.getCell(col[k]).text || '').trim() : ''); const row = { supplier: g('supplier'), code: g('code'), name: g('name'), category: g('category'), pack: g('pack'), unit: g('unit'), price: g('price') }; if (row.name) rows.push(row); });
    $('#ix-prev', m).innerHTML = `<p><b>${rows.length}</b> items found. First rows:</p><div class="table-wrap card"><table class="t"><thead><tr><th>Supplier</th><th>Code</th><th>Item</th><th>Pack</th><th>Price</th></tr></thead><tbody>
      ${rows.slice(0, 6).map((r) => `<tr><td>${esc(r.supplier || '—')}</td><td>${codeHtml(r.code)}</td><td>${esc(r.name)}</td><td>${esc(r.pack)}</td><td>${esc(r.price)}</td></tr>`).join('')}</tbody></table></div>`;
    $('#ix-ok', m).disabled = !rows.length;
  });
  $('#ix-ok', m).onclick = () => act($('#ix-ok', m), async () => {
    const r = await api('products/import', { method: 'POST', body: { rows, supplier_id: Number($('#ix-s', m).value) || null } });
    closeModal();
    toast(`Done: ${r.added} added, ${r.updated} updated${r.new_suppliers ? `, ${r.new_suppliers} new suppliers` : ''}${r.skipped_count ? `, ${r.skipped_count} skipped` : ''}.`);
    await refreshBoot(); pageCatalog();
  });
}

// ================= SUPPLIERS =================
async function pageSuppliers() {
  const main = shell('suppliers', pageHead('Suppliers', 'Who you order from. The WhatsApp number makes “Send” open their chat directly.', isAdmin() ? `<button class="btn" id="adds">${ic('plus')} Add supplier</button>` : '', 'Who you order from', { kind: 'suppliers', icon: 'truck' }));
  await refreshBoot().catch(() => {});
  main.innerHTML += `<div class="sup-grid">${state.boot.suppliers.map((s) => `
    <div class="card sup" style="--c:${s.color};${s.active ? '' : 'opacity:.55'}">
      <div class="sn"><b>${esc(s.name)}</b>${isAdmin() ? `<button class="btn ghost sm" data-e="${s.id}">${ic('edit')} Edit</button>` : ''}</div>
      <div class="sl">${s.contact ? `<span>${ic('user')}${esc(s.contact)}</span>` : ''}${s.phone ? `<span>${ic('phone')}${esc(s.phone)}</span>` : '<span class="muted">No WhatsApp number yet</span>'}${s.email ? `<span>${ic('mail')}${esc(s.email)}</span>` : ''}
        ${s.notes ? `<span class="muted">${esc(s.notes)}</span>` : ''}</div>
      <div class="stats"><div><b>${s.products}</b>items</div><div><b style="${s.no_code ? 'color:var(--warn)' : ''}">${s.no_code}</b>no code</div>${s.active ? '' : '<div><b>Off</b>hidden</div>'}
        <div style="margin-left:auto;display:flex;gap:6px;align-items:flex-end"><a class="btn ghost sm" href="#/catalog" data-cat="${s.id}">Catalog</a>${s.active ? `<a class="btn sm" href="#/new?s=${s.id}">Order</a>` : ''}</div></div>
    </div>`).join('')}</div>`;
  if (isAdmin()) {
    $('#adds').onclick = () => supplierForm(null);
    $$('[data-e]', main).forEach((b) => b.onclick = () => supplierForm(supById(b.dataset.e)));
  }
  $$('[data-cat]', main).forEach((a) => a.onclick = () => { cat.sid = Number(a.dataset.cat); });
}
function colorPicker(id, val) {
  return `<div class="swatches" id="${id}">${COLORS.map((c) => `<button type="button" class="swatch ${c.toLowerCase() === String(val).toLowerCase() ? 'on' : ''}" style="background:${c}" data-c="${c}" aria-label="${c}"></button>`).join('')}</div>`;
}
function bindColor(m, id) { let v = ($(`#${id} .on`, m) || {}).dataset?.c || COLORS[1]; $$(`#${id} .swatch`, m).forEach((b) => b.onclick = () => { $$(`#${id} .swatch`, m).forEach((x) => x.classList.remove('on')); b.classList.add('on'); v = b.dataset.c; }); return () => v; }
function supplierForm(s) {
  const isNew = !s; s = s || { active: 1, color: COLORS[7] };
  const m = modal({ title: isNew ? 'Add supplier' : 'Edit supplier', body: `
    <div class="field"><label>Supplier name</label><input class="input" id="sf-n" value="${esc(s.name || '')}" /></div>
    <div class="grid2"><div class="field"><label>Contact person</label><input class="input" id="sf-c" value="${esc(s.contact || '')}" /></div>
      <div class="field"><label>WhatsApp number (with country code)</label><input class="input" id="sf-p" value="${esc(s.phone || '')}" placeholder="+966 5…" /></div></div>
    <div class="field"><label>Email</label><input class="input" id="sf-e" type="email" value="${esc(s.email || '')}" /></div>
    <div class="field"><label>Notes (order days, minimum order…)</label><textarea class="textarea" id="sf-no" style="min-height:70px">${esc(s.notes || '')}</textarea></div>
    <div class="field"><label>Colour</label>${colorPicker('sf-col', s.color)}</div>
    <label class="check"><input type="checkbox" id="sf-a" ${s.active ? 'checked' : ''}/> Active (shown when ordering)</label>`,
  foot: `<button class="btn ghost" data-close>Cancel</button><button class="btn" id="sf-ok">Save</button>` });
  const getC = bindColor(m, 'sf-col');
  $('#sf-ok', m).onclick = () => act($('#sf-ok', m), async () => {
    await api(isNew ? 'suppliers' : 'suppliers/' + s.id, { method: isNew ? 'POST' : 'PUT', body: { name: $('#sf-n', m).value, contact: $('#sf-c', m).value, phone: $('#sf-p', m).value, email: $('#sf-e', m).value, notes: $('#sf-no', m).value, color: getC(), active: $('#sf-a', m).checked } });
    closeModal(); toast('Supplier saved.'); pageSuppliers();
  });
}

// ================= REPORTS =================
const rep = { mode: 'month', day: '', month: '', year: '', from: '', to: '', restaurant: '', supplier: '', status: 'all', tab: 'summary', note: '', data: null };
function repRange() {
  if (rep.mode === 'day') return { from: rep.day, to: rep.day, group: 'day', label: `Daily report · ${fmtDate(rep.day)}` };
  if (rep.mode === 'month') return { from: rep.month + '-01', to: lastDay(rep.month), group: 'day', label: `Monthly report · ${MONTHS_L[Number(rep.month.slice(5)) - 1]} ${rep.month.slice(0, 4)}` };
  if (rep.mode === 'year') return { from: rep.year + '-01-01', to: rep.year + '-12-31', group: 'month', label: `Yearly report · ${rep.year}` };
  const days = (new Date(rep.to) - new Date(rep.from)) / 864e5;
  return { from: rep.from, to: rep.to, group: days > 62 ? 'month' : 'day', label: `Report · ${fmtDate(rep.from)} – ${fmtDate(rep.to)}` };
}
function pageReports() {
  const t = today();
  if (!rep.day) { rep.day = t; rep.month = t.slice(0, 7); rep.year = t.slice(0, 4); rep.from = t.slice(0, 7) + '-01'; rep.to = t; try { rep.note = localStorage.getItem('oe_rep_note') || ''; } catch {} }
  const years = []; for (let y = Number(t.slice(0, 4)); y >= Number(t.slice(0, 4)) - 4; y--) years.push(y);
  const main = shell('reports', pageHead('Reports', 'Pull a daily, monthly or yearly summary, add a note, then download it.', `
      <button class="btn ghost" data-x="pdf">${ic('pdf')} PDF</button><button class="btn ghost" data-x="word">${ic('word')} Word</button>
      <button class="btn ghost" data-x="excel">${ic('excel')} Excel</button><button class="btn ghost" data-x="print">${ic('print')} Print</button>`, 'Summaries', { kind: 'reports', icon: 'chart' }) + `
    <div class="card no-print" style="margin-bottom:18px"><div class="rep-ctrl">
      <div class="seg" id="rm">${[['day', 'Daily'], ['month', 'Monthly'], ['year', 'Yearly'], ['custom', 'Custom']].map(([k, l]) => `<button data-m="${k}" class="${rep.mode === k ? 'on' : ''}">${l}</button>`).join('')}</div>
      <div class="rep-row">
        ${rep.mode === 'day' ? `<div class="field"><label>Day</label><input class="input" type="date" id="r-d" value="${rep.day}" /></div>` : ''}
        ${rep.mode === 'month' ? `<div class="field"><label>Month</label><input class="input" type="month" id="r-m" value="${rep.month}" /></div>` : ''}
        ${rep.mode === 'year' ? `<div class="field"><label>Year</label><select class="select" id="r-y">${years.map((y) => `<option ${String(y) === rep.year ? 'selected' : ''}>${y}</option>`).join('')}</select></div>` : ''}
        ${rep.mode === 'custom' ? `<div class="field"><label>From</label><input class="input" type="date" id="r-f" value="${rep.from}" /></div><div class="field"><label>To</label><input class="input" type="date" id="r-t" value="${rep.to}" /></div>` : ''}
        <div class="field"><label>Restaurant</label><select class="select" id="r-r"><option value="">All restaurants</option>${state.boot.restaurants.map((r) => `<option value="${r.id}" ${String(r.id) === rep.restaurant ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select></div>
        <div class="field"><label>Supplier</label><select class="select" id="r-s"><option value="">All suppliers</option>${state.boot.suppliers.map((s) => `<option value="${s.id}" ${String(s.id) === rep.supplier ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></div>
        <div class="field"><label>Orders</label><select class="select" id="r-st"><option value="all">Placed + received</option><option value="received" ${rep.status === 'received' ? 'selected' : ''}>Received only</option><option value="ordered" ${rep.status === 'ordered' ? 'selected' : ''}>Waiting only</option></select></div>
      </div>
    </div></div>
    <div id="rep-out"><div class="card card-pad muted">Loading…</div></div>`);
  $$('#rm [data-m]').forEach((b) => b.onclick = () => { rep.mode = b.dataset.m; pageReports(); });
  const on = (id, k) => { const el = $(id); if (el) el.onchange = (e) => { rep[k] = e.target.value; loadReport(); }; };
  on('#r-d', 'day'); on('#r-m', 'month'); on('#r-y', 'year'); on('#r-f', 'from'); on('#r-t', 'to'); on('#r-r', 'restaurant'); on('#r-s', 'supplier'); on('#r-st', 'status');
  $$('[data-x]', main).forEach((b) => b.onclick = () => act(b, () => exportReport(b.dataset.x)));
  loadReport();
}
async function loadReport() {
  const rg = repRange();
  if (!rg.from || !rg.to) return;
  const qs = new URLSearchParams({ from: rg.from, to: rg.to, group: rg.group, status: rep.status });
  if (rep.restaurant) qs.set('restaurant', rep.restaurant); if (rep.supplier) qs.set('supplier', rep.supplier);
  try { rep.data = await api('reports?' + qs); rep.data.label = rg.label; drawReport(); } catch (e) { const o = $('#rep-out'); if (o) o.innerHTML = `<div class="form-error">${esc(e.message)}</div>`; }
}
function repFilterText() {
  const parts = [rep.restaurant ? restById(rep.restaurant)?.name || 'Restaurant' : 'All restaurants', rep.supplier ? supById(rep.supplier)?.name || 'Supplier' : 'All suppliers',
    rep.status === 'received' ? 'Received orders only' : rep.status === 'ordered' ? 'Waiting orders only' : 'Placed + received orders'];
  return parts.join(' · ');
}
function periodsFilled(d) {
  const map = Object.fromEntries(d.by_period.map((p) => [p.period, p]));
  const out = [];
  if (d.group === 'month') { let y = Number(d.from.slice(0, 4)), m = Number(d.from.slice(5, 7)); const end = d.to.slice(0, 7); for (let i = 0; i < 60; i++) { const k = `${y}-${String(m).padStart(2, '0')}`; out.push({ period: k, label: MONTHS[m - 1], ...(map[k] || { orders: 0, total: 0 }) }); if (k >= end) break; m++; if (m > 12) { m = 1; y++; } } }
  else { let k = d.from; for (let i = 0; i < 400 && k <= d.to; i++) { out.push({ period: k, label: String(Number(k.slice(8))), ...(map[k] || { orders: 0, total: 0 }) }); k = addDays(k, 1); } }
  return out;
}
function drawReport() {
  const d = rep.data, el = $('#rep-out'); if (!el) return;
  const T = d.totals, avg = T.orders ? T.total / T.orders : 0;
  const per = periodsFilled(d);
  const useTotal = per.some((p) => p.total > 0);
  const mx = Math.max(1, ...per.map((p) => (useTotal ? p.total : p.orders) || 0));
  const hb = (rows) => { const m = Math.max(1, ...rows.map((r) => (useTotal ? r.total : r.orders) || 0)); return rows.map((r) => `<div class="hbar" style="--c:${r.color || '#5A4636'}"><div class="name"><span class="dot"></span>${esc(r.name)}</div>
    <div class="track"><div class="fill" style="width:${(((useTotal ? r.total : r.orders) || 0) / m) * 100}%"></div></div><div class="val">${useTotal ? money(r.total) : r.orders + ' orders'}</div></div>`).join('') || '<div class="muted">No orders.</div>'; };
  el.innerHTML = `
    <div class="card card-pad" style="margin-bottom:18px;background:var(--char);color:var(--paper);border-color:var(--char)">
      <div class="eyebrow" style="color:#9C968C">${esc(repFilterText())}</div><h2 style="margin:0;font-size:22px">${esc(d.label)}</h2></div>
    <div class="kpis">
      <div class="card kpi"><div class="k">Total spend</div><div class="v">${fmtNum(T.total)}<small>${cur()}</small></div></div>
      <div class="card kpi"><div class="k">Orders</div><div class="v">${T.orders}</div></div>
      <div class="card kpi"><div class="k">Item lines</div><div class="v">${T.lines}</div></div>
      <div class="card kpi"><div class="k">Average order</div><div class="v">${fmtNum(avg)}<small>${cur()}</small></div></div>
    </div>
    <div class="card" style="margin-bottom:18px">
      <div class="tabs no-print">${[['summary', 'Summary'], ['restaurants', 'Restaurant × supplier'], ['items', 'Items'], ['orders', 'Orders']].map(([k, l]) => `<button data-t="${k}" class="${rep.tab === k ? 'on' : ''}">${l}</button>`).join('')}</div>
      <div id="rep-tab"></div>
    </div>
    <div class="card no-print"><div class="card-head"><h3>${ic('note')} Note under the report</h3><span class="hint">Printed at the bottom of the PDF, Word and Excel file</span></div>
      <div class="card-pad"><textarea class="textarea" id="rep-note" placeholder="e.g. Gulfwest price increase from 1 Nov. Bupa closed on Friday.">${esc(rep.note)}</textarea></div></div>
    <div class="card card-pad print-note" style="display:none;margin-top:18px"></div>`;
  const tab = $('#rep-tab');
  const drawTab = () => {
    $$('.tabs button', el).forEach((b) => b.classList.toggle('on', b.dataset.t === rep.tab));
    if (rep.tab === 'summary') tab.innerHTML = `
      <div style="padding:18px 18px 0"><div class="label">${useTotal ? `Spend per ${d.group}` : `Orders per ${d.group}`}</div></div>
      <div style="overflow-x:auto;padding:8px 18px 4px"><div style="min-width:${Math.min(per.length * 18, 900)}px">
        ${vbars(per.map((p, i) => ({ v: (useTotal ? p.total : p.orders) || 0, label: per.length <= 16 || i % Math.ceil(per.length / 16) === 0 ? p.label : '',
          title: `${d.group === 'month' ? fmtMonth(p.period) : fmtDate(p.period)}: ${money(p.total)} · ${p.orders} orders` })), mx, 200)}
      </div></div>
      <div class="grid2" style="gap:0 30px;padding:0 0 8px">
        <div><div class="label" style="padding:10px 18px 0">By restaurant</div><div class="bars">${hb(d.by_restaurant)}</div></div>
        <div><div class="label" style="padding:10px 18px 0">By supplier</div><div class="bars">${hb(d.by_supplier)}</div></div>
      </div>`;
    else if (rep.tab === 'restaurants') tab.innerHTML = d.matrix.length ? `<div class="table-wrap"><table class="t"><thead><tr><th>Restaurant</th><th>Supplier</th><th class="r">Orders</th><th class="r">Spend</th></tr></thead><tbody>
      ${d.matrix.map((m) => `<tr><td><b>${esc(m.restaurant)}</b></td><td>${esc(m.supplier)}</td><td class="r num">${m.orders}</td><td class="r num">${money(m.total)}</td></tr>`).join('')}</tbody>
      <tfoot><tr><td colspan="2">Total</td><td class="r num">${T.orders}</td><td class="r num">${money(T.total)}</td></tr></tfoot></table></div>` : `<div class="empty">${EMPTY_BOX}No orders in this period.</div>`;
    else if (rep.tab === 'items') tab.innerHTML = d.items.length ? `<div class="table-wrap"><table class="t"><thead><tr><th>Code</th><th>Item</th><th class="hide-sm">Supplier</th><th class="r">Qty</th><th class="r hide-sm">Orders</th><th class="r">Value</th></tr></thead><tbody>
      ${d.items.map((it) => `<tr><td>${codeHtml(it.code)}</td><td><b>${esc(it.name)}</b>${it.pack ? ` <span class="muted">${esc(it.pack)}</span>` : ''}</td><td class="hide-sm">${esc(it.supplier)}</td><td class="r num">${fmtQty(it.qty)} ${esc(it.unit || '')}</td><td class="r num hide-sm">${it.orders}</td><td class="r num">${money(it.value)}</td></tr>`).join('')}</tbody></table></div>` : `<div class="empty">${EMPTY_BOX}No items in this period.</div>`;
    else tab.innerHTML = d.orders.length ? `<div class="table-wrap"><table class="t"><thead><tr><th>Order</th><th>Date</th><th>Restaurant</th><th>Supplier</th><th class="r">Total</th><th>Status</th></tr></thead><tbody>
      ${d.orders.map((o) => `<tr class="click" data-go="#/orders/${o.id}"><td class="mono" style="font-size:13px">${esc(o.order_no)}</td><td>${fmtDate(o.order_date)}</td><td>${esc(o.restaurant)}</td><td>${esc(o.supplier)}</td><td class="r num">${money(o.total)}</td><td><span class="pill ${o.status}">${o.status}</span></td></tr>`).join('')}</tbody></table></div>` : `<div class="empty">${EMPTY_BOX}No orders in this period.</div>`;
    $$('[data-go]', tab).forEach((tr) => tr.onclick = () => { location.hash = tr.dataset.go; });
  };
  $$('.tabs button', el).forEach((b) => b.onclick = () => { rep.tab = b.dataset.t; drawTab(); });
  $('#rep-note').oninput = (e) => { rep.note = e.target.value; try { localStorage.setItem('oe_rep_note', rep.note); } catch {} };
  drawTab();
}
function repFileName(ext) {
  const rg = repRange();
  const who = rep.restaurant ? restById(rep.restaurant)?.name : 'All restaurants';
  const when = rep.mode === 'day' ? rep.day : rep.mode === 'month' ? rep.month : rep.mode === 'year' ? rep.year : `${rg.from} to ${rg.to}`;
  return `OrderEase ${rep.mode === 'custom' ? '' : rep.mode === 'day' ? 'daily ' : rep.mode + 'ly '}report - ${who} - ${when}.${ext}`;
}
async function exportReport(kind) {
  const d = rep.data; if (!d) throw new Error('The report is still loading.');
  if (kind === 'print') {
    const pn = $('.print-note');
    if (pn) { pn.style.display = rep.note ? '' : 'none'; pn.innerHTML = rep.note ? `<b>Note</b><div style="white-space:pre-wrap;margin-top:6px">${esc(rep.note)}</div>` : ''; }
    const prev = rep.tab; rep.tab = 'summary'; drawReportTabOnly();
    setTimeout(() => { window.print(); rep.tab = prev; drawReportTabOnly(); if (pn) pn.style.display = 'none'; }, 60);
    return;
  }
  if (kind === 'pdf') return reportPdf(d);
  if (kind === 'word') return reportWord(d);
  return reportExcel(d);
}
function drawReportTabOnly() { const b = $(`.tabs button[data-t="${rep.tab}"]`); if (b) b.click(); }
function reportTables(d) {
  const c = cur();
  return [
    { title: 'By restaurant', head: ['Restaurant', 'Orders', `Spend (${c})`], rows: d.by_restaurant.map((r) => [r.name, r.orders, fmtNum(r.total)]), foot: ['Total', d.totals.orders, fmtNum(d.totals.total)] },
    { title: 'By supplier', head: ['Supplier', 'Orders', `Spend (${c})`], rows: d.by_supplier.map((r) => [r.name, r.orders, fmtNum(r.total)]), foot: ['Total', d.totals.orders, fmtNum(d.totals.total)] },
    { title: `Per ${d.group}`, head: [d.group === 'month' ? 'Month' : 'Date', 'Orders', `Spend (${c})`], rows: d.by_period.map((p) => [d.group === 'month' ? fmtMonth(p.period) : fmtDate(p.period), p.orders, fmtNum(p.total)]) },
    { title: 'Restaurant × supplier', head: ['Restaurant', 'Supplier', 'Orders', `Spend (${c})`], rows: d.matrix.map((m) => [m.restaurant, m.supplier, m.orders, fmtNum(m.total)]) },
    { title: 'Items ordered', head: ['Code', 'Item', 'Pack', 'Supplier', 'Qty', `Value (${c})`], rows: d.items.map((it) => [it.code || '—', it.name, it.pack || '', it.supplier, `${fmtQty(it.qty)} ${it.unit || ''}`.trim(), fmtNum(it.value)]) },
    { title: 'Orders', head: ['Order', 'Date', 'Restaurant', 'Supplier', 'Status', `Total (${c})`], rows: d.orders.map((o) => [o.order_no, fmtDate(o.order_date), o.restaurant, o.supplier, o.status, fmtNum(o.total)]) },
  ];
}
async function reportPdf(d) {
  const doc = needPdf(), st = state.boot.settings, W = doc.internal.pageSize.getWidth();
  const logo = await getLogo();
  doc.setFillColor(40, 40, 40); doc.rect(0, 0, W, 92, 'F');
  if (logo) { doc.setFillColor(255, 255, 255); doc.roundedRect(36, 18, 56, 56, 6, 6, 'F'); doc.addImage(logo, 'PNG', 40, 22, 48, 48); }
  doc.setTextColor(243, 240, 234); doc.setFont('helvetica', 'bold'); doc.setFontSize(17); doc.text(d.label, logo ? 106 : 40, 44);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(200, 192, 180); doc.text(`${st.company} · ${repFilterText()}`, logo ? 106 : 40, 62);
  const k = [['Total spend', `${cur()} ${fmtNum(d.totals.total)}`], ['Orders', String(d.totals.orders)], ['Item lines', String(d.totals.lines)], ['Average order', `${cur()} ${fmtNum(d.totals.orders ? d.totals.total / d.totals.orders : 0)}`]];
  const kw = (W - 80 - 30) / 4;
  k.forEach(([l, v], i) => { const x = 40 + i * (kw + 10); doc.setFillColor(246, 234, 219); doc.roundedRect(x, 108, kw, 52, 6, 6, 'F'); doc.setTextColor(110); doc.setFontSize(8.5); doc.text(l.toUpperCase(), x + 10, 126); doc.setTextColor(30); doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.text(v, x + 10, 147); doc.setFont('helvetica', 'normal'); });
  let y = 182;
  for (const t of reportTables(d)) {
    if (!t.rows.length) continue;
    if (y > doc.internal.pageSize.getHeight() - 120) { doc.addPage(); y = 50; }
    doc.setTextColor(30); doc.setFont('helvetica', 'bold'); doc.setFontSize(11.5); doc.text(t.title, 40, y);
    doc.autoTable({ startY: y + 8, margin: { left: 40, right: 40 }, head: [t.head], body: t.rows, foot: t.foot ? [t.foot] : undefined,
      styles: { fontSize: 9, cellPadding: 5, lineColor: [227, 221, 210], lineWidth: 0.5 }, headStyles: { fillColor: [90, 70, 54], textColor: 255 },
      footStyles: { fillColor: [246, 234, 219], textColor: 30, fontStyle: 'bold' }, alternateRowStyles: { fillColor: [251, 249, 245] },
      columnStyles: Object.fromEntries(t.head.map((h, i) => [i, /Orders|Spend|Value|Total|Qty/.test(h) ? { halign: 'right' } : {}])),
      didParseCell: (hk) => { if (hk.section !== 'body' && /Orders|Spend|Value|Total|Qty/.test(t.head[hk.column.index])) hk.cell.styles.halign = 'right'; } });
    y = doc.lastAutoTable.finalY + 26;
  }
  if (!d.orders.length) { doc.setFontSize(11); doc.setTextColor(120); doc.text('No orders in this period.', 40, y); y += 24; }
  if (rep.note.trim()) {
    const lines = doc.splitTextToSize(rep.note.trim(), W - 100);
    const h = 30 + lines.length * 13;
    if (y + h > doc.internal.pageSize.getHeight() - 50) { doc.addPage(); y = 50; }
    doc.setFillColor(246, 234, 219); doc.setDrawColor(215, 164, 110); doc.roundedRect(40, y, W - 80, h, 6, 6, 'FD');
    doc.setTextColor(90, 70, 54); doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.text('NOTE', 50, y + 18);
    doc.setTextColor(30); doc.setFont('helvetica', 'normal'); doc.text(lines, 50, y + 34);
  }
  pdfFooter(doc);
  doc.save(safeName(repFileName('pdf')));
}
async function reportWord(d) {
  if (!window.docx) throw new Error('Word tool did not load. Refresh the page and try again.');
  const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, ShadingType, BorderStyle, ImageRun, HeadingLevel } = window.docx;
  const st = state.boot.settings;
  const cell = (t, opt = {}) => new TableCell({ children: [new Paragraph({ alignment: opt.right ? AlignmentType.RIGHT : AlignmentType.LEFT, children: [new TextRun({ text: String(t ?? ''), bold: !!opt.bold, color: opt.color, size: 19, font: 'Calibri' })] })],
    shading: opt.fill ? { type: ShadingType.CLEAR, color: 'auto', fill: opt.fill } : undefined, margins: { top: 70, bottom: 70, left: 100, right: 100 } });
  const border = { style: BorderStyle.SINGLE, size: 4, color: 'E3DDD2' };
  const borders = { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border };
  const children = [];
  const logo = await getLogo();
  if (logo) children.push(new Paragraph({ children: [new ImageRun({ data: Uint8Array.from(atob(logo.split(',')[1]), (ch) => ch.charCodeAt(0)), transformation: { width: 64, height: 64 }, type: 'png' })] }));
  children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: d.label, bold: true, size: 34, color: '282828', font: 'Calibri' })] }));
  children.push(new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: `${st.company} · ${repFilterText()}`, color: '8C877F', size: 19, font: 'Calibri' })] }));
  const k = [['Total spend', `${cur()} ${fmtNum(d.totals.total)}`], ['Orders', d.totals.orders], ['Item lines', d.totals.lines], ['Average order', `${cur()} ${fmtNum(d.totals.orders ? d.totals.total / d.totals.orders : 0)}`]];
  children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders, rows: [new TableRow({ children: k.map(([l]) => cell(l, { fill: 'F6EADB', color: '5A4636', bold: true })) }), new TableRow({ children: k.map(([, v]) => cell(v, { bold: true })) })] }));
  for (const t of reportTables(d)) {
    if (!t.rows.length) continue;
    children.push(new Paragraph({ spacing: { before: 280, after: 100 }, children: [new TextRun({ text: t.title, bold: true, size: 24, font: 'Calibri' })] }));
    const right = t.head.map((h) => /Orders|Spend|Value|Total|Qty/.test(h));
    const rows = [new TableRow({ tableHeader: true, children: t.head.map((h, i) => cell(h, { fill: '5A4636', color: 'FFFFFF', bold: true, right: right[i] })) }),
      ...t.rows.map((r) => new TableRow({ children: r.map((v, i) => cell(v, { right: right[i] })) }))];
    if (t.foot) rows.push(new TableRow({ children: t.foot.map((v, i) => cell(v, { bold: true, fill: 'F6EADB', right: right[i] })) }));
    children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders, rows }));
  }
  if (!d.orders.length) children.push(new Paragraph({ spacing: { before: 200 }, children: [new TextRun({ text: 'No orders in this period.', color: '8C877F' })] }));
  if (rep.note.trim()) {
    children.push(new Paragraph({ spacing: { before: 360, after: 80 }, children: [new TextRun({ text: 'Note', bold: true, size: 24, color: '5A4636', font: 'Calibri' })] }));
    rep.note.trim().split('\n').forEach((l) => children.push(new Paragraph({ shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'F6EADB' }, children: [new TextRun({ text: l, size: 21, font: 'Calibri' })] })));
  }
  children.push(new Paragraph({ spacing: { before: 300 }, children: [new TextRun({ text: `OrderEase · printed ${fmtDate(today())} by ${state.boot.user.name}`, color: 'A09A90', size: 16 })] }));
  const doc = new Document({ creator: APP_NAME, title: d.label, sections: [{ properties: { page: { margin: { top: 900, bottom: 900, left: 900, right: 900 } } }, children }] });
  downloadBlob(await Packer.toBlob(doc), repFileName('docx'));
}
async function reportExcel(d) {
  const wb = needExcel(); wb.creator = APP_NAME;
  const ws = wb.addWorksheet('Summary');
  ws.columns = [{ width: 30 }, { width: 22 }, { width: 14 }, { width: 18 }];
  ws.addRow([d.label]).font = { bold: true, size: 15 };
  ws.addRow([`${state.boot.settings.company} · ${repFilterText()}`]).font = { color: { argb: 'FF8C877F' } };
  ws.addRow([]);
  [['Total spend', d.totals.total], ['Orders', d.totals.orders], ['Item lines', d.totals.lines], ['Average order', d.totals.orders ? d.totals.total / d.totals.orders : 0]].forEach(([l, v], i) => {
    const r = ws.addRow([l, v]); r.getCell(1).font = { bold: true }; if (i === 0 || i === 3) r.getCell(2).numFmt = `"${cur()} "#,##0.00`;
  });
  if (rep.note.trim()) { ws.addRow([]); ws.addRow(['Note']).font = { bold: true, color: { argb: 'FF5A4636' } }; const r = ws.addRow([rep.note.trim()]); ws.mergeCells(r.number, 1, r.number, 4); r.getCell(1).alignment = { wrapText: true, vertical: 'top' }; r.height = Math.min(300, 16 * (rep.note.split('\n').length + Math.ceil(rep.note.length / 90))); r.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF6EADB' } }; }
  const raw = {
    'By restaurant': [['Restaurant', 'Orders', 'Spend'], d.by_restaurant.map((r) => [r.name, r.orders, r.total || 0])],
    'By supplier': [['Supplier', 'Orders', 'Spend'], d.by_supplier.map((r) => [r.name, r.orders, r.total || 0])],
    [`Per ${d.group}`]: [[d.group === 'month' ? 'Month' : 'Date', 'Orders', 'Spend'], d.by_period.map((p) => [d.group === 'month' ? fmtMonth(p.period) : p.period, p.orders, p.total || 0])],
    'Restaurant x supplier': [['Restaurant', 'Supplier', 'Orders', 'Spend'], d.matrix.map((m) => [m.restaurant, m.supplier, m.orders, m.total || 0])],
    Items: [['Code', 'Item', 'Pack', 'Unit', 'Supplier', 'Qty', 'Orders', 'Value'], d.items.map((it) => [it.code || '', it.name, it.pack || '', it.unit || '', it.supplier, it.qty, it.orders, it.value || 0])],
    Orders: [['Order', 'Date', 'Restaurant', 'Supplier', 'Status', 'Items', 'Total', 'Placed by'], d.orders.map((o) => [o.order_no, o.order_date, o.restaurant, o.supplier, o.status, o.items_count, o.total || 0, o.created_by || ''])],
  };
  for (const [name, [head, rows]] of Object.entries(raw)) {
    const s = wb.addWorksheet(name);
    s.columns = head.map((h) => ({ header: h, width: /Item|Restaurant|Supplier/.test(h) ? 30 : 15 }));
    rows.forEach((r) => s.addRow(r));
    styleHeader(s);
    head.forEach((h, i) => { if (/Spend|Value|Total/.test(h)) s.getColumn(i + 1).numFmt = '#,##0.00'; });
    if (rows.length && /Spend|Total|Value/.test(head[head.length - 1]) && ['By restaurant', 'By supplier', 'Restaurant x supplier'].includes(name)) {
      const last = s.rowCount, col = head.length, L = String.fromCharCode(64 + col), O = String.fromCharCode(64 + col - 1);
      const r = s.addRow([]); r.getCell(1).value = 'Total'; r.getCell(col - 1).value = { formula: `SUM(${O}2:${O}${last})` }; r.getCell(col).value = { formula: `SUM(${L}2:${L}${last})` }; r.font = { bold: true };
    }
    if (rep.note.trim()) { s.addRow([]); const r = s.addRow(['Note: ' + rep.note.trim()]); r.font = { italic: true, color: { argb: 'FF5A4636' } }; }
  }
  await saveWb(wb, repFileName('xlsx'));
}

// ================= SETTINGS =================
function avatarHtml(name, photo, size = '') {
  return photo ? `<span class="av ${size}"><img src="${photo}" alt="" /></span>` : `<span class="av ${size}">${esc(initials(name).slice(0, 1))}</span>`;
}
const fmtShortTs = (ts) => { const d = new Date(ts * 1000); return `${d.getDate()} ${MONTHS[d.getMonth()]}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const pwBox = (id, label, auto) => `<div class="field"><label for="${id}">${label}</label><div class="pw-wrap"><input class="input" id="${id}" type="password" autocomplete="${auto}" /><button type="button" data-eye="${id}">SHOW</button></div></div>`;
function motionOn() { try { return localStorage.getItem('oe_motion') !== 'off'; } catch { return true; } }
function setMotion(on) { try { localStorage.setItem('oe_motion', on ? 'on' : 'off'); } catch {} document.documentElement.classList.toggle('no-motion', !on); }
setMotion(motionOn());

async function pageSettings(sub) {
  const tabs = isAdmin() ? [['restaurants', 'Restaurants'], ['users', 'Users'], ['company', 'Company & message'], ['account', 'My account'], ['log', 'Activity log']] : [['account', 'My account']];
  sub = tabs.some(([k]) => k === sub) ? sub : tabs[0][0];
  const main = shell('settings', pageHead('Settings', isAdmin() ? 'Restaurants, users, company details and the activity log.' : 'Your profile and password.', '', isAdmin() ? 'Admin' : 'Staff', { kind: 'settings', icon: 'gear' }) +
    `<nav class="stabs">${tabs.map(([k, l]) => `<a class="${k === sub ? 'on' : ''}" href="#/settings/${k}">${l}</a>`).join('')}</nav><div id="set-body">${loading()}</div>`);
  const body = $('#set-body');
  if (sub === 'restaurants') {
    await refreshBoot();
    body.innerHTML = `<div class="card"><div class="card-head"><h3>Restaurants</h3><button class="btn sm" id="addr">${ic('plus')} Add restaurant</button></div>
      <div class="table-wrap"><table class="t"><thead><tr><th></th><th>Name</th><th>Short code</th><th class="hide-sm">Address (on purchase orders)</th><th>Status</th></tr></thead><tbody>
      ${state.boot.restaurants.map((r) => `<tr class="click ${r.active ? '' : 'off'}" data-r="${r.id}"><td style="width:52px">${restLogo(r)}</td><td><b>${esc(r.name)}</b></td><td class="mono">${esc(r.short || '')}</td><td class="hide-sm">${esc(r.address || '—')}</td><td>${r.active ? 'Active' : 'Hidden'}</td></tr>`).join('')}</tbody></table></div>
      <div class="card-pad hint">The short code starts every order number, e.g. <span class="code">TP-261027-01</span>. Tap a row to rename it.</div></div>`;
    $('#addr').onclick = () => restForm(null);
    $$('[data-r]', body).forEach((tr) => tr.onclick = () => restForm(restById(tr.dataset.r)));
  } else if (sub === 'users') {
    const { users, now } = await api('users');
    const restNames = (u) => u.role === 'admin' || !u.restaurants ? 'All restaurants' : u.restaurants.split(',').map((id) => esc(restById(id)?.name || '?')).join(', ');
    const status = (u) => !u.active ? '<span class="st off">Off</span>' : u.locked_until && u.locked_until > now ? `<span class="st locked">${ic('lock')} Locked</span>` : '<span class="st active">Active</span>';
    body.innerHTML = `<p class="set-intro">Staff can place, edit and receive orders only for the restaurants ticked for them, and see reports. Only Admins can change the catalog, suppliers, restaurants and users.</p>
      <div class="set-actions"><button class="btn crema" id="addu">${ic('plus')} Add user</button></div>
      <div class="card"><div class="table-wrap"><table class="t users-t"><thead><tr><th>User</th><th>Role</th><th class="hide-sm">Restaurants</th><th>Status</th><th class="hide-sm">Last sign-in</th><th></th></tr></thead><tbody>
      ${users.map((u) => `<tr class="${u.active ? '' : 'off'}"><td><div class="u-cell">${avatarHtml(u.display_name, u.photo)}<div><b>${esc(u.display_name)}</b><span>${u.position ? esc(u.position) + ' · ' : ''}@${esc(u.username)}</span></div></div></td>
        <td><span class="role ${u.role}">${u.role === 'admin' ? 'Admin' : 'Staff'}</span></td><td class="hide-sm muted-2">${restNames(u)}</td><td>${status(u)}</td>
        <td class="hide-sm muted-2">${u.last_login ? fmtShortTs(u.last_login) : 'Never'}</td><td class="r"><button class="btn ghost sm" data-u="${u.id}">${ic('edit')} Edit</button></td></tr>`).join('')}</tbody></table></div></div>`;
    $('#addu').onclick = () => userForm(null);
    $$('[data-u]', body).forEach((b) => b.onclick = () => userForm(users.find((u) => u.id === Number(b.dataset.u)), now));
  } else if (sub === 'company') {
    const st = state.boot.settings;
    body.innerHTML = `<div class="card card-pad" style="max-width:640px">
      <div class="field"><label>Company name (top of purchase orders and reports)</label><input class="input" id="c-co" value="${esc(st.company)}" /></div>
      <div class="field"><label>Currency</label><input class="input" id="c-cur" value="${esc(st.currency)}" style="max-width:140px" /></div>
      <div class="grid2"><div class="field"><label>Message starts with</label><input class="input" id="c-gr" value="${esc(st.greeting)}" /></div>
        <div class="field"><label>Message ends with</label><input class="input" id="c-so" value="${esc(st.signoff)}" /></div></div>
      <button class="btn" id="c-ok">Save</button></div>`;
    $('#c-ok').onclick = () => act($('#c-ok'), async () => { const r = await api('settings', { method: 'PUT', body: { company: $('#c-co').value, currency: $('#c-cur').value, greeting: $('#c-gr').value, signoff: $('#c-so').value } }); state.boot.settings = r.settings; toast('Saved.'); pageSettings('company'); });
  } else if (sub === 'account') {
    const me = state.boot.user;
    let photo; // undefined = unchanged
    body.innerHTML = `<div class="acct">
      <div class="card"><div class="card-head"><h3 class="h-ic">${ic('user')} Profile</h3></div><div class="card-pad">
        <div class="me-row"><div id="me-av">${avatarHtml(me.name, me.photo, 'xl')}</div><div><div class="me-name">${esc(me.name)}</div>
          <div class="me-sub">${me.position ? `<b>${esc(me.position)}</b> · ` : ''}@${esc(me.username)} · <span class="role ${me.role}">${me.role === 'admin' ? 'Admin' : 'Staff'}</span></div></div></div>
        <div class="field"><label>Full name</label><input class="input" id="me-n" value="${esc(me.name)}" /></div>
        <div class="field"><label>Position <span class="opt">(optional)</span></label><input class="input" id="me-pos" value="${esc(me.position || '')}" placeholder="e.g. Exclusive chef" /></div>
        <div class="field"><label>Photo <span class="opt">(optional)</span></label><div class="actions">
          <label class="btn ghost" style="cursor:pointer">${ic('user')} Choose photo<input type="file" accept="image/*" id="me-ph" hidden /></label>
          ${me.photo ? '<button class="btn ghost" id="me-rm">Remove photo</button>' : ''}</div></div>
        <button class="btn crema" id="me-save">Save profile</button>
        <label class="check" style="margin-top:18px"><input type="checkbox" id="me-anim" ${motionOn() ? 'checked' : ''}/> Moving pictures, coffee pour and truck animations <span class="opt">(this device)</span></label>
        <p class="hint" style="margin:10px 0 14px">You are signed out automatically after ${Math.round((me.idle || 1800) / 60)} minutes without activity.</p>
        <button class="btn danger" id="me-out">${ic('out')} Log out</button>
      </div></div>
      <div class="card"><div class="card-head"><h3 class="h-ic">${ic('lock')} Change password</h3></div><div class="card-pad">
        ${pwBox('a-c', 'Current password', 'current-password')}${pwBox('a-n', 'New password (min. 6)', 'new-password')}${pwBox('a-n2', 'Confirm new password', 'new-password')}
        <button class="btn crema" id="a-ok">Update password</button>
      </div></div></div>`;
    $$('[data-eye]', body).forEach((b) => b.onclick = () => { const i = $('#' + b.dataset.eye); const sh = i.type === 'password'; i.type = sh ? 'text' : 'password'; b.textContent = sh ? 'HIDE' : 'SHOW'; });
    $('#me-ph').onchange = async (e) => { const f = e.target.files[0]; if (!f) return; try { photo = await shrinkImage(f, 240); $('#me-av').innerHTML = avatarHtml(me.name, photo, 'xl'); toast('Photo ready — tap Save profile.'); } catch { toast('Could not read that photo.', true); } };
    if ($('#me-rm')) $('#me-rm').onclick = () => { photo = ''; $('#me-av').innerHTML = avatarHtml(me.name, '', 'xl'); };
    $('#me-save').onclick = () => act($('#me-save'), async () => {
      const b = { name: $('#me-n').value, position: $('#me-pos').value }; if (photo !== undefined) b.photo = photo;
      const r = await api('me', { method: 'PUT', body: b }); state.boot.user = { ...state.boot.user, ...r.user }; toast('Profile saved.'); pageSettings('account');
    });
    $('#me-anim').onchange = (e) => { setMotion(e.target.checked); toast(e.target.checked ? 'Animations on.' : 'Animations off on this device.'); };
    $('#me-out').onclick = () => logout();
    $('#a-ok').onclick = () => act($('#a-ok'), async () => {
      if ($('#a-n').value !== $('#a-n2').value) throw new Error('The two new passwords are not the same.');
      await api('me/password', { method: 'POST', body: { current: $('#a-c').value, password: $('#a-n').value } });
      toast('Password updated.'); ['a-c', 'a-n', 'a-n2'].forEach((id) => { $('#' + id).value = ''; });
    });
  } else if (sub === 'log') {
    await tabLog(body);
  }
}
function restForm(r) {
  const isNew = !r; r = r || { active: 1, color: COLORS[6] };
  const m = modal({ title: isNew ? 'Add restaurant' : 'Edit restaurant', body: `
    <div class="grid2"><div class="field"><label>Restaurant name</label><input class="input" id="rf-n" value="${esc(r.name || '')}" /></div>
      <div class="field"><label>Short code (2–4 letters)</label><input class="input mono" id="rf-s" maxlength="4" value="${esc(r.short || '')}" placeholder="e.g. TP" /></div></div>
    <div class="field"><label>Delivery address (shown on purchase orders)</label><input class="input" id="rf-a" value="${esc(r.address || '')}" /></div>
    <div class="field"><label>Colour</label>${colorPicker('rf-col', r.color)}</div>
    <label class="check"><input type="checkbox" id="rf-act" ${r.active ? 'checked' : ''}/> Active</label>`,
  foot: `<button class="btn ghost" data-close>Cancel</button><button class="btn" id="rf-ok">Save</button>` });
  const getC = bindColor(m, 'rf-col');
  $('#rf-ok', m).onclick = () => act($('#rf-ok', m), async () => {
    await api(isNew ? 'restaurants' : 'restaurants/' + r.id, { method: isNew ? 'POST' : 'PUT', body: { name: $('#rf-n', m).value, short: $('#rf-s', m).value, address: $('#rf-a', m).value, color: getC(), active: $('#rf-act', m).checked } });
    closeModal(); toast('Restaurant saved.'); pageSettings('restaurants');
  });
}
function userForm(u, now) {
  const isNew = !u; u = u || { role: 'staff', active: 1 };
  const sel = u.restaurants ? u.restaurants.split(',').map(Number) : [];
  const locked = u.locked_until && u.locked_until > now;
  const m = modal({ title: isNew ? 'Add user' : `Edit ${u.display_name}`, body: `
    <div class="grid2"><div class="field"><label>Full name</label><input class="input" id="uf-n" value="${esc(u.display_name || '')}" /></div>
      <div class="field"><label>Username</label><input class="input" id="uf-u" value="${esc(u.username || '')}" ${isNew ? '' : 'disabled'} /></div></div>
    <div class="grid2"><div class="field"><label>Position <span class="opt">(optional)</span></label><input class="input" id="uf-pos" value="${esc(u.position || '')}" placeholder="e.g. Exclusive chef" /></div>
      <div class="field"><label>${isNew ? 'Password (6+ characters)' : 'New password (leave empty to keep)'}</label><input class="input" id="uf-p" type="text" autocomplete="new-password" /></div></div>
    ${!isNew ? `<div class="field"><label>Photo <span class="opt">(optional)</span></label><div class="img-drop"><span id="uf-av">${avatarHtml(u.display_name, u.photo, 'lg')}</span><div class="actions"><label class="btn ghost sm" style="cursor:pointer">${ic('upload')} Choose photo<input type="file" accept="image/*" id="uf-ph" hidden /></label>${u.photo ? '<button type="button" class="btn ghost sm" id="uf-rm">Remove</button>' : ''}</div></div></div>` : ''}
    <div class="field"><label>Role</label><div class="seg" id="uf-r"><button type="button" data-v="staff" class="${u.role === 'staff' ? 'on' : ''}">Staff</button><button type="button" data-v="admin" class="${u.role === 'admin' ? 'on' : ''}">Admin</button></div></div>
    <div class="field" id="uf-rest"><label>Restaurants this person can order for (none ticked = all)</label>${state.boot.restaurants.map((r) => `<label class="check"><input type="checkbox" value="${r.id}" ${sel.includes(r.id) ? 'checked' : ''}/> <span class="dot" style="--c:${r.color}"></span>${esc(r.name)}</label>`).join('')}</div>
    ${!isNew ? `<label class="check"><input type="checkbox" id="uf-a" ${u.active ? 'checked' : ''}/> Account is active</label>` : ''}
    ${locked ? `<label class="check" style="color:var(--bad)"><input type="checkbox" id="uf-unl" checked /> Unlock now (locked after wrong passwords)</label>` : ''}`,
  foot: `<button class="btn ghost" data-close>Cancel</button><button class="btn" id="uf-ok">Save</button>` });
  let role = u.role, photo;
  if ($('#uf-ph', m)) $('#uf-ph', m).onchange = async (e) => { const f = e.target.files[0]; if (!f) return; try { photo = await shrinkImage(f, 240); $('#uf-av', m).innerHTML = avatarHtml(u.display_name, photo, 'lg'); } catch { toast('Could not read that photo.', true); } };
  if ($('#uf-rm', m)) $('#uf-rm', m).onclick = () => { photo = ''; $('#uf-av', m).innerHTML = avatarHtml(u.display_name, '', 'lg'); };
  const showRest = () => { $('#uf-rest', m).style.display = role === 'admin' ? 'none' : ''; };
  $$('#uf-r button', m).forEach((b) => b.onclick = () => { role = b.dataset.v; $$('#uf-r button', m).forEach((x) => x.classList.toggle('on', x === b)); showRest(); });
  showRest();
  $('#uf-ok', m).onclick = () => act($('#uf-ok', m), async () => {
    const body = { name: $('#uf-n', m).value, position: $('#uf-pos', m).value, role, restaurants: $$('#uf-rest input:checked', m).map((i) => Number(i.value)) };
    if (photo !== undefined) body.photo = photo;
    if (isNew) { body.username = $('#uf-u', m).value; body.password = $('#uf-p', m).value; await api('users', { method: 'POST', body }); }
    else { body.active = $('#uf-a', m).checked; if ($('#uf-p', m).value) body.password = $('#uf-p', m).value; if ($('#uf-unl', m)) body.unlock = $('#uf-unl', m).checked; await api('users/' + u.id, { method: 'PUT', body }); }
    closeModal(); toast('User saved.'); if (!isNew && u.id === state.boot.user.id) await refreshBoot(); pageSettings('users');
  });
}

start();
