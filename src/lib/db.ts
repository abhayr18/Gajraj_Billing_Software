/**
 * Database module for Gajraj Kirana Stores Billing Software
 * Uses better-sqlite3 for synchronous SQLite operations.
 * All tables: products, customers, invoices, invoice_items, settings, categories
 */

import Database from 'better-sqlite3';
import path from 'path';

/* ---------- Connection ---------- */
const DB_PATH = path.join(process.cwd(), 'gajraj_store.db');
const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

/* ---------- Schema ---------- */
db.exec(`
  -- Product categories
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- Products / Inventory
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    sku TEXT UNIQUE,
    category TEXT DEFAULT '',
    hsn_code TEXT DEFAULT '',
    purchase_price REAL DEFAULT 0,
    selling_price REAL NOT NULL DEFAULT 0,
    quantity REAL DEFAULT 0,
    unit TEXT DEFAULT 'pcs',
    low_stock_alert REAL DEFAULT 10,
    gst_rate REAL DEFAULT 0,
    description TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  -- Customers
  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT DEFAULT '',
    email TEXT DEFAULT '',
    address TEXT DEFAULT '',
    gstin TEXT DEFAULT '',
    balance REAL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  -- Invoices (bills)
  CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_number TEXT NOT NULL UNIQUE,
    customer_id INTEGER,
    customer_name TEXT DEFAULT 'Walk-in Customer',
    customer_phone TEXT DEFAULT '',
    subtotal REAL DEFAULT 0,
    discount_amount REAL DEFAULT 0,
    gst_enabled INTEGER DEFAULT 0,
    gst_amount REAL DEFAULT 0,
    gst_rate REAL DEFAULT 0,
    total_amount REAL DEFAULT 0,
    amount_paid REAL DEFAULT 0,
    payment_method TEXT DEFAULT 'cash',
    payment_status TEXT DEFAULT 'paid',
    notes TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  );

  -- Invoice line items
  CREATE TABLE IF NOT EXISTS invoice_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER NOT NULL,
    product_id INTEGER,
    product_name TEXT NOT NULL,
    quantity REAL NOT NULL DEFAULT 1,
    unit TEXT DEFAULT 'pcs',
    price REAL NOT NULL DEFAULT 0,
    discount REAL DEFAULT 0,
    total REAL NOT NULL DEFAULT 0,
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
  );

  -- Store settings (key-value)
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT DEFAULT ''
  );
`);

/* ---------- Migrations ---------- */
try {
  db.exec('ALTER TABLE invoices ADD COLUMN amount_paid REAL DEFAULT 0');
} catch (error: any) {
  if (!error.message.includes('duplicate column name')) {
    console.error('Migration error:', error);
  }
}

/* ---------- Seed default settings ---------- */
const seedSettings = db.prepare(
  `INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`
);
const defaultSettings: [string, string][] = [
  ['store_name', 'Gajraj Kirana Stores'],
  ['store_address', ''],
  ['store_phone', ''],
  ['store_email', ''],
  ['store_gstin', ''],
  ['gmail_user', ''],
  ['gmail_app_password', ''],
  ['low_stock_email', ''],
  ['invoice_prefix', 'GKS'],
  ['invoice_counter', '1'],
];
const seedTx = db.transaction(() => {
  for (const [k, v] of defaultSettings) seedSettings.run(k, v);
});
seedTx();

/* ---------- Seed default categories ---------- */
const seedCat = db.prepare(
  `INSERT OR IGNORE INTO categories (name) VALUES (?)`
);
const defaultCategories = [
  'Grocery', 'Dairy', 'Beverages', 'Snacks', 'Personal Care',
  'Household', 'Spices', 'Pulses', 'Rice & Flour', 'Oil & Ghee',
];
const seedCatTx = db.transaction(() => {
  for (const c of defaultCategories) seedCat.run(c);
});
seedCatTx();

export default db;
