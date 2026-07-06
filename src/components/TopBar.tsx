"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { MobileNav } from "./MobileNav";

export function TopBar() {
  const router = useRouter();
  const [q, setQ] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`);
  }

  return (
    <header className="sticky top-0 z-20 bg-white border-b border-slate-200 px-3 sm:px-4 py-2.5 flex items-center gap-2 sm:gap-3 print:hidden">
      <MobileNav />
      <form onSubmit={submit} className="flex-1 min-w-0 max-w-xl">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          type="search"
          placeholder="Search…"
          className="form-input"
        />
      </form>
      <Link href="/expenses/scan" className="btn-primary whitespace-nowrap px-2.5 sm:px-3">
        🧾 <span className="hidden sm:inline">Scan expense</span>
      </Link>
    </header>
  );
}
