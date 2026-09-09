import * as XLSX from "xlsx";
import type { Product } from "../types";

// ---------------------------------------------------------------------------
// Product import — single combined file.
//
// The Veganologie "Production Dashboard" file has one row per product variant,
// each with its own material, landing cost and retail price:
//
//   Name | Material | Colour Ways | Final Landing Cost AED | RETAIL PRICE
//
// So the importer is a straight 1:1 copy — one product per row, no matching or
// blending. The same product from different production facilities is kept as
// separate rows. RETAIL PRICE is VAT-inclusive, so priceExcl = retail / 1.05.
// ---------------------------------------------------------------------------

type Row = (string | number | null)[];

export interface ImportResult {
  products: Product[];
  matched: number; // rows that have a cost
  unmatched: number; // rows missing a cost (flagged for manual entry)
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

function slug(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "item"
  );
}

const round2 = (x: number) => Math.round(x * 100) / 100;

/** Build the catalog from a single combined file (one product per row). */
export async function buildCatalog(file: File): Promise<ImportResult> {
  const rows = await readRows(file);
  const hIdx = findHeader(rows);
  const H = headerText(rows[hIdx]);

  const nameCol = Math.max(0, colIndex(H, ["name", "product", "item", "description"]));
  const colourCol = colIndex(H, ["colour ways", "colourway", "colour", "color", "variant"]);
  // The material column may have a blank header; fall back to the column that
  // sits between the name and the colour columns.
  let materialCol = colIndex(H, ["material", "fabric"]);
  if (materialCol < 0 && colourCol > nameCol + 1) materialCol = nameCol + 1;
  const costCol = colIndex(H, ["landing", "cost"], ["retail"]);
  const retailCol =
    colIndex(H, ["retail", "full price", "rrp", "list price"], ["cost"]) >= 0
      ? colIndex(H, ["retail", "full price", "rrp", "list price"], ["cost"])
      : colIndex(H, ["price"], ["cost"]);

  const products: Product[] = [];
  const seen = new Set<string>();
  let lastName = "";
  let matched = 0;
  let rowsWithData = 0;

  for (let i = hIdx + 1; i < rows.length; i++) {
    const r = rows[i] || [];
    const nm = str(r[nameCol]);
    if (nm) lastName = nm; // forward-fill merged product name
    const cost = costCol >= 0 ? parseNumber(r[costCol]) : null;
    const retailIncl = retailCol >= 0 ? parseNumber(r[retailCol]) : null;
    // a real product row needs at least a name and one of cost/retail
    if (!lastName || (cost == null && retailIncl == null)) continue;

    const colour = colourCol >= 0 ? str(r[colourCol]) : "";
    const material = materialCol >= 0 ? str(r[materialCol]) : "";
    rowsWithData++;
    if (cost != null) matched++;

    // display: "Name — Colour (Material)"
    let name = lastName;
    if (colour) name += ` — ${colour}`;
    if (material) name += ` (${material})`;

    let id = slug(lastName) + (material ? "-" + slug(material) : "") + (colour ? "-" + slug(colour) : "");
    let n = 2;
    const base = id;
    while (seen.has(id)) id = `${base}-${n++}`;
    seen.add(id);

    products.push({
      id,
      sku: id,
      name,
      material,
      priceExcl: retailIncl != null ? round2(retailIncl / 1.05) : 0,
      cost: cost != null ? round2(cost) : 0,
      costMatched: cost != null,
    });
  }

  return {
    products,
    matched,
    unmatched: rowsWithData - matched,
    priceRows: rowsWithData,
    costRows: matched,
  };
}
