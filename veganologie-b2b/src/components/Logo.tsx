// A lightweight vector recreation of the Veganologie wordmark + leaf mark,
// in the brand forest green. Used in the app header and the on-screen
// quotation preview. (The PDF draws its own vector version.)

export function LeafMark({ size = 40, color = "#14442e" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" aria-hidden>
      {/* V stroke */}
      <path
        d="M20 12 L44 78 L52 78"
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* leaf */}
      <path
        d="M52 20 C78 18 86 44 70 66 C60 80 44 80 40 66 C36 50 40 26 52 20 Z"
        stroke={color}
        strokeWidth="3.5"
        fill="none"
        strokeLinejoin="round"
      />
      <path
        d="M56 30 C56 46 52 58 46 66"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path d="M56 42 L64 38 M54 52 L62 50" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <LeafMark size={34} />
      <span className="text-xl font-semibold tracking-[0.22em] text-forest-700">
        VEGANOLOGIE
      </span>
    </div>
  );
}
