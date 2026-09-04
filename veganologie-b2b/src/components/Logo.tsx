// Veganologie logo. The leaf-in-V mark below is a hand-built recreation of the
// brand mark (the original artwork was only available as a chat image, not an
// embeddable file). To use the exact logo, drop its SVG/PNG in and swap this.
export const MARK_COLOR = "#14442e";

export function LeafVMark({ size = 40, color = MARK_COLOR }: { size?: number; color?: string }) {
  return (
    <svg
      width={(size * 96) / 128}
      height={size}
      viewBox="0 0 96 128"
      fill="none"
      stroke={color}
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {/* V */}
      <path d="M22 20 L47 108" />
      <path d="M47 108 L64 54" />
      {/* leaf */}
      <path d="M60 24 C82 30 84 58 68 74 C60 82 47 82 44 71 C41 58 46 34 60 24 Z" />
      {/* central vein */}
      <path d="M62 33 C56 48 52 62 49 73" strokeWidth="1.7" />
      {/* side veins */}
      <path d="M58 45 C63 43 67 42 71 44" strokeWidth="1.4" />
      <path d="M55 55 C60 54 65 54 69 56" strokeWidth="1.4" />
      <path d="M52 64 C56 64 60 65 64 67" strokeWidth="1.4" />
      {/* curled tip */}
      <path d="M49 73 C47 81 42 83 40 77" strokeWidth="1.7" />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <LeafVMark size={30} />
      <span className="text-xl font-medium tracking-[0.22em] text-forest-700">VEGANOLOGIE</span>
    </div>
  );
}
