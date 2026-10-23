import { customFetch } from "@workspace/api-client-react";
export type ExpenseDocument = {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  storagePath: string;
  associationCount: number;
};
export const documentQueryKey = ["expense-documents"];
export async function documentRequest<T>(
  action: string,
  body?: object,
  query: Record<string, string> = {},
): Promise<T> {
  return customFetch<T>(
    `/api/expenses?${new URLSearchParams({ documentAction: action, ...query })}`,
    {
      requireAuth: true,
      responseType: "json",
      ...(body ? { method: "POST", body: JSON.stringify(body) } : {}),
    },
  );
}
export async function expenseDocumentMetadata(file: File) {
  if (
    !["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(
      file.type,
    ) ||
    file.size === 0 ||
    file.size > 10 * 1024 * 1024
  )
    throw new Error(
      "Escolha uma fotografia JPG, PNG, WEBP ou um PDF, até 10 MB.",
    );
  const sha256 = Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", await file.arrayBuffer()),
    ),
  )
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
  return { filename: file.name, mimeType: file.type, size: file.size, sha256 };
}
export async function uploadExpenseDocument(expenseId: string, file: File) {
  const metadata = await expenseDocumentMetadata(file);
  const prepared = await documentRequest<{
    document: ExpenseDocument;
    upload: boolean;
  }>("prepare", {
    expenseId,
    metadata,
  });
  if (!prepared.upload) return;
  try {
    const { supabase } = await import("@/lib/supabase");
    const { error } = await supabase.storage
      .from("expense-documents")
      .upload(prepared.document.storagePath, file, {
        contentType: file.type,
        upsert: false,
      });
    // A previous request may have completed its upload before losing connectivity.
    if (error && !("statusCode" in error && String(error.statusCode) === "409"))
      throw error;
    await documentRequest("finalize", {
      expenseId,
      documentId: prepared.document.id,
    });
  } catch (error) {
    // A lost finalize response may already be ready: abort only changes pending rows.
    await documentRequest("abort", { documentId: prepared.document.id }).catch(
      () => undefined,
    );
    throw error;
  }
}
export async function downloadExpenseDocument(
  document: ExpenseDocument,
): Promise<Blob> {
  const { supabase } = await import("@/lib/supabase");
  const { data, error } = await supabase.storage
    .from("expense-documents")
    .download(document.storagePath);
  if (error) throw error;
  return data;
}

export const expenseDocumentsClient = {
  request: documentRequest,
  upload: uploadExpenseDocument,
  download: downloadExpenseDocument,
};
export type ExpenseDocumentsClient = typeof expenseDocumentsClient;
