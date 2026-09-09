// Veganologie logo — a hand-built recreation of the leaf-in-V mark + wordmark.
// This is the DEFAULT logo baked into the app, so it looks the same on every
// device without uploading anything. Uploading a logo (header "Logo" button)
// overrides it, but only in that browser.
export const MARK_COLOR = "#14442e";

export function LeafVMark({ size = 40, color = MARK_COLOR }: { size?: number; color?: string }) {
  return (
    <svg
      width={(size * 100) / 132}
      height={size}
      viewBox="0 0 100 132"
      fill="none"
      stroke={color}
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {/* V */}
      <path d="M20 16 L47 118" />
      <path d="M47 118 L64 62" />
      {/* leaf */}
      <path d="M60 18 C80 26 84 52 71 71 C64 81 53 84 48 75 C43 66 46 38 60 18 Z" />
      {/* central vein */}
      <path d="M61 27 C55 44 51 61 49 74" strokeWidth="2" />
      {/* side veins */}
      <path d="M57 41 C62 39 67 39 71 42" strokeWidth="1.6" />
      <path d="M54 53 C59 52 64 53 68 56" strokeWidth="1.6" />
      <path d="M51 64 C55 64 60 66 63 69" strokeWidth="1.6" />
      {/* curled base */}
      <path d="M49 74 C45 83 39 84 38 77" strokeWidth="2" />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <LeafVMark size={34} />
      <span className="text-xl font-medium tracking-[0.22em] text-forest-700">VEGANOLOGIE</span>
    </div>
  );
}
