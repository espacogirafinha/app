import { useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { ExpenseDocuments, PendingExpenseDocuments } from "@/components/expense-documents";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  createDemoDocumentClient,
  demoExpenses,
} from "./expense-documents-demo-store";
import { documentQueryKey, type ExpenseDocumentsClient } from "@/lib/expense-documents";
import "@/index.css";
function Demo({ transport }: { transport: ExpenseDocumentsClient }) {
  const [selected, setSelected] = useState(0);
  const [adding, setAdding] = useState(false);
  const [created, setCreated] = useState(false);
  const [queuedFiles, setQueuedFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const queryClient = useQueryClient();
  const expense = demoExpenses[selected];
  async function saveDemoExpense() {
    setSaving(true);
    setSaveError("");
    try {
      // This expense is fictional and pre-registered in the in-memory store.
      for (const file of queuedFiles) {
        await transport.upload(demoExpenses[2].id, file);
      }
      setCreated(true);
      setSelected(2);
      setQueuedFiles([]);
      setAdding(false);
      await queryClient.invalidateQueries({ queryKey: documentQueryKey });
    } catch {
      setSaveError("Não foi possível anexar o ficheiro. Volte a tentar.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <main className="mx-auto max-w-2xl space-y-5 px-4 py-6 sm:py-10">
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm">
        <p className="font-semibold text-primary">
          Demonstração · dados fictícios · 0 € de custos adicionais
        </p>
        <p className="mt-1 text-muted-foreground">
          Pode experimentar os comprovativos. Os ficheiros ficam apenas na
          memória deste navegador e desaparecem ao recarregar. Esta página não
          se liga à aplicação real.
        </p>
      </div>
      <header>
        <p className="text-sm text-muted-foreground">Espaço Girafinha</p>
        <h1 className="mt-1 text-2xl font-bold">Comprovativos das despesas</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Uma fatura fictícia de 54,08 € está associada às duas despesas.
          Remova-a de uma e confirme que continua na outra.
        </p>
      </header>
      <Button
        type="button"
        onClick={() => {
          setAdding(true);
          setSaveError("");
          setQueuedFiles([]);
        }}
      >
        Adicionar despesa
      </Button>
      <div
        className="grid gap-3 sm:grid-cols-2"
        aria-label="Despesas fictícias"
      >
        {demoExpenses.slice(0, created ? 3 : 2).map((item, i) => (
          <button
            type="button"
            key={item.id}
            aria-pressed={selected === i}
            onClick={() => { setSelected(i); setAdding(false); }}
            className={`rounded-xl border p-4 text-left transition-colors ${selected === i ? "border-primary bg-primary/5" : "bg-card"}`}
          >
            <span className="block text-sm">{item.description}</span>
            <span className="mt-2 block text-xl font-bold">
              {item.amount.toLocaleString("pt-PT", {
                style: "currency",
                currency: "EUR",
              })}
            </span>
          </button>
        ))}
      </div>
      {adding ? (
        <div className="space-y-4 rounded-xl border bg-card p-3 sm:p-5">
          <h2 className="text-base font-semibold">Adicionar despesa · demonstração</h2>
          <p className="text-xs text-muted-foreground">
            Exemplo fictício: uma despesa de 12,34 €. Na app real,
            data, valor, categoria e fornecedor são preenchidos no mesmo formulário.
          </p>
          <PendingExpenseDocuments files={queuedFiles} onChange={setQueuedFiles} disabled={saving} />
          {saveError && <p role="alert" className="text-sm text-destructive">{saveError}</p>}
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={saving} onClick={() => void saveDemoExpense()}>
              {saving ? "A guardar…" : "Guardar despesa e comprovativos"}
            </Button>
            <Button type="button" variant="outline" disabled={saving} onClick={() => setAdding(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border bg-card p-3 sm:p-5">
          <h2 className="mb-4 text-base font-semibold">{expense.description}</h2>
          <ExpenseDocuments
            key={expense.id}
            expenseId={expense.id}
            transport={transport}
          />
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Esta demonstração valida a interface. As permissões e o armazenamento
        privado reais são validados nos testes de integração com Supabase local
        descartável.
      </p>
      <Button
        type="button"
        variant="outline"
        onClick={() => window.location.reload()}
      >
        Repor demonstração
      </Button>
      <Toaster />
    </main>
  );
}
async function start() {
  const transport = await createDemoDocumentClient();
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  createRoot(document.getElementById("root")!).render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Demo transport={transport} />
      </TooltipProvider>
    </QueryClientProvider>,
  );
}
void start();
