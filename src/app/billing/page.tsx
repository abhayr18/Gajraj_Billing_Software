/**
 * Billing Page — Create new invoices
 * Features: product search, item list, GST toggle (applied on total), discount,
 * customer selection, payment method, and invoice creation.
 */

'use client';

import { useEffect, useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Search, Plus, Trash2, ShoppingCart, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

interface Product {
  id: number; name: string; sku: string; selling_price: number;
  quantity: number; unit: string; gst_rate: number;
}

interface Customer {
  id: number; name: string; phone: string;
}

interface BillItem {
  product_id: number | null;
  product_name: string;
  quantity: number;
  unit: string;
  price: number;
  discount: number;
  total: number;
  available_stock: number;
}

export default function BillingPage() {
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);

  /* Bill state */
  const [items, setItems] = useState<BillItem[]>([]);
  const [customerId, setCustomerId] = useState<string>('');
  const [customerName, setCustomerName] = useState('Walk-in Customer');
  const [customerPhone, setCustomerPhone] = useState('');
  const [gstEnabled, setGstEnabled] = useState(false);
  const [gstRate, setGstRate] = useState(18);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentStatus, setPaymentStatus] = useState('paid');
  const [amountPaid, setAmountPaid] = useState<number | ''>('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  /* Fetch data */
  useEffect(() => {
    fetch('/api/products').then(r => r.json()).then(setProducts);
    fetch('/api/customers').then(r => r.json()).then(setCustomers);
  }, []);

  /* Filter products on search */
  useEffect(() => {
    if (!searchTerm) { setFilteredProducts(products); return; }
    const filtered = products.filter(
      (p) => p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    setFilteredProducts(filtered);
  }, [searchTerm, products]);

  /* Add item from product selection */
  const addItem = (p: Product) => {
    if (p.quantity < 1) {
      toast.warning(`${p.name} is out of stock in the system (${p.quantity} left)`);
    }

    const existing = items.find(i => i.product_id === p.id);
    if (existing) {
      setItems(items.map(i => {
        if (i.product_id === p.id) {
          const newQty = i.quantity + 1;
          if (newQty > p.quantity) {
            toast.warning(`Quantity exceeds system stock for ${p.name}`);
          }
          return { ...i, quantity: newQty, total: newQty * i.price - i.discount };
        }
        return i;
      }));
    } else {
      setItems([...items, {
        product_id: p.id, product_name: p.name, quantity: 1,
        unit: p.unit, price: p.selling_price, discount: 0,
        total: p.selling_price, available_stock: p.quantity,
      }]);
    }
    setSearchTerm('');
    searchRef.current?.focus();
  };

  /* Add custom item (not from inventory) */
  const addCustomItem = () => {
    setItems([...items, {
      product_id: null, product_name: '', quantity: 1,
      unit: 'pcs', price: 0, discount: 0, total: 0, available_stock: Infinity,
    }]);
  };

  /* Update item */
  const updateItem = (idx: number, field: string, value: string | number) => {
    setItems(items.map((item, i) => {
      if (i !== idx) return item;
      const updated = { ...item, [field]: value };
      updated.total = updated.quantity * updated.price - updated.discount;
      return updated;
    }));
  };

  /* Remove item */
  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));

  /* Calculations */
  const subtotal = items.reduce((sum, i) => sum + i.total, 0);
  const gstAmount = gstEnabled ? (subtotal - discountAmount) * gstRate / 100 : 0;
  const totalAmount = subtotal - discountAmount + gstAmount;

  /* Customer selection */
  const handleCustomerSelect = (val: string) => {
    setCustomerId(val);
    if (val === 'walk-in') {
      setCustomerName('Walk-in Customer');
      setCustomerPhone('');
    } else {
      const c = customers.find(c => String(c.id) === val);
      if (c) { setCustomerName(c.name); setCustomerPhone(c.phone); }
    }
  };

  /* Save invoice */
  const handleSave = async (printAndClear = false) => {
    if (items.length === 0) { toast.error('Add at least one item'); return; }
    if (items.some(i => !i.product_name || i.price <= 0)) {
      toast.error('Fill in all item details');
      return;
    }
    if (paymentStatus === 'partial' && (!amountPaid || amountPaid <= 0)) {
      toast.error('Enter a valid amount paid for partial payment');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: customerId && customerId !== 'walk-in' ? parseInt(customerId) : null,
          customer_name: customerName,
          customer_phone: customerPhone,
          items: items.map(i => ({
            product_id: i.product_id, product_name: i.product_name,
            quantity: i.quantity, unit: i.unit, price: i.price,
            discount: i.discount, total: i.total,
          })),
          subtotal, discount_amount: discountAmount,
          gst_enabled: gstEnabled, gst_amount: gstAmount,
          gst_rate: gstEnabled ? gstRate : 0,
          total_amount: totalAmount,
          amount_paid: paymentStatus === 'paid' ? totalAmount : (paymentStatus === 'unpaid' ? 0 : (amountPaid || 0)),
          payment_method: paymentMethod,
          payment_status: paymentStatus,
          notes,
        }),
      });

      if (!res.ok) throw new Error();
      const data = await res.json();
      toast.success(`Invoice ${data.invoice.invoice_number} created!`);

      if (printAndClear) {
        window.open(`/invoices/print/${data.invoice.id}`, '_blank');

        // Reset the form for the next customer
        setItems([]);
        setCustomerId('');
        handleCustomerSelect('walk-in');
        setPaymentMethod('cash');
        setPaymentStatus('paid');
        setAmountPaid('');
        setDiscountAmount(0);
        setNotes('');
      } else {
        router.push(`/invoices?highlight=${data.invoice.id}`);
      }
    } catch {
      toast.error('Failed to create invoice');
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">New Bill</h1>
        <p className="text-muted-foreground">Create a new invoice for a customer</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Items */}
        <div className="lg:col-span-2 space-y-4">
          {/* Product Selection */}
          <Card>
            <CardHeader className="pb-3 border-b mb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Search className="h-5 w-5" /> Products
                </CardTitle>
                <Button variant="outline" size="sm" onClick={addCustomItem}>
                  <Plus className="mr-1 h-3 w-3" /> Custom Item
                </Button>
              </div>
              <div className="relative mt-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  ref={searchRef}
                  placeholder="Search to filter products or scan barcode..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && filteredProducts.length === 1) {
                      e.preventDefault();
                      addItem(filteredProducts[0]);
                    }
                  }}
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 max-h-[300px] overflow-y-auto pr-2 pb-2">
                {filteredProducts.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => addItem(p)}
                    className="flex flex-col text-left p-3 border rounded-xl hover:bg-muted/50 hover:border-black/40 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-900 shadow-sm"
                  >
                    <span className="font-semibold text-sm truncate w-full text-slate-900" title={p.name}>{p.name}</span>
                    {p.sku && <span className="text-xs text-muted-foreground font-mono mt-0.5 truncate w-full">SKU: {p.sku}</span>}
                    <div className="mt-3 flex items-center justify-between w-full">
                      <span className="font-bold text-sm text-slate-800">{formatCurrency(p.selling_price)}</span>
                      <span className="text-[10px] bg-slate-100 border border-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-medium">
                        {p.quantity} {p.unit}
                      </span>
                    </div>
                  </button>
                ))}
                {filteredProducts.length === 0 && (
                  <div className="col-span-full py-8 text-center text-sm text-muted-foreground">
                    No products found
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Items Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" /> Items ({items.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {items.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">
                  Search and add products above
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[200px]">Product</TableHead>
                      <TableHead className="w-[80px]">Qty</TableHead>
                      <TableHead className="w-[60px]">Unit</TableHead>
                      <TableHead className="w-[100px]">Price</TableHead>
                      <TableHead className="w-[80px]">Disc.</TableHead>
                      <TableHead className="text-right w-[100px]">Total</TableHead>
                      <TableHead className="w-[40px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          {item.product_id ? (
                            <span className="font-medium">{item.product_name}</span>
                          ) : (
                            <Input
                              value={item.product_name}
                              onChange={(e) => updateItem(idx, 'product_name', e.target.value)}
                              placeholder="Item name"
                              className="h-8"
                            />
                          )}
                        </TableCell>
                        <TableCell className="align-top pt-4">
                          <div className="flex flex-col gap-1 items-start">
                            <Input
                              type="number" min="0.1" step="1"
                              value={item.quantity}
                              onChange={(e) => updateItem(idx, 'quantity', parseFloat(e.target.value) || 0)}
                              className={`h-8 w-20 ${item.product_id && item.quantity > item.available_stock ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                            />
                            {item.product_id && item.quantity > item.available_stock ? (
                              <span className="text-[10px] text-destructive leading-tight font-medium">
                                Stock: {item.available_stock}
                              </span>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">{item.unit}</TableCell>
                        <TableCell>
                          {item.product_id ? (
                            <span className="font-medium text-slate-700">{formatCurrency(item.price)}</span>
                          ) : (
                            <Input
                              type="number" min="0"
                              value={item.price}
                              onChange={(e) => updateItem(idx, 'price', parseFloat(e.target.value) || 0)}
                              className="h-8 w-24"
                            />
                          )}
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number" min="0"
                            value={item.discount}
                            onChange={(e) => updateItem(idx, 'discount', parseFloat(e.target.value) || 0)}
                            className="h-8 w-20"
                          />
                        </TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(item.total)}</TableCell>
                        <TableCell>
                          <Button size="icon-sm" variant="ghost" onClick={() => removeItem(idx)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Bill Summary */}
        <div className="space-y-4">
          {/* Customer */}
          <Card>
            <CardHeader><CardTitle className="text-base">Customer</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Select value={customerId || 'walk-in'} onValueChange={handleCustomerSelect}>
                <SelectTrigger><SelectValue placeholder="Walk-in Customer" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="walk-in">Walk-in Customer</SelectItem>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name} {c.phone ? `(${c.phone})` : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {customerId === 'walk-in' || !customerId ? (
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="Name" value={customerName === 'Walk-in Customer' ? '' : customerName}
                    onChange={(e) => setCustomerName(e.target.value || 'Walk-in Customer')} />
                  <Input placeholder="Phone" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
                </div>
              ) : null}
            </CardContent>
          </Card>

          {/* GST Toggle */}
          <Card>
            <CardHeader><CardTitle className="text-base">Tax Settings</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Apply GST on Bill</Label>
                <Switch checked={gstEnabled} onCheckedChange={setGstEnabled} />
              </div>
              {gstEnabled && (
                <div>
                  <Label>GST Rate (%)</Label>
                  <Select value={String(gstRate)} onValueChange={(v) => setGstRate(parseInt(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5%</SelectItem>
                      <SelectItem value="12">12%</SelectItem>
                      <SelectItem value="18">18%</SelectItem>
                      <SelectItem value="28">28%</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment */}
          <Card>
            <CardHeader><CardTitle className="text-base">Payment</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>Method</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="upi">UPI</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="unpaid">Unpaid</SelectItem>
                    <SelectItem value="partial">Partial</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {paymentStatus === 'partial' && (
                <div>
                  <Label>Amount Paid (Rs.)</Label>
                  <Input type="number" min="0" value={amountPaid}
                    onChange={(e) => setAmountPaid(e.target.value ? parseFloat(e.target.value) : '')} />
                </div>
              )}
              <div>
                <Label>Discount (Rs.)</Label>
                <Input type="number" min="0" value={discountAmount}
                  onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)} />
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Optional notes..." />
              </div>
            </CardContent>
          </Card>

          {/* Bill Summary */}
          <Card className="border-primary">
            <CardHeader><CardTitle className="text-base">Bill Summary</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount</span>
                    <span>-{formatCurrency(discountAmount)}</span>
                  </div>
                )}
                {gstEnabled && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">GST ({gstRate}%)</span>
                    <span>{formatCurrency(gstAmount)}</span>
                  </div>
                )}
                <div className="border-t pt-2 flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span>{formatCurrency(totalAmount)}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-4">
                <Button variant="outline" size="lg" onClick={() => handleSave(false)} disabled={saving || items.length === 0}>
                  Save Only
                </Button>
                <Button size="lg" onClick={() => handleSave(true)} disabled={saving || items.length === 0}>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  {saving ? 'Saving...' : 'Save & Print'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
