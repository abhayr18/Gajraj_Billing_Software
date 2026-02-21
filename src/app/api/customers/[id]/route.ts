/**
 * /api/customers/[id] — GET, PUT, DELETE single customer + purchase history
 */

import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const withHistory = searchParams.get('history') === '1';

  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
  if (!customer) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (withHistory) {
    const invoices = db.prepare(`
      SELECT * FROM invoices WHERE customer_id = ? ORDER BY created_at DESC
    `).all(id);
    return NextResponse.json({ customer, invoices });
  }
  return NextResponse.json(customer);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { name, phone, email, address, gstin } = body;

    db.prepare(`
      UPDATE customers SET name=?, phone=?, email=?, address=?, gstin=?, updated_at=datetime('now')
      WHERE id=?
    `).run(name, phone || '', email || '', address || '', gstin || '', id);

    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
    return NextResponse.json(customer);
  } catch (error) {
    console.error('Customer PUT error:', error);
    return NextResponse.json({ error: 'Failed to update customer' }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  db.prepare('DELETE FROM customers WHERE id = ?').run(id);
  return NextResponse.json({ success: true });
}
