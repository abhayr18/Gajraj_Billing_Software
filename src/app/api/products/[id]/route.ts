/**
 * /api/products/[id] — GET, PUT, DELETE a single product
 */

import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

/* ---------- GET single product ---------- */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  if (!product) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(product);
}

/* ---------- PUT update product ---------- */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const {
      name, sku, category, hsn_code, purchase_price,
      selling_price, quantity, unit, low_stock_alert, gst_rate, description,
    } = body;

    db.prepare(`
      UPDATE products SET
        name = ?, sku = ?, category = ?, hsn_code = ?, purchase_price = ?,
        selling_price = ?, quantity = ?, unit = ?, low_stock_alert = ?,
        gst_rate = ?, description = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(
      name, sku || null, category || '', hsn_code || '',
      purchase_price || 0, selling_price, quantity || 0,
      unit || 'pcs', low_stock_alert ?? 10, gst_rate || 0,
      description || '', id,
    );

    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    return NextResponse.json(product);
  } catch (error) {
    console.error('Product PUT error:', error);
    return NextResponse.json({ error: 'Failed to update product' }, { status: 500 });
  }
}

/* ---------- DELETE product ---------- */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  db.prepare('DELETE FROM products WHERE id = ?').run(id);
  return NextResponse.json({ success: true });
}
