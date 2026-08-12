import { BANDS, bandFor } from "../lib/calc";
import { pct } from "../lib/format";

// A large speedometer-style gauge with a needle. The needle position maps the
// REAL order profit margin % onto a 0–60% sweep (>60 pins to the right).
// POOR (red) → ACCEPTABLE → GOOD → VERY GOOD → EXCELLENT (green).

const MIN = 0;
const MAX = 60; // margins above 60% pin to the far right / "EXCELLENT"
const START_ANGLE = -110; // degrees (left)
const END_ANGLE = 110; // degrees (right)

function valueToAngle(v: number): number {
  const clamped = Math.max(MIN, Math.min(MAX, v));
  const t = (clamped - MIN) / (MAX - MIN);
  return START_ANGLE + t * (END_ANGLE - START_ANGLE);
}

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function arcPath(cx: number, cy: number, r: number, a0: number, a1: number) {
  const p0 = polar(cx, cy, r, a0);
  const p1 = polar(cx, cy, r, a1);
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
  return `M ${p0.x} ${p0.y} A ${r} ${r} 0 ${large} 1 ${p1.x} ${p1.y}`;
}

export function Gauge({ marginPct }: { marginPct: number }) {
  const cx = 200;
  const cy = 190;
  const r = 150;
  const band = bandFor(marginPct);

  // Coloured band segments. Each band spans from its own lower bound to the
  // next band's lower bound (clamped to the gauge range).
  const bounds = [0, 20, 30, 40, 50, MAX];
  const segments = BANDS.map((b, i) => ({
    color: b.color,
    a0: valueToAngle(bounds[i]),
    a1: valueToAngle(bounds[i + 1]),
  }));

  const needleAngle = valueToAngle(marginPct);
  const needleTip = polar(cx, cy, r - 24, needleAngle);
  const needleBackL = polar(cx, cy, 12, needleAngle - 90);
  const needleBackR = polar(cx, cy, 12, needleAngle + 90);

  const ticks = bounds.map((v) => {
    const a = valueToAngle(v);
    const outer = polar(cx, cy, r + 4, a);
    const inner = polar(cx, cy, r - 14, a);
    const labelPos = polar(cx, cy, r + 20, a);
    return { v, outer, inner, labelPos };
  });

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 400 250" className="w-full max-w-[440px]">
        {/* background track */}
        <path
          d={arcPath(cx, cy, r, START_ANGLE, END_ANGLE)}
          stroke="#e8eae6"
          strokeWidth="26"
          fill="none"
          strokeLinecap="round"
        />
        {/* coloured bands */}
        {segments.map((s, i) => (
          <path
            key={i}
            d={arcPath(cx, cy, r, s.a0, s.a1)}
            stroke={s.color}
            strokeWidth="26"
            fill="none"
          />
        ))}
        {/* ticks + labels */}
        {ticks.map((t) => (
          <g key={t.v}>
            <line
              x1={t.inner.x}
              y1={t.inner.y}
              x2={t.outer.x}
              y2={t.outer.y}
              stroke="#ffffff"
              strokeWidth="2"
            />
            <text
              x={t.labelPos.x}
              y={t.labelPos.y}
              fontSize="11"
              fill="#6b7c72"
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {t.v}
              {t.v === MAX ? "+" : ""}
            </text>
          </g>
        ))}
        {/* needle */}
        <polygon
          points={`${needleTip.x},${needleTip.y} ${needleBackL.x},${needleBackL.y} ${needleBackR.x},${needleBackR.y}`}
          fill={band.color}
          style={{ transition: "all 0.5s cubic-bezier(0.34,1.56,0.64,1)" }}
        />
        <circle cx={cx} cy={cy} r="16" fill="#14442e" />
        <circle cx={cx} cy={cy} r="7" fill="#ffffff" />

        {/* center readout */}
        <text x={cx} y={cy - 62} fontSize="13" fill="#6b7c72" textAnchor="middle" letterSpacing="2">
          PROFITABILITY
        </text>
        <text x={cx} y={cy - 20} fontSize="46" fontWeight="700" fill="#14442e" textAnchor="middle">
          {pct(marginPct)}
        </text>
      </svg>
      <div
        className="mt-1 rounded-full px-5 py-1.5 text-sm font-bold uppercase tracking-widest text-white"
        style={{ background: band.color }}
      >
        {band.label}
      </div>
    </div>
  );
}
