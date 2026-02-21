import db from '@/lib/db';
import { format } from 'date-fns';
import { notFound } from 'next/navigation';
import PrintActions from './PrintActions';

export const dynamic = 'force-dynamic';

function formatCurrency(n: number) {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n);
}

export default async function PrintInvoicePage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = await params;
    const invoiceId = parseInt(resolvedParams.id, 10);
    if (isNaN(invoiceId)) return notFound();

    const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceId) as any;
    if (!invoice) return notFound();

    const items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?').all(invoiceId) as any[];
    const settingsRows = db.prepare('SELECT key, value FROM settings').all() as any[];
    const settings = settingsRows.reduce((acc, row) => ({ ...acc, [row.key]: row.value }), {});

    const storeName = settings.store_name || 'Gajraj Kirana Stores';
    const storeAddress = settings.store_address;
    const storePhone = settings.store_phone;
    const storeGstin = settings.store_gstin;

    return (
        <div className="bg-gray-100 min-h-screen py-8 print:py-0 print:bg-white flex justify-center text-black">
            <div className="w-[800px] border border-gray-300 bg-white p-10 print:w-full print:max-w-none print:border-none print:p-0" id="print-area">
                <PrintActions />

                {/* Printable Bill Content */}
                <div style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
                    {/* Header: Company Info & Invoice ID */}
                    <div className="flex justify-between items-start border-b-2 border-black pb-6 mb-6">
                        <div>
                            <h2 className="text-2xl font-bold uppercase">{storeName}</h2>
                            <p className="text-sm mt-1">{storeAddress || 'Store Address Not Set'}</p>
                            <p className="text-sm">
                                {storePhone && <span>Phone: {storePhone} </span>}
                            </p>
                            {storeGstin && <p className="text-sm mt-1 font-bold">GSTIN: {storeGstin}</p>}
                        </div>
                        <div className="text-right">
                            <h1 className="text-3xl font-bold mb-2 uppercase tracking-wider">Tax Invoice</h1>
                            <p className="text-xl font-bold">#{invoice.invoice_number}</p>
                            <p className="text-sm mt-1">Date: {format(new Date(invoice.created_at), 'dd/MM/yyyy')}</p>
                            <p className="text-sm">Time: {format(new Date(invoice.created_at), 'hh:mm a')}</p>
                        </div>
                    </div>

                    {/* Customer Info */}
                    <div className="mb-8 flex justify-between">
                        <div className="w-1/2">
                            <h3 className="text-sm font-bold bg-gray-200 px-2 py-1 uppercase border border-gray-400">Billed To</h3>
                            <div className="p-2 border border-t-0 border-gray-400 min-h-[80px]">
                                <p className="font-bold text-lg">{invoice.customer_name}</p>
                                {invoice.customer_phone && <p className="text-sm">Phone: {invoice.customer_phone}</p>}
                            </div>
                        </div>
                        <div className="w-1/3">
                            <h3 className="text-sm font-bold bg-gray-200 px-2 py-1 uppercase border border-gray-400">Payment Details</h3>
                            <div className="p-2 border border-t-0 border-gray-400 text-sm min-h-[80px]">
                                <p><span className="font-bold">Method:</span> <span className="uppercase">{invoice.payment_method}</span></p>
                                <p><span className="font-bold">Status:</span> <span className="uppercase">{invoice.payment_status}</span></p>
                            </div>
                        </div>
                    </div>

                    {/* Items Table */}
                    <table className="w-full text-sm mb-6 border-collapse border border-gray-400">
                        <thead className="bg-gray-200">
                            <tr>
                                <th className="border border-gray-400 py-2 px-3 text-left w-12">#</th>
                                <th className="border border-gray-400 py-2 px-3 text-left">Item Description</th>
                                <th className="border border-gray-400 py-2 px-3 text-right">Qty</th>
                                <th className="border border-gray-400 py-2 px-3 text-right">Rate</th>
                                <th className="border border-gray-400 py-2 px-3 text-right">Discount</th>
                                <th className="border border-gray-400 py-2 px-3 text-right">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((item, idx) => (
                                <tr key={item.id}>
                                    <td className="border border-gray-400 py-2 px-3 text-left">{idx + 1}</td>
                                    <td className="border border-gray-400 py-2 px-3 text-left font-medium">{item.product_name}</td>
                                    <td className="border border-gray-400 py-2 px-3 text-right">{item.quantity} {item.unit}</td>
                                    <td className="border border-gray-400 py-2 px-3 text-right">{formatCurrency(item.price)}</td>
                                    <td className="border border-gray-400 py-2 px-3 text-right">{item.discount > 0 ? formatCurrency(item.discount) : '-'}</td>
                                    <td className="border border-gray-400 py-2 px-3 text-right font-bold">{formatCurrency(item.total)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {/* Totals & Notes Section */}
                    <div className="flex justify-between items-start">
                        <div className="w-1/2 pr-6">
                            {invoice.notes ? (
                                <div>
                                    <p className="font-bold text-sm mb-1">Notes / Terms:</p>
                                    <p className="text-sm border border-gray-400 p-2 min-h-[60px]">{invoice.notes}</p>
                                </div>
                            ) : (
                                <p className="text-sm text-gray-500 mt-4">Thank you for shopping with us.</p>
                            )}
                        </div>

                        <div className="w-80">
                            <table className="w-full text-sm border-collapse border border-gray-400">
                                <tbody>
                                    <tr>
                                        <td className="border border-gray-400 py-1.5 px-3 text-right w-1/2">Subtotal</td>
                                        <td className="border border-gray-400 py-1.5 px-3 text-right text-black">{formatCurrency(invoice.subtotal)}</td>
                                    </tr>
                                    {invoice.discount_amount > 0 && (
                                        <tr>
                                            <td className="border border-gray-400 py-1.5 px-3 text-right w-1/2">Discount</td>
                                            <td className="border border-gray-400 py-1.5 px-3 text-right text-red-700">-{formatCurrency(invoice.discount_amount)}</td>
                                        </tr>
                                    )}
                                    {invoice.gst_enabled === 1 && (
                                        <tr>
                                            <td className="border border-gray-400 py-1.5 px-3 text-right w-1/2">GST ({invoice.gst_rate}%)</td>
                                            <td className="border border-gray-400 py-1.5 px-3 text-right">{formatCurrency(invoice.gst_amount)}</td>
                                        </tr>
                                    )}
                                    <tr className="bg-gray-200 font-bold text-base">
                                        <td className="border border-gray-400 py-2 px-3 text-right">Grand Total</td>
                                        <td className="border border-gray-400 py-2 px-3 text-right">{formatCurrency(invoice.total_amount)}</td>
                                    </tr>
                                    {invoice.amount_paid !== null && invoice.amount_paid !== undefined && invoice.amount_paid > 0 && invoice.payment_status === 'partial' && (
                                        <>
                                            <tr>
                                                <td className="border border-gray-400 py-1.5 px-3 text-right">Amount Paid</td>
                                                <td className="border border-gray-400 py-1.5 px-3 text-right">{formatCurrency(invoice.amount_paid)}</td>
                                            </tr>
                                            <tr className="font-bold">
                                                <td className="border border-gray-400 py-1.5 px-3 text-right">Balance Due</td>
                                                <td className="border border-gray-400 py-1.5 px-3 text-right text-red-700">{formatCurrency(invoice.total_amount - invoice.amount_paid)}</td>
                                            </tr>
                                        </>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="mt-12 text-center text-xs font-bold border-t border-gray-400 pt-4">
                        <p>Goods once sold cannot be returned or exchanged without the original bill.</p>
                        <p className="mt-1">This is a system generated invoice.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
