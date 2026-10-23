import { createHash } from "node:crypto";
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const DOCUMENT_BUCKET = "expense-documents";
export type DocumentMetadata = {
  filename: string;
  mimeType: string;
  size: number;
  sha256: string;
};
export class DocumentError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}
const extensions: Record<string, string[]> = {
  "application/pdf": ["pdf"],
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
};
export function validateDocumentMetadata(m: DocumentMetadata) {
  if (
    !m ||
    typeof m.filename !== "string" ||
    m.filename.length > 200 ||
    /[\\/\x00-\x1f\x7f]/.test(m.filename) ||
    !extensions[m.mimeType]?.includes(
      m.filename.split(".").pop()?.toLowerCase() ?? "",
    ) ||
    !Number.isInteger(m.size) ||
    m.size < 1 ||
    m.size > MAX_DOCUMENT_BYTES ||
    !/^[a-f0-9]{64}$/.test(m.sha256)
  )
    throw new DocumentError(
      "Use JPG, PNG, WEBP ou PDF, até 10 MB por ficheiro.",
    );
}
export function validateDocumentBytes(bytes: Uint8Array, m: DocumentMetadata) {
  validateDocumentMetadata(m);
  const b = Buffer.from(bytes);
  const valid =
    m.mimeType === "application/pdf"
      ? b.subarray(0, 5).toString() === "%PDF-"
      : m.mimeType === "image/jpeg"
        ? b[0] === 255 && b[1] === 216 && b[2] === 255
        : m.mimeType === "image/png"
          ? b
              .subarray(0, 8)
              .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
          : b.subarray(0, 4).toString() === "RIFF" &&
            b.subarray(8, 12).toString() === "WEBP";
  if (
    !valid ||
    b.length !== m.size ||
    createHash("sha256").update(b).digest("hex") !== m.sha256
  )
    throw new DocumentError(
      "O conteúdo do comprovativo não corresponde ao formato, tamanho ou assinatura declarados.",
    );
}
