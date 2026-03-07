/**
 * Invoices Page — List all invoices, view details, export to PDF/JPG
 * Uses jspdf + html2canvas for export functionality.
 */

'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Search, FileText, Trash2, Eye, Download, Image, AlertTriangle, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface Invoice {
  id: number; invoice_number: string; customer_name: string;
  customer_phone: string; subtotal: number; discount_amount: number;
  gst_enabled: number; gst_amount: number; gst_rate: number;
  total_amount: number; payment_method: string; payment_status: string;
  notes: string; created_at: string; store_name?: string;
}

interface InvoiceItem {
  id: number; product_name: string; quantity: number; unit: string;
  price: number; discount: number; total: number;
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [selectedItems, setSelectedItems] = useState<InvoiceItem[]>([]);
  const billRef = useRef<HTMLDivElement>(null);
  const [settings, setSettings] = useState<Record<string, string>>({});

  /* Delete Confirmation State */
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const fetchInvoices = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`/api/invoices?${params}`);
      setInvoices(await res.json());
    } catch { toast.error('Failed to load invoices'); }
    finally { setLoading(false); }
  }, [search, statusFilter]);

  useEffect(() => {
    fetchInvoices();
    fetch('/api/settings').then(r => r.json()).then(setSettings);
  }, [fetchInvoices]);

  const viewInvoice = async (inv: Invoice) => {
    const res = await fetch(`/api/invoices/${inv.id}`);
    const data = await res.json();
    setSelectedInvoice(data.invoice);
    setSelectedItems(data.items);
    setDetailOpen(true);
  };

  const promptDelete = (inv: Invoice) => {
    setInvoiceToDelete(inv);
    setDeleteConfirmText('');
    setDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!invoiceToDelete) return;
    setDeleting(true);
    try {
      await fetch(`/api/invoices/${invoiceToDelete.id}`, { method: 'DELETE' });
      toast.success('Invoice deleted permanently');
      setDeleteOpen(false);
      fetchInvoices();
    } catch {
      toast.error('Failed to delete invoice');
    } finally {
      setDeleting(false);
    }
  };

  /* Export to PDF */
  const exportPDF = async () => {
    if (!billRef.current) return;
    try {
      const { toPng } = await import('html-to-image');
      const imgData = await toPng(billRef.current, { backgroundColor: '#ffffff', pixelRatio: 2 });

      const jsPDFModule = await import('jspdf');
      const JsPDFConstructor = jsPDFModule.jsPDF || jsPDFModule.default || (jsPDFModule as any);

      const pdf = new (JsPDFConstructor as any)('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();

      const imgProps = pdf.getImageProperties(imgData);
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${selectedInvoice?.invoice_number || 'invoice'}.pdf`);
      toast.success('PDF exported!');
    } catch (error) {
      console.error('PDF Export Error:', error);
      toast.error('PDF export failed. Check browser console.');
    }
  };

  /* Export to JPG */
  const exportJPG = async () => {
    if (!billRef.current) return;
    try {
      const { toJpeg } = await import('html-to-image');
      const dataUrl = await toJpeg(billRef.current, { backgroundColor: '#ffffff', quality: 0.95, pixelRatio: 2 });

      const link = document.createElement('a');
      link.download = `${selectedInvoice?.invoice_number || 'invoice'}.jpg`;
      link.href = dataUrl;
      link.click();
      toast.success('JPG exported!');
    } catch (error) {
      console.error('JPG Export Error:', error);
      toast.error('JPG export failed. Check browser console.');
    }
  };

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n);

  const shareFromRow = async (inv: Invoice) => {
    const toastId = toast.loading('Preparing invoice...');
    await viewInvoice(inv);
    setTimeout(() => {
      toast.dismiss(toastId);
      shareOnWhatsApp(inv);
    }, 1000);
  };

  const shareOnWhatsApp = async (inv: Invoice | null) => {
    if (!inv || !billRef.current) {
      toast.error("Please view the invoice first to share.");
      return;
    }
    const toastId = toast.loading('Generating image for WhatsApp...');
    try {
      const store = (inv as any).store_name || settings?.store_name || "Store";
      const text = `Hello ${inv.customer_name},\n\nYour bill for Rs ${formatCurrency(inv.total_amount)} is ready at ${store}.\nInvoice No: ${inv.invoice_number}\nDate: ${format(new Date(inv.created_at), 'dd MMM yyyy')}\n\nThank you for visiting!`;
      const encoded = encodeURIComponent(text);

      const htmlToImage = await import('html-to-image');
      const blob = await htmlToImage.toBlob(billRef.current, { backgroundColor: '#ffffff', quality: 0.95, pixelRatio: 2 });

      if (!blob) throw new Error("Failed to generate image blob");

      const file = new File([blob], `Invoice_${inv.invoice_number}.jpg`, { type: 'image/jpeg' });

      let sharedNative = false;
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: `Invoice ${inv.invoice_number}`,
            text: text
          });
          sharedNative = true;
          toast.success('Shared successfully!', { id: toastId });
        } catch (shareErr) {
          console.warn("Share failed or cancelled:", shareErr);
        }
      }

      if (!sharedNative) {
        // Fallback: Copy to clipboard and open WA Web
        try {
          const pngBlob = await htmlToImage.toBlob(billRef.current, { backgroundColor: '#ffffff', pixelRatio: 2 }) as Blob;
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })]);
          toast.success('Invoice copied! Paste it in the WhatsApp chat.', { duration: 5000, id: toastId });
        } catch (clipErr) {
          // Fallback Download
          const link = document.createElement('a');
          link.download = `Invoice_${inv.invoice_number}.jpg`;
          link.href = URL.createObjectURL(blob);
          link.click();
          toast.success('Invoice file downloaded! Attach it in WhatsApp.', { duration: 5000, id: toastId });
        }

        let url = `https://wa.me/?text=${encoded}`;
        if (inv.customer_phone) {
          const cleanPhone = inv.customer_phone.replace(/\D/g, '');
          url = `https://wa.me/${cleanPhone}?text=${encoded}`;
        }
        setTimeout(() => {
          window.open(url, '_blank');
        }, 1000);
      }
    } catch (error) {
      console.error('Share Error:', error);
      toast.error('Failed to prepare invoice.', { id: toastId });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Invoices</h1>
        <p className="text-muted-foreground">View and manage all your bills</p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by invoice # or customer..." className="pl-10"
                value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="All Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="unpaid">Unpaid</SelectItem>
                <SelectItem value="partial">Partial</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Invoices Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" /> Invoices ({invoices.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
          ) : invoices.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-lg font-medium">No invoices found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">{inv.invoice_number}</TableCell>
                    <TableCell>{inv.customer_name}</TableCell>
                    <TableCell>{format(new Date(inv.created_at), 'dd MMM yyyy')}</TableCell>
                    <TableCell className="capitalize">{inv.payment_method}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(inv.total_amount)}</TableCell>
                    <TableCell>
                      <Badge variant={inv.payment_status === 'paid' ? 'secondary' : inv.payment_status === 'unpaid' ? 'destructive' : 'outline'}
                        className={inv.payment_status === 'paid' ? 'bg-green-100 text-green-700' : ''}>
                        {inv.payment_status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon-sm" variant="ghost" onClick={() => shareFromRow(inv)} title="Share on WhatsApp">
                          <MessageCircle className="h-4 w-4 text-green-600" />
                        </Button>
                        <Button size="icon-sm" variant="ghost" onClick={() => viewInvoice(inv)} title="View">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button size="icon-sm" variant="ghost" onClick={() => promptDelete(inv)} title="Delete">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Invoice Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Invoice {selectedInvoice?.invoice_number}</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="text-green-600 border-green-200 hover:bg-green-50" onClick={() => shareOnWhatsApp(selectedInvoice)}>
                  <MessageCircle className="mr-1 h-3 w-3" /> WhatsApp
                </Button>
                <Button size="sm" variant="outline" onClick={exportPDF}>
                  <Download className="mr-1 h-3 w-3" /> PDF
                </Button>
                <Button size="sm" variant="outline" onClick={exportJPG}>
                  <Image className="mr-1 h-3 w-3" /> JPG
                </Button>
              </div>
            </DialogTitle>
          </DialogHeader>

          {/* Printable Bill Content */}
          <div ref={billRef} className={settings.invoice_theme === 'thermal' ? "bg-white p-6 mx-auto w-[300px]" : "bg-white p-6 border border-gray-300 mt-4 text-black w-full"}>
            {settings.invoice_theme === 'thermal' ? (
              /* THERMAL RECEIPT LAYOUT */
              <div className="font-mono text-sm leading-tight text-black pb-8 shrink-0">
                {/* Header */}
                <div className="text-center mb-4">
                  <h2 className="font-bold text-lg uppercase">{selectedInvoice?.store_name || settings.store_name}</h2>
                  {settings.store_address && <p className="text-xs mt-1 whitespace-pre-line">{settings.store_address}</p>}
                  {settings.store_phone && <p className="text-xs">PHONE : {settings.store_phone}</p>}
                  {settings.store_gstin && <p className="text-xs">GSTIN : {settings.store_gstin}</p>}
                </div>

                <div className="text-center font-bold mb-4">
                  <p>Retail Invoice</p>
                </div>

                {/* Metadata */}
                <div className="mb-4">
                  {selectedInvoice && <p>Date : {format(new Date(selectedInvoice.created_at), 'dd/MM/yyyy, hh:mm a')}</p>}
                  <p className="font-bold mt-2">{selectedInvoice?.customer_name}</p>
                  <p>Bill No: {selectedInvoice?.invoice_number}</p>
                  <p>Payment Mode: {selectedInvoice?.payment_method}</p>
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
                      {selectedItems.map((item) => (
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
                    <span className="inline-block w-8 text-center">{selectedItems.reduce((acc, curr) => acc + curr.quantity, 0)}</span>
                    <span className="inline-block w-16 text-right">{selectedInvoice?.subtotal.toFixed(2)}</span>
                  </div>
                </div>

                {(selectedInvoice?.discount_amount || 0) > 0 && (
                  <div className="flex justify-between mb-1">
                    <span>(-) Discount</span>
                    <span>{selectedInvoice?.discount_amount.toFixed(2)}</span>
                  </div>
                )}

                {selectedInvoice?.gst_enabled === 1 && (
                  <div className="flex justify-end text-right text-xs mb-1">
                    <div className="space-y-0.5">
                      <p>GST @ {selectedInvoice.gst_rate}% : {selectedInvoice.gst_amount.toFixed(2)}</p>
                    </div>
                  </div>
                )}

                <div className="flex justify-between border-t border-dashed border-black pt-1 font-bold mb-4">
                  <span>TOTAL</span>
                  <span>Rs {selectedInvoice?.total_amount.toFixed(2)}</span>
                </div>

                {/* Payment */}
                <div className="flex justify-between border-b border-dashed border-black pb-2 mb-4">
                  <span>{selectedInvoice?.payment_method} :</span>
                  <span>Rs {((selectedInvoice as any)?.amount_paid || selectedInvoice?.total_amount || 0).toFixed(2)}</span>
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
                      <h2 className="font-bold text-lg uppercase">{selectedInvoice?.store_name || settings.store_name || "Company Name"}</h2>
                      <p>{settings.store_address}</p>
                      <p>Mobile: {settings.store_phone} {settings.store_email ? `| Email: ${settings.store_email}` : ''}</p>
                      {settings.store_gstin && <p>GSTIN - {settings.store_gstin}</p>}
                    </div>
                  </div>

                  {/* Billing Details & Invoice Details Row */}
                  <div className="flex border-b border-black">
                    <div className="w-1/2 border-r border-black p-2">
                      <h3 className="font-bold text-sm mb-1">Billing Details</h3>
                      <p className="font-bold">Name: {selectedInvoice?.customer_name}</p>
                      {selectedInvoice?.customer_phone && <p>Mobile: {selectedInvoice.customer_phone}</p>}
                    </div>
                    <div className="w-1/2 p-2">
                      <table className="w-full text-xs">
                        <tbody>
                          <tr><td className="w-24 font-bold">Invoice</td><td>: {selectedInvoice?.invoice_number}</td></tr>
                          <tr><td className="w-24 font-bold">Invoice Date</td><td>: {selectedInvoice && format(new Date(selectedInvoice.created_at), 'dd-MMM-yyyy')}</td></tr>
                          <tr><td className="w-24 font-bold">Payment Mode</td><td>: <span className="uppercase">{selectedInvoice?.payment_method}</span></td></tr>
                          <tr><td className="w-24 font-bold">Status</td><td>: <span className="uppercase">{selectedInvoice?.payment_status}</span></td></tr>
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
                      {selectedItems.map((item, idx) => (
                        <tr key={item.id}>
                          <td className="border-r border-black p-1 text-center h-[28px]">{idx + 1}</td>
                          <td className="border-r border-black p-1">{item.product_name}</td>
                          <td className="border-r border-black p-1 text-center">{item.quantity}</td>
                          <td className="border-r border-black p-1 text-center">{item.unit}</td>
                          <td className="border-r border-black p-1 text-right">{(item.price).toFixed(2)}</td>
                          <td className="border-r border-black p-1 text-right">{item.discount > 0 ? item.discount.toFixed(2) : '-'}</td>
                          <td className="border-r border-black p-1 text-right">{selectedInvoice?.gst_enabled ? selectedInvoice.gst_rate : '0.00'}</td>
                          <td className="p-1 text-right">{(item.total).toFixed(2)}</td>
                        </tr>
                      ))}
                      {/* Empty padding row to push footer down a bit to match the image style */}
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
                      <div className="w-[15%] text-right">{selectedInvoice?.subtotal?.toFixed(2)}</div>
                    </div>
                    {(selectedInvoice?.discount_amount || 0) > 0 && (
                      <div className="flex border-b border-black p-1">
                        <div className="w-[85%] text-right pr-2">Discount</div>
                        <div className="w-[15%] text-right">-{selectedInvoice?.discount_amount?.toFixed(2)}</div>
                      </div>
                    )}
                    {selectedInvoice?.gst_enabled === 1 && (
                      <div className="flex border-b border-black p-1">
                        <div className="w-[85%] text-right pr-2">GST ({selectedInvoice.gst_rate}%)</div>
                        <div className="w-[15%] text-right">{selectedInvoice.gst_amount?.toFixed(2)}</div>
                      </div>
                    )}
                    <div className="flex p-1">
                      <div className="w-[85%] text-right pr-2 font-bold">Total</div>
                      <div className="w-[15%] text-right font-bold">{selectedInvoice?.total_amount?.toFixed(2)}</div>
                    </div>
                  </div>

                  {/* Amount in Words */}
                  <div className="border-b border-black p-1 font-bold">
                    Total Amount: Rs. {selectedInvoice?.total_amount?.toFixed(2)} Only
                  </div>

                  {/* Payment Summary */}
                  <div className="border-b border-black p-1 font-bold text-[10px]">
                    Settled by - {selectedInvoice?.payment_method} : {(selectedInvoice?.payment_status === 'unpaid' ? 0 : ((selectedInvoice as any)?.amount_paid ?? selectedInvoice?.total_amount ?? 0)).toFixed(2)}
                    {selectedInvoice?.payment_status !== 'paid' && ` | Invoice Balance : ${((selectedInvoice?.total_amount || 0) - (selectedInvoice?.payment_status === 'unpaid' ? 0 : ((selectedInvoice as any)?.amount_paid ?? selectedInvoice?.total_amount ?? 0))).toFixed(2)}`}
                  </div>

                  {/* Footer info blocks: Terms, Signature */}
                  <div className="flex min-h-[120px]">
                    <div className="flex-1 border-r border-black p-2 text-[10px]">
                      <h4 className="font-bold mb-1 text-sm">Terms and Conditions</h4>
                      {selectedInvoice?.notes ? (
                        <p className="whitespace-pre-line">{selectedInvoice.notes}</p>
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
                      <div className="font-bold uppercase break-words">For {selectedInvoice?.store_name || settings.store_name || "Company Name"}</div>
                      <div className="font-bold mt-auto mb-2 text-sm">Signature</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Delete Invoice
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-red-50 text-red-800 p-4 rounded-md text-sm border border-red-200">
              <p className="font-bold mb-1">Warning: This action cannot be undone.</p>
              <p>Deleting this invoice will permanently remove it from the system, automatically reverse the stock deductions, and update the customer's balance back to what it was.</p>
            </div>

            <div className="space-y-2">
              <Label>
                Please type <strong className="select-none">{invoiceToDelete?.invoice_number}</strong> to confirm.
              </Label>
              <Input
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder={invoiceToDelete?.invoice_number}
                className="mt-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleting || deleteConfirmText !== invoiceToDelete?.invoice_number}
            >
              {deleting ? 'Deleting...' : 'Permanently Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
