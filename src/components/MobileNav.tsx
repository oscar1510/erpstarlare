"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { NAV } from "./Sidebar";

/**
 * Hamburger + slide-in drawer for phones/tablets, where the desktop sidebar is
 * hidden. Without this there was no way to navigate the app on mobile. Closes
 * on navigation and on backdrop tap.
 */
export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close the drawer whenever the route changes.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Prevent background scroll while the drawer is open.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        aria-label="Open menu"
        onClick={() => setOpen(true)}
        className="p-2 -ml-1 rounded-md text-slate-600 hover:bg-slate-100"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="relative w-72 max-w-[80%] bg-white h-full overflow-y-auto shadow-xl flex flex-col">
            <div className="px-4 py-4 border-b border-slate-100 flex items-center justify-between">
              <span className="text-lg font-bold text-brand-700">⭐ Starflare ERP</span>
              <button type="button" aria-label="Close menu" onClick={() => setOpen(false)} className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="6" y1="6" x2="18" y2="18" />
                  <line x1="18" y1="6" x2="6" y2="18" />
                </svg>
              </button>
            </div>
            <nav className="flex-1 py-2">
              {NAV.map((item) => {
                const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 text-[15px] ${
                      active ? "bg-brand-50 text-brand-700 font-semibold" : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <span>{item.icon}</span>
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </aside>
        </div>
      )}
    </div>
  );
}
