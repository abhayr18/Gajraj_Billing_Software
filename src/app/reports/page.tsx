/**
 * Reports Page — Sales analytics with date filters
 * Summary, daily breakdown, top products, top customers.
 */

'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart3, IndianRupee, FileText, TrendingUp, Download } from 'lucide-react';
import { toast } from 'sonner';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { format, subDays } from 'date-fns';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Summary {
  totalSales: number; totalInvoices: number; totalGst: number;
  totalDiscount: number; avgBill: number;
  paymentMethods: { payment_method: string; cnt: number; total: number }[];
}

export default function ReportsPage() {
  const [from, setFrom] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [to, setTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [summary, setSummary] = useState<Summary | null>(null);
  const [daily, setDaily] = useState<{ date: string; total_sales: number; invoice_count: number }[]>([]);
  const [productReport, setProductReport] = useState<{ product_name: string; total_qty: number; total_revenue: number }[]>([]);
  const [customerReport, setCustomerReport] = useState<{ customer_name: string; invoice_count: number; total_spent: number }[]>([]);
  const [invoiceList, setInvoiceList] = useState<{ InvoiceNo: string; Date: string; Customer: string; Amount: number; GST: number; Status: string; BalanceDue: number }[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const params = `from=${from}&to=${to}`;
      const [summRes, dailyRes, prodRes, custRes, invListRes] = await Promise.all([
        fetch(`/api/reports?${params}&type=summary`),
        fetch(`/api/reports?${params}&type=daily`),
        fetch(`/api/reports?${params}&type=products`),
        fetch(`/api/reports?${params}&type=customers`),
        fetch(`/api/reports?${params}&type=invoicelist`),
      ]);
      setSummary(await summRes.json());
      setDaily(await dailyRes.json());
      setProductReport(await prodRes.json());
      setCustomerReport(await custRes.json());
      setInvoiceList(await invListRes.json());
    } catch { toast.error('Failed to load reports'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchReports(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

  const exportExcel = () => {
    try {
      const wb = XLSX.utils.book_new();

      // Header Data
      const headerData = [
        ['Report Title', `Business Report (${format(new Date(from), 'dd MMM yyyy')} to ${format(new Date(to), 'dd MMM yyyy')})`],
        ['Generated Date', format(new Date(), 'dd MMM yyyy, hh:mm a')],
        []
      ];

      // Calculate missing Summary fields
      const totalOutstanding = invoiceList.reduce((acc, curr) => acc + (curr.BalanceDue || 0), 0);
      const totalProfit = (summary?.totalSales ?? 0) - (summary?.totalGst ?? 0); // Simplified mock profit

      // Summary Sheet Content
      const summaryData = [
        ...headerData,
        ['Metric', 'Value'],
        ['Total Invoices Generated', summary?.totalInvoices ?? 0],
        ['Total Sales Amount', summary?.totalSales ?? 0],
        ['Total GST Collected', summary?.totalGst ?? 0],
        ['Total Profit (Est.)', totalProfit],
        ['Total Outstanding Payments', totalOutstanding]
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryData), 'Summary');

      // Detailed Invoices List Sheet
      const formattedInvoiceList = invoiceList.map(inv => ({
        'Invoice No': inv.InvoiceNo,
        'Date': format(new Date(inv.Date), 'dd MMM yyyy'),
        'Customer': inv.Customer,
        'Amount': inv.Amount,
        'GST': inv.GST,
        'Status': inv.Status.toUpperCase()
      }));
      if (formattedInvoiceList.length > 0) {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(formattedInvoiceList), 'Detailed List');
      }

      // Daily Sales Sheet
      const dailyData = daily.map(d => ({
        Date: format(new Date(d.date), 'dd MMM yyyy'),
        Invoices: d.invoice_count,
        Sales: d.total_sales
      }));
      if (dailyData.length > 0) {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dailyData), 'Daily Sales');
      }

      // Products Sheet
      const productsData = productReport.map((p, i) => ({
        '#': i + 1,
        Product: p.product_name,
        'Qty Sold': p.total_qty,
        Revenue: p.total_revenue
      }));
      if (productsData.length > 0) {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(productsData), 'Top Products');
      }

      // Customers Sheet
      const customersData = customerReport.map((c, i) => ({
        '#': i + 1,
        Customer: c.customer_name,
        Invoices: c.invoice_count,
        'Total Spent': c.total_spent
      }));
      if (customersData.length > 0) {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(customersData), 'Top Customers');
      }

      // Payment Methods Sheet
      if (summary?.paymentMethods && summary.paymentMethods.length > 0) {
        const paymentData = summary.paymentMethods.map(pm => ({
          Method: pm.payment_method.toUpperCase(),
          Count: pm.cnt,
          Total: pm.total
        }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(paymentData), 'Payment Methods');
      }

      XLSX.writeFile(wb, `Business_Report_${from}_to_${to}.xlsx`);
      toast.success('Excel report downloaded');
    } catch {
      toast.error('Failed to export Excel report');
    }
  };

  const exportPDF = () => {
    try {
      const doc = new jsPDF();

      // Document Header
      doc.setFontSize(18);
      doc.text('Business Analytics Report', 14, 22);
      doc.setFontSize(11);
      doc.text(`Period: ${format(new Date(from), 'dd MMM yyyy')} to ${format(new Date(to), 'dd MMM yyyy')}`, 14, 30);
      doc.text(`Generated: ${format(new Date(), 'dd MMM yyyy, hh:mm a')}`, 14, 36);

      // Summary Table
      if (summary) {
        const totalOutstanding = invoiceList.reduce((acc, curr) => acc + (curr.BalanceDue || 0), 0);
        const totalProfit = summary.totalSales - summary.totalGst;

        doc.setFontSize(14);
        doc.text('Summary Overview', 14, 48);
        autoTable(doc, {
          startY: 52,
          head: [['Metric', 'Amount']],
          body: [
            ['Total Invoices Generated', summary.totalInvoices.toString()],
            ['Total Sales Amount', formatCurrency(summary.totalSales)],
            ['Total GST Collected', formatCurrency(summary.totalGst)],
            ['Total Profit (Est.)', formatCurrency(totalProfit)],
            ['Total Outstanding Payments', formatCurrency(totalOutstanding)]
          ],
          margin: { left: 14 }
        });
      }

      // Detailed List Table
      if (invoiceList.length > 0) {
        const currentY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 15 : 48;
        doc.setFontSize(14);
        doc.text('Detailed Invoice List', 14, currentY);
        autoTable(doc, {
          startY: currentY + 5,
          head: [['Invoice No', 'Date', 'Customer', 'Amount', 'GST', 'Status']],
          body: invoiceList.map(inv => [
            inv.InvoiceNo,
            format(new Date(inv.Date), 'dd MMM yyyy'),
            inv.Customer,
            formatCurrency(inv.Amount),
            formatCurrency(inv.GST),
            inv.Status.toUpperCase()
          ]),
          margin: { left: 14 }
        });
      }

      // Daily Sales Table
      if (daily.length > 0) {
        const currentY = (doc as any).lastAutoTable.finalY + 15;
        doc.setFontSize(14);
        doc.text('Daily Sales Breakdown', 14, currentY);
        autoTable(doc, {
          startY: currentY + 5,
          head: [['Date', 'Invoices', 'Sales']],
          body: daily.map(d => [format(new Date(d.date), 'dd MMM yyyy'), d.invoice_count, formatCurrency(d.total_sales)]),
          margin: { left: 14 }
        });
      }

      // Top Products Table
      if (productReport.length > 0) {
        doc.addPage();
        doc.setFontSize(14);
        doc.text('Top Selling Products', 14, 22);
        autoTable(doc, {
          startY: 28,
          head: [['#', 'Product', 'Qty Sold', 'Revenue']],
          body: productReport.map((p, i) => [i + 1, p.product_name, p.total_qty, formatCurrency(p.total_revenue)]),
          margin: { left: 14 }
        });
      }

      // Top Customers Table
      if (customerReport.length > 0) {
        const currentY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 15 : 28;
        doc.setFontSize(14);
        doc.text('Top Customers', 14, currentY);
        autoTable(doc, {
          startY: currentY + 5,
          head: [['#', 'Customer', 'Invoices', 'Total Spent']],
          body: customerReport.map((c, i) => [i + 1, c.customer_name, c.invoice_count, formatCurrency(c.total_spent)]),
          margin: { left: 14 }
        });
      }

      // Payment Methods Table
      if (summary?.paymentMethods && summary.paymentMethods.length > 0) {
        const currentY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 15 : 28;
        doc.setFontSize(14);
        doc.text('Payment Methods', 14, currentY);
        autoTable(doc, {
          startY: currentY + 5,
          head: [['Method', 'Count', 'Total']],
          body: summary.paymentMethods.map((pm) => [pm.payment_method.toUpperCase(), pm.cnt, formatCurrency(pm.total)]),
          margin: { left: 14 }
        });
      }

      doc.save(`Business_Report_${from}_to_${to}.pdf`);
      toast.success('PDF report downloaded');
    } catch {
      toast.error('Failed to export PDF report');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground">Sales analytics and business insights</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportExcel} disabled={!summary}>
            <Download className="mr-2 h-4 w-4" /> Download Excel
          </Button>
          <Button variant="outline" size="sm" onClick={exportPDF} disabled={!summary}>
            <Download className="mr-2 h-4 w-4" /> Download PDF
          </Button>
        </div>
      </div>

      {/* Date Range Filter */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-end gap-4 flex-wrap">
            <div><Label>From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
            <div><Label>To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
            <Button onClick={fetchReports} disabled={loading}>
              {loading ? 'Loading...' : 'Generate Report'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {summary && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
              <IndianRupee className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{formatCurrency(summary.totalSales)}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Invoices</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{summary.totalInvoices}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">GST Collected</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{formatCurrency(summary.totalGst)}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Bill Value</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{formatCurrency(summary.avgBill)}</div></CardContent>
          </Card>
        </div>
      )}

      {/* Tabs for detailed reports */}
      <Tabs defaultValue="daily">
        <TabsList>
          <TabsTrigger value="daily">Daily Sales</TabsTrigger>
          <TabsTrigger value="products">Top Products</TabsTrigger>
          <TabsTrigger value="customers">Top Customers</TabsTrigger>
          <TabsTrigger value="payment">Payment Methods</TabsTrigger>
        </TabsList>

        <TabsContent value="daily" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Daily Sales Breakdown</CardTitle></CardHeader>
            <CardContent>
              {daily.length > 0 ? (
                <>
                  <div className="h-[300px] mb-6">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={daily}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" tickFormatter={(v) => format(new Date(v), 'dd MMM')} />
                        <YAxis tickFormatter={(v) => `₹${v}`} />
                        <Tooltip formatter={(v: number) => [formatCurrency(v), 'Sales']} labelFormatter={(l) => format(new Date(l), 'dd MMM yyyy')} />
                        <Bar dataKey="total_sales" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Invoices</TableHead>
                        <TableHead className="text-right">Sales</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {daily.map((d) => (
                        <TableRow key={d.date}>
                          <TableCell>{format(new Date(d.date), 'dd MMM yyyy')}</TableCell>
                          <TableCell className="text-right">{d.invoice_count}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(d.total_sales)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </>
              ) : <p className="text-center py-8 text-muted-foreground">No data for selected period</p>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="products" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Top Selling Products</CardTitle></CardHeader>
            <CardContent>
              {productReport.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Qty Sold</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {productReport.map((p, i) => (
                      <TableRow key={p.product_name}>
                        <TableCell>{i + 1}</TableCell>
                        <TableCell className="font-medium">{p.product_name}</TableCell>
                        <TableCell className="text-right">{p.total_qty}</TableCell>
                        <TableCell className="text-right">{formatCurrency(p.total_revenue)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : <p className="text-center py-8 text-muted-foreground">No product data</p>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="customers" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Top Customers</CardTitle></CardHeader>
            <CardContent>
              {customerReport.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead className="text-right">Invoices</TableHead>
                      <TableHead className="text-right">Total Spent</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customerReport.map((c, i) => (
                      <TableRow key={c.customer_name}>
                        <TableCell>{i + 1}</TableCell>
                        <TableCell className="font-medium">{c.customer_name}</TableCell>
                        <TableCell className="text-right">{c.invoice_count}</TableCell>
                        <TableCell className="text-right">{formatCurrency(c.total_spent)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : <p className="text-center py-8 text-muted-foreground">No customer data</p>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payment" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Payment Methods</CardTitle></CardHeader>
            <CardContent>
              {summary?.paymentMethods && summary.paymentMethods.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Method</TableHead>
                      <TableHead className="text-right">Count</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary.paymentMethods.map((pm) => (
                      <TableRow key={pm.payment_method}>
                        <TableCell className="font-medium capitalize">{pm.payment_method}</TableCell>
                        <TableCell className="text-right">{pm.cnt}</TableCell>
                        <TableCell className="text-right">{formatCurrency(pm.total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : <p className="text-center py-8 text-muted-foreground">No payment data</p>}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
