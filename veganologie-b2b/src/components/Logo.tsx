// Text-only Veganologie wordmark in brand forest green.

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center ${className}`}>
      <span className="text-xl font-semibold tracking-[0.24em] text-forest-700">
        VEGANOLOGIE
      </span>
    </div>
  );
}
