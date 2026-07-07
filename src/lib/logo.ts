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
