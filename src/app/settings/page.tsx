/**
 * Settings Page — Store info, Gmail SMTP config, invoice settings.
 */

'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Settings, Mail, Store, FileText } from 'lucide-react';
import { toast } from 'sonner';

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then((data) => {
      setSettings(data);
      setLoading(false);
    });
  }, []);

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
