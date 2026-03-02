/**
 * Products / Inventory Management Page
 * MyBillBook-style table with search, category filter, add/edit/delete modals.
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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Pencil, Trash2, Package } from 'lucide-react';
import { toast } from 'sonner';

interface Product {
  id: number;
  name: string;
  sku: string;
  category: string;
  hsn_code: string;
  purchase_price: number;
  selling_price: number;
  quantity: number;
  unit: string;
  low_stock_alert: number;
  gst_rate: number;
  description: string;
}

interface Category {
  id: number;
  name: string;
}

const emptyProduct = {
  name: '', sku: '', category: '', hsn_code: '',
  purchase_price: 0, selling_price: 0, quantity: 0,
  unit: 'pcs', low_stock_alert: 10, gst_rate: 0, description: '',
};

const units = ['pcs', 'kg', 'g', 'ltr', 'ml', 'box', 'pack', 'dozen', 'bag'];

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [form, setForm] = useState(emptyProduct);

  /* Fetch products */
  const fetchProducts = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (categoryFilter) params.set('category', categoryFilter);
      const res = await fetch(`/api/products?${params}`);
      const data = await res.json();
      setProducts(data);
    } catch { toast.error('Failed to load products'); }
    finally { setLoading(false); }
  }, [search, categoryFilter]);

  /* Fetch categories */
  const fetchCategories = async () => {
    const res = await fetch('/api/categories');
    setCategories(await res.json());
  };

  useEffect(() => { fetchProducts(); }, [fetchProducts]);
  useEffect(() => { fetchCategories(); }, []);

  /* Open dialog for add / edit */
  const openAdd = () => {
    setEditingProduct(null);
    setForm(emptyProduct);
    setDialogOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditingProduct(p);
    setForm({
      name: p.name, sku: p.sku, category: p.category, hsn_code: p.hsn_code,
      purchase_price: p.purchase_price, selling_price: p.selling_price,
      quantity: p.quantity, unit: p.unit, low_stock_alert: p.low_stock_alert,
      gst_rate: p.gst_rate, description: p.description,
    });
    setDialogOpen(true);
  };

  /* Save */
  const handleSave = async () => {
    if (!form.name || !form.selling_price) {
      toast.error('Name and selling price are required');
      return;
    }
    try {
      const url = editingProduct ? `/api/products/${editingProduct.id}` : '/api/products';
      const method = editingProduct ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error();
      toast.success(editingProduct ? 'Product updated' : 'Product added');
      setDialogOpen(false);
      fetchProducts();
    } catch { toast.error('Failed to save product'); }
  };

  /* Delete */
  const handleDelete = async (id: number) => {
    if (!confirm('Delete this product?')) return;
    try {
      await fetch(`/api/products/${id}`, { method: 'DELETE' });
      toast.success('Product deleted');
      fetchProducts();
    } catch { toast.error('Failed to delete'); }
  };

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Products</h1>
          <p className="text-muted-foreground">Manage your inventory and products</p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="mr-2 h-4 w-4" /> Add Product
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products by name or SKU..."
                className="pl-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Products Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Products ({products.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-lg font-medium">No products found</p>
              <p className="text-sm">Add your first product to get started</p>
              <Button onClick={openAdd} className="mt-4" variant="outline">
                <Plus className="mr-2 h-4 w-4" /> Add Product
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Purchase</TableHead>
                  <TableHead className="text-right">Selling</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="text-muted-foreground">{p.sku || '-'}</TableCell>
                    <TableCell>{p.category || '-'}</TableCell>
                    <TableCell className="text-right">{formatCurrency(p.purchase_price)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(p.selling_price)}</TableCell>
                    <TableCell className="text-right">{p.quantity} {p.unit}</TableCell>
                    <TableCell>
                      {p.quantity === 0 ? (
                        <Badge variant="destructive">Out of Stock</Badge>
                      ) : p.quantity <= p.low_stock_alert ? (
                        <Badge className="bg-orange-500 text-white">Low Stock</Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-green-100 text-green-700">In Stock</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon-sm" variant="ghost" onClick={() => openEdit(p)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon-sm" variant="ghost" onClick={() => handleDelete(p.id)}>
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

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProduct ? 'Edit Product' : 'Add Product'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Product Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Enter product name" />
            </div>
            <div>
              <Label>SKU</Label>
              <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="e.g. GKS-001" />
            </div>
            <div>
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>HSN Code</Label>
              <Input value={form.hsn_code} onChange={(e) => setForm({ ...form, hsn_code: e.target.value })} />
            </div>
            <div>
              <Label>GST Rate (%)</Label>
              <Input type="number" value={form.gst_rate} onChange={(e) => setForm({ ...form, gst_rate: parseFloat(e.target.value) || 0 })} />
            </div>
            <div>
              <Label>Purchase Price</Label>
              <Input type="number" value={form.purchase_price} onChange={(e) => setForm({ ...form, purchase_price: parseFloat(e.target.value) || 0 })} />
            </div>
            <div>
              <Label>Selling Price *</Label>
              <Input type="number" value={form.selling_price} onChange={(e) => setForm({ ...form, selling_price: parseFloat(e.target.value) || 0 })} />
            </div>
            <div>
              <Label>Quantity</Label>
              <Input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: parseFloat(e.target.value) || 0 })} />
            </div>
            <div>
              <Label>Unit</Label>
              <Select value={form.unit} onValueChange={(v) => setForm({ ...form, unit: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {units.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Low Stock Alert</Label>
              <Input type="number" value={form.low_stock_alert} onChange={(e) => setForm({ ...form, low_stock_alert: parseFloat(e.target.value) || 0 })} />
            </div>
            <div className="col-span-2">
              <Label>Description</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional description" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editingProduct ? 'Update' : 'Add Product'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
