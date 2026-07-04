import path from "path";
import { createWorker, OEM } from "tesseract.js";

export interface OcrResult {
  text: string;
  confidence: number; // 0..1, average word confidence where available
  engine: "tesseract" | "pdf-text" | "none";
  ok: boolean;
  error?: string;
}

const IMAGE_MIME_RE = /^image\//;

// Bundled locally so OCR never depends on an external CDN at request time
// (serverless functions get one cold-start fetch of the CDN copy otherwise,
// which is slow and a single point of failure for a core feature).
const TESSDATA_PATH = path.join(process.cwd(), "assets", "tessdata");

async function runTesseractOnImage(buffer: Buffer): Promise<{ text: string; confidence: number }> {
  const worker = await createWorker("eng", OEM.LSTM_ONLY, {
    langPath: TESSDATA_PATH,
    cachePath: "/tmp",
    gzip: true,
  });
  try {
    const { data } = await worker.recognize(buffer);
    return { text: data.text, confidence: (data.confidence ?? 60) / 100 };
  } finally {
    await worker.terminate();
  }
}

/**
 * Extracts embedded PDF text via pdfjs-dist (actively maintained; the
 * `pdf-parse` package was tried first but bundles a long-abandoned pdf.js
 * v1.10 that chokes on plenty of real-world PDFs). Text items come back as a
 * flat list with no line breaks, so lines are reconstructed from each item's
 * Y position — several of the field-extraction regexes depend on `\n`
 * boundaries to avoid matching across unrelated lines.
 */
async function extractPdfText(buffer: Buffer): Promise<string> {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
  }).promise;

  let text = "";
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    let lastY: number | null = null;
    let line = "";
    for (const item of content.items) {
      if (!("str" in item)) continue;
      const y = item.transform[5];
      if (lastY !== null && Math.abs(y - lastY) > 2) {
        text += line.trimEnd() + "\n";
        line = "";
      }
      line += item.str;
      lastY = y;
    }
    text += line.trimEnd() + "\n";
  }
  return text;
}

/**
 * Run OCR on an in-memory file. Images go straight to tesseract.js (WASM,
 * no native binary required — safe for serverless). PDFs first try their
 * embedded text layer (instant, perfectly accurate for born-digital PDFs
 * like Stripe invoices); if that's empty the PDF is a scan with no OCR
 * available in this deployment, so we report failure and let the caller
 * mark it "needs review" rather than losing the upload.
 */
export async function runOcr(buffer: Buffer, mimeType: string): Promise<OcrResult> {
  try {
    if (IMAGE_MIME_RE.test(mimeType)) {
      const { text, confidence } = await runTesseractOnImage(buffer);
      return { text, confidence, engine: "tesseract", ok: text.trim().length > 0 };
    }

    if (mimeType === "application/pdf") {
      const text = await extractPdfText(buffer).catch(() => "");
      if (text.replace(/\s+/g, "").length > 20) {
        return { text, confidence: 0.95, engine: "pdf-text", ok: true };
      }
      return {
        text,
        confidence: 0,
        engine: "pdf-text",
        ok: false,
        error: "No text layer found — this looks like a scanned PDF, which this deployment can't OCR. Upload as a photo/image instead, or fill in the fields manually.",
      };
    }

    return { text: "", confidence: 0, engine: "none", ok: false, error: "Unsupported file type for OCR" };
  } catch (err: any) {
    return { text: "", confidence: 0, engine: "none", ok: false, error: String(err?.message || err) };
  }
}
