/** Format a number as AED currency, e.g. 45380.5 -> "AED 45,380.50". */
export function aed(n: number): string {
  const v = Number.isFinite(n) ? n : 0;
  return (
    "AED " +
    v.toLocaleString("en-AE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

/** Format as AED with no decimals, e.g. 45380.5 -> "AED 45,381". Used in the
 *  internal summary tiles where clean, compact figures read better. */
export function aed0(n: number): string {
  const v = Number.isFinite(n) ? Math.round(n) : 0;
  return "AED " + v.toLocaleString("en-AE");
}

/** Format a plain number with thousands separators and 2 decimals. */
export function num(n: number): string {
  const v = Number.isFinite(n) ? n : 0;
  return v.toLocaleString("en-AE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Format a percentage, e.g. 38.53 -> "38.5%". */
export function pct(n: number): string {
  const v = Number.isFinite(n) ? n : 0;
  return v.toFixed(1) + "%";
}

/** Append the material to a product name. On the quotation the material reads
 *  as "<material> Leather" (e.g. "Bamboo Leather"); internally it's just the
 *  bare material. Returns the plain name when there is no material. */
export function withMaterial(name: string, material?: string, leather = false): string {
  const m = (material || "").trim();
  if (!m) return name;
  return `${name} (${m}${leather ? " Leather" : ""})`;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
