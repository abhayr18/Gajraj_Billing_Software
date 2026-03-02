/**
 * Customers Management Page
 * CRUD + purchase history view per customer.
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Pencil, Trash2, Users, Eye, Banknote } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface Customer {
  id: number; name: string; phone: string; email: string;
  address: string; gstin: string; balance: number; created_at: string;
}

interface Invoice {
  id: number; invoice_number: string; total_amount: number;
  payment_status: string; created_at: string;
}

const emptyCustomer = { name: '', phone: '', email: '', address: '', gstin: '' };

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [paymentCustomer, setPaymentCustomer] = useState<Customer | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number | ''>('');
  const [form, setForm] = useState(emptyCustomer);
  const [history, setHistory] = useState<{ customer: Customer; invoices: Invoice[] } | null>(null);

  const fetchCustomers = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      const res = await fetch(`/api/customers?${params}`);
      setCustomers(await res.json());
    } catch { toast.error('Failed to load customers'); }
    finally { setLoading(false); }
  }, [search]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  const openAdd = () => { setEditingCustomer(null); setForm(emptyCustomer); setDialogOpen(true); };
  const openEdit = (c: Customer) => {
    setEditingCustomer(c);
    setForm({ name: c.name, phone: c.phone, email: c.email, address: c.address, gstin: c.gstin });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name) { toast.error('Name is required'); return; }
    try {
      const url = editingCustomer ? `/api/customers/${editingCustomer.id}` : '/api/customers';
      const method = editingCustomer ? 'PUT' : 'POST';
      await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      toast.success(editingCustomer ? 'Customer updated' : 'Customer added');
      setDialogOpen(false);
      fetchCustomers();
    } catch { toast.error('Failed to save'); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this customer?')) return;
    await fetch(`/api/customers/${id}`, { method: 'DELETE' });
    toast.success('Deleted');
    fetchCustomers();
  };

  const viewHistory = async (c: Customer) => {
    const res = await fetch(`/api/customers/${c.id}?history=1`);
    const data = await res.json();
    setHistory(data);
    setHistoryOpen(true);
  };

  const openPay = (c: Customer) => {
    setPaymentCustomer(c);
    setPaymentAmount(c.balance); // Default to full amount
    setPayOpen(true);
  };

  const handlePayment = async () => {
    if (!paymentAmount || paymentAmount <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    try {
      if (!paymentCustomer) return;
      const res = await fetch(`/api/customers/${paymentCustomer.id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: paymentAmount }),
      });
      if (!res.ok) throw new Error();
      toast.success('Payment settled successfully!');
      setPayOpen(false);
      fetchCustomers();
    } catch {
      toast.error('Failed to process payment');
    }
  };

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Customers</h1>
          <p className="text-muted-foreground">Manage customers and view purchase history</p>
        </div>
        <Button onClick={openAdd}><Plus className="mr-2 h-4 w-4" /> Add Customer</Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by name, phone, or email..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Customers ({customers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
          ) : customers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-lg font-medium">No customers found</p>
              <Button onClick={openAdd} className="mt-4" variant="outline"><Plus className="mr-2 h-4 w-4" /> Add Customer</Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>GSTIN</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>{c.phone || '-'}</TableCell>
                    <TableCell>{c.email || '-'}</TableCell>
                    <TableCell>{c.gstin || '-'}</TableCell>
                    <TableCell className="text-right">
                      {c.balance > 0 ? (
                        <span className="text-red-500 font-medium">{formatCurrency(c.balance)}</span>
                      ) : (
                        <span className="text-green-600">{formatCurrency(0)}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {c.balance > 0 && (
                          <Button size="icon-sm" variant="ghost" className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50" onClick={() => openPay(c)} title="Settle Balance">
                            <Banknote className="h-4 w-4" />
                          </Button>
                        )}
                        <Button size="icon-sm" variant="ghost" onClick={() => viewHistory(c)} title="View History">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button size="icon-sm" variant="ghost" onClick={() => openEdit(c)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon-sm" variant="ghost" onClick={() => handleDelete(c.id)}>
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

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingCustomer ? 'Edit Customer' : 'Add Customer'}</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            </div>
            <div><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
            <div><Label>GSTIN</Label><Input value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editingCustomer ? 'Update' : 'Add Customer'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Purchase History Dialog */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Purchase History - {history?.customer?.name}</DialogTitle>
          </DialogHeader>
          {history?.invoices && history.invoices.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">{inv.invoice_number}</TableCell>
                    <TableCell>{format(new Date(inv.created_at), 'dd MMM yyyy, hh:mm a')}</TableCell>
                    <TableCell className="text-right">{formatCurrency(inv.total_amount)}</TableCell>
                    <TableCell>
                      <Badge variant={inv.payment_status === 'paid' ? 'secondary' : 'destructive'}>
                        {inv.payment_status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-center py-8 text-muted-foreground">No purchase history</p>
          )}
        </DialogContent>
      </Dialog>

      {/* Receive Payment Dialog */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Receive Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-muted p-4 rounded-lg flex justify-between items-center">
              <span className="text-sm font-medium text-muted-foreground">Current Balance</span>
              <span className="text-lg font-bold text-red-500">
                {paymentCustomer ? formatCurrency(paymentCustomer.balance) : formatCurrency(0)}
              </span>
            </div>

            <div className="space-y-2">
              <Label>Amount Received (Rs.)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value ? parseFloat(e.target.value) : '')}
                className="text-lg font-medium"
                placeholder="Enter amount..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)}>Cancel</Button>
            <Button onClick={handlePayment} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              Settle Balance
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
