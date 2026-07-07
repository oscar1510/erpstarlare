"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export const NAV = [
  { href: "/", label: "KPI Dashboard", icon: "📊" },
  { href: "/expenses/scan", label: "Quick Expense Scanner", icon: "🧾", highlight: true },
  { href: "/billing", label: "Billing / Invoices", icon: "💳" },
  { href: "/clients", label: "Clients / Purchases", icon: "🤝" },
  { href: "/payments", label: "Payments & Reconciliation", icon: "🔁" },
  { href: "/received-invoices", label: "Received Invoices", icon: "📥" },
  { href: "/bank", label: "Bank", icon: "🏦" },
  { href: "/ledger", label: "General Ledger", icon: "📒" },
  { href: "/hr", label: "HR / People", icon: "👥" },
  { href: "/admin-tax", label: "Administration & Tax", icon: "🏛️" },
  { href: "/rent", label: "Rent / Office / Lease", icon: "🏢" },
  { href: "/contracts", label: "Contracts", icon: "📑" },
  { href: "/deadlines", label: "Deadline Calendar", icon: "⏰" },
  { href: "/documents", label: "Document Archive", icon: "🗂️" },
  { href: "/audit-log", label: "Audit Log", icon: "📜" },
  { href: "/reports", label: "Reports & Export", icon: "📈" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="w-64 shrink-0 bg-white border-r border-slate-200 h-screen sticky top-0 overflow-y-auto hidden lg:flex flex-col print:!hidden">
      <div className="px-4 py-4 border-b border-slate-100">
        <span className="text-lg font-bold text-brand-700">⭐ Starflare ERP</span>
      </div>
      <nav className="flex-1 py-2">
        {NAV.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 px-4 py-2 text-sm mx-2 rounded-md mb-0.5 ${
                active
                  ? "bg-brand-50 text-brand-700 font-semibold"
                  : item.highlight
                  ? "text-brand-700 font-medium hover:bg-slate-50"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
