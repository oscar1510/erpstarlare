"use client";

import { useRef, useState } from "react";
import { upload } from "@vercel/blob/client";

export interface UploadedFileRef {
  url: string;
  fileName: string;
  mimeType: string;
  size: number;
}

/**
 * File picker tuned for fast receipt capture: on mobile, `capture="environment"`
 * opens the camera directly. Works for images and PDFs.
 *
 * Uploads go straight from the browser to Vercel Blob storage (bypassing our
 * server) rather than through a Server Action's request body — Vercel
 * serverless functions hard-reject any request body over 4.5MB
 * (FUNCTION_PAYLOAD_TOO_LARGE), which real receipt photos and scanned PDFs
 * routinely exceed. Only the resulting blob URL(s) — a small JSON string —
 * get submitted with the surrounding form, via a hidden input of the same
 * field name the server actions already read.
 */
export function DocumentUploader({
  name = "file",
  multiple = false,
  accept = "image/*,application/pdf",
  required = false,
  label = "Upload document",
}: {
  name?: string;
  multiple?: boolean;
  accept?: string;
  required?: boolean;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [fileNames, setFileNames] = useState<string[]>([]);
  const [refs, setRefs] = useState<UploadedFileRef[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setFormDisabled(disabled: boolean) {
    const form = wrapperRef.current?.closest("form");
    form?.querySelectorAll('button[type="submit"]').forEach((btn) => {
      (btn as HTMLButtonElement).disabled = disabled;
    });
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const list = Array.from(files);
    setFileNames(list.map((f) => f.name));
    setError(null);
    setUploading(true);
    setFormDisabled(true);

    try {
      const uploaded: UploadedFileRef[] = [];
      for (const file of list) {
        const pathname = `direct/${Date.now()}-${file.name}`;
        const blob = await upload(pathname, file, {
          access: "public",
          handleUploadUrl: "/api/blob/upload",
        });
        uploaded.push({ url: blob.url, fileName: file.name, mimeType: file.type, size: file.size });
      }
      setRefs(uploaded);
    } catch (err: any) {
      setError(err?.message || "Upload failed. Please try again.");
      setRefs([]);
    } finally {
      setUploading(false);
      setFormDisabled(false);
    }
  }

  return (
    <div ref={wrapperRef} className="border-2 border-dashed border-slate-300 rounded-lg p-4 bg-slate-50/50">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn-secondary" onClick={() => inputRef.current?.click()} disabled={uploading}>
          {label}
        </button>
        <button type="button" className="btn-secondary" onClick={() => cameraRef.current?.click()} disabled={uploading}>
          📷 Take photo
        </button>
        {uploading && <span className="text-xs text-brand-700">Uploading…</span>}
        {!uploading && refs.length > 0 && <span className="text-xs text-green-700">✓ Ready to save</span>}
        {required && fileNames.length === 0 && !uploading && <span className="text-xs text-slate-400">required</span>}
      </div>

      <input ref={inputRef} type="file" accept={accept} multiple={multiple} className="hidden" onChange={(e) => handleFiles(e.target.files)} />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {/* Carries the uploaded blob URL(s) — not the raw bytes — to the surrounding Server Action. */}
      <input type="hidden" name={name} value={refs.length > 0 ? JSON.stringify(refs) : ""} />

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      {!error && fileNames.length > 0 ? (
        <ul className="mt-2 text-sm text-slate-600 list-disc list-inside">
          {fileNames.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      ) : (
        !error && <p className="mt-2 text-xs text-slate-400">Photo, scan, or PDF. Camera capture works on mobile.</p>
      )}
    </div>
  );
}
