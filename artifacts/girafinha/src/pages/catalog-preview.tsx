import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { Link } from "wouter";
import {
  ArrowLeft, CheckCircle2, FileJson, FileImage, Images,
  LockKeyhole, Search, ShieldCheck, UploadCloud,
  AlertTriangle, PackageCheck, Boxes, X, Filter,
} from "lucide-react";
import { parseCatalogueJson, DEMO_ITEMS, type CatalogueItem, type CatalogueState } from "@/lib/catalog-preview";

type CataloguePhotoMap = Map<string, string>;

const STATE_LABELS: Record<CatalogueState, string> = {
  proposto: "Próprio · proposto",
  pendente: "Por confirmar",
  emprestado: "Emprestado",
};
const STATE_CLASSES: Record<CatalogueState, string> = {
  proposto: "bg-[#e3f4ef] text-[#24685e]",
  pendente: "bg-[#fff3dc] text-[#956923]",
  emprestado: "bg-[#f8e6ee] text-[#99516c]",
};
const readable = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export default function CataloguePreviewPage() {
  const [catalogue, setCatalogue] = useState<CatalogueItem[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [photos, setPhotos] = useState<CataloguePhotoMap>(new Map());
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Object URLs are browser-only references. Never transfer photo bytes to a backend.
  useEffect(() => {
    return () => {
      for (const url of photos.values()) URL.revokeObjectURL(url);
    };
  }, [photos]);

  const rows = catalogue ?? DEMO_ITEMS;
  const categories = useMemo(() => [...new Set(rows.map(item => item.category))].sort((a, b) => a.localeCompare(b, "pt")), [rows]);
  const filtered = useMemo(() => {
    const search = readable(query.trim());
    return rows.filter(item => {
      if (category && item.category !== category) return false;
      if (status && item.status !== status) return false;
      if (!search) return true;
      return readable([
        item.catalogCode, item.name, item.category, item.color, item.theme, item.notes,
      ].filter(Boolean).join(" ")).includes(search);
    });
  }, [rows, query, category, status]);
  const proposed = rows.filter(item => item.status === "proposto").length;
  const pending = rows.filter(item => item.status === "pendente").length;
  const borrowed = rows.filter(item => item.status === "emprestado").length;
  const photosFound = rows.filter(item => item.referencePhoto && photos.has(item.referencePhoto)).length;

  async function handleManifest(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    setNotice("");
    if (file.size > 2_000_000) {
      setError("O manifesto é demasiado grande (máximo 2 MB).");
      return;
    }
    try {
      const content = await file.text();
      const imported = parseCatalogueJson(content);
      setCatalogue(imported);
      setFileName(file.name);
      setCategory("");
      setStatus("");
      setQuery("");
      setNotice("Catálogo carregado localmente. Não foram alterados artigos nem quantidades na app.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível abrir o catálogo.");
    }
  }

  async function handlePhotos(event: ChangeEvent<HTMLInputElement>) {
    const chosen = [...(event.target.files ?? [])];
    event.target.value = "";
    if (!chosen.length) return;
    setError("");
    const valid: File[] = [];
    for (const file of chosen) {
      if (file.size < 10 || file.size > 5 * 1024 * 1024 || !/^[A-Za-z0-9()_-]+\.jpe?g$/i.test(file.name)) {
        setError("Uma fotografia tem nome, extensão ou tamanho inválido: " + file.name);
        return;
      }
      const signature = new Uint8Array(await file.slice(0, 3).arrayBuffer());
      if (signature[0] !== 255 || signature[1] !== 216 || signature[2] !== 255) {
        setError("Uma fotografia não é JPEG válido: " + file.name);
        return;
      }
      valid.push(file);
    }
    const next = new Map<string, string>();
    valid.forEach(file => next.set(file.name, URL.createObjectURL(file)));
    setPhotos(next);
    setNotice("Fotografias abertas localmente. Não foram enviadas para nenhum servidor.");
  }

  const reset = () => {
    setCatalogue(null);
    setFileName("");
    setCategory("");
    setStatus("");
    setQuery("");
    setError("");
    setNotice("");
    setPhotos(new Map());
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/inventory" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary">
          <ArrowLeft className="h-4 w-4" /> Voltar ao inventário
        </Link>
        <span className="inline-flex items-center gap-2 rounded-full bg-[#e5f5ef] px-3 py-1.5 text-xs font-semibold text-[#267363]">
          <ShieldCheck className="h-4 w-4" /> Apenas leitura · sem custos
        </span>
      </div>

      <section className="overflow-hidden rounded-[24px] border border-[#e5ede8] bg-gradient-to-br from-[#f1faf7] via-[#fffafb] to-[#fff8e9] p-5 sm:p-8">
        <div className="mb-4 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[#367b6c]">
          <Boxes className="h-4 w-4" /> Espaço Girafinha · decoração
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-[#294f48] sm:text-3xl">Catálogo visual dos materiais</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#627b70] sm:text-base">
          Pesquisa painéis, cilindros, personagens e acessórios por tema ou cor. Esta pré-visualização
          abre ficheiros no teu navegador; não faz qualquer importação para o inventário real.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-2 text-xs text-[#42685d]">
          <span className="rounded-full border border-[#cfe6dc] bg-white/70 px-3 py-1.5">Sem base de dados de testes paga</span>
          <span className="rounded-full border border-[#cfe6dc] bg-white/70 px-3 py-1.5">Sem alterações à produção</span>
          <span className="rounded-full border border-[#cfe6dc] bg-white/70 px-3 py-1.5">Fotografias permanecem no dispositivo</span>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border bg-card p-5">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-[#e9f3ee] p-3 text-[#397969]"><FileJson className="h-5 w-5" /></div>
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold">1. Carregar inventário</h2>
              <p className="mt-1 text-sm text-muted-foreground">Seleciona o ficheiro <b>Girafinha_Integracao_Manifesto_REVER.json</b>.</p>
              <label className="mt-4 inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl bg-[#39796b] px-4 py-2 text-sm font-semibold text-white hover:bg-[#286658]">
                <UploadCloud className="h-4 w-4" /> Escolher ficheiro JSON
                <input type="file" accept=".json,application/json" className="sr-only" onChange={handleManifest} aria-label="Selecionar manifesto JSON" />
              </label>
              {catalogue && <p className="mt-2 break-all text-xs text-[#347164]"><CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />{fileName} · {catalogue.length} registos</p>}
            </div>
          </div>
        </div>
        <div className="rounded-2xl border bg-card p-5">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-[#fae9f0] p-3 text-[#a36583]"><FileImage className="h-5 w-5" /></div>
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold">2. Associar fotografias (opcional)</h2>
              <p className="mt-1 text-sm text-muted-foreground">Extrai o ZIP das fotografias e seleciona os ficheiros JPEG da pasta <b>Fotos</b>.</p>
              <label className="mt-4 inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border border-[#d9adc1] bg-[#fff7fa] px-4 py-2 text-sm font-semibold text-[#97536e] hover:bg-[#faeaf1]">
                <Images className="h-4 w-4" /> Escolher fotografias
                <input type="file" accept=".jpg,.jpeg,image/jpeg" multiple className="sr-only" onChange={handlePhotos} aria-label="Selecionar fotografias JPEG" />
              </label>
              {photos.size > 0 && <p className="mt-2 text-xs text-[#347164]"><CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />{photos.size} fotografias abertas · {photosFound} fichas ilustradas</p>}
            </div>
          </div>
        </div>
      </section>

      {!catalogue && (
        <div className="rounded-xl border border-[#e8ddc2] bg-[#fff8e8] p-4 text-sm text-[#83652e]">
          <AlertTriangle className="mr-2 inline h-4 w-4" />
          <b>Modo demonstração:</b> aparecem apenas 6 exemplos. Carrega o manifesto para consultar os 185 registos reais.
        </div>
      )}
      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{error}
        </div>
      )}
      {notice && <p role="status" className="flex items-center gap-2 text-sm text-[#347164]"><CheckCircle2 className="h-4 w-4" />{notice}</p>}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Resumo do catálogo">
        {[
          { label: "Registos", number: rows.length, tone: "text-[#2e7769]" },
          { label: "Próprios · propostos", number: proposed, tone: "text-[#2e7769]" },
          { label: "Por confirmar", number: pending, tone: "text-[#956923]" },
          { label: "Emprestados", number: borrowed, tone: "text-[#97536e]" },
        ].map(entry => (
          <div key={entry.label} className="rounded-2xl border bg-card p-4">
            <p className={["text-2xl font-bold sm:text-3xl", entry.tone].join(" ")}>{entry.number}</p>
            <p className="mt-1 text-xs text-muted-foreground">{entry.label}</p>
          </div>
        ))}
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-bold tracking-tight">Materiais <span className="ml-1 text-sm font-normal text-muted-foreground">({filtered.length})</span></h2>
          {(catalogue || photos.size > 0) && (
            <button onClick={reset} className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" /> Limpar ficheiros locais
            </button>
          )}
        </div>
        <div className="grid gap-2 rounded-2xl border bg-card p-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,0.9fr)]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
            <input
              className="min-h-11 w-full rounded-xl border border-input bg-background pl-10 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Código, peça, cor ou tema…"
              value={query}
              onChange={event => setQuery(event.target.value)}
              aria-label="Pesquisar materiais"
            />
          </div>
          <div className="relative">
            <Filter className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
            <select aria-label="Filtrar por categoria" value={category} onChange={event => setCategory(event.target.value)}
              className="min-h-11 w-full appearance-none rounded-xl border border-input bg-background pl-9 pr-3 text-sm">
              <option value="">Todas as categorias</option>
              {categories.map(entry => <option key={entry} value={entry}>{entry}</option>)}
            </select>
          </div>
          <select aria-label="Filtrar por disponibilidade" value={status} onChange={event => setStatus(event.target.value)}
            className="min-h-11 w-full rounded-xl border border-input bg-background px-3 text-sm">
            <option value="">Todos os estados</option>
            <option value="proposto">Próprios · propostos</option>
            <option value="pendente">Por confirmar</option>
            <option value="emprestado">Emprestados</option>
          </select>
        </div>
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-card px-5 py-14 text-center text-sm text-muted-foreground">
            Nenhum material corresponde à pesquisa.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map(item => {
              const referenceUrl = item.referencePhoto ? photos.get(item.referencePhoto) : null;
              return (
                <article key={item.catalogCode} className="min-w-0 overflow-hidden rounded-2xl border bg-card">
                  {referenceUrl ? (
                    <div className="relative">
                      <img src={referenceUrl} alt={"Fotografia de referência da festa com " + item.name} loading="lazy" className="h-44 w-full object-cover" />
                      <span className="absolute bottom-2 left-2 rounded-lg bg-white/95 px-2 py-1 text-[10px] font-medium text-[#4d6960]">Foto do cenário · não isolada</span>
                    </div>
                  ) : (
                    <div className="flex h-44 flex-col items-center justify-center gap-2 bg-gradient-to-br from-[#edf7f3] via-[#fff8f6] to-[#fff5dd]">
                      <PackageCheck className="h-9 w-9 text-[#95bcac]" strokeWidth={1.5} />
                      <span className="text-xs text-[#76958a]">{item.referencePhoto ? "Associar fotografia local" : "Sem fotografia de referência"}</span>
                    </div>
                  )}
                  <div className="space-y-2.5 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <span className="rounded-md bg-muted px-2 py-1 text-[11px] font-bold tracking-wide">{item.catalogCode}</span>
                      <span className={["rounded-full px-2.5 py-1 text-[10px] font-semibold", STATE_CLASSES[item.status]].join(" ")}>
                        {STATE_LABELS[item.status]}
                      </span>
                    </div>
                    <h3 className="min-h-[2.8rem] text-[15px] font-bold leading-snug">{item.name.replace(/^[A-Z]{1,4}[0-9]{2}(?:-[A-Z0-9]+)?\s*·\s*/, "")}</h3>
                    <div className="flex flex-wrap gap-1.5">
                      <span className="rounded-md bg-[#f1f5f2] px-2 py-1 text-[11px] text-[#536f62]">{item.category}</span>
                      {item.theme && <span className="rounded-md bg-[#f9eef3] px-2 py-1 text-[11px] text-[#965977]">{item.theme}</span>}
                    </div>
                    <div className="grid grid-cols-2 gap-2 border-t pt-3 text-xs">
                      <div><p className="text-muted-foreground">Quantidade</p><p className="mt-0.5 font-semibold">{item.quantity === null ? "Por confirmar" : item.quantity + " " + item.unit}</p></div>
                      <div><p className="text-muted-foreground">Cor / acabamento</p><p className="mt-0.5 font-semibold">{item.color || "Por confirmar"}</p></div>
                    </div>
                    {item.notes && <p className="line-clamp-3 border-t pt-2 text-[11px] leading-relaxed text-muted-foreground" title={item.notes}>{item.notes}</p>}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <p className="flex items-start gap-2 border-t pt-4 text-xs leading-relaxed text-muted-foreground">
        <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" />
        Os ficheiros são lidos apenas na memória deste navegador. Ao atualizar a página, a pré-visualização volta ao modo demonstração.
        Esta página não guarda, altera ou envia dados ao Supabase e não tem botões de importação em produção.
      </p>
    </div>
  );
}
