/**
 * Settings Page — Store info, Gmail SMTP config, invoice settings.
 */

'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Settings, Mail, Store, FileText, Trash2, Plus, Tag } from 'lucide-react';
import { toast } from 'sonner';

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [categories, setCategories] = useState<{ id: number, name: string }[]>([]);
  const [units, setUnits] = useState<{ id: number, name: string }[]>([]);
  const [newCat, setNewCat] = useState('');
  const [newUnit, setNewUnit] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/settings').then(r => r.json()),
      fetch('/api/categories').then(r => r.json()),
      fetch('/api/units').then(r => r.json())
    ]).then(([settingsData, catData, unitData]) => {
      setSettings(settingsData);
      setCategories(catData);
      setUnits(unitData);
      setLoading(false);
    });
  }, []);

  const addCategory = async () => {
    if (!newCat.trim()) return;
    try {
      const res = await fetch('/api/categories', { method: 'POST', body: JSON.stringify({ name: newCat }) });
      if (res.ok) {
        setCategories([...categories, { id: Date.now(), name: newCat }]);
        setNewCat('');
        fetch('/api/categories').then(r => r.json()).then(setCategories);
      }
    } catch { toast.error('Failed to add category'); }
  };

  const deleteCategory = async (id: number) => {
    if (!confirm('Delete this category?')) return;
    try {
      await fetch(`/api/categories/${id}`, { method: 'DELETE' });
      setCategories(categories.filter(c => c.id !== id));
    } catch { toast.error('Failed to delete category'); }
  };

  const addUnit = async () => {
    if (!newUnit.trim()) return;
    try {
      const res = await fetch('/api/units', { method: 'POST', body: JSON.stringify({ name: newUnit }) });
      if (res.ok) {
        setUnits([...units, { id: Date.now(), name: newUnit }]);
        setNewUnit('');
        fetch('/api/units').then(r => r.json()).then(setUnits);
      }
    } catch { toast.error('Failed to add unit'); }
  };

  const deleteUnit = async (id: number) => {
    if (!confirm('Delete this unit?')) return;
    try {
      await fetch(`/api/units/${id}`, { method: 'DELETE' });
      setUnits(units.filter(u => u.id !== id));
    } catch { toast.error('Failed to delete unit'); }
  };

  const update = (key: string, value: string) => {
    setSettings({ ...settings, [key]: value });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error();
      toast.success('Settings saved successfully');
    } catch { toast.error('Failed to save settings'); }
    finally { setSaving(false); }
  };

  if (loading) {
    return <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Configure your store and notification settings</p>
      </div>

      {/* Store Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Store className="h-5 w-5" /> Store Information</CardTitle>
          <CardDescription>Business details shown on invoices</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div><Label>Store Name</Label><Input value={settings.store_name || ''} onChange={(e) => update('store_name', e.target.value)} /></div>
          <div><Label>Address</Label><Input value={settings.store_address || ''} onChange={(e) => update('store_address', e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Phone</Label><Input value={settings.store_phone || ''} onChange={(e) => update('store_phone', e.target.value)} /></div>
            <div><Label>Email</Label><Input value={settings.store_email || ''} onChange={(e) => update('store_email', e.target.value)} /></div>
          </div>
          <div><Label>GSTIN</Label><Input value={settings.store_gstin || ''} onChange={(e) => update('store_gstin', e.target.value)} placeholder="e.g., 27AAAAA0000A1Z5" /></div>
        </CardContent>
      </Card>

      {/* Invoice Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Invoice Settings</CardTitle>
          <CardDescription>Configure invoice numbering</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Invoice Prefix</Label><Input value={settings.invoice_prefix || ''} onChange={(e) => update('invoice_prefix', e.target.value)} placeholder="e.g., GKS" /></div>
            <div><Label>Next Invoice Number</Label><Input type="number" value={settings.invoice_counter || ''} onChange={(e) => update('invoice_counter', e.target.value)} /></div>
          </div>
          <div>
            <Label>Print Theme Layout</Label>
            <Select value={settings.invoice_theme || 'professional'} onValueChange={(v) => update('invoice_theme', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="professional">Professional (A4)</SelectItem>
                <SelectItem value="thermal">Thermal Receipt (POS 80mm)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Dynamic Item Attributes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Tag className="h-5 w-5" /> Product Categories & Units</CardTitle>
          <CardDescription>Manage the dropdown options available when adding inventory</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Categories */}
            <div>
              <Label className="mb-2 block border-b pb-2 font-semibold">Categories</Label>
              <div className="flex gap-2 mb-3">
                <Input placeholder="New Category" value={newCat} onChange={(e) => setNewCat(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addCategory()} />
                <Button variant="outline" onClick={addCategory}><Plus className="h-4 w-4" /></Button>
              </div>
              <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2">
                {categories.map(c => (
                  <div key={c.id} className="flex justify-between items-center bg-gray-50 border px-3 py-1.5 rounded text-sm">
                    {c.name}
                    <Button size="icon-sm" variant="ghost" onClick={() => deleteCategory(c.id)} className="h-6 w-6"><Trash2 className="h-3 w-3 text-red-500" /></Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Units */}
            <div>
              <Label className="mb-2 block border-b pb-2 font-semibold">Measurement Units</Label>
              <div className="flex gap-2 mb-3">
                <Input placeholder="New Unit (e.g., kg, feet)" value={newUnit} onChange={(e) => setNewUnit(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addUnit()} />
                <Button variant="outline" onClick={addUnit}><Plus className="h-4 w-4" /></Button>
              </div>
              <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2">
                {units.map(u => (
                  <div key={u.id} className="flex justify-between items-center bg-gray-50 border px-3 py-1.5 rounded text-sm">
                    {u.name}
                    <Button size="icon-sm" variant="ghost" onClick={() => deleteUnit(u.id)} className="h-6 w-6"><Trash2 className="h-3 w-3 text-red-500" /></Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Gmail SMTP Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5" /> Gmail Alert Settings</CardTitle>
          <CardDescription>Configure Gmail SMTP for low-stock email alerts. Use an App Password (not your regular Gmail password).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div><Label>Gmail Address</Label><Input type="email" value={settings.gmail_user || ''} onChange={(e) => update('gmail_user', e.target.value)} placeholder="your.email@gmail.com" /></div>
          <div><Label>App Password</Label><Input type="password" value={settings.gmail_app_password || ''} onChange={(e) => update('gmail_app_password', e.target.value)} placeholder="16-char app password" /></div>
          <div><Label>Send Alerts To (optional)</Label><Input type="email" value={settings.low_stock_email || ''} onChange={(e) => update('low_stock_email', e.target.value)} placeholder="Defaults to Gmail address above" /></div>
          <p className="text-xs text-muted-foreground">
            To create an App Password: Google Account &rarr; Security &rarr; 2-Step Verification &rarr; App Passwords
          </p>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving} size="lg">
        <Settings className="mr-2 h-4 w-4" />
        {saving ? 'Saving...' : 'Save All Settings'}
      </Button>
    </div>
  );
}
