"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

/**
 * Shows a dismissable success banner when a page is loaded with a ?saved=...
 * query param (set by server actions after they redirect). Gives an explicit
 * "it worked" confirmation once the action completes.
 */
export function FlashToast() {
  const params = useSearchParams();
  const saved = params.get("saved");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (saved) {
      setVisible(true);
      const t = setTimeout(() => setVisible(false), 4000);
      // Clean the URL so a refresh doesn't re-show it.
      const url = new URL(window.location.href);
      url.searchParams.delete("saved");
      window.history.replaceState({}, "", url.toString());
      return () => clearTimeout(t);
    }
  }, [saved]);

  if (!visible || !saved) return null;

  return (
    <div className="fixed top-4 right-4 z-50 print:hidden">
      <div className="flex items-center gap-2 bg-green-600 text-white px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium">
        <span>✓</span>
        <span>{saved}</span>
        <button onClick={() => setVisible(false)} className="ml-2 opacity-80 hover:opacity-100" aria-label="Dismiss">✕</button>
      </div>
    </div>
  );
}
