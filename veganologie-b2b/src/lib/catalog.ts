import * as XLSX from "xlsx";
import type { Product } from "../types";

// ---------------------------------------------------------------------------
// Product import (used when the user chooses to REPLACE the built-in catalog).
//
// The real Veganologie files have no SKU column, merged product-name cells,
// prices like "85 (Mirdif)\n90 (DIFC)", and names that differ between the two
// files ("Cider Cardholder" vs "Cider Apple - China"). So the importer is
// forgiving: auto-detects columns, forward-fills merged names, and matches
// cost to price by product family + size, preferring China when a product has
// several manufacturers. Anything it can't match is flagged so the user can
// set the cost by hand in "Review catalog".
// ---------------------------------------------------------------------------

type Row = (string | number | null)[];

export interface ImportResult {
  products: Product[];
  matched: number;
  unmatched: number;
  priceRows: number;
  costRows: number;
}

async function readRows(file: File): Promise<Row[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json<Row>(ws, { header: 1, defval: null, blankrows: true, raw: true });
}

function findHeader(rows: Row[]): number {
  let best = 0;
  let bestScore = -1;
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const score = (rows[i] || []).filter((c) => typeof c === "string" && c.trim().length > 0).length;
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best;
}

function headerText(row: Row): string[] {
  return (row || []).map((c) => (c == null ? "" : String(c)).toLowerCase().trim());
}

function colIndex(headers: string[], keywords: string[], avoid: string[] = []): number {
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    if (!h) continue;
    if (avoid.some((a) => h.includes(a))) continue;
    if (keywords.some((k) => h.includes(k))) return i;
  }
  return -1;
}

function parseNumber(cell: string | number | null): number | null {
  if (cell == null) return null;
  if (typeof cell === "number") return Number.isFinite(cell) ? cell : null;
  const m = String(cell).replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}

function str(cell: string | number | null): string {
  return cell == null ? "" : String(cell).replace(/\s+/g, " ").trim();
}

// --- name matching -----------------------------------------------------------

const STOP = new Set(["the", "w", "with", "for", "and", "of", "a", "hw"]);
const SIZE = new Set(["small", "medium", "large"]);
const COUNTRY = /\b(china|turkey|india|vietnam|prc|bangladesh)\b/;

