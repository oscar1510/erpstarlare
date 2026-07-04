import path from "path";
import { createWorker, OEM } from "tesseract.js";

export interface OcrResult {
  text: string;
  confidence: number; // 0..1, average word confidence where available
  engine: "tesseract" | "pdf-text" | "pdf-rasterized" | "none";
  ok: boolean;
  error?: string;
}

const IMAGE_MIME_RE = /^image\//;

// Bundled locally so OCR never depends on an external CDN at request time
// (serverless functions get one cold-start fetch of the CDN copy otherwise,
// which is slow and a single point of failure for a core feature).
const TESSDATA_PATH = path.join(process.cwd(), "assets", "tessdata");

/**
 * tesseract.js's Node worker wires up failures via `worker.onerror = ...`,
 * which is a browser Worker convention — Node's real worker_threads.Worker
 * has no `onerror` setter, so that assignment is a no-op. Any failure to
 * spawn/load the worker (missing file, bad WASM, etc.) becomes an unhandled
 * 'error' event, which Node rethrows as an uncaught exception that crashes
 * the whole process — bypassing every try/catch around the call (verified
 * by reproducing it locally). Wrapping the call with our own
 * `uncaughtException` listener converts that crash back into an ordinary
 * rejection so a broken OCR run degrades to "needs review" instead of
 * taking down the request.
 */
async function runTesseractOnImage(buffer: Buffer): Promise<{ text: string; confidence: number }> {
  return new Promise((resolve, reject) => {
    const onUncaught = (err: Error) => {
      cleanup();
      reject(err);
    };
    const cleanup = () => process.off("uncaughtException", onUncaught);
    process.on("uncaughtException", onUncaught);

    (async () => {
      const worker = await createWorker("eng", OEM.LSTM_ONLY, {
        langPath: TESSDATA_PATH,
        cachePath: "/tmp",
        gzip: true,
      });
      try {
        const { data } = await worker.recognize(buffer);
        cleanup();
        resolve({ text: data.text, confidence: (data.confidence ?? 60) / 100 });
      } finally {
        await worker.terminate().catch(() => {});
      }
    })().catch((err) => {
      cleanup();
      reject(err);
    });
  });
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

const MAX_RASTERIZED_PAGES = 8;

/**
 * Renders each page of a PDF to a PNG (via pdfjs-dist + @napi-rs/canvas —
 * a native addon with prebuilt binaries for Vercel's linux-x64-gnu runtime,
 * no system Poppler/ImageMagick required) and runs each page through
 * tesseract.js. This is the fallback for PDFs with no embedded text layer —
 * scans, or (as confirmed against a real customer invoice) PDFs exported by
 * flattening a rendered page to a single image, which some invoicing tools
 * do despite the source being genuinely text-based.
 */
async function rasterizeAndOcrPdf(buffer: Buffer): Promise<{ text: string; confidence: number }> {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const { createCanvas } = await import("@napi-rs/canvas");

  const doc = await getDocument({ data: new Uint8Array(buffer), useSystemFonts: true }).promise;
  const pageCount = Math.min(doc.numPages, MAX_RASTERIZED_PAGES);

  let combinedText = "";
  const confidences: number[] = [];

  for (let i = 1; i <= pageCount; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 2.0 }); // ~200 DPI equivalent, good OCR accuracy without being huge
    const canvas = createCanvas(viewport.width, viewport.height);
    const context = canvas.getContext("2d");

    await page.render({ canvasContext: context as unknown as CanvasRenderingContext2D, viewport, canvas: canvas as unknown as HTMLCanvasElement }).promise;

    const pngBuffer = canvas.toBuffer("image/png");
    const { text, confidence } = await runTesseractOnImage(pngBuffer);
    combinedText += text + "\n";
    confidences.push(confidence);
  }

  const confidence = confidences.length ? confidences.reduce((a, b) => a + b, 0) / confidences.length : 0;
  return { text: combinedText.trim(), confidence };
}

/**
 * Run OCR on an in-memory file. Images go straight to tesseract.js (WASM,
 * no native binary required — safe for serverless). PDFs first try their
 * embedded text layer (instant, perfectly accurate for born-digital PDFs);
 * if that comes back empty, the PDF has no text layer (a scan, or a
 * flattened export), so each page is rendered to an image and OCR'd instead
 * — nothing gets marked "needs review" just because it's a PDF.
 */
export async function runOcr(buffer: Buffer, mimeType: string): Promise<OcrResult> {
  try {
    if (IMAGE_MIME_RE.test(mimeType)) {
      const { text, confidence } = await runTesseractOnImage(buffer);
      return { text, confidence, engine: "tesseract", ok: text.trim().length > 0 };
    }

    if (mimeType === "application/pdf") {
      const text = await extractPdfText(buffer).catch((err) => {
        console.error("[OCR] PDF text extraction failed:", err);
        return "";
      });
      if (text.replace(/\s+/g, "").length > 20) {
        return { text, confidence: 0.95, engine: "pdf-text", ok: true };
      }

      const rasterized = await rasterizeAndOcrPdf(buffer).catch((err) => {
        console.error("[OCR] PDF rasterize+OCR failed:", err);
        return null;
      });
      if (rasterized && rasterized.text.trim().length > 0) {
        return { text: rasterized.text, confidence: rasterized.confidence, engine: "pdf-rasterized", ok: true };
      }

      return {
        text: "",
        confidence: 0,
        engine: "pdf-rasterized",
        ok: false,
        error: "Could not read any text from this PDF, even after rendering it to an image for OCR.",
      };
    }

    return { text: "", confidence: 0, engine: "none", ok: false, error: "Unsupported file type for OCR" };
  } catch (err: any) {
    console.error("[OCR] runOcr failed:", err);
    return { text: "", confidence: 0, engine: "none", ok: false, error: String(err?.message || err) };
  }
}
