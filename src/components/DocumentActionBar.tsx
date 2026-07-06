"use client";

export function DocumentActionBar({ wordHref }: { wordHref: string }) {
  return (
    <div className="sticky top-0 z-10 bg-slate-900 text-white flex items-center justify-center gap-3 py-3 print:hidden">
      <button
        onClick={() => window.print()}
        className="px-4 py-2 rounded-md font-medium bg-gradient-to-r from-fuchsia-600 to-pink-500 hover:opacity-90"
      >
        🖨 Save as PDF / Print
      </button>
      <a href={wordHref} className="px-4 py-2 rounded-md font-medium bg-slate-700 hover:bg-slate-600">
        ⬇ Download Word (.doc)
      </a>
    </div>
  );
}
