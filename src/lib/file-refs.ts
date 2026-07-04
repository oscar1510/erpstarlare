export interface ClientFileRef {
  url: string;
  fileName: string;
  mimeType: string;
  size: number;
}

/** Reads the hidden-input JSON that DocumentUploader submits in place of a raw file. */
export function parseFileRefs(formData: FormData, fieldName: string): ClientFileRef[] {
  const raw = formData.get(fieldName);
  if (!raw || typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [];
  }
}

export function parseFileRef(formData: FormData, fieldName: string): ClientFileRef | undefined {
  return parseFileRefs(formData, fieldName)[0];
}
