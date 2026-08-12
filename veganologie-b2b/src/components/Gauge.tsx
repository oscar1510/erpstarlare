import { BANDS, bandFor } from "../lib/calc";
import { pct } from "../lib/format";

// A large speedometer with a needle. The needle maps the REAL order profit
// margin % onto a 0–60% sweep (>60 pins right, <0 pins left).
// POOR (red) → ACCEPTABLE → GOOD → VERY GOOD → EXCELLENT (green).
// The big readout is rendered as HTML below the dial so it stays crisp and
// never overflows the arc.

// The dial spans 30–90% margin — the range where Veganologie orders actually
// sit — so the coloured bands and needle spread across the arc. Below 30% pins
// to the far-left (Poor); above 90% pins right (Excellent).
const MIN = 30;
const MAX = 90;
const START = -110;
const END = 110;

function toAngle(v: number): number {
  const c = Math.max(MIN, Math.min(MAX, v));
  return START + ((c - MIN) / (MAX - MIN)) * (END - START);
}
function polar(cx: number, cy: number, r: number, deg: number) {
  const a = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}
function arc(cx: number, cy: number, r: number, a0: number, a1: number) {
  const p0 = polar(cx, cy, r, a0);
  const p1 = polar(cx, cy, r, a1);
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
  return `M ${p0.x} ${p0.y} A ${r} ${r} 0 ${large} 1 ${p1.x} ${p1.y}`;
}

export function Gauge({ marginPct }: { marginPct: number }) {
  const cx = 210;
  const cy = 200;
  const r = 150;
  const band = bandFor(marginPct);
  const bounds = [MIN, 45, 60, 70, 80, MAX];

  const needle = toAngle(marginPct);
  const tip = polar(cx, cy, r - 26, needle);
  const bl = polar(cx, cy, 13, needle - 90);
  const br = polar(cx, cy, 13, needle + 90);

  return (
    <div className="flex w-full flex-col items-center">
      <svg viewBox="0 0 420 250" className="w-full max-w-[420px]" role="img" aria-label="Profit margin gauge">
        {/* track */}
        <path d={arc(cx, cy, r, START, END)} stroke="#e8eae6" strokeWidth="28" fill="none" strokeLinecap="round" />
        {/* coloured bands */}
        {BANDS.map((b, i) => (
          <path
            key={b.label}
            d={arc(cx, cy, r, toAngle(bounds[i]), toAngle(bounds[i + 1]))}
            stroke={b.color}
            strokeWidth="28"
            fill="none"
          />
        ))}
        {/* tick labels */}
        {bounds.map((v) => {
          const a = toAngle(v);
          const lp = polar(cx, cy, r + 22, a);
          const i0 = polar(cx, cy, r - 15, a);
          const o0 = polar(cx, cy, r + 3, a);
          return (
            <g key={v}>
              <line x1={i0.x} y1={i0.y} x2={o0.x} y2={o0.y} stroke="#fff" strokeWidth="2" />
              <text x={lp.x} y={lp.y} fontSize="12" fill="#6b7c72" textAnchor="middle" dominantBaseline="middle">
                {v}
                {v === MAX ? "+" : ""}
              </text>
            </g>
          );
        })}
        {/* needle */}
        <polygon
          points={`${tip.x},${tip.y} ${bl.x},${bl.y} ${br.x},${br.y}`}
          fill={band.color}
          style={{ transition: "all 0.5s cubic-bezier(0.34,1.4,0.64,1)" }}
        />
        <circle cx={cx} cy={cy} r="17" fill="#14442e" />
        <circle cx={cx} cy={cy} r="7" fill="#fff" />
      </svg>

      {/* crisp HTML readout */}
      <div className="-mt-4 flex flex-col items-center">
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-forest-400">
          Profitability
        </div>
        <div className="text-5xl font-extrabold tabular-nums leading-none" style={{ color: band.color }}>
          {pct(marginPct)}
        </div>
        <div
          className="mt-2 rounded-full px-4 py-1 text-xs font-bold uppercase tracking-widest text-white"
          style={{ background: band.color }}
        >
          {band.label}
        </div>
      </div>
    </div>
  );
}
