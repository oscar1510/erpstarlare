import Link from "next/link";

export function ContractTabs({ active }: { active: "received" | "sent" | "policies" }) {
  const tabs = [
    { key: "received", label: "Received Contracts", href: "/contracts/received" },
    { key: "sent", label: "Sent Contracts", href: "/contracts/sent" },
    { key: "policies", label: "Platform Policies", href: "/contracts/policies" },
  ] as const;
  return (
    <div className="flex gap-2 mb-6 border-b border-slate-200">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${
            active === t.key ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
