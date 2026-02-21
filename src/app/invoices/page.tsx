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
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Search, FileText, Trash2, Eye, Download, Image } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface Invoice {
  id: number; invoice_number: string; customer_name: string;
  customer_phone: string; subtotal: number; discount_amount: number;
  gst_enabled: number; gst_amount: number; gst_rate: number;
  total_amount: number; payment_method: string; payment_status: string;
  notes: string; created_at: string;
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

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  const viewInvoice = async (inv: Invoice) => {
    const res = await fetch(`/api/invoices/${inv.id}`);
    const data = await res.json();
    setSelectedInvoice(data.invoice);
    setSelectedItems(data.items);
    setDetailOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this invoice?')) return;
    await fetch(`/api/invoices/${id}`, { method: 'DELETE' });
    toast.success('Invoice deleted');
    fetchInvoices();
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
                        <Button size="icon-sm" variant="ghost" onClick={() => viewInvoice(inv)} title="View">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button size="icon-sm" variant="ghost" onClick={() => handleDelete(inv.id)} title="Delete">
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
          <div ref={billRef} className="bg-white p-6 border border-gray-300 mt-4 text-black" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
            {/* Header: Company Info & Invoice ID */}
            <div className="flex justify-between items-start border-b-2 border-black pb-4 mb-4">
              <div>
                <h2 className="text-xl font-bold uppercase">Gajraj Kirana Stores</h2>
                <p className="text-sm">Tax Invoice</p>
              </div>
              <div className="text-right">
                <h1 className="text-2xl font-bold mb-1 uppercase tracking-wider">Invoice</h1>
                <p className="text-lg font-bold">#{selectedInvoice?.invoice_number}</p>
                <p className="text-sm mt-1">Date: {selectedInvoice && format(new Date(selectedInvoice.created_at), 'dd/MM/yyyy, hh:mm a')}</p>
              </div>
            </div>

            {/* Customer Info */}
            <div className="mb-6 flex justify-between">
              <div className="w-1/2">
                <h3 className="text-xs font-bold bg-gray-200 px-2 py-1 uppercase border border-gray-400">Billed To</h3>
                <div className="p-2 border border-t-0 border-gray-400 min-h-[60px] text-sm">
                  <p className="font-bold">{selectedInvoice?.customer_name}</p>
                  {selectedInvoice?.customer_phone && <p>Phone: {selectedInvoice.customer_phone}</p>}
                </div>
              </div>
              <div className="w-1/3 text-sm">
                <h3 className="text-xs font-bold bg-gray-200 px-2 py-1 uppercase border border-gray-400">Payment Details</h3>
                <div className="p-2 border border-t-0 border-gray-400 min-h-[60px]">
                  <p><span className="font-bold">Method:</span> <span className="uppercase">{selectedInvoice?.payment_method}</span></p>
                  <p><span className="font-bold">Status:</span> <span className="uppercase">{selectedInvoice?.payment_status}</span></p>
                </div>
              </div>
            </div>

            {/* Items Table */}
            <table className="w-full text-sm mb-6 border-collapse border border-gray-400">
              <thead className="bg-gray-200">
                <tr>
                  <th className="border border-gray-400 py-1 px-2 text-left w-10">#</th>
                  <th className="border border-gray-400 py-1 px-2 text-left">Item Description</th>
                  <th className="border border-gray-400 py-1 px-2 text-right">Qty</th>
                  <th className="border border-gray-400 py-1 px-2 text-right">Rate</th>
                  <th className="border border-gray-400 py-1 px-2 text-right">Discount</th>
                  <th className="border border-gray-400 py-1 px-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {selectedItems.map((item, idx) => (
                  <tr key={item.id}>
                    <td className="border border-gray-400 py-1 px-2 text-left">{idx + 1}</td>
                    <td className="border border-gray-400 py-1 px-2 text-left font-medium">{item.product_name}</td>
                    <td className="border border-gray-400 py-1 px-2 text-right">{item.quantity} {item.unit}</td>
                    <td className="border border-gray-400 py-1 px-2 text-right">{formatCurrency(item.price)}</td>
                    <td className="border border-gray-400 py-1 px-2 text-right">{item.discount > 0 ? formatCurrency(item.discount) : '-'}</td>
                    <td className="border border-gray-400 py-1 px-2 text-right font-bold">{formatCurrency(item.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals & Notes Section */}
            <div className="flex justify-between items-start">
              <div className="w-1/2 pr-6">
                {selectedInvoice?.notes ? (
                  <div>
                    <p className="font-bold text-xs mb-1">Notes / Terms:</p>
                    <p className="text-xs border border-gray-400 p-2 min-h-[50px]">{selectedInvoice.notes}</p>
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 mt-4">Thank you for shopping with us.</p>
                )}
              </div>

              <div className="w-72">
                <table className="w-full text-sm border-collapse border border-gray-400">
                  <tbody>
                    <tr>
                      <td className="border border-gray-400 py-1 px-2 text-right w-1/2">Subtotal</td>
                      <td className="border border-gray-400 py-1 px-2 text-right">{formatCurrency(selectedInvoice?.subtotal || 0)}</td>
                    </tr>
                    {(selectedInvoice?.discount_amount || 0) > 0 && (
                      <tr>
                        <td className="border border-gray-400 py-1 px-2 text-right w-1/2">Discount</td>
                        <td className="border border-gray-400 py-1 px-2 text-right text-red-700">-{formatCurrency(selectedInvoice?.discount_amount || 0)}</td>
                      </tr>
                    )}
                    {selectedInvoice?.gst_enabled ? (
                      <tr>
                        <td className="border border-gray-400 py-1 px-2 text-right w-1/2">GST ({selectedInvoice.gst_rate}%)</td>
                        <td className="border border-gray-400 py-1 px-2 text-right">{formatCurrency(selectedInvoice.gst_amount)}</td>
                      </tr>
                    ) : null}
                    <tr className="bg-gray-200 font-bold">
                      <td className="border border-gray-400 py-1 px-2 text-right">Grand Total</td>
                      <td className="border border-gray-400 py-1 px-2 text-right">{formatCurrency(selectedInvoice?.total_amount || 0)}</td>
                    </tr>
                    {/* Partial Payments Section */}
                    {/* Note: since amount_paid was recently added, we'll cast the type as any here to avoid TS error on old interface */}
                    {(selectedInvoice as any)?.amount_paid !== null && (selectedInvoice as any)?.amount_paid !== undefined && (selectedInvoice as any)?.amount_paid > 0 && selectedInvoice?.payment_status === 'partial' && (
                      <>
                        <tr>
                          <td className="border border-gray-400 py-1 px-2 text-right">Amount Paid</td>
                          <td className="border border-gray-400 py-1 px-2 text-right">{formatCurrency((selectedInvoice as any).amount_paid)}</td>
                        </tr>
                        <tr className="font-bold">
                          <td className="border border-gray-400 py-1 px-2 text-right">Balance Due</td>
                          <td className="border border-gray-400 py-1 px-2 text-right text-red-700">{formatCurrency((selectedInvoice?.total_amount || 0) - (selectedInvoice as any).amount_paid)}</td>
                        </tr>
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-8 text-center text-xs font-bold border-t border-gray-400 pt-3">
              <p>Goods once sold cannot be returned or exchanged without the original bill.</p>
              <p className="mt-0.5">This is a system generated invoice.</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
