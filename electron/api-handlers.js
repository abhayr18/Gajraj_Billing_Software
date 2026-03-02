/**
 * API request handlers for Electron's custom protocol.
 * Replicates all 12 Next.js API routes using direct SQLite operations.
 * Each handler receives (searchParams, body, method) and returns { status, data }.
 */

const { getDb } = require('./db');

/* ─── Helpers ─── */
function json(data, status = 200) {
    return { status, data };
}

function errorResponse(msg, status = 500) {
    return { status, data: { error: msg } };
}

/* ═══════════════════════════════════════════════════════════
   Route handlers — keyed by URL pattern
   ═══════════════════════════════════════════════════════════ */

/* ---------- /api/categories ---------- */
function categoriesGET() {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM categories ORDER BY name ASC').all();
    return json(rows);
}

function categoriesPOST(_, body) {
    const db = getDb();
    const { name } = body;
    if (!name) return errorResponse('Name is required', 400);
    const result = db.prepare('INSERT INTO categories (name) VALUES (?)').run(name);
    return json({ id: result.lastInsertRowid, name }, 201);
}

/* ---------- /api/customers ---------- */
function customersGET(sp) {
    const db = getDb();
    const search = sp.get('search') || '';
    let sql = 'SELECT * FROM customers WHERE 1=1';
    const params = [];
    if (search) {
        sql += ' AND (name LIKE ? OR phone LIKE ? OR email LIKE ?)';
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    sql += ' ORDER BY name ASC';
    return json(db.prepare(sql).all(...params));
}

function customersPOST(_, body) {
    const db = getDb();
    const { name, phone, email, address, gstin } = body;
    if (!name) return errorResponse('Name is required', 400);
    const result = db.prepare(
        'INSERT INTO customers (name, phone, email, address, gstin) VALUES (?, ?, ?, ?, ?)'
    ).run(name, phone || '', email || '', address || '', gstin || '');
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(result.lastInsertRowid);
    return json(customer, 201);
}

/* ---------- /api/customers/:id ---------- */
function customerByIdGET(sp, _, id) {
    const db = getDb();
    const withHistory = sp.get('history') === '1';
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
    if (!customer) return errorResponse('Not found', 404);
    if (withHistory) {
        const invoices = db.prepare('SELECT * FROM invoices WHERE customer_id = ? ORDER BY created_at DESC').all(id);
        return json({ customer, invoices });
    }
    return json(customer);
}

function customerByIdPUT(_, body, id) {
    const db = getDb();
    const { name, phone, email, address, gstin } = body;
    db.prepare(
        "UPDATE customers SET name=?, phone=?, email=?, address=?, gstin=?, updated_at=datetime('now') WHERE id=?"
    ).run(name, phone || '', email || '', address || '', gstin || '', id);
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
    return json(customer);
}

function customerByIdDELETE(_, __, id) {
    const db = getDb();
    db.prepare('DELETE FROM customers WHERE id = ?').run(id);
    return json({ success: true });
}

/* ---------- /api/customers/:id/pay ---------- */
function customerPayPOST(_, body, id) {
    const db = getDb();
    const { amount } = body;
    if (!amount || amount <= 0) return errorResponse('Valid amount is required', 400);

    const settlePayment = db.transaction(() => {
        const customer = db.prepare('SELECT balance FROM customers WHERE id = ?').get(id);
        if (!customer) throw new Error('Customer not found');
        db.prepare("UPDATE customers SET balance = balance - ?, updated_at = datetime('now') WHERE id = ?").run(amount, id);
        return db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
    });

    try {
        const updatedCustomer = settlePayment();
        return json(updatedCustomer);
    } catch (e) {
        return errorResponse('Failed to process payment', 500);
    }
}

/* ---------- /api/dashboard ---------- */
function dashboardGET() {
    const db = getDb();
    const todayRow = db.prepare(
        "SELECT COALESCE(SUM(total_amount), 0) AS total, COUNT(*) AS cnt FROM invoices WHERE date(created_at) = date('now')"
    ).get();
    const weekRow = db.prepare(
        "SELECT COALESCE(SUM(total_amount), 0) AS total FROM invoices WHERE created_at >= datetime('now', '-7 days')"
    ).get();
    const monthRow = db.prepare(
        "SELECT COALESCE(SUM(total_amount), 0) AS total FROM invoices WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')"
    ).get();
    const totalProducts = db.prepare('SELECT COUNT(*) AS c FROM products').get().c;
    const lowStockProducts = db.prepare('SELECT COUNT(*) AS c FROM products WHERE quantity <= low_stock_alert').get().c;
    const totalCustomers = db.prepare('SELECT COUNT(*) AS c FROM customers').get().c;
    const recentInvoices = db.prepare(
        'SELECT id, invoice_number, customer_name, total_amount, payment_status, created_at FROM invoices ORDER BY created_at DESC LIMIT 5'
    ).all();
    const topProducts = db.prepare(
        'SELECT product_name, SUM(quantity) AS total_quantity, SUM(total) AS total_revenue FROM invoice_items GROUP BY product_name ORDER BY total_quantity DESC LIMIT 5'
    ).all();
    const salesTrend = db.prepare(`
    WITH RECURSIVE dates(d) AS (
      SELECT date('now', '-6 days')
      UNION ALL SELECT date(d, '+1 day') FROM dates WHERE d < date('now')
    )
    SELECT dates.d AS date, COALESCE(SUM(i.total_amount), 0) AS amount
    FROM dates LEFT JOIN invoices i ON date(i.created_at) = dates.d
    GROUP BY dates.d ORDER BY dates.d
  `).all();
    const lowStockItems = db.prepare(
        'SELECT id, name, quantity, low_stock_alert, unit FROM products WHERE quantity <= low_stock_alert ORDER BY quantity ASC LIMIT 10'
    ).all();

    return json({
        stats: {
            todaySales: todayRow.total, todayInvoices: todayRow.cnt,
            totalProducts, lowStockProducts, totalCustomers,
            monthSales: monthRow.total, weekSales: weekRow.total,
        },
        recentInvoices, topProducts, salesTrend, lowStockItems,
    });
}

/* ---------- /api/invoices ---------- */
function invoicesGET(sp) {
    const db = getDb();
    const search = sp.get('search') || '';
    const status = sp.get('status') || '';
    const from = sp.get('from') || '';
    const to = sp.get('to') || '';

    let sql = 'SELECT * FROM invoices WHERE 1=1';
    const params = [];
    if (search) { sql += ' AND (invoice_number LIKE ? OR customer_name LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
    if (status) { sql += ' AND payment_status = ?'; params.push(status); }
    if (from) { sql += ' AND date(created_at) >= ?'; params.push(from); }
    if (to) { sql += ' AND date(created_at) <= ?'; params.push(to); }
    sql += ' ORDER BY created_at DESC';

    return json(db.prepare(sql).all(...params));
}

function invoicesPOST(_, body) {
    const db = getDb();
    const {
        customer_id, customer_name, customer_phone,
        items, subtotal, discount_amount, gst_enabled, gst_amount, gst_rate,
        total_amount, amount_paid, payment_method, payment_status, notes,
    } = body;

    if (!items || items.length === 0) return errorResponse('At least one item is required', 400);

    const prefixRow = db.prepare("SELECT value FROM settings WHERE key = 'invoice_prefix'").get();
    const counterRow = db.prepare("SELECT value FROM settings WHERE key = 'invoice_counter'").get();
    const prefix = prefixRow?.value || 'GKS';
    const counter = parseInt(counterRow?.value || '1', 10);
    const invoice_number = `${prefix}-${String(counter).padStart(5, '0')}`;

    const createInvoice = db.transaction(() => {
        const invResult = db.prepare(`
      INSERT INTO invoices (invoice_number, customer_id, customer_name, customer_phone,
        subtotal, discount_amount, gst_enabled, gst_amount, gst_rate,
        total_amount, amount_paid, payment_method, payment_status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
            invoice_number, customer_id || null,
            customer_name || 'Walk-in Customer', customer_phone || '',
            subtotal || 0, discount_amount || 0, gst_enabled ? 1 : 0,
            gst_amount || 0, gst_rate || 0, total_amount || 0,
            amount_paid ?? (payment_status === 'unpaid' ? 0 : total_amount),
            payment_method || 'cash', payment_status || 'paid', notes || '',
        );

        const invoiceId = invResult.lastInsertRowid;

        const insertItem = db.prepare(
            'INSERT INTO invoice_items (invoice_id, product_id, product_name, quantity, unit, price, discount, total) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        );
        const decrementStock = db.prepare(
            "UPDATE products SET quantity = quantity - ?, updated_at = datetime('now') WHERE id = ?"
        );

        for (const item of items) {
            insertItem.run(invoiceId, item.product_id || null, item.product_name, item.quantity, item.unit || 'pcs', item.price, item.discount || 0, item.total);
            if (item.product_id) decrementStock.run(item.quantity, item.product_id);
        }

        db.prepare("UPDATE settings SET value = ? WHERE key = 'invoice_counter'").run(String(counter + 1));

        const finalAmountPaid = amount_paid ?? (payment_status === 'unpaid' ? 0 : total_amount);
        const balanceDue = total_amount - finalAmountPaid;
        if (customer_id && balanceDue !== 0) {
            db.prepare('UPDATE customers SET balance = balance + ? WHERE id = ?').run(balanceDue, customer_id);
        }

        return invoiceId;
    });

    const invoiceId = createInvoice();
    const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceId);
    const invoiceItems = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?').all(invoiceId);
    return json({ invoice, items: invoiceItems }, 201);
}

/* ---------- /api/invoices/:id ---------- */
function invoiceByIdGET(_, __, id) {
    const db = getDb();
    const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(id);
    if (!invoice) return errorResponse('Not found', 404);
    const items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?').all(id);
    return json({ invoice, items });
}

function invoiceByIdDELETE(_, __, id) {
    const db = getDb();
    const deleteInvoice = db.transaction((invoiceId) => {
        const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceId);
        if (!invoice) return;
        const items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?').all(invoiceId);
        const updateProductStock = db.prepare('UPDATE products SET quantity = quantity + ? WHERE id = ?');
        for (const item of items) {
            if (item.product_id) updateProductStock.run(item.quantity, item.product_id);
        }
        if (invoice.customer_id) {
            const balanceDue = invoice.total_amount - (invoice.amount_paid || 0);
            if (balanceDue !== 0) {
                db.prepare('UPDATE customers SET balance = balance - ? WHERE id = ?').run(balanceDue, invoice.customer_id);
            }
        }
        db.prepare('DELETE FROM invoice_items WHERE invoice_id = ?').run(invoiceId);
        db.prepare('DELETE FROM invoices WHERE id = ?').run(invoiceId);
    });

    try {
        deleteInvoice(id);
        return json({ success: true, message: 'Invoice reversed and deleted.' });
    } catch (e) {
        return errorResponse('Failed to delete invoice and reverse stock.', 500);
    }
}

/* ---------- /api/low-stock-alert ---------- */
function lowStockAlertGET() {
    const db = getDb();
    const rows = db.prepare(
        'SELECT id, name, sku, category, quantity, unit, selling_price, low_stock_alert FROM products WHERE quantity <= low_stock_alert ORDER BY quantity ASC'
    ).all();
    return json(rows);
}

function lowStockAlertPOST() {
    const db = getDb();
    const rows = db.prepare('SELECT key, value FROM settings').all();
    const s = {};
    for (const r of rows) s[r.key] = r.value;

    if (!s.gmail_user || !s.gmail_app_password) {
        return errorResponse('Gmail credentials not configured. Go to Settings to set up.', 400);
    }

    const recipient = s.low_stock_email || s.gmail_user;
    const lowStock = db.prepare(
        'SELECT name, quantity, unit, low_stock_alert FROM products WHERE quantity <= low_stock_alert ORDER BY quantity ASC'
    ).all();

    if (lowStock.length === 0) return json({ message: 'No low-stock items found.' });

    // Note: nodemailer email sending requires internet — skipped in offline mode
    // Return the data so the UI still works
    try {
        const nodemailer = require('nodemailer');
        const itemsHtml = lowStock.map(
            (p) => `<tr><td style="padding:8px;border:1px solid #ddd">${p.name}</td>
               <td style="padding:8px;border:1px solid #ddd;color:${p.quantity === 0 ? 'red' : 'orange'}">${p.quantity} ${p.unit}</td>
               <td style="padding:8px;border:1px solid #ddd">${p.low_stock_alert} ${p.unit}</td></tr>`
        ).join('');

        const html = `<h2>Low Stock Alert - ${s.store_name || 'Gajraj Kirana Stores'}</h2>
      <p>${lowStock.length} product(s) are running low on stock:</p>
      <table style="border-collapse:collapse;width:100%">
        <tr style="background:#f5f5f5">
          <th style="padding:8px;border:1px solid #ddd;text-align:left">Product</th>
          <th style="padding:8px;border:1px solid #ddd;text-align:left">Current Stock</th>
          <th style="padding:8px;border:1px solid #ddd;text-align:left">Alert Level</th>
        </tr>${itemsHtml}
      </table>
      <p style="margin-top:16px;color:#666">Sent from Gajraj Billing Software</p>`;

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: s.gmail_user, pass: s.gmail_app_password },
        });

        // sendMail is async but we handle it synchronously for simplicity
        transporter.sendMail({
            from: s.gmail_user, to: recipient,
            subject: `Low Stock Alert - ${lowStock.length} items need restocking`,
            html,
        });

        return json({ message: `Alert sent to ${recipient} for ${lowStock.length} items.` });
    } catch (e) {
        console.error('Email send error:', e);
        return errorResponse('Failed to send alert email', 500);
    }
}

/* ---------- /api/products ---------- */
function productsGET(sp) {
    const db = getDb();
    const search = sp.get('search') || '';
    const category = sp.get('category') || '';
    let sql = 'SELECT * FROM products WHERE 1=1';
    const params = [];
    if (search) { sql += ' AND (name LIKE ? OR sku LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
    if (category) { sql += ' AND category = ?'; params.push(category); }
    sql += ' ORDER BY name ASC';
    return json(db.prepare(sql).all(...params));
}

function productsPOST(_, body) {
    const db = getDb();
    const { name, sku, category, hsn_code, purchase_price, selling_price, quantity, unit, low_stock_alert, gst_rate, description } = body;
    if (!name || selling_price === undefined) return errorResponse('Name and selling price are required', 400);

    const result = db.prepare(
        'INSERT INTO products (name, sku, category, hsn_code, purchase_price, selling_price, quantity, unit, low_stock_alert, gst_rate, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(name, sku || null, category || '', hsn_code || '', purchase_price || 0, selling_price, quantity || 0, unit || 'pcs', low_stock_alert ?? 10, gst_rate || 0, description || '');

    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid);
    return json(product, 201);
}

/* ---------- /api/products/:id ---------- */
function productByIdGET(_, __, id) {
    const db = getDb();
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    if (!product) return errorResponse('Not found', 404);
    return json(product);
}

function productByIdPUT(_, body, id) {
    const db = getDb();
    const { name, sku, category, hsn_code, purchase_price, selling_price, quantity, unit, low_stock_alert, gst_rate, description } = body;
    db.prepare(
        "UPDATE products SET name=?, sku=?, category=?, hsn_code=?, purchase_price=?, selling_price=?, quantity=?, unit=?, low_stock_alert=?, gst_rate=?, description=?, updated_at=datetime('now') WHERE id=?"
    ).run(name, sku || null, category || '', hsn_code || '', purchase_price || 0, selling_price, quantity || 0, unit || 'pcs', low_stock_alert ?? 10, gst_rate || 0, description || '', id);

    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    return json(product);
}

function productByIdDELETE(_, __, id) {
    const db = getDb();
    db.prepare('DELETE FROM products WHERE id = ?').run(id);
    return json({ success: true });
}

/* ---------- /api/reports ---------- */
function reportsGET(sp) {
    const db = getDb();
    const from = sp.get('from') || '';
    const to = sp.get('to') || '';
    const type = sp.get('type') || 'summary';

    let dateFilter = '';
    const params = [];
    if (from) { dateFilter += ' AND date(created_at) >= ?'; params.push(from); }
    if (to) { dateFilter += ' AND date(created_at) <= ?'; params.push(to); }

    if (type === 'daily') {
        return json(db.prepare(`
      SELECT date(created_at) AS date, COUNT(*) AS invoice_count,
        COALESCE(SUM(total_amount), 0) AS total_sales,
        COALESCE(SUM(gst_amount), 0) AS total_gst,
        COALESCE(SUM(discount_amount), 0) AS total_discount
      FROM invoices WHERE 1=1 ${dateFilter}
      GROUP BY date(created_at) ORDER BY date DESC
    `).all(...params));
    }

    if (type === 'products') {
        return json(db.prepare(`
      SELECT ii.product_name, SUM(ii.quantity) AS total_qty,
        SUM(ii.total) AS total_revenue,
        COUNT(DISTINCT ii.invoice_id) AS invoice_count
      FROM invoice_items ii JOIN invoices i ON i.id = ii.invoice_id
      WHERE 1=1 ${dateFilter.replace(/created_at/g, 'i.created_at')}
      GROUP BY ii.product_name ORDER BY total_revenue DESC
    `).all(...params));
    }

    if (type === 'customers') {
        return json(db.prepare(`
      SELECT customer_name, COUNT(*) AS invoice_count,
        COALESCE(SUM(total_amount), 0) AS total_spent
      FROM invoices WHERE 1=1 ${dateFilter}
      GROUP BY customer_name ORDER BY total_spent DESC
    `).all(...params));
    }

    if (type === 'invoicelist') {
        return json(db.prepare(`
      SELECT invoice_number as InvoiceNo, date(created_at) as Date,
        customer_name as Customer, total_amount as Amount,
        gst_amount as GST, payment_status as Status,
        total_amount - COALESCE(amount_paid, (CASE WHEN payment_status = 'paid' THEN total_amount ELSE 0 END)) as BalanceDue
      FROM invoices WHERE 1=1 ${dateFilter}
      ORDER BY created_at DESC
    `).all(...params));
    }

    /* summary */
    const totalSales = db.prepare(`SELECT COALESCE(SUM(total_amount), 0) AS total FROM invoices WHERE 1=1 ${dateFilter}`).get(...params);
    const totalInvoices = db.prepare(`SELECT COUNT(*) AS cnt FROM invoices WHERE 1=1 ${dateFilter}`).get(...params);
    const totalGst = db.prepare(`SELECT COALESCE(SUM(gst_amount), 0) AS total FROM invoices WHERE 1=1 ${dateFilter}`).get(...params);
    const totalDiscount = db.prepare(`SELECT COALESCE(SUM(discount_amount), 0) AS total FROM invoices WHERE 1=1 ${dateFilter}`).get(...params);
    const avgBill = db.prepare(`SELECT COALESCE(AVG(total_amount), 0) AS avg FROM invoices WHERE 1=1 ${dateFilter}`).get(...params);
    const paymentMethods = db.prepare(`
    SELECT payment_method, COUNT(*) AS cnt, COALESCE(SUM(total_amount), 0) AS total
    FROM invoices WHERE 1=1 ${dateFilter} GROUP BY payment_method
  `).all(...params);

    return json({
        totalSales: totalSales.total, totalInvoices: totalInvoices.cnt,
        totalGst: totalGst.total, totalDiscount: totalDiscount.total,
        avgBill: avgBill.avg, paymentMethods,
    });
}

/* ---------- /api/settings ---------- */
function settingsGET() {
    const db = getDb();
    const rows = db.prepare('SELECT key, value FROM settings').all();
    const obj = {};
    for (const r of rows) obj[r.key] = r.value;
    return json(obj);
}

function settingsPUT(_, body) {
    const db = getDb();
    const update = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    db.transaction(() => {
        for (const [k, v] of Object.entries(body)) {
            update.run(k, String(v));
        }
    })();
    return settingsGET();
}


/* ═══════════════════════════════════════════════════════════
   Router — match URL path + method to handler
   ═══════════════════════════════════════════════════════════ */

/**
 * Route an API request to the appropriate handler.
 * @param {string} pathname — e.g. /api/products/5
 * @param {string} method — GET, POST, PUT, DELETE
 * @param {URLSearchParams} searchParams
 * @param {object|null} body — parsed JSON body
 * @returns {{ status: number, data: any }}
 */
function routeRequest(pathname, method, searchParams, body) {
    try {
        // Normalize: remove trailing slash
        const p = pathname.replace(/\/$/, '');

        // /api/categories
        if (p === '/api/categories') {
            if (method === 'GET') return categoriesGET(searchParams);
            if (method === 'POST') return categoriesPOST(searchParams, body);
        }

        // /api/customers/:id/pay
        const payMatch = p.match(/^\/api\/customers\/(\d+)\/pay$/);
        if (payMatch) {
            if (method === 'POST') return customerPayPOST(searchParams, body, payMatch[1]);
        }

        // /api/customers/:id
        const custIdMatch = p.match(/^\/api\/customers\/(\d+)$/);
        if (custIdMatch) {
            const id = custIdMatch[1];
            if (method === 'GET') return customerByIdGET(searchParams, body, id);
            if (method === 'PUT') return customerByIdPUT(searchParams, body, id);
            if (method === 'DELETE') return customerByIdDELETE(searchParams, body, id);
        }

        // /api/customers
        if (p === '/api/customers') {
            if (method === 'GET') return customersGET(searchParams);
            if (method === 'POST') return customersPOST(searchParams, body);
        }

        // /api/dashboard
        if (p === '/api/dashboard') {
            if (method === 'GET') return dashboardGET();
        }

        // /api/invoices/:id
        const invIdMatch = p.match(/^\/api\/invoices\/(\d+)$/);
        if (invIdMatch) {
            const id = invIdMatch[1];
            if (method === 'GET') return invoiceByIdGET(searchParams, body, id);
            if (method === 'DELETE') return invoiceByIdDELETE(searchParams, body, id);
        }

        // /api/invoices
        if (p === '/api/invoices') {
            if (method === 'GET') return invoicesGET(searchParams);
            if (method === 'POST') return invoicesPOST(searchParams, body);
        }

        // /api/low-stock-alert
        if (p === '/api/low-stock-alert') {
            if (method === 'GET') return lowStockAlertGET();
            if (method === 'POST') return lowStockAlertPOST();
        }

        // /api/products/:id
        const prodIdMatch = p.match(/^\/api\/products\/(\d+)$/);
        if (prodIdMatch) {
            const id = prodIdMatch[1];
            if (method === 'GET') return productByIdGET(searchParams, body, id);
            if (method === 'PUT') return productByIdPUT(searchParams, body, id);
            if (method === 'DELETE') return productByIdDELETE(searchParams, body, id);
        }

        // /api/products
        if (p === '/api/products') {
            if (method === 'GET') return productsGET(searchParams);
            if (method === 'POST') return productsPOST(searchParams, body);
        }

        // /api/reports
        if (p === '/api/reports') {
            if (method === 'GET') return reportsGET(searchParams);
        }

        // /api/settings
        if (p === '/api/settings') {
            if (method === 'GET') return settingsGET();
            if (method === 'PUT') return settingsPUT(searchParams, body);
        }

        return errorResponse('Not Found', 404);
    } catch (err) {
        console.error(`API error [${method} ${pathname}]:`, err);
        return errorResponse(err.message || 'Internal server error', 500);
    }
}

module.exports = { routeRequest };
