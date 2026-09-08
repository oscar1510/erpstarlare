import { useRef, useState } from "react";
import { Modal } from "./Modal";

// Convert any uploaded image (PNG/JPG/SVG/WebP) to a PNG data URL via a canvas,
// so it embeds reliably in both the app header and the jsPDF quotation. Returns
// the data URL and the aspect ratio (width / height).
function fileToPng(file: File): Promise<{ url: string; aspect: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("That file isn't a readable image."));
      img.onload = () => {
        const maxW = 1000;
        const scale = Math.min(1, maxW / (img.width || maxW));
        const w = Math.max(1, Math.round((img.width || maxW) * scale));
        const h = Math.max(1, Math.round((img.height || maxW) * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas not available."));
        ctx.drawImage(img, 0, 0, w, h);
        resolve({ url: canvas.toDataURL("image/png"), aspect: w / h });
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
