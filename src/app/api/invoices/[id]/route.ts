/**
 * /api/invoices/[id] — GET single invoice with items, DELETE invoice
 */

import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(id);
  if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?').all(id);
  return NextResponse.json({ invoice, items });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Use a transaction to safely reverse the invoice's impacts
  const deleteInvoice = db.transaction((invoiceId: string) => {
    // 1. Get the invoice to know customer and totals
    const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceId) as any;
    if (!invoice) return;

    // 2. Get all items to restore stock
    const items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?').all(invoiceId) as any[];

    // 3. Restore product quantities
    const updateProductStock = db.prepare('UPDATE products SET quantity = quantity + ? WHERE id = ?');
    for (const item of items) {
      if (item.product_id) {
        updateProductStock.run(item.quantity, item.product_id);
      }
    }

    // 4. Reverse customer balance update
    // If there was a balance due added to the customer, subtract it back.
    if (invoice.customer_id) {
      const balanceDue = invoice.total_amount - (invoice.amount_paid || 0);
      if (balanceDue !== 0) {
        db.prepare('UPDATE customers SET balance = balance - ? WHERE id = ?').run(balanceDue, invoice.customer_id);
      }
    }

    // 5. Delete the invoice_items and the invoice itself
    db.prepare('DELETE FROM invoice_items WHERE invoice_id = ?').run(invoiceId);
    db.prepare('DELETE FROM invoices WHERE id = ?').run(invoiceId);
  });

  try {
    deleteInvoice(id);
    return NextResponse.json({ success: true, message: 'Invoice reversed and deleted.' });
  } catch (error) {
    console.error('Failed to delete invoice:', error);
    return NextResponse.json({ error: 'Failed to delete invoice and reverse stock.' }, { status: 500 });
  }
}
