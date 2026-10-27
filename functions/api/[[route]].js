// OrderEase — supplier ordering API (Cloudflare Pages Functions + D1)
// Every request under /api/* is handled here.
import { SCHEMA, DATA_VERSION, RESTAURANTS, SUPPLIERS, PRODUCTS } from '../../lib/schema.js';

const IDLE_MIN_DEFAULT = 30;   // auto log-out after N minutes without activity
const ABSOLUTE_HOURS = 12;     // a session never lives longer than this
const MAX_FAILED = 5;          // wrong passwords in a row before the account locks
const LOCK_MIN = 10;           // how long the lock lasts
const PBKDF2_ITER = 100000;
const DEFAULT_SETTINGS = {
  company: 'Ghaya Sweets Company',
  currency: 'SAR',
  greeting: 'Good morning',
  signoff: 'Thank you',
};

// ---------- helpers ----------
const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
});
const err = (msg, status = 400) => json({ error: msg }, status);
const now = () => Math.floor(Date.now() / 1000);
const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
const str = (v, max = 300) => (v === null || v === undefined ? '' : String(v).trim().slice(0, max));
const num = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
};
const color = (v, d) => (/^#[0-9a-fA-F]{6}$/.test(String(v || '')) ? v : d);

function localToday(env) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: env.TIMEZONE || 'Asia/Riyadh', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}
function addDays(iso, n) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const randHex = (n) => hex(crypto.getRandomValues(new Uint8Array(n)));
async function hashPassword(password, saltHex) {
  const salt = new Uint8Array(saltHex.match(/../g).map((h) => parseInt(h, 16)));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PBKDF2_ITER }, key, 256);
  return hex(bits);
}
function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
function getCookie(request, name) {
  const c = request.headers.get('cookie') || '';
  const m = c.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
  return m ? m[1] : null;
}
function sessionCookie(request, token, maxAge) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `oe_sid=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;
}
async function audit(env, username, action, detail) {
  try {
    await env.DB.prepare('INSERT INTO audit_log (username, action, detail) VALUES (?, ?, ?)')
      .bind(username || null, action, detail == null ? null : String(detail).slice(0, 500)).run();
  } catch { /* never block a save because of the log */ }
}

// ---------- first-run database setup ----------
let dbReady = false;
async function ensureDb(env) {
  if (dbReady) return;
  let have = 0;
  try {
    const row = await env.DB.prepare("SELECT value FROM meta WHERE key = 'data_version'").first();
    have = row ? Number(row.value) : 0;
  } catch { have = 0; }
  if (have < DATA_VERSION) {
    await env.DB.batch(SCHEMA.map((s) => env.DB.prepare(s)));
    if (have < 1) {
      const r = await env.DB.prepare('SELECT COUNT(*) n FROM restaurants').first();
      if (!r.n) {
        const st = [];
        RESTAURANTS.forEach((x, i) => st.push(env.DB.prepare('INSERT INTO restaurants (name, short, color, sort) VALUES (?, ?, ?, ?)').bind(x.name, x.short, x.color, i)));
        SUPPLIERS.forEach((x, i) => st.push(env.DB.prepare('INSERT INTO suppliers (name, color, notes, sort) VALUES (?, ?, ?, ?)').bind(x.name, x.color, x.notes, i)));
        await env.DB.batch(st);
        const { results: sup } = await env.DB.prepare('SELECT id, name FROM suppliers').all();
        const sid = Object.fromEntries(sup.map((s) => [s.name, s.id]));
        await env.DB.batch(PRODUCTS.map(([s, code, name, cat, pack, unit]) => env.DB.prepare(
          'INSERT INTO products (supplier_id, code, name, category, pack, unit) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(sid[s], code || null, name, cat, pack, unit)));
      }
    }
    await env.DB.prepare("INSERT INTO meta (key, value) VALUES ('data_version', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
      .bind(String(DATA_VERSION)).run();
  }
  dbReady = true;
}

async function getSettings(env) {
  const { results } = await env.DB.prepare("SELECT key, value FROM meta WHERE key LIKE 'set_%'").all();
  const s = { ...DEFAULT_SETTINGS };
  for (const r of results) s[r.key.slice(4)] = r.value;
  return s;
}

// ---------- sessions ----------
async function currentUser(env, request) {
  const token = getCookie(request, 'oe_sid');
  if (!token) return null;
  const idle = (Number(env.SESSION_IDLE_MINUTES) || IDLE_MIN_DEFAULT) * 60;
  const row = await env.DB.prepare(
    `SELECT s.token, s.created_at, s.last_seen, u.id, u.username, u.display_name, u.role, u.active, u.restaurants
       FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?`
  ).bind(token).first();
  if (!row) return null;
  const t = now();
  if (!row.active || t - row.last_seen > idle || t - row.created_at > ABSOLUTE_HOURS * 3600) {
    await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
    return null;
  }
  if (t - row.last_seen > 60) await env.DB.prepare('UPDATE sessions SET last_seen = ? WHERE token = ?').bind(t, token).run();
  return {
    id: row.id, username: row.username, name: row.display_name, role: row.role, token, idle,
    restaurants: row.role === 'admin' || !row.restaurants ? null
      : String(row.restaurants).split(',').map(Number).filter(Boolean),
  };
}
const canSee = (u, rid) => !u.restaurants || !u.restaurants.length || u.restaurants.includes(Number(rid));
function rFilter(u, col = 'o.restaurant_id') {
  if (!u.restaurants || !u.restaurants.length) return { sql: '', args: [] };
  return { sql: ` AND ${col} IN (${u.restaurants.map(() => '?').join(',')})`, args: u.restaurants };
}
const publicUser = (u) => ({ id: u.id, username: u.username, name: u.name, role: u.role, restaurants: u.restaurants, idle: u.idle });

// ---------- auth ----------
async function login(env, request, body) {
  const username = str(body.username, 60), password = String(body.password || '');
  if (!username || !password) return err('Enter your username and password.');
  const u = await env.DB.prepare('SELECT * FROM users WHERE username = ?').bind(username).first();
  const t = now();
  if (!u || !u.active) { await audit(env, username, 'login_failed', 'Unknown or inactive user'); return err('Wrong username or password.', 401); }
  if (u.locked_until && u.locked_until > t) {
    const m = Math.ceil((u.locked_until - t) / 60);
    return err(`This account is locked for ${m} more minute${m > 1 ? 's' : ''} after too many wrong passwords.`, 423);
  }
  const h = await hashPassword(password, u.pass_salt);
  if (!safeEqual(h, u.pass_hash)) {
    const failed = (u.failed_count || 0) + 1;
    const lock = failed >= MAX_FAILED ? t + LOCK_MIN * 60 : null;
    await env.DB.prepare('UPDATE users SET failed_count = ?, locked_until = ? WHERE id = ?').bind(lock ? 0 : failed, lock, u.id).run();
    await audit(env, u.username, 'login_failed', lock ? `Locked for ${LOCK_MIN} min` : `Attempt ${failed}`);
    if (lock) return err(`Too many wrong passwords. The account is locked for ${LOCK_MIN} minutes.`, 423);
    return err(`Wrong username or password. ${MAX_FAILED - failed} ${MAX_FAILED - failed === 1 ? "try" : "tries"} left before the account locks.`, 401);
  }
  const token = randHex(32);
  await env.DB.batch([
    env.DB.prepare('INSERT INTO sessions (token, user_id, created_at, last_seen) VALUES (?, ?, ?, ?)').bind(token, u.id, t, t),
    env.DB.prepare('UPDATE users SET failed_count = 0, locked_until = NULL, last_login = ? WHERE id = ?').bind(t, u.id),
    env.DB.prepare('DELETE FROM sessions WHERE last_seen < ?').bind(t - ABSOLUTE_HOURS * 3600),
  ]);
  await audit(env, u.username, 'login', null);
  return json({ ok: true }, 200, { 'set-cookie': sessionCookie(request, token, ABSOLUTE_HOURS * 3600) });
}

async function createUser(env, b, isFirst) {
  const username = str(b.username, 40);
  const name = str(b.name, 80) || username;
  const password = String(b.password || '');
  if (!/^[A-Za-z0-9._-]{3,40}$/.test(username)) return { error: 'Username: 3–40 letters or numbers (no spaces).' };
  if (password.length < 6) return { error: 'Password must be at least 6 characters.' };
  const exists = await env.DB.prepare('SELECT id FROM users WHERE username = ?').bind(username).first();
  if (exists) return { error: 'That username is already taken.' };
  const salt = randHex(16);
  const hash = await hashPassword(password, salt);
  const role = isFirst ? 'admin' : (b.role === 'admin' ? 'admin' : 'staff');
  const rest = Array.isArray(b.restaurants) ? b.restaurants.map(Number).filter(Boolean).join(',') : null;
  await env.DB.prepare('INSERT INTO users (username, display_name, role, pass_hash, pass_salt, restaurants) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(username, name, role, hash, salt, role === 'admin' ? null : (rest || null)).run();
  return { ok: true, username };
}

// ---------- order helpers ----------
async function nextOrderNo(env, restaurantId, date) {
  const r = await env.DB.prepare('SELECT short FROM restaurants WHERE id = ?').bind(restaurantId).first();
  const prefix = `${(r && r.short) || 'OR'}-${date.slice(2, 4)}${date.slice(5, 7)}${date.slice(8, 10)}`;
  const c = await env.DB.prepare('SELECT COUNT(*) n FROM orders WHERE order_no LIKE ?').bind(prefix + '-%').first();
  return `${prefix}-${String(c.n + 1).padStart(2, '0')}`;
}
function cleanItems(items) {
  if (!Array.isArray(items)) return [];
  return items.map((it, i) => ({
    product_id: Number(it.product_id) || null,
    code: str(it.code, 60) || null,
    name: str(it.name, 200),
    pack: str(it.pack, 60) || null,
    unit: str(it.unit, 40) || null,
    qty: num(it.qty),
    price: num(it.price),
    sort: i,
  })).filter((it) => it.name && it.qty !== null && it.qty > 0).slice(0, 300);
}
const orderTotal = (items) => items.reduce((s, it) => s + (it.price ? it.price * it.qty : 0), 0);
const ORDER_SELECT = `SELECT o.*, r.name restaurant, r.color restaurant_color, r.short restaurant_short,
  s.name supplier, s.color supplier_color, s.phone supplier_phone, s.email supplier_email, s.contact supplier_contact
  FROM orders o JOIN restaurants r ON r.id = o.restaurant_id JOIN suppliers s ON s.id = o.supplier_id`;

// ---------- reports ----------
async function report(env, user, url) {
  const from = url.searchParams.get('from'), to = url.searchParams.get('to');
  if (!isDate(from) || !isDate(to) || from > to) return err('Choose a valid date range.');
  const group = url.searchParams.get('group') === 'month' ? 'month' : 'day';
  const rid = Number(url.searchParams.get('restaurant')) || null;
  const sid = Number(url.searchParams.get('supplier')) || null;
  const status = url.searchParams.get('status') || 'all';
  if (rid && !canSee(user, rid)) return err('You do not have access to this restaurant.', 403);
  let where = ` WHERE o.order_date BETWEEN ? AND ? AND o.status <> 'cancelled'`;
  const args = [from, to];
  if (rid) { where += ' AND o.restaurant_id = ?'; args.push(rid); }
  if (sid) { where += ' AND o.supplier_id = ?'; args.push(sid); }
  if (status === 'ordered' || status === 'received') { where += ' AND o.status = ?'; args.push(status); }
  const rf = rFilter(user); where += rf.sql; args.push(...rf.args);
  const period = group === 'month' ? 'substr(o.order_date, 1, 7)' : 'o.order_date';
  const base = `FROM orders o JOIN restaurants r ON r.id = o.restaurant_id JOIN suppliers s ON s.id = o.supplier_id`;
  const q = (sql) => env.DB.prepare(sql).bind(...args);
  const [tot, byR, byS, byP, matrix, items, orders] = await env.DB.batch([
    q(`SELECT COUNT(*) orders, COALESCE(SUM(o.total),0) total, COALESCE(SUM(o.items_count),0) lines,
        SUM(CASE WHEN o.status = 'received' THEN 1 ELSE 0 END) received ${base} ${where}`),
    q(`SELECT r.id, r.name, r.color, COUNT(*) orders, SUM(o.total) total ${base} ${where} GROUP BY r.id ORDER BY total DESC, orders DESC`),
    q(`SELECT s.id, s.name, s.color, COUNT(*) orders, SUM(o.total) total ${base} ${where} GROUP BY s.id ORDER BY total DESC, orders DESC`),
    q(`SELECT ${period} period, COUNT(*) orders, SUM(o.total) total ${base} ${where} GROUP BY period ORDER BY period`),
    q(`SELECT r.name restaurant, s.name supplier, COUNT(*) orders, SUM(o.total) total ${base} ${where} GROUP BY r.id, s.id ORDER BY r.sort, r.id, s.sort, s.id`),
    q(`SELECT oi.code, oi.name, oi.pack, oi.unit, s.name supplier, SUM(oi.qty) qty, SUM(COALESCE(oi.price,0) * oi.qty) value, COUNT(DISTINCT o.id) orders
        FROM order_items oi JOIN orders o ON o.id = oi.order_id JOIN restaurants r ON r.id = o.restaurant_id JOIN suppliers s ON s.id = o.supplier_id
        ${where} GROUP BY s.id, COALESCE(oi.product_id, oi.name) ORDER BY value DESC, qty DESC LIMIT 500`),
    q(`SELECT o.id, o.order_no, o.order_date, o.delivery_date, o.status, o.total, o.items_count, o.created_by, r.name restaurant, s.name supplier
        ${base} ${where} ORDER BY o.order_date DESC, o.id DESC LIMIT 2000`),
  ]);
  return json({
    from, to, group, totals: tot.results[0], by_restaurant: byR.results, by_supplier: byS.results,
    by_period: byP.results, matrix: matrix.results, items: items.results, orders: orders.results,
  });
}

// ---------- dashboard ----------
async function dashboard(env, user) {
  const today = localToday(env);
  const month = today.slice(0, 7);
  const rf = rFilter(user);
  const st = (sql, ...a) => env.DB.prepare(sql).bind(...a, ...rf.args);
  const [m, open, byR, recent, nocode, days] = await env.DB.batch([
    st(`SELECT COUNT(*) orders, COALESCE(SUM(total),0) total FROM orders o WHERE status <> 'cancelled' AND substr(order_date,1,7) = ?${rf.sql}`, month),
    st(`SELECT COUNT(*) n FROM orders o WHERE status = 'ordered'${rf.sql}`),
    st(`SELECT r.id, COUNT(o.id) orders, COALESCE(SUM(o.total),0) total, MAX(o.order_date) last
        FROM restaurants r LEFT JOIN orders o ON o.restaurant_id = r.id AND o.status <> 'cancelled' AND substr(o.order_date,1,7) = ?
        WHERE r.active = 1${rf.sql.replace('o.restaurant_id', 'r.id')} GROUP BY r.id`, month),
    st(`${ORDER_SELECT} WHERE 1=1${rf.sql} ORDER BY o.id DESC LIMIT 8`),
    env.DB.prepare(`SELECT COUNT(*) n FROM products WHERE active = 1 AND (code IS NULL OR code = '')`),
    st(`SELECT order_date d, SUM(total) total, COUNT(*) orders FROM orders o WHERE status <> 'cancelled' AND order_date >= ?${rf.sql} GROUP BY order_date`, addDays(today, -13)),
  ]);
  return json({ today, month, month_totals: m.results[0], open: open.results[0].n, by_restaurant: byR.results,
    recent: recent.results, no_code: nocode.results[0].n, days: days.results });
}

// ---------- router ----------
export async function onRequest(context) {
  const { request, env } = context;
  if (!env.DB) return err('The database is not connected yet. In Cloudflare: Settings → Bindings → add D1 database with variable name DB, then retry the deployment.', 503);
  try {
    await ensureDb(env);
    const url = new URL(request.url);
    const parts = url.pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean);
    const method = request.method;
    let body = {};
    if (method !== 'GET' && method !== 'HEAD') {
      try { body = await request.json(); } catch { body = {}; }
    }
    const [a, b, c] = parts;

    // ----- public -----
    if (a === 'status') {
      const n = await env.DB.prepare('SELECT COUNT(*) n FROM users').first();
      const u = n.n ? await currentUser(env, request) : null;
      const settings = await getSettings(env);
      return json({ setup_needed: !n.n, user: u ? publicUser(u) : null, settings, today: localToday(env) });
    }
    if (a === 'setup' && method === 'POST') {
      const n = await env.DB.prepare('SELECT COUNT(*) n FROM users').first();
      if (n.n) return err('Setup is already done. Please log in.', 409);
      const r = await createUser(env, body, true);
      if (r.error) return err(r.error);
      await audit(env, r.username, 'setup', 'First Admin account created');
      return login(env, request, body);
    }
    if (a === 'login' && method === 'POST') return login(env, request, body);
    if (a === 'logout' && method === 'POST') {
      const token = getCookie(request, 'oe_sid');
      if (token) {
        const u = await currentUser(env, request);
        await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
        if (u) await audit(env, u.username, 'logout', null);
      }
      return json({ ok: true }, 200, { 'set-cookie': sessionCookie(request, '', 0) });
    }
    // product pictures load in <img> tags; they still need a session
    const user = await currentUser(env, request);
    if (!user) return err('Your session has ended. Please log in again.', 401);
    const admin = user.role === 'admin';
    const needAdmin = () => (admin ? null : err('Only an Admin can do this.', 403));

    if (a === 'me' && b === 'password' && method === 'POST') {
      const u = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(user.id).first();
      if (!safeEqual(await hashPassword(String(body.current || ''), u.pass_salt), u.pass_hash)) return err('Your current password is not right.');
      if (String(body.password || '').length < 6) return err('New password must be at least 6 characters.');
      const salt = randHex(16);
      await env.DB.batch([
        env.DB.prepare('UPDATE users SET pass_hash = ?, pass_salt = ? WHERE id = ?').bind(await hashPassword(String(body.password), salt), salt, u.id),
        env.DB.prepare('DELETE FROM sessions WHERE user_id = ? AND token <> ?').bind(u.id, user.token),
      ]);
      await audit(env, user.username, 'password_changed', null);
      return json({ ok: true });
    }

    if (a === 'bootstrap') {
      const [r, s, cats] = await env.DB.batch([
        env.DB.prepare('SELECT * FROM restaurants ORDER BY sort, id'),
        env.DB.prepare(`SELECT s.*, (SELECT COUNT(*) FROM products p WHERE p.supplier_id = s.id AND p.active = 1) products,
          (SELECT COUNT(*) FROM products p WHERE p.supplier_id = s.id AND p.active = 1 AND (p.code IS NULL OR p.code = '')) no_code
          FROM suppliers s ORDER BY s.sort, s.id`),
        env.DB.prepare("SELECT DISTINCT category FROM products WHERE category IS NOT NULL AND category <> '' ORDER BY category"),
      ]);
      return json({
        user: publicUser(user), settings: await getSettings(env), today: localToday(env),
        restaurants: r.results.filter((x) => canSee(user, x.id)),
        suppliers: s.results, categories: cats.results.map((x) => x.category),
      });
    }

    if (a === 'dashboard') return dashboard(env, user);
    if (a === 'reports') return report(env, user, url);

    // ----- settings -----
    if (a === 'settings' && method === 'PUT') {
      const no = needAdmin(); if (no) return no;
      const st = [];
      for (const k of Object.keys(DEFAULT_SETTINGS)) {
        if (body[k] !== undefined) st.push(env.DB.prepare("INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind('set_' + k, str(body[k], 200) || DEFAULT_SETTINGS[k]));
      }
      if (st.length) await env.DB.batch(st);
      await audit(env, user.username, 'settings_saved', null);
      return json({ ok: true, settings: await getSettings(env) });
    }

    // ----- restaurants -----
    if (a === 'restaurants') {
      if (method === 'POST' || method === 'PUT') {
        const no = needAdmin(); if (no) return no;
        const name = str(body.name, 80);
        if (!name) return err('Enter the restaurant name.');
        const short = (str(body.short, 4).toUpperCase().replace(/[^A-Z0-9]/g, '') || name.replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase() || 'R');
        const vals = [name, short, color(body.color, '#5A4636'), str(body.address, 200) || null, body.active === false || body.active === 0 ? 0 : 1];
        if (method === 'POST') {
          const mx = await env.DB.prepare('SELECT COALESCE(MAX(sort),0)+1 s FROM restaurants').first();
          await env.DB.prepare('INSERT INTO restaurants (name, short, color, address, active, sort) VALUES (?, ?, ?, ?, ?, ?)').bind(...vals, mx.s).run();
          await audit(env, user.username, 'restaurant_added', name);
        } else {
          await env.DB.prepare('UPDATE restaurants SET name = ?, short = ?, color = ?, address = ?, active = ? WHERE id = ?').bind(...vals, Number(b)).run();
          await audit(env, user.username, 'restaurant_saved', name);
        }
        return json({ ok: true });
      }
    }

    // ----- suppliers -----
    if (a === 'suppliers') {
      if (method === 'POST' || method === 'PUT') {
        const no = needAdmin(); if (no) return no;
        const name = str(body.name, 80);
        if (!name) return err('Enter the supplier name.');
        const vals = [name, str(body.contact, 80) || null, str(body.phone, 40) || null, str(body.email, 120) || null,
          str(body.notes, 500) || null, color(body.color, '#5A4636'), body.active === false || body.active === 0 ? 0 : 1];
        if (method === 'POST') {
          const mx = await env.DB.prepare('SELECT COALESCE(MAX(sort),0)+1 s FROM suppliers').first();
          const r = await env.DB.prepare('INSERT INTO suppliers (name, contact, phone, email, notes, color, active, sort) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(...vals, mx.s).run();
          await audit(env, user.username, 'supplier_added', name);
          return json({ ok: true, id: r.meta.last_row_id });
        }
        await env.DB.prepare('UPDATE suppliers SET name = ?, contact = ?, phone = ?, email = ?, notes = ?, color = ?, active = ? WHERE id = ?').bind(...vals, Number(b)).run();
        await audit(env, user.username, 'supplier_saved', name);
        return json({ ok: true });
      }
    }

    // ----- products -----
    if (a === 'products') {
      if (b === 'usual' && method === 'GET') {
        const rid = Number(url.searchParams.get('restaurant')), sid = Number(url.searchParams.get('supplier'));
        if (!canSee(user, rid)) return err('No access.', 403);
        const since = addDays(localToday(env), -120);
        const { results } = await env.DB.prepare(`SELECT oi.product_id, COUNT(*) times, MAX(o.id) last_order
            FROM order_items oi JOIN orders o ON o.id = oi.order_id
            WHERE o.restaurant_id = ? AND o.supplier_id = ? AND o.status <> 'cancelled' AND o.order_date >= ? AND oi.product_id IS NOT NULL
            GROUP BY oi.product_id ORDER BY times DESC`).bind(rid, sid, since).all();
        const last = await env.DB.prepare(`SELECT oi.product_id, oi.qty FROM order_items oi WHERE oi.order_id = (
            SELECT id FROM orders WHERE restaurant_id = ? AND supplier_id = ? AND status <> 'cancelled' ORDER BY id DESC LIMIT 1)`).bind(rid, sid).all();
        return json({ usual: results, last: last.results });
      }
      if (b && c === 'image' && method === 'GET') {
        const p = await env.DB.prepare('SELECT image FROM products WHERE id = ?').bind(Number(b)).first();
        if (!p || !p.image) return new Response('', { status: 404 });
        const m = String(p.image).match(/^data:(image\/[a-z+]+);base64,(.+)$/);
        if (!m) return new Response('', { status: 404 });
        const bin = Uint8Array.from(atob(m[2]), (ch) => ch.charCodeAt(0));
        return new Response(bin, { headers: { 'content-type': m[1], 'cache-control': 'private, max-age=86400' } });
      }
      if (b === 'import' && method === 'POST') {
        const no = needAdmin(); if (no) return no;
        const rows = Array.isArray(body.rows) ? body.rows.slice(0, 5000) : [];
        if (!rows.length) return err('The file has no rows to import.');
        const { results: sup } = await env.DB.prepare('SELECT id, name FROM suppliers').all();
        const byName = new Map(sup.map((s) => [s.name.toLowerCase(), s.id]));
        const { results: existing } = await env.DB.prepare('SELECT id, supplier_id, code, name FROM products').all();
        const keyCode = new Map(), keyName = new Map();
        for (const p of existing) {
          if (p.code) keyCode.set(p.supplier_id + '|' + p.code.toLowerCase(), p.id);
          keyName.set(p.supplier_id + '|' + p.name.toLowerCase(), p.id);
        }
        let added = 0, updated = 0, newSup = 0; const skipped = [];
        const st = [];
        for (let i = 0; i < rows.length; i++) {
          const r = rows[i];
          const sname = str(r.supplier, 80), name = str(r.name, 200), code = str(r.code, 60);
          if (!name) { skipped.push(`Row ${i + 2}: no product name`); continue; }
          let sid = Number(body.supplier_id) || (sname ? byName.get(sname.toLowerCase()) : null);
          if (!sid && sname) {
            const ins = await env.DB.prepare('INSERT INTO suppliers (name, sort) VALUES (?, 999)').bind(sname).run();
            sid = ins.meta.last_row_id; byName.set(sname.toLowerCase(), sid); newSup++;
          }
          if (!sid) { skipped.push(`Row ${i + 2}: no supplier`); continue; }
          const id = (code && keyCode.get(sid + '|' + code.toLowerCase())) || keyName.get(sid + '|' + name.toLowerCase());
          const vals = [code || null, name, str(r.category, 60) || null, str(r.pack, 60) || null, str(r.unit, 40) || null, num(r.price)];
          if (id) {
            st.push(env.DB.prepare('UPDATE products SET code = ?, name = ?, category = ?, pack = ?, unit = ?, price = COALESCE(?, price), active = 1, updated_at = unixepoch() WHERE id = ?').bind(...vals, id));
            updated++;
          } else {
            st.push(env.DB.prepare('INSERT INTO products (code, name, category, pack, unit, price, supplier_id) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(...vals, sid));
            const k = sid + '|' + name.toLowerCase(); keyName.set(k, -1); if (code) keyCode.set(sid + '|' + code.toLowerCase(), -1);
            added++;
          }
        }
        for (let i = 0; i < st.length; i += 80) await env.DB.batch(st.slice(i, i + 80));
        await audit(env, user.username, 'products_imported', `${added} added, ${updated} updated${newSup ? `, ${newSup} new suppliers` : ''}`);
        return json({ ok: true, added, updated, new_suppliers: newSup, skipped: skipped.slice(0, 50), skipped_count: skipped.length });
      }
      if (method === 'GET' && !b) {
        const sid = Number(url.searchParams.get('supplier')) || null;
        const all = url.searchParams.get('all') === '1' && admin;
        let sql = `SELECT p.id, p.supplier_id, p.code, p.name, p.category, p.pack, p.unit, p.price, p.active, p.updated_at,
          CASE WHEN p.image IS NOT NULL AND p.image <> '' THEN 1 ELSE 0 END has_image,
          (SELECT COUNT(*) FROM order_items oi WHERE oi.product_id = p.id) used
          FROM products p WHERE 1=1`;
        const args = [];
        if (sid) { sql += ' AND p.supplier_id = ?'; args.push(sid); }
        if (!all) sql += ' AND p.active = 1';
        sql += ' ORDER BY p.category, p.name';
        const { results } = await env.DB.prepare(sql).bind(...args).all();
        return json({ products: results });
      }
      if (method === 'POST' || method === 'PUT') {
        const no = needAdmin(); if (no) return no;
        const name = str(body.name, 200), sid = Number(body.supplier_id);
        if (!name) return err('Enter the product name.');
        if (!sid) return err('Choose the supplier.');
        let image = body.image;
        if (image !== undefined && image !== null && image !== '') {
          if (!/^data:image\/(png|jpeg|webp);base64,/.test(String(image)) || String(image).length > 400000) return err('The picture is too big or not a photo.');
        }
        const vals = [sid, str(body.code, 60) || null, name, str(body.category, 60) || null, str(body.pack, 60) || null, str(body.unit, 40) || null, num(body.price),
          body.active === false || body.active === 0 ? 0 : 1];
        if (method === 'POST') {
          const r = await env.DB.prepare('INSERT INTO products (supplier_id, code, name, category, pack, unit, price, active, image) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(...vals, image || null).run();
          await audit(env, user.username, 'product_added', `${vals[1] || 'no code'} · ${name}`);
          return json({ ok: true, id: r.meta.last_row_id });
        }
        const id = Number(b);
        if (image === undefined) {
          await env.DB.prepare('UPDATE products SET supplier_id = ?, code = ?, name = ?, category = ?, pack = ?, unit = ?, price = ?, active = ?, updated_at = unixepoch() WHERE id = ?').bind(...vals, id).run();
        } else {
          await env.DB.prepare('UPDATE products SET supplier_id = ?, code = ?, name = ?, category = ?, pack = ?, unit = ?, price = ?, active = ?, image = ?, updated_at = unixepoch() WHERE id = ?').bind(...vals, image || null, id).run();
        }
        await audit(env, user.username, 'product_saved', `${vals[1] || 'no code'} · ${name}`);
        return json({ ok: true });
      }
      if (method === 'DELETE' && b) {
        const no = needAdmin(); if (no) return no;
        const id = Number(b);
        const used = await env.DB.prepare('SELECT COUNT(*) n FROM order_items WHERE product_id = ?').bind(id).first();
        const p = await env.DB.prepare('SELECT name FROM products WHERE id = ?').bind(id).first();
        if (used.n) {
          await env.DB.prepare('UPDATE products SET active = 0 WHERE id = ?').bind(id).run();
          await audit(env, user.username, 'product_hidden', p && p.name);
          return json({ ok: true, hidden: true });
        }
        await env.DB.prepare('DELETE FROM products WHERE id = ?').bind(id).run();
        await audit(env, user.username, 'product_deleted', p && p.name);
        return json({ ok: true, deleted: true });
      }
    }

    // ----- orders -----
    if (a === 'orders') {
      if (method === 'GET' && !b) {
        let sql = ORDER_SELECT + ' WHERE 1=1'; const args = [];
        const f = url.searchParams;
        if (isDate(f.get('from'))) { sql += ' AND o.order_date >= ?'; args.push(f.get('from')); }
        if (isDate(f.get('to'))) { sql += ' AND o.order_date <= ?'; args.push(f.get('to')); }
        if (Number(f.get('restaurant'))) { sql += ' AND o.restaurant_id = ?'; args.push(Number(f.get('restaurant'))); }
        if (Number(f.get('supplier'))) { sql += ' AND o.supplier_id = ?'; args.push(Number(f.get('supplier'))); }
        if (['ordered', 'received', 'cancelled'].includes(f.get('status'))) { sql += ' AND o.status = ?'; args.push(f.get('status')); }
        if (f.get('q')) { sql += ' AND (o.order_no LIKE ? OR o.note LIKE ? OR EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = o.id AND (oi.name LIKE ? OR oi.code LIKE ?)))'; const q = '%' + str(f.get('q'), 60) + '%'; args.push(q, q, q, q); }
        const rf = rFilter(user); sql += rf.sql; args.push(...rf.args);
        sql += ' ORDER BY o.order_date DESC, o.id DESC LIMIT ' + Math.min(500, Number(f.get('limit')) || 200);
        const { results } = await env.DB.prepare(sql).bind(...args).all();
        return json({ orders: results });
      }
      if (method === 'GET' && b) {
        const o = await env.DB.prepare(ORDER_SELECT + ' WHERE o.id = ?').bind(Number(b)).first();
        if (!o || !canSee(user, o.restaurant_id)) return err('Order not found.', 404);
        const { results } = await env.DB.prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY sort, id').bind(o.id).all();
        return json({ order: o, items: results });
      }
      if (method === 'POST' && !b) {
        const rid = Number(body.restaurant_id), sid = Number(body.supplier_id);
        if (!rid || !canSee(user, rid)) return err('Choose a restaurant you have access to.');
        if (!sid) return err('Choose the supplier.');
        const items = cleanItems(body.items);
        if (!items.length) return err('Add at least one item with a quantity.');
        const date = isDate(body.order_date) ? body.order_date : localToday(env);
        const no = await nextOrderNo(env, rid, date);
        const r = await env.DB.prepare(`INSERT INTO orders (order_no, restaurant_id, supplier_id, order_date, delivery_date, note, total, items_count, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(no, rid, sid, date, isDate(body.delivery_date) ? body.delivery_date : null,
          str(body.note, 1000) || null, orderTotal(items), items.length, user.name).run();
        const oid = r.meta.last_row_id;
        await env.DB.batch(items.map((it) => env.DB.prepare('INSERT INTO order_items (order_id, product_id, code, name, pack, unit, qty, price, sort) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
          .bind(oid, it.product_id, it.code, it.name, it.pack, it.unit, it.qty, it.price, it.sort)));
        await audit(env, user.username, 'order_created', `${no} · ${items.length} items`);
        return json({ ok: true, id: oid, order_no: no });
      }
      if (method === 'PUT' && b) {
        const o = await env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(Number(b)).first();
        if (!o || !canSee(user, o.restaurant_id)) return err('Order not found.', 404);
        if (o.status !== 'ordered' && !admin) return err('Only an Admin can change an order that is received or cancelled.', 403);
        const items = cleanItems(body.items);
        if (!items.length) return err('Add at least one item with a quantity.');
        const st = [
          env.DB.prepare('UPDATE orders SET delivery_date = ?, note = ?, total = ?, items_count = ?, order_date = ? WHERE id = ?')
            .bind(isDate(body.delivery_date) ? body.delivery_date : null, str(body.note, 1000) || null, orderTotal(items), items.length,
              isDate(body.order_date) ? body.order_date : o.order_date, o.id),
          env.DB.prepare('DELETE FROM order_items WHERE order_id = ?').bind(o.id),
          ...items.map((it) => env.DB.prepare('INSERT INTO order_items (order_id, product_id, code, name, pack, unit, qty, price, sort) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
            .bind(o.id, it.product_id, it.code, it.name, it.pack, it.unit, it.qty, it.price, it.sort)),
        ];
        await env.DB.batch(st);
        await audit(env, user.username, 'order_edited', `${o.order_no} · ${items.length} items`);
        return json({ ok: true });
      }
      if (method === 'POST' && b && c === 'status') {
        const o = await env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(Number(b)).first();
        if (!o || !canSee(user, o.restaurant_id)) return err('Order not found.', 404);
        const s = body.status;
        if (!['ordered', 'received', 'cancelled'].includes(s)) return err('Unknown status.');
        if (o.status !== 'ordered' && !admin) return err('Only an Admin can change this order now.', 403);
        await env.DB.prepare('UPDATE orders SET status = ?, received_at = ?, received_by = ? WHERE id = ?')
          .bind(s, s === 'received' ? now() : null, s === 'received' ? user.name : null, o.id).run();
        await audit(env, user.username, 'order_' + s, o.order_no);
        return json({ ok: true });
      }
      if (method === 'DELETE' && b) {
        const no = needAdmin(); if (no) return no;
        const o = await env.DB.prepare('SELECT order_no FROM orders WHERE id = ?').bind(Number(b)).first();
        await env.DB.batch([
          env.DB.prepare('DELETE FROM order_items WHERE order_id = ?').bind(Number(b)),
          env.DB.prepare('DELETE FROM orders WHERE id = ?').bind(Number(b)),
        ]);
        await audit(env, user.username, 'order_deleted', o && o.order_no);
        return json({ ok: true });
      }
    }

    // ----- users (Admin) -----
    if (a === 'users') {
      const no = needAdmin(); if (no) return no;
      if (method === 'GET') {
        const { results } = await env.DB.prepare('SELECT id, username, display_name, role, restaurants, active, locked_until, last_login FROM users ORDER BY role, username').all();
        return json({ users: results, now: now() });
      }
      if (method === 'POST') {
        const r = await createUser(env, body, false);
        if (r.error) return err(r.error);
        await audit(env, user.username, 'user_added', r.username);
        return json({ ok: true });
      }
      if (method === 'PUT' && b) {
        const id = Number(b);
        const u = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
        if (!u) return err('User not found.', 404);
        const role = body.role === 'admin' ? 'admin' : 'staff';
        const active = body.active === false || body.active === 0 ? 0 : 1;
        if (u.id === user.id && (role !== 'admin' || !active)) return err('You cannot remove your own Admin access.');
        const rest = Array.isArray(body.restaurants) ? body.restaurants.map(Number).filter(Boolean).join(',') : null;
        const st = [env.DB.prepare('UPDATE users SET display_name = ?, role = ?, restaurants = ?, active = ? WHERE id = ?')
          .bind(str(body.name, 80) || u.display_name, role, role === 'admin' ? null : (rest || null), active, id)];
        if (body.unlock) st.push(env.DB.prepare('UPDATE users SET failed_count = 0, locked_until = NULL WHERE id = ?').bind(id));
        if (body.password) {
          if (String(body.password).length < 6) return err('Password must be at least 6 characters.');
          const salt = randHex(16);
          st.push(env.DB.prepare('UPDATE users SET pass_hash = ?, pass_salt = ?, failed_count = 0, locked_until = NULL WHERE id = ?').bind(await hashPassword(String(body.password), salt), salt, id));
          st.push(env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id));
        }
        if (!active) st.push(env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id));
        await env.DB.batch(st);
        await audit(env, user.username, 'user_saved', u.username + (body.password ? ' (password reset)' : ''));
        return json({ ok: true });
      }
    }

    if (a === 'audit' && method === 'GET') {
      const no = needAdmin(); if (no) return no;
      const { results } = await env.DB.prepare('SELECT * FROM audit_log ORDER BY id DESC LIMIT 300').all();
      return json({ log: results });
    }

    return err('Not found.', 404);
  } catch (e) {
    return err('Server error: ' + (e && e.message ? e.message : String(e)), 500);
  }
}
