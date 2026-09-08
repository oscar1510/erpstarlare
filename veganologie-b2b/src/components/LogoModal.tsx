import { useRef, useState } from "react";
import { Modal } from "./Modal";

// Convert any uploaded image (PNG/JPG/SVG/WebP) to a PNG data URL via a canvas.
// Crucially, it TRIMS the surrounding empty margin (transparent or near-white
// pixels) so the logo fills its box instead of floating tiny inside whitespace.
// Returns the trimmed data URL and its aspect ratio (width / height).
function fileToPng(file: File): Promise<{ url: string; aspect: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("That file isn't a readable image."));
      img.onload = () => {
        const maxW = 1200;
        const scale = Math.min(1, maxW / (img.width || maxW));
        const w = Math.max(1, Math.round((img.width || maxW) * scale));
        const h = Math.max(1, Math.round((img.height || maxW) * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas not available."));
        ctx.drawImage(img, 0, 0, w, h);

        // find the bounding box of non-background pixels
        let minX = w;
        let minY = h;
        let maxX = 0;
        let maxY = 0;
        let found = false;
        try {
          const data = ctx.getImageData(0, 0, w, h).data;
          for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
              const i = (y * w + x) * 4;
              const a = data[i + 3];
              const r = data[i];
              const g = data[i + 1];
              const bch = data[i + 2];
              const isBg = a < 12 || (r > 244 && g > 244 && bch > 244);
              if (!isBg) {
                found = true;
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
              }
            }
          }
        } catch {
          found = false; // canvas tainted (shouldn't happen for data URLs)
        }

        if (!found) {
          resolve({ url: canvas.toDataURL("image/png"), aspect: w / h });
          return;
        }

        // small padding around the content
        const pad = Math.round(Math.max(maxX - minX, maxY - minY) * 0.04);
        minX = Math.max(0, minX - pad);
        minY = Math.max(0, minY - pad);
        maxX = Math.min(w - 1, maxX + pad);
        maxY = Math.min(h - 1, maxY + pad);
        const cw = maxX - minX + 1;
        const ch = maxY - minY + 1;

        const out = document.createElement("canvas");
        out.width = cw;
        out.height = ch;
        const octx = out.getContext("2d");
        if (!octx) return reject(new Error("Canvas not available."));
        octx.drawImage(canvas, minX, minY, cw, ch, 0, 0, cw, ch);
        resolve({ url: out.toDataURL("image/png"), aspect: cw / ch });
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export function LogoModal({
  logoDataUrl,
  onClose,
  onSave,
  onRemove,
}: {
  logoDataUrl?: string;
  onClose: () => void;
  onSave: (url: string, aspect: number) => void;
  onRemove: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | undefined>(logoDataUrl);
  const [aspect, setAspect] = useState<number>(4);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const pick = async (file: File | null) => {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const { url, aspect } = await fileToPng(file);
      setPreview(url);
      setAspect(aspect);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Brand logo" onClose={onClose}>
      <p className="mb-4 text-sm text-forest-600">
        Upload your Veganologie logo. It appears in the app header and at the top of the customer
        quotation, replacing the built-in mark. PNG or SVG with a transparent background works best.
        It's stored in this browser only.
      </p>

      <div className="mb-4 flex min-h-[96px] items-center justify-center rounded-xl border border-dashed border-forest-200 bg-forest-50/40 p-4">
        {preview ? (
          <img src={preview} alt="Logo preview" className="max-h-20 max-w-full object-contain" />
        ) : (
          <span className="text-sm text-forest-400">No custom logo — using the built-in mark.</span>
        )}
      </div>

      {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}

      <input
        ref={ref}
        type="file"
        accept="image/png,image/jpeg,image/svg+xml,image/webp"
        className="hidden"
        onChange={(e) => pick(e.target.files?.[0] || null)}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          <button className="btn-ghost" type="button" onClick={() => ref.current?.click()} disabled={busy}>
            {busy ? "Reading…" : "Choose image…"}
          </button>
          {logoDataUrl && (
            <button
              className="btn-danger"
              type="button"
              onClick={() => {
                onRemove();
                onClose();
              }}
            >
              Remove
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-primary"
            disabled={!preview || busy || preview === logoDataUrl}
            onClick={() => {
              if (preview) {
                onSave(preview, aspect);
                onClose();
              }
            }}
          >
            Use this logo
          </button>
        </div>
      </div>
    </Modal>
  );
}
