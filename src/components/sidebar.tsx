/**
 * Sidebar navigation component for Gajraj Kirana Stores
 * MyBillBook-style left sidebar with navigation links and store branding.
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  FileText,
  BarChart3,
  Settings,
  AlertTriangle,
  Store,
} from 'lucide-react';

/* Navigation items matching MyBillBook layout */
const navItems = [
  { href: '/',          label: 'Dashboard',   icon: LayoutDashboard },
  { href: '/billing',   label: 'New Bill',    icon: ShoppingCart },
  { href: '/invoices',  label: 'Invoices',    icon: FileText },
  { href: '/products',  label: 'Products',    icon: Package },
  { href: '/customers', label: 'Customers',   icon: Users },
  { href: '/reports',   label: 'Reports',     icon: BarChart3 },
  { href: '/low-stock', label: 'Low Stock',   icon: AlertTriangle },
  { href: '/settings',  label: 'Settings',    icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r bg-card flex flex-col">
      {/* Store branding header */}
      <div className="flex items-center gap-3 px-6 py-5 border-b">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Store className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-sm font-bold leading-tight">Gajraj Kirana</h1>
          <p className="text-xs text-muted-foreground">Billing Software</p>
        </div>
      </div>

      {/* Navigation links */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t px-6 py-3">
        <p className="text-xs text-muted-foreground text-center">
          v1.0.0 &middot; Single User
        </p>
      </div>
    </aside>
  );
}
