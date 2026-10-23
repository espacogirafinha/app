import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Camera,
  Download,
  ExternalLink,
  FileText,
  Link2,
  Paperclip,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  documentRequest,
  documentQueryKey,
  downloadExpenseDocument,
  uploadExpenseDocument,
  type ExpenseDocument,
} from "@/lib/expense-documents";

export function ExpenseDocumentCounts({
  ids,
  children,
}: {
  ids: string[];
  children: (counts: Record<string, number>) => React.ReactNode;
}) {
  const query = useQuery({
    queryKey: [...documentQueryKey, "counts", ids],
    queryFn: () =>
      documentRequest<Record<string, number>>("counts", undefined, {
        ids: ids.join(","),
      }),
    enabled: ids.length > 0,
    retry: false,
  });
  return <>{children(query.data ?? {})}</>;
}
export function ExpenseDocuments({ expenseId }: { expenseId?: string }) {
  const client = useQueryClient();
  const { toast } = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [picker, setPicker] = useState(false);
  const [search, setSearch] = useState("");
  const query = useQuery({
    queryKey: [...documentQueryKey, "expense", expenseId],
    queryFn: () =>
      documentRequest<ExpenseDocument[]>("list", undefined, {
        expenseId: expenseId!,
      }),
    enabled: !!expenseId,
    retry: false,
  });
  const library = useQuery({
    queryKey: [...documentQueryKey, "library", search],
    queryFn: () =>
      documentRequest<ExpenseDocument[]>("library", undefined, { search }),
    enabled: !!expenseId && picker,
    retry: false,
  });
  const refresh = () =>
    client.invalidateQueries({ queryKey: documentQueryKey });
  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    try {
      await action();
      toast({ title: success });
    } catch (e) {
      toast({
        title: "Não foi possível concluir",
        description: e instanceof Error ? e.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      await refresh();
      setBusy(false);
    }
  }
  async function upload(files: FileList | null) {
    if (!files || !expenseId) return;
    const selected = Array.from(files);
    await run(async () => {
      for (const file of selected) await uploadExpenseDocument(expenseId, file);
    }, "Comprovativo anexado");
    if (fileInput.current) fileInput.current.value = "";
    if (camera.current) camera.current.value = "";
  }
  return (
    <section
      aria-label="Comprovativos"
      className="space-y-3 rounded-xl border border-border/70 bg-muted/15 p-3 sm:p-4"
    >
      <div>
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Paperclip className="h-4 w-4 text-primary" />
          Comprovativos
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Fotografias e faturas · até 10 MB por ficheiro
        </p>
      </div>
      {!expenseId ? (
        <p className="text-sm text-muted-foreground">
          Guarde a despesa para adicionar comprovativos.
        </p>
      ) : (
        <>
          <input
            ref={fileInput}
            aria-label="Selecionar comprovativos"
            className="sr-only"
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            multiple
            disabled={busy}
            onChange={(e) => void upload(e.target.files)}
          />
          <input
            ref={camera}
            aria-label="Fotografar comprovativo"
            className="sr-only"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            disabled={busy}
            onChange={(e) => void upload(e.target.files)}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy || query.isError}
              onClick={() => fileInput.current?.click()}
            >
              <Paperclip className="h-4 w-4" />
              Anexar comprovativo
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy || query.isError}
              onClick={() => camera.current?.click()}
            >
              <Camera className="h-4 w-4" />
              Tirar fotografia
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={busy || query.isError}
              onClick={() => setPicker(!picker)}
            >
              <Link2 className="h-4 w-4" />
              Usar existente
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            As alterações aos comprovativos são guardadas de imediato.
          </p>
          {busy && (
            <p role="status" className="text-sm text-primary">
              A processar comprovativo…
            </p>
          )}
          {query.isLoading && (
            <p role="status" className="text-sm text-muted-foreground">
              A carregar…
            </p>
          )}
          {query.isError && (
            <div role="alert" className="text-sm text-destructive">
              Não foi possível carregar os comprovativos.
              <p className="text-xs">{query.error.message}</p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void query.refetch()}
              >
                Tentar novamente
              </Button>
            </div>
          )}
          {query.data?.length === 0 && (
            <p className="py-2 text-sm text-muted-foreground">
              Esta despesa ainda não tem comprovativos.
            </p>
          )}
          {query.data?.map((doc) => (
            <DocumentCard
              key={doc.id}
              document={doc}
              busy={busy}
              onRemove={() =>
                void run(async () => {
                  const result = await documentRequest<{
                    cleanupPending: boolean;
                  }>("unlink", { expenseId, documentId: doc.id });
                  if (result.cleanupPending)
                    toast({
                      title: "Associação removida",
                      description:
                        "A limpeza do ficheiro será repetida automaticamente.",
                    });
                }, "Associação removida")
              }
            />
          ))}
          {picker && (
            <div className="space-y-2 border-t pt-3">
              <p className="text-sm font-medium">
                Associar um comprovativo guardado
              </p>
              <p className="text-xs text-muted-foreground">
                O mesmo ficheiro pode ser usado em várias despesas, sem duplicar
                valores.
              </p>
              <Input
                aria-label="Pesquisar comprovativo"
                placeholder="Pesquisar pelo nome do ficheiro…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {library.isLoading && (
                <p role="status" className="text-sm">
                  A pesquisar…
                </p>
              )}
              {library.isError && (
                <p role="alert" className="text-sm text-destructive">
                  Não foi possível pesquisar os comprovativos.
                </p>
              )}
              <div className="max-h-52 space-y-1 overflow-y-auto">
                {library.data
                  ?.filter((doc) => !query.data?.some((d) => d.id === doc.id))
                  .map((doc) => (
                    <Button
                      key={doc.id}
                      type="button"
                      variant="ghost"
                      disabled={busy}
                      className="h-auto min-h-11 w-full justify-start whitespace-normal text-left"
                      onClick={() =>
                        void run(async () => {
                          await documentRequest("link", {
                            expenseId,
                            documentId: doc.id,
                          });
                          setPicker(false);
                        }, "Comprovativo associado")
                      }
                    >
                      <FileText className="h-4 w-4 shrink-0" />
                      <span className="min-w-0 break-all">{doc.filename}</span>
                    </Button>
                  ))}
              </div>
              {library.data?.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Nenhum comprovativo encontrado.
                </p>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
function DocumentCard({
  document: doc,
  busy,
  onRemove,
}: {
  document: ExpenseDocument;
  busy: boolean;
  onRemove: () => void;
}) {
  const { toast } = useToast();
  const [preview, setPreview] = useState<string>();
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    let active = true;
    let url: string | undefined;
    if (doc.mimeType.startsWith("image/"))
      void downloadExpenseDocument(doc)
        .then((blob) => {
          if (active) {
            url = URL.createObjectURL(blob);
            setPreview(url);
          }
        })
        .catch(() => undefined);
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [doc.id, doc.storagePath, doc.mimeType]);
  async function open(download: boolean) {
    const tab = download ? null : window.open("about:blank", "_blank");
    if (tab) tab.opener = null;
    try {
      const blob = await downloadExpenseDocument(doc);
      const url = URL.createObjectURL(blob);
      if (download) {
        const link = window.document.createElement("a");
        link.href = url;
        link.download = doc.filename;
        link.click();
      } else if (tab) tab.location.href = url;
      else {
        URL.revokeObjectURL(url);
        throw new Error(
          "Permita abrir uma nova janela para visualizar o ficheiro.",
        );
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      tab?.close();
      toast({
        title: "Não foi possível abrir o comprovativo",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    }
  }
  return (
    <div className="rounded-lg border bg-background p-3">
      <div className="flex items-center gap-3">
        {preview ? (
          <img
            alt={`Pré-visualização de ${doc.filename}`}
            src={preview}
            className="h-14 w-14 shrink-0 rounded object-cover"
          />
        ) : (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded bg-primary/5">
            <FileText className="h-6 w-6 text-primary" />
          </div>
        )}
        <div className="min-w-0">
          <p className="break-all text-sm font-medium">{doc.filename}</p>
          <p className="text-xs text-muted-foreground">
            {doc.mimeType === "application/pdf" ? "PDF" : "Fotografia"} ·{" "}
            {(doc.size / 1024 / 1024).toLocaleString("pt-PT", {
              maximumFractionDigits: 2,
            })}{" "}
            MB
          </p>
          {doc.associationCount > 1 && (
            <p className="mt-1 text-xs text-primary">
              Associado a {doc.associationCount} despesas
            </p>
          )}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => void open(false)}
        >
          <ExternalLink className="h-4 w-4" />
          Abrir
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => void open(true)}
        >
          <Download className="h-4 w-4" />
          Descarregar
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={busy}
          className="text-destructive"
          onClick={() => setConfirm(true)}
        >
          <Trash2 className="h-4 w-4" />
          Remover
        </Button>
      </div>
      {confirm && (
        <div className="mt-2 space-y-2 border-t pt-2">
          <p className="text-xs text-muted-foreground">
            {doc.associationCount > 1
              ? "Remover apenas desta despesa? O ficheiro mantém-se nas restantes."
              : "Remover este comprovativo? O ficheiro será eliminado porque não está associado a outras despesas."}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => setConfirm(false)}
            >
              Manter
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={busy}
              onClick={() => {
                setConfirm(false);
                onRemove();
              }}
            >
              Confirmar remoção
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
