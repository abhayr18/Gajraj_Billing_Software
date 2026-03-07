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

    const storeName = settings.store_name || 'Store';
    const storeAddress = settings.store_address;
    const storePhone = settings.store_phone;
    const storeGstin = settings.store_gstin;

    const theme = settings.invoice_theme || 'professional';

    return (
        <div className="bg-gray-100 min-h-screen py-8 print:py-0 print:bg-white flex justify-center text-black">
            <div className={`${theme === 'thermal' ? 'w-[300px]' : 'w-[800px]'} border border-gray-300 bg-white p-6 print:w-full print:max-w-none print:border-none print:p-0 mx-auto`} id="print-area">
                <PrintActions />

                {theme === 'thermal' ? (
                    /* THERMAL RECEIPT LAYOUT */
                    <div className="font-mono text-sm leading-tight text-black pb-8 shrink-0">
                        {/* Header */}
                        <div className="text-center mb-4">
                            <h2 className="font-bold text-lg uppercase">{storeName}</h2>
                            {storeAddress && <p className="text-xs mt-1 whitespace-pre-line">{storeAddress}</p>}
                            {storePhone && <p className="text-xs">PHONE : {storePhone}</p>}
                            {storeGstin && <p className="text-xs">GSTIN : {storeGstin}</p>}
                        </div>

                        <div className="text-center font-bold mb-4">
                            <p>Retail Invoice</p>
                        </div>

                        {/* Metadata */}
                        <div className="mb-4">
                            <p>Date : {format(new Date(invoice.created_at), 'dd/MM/yyyy, hh:mm a')}</p>
                            <p className="font-bold mt-2">{invoice.customer_name}</p>
                            <p>Bill No: {invoice.invoice_number}</p>
                            <p>Payment Mode: {invoice.payment_method}</p>
                        </div>

                        {/* Items Table */}
                        <div className="border-t border-b border-dashed border-black py-1 mb-2">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-dashed border-black">
                                        <th className="text-left font-bold pb-1 w-3/5">Item</th>
                                        <th className="text-center font-bold pb-1 w-1/5">Qty</th>
                                        <th className="text-right font-bold pb-1 w-1/5">Amt</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map((item) => (
                                        <tr key={item.id}>
                                            <td className="py-1 break-words align-top pr-1">{item.product_name}</td>
                                            <td className="py-1 text-center align-top">{item.quantity}</td>
                                            <td className="py-1 text-right align-top">{item.total.toFixed(2)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Totals */}
                        <div className="flex justify-between mb-1">
                            <span>Sub Total</span>
                            <div className="text-right">
                                <span className="inline-block w-8 text-center">{items.reduce((acc, curr) => acc + curr.quantity, 0)}</span>
                                <span className="inline-block w-16 text-right">{invoice.subtotal.toFixed(2)}</span>
                            </div>
                        </div>

                        {invoice.discount_amount > 0 && (
                            <div className="flex justify-between mb-1">
                                <span>(-) Discount</span>
                                <span>{invoice.discount_amount.toFixed(2)}</span>
                            </div>
                        )}

                        {invoice.gst_enabled === 1 && (
                            <div className="flex justify-end text-right text-xs mb-1">
                                <div className="space-y-0.5">
                                    <p>GST @ {invoice.gst_rate}% : {invoice.gst_amount.toFixed(2)}</p>
                                </div>
                            </div>
                        )}

                        <div className="flex justify-between border-t border-dashed border-black pt-1 font-bold mb-4">
                            <span>TOTAL</span>
                            <span>Rs {invoice.total_amount.toFixed(2)}</span>
                        </div>

                        {/* Payment */}
                        <div className="flex justify-between border-b border-dashed border-black pb-2 mb-4">
                            <span>{invoice.payment_method} :</span>
                            <span>Rs {(invoice.amount_paid || invoice.total_amount).toFixed(2)}</span>
                        </div>

                        {/* Footer */}
                        <div className="text-right text-xs font-bold mt-8">
                            <p>E & O.E</p>
                        </div>
                        <div className="text-center text-xs mt-4">
                            <p>Thank you for visiting!</p>
                        </div>
                    </div>
                ) : (
                    /* PROFESSIONAL A4 LAYOUT */
                    <div style={{ fontFamily: 'Arial, Helvetica, sans-serif' }} className="text-black bg-white text-xs max-w-4xl mx-auto">
                        <div className="border border-black flex flex-col">
                            {/* Top Header Row */}
                            <div className="flex justify-between p-1 border-b border-black text-[10px]">
                                <span>Page No. 1 of 1</span>
                                <span className="font-bold text-sm">BILL OF SUPPLY</span>
                                <span>Original Copy</span>
                            </div>

                            {/* Company Info */}
                            <div className="flex border-b border-black p-2 items-center">
                                <div className="flex-1 text-center">
                                    <h2 className="font-bold text-lg uppercase">{storeName}</h2>
                                    <p>{storeAddress}</p>
                                    <p>Mobile: {storePhone} {settings.store_email ? `| Email: ${settings.store_email}` : ''}</p>
                                    {storeGstin && <p>GSTIN - {storeGstin}</p>}
                                </div>
                            </div>

                            {/* Billing Details & Invoice Details Row */}
                            <div className="flex border-b border-black">
                                <div className="w-1/2 border-r border-black p-2">
                                    <h3 className="font-bold text-sm mb-1">Billing Details</h3>
                                    <p className="font-bold">Name: {invoice.customer_name}</p>
                                    {invoice.customer_phone && <p>Mobile: {invoice.customer_phone}</p>}
                                </div>
                                <div className="w-1/2 p-2">
                                    <table className="w-full text-xs">
                                        <tbody>
                                            <tr><td className="w-24 font-bold">Invoice</td><td>: {invoice.invoice_number}</td></tr>
                                            <tr><td className="w-24 font-bold">Invoice Date</td><td>: {format(new Date(invoice.created_at), 'dd-MMM-yyyy')}</td></tr>
                                            <tr><td className="w-24 font-bold">Payment Mode</td><td>: <span className="uppercase">{invoice.payment_method}</span></td></tr>
                                            <tr><td className="w-24 font-bold">Status</td><td>: <span className="uppercase">{invoice.payment_status}</span></td></tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Items Table */}
                            <table className="w-full text-xs border-collapse text-left">
                                <thead className="border-b border-black">
                                    <tr>
                                        <th className="border-r border-black p-1 text-center w-8">Sr.</th>
                                        <th className="border-r border-black p-1">Item Description</th>
                                        <th className="border-r border-black p-1 text-center w-12">Qty</th>
                                        <th className="border-r border-black p-1 text-center w-12">Unit</th>
                                        <th className="border-r border-black p-1 text-right w-20">List Price</th>
                                        <th className="border-r border-black p-1 text-right w-16">Disc.</th>
                                        <th className="border-r border-black p-1 text-right w-16">Tax %</th>
                                        <th className="p-1 text-right w-24">Amount (₹)</th>
                                    </tr>
                                </thead>
                                <tbody className="align-top border-b border-black">
                                    {items.map((item, idx) => (
                                        <tr key={item.id}>
                                            <td className="border-r border-black p-1 text-center h-[28px]">{idx + 1}</td>
                                            <td className="border-r border-black p-1">{item.product_name}</td>
                                            <td className="border-r border-black p-1 text-center">{item.quantity}</td>
                                            <td className="border-r border-black p-1 text-center">{item.unit}</td>
                                            <td className="border-r border-black p-1 text-right">{(item.price).toFixed(2)}</td>
                                            <td className="border-r border-black p-1 text-right">{item.discount > 0 ? item.discount.toFixed(2) : '-'}</td>
                                            <td className="border-r border-black p-1 text-right">{invoice.gst_enabled ? invoice.gst_rate : '0.00'}</td>
                                            <td className="p-1 text-right">{(item.total).toFixed(2)}</td>
                                        </tr>
                                    ))}
                                    {/* Empty padding row to push footer down a bit */}
                                    <tr>
                                        <td className="border-r border-black p-1 h-[60px]">&nbsp;</td>
                                        <td className="border-r border-black p-1"></td>
                                        <td className="border-r border-black p-1"></td>
                                        <td className="border-r border-black p-1"></td>
                                        <td className="border-r border-black p-1"></td>
                                        <td className="border-r border-black p-1"></td>
                                        <td className="border-r border-black p-1"></td>
                                        <td className="p-1"></td>
                                    </tr>
                                </tbody>
                            </table>

                            {/* Totals Section */}
                            <div className="flex flex-col border-b border-black">
                                <div className="flex border-b border-black p-1">
                                    <div className="w-[85%] text-right pr-2">Subtotal</div>
                                    <div className="w-[15%] text-right">{invoice.subtotal.toFixed(2)}</div>
                                </div>
                                {(invoice.discount_amount || 0) > 0 && (
                                    <div className="flex border-b border-black p-1">
                                        <div className="w-[85%] text-right pr-2">Discount</div>
                                        <div className="w-[15%] text-right">-{invoice.discount_amount.toFixed(2)}</div>
                                    </div>
                                )}
                                {invoice.gst_enabled === 1 && (
                                    <div className="flex border-b border-black p-1">
                                        <div className="w-[85%] text-right pr-2">GST ({invoice.gst_rate}%)</div>
                                        <div className="w-[15%] text-right">{invoice.gst_amount.toFixed(2)}</div>
                                    </div>
                                )}
                                <div className="flex p-1">
                                    <div className="w-[85%] text-right pr-2 font-bold">Total</div>
                                    <div className="w-[15%] text-right font-bold">{invoice.total_amount.toFixed(2)}</div>
                                </div>
                            </div>

                            {/* Amount in Words */}
                            <div className="border-b border-black p-1 font-bold">
                                Total Amount: Rs. {invoice.total_amount.toFixed(2)} Only
                            </div>

                            {/* Payment Summary */}
                            <div className="border-b border-black p-1 font-bold text-[10px]">
                                Settled by - {invoice.payment_method} : {(invoice.payment_status === 'unpaid' ? 0 : (invoice.amount_paid ?? invoice.total_amount)).toFixed(2)}
                                {invoice.payment_status !== 'paid' && ` | Invoice Balance : ${(invoice.total_amount - (invoice.payment_status === 'unpaid' ? 0 : (invoice.amount_paid ?? invoice.total_amount))).toFixed(2)}`}
                            </div>

                            {/* Footer info blocks: Terms, Signature */}
                            <div className="flex min-h-[120px]">
                                <div className="flex-1 border-r border-black p-2 text-[10px]">
                                    <h4 className="font-bold mb-1 text-sm">Terms and Conditions</h4>
                                    {invoice.notes ? (
                                        <p className="whitespace-pre-line">{invoice.notes}</p>
                                    ) : (
                                        <>
                                            <p>E & O.E</p>
                                            <p>1. Goods once sold will not be taken back.</p>
                                            <p>2. Interest @ 18% p.a. will be charged if the payment is not made within the stipulated time.</p>
                                            <p>3. Subject to jurisdiction only.</p>
                                        </>
                                    )}
                                </div>
                                <div className="w-[35%] p-2 text-right flex flex-col justify-between">
                                    <div className="font-bold uppercase break-words">For {storeName}</div>
                                    <div className="font-bold mt-auto mb-2 text-sm">Signature</div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
