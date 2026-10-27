import {
  expenseDocumentMetadata,
  type ExpenseDocument,
  type ExpenseDocumentsClient,
} from "../lib/expense-documents";
export const demoExpenses = Object.freeze([
  Object.freeze({
    id: "demo-catering",
    description: "Salgados para catering — exemplo",
    amount: 8.4,
  }),
  Object.freeze({
    id: "demo-stock",
    description: "Congelados para stock geral — exemplo",
    amount: 45.68,
  }),
  Object.freeze({
    id: "demo-new-expense",
    description: "Nova despesa fictícia",
    amount: 12.34,
  }),
]);
// Generates a valid, entirely fictional PDF in memory. No remote file or production data.
function examplePdf() {
  const text =
    "BT /F1 18 Tf 50 740 Td (DEMONSTRACAO - FATURA FICTICIA) Tj 0 -32 Td (Total: 54.08 EUR - sem valor fiscal) Tj ET";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${text.length} >>\nstream\n${text}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((v) => `${String(v).padStart(10, "0")} 00000 n \n`)
    .join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new File([pdf], "Fatura-ficticia-54-08.pdf", {
    type: "application/pdf",
  });
}
export async function createDemoDocumentClient(): Promise<ExpenseDocumentsClient> {
  const records = new Map<
    string,
    {
      document: ExpenseDocument;
      file: File;
      hash: string;
      expenses: Set<string>;
    }
  >();
  const validExpense = (id: unknown) => {
    if (!demoExpenses.some((e) => e.id === id))
      throw new Error("Despesa de demonstração inválida.");
    return String(id);
  };
  const get = (id: string) => {
    const row = records.get(id);
    if (!row) throw new Error("O comprovativo já foi removido.");
    return row;
  };
  async function upload(expenseId: string, file: File) {
    validExpense(expenseId);
    const metadata = await expenseDocumentMetadata(file);
    let row = [...records.values()].find((r) => r.hash === metadata.sha256);
    if (!row) {
      const id = crypto.randomUUID();
      row = {
        document: {
          id,
          filename: file.name,
          mimeType: file.type,
          size: file.size,
          storagePath: `demo/${id}`,
          associationCount: 0,
        },
        file,
        hash: metadata.sha256,
        expenses: new Set(),
      };
      records.set(id, row);
    }
    row.expenses.add(expenseId);
  }
  const client: ExpenseDocumentsClient = {
    async request<T>(
      action: string,
      body?: object,
      query: Record<string, string> = {},
    ) {
      const input = body as
        | { expenseId?: string; documentId?: string }
        | undefined;
      const list = () =>
        [...records.values()].map((r) => ({
          ...r.document,
          associationCount: r.expenses.size,
        }));
      let result: unknown;
      if (action === "list") {
        validExpense(query.expenseId);
        result = list().filter((d) => get(d.id).expenses.has(query.expenseId));
      } else if (action === "library")
        result = list().filter((d) =>
          d.filename
            .toLocaleLowerCase("pt-PT")
            .includes((query.search ?? "").toLocaleLowerCase("pt-PT")),
        );
      else if (action === "link") {
        const expense = validExpense(input?.expenseId);
        get(input?.documentId ?? "").expenses.add(expense);
        result = { ok: true };
      } else if (action === "unlink") {
        const expense = validExpense(input?.expenseId);
        const row = get(input?.documentId ?? "");
        row.expenses.delete(expense);
        if (row.expenses.size === 0) records.delete(row.document.id);
        result = { cleanupPending: false };
      } else throw new Error("Operação indisponível nesta demonstração.");
      return result as T;
    },
    upload,
    async download(document) {
      return get(document.id).file;
    },
  };
  const seed = examplePdf();
  for (const expense of demoExpenses.slice(0, 2)) await upload(expense.id, seed);
  return client;
}
