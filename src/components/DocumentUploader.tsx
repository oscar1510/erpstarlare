"use client";

import { useRef, useState } from "react";

/**
 * File picker tuned for fast receipt capture: on mobile, `capture="environment"`
 * opens the camera directly. Works for images and PDFs. Actual saving happens
 * server-side when the form is submitted (native <input type=file> + Server
 * Action, no client-side upload JS needed).
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
  const [files, setFiles] = useState<string[]>([]);

  function updateFrom(input: HTMLInputElement | null) {
    if (!input?.files) return;
    setFiles(Array.from(input.files).map((f) => f.name));
  }

  return (
    <div className="border-2 border-dashed border-slate-300 rounded-lg p-4 bg-slate-50/50">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn-secondary" onClick={() => inputRef.current?.click()}>
          {label}
        </button>
        <button type="button" className="btn-secondary" onClick={() => cameraRef.current?.click()}>
          📷 Take photo
        </button>
        {required && files.length === 0 && <span className="text-xs text-slate-400">required</span>}
      </div>
      <input
        ref={inputRef}
        type="file"
        name={files.length ? name : name}
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => updateFrom(e.target)}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          // Mirror the captured photo into the primary input so only one field posts.
          if (inputRef.current && e.target.files?.length) {
            inputRef.current.files = e.target.files;
            updateFrom(inputRef.current);
          }
        }}
      />
      {files.length > 0 ? (
        <ul className="mt-2 text-sm text-slate-600 list-disc list-inside">
          {files.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-slate-400">Photo, scan, or PDF. Camera capture works on mobile.</p>
      )}
    </div>
  );
}
