import { existsSync, readFileSync } from "fs";
import path from "path";
import { db } from "./db";

export interface ResolvedLogo {
  dataUri: string;
  buffer: Buffer;
  mime: string;
}

const REPO_CANDIDATES: [string, string][] = [
  ["public/starflare-logo.png", "image/png"],
  ["public/starflare-logo.svg", "image/svg+xml"],
  ["public/starflare-logo.jpg", "image/jpeg"],
  ["public/starflare-logo.jpeg", "image/jpeg"],
];

/**
 * The company logo for documents, in priority order:
 *   1. the logo uploaded in Settings (stored in Blob),
 *   2. a logo file committed to the repo at public/starflare-logo.*,
 *   3. none (callers fall back to the built-in SVG wordmark).
 */
export async function resolveLogo(): Promise<ResolvedLogo | null> {
  try {
    const setting = await db.setting.findUnique({ where: { id: "singleton" } });
    if (setting?.companyLogoUrl) {
      const res = await fetch(setting.companyLogoUrl);
      if (res.ok) {
        const buffer = Buffer.from(await res.arrayBuffer());
        const mime = res.headers.get("content-type") || "image/png";
        return { dataUri: `data:${mime};base64,${buffer.toString("base64")}`, buffer, mime };
      }
    }
  } catch (err) {
    console.error("[logo] failed to load uploaded logo:", err);
  }

  for (const [rel, mime] of REPO_CANDIDATES) {
    const p = path.join(process.cwd(), rel);
    if (existsSync(p)) {
      const buffer = readFileSync(p);
      return { dataUri: `data:${mime};base64,${buffer.toString("base64")}`, buffer, mime };
    }
  }
  return null;
}

/**
 * Crop the empty (transparent or near-white) border off a logo image so it
 * fills the header box instead of floating tiny in the middle of a padded
 * canvas — the usual reason an uploaded logo "shows too small". Returns a
 * tightly-cropped PNG; on any failure returns the original bytes unchanged.
 */
export async function trimLogoWhitespace(buffer: Buffer): Promise<Buffer> {
  try {
    const { createCanvas, loadImage } = await import("@napi-rs/canvas");
    const img = await loadImage(buffer);
    const w = img.width;
    const h = img.height;
    if (!w || !h) return buffer;
    const canvas = createCanvas(w, h);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img as unknown as any, 0, 0);
    const { data } = ctx.getImageData(0, 0, w, h);

    let minX = w;
    let minY = h;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const a = data[i + 3];
        if (a < 16) continue; // transparent
        if (data[i] > 244 && data[i + 1] > 244 && data[i + 2] > 244) continue; // near-white
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    if (maxX < minX || maxY < minY) return buffer; // fully blank — leave as-is

    const pad = Math.round(Math.min(w, h) * 0.02);
    minX = Math.max(0, minX - pad);
    minY = Math.max(0, minY - pad);
    maxX = Math.min(w - 1, maxX + pad);
    maxY = Math.min(h - 1, maxY + pad);
    const cw = maxX - minX + 1;
    const ch = maxY - minY + 1;
    const out = createCanvas(cw, ch);
    out.getContext("2d").drawImage(canvas as unknown as any, minX, minY, cw, ch, 0, 0, cw, ch);
    return out.toBuffer("image/png");
  } catch (err) {
    console.error("[logo] trim failed, using original:", err);
    return buffer;
  }
}