function normName(s: string): string {
  return s
    .toLowerCase()
    .replace(/["″”]/g, " inch ")
    .replace(/inches?/g, " inch ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\binch\b/g, "in")
    .replace(/\s+/g, " ")
    .trim();
}
function tokenize(s: string): string[] {
  return normName(s)
    .split(" ")
    .filter((t) => t && !STOP.has(t));
}
function sizeTokens(s: string): string[] {
  return tokenize(s).filter((t) => SIZE.has(t) || /^\d{1,2}$/.test(t));
}

/** Coverage of the smaller token set, plus a bonus when product families align. */
function score(p: string, c: string): number {
  const pt = tokenize(p);
  const ct = tokenize(c);
  if (!pt.length || !ct.length) return 0;
  const cs = new Set(ct);
  let shared = 0;
  for (const t of pt) if (cs.has(t)) shared++;
  if (!shared) return 0;
  const cov = shared / Math.min(pt.length, ct.length);
  const fam = pt[0] === ct[0] || cs.has(pt[0]) || new Set(pt).has(ct[0]);
  if (!fam && cov < 0.6) return 0;
  return cov + (fam ? 0.3 : 0);
}

const THRESHOLD = 0.6;
const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;

interface CostEntry {
  name: string;
  sku: string;
  cost: number;
}

/** Choose a representative cost: prefer China among manufacturer variants,
 *  otherwise average the matched entries. */
function pickCost(entries: CostEntry[]): number {
  const withCountry = entries.filter((e) => COUNTRY.test(normName(e.name)));
  if (withCountry.length) {
    const china = withCountry.filter((e) => /\bchina\b/.test(normName(e.name)));
    return avg((china.length ? china : withCountry).map((e) => e.cost));
  }
  return avg(entries.map((e) => e.cost));
}

function slug(s: string): string {
  return normName(s).replace(/ /g, "-") || "item";
}

export async function buildCatalog(priceFile: File, costFile: File): Promise<ImportResult> {
  // ---- cost entries ----
  const costRows = await readRows(costFile);
  const cHeaderIdx = findHeader(costRows);
  const cH = headerText(costRows[cHeaderIdx]);
  const cName = Math.max(0, colIndex(cH, ["name", "product", "item", "description"]));
  const cCost = colIndex(cH, ["landing", "cost", "price"]);
  const cSku = colIndex(cH, ["sku", "code", "article", "barcode"]);

  const entries: CostEntry[] = [];
  const costBySku = new Map<string, number>();
  let lastCName = "";
  for (let i = cHeaderIdx + 1; i < costRows.length; i++) {
    const r = costRows[i] || [];
    const nm = str(r[cName]);
    if (nm) lastCName = nm;
    const cost = cCost >= 0 ? parseNumber(r[cCost]) : null;
    if (!lastCName || cost == null) continue;
    const sku = cSku >= 0 ? str(r[cSku]) : "";
    if (sku) costBySku.set(sku.toLowerCase(), cost);
    entries.push({ name: lastCName, sku, cost });
  }

  const resolveCost = (pname: string, sku: string): { cost: number; matched: boolean } => {
    if (sku && costBySku.has(sku.toLowerCase())) return { cost: costBySku.get(sku.toLowerCase())!, matched: true };
    let best = 0;
    const scored: { e: CostEntry; s: number }[] = [];
    for (const e of entries) {
      const s = score(pname, e.name);
      if (s > 0) {
        scored.push({ e, s });
        if (s > best) best = s;
      }
    }
    if (best < THRESHOLD) return { cost: 0, matched: false };
    const top = scored.reduce((a, b) => (b.s > a.s ? b : a)).e;
    const fam = tokenize(top.name)[0];
    let family = scored.filter((x) => x.s >= best - 0.2 && tokenize(x.e.name)[0] === fam).map((x) => x.e);
    const ps = sizeTokens(pname);
    if (ps.length) {
      const sized = family.filter((e) => sizeTokens(e.name).some((z) => ps.includes(z)));
      if (sized.length) family = sized;
    }
    return { cost: pickCost(family), matched: true };
  };

  // ---- price rows ----
  const priceRowsArr = await readRows(priceFile);
  const pHeaderIdx = findHeader(priceRowsArr);
  const pH = headerText(priceRowsArr[pHeaderIdx]);
  const pName = Math.max(0, colIndex(pH, ["product name", "name", "product", "item"]));
  const pRetail =
    colIndex(pH, ["full price", "retail", "rrp", "list price"], ["discount"]) >= 0
      ? colIndex(pH, ["full price", "retail", "rrp", "list price"], ["discount"])
      : colIndex(pH, ["price"], ["discount", "cost"]);
  const pColour = colIndex(pH, ["colour", "color"]);
  const pFabric = colIndex(pH, ["fabric", "material"]);
  const pSku = colIndex(pH, ["sku", "code", "article", "barcode"]);

  const products: Product[] = [];
  const seen = new Set<string>();
  let lastPName = "";
  let matched = 0;
  let priceCount = 0;

  for (let i = pHeaderIdx + 1; i < priceRowsArr.length; i++) {
    const r = priceRowsArr[i] || [];
    const nm = str(r[pName]);
    if (nm) lastPName = nm;
    const retail = pRetail >= 0 ? parseNumber(r[pRetail]) : null;
    if (!lastPName || retail == null) continue;

    const colour = pColour >= 0 ? str(r[pColour]) : "";
    const fabric = pFabric >= 0 ? str(r[pFabric]) : "";
    const sku = pSku >= 0 ? str(r[pSku]) : "";
    priceCount++;

    const { cost, matched: cm } = resolveCost(lastPName, sku);
    if (cm) matched++;

    const parts = [lastPName];
    if (colour) parts.push(colour);
    const name = parts.join(" — ") + (fabric ? ` (${fabric})` : "");

    let id = sku
      ? "sku-" + slug(sku)
      : slug(lastPName) + (colour ? "-" + slug(colour) : "") + (fabric ? "-" + slug(fabric) : "");
    let n = 2;
    const base = id;
    while (seen.has(id)) id = `${base}-${n++}`;
    seen.add(id);

    products.push({
      id,
      sku: sku || id,
      name,
      retail,
      cost: Math.round(cost * 100) / 100,
      costMatched: cm,
    });
  }

  return {
    products,
    matched,
    unmatched: priceCount - matched,
    priceRows: priceCount,
    costRows: entries.length,
  };
}
