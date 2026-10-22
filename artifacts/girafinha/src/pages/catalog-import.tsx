import { useMemo, useState, type ChangeEvent } from "react";
import { Link } from "wouter";
import { ArrowLeft, CheckCircle2, FileJson, ShieldCheck, AlertTriangle, PackagePlus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getListInventoryItemsQueryKey } from "@workspace/api-client-react";
import { parseCatalogueJson, type CatalogueItem } from "@/lib/catalog-preview";
import { supabase } from "@/lib/supabase";

/**
 * Authenticated review screen for the permanent catalogue import.
 * The production write control is intentionally OFF in every ordinary build.
 * Even with the UI enabled, the backend independently rejects Preview.
 */
const UI_IMPORT_ENABLED = import.meta.env.VITE_GIRAFINHA_CATALOG_IMPORT_UI_ENABLED === "owner-approved-one-time-import";

type ImportResult = { submitted: number; inserted: number; skippedAsExisting: number };

export default function CatalogueImportPage() {
  const [items, setItems] = useState<CatalogueItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [fileName, setFileName] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const queryClient = useQueryClient();

  const own = useMemo(() => items.filter(item => item.status === "proposto"), [items]);
  const pending = items.filter(item => item.status === "pendente");
  const borrowed = items.filter(item => item.status === "emprestado");

  async function openManifest(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setResult(null);
    setLoaded(false);
    setItems([]);
    setConfirmation("");
    setError("");
    if (file.size > 2_000_000) {
      setError("Este ficheiro excede 2 MB.");
      return;
    }
    try {
      const parsed = parseCatalogueJson(await file.text());
      setItems(parsed);
      setFileName(file.name);
      setLoaded(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível validar o ficheiro.");
    }
  }

  async function importNow() {
    if (!UI_IMPORT_ENABLED || busy || own.length === 0 || confirmation !== "IMPORTAR MATERIAIS") return;
    setError("");
    setBusy(true);
    try {
      const {data: {session}} = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Sessão expirada; inicia sessão novamente.");
      const response = await fetch("/api/inventory/catalog/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + session.access_token,
        },
        body: JSON.stringify({
          schemaVersion: "girafinha-inventory-staging-v1",
          productionWriteApproved: false,
          confirmation,
          items: own.map(item => ({
            catalogCode: item.catalogCode,
            name: item.name,
            category: item.category,
            quantity: item.quantity,
            unit: item.unit,
            color: item.color ?? null,
            theme: item.theme ?? null,
            notes: item.notes ?? null,
            ownership: item.ownership,
            validation: item.validation,
            itemType: "material",
          })),
        }),
      });
      const responseBody: unknown = await response.json();
      if (!response.ok) {
        const message = typeof responseBody === "object" && responseBody !== null
          && "error" in responseBody && typeof responseBody.error === "string"
          ? responseBody.error : "O servidor bloqueou ou não concluiu a importação.";
        throw new Error(message);
      }
      const data = responseBody as ImportResult;
      if (![data.submitted, data.inserted, data.skippedAsExisting].every(Number.isInteger)) {
        throw new Error("O servidor devolveu um resultado inesperado.");
      }
      setResult(data);
      setConfirmation("");
      await queryClient.invalidateQueries({ queryKey: getListInventoryItemsQueryKey() });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível importar os materiais.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <Link href="/inventory" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="h-4 w-4" /> Voltar ao inventário
      </Link>
      <div className="rounded-2xl border bg-gradient-to-br from-[#eaf7f2] to-[#fff7f1] p-6">
        <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#397969]">
          <PackagePlus className="h-4 w-4" /> Espaço Girafinha
        </span>
        <h1 className="mt-2 text-2xl font-bold text-[#315a50]">Importar materiais para a app</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Revê os materiais do catálogo e as quantidades antes da importação definitiva.
          Os emprestados e os artigos por confirmar não serão importados como stock próprio.
        </p>
      </div>

      <div className="rounded-xl border bg-card p-5">
        <label className="block text-sm font-semibold" htmlFor="catalogue-json">Ficheiro do inventário (JSON)</label>
        <p className="mb-3 mt-1 text-xs text-muted-foreground">Seleciona o manifesto que preparámos. A validação é local até à confirmação final.</p>
        <input id="catalogue-json" type="file" accept=".json,application/json" onChange={openManifest}
          className="block w-full max-w-xl rounded-lg border p-3 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-[#dff2e8] file:px-3 file:py-2 file:font-medium" />
        {loaded && <p className="mt-2 flex items-center gap-2 text-xs text-[#29725d]"><CheckCircle2 className="h-4 w-4" />{fileName} · {items.length} códigos validados</p>}
      </div>

      {loaded && (
        <>
          <div className="grid grid-cols-3 gap-3">
            {[
              { title: "Para importar", count: own.length, color: "text-[#286b5d]" },
              { title: "Por confirmar", count: pending.length, color: "text-[#9a7232]" },
              { title: "Emprestados", count: borrowed.length, color: "text-[#a45e77]" },
            ].map(row => (
              <div key={row.title} className="rounded-xl border bg-card p-3 sm:p-4">
                <p className={"text-2xl font-bold " + row.color}>{row.count}</p>
                <p className="mt-1 text-xs text-muted-foreground">{row.title}</p>
              </div>
            ))}
          </div>
          <div className="rounded-xl border bg-card p-4">
            <h2 className="font-semibold">Amostra do lote</h2>
            <p className="my-2 text-xs text-muted-foreground">Primeiros 10 artigos próprios. A revisão integral continua disponível no catálogo visual.</p>
            <div className="divide-y">
              {own.slice(0, 10).map(item => (
                <div className="flex items-center justify-between gap-4 py-2 text-sm" key={item.catalogCode}>
                  <span className="min-w-0 truncate">{item.name}</span>
                  <span className="shrink-0 tabular-nums font-semibold">{item.quantity} {item.unit}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
      {!UI_IMPORT_ENABLED ? (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <b>Importação bloqueada — aguardamos autorização final.</b>
            <p className="mt-1">Esta Preview não grava nada na base de dados. O desbloqueio exige aprovação da gestão e configuração separada em produção.</p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border p-5">
          <h2 className="font-semibold">Confirmação de segurança</h2>
          <p className="my-3 text-sm text-muted-foreground">
            Após aprovação formal, escreve <b>IMPORTAR MATERIAIS</b> para adicionar os artigos próprios à base de dados.
            Códigos existentes serão ignorados e não terão as quantidades alteradas.
          </p>
          <input className="min-h-11 w-full max-w-md rounded-xl border bg-background px-3 text-sm"
            value={confirmation} onChange={event => setConfirmation(event.target.value)}
            placeholder="IMPORTAR MATERIAIS" aria-label="Confirmar importação" />
          <button type="button" onClick={importNow}
            disabled={!loaded || !own.length || busy || confirmation !== "IMPORTAR MATERIAIS"}
            className="mt-3 block min-h-11 rounded-xl bg-[#397969] px-5 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
            {busy ? "A importar…" : "Importar materiais próprios"}
          </button>
        </div>
      )}
      {error && <p role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 p-4 text-sm text-red-800">
        <AlertTriangle className="mt-0.5 h-4 w-4" />{error}</p>}
      {result && <div role="status" className="rounded-xl border border-[#bcdacb] bg-[#f1faf5] p-4 text-sm text-[#236753]">
        <CheckCircle2 className="mr-2 inline h-5 w-5" />
        Importação concluída: {result.inserted} novos artigos, {result.skippedAsExisting} já existentes, {result.submitted} processados.
        <Link href="/inventory" className="mt-2 block font-semibold underline">Consultar o inventário</Link>
      </div>}
      <p className="text-xs text-muted-foreground">
        As 35 fotografias são referências de festas, não imagens individuais isoladas. Não são enviadas automaticamente para o Storage.
        Podes associar fotografias próprias a cada artigo através da edição normal do inventário.
      </p>
    </div>
  );
}
