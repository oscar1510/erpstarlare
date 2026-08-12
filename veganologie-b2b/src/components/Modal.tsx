import type { ReactNode } from "react";

export function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-forest-900/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={`my-8 w-full ${wide ? "max-w-4xl" : "max-w-lg"} card p-0`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-forest-100 px-5 py-3">
          <h3 className="text-sm font-semibold text-forest-800">{title}</h3>
          <button
            onClick={onClose}
            className="rounded p-1 text-forest-400 hover:bg-forest-50 hover:text-forest-700"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
