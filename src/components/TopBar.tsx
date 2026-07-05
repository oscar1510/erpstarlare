"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";

export function TopBar() {
  const router = useRouter();
  const [q, setQ] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`);
  }

  return (
    <header className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-2.5 flex items-center gap-3 print:hidden">
      <Link href="/" className="lg:hidden font-bold text-brand-700">⭐</Link>
      <form onSubmit={submit} className="flex-1 max-w-xl">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          type="search"
          placeholder="Search invoices, clients, documents, deadlines…"
          className="form-input"
        />
      </form>
      <Link href="/expenses/scan" className="btn-primary whitespace-nowrap">
        🧾 Scan expense
      </Link>
    </header>
  );
}
