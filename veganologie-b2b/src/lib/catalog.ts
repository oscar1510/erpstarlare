import * as XLSX from "xlsx";
import type { Product } from "../types";

// ---------------------------------------------------------------------------
// Product import.
//
// The tool is designed for the *ideal* case (two files, matched by SKU) but
// the real Veganologie files have no SKU column, merged product-name cells,
// prices like "85 (Mirdif)\n90 (DIFC)", and names that differ between the two
// files ("Maze Crossbody Bag" vs "Maze Crossbody"). So the importer is
// forgiving: it auto-detects columns, forward-fills merged names, matches by
// SKU when present and otherwise by fuzzy product-name similarity, and flags
// anything it couldn't match so the user can fix the cost by hand.
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
  return XLSX.utils.sheet_to_json<Row>(ws, {
    header: 1,
    defval: null,
    blankrows: true,
    raw: true,
  });
}

/** Pick the header row: the one (within the first 10) with the most text cells. */
function findHeader(rows: Row[]): number {
  let best = 0;
  let bestScore = -1;
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const score = (rows[i] || []).filter(
      (c) => typeof c === "string" && c.trim().length > 0,
    ).length;
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

/** Find the first column whose header matches any of the keywords. */
function colIndex(headers: string[], keywords: string[], avoid: string[] = []): number {
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    if (!h) continue;
    if (avoid.some((a) => h.includes(a))) continue;
    if (keywords.some((k) => h.includes(k))) return i;
  }
  return -1;
}

/** Extract the first number from a messy cell like "AED 719.00" or "85 (Mirdif)". */
function parseNumber(cell: string | number | null): number | null {
  if (cell == null) return null;
  if (typeof cell === "number") return Number.isFinite(cell) ? cell : null;
  const m = String(cell).replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}

function str(cell: string | number | null): string {
  return cell == null ? "" : String(cell).replace(/\s+/g, " ").trim();
}

// --- fuzzy name matching -----------------------------------------------------

const STOP = new Set(["bag", "the", "w", "with", "for", "and", "of", "a"]);

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

/** Token Jaccard similarity, with a bonus when one name contains the other. */
function similarity(a: string, b: string): number {
  const ta = new Set(tokenize(a));
  const tb = new Set(tokenize(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  const jaccard = inter / (ta.size + tb.size - inter);
  const na = normName(a).replace(/ /g, "");
  const nb = normName(b).replace(/ /g, "");
  const contains = na.includes(nb) || nb.includes(na) ? 0.15 : 0;
  return Math.min(1, jaccard + contains);
}

const MATCH_THRESHOLD = 0.45;

interface CostEntry {
  name: string;
  colour: string;
  sku: string;
  cost: number;
}

function slug(s: string): string {
  return normName(s).replace(/ /g, "-") || "item";
}

/**
 * Build the merged catalog from a retail-price file and a production-cost file.
 */
export async function buildCatalog(
  priceFile: File,
  costFile: File,
): Promise<ImportResult> {
  // ---- parse cost file ----
  const costRows = await readRows(costFile);
  const cHeaderIdx = findHeader(costRows);
  const cH = headerText(costRows[cHeaderIdx]);
  const cName = Math.max(0, colIndex(cH, ["name", "product", "item", "description"]));
  const cCost = colIndex(cH, ["landing", "cost", "price"]);
  const cColour = colIndex(cH, ["colour", "color"]);
  const cSku = colIndex(cH, ["sku", "code", "article", "barcode"]);

  const costEntries: CostEntry[] = [];
  let lastCName = "";
  for (let i = cHeaderIdx + 1; i < costRows.length; i++) {
    const r = costRows[i] || [];
    const nm = str(r[cName]);
    if (nm) lastCName = nm; // forward-fill merged product name
    const cost = cCost >= 0 ? parseNumber(r[cCost]) : null;
    if (!lastCName || cost == null) continue;
    costEntries.push({
      name: lastCName,
      colour: cColour >= 0 ? str(r[cColour]) : "",
      sku: cSku >= 0 ? str(r[cSku]) : "",
      cost,
    });
  }

  // cost lookup structures
  const costBySku = new Map<string, number>();
  const costByNameColour = new Map<string, number>();
  const costByName = new Map<string, number[]>();
  for (const e of costEntries) {
    if (e.sku) costBySku.set(e.sku.toLowerCase(), e.cost);
    if (e.colour)
      costByNameColour.set(normName(e.name) + "|" + normName(e.colour), e.cost);
    const key = normName(e.name);
    const arr = costByName.get(key) || [];
    arr.push(e.cost);
    costByName.set(key, arr);
  }
  const costNameKeys = [...costByName.keys()];
  const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;

  // ---- parse price file ----
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
    if (nm) lastPName = nm; // forward-fill merged product name
    const retail = pRetail >= 0 ? parseNumber(r[pRetail]) : null;
    if (!lastPName || retail == null) continue;

    const colour = pColour >= 0 ? str(r[pColour]) : "";
    const fabric = pFabric >= 0 ? str(r[pFabric]) : "";
    const sku = pSku >= 0 ? str(r[pSku]) : "";
    priceCount++;

    // resolve cost
    let cost = 0;
    let costMatched = false;
    if (sku && costBySku.has(sku.toLowerCase())) {
      cost = costBySku.get(sku.toLowerCase())!;
      costMatched = true;
    } else if (colour && costByNameColour.has(normName(lastPName) + "|" + normName(colour))) {
      cost = costByNameColour.get(normName(lastPName) + "|" + normName(colour))!;
      costMatched = true;
    } else if (costByName.has(normName(lastPName))) {
      cost = avg(costByName.get(normName(lastPName))!);
      costMatched = true;
    } else {
      // fuzzy: best-scoring cost product name
      let bestKey = "";
      let bestScore = 0;
      for (const key of costNameKeys) {
        const s = similarity(lastPName, key);
        if (s > bestScore) {
          bestScore = s;
          bestKey = key;
        }
      }
      if (bestScore >= MATCH_THRESHOLD && bestKey) {
        cost = avg(costByName.get(bestKey)!);
        costMatched = true;
      }
    }
    if (costMatched) matched++;

    // display name
    const parts = [lastPName];
    if (colour) parts.push(colour);
    const display = parts.join(" — ");
    const fabricSuffix = fabric ? ` (${fabric})` : "";
    const name = display + fabricSuffix;

    // stable, unique id
    let id = sku ? "sku-" + slug(sku) : slug(lastPName) + (colour ? "-" + slug(colour) : "") + (fabric ? "-" + slug(fabric) : "");
    let n = 2;
    let base = id;
    while (seen.has(id)) id = `${base}-${n++}`;
    seen.add(id);

    products.push({
      id,
      sku: sku || id,
      name,
      retail,
      cost: Math.round(cost * 100) / 100,
      costMatched,
    });
  }

  return {
    products,
    matched,
    unmatched: priceCount - matched,
    priceRows: priceCount,
    costRows: costEntries.length,
  };
}
