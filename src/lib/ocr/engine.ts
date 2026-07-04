import { execFile } from "child_process";
import { promisify } from "util";
import { mkdtemp, readFile, readdir, rm } from "fs/promises";
import path from "path";
import os from "os";

const execFileAsync = promisify(execFile);

export interface OcrResult {
  text: string;
  confidence: number; // 0..1, average word confidence where available
  engine: "tesseract" | "pdftotext" | "pdftotext+tesseract" | "none";
  ok: boolean;
  error?: string;
}

const IMAGE_MIME_RE = /^image\//;

async function runTesseractOnImage(imagePath: string): Promise<{ text: string; confidence: number }> {
  // Plain text pass
  const { stdout: text } = await execFileAsync(
    "tesseract",
    [imagePath, "stdout", "--psm", "6"],
    { maxBuffer: 20 * 1024 * 1024 }
  );

  // TSV pass to recover per-word confidence
  let confidence = 0.6; // sane default if TSV parsing fails
  try {
    const { stdout: tsv } = await execFileAsync(
      "tesseract",
      [imagePath, "stdout", "--psm", "6", "tsv"],
      { maxBuffer: 20 * 1024 * 1024 }
    );
    const rows = tsv.split("\n").slice(1);
    const confidences: number[] = [];
    for (const row of rows) {
      const cols = row.split("\t");
      const conf = parseFloat(cols[10]);
      if (Number.isFinite(conf) && conf >= 0) confidences.push(conf);
    }
    if (confidences.length > 0) {
      confidence = confidences.reduce((a, b) => a + b, 0) / confidences.length / 100;
    }
  } catch {
    // keep default confidence
  }

  return { text, confidence };
}

async function rasterizePdf(pdfPath: string, outDir: string): Promise<string[]> {
  await execFileAsync("pdftoppm", ["-r", "200", "-png", pdfPath, path.join(outDir, "page")], {
    maxBuffer: 20 * 1024 * 1024,
  });
  const files = await readdir(outDir);
  return files
    .filter((f) => f.startsWith("page") && f.endsWith(".png"))
    .sort()
    .map((f) => path.join(outDir, f));
}

async function extractPdfText(pdfPath: string): Promise<string> {
  const { stdout } = await execFileAsync("pdftotext", ["-layout", pdfPath, "-"], {
    maxBuffer: 20 * 1024 * 1024,
  });
  return stdout;
}

/**
 * Run OCR on a stored file. Images go straight to tesseract. PDFs first try
 * the embedded text layer (fast, perfectly accurate for born-digital PDFs
 * like Stripe invoices); if that yields too little text we assume it's a
 * scan and rasterize + tesseract each page instead.
 */
export async function runOcr(absolutePath: string, mimeType: string): Promise<OcrResult> {
  try {
    if (IMAGE_MIME_RE.test(mimeType)) {
      const { text, confidence } = await runTesseractOnImage(absolutePath);
      return { text, confidence, engine: "tesseract", ok: true };
    }

    if (mimeType === "application/pdf") {
      const embedded = await extractPdfText(absolutePath).catch(() => "");
      if (embedded.replace(/\s+/g, "").length > 60) {
        return { text: embedded, confidence: 0.95, engine: "pdftotext", ok: true };
      }

      const tmpDir = await mkdtemp(path.join(os.tmpdir(), "ocr-"));
      try {
        const pages = await rasterizePdf(absolutePath, tmpDir);
        let combinedText = "";
        const confidences: number[] = [];
        for (const page of pages.slice(0, 15)) {
          const { text, confidence } = await runTesseractOnImage(page);
          combinedText += text + "\n";
          confidences.push(confidence);
        }
        const confidence =
          confidences.length > 0 ? confidences.reduce((a, b) => a + b, 0) / confidences.length : 0;
        return {
          text: combinedText || embedded,
          confidence: combinedText ? confidence : 0.1,
          engine: "pdftotext+tesseract",
          ok: combinedText.trim().length > 0,
        };
      } finally {
        await rm(tmpDir, { recursive: true, force: true });
      }
    }

    return { text: "", confidence: 0, engine: "none", ok: false, error: "Unsupported file type for OCR" };
  } catch (err: any) {
    return { text: "", confidence: 0, engine: "none", ok: false, error: String(err?.message || err) };
  }
}
