// OrderEase — database tables and starter data.
// The API runs these automatically the first time the website is opened (no SQL by hand).
export const DATA_VERSION = 2;

export const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT)`,
  `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin','staff')),
    pass_hash TEXT NOT NULL,
    pass_salt TEXT NOT NULL,
    restaurants TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    failed_count INTEGER NOT NULL DEFAULT 0,
    locked_until INTEGER,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    last_login INTEGER,
    position TEXT,
    photo TEXT)`,
  `CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    last_seen INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS restaurants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    short TEXT,
    color TEXT NOT NULL DEFAULT '#5A4636',
    address TEXT,
    sort INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1)`,
  `CREATE TABLE IF NOT EXISTS suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    contact TEXT,
    phone TEXT,
    email TEXT,
    notes TEXT,
    color TEXT NOT NULL DEFAULT '#5A4636',
    sort INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1)`,
  `CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id INTEGER NOT NULL,
    code TEXT,
    name TEXT NOT NULL,
    category TEXT,
    pack TEXT,
    unit TEXT,
    price REAL,
    image TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    updated_at INTEGER NOT NULL DEFAULT (unixepoch()))`,
  `CREATE INDEX IF NOT EXISTS idx_products_supplier ON products(supplier_id, active)`,
  `CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_no TEXT NOT NULL,
    restaurant_id INTEGER NOT NULL,
    supplier_id INTEGER NOT NULL,
    order_date TEXT NOT NULL,
    delivery_date TEXT,
    status TEXT NOT NULL DEFAULT 'ordered' CHECK (status IN ('ordered','received','cancelled')),
    note TEXT,
    total REAL NOT NULL DEFAULT 0,
    items_count INTEGER NOT NULL DEFAULT 0,
    created_by TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    received_at INTEGER,
    received_by TEXT)`,
  `CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(order_date)`,
  `CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    product_id INTEGER,
    code TEXT,
    name TEXT NOT NULL,
    pack TEXT,
    unit TEXT,
    qty REAL NOT NULL,
    price REAL,
    sort INTEGER NOT NULL DEFAULT 0)`,
  `CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id)`,
  `CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts INTEGER NOT NULL DEFAULT (unixepoch()),
    username TEXT,
    action TEXT NOT NULL,
    detail TEXT)`,
  `CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit_log(ts)`,
];

// Starter data — everything here can be renamed, edited or removed from the website later.
export const RESTAURANTS = [
  { name: 'The Plane', short: 'TP', color: '#E8902A' },
  { name: 'Daily Edition Cafe', short: 'ED', color: '#282828' },
  { name: 'Bupa', short: 'BU', color: '#3F7D63' },
  { name: 'Restaurant 4', short: 'R4', color: '#6D5BA8' },
];

export const SUPPLIERS = [
  { name: 'Gulfwest', color: '#1F5FA8', notes: 'Meat, dairy, sauces. Catalog books 1–3.' },
  { name: 'Bidfood', color: '#C2362B', notes: 'Barista milks, syrups, coffee supplies.' },
  { name: 'Laila Garden', color: '#2E8B57', notes: 'Vegetables and fruit (veg order).' },
  { name: 'Cash purchase', color: '#8A6D3B', notes: 'Bought with cash from the market.' },
];

// Example items taken from the WhatsApp chat. Items with no code show a "No code" badge until the code is added.
export const PRODUCTS = [
  ['Gulfwest', 'FBDMN031', 'Wagyu trimmings 65/35', 'Meat', '25 kg', 'carton'],
  ['Gulfwest', 'FBSTH007', 'Beef brisket (Black Angus / Russian)', 'Meat', '20 kg', 'carton'],
  ['Gulfwest', 'FRMOZB02', 'Cheese mozzarella block', 'Dairy', '4 x 2 kg', 'carton'],
  ['Gulfwest', 'CHPARM02', 'Parmesan cheese', 'Dairy', '2 x 5 kg', 'carton'],
  ['Gulfwest', '', 'American cheese slice', 'Dairy', '4 x 2.27 kg', 'carton'],
  ['Gulfwest', '', 'Mayonnaise', 'Sauces', '3.75 L', 'box'],
  ['Gulfwest', '', 'Ketchup', 'Sauces', '4 x 5 kg', 'carton'],
  ['Bidfood', 'fs4230037', 'Alpro Barista Almond', 'Milk', '1 L', 'pack'],
  ['Bidfood', 'fs4230038', 'Alpro Barista Oat milk', 'Milk', '1 L', 'pack'],
  ['Bidfood', 'fs4230023', 'Coconut milk Barista', 'Milk', '1 L', 'pack'],
  ['Bidfood', '449221', 'Monin Peach syrup', 'Syrups', '70 cl', 'bottle'],
  ['Bidfood', '4491820', 'Monin Vanilla syrup', 'Syrups', '70 cl', 'bottle'],
];
