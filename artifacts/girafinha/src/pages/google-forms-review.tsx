import { useState } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { ClipboardList, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { canConfirmReview, matchingReviewEvents } from "@/lib/google-forms-review";
import { useListVenueEvents } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type Review = {
  id: string;
  submittedAt: string;
  status: string;
  reasons: string[];
  venueEventId: string | null;
  fields: Record<string, string>;
};
type ReviewPage = { items: Review[]; nextCursor: string | null };

const labels: Record<string, string> = {
  customerName: "Responsável",
  phone: "Telefone",
  email: "Email",
  oldEmail: "Email antigo",
  nif: "NIF",
  eventDate: "Data da festa",
  time: "Horário",
  oldTime: "Horário antigo",
  pack: "Pack",
  birthdayChildName: "Criança",
  birthdayChildAge: "Idade",
  partyTheme: "Tema",
  decorationNotes: "Decoração",
  cateringNotes: "Catering",
  allergies: "Alergias",
  imageAuthorization: "Fotografias",
  deposit: "Sinal indicado no formulário",
  paymentMethod: "Forma de pagamento",
  requestedExtras: "Pedido de extras",
  requestedService: "Pedido de serviço",
  notes: "Observações",
  termsAccepted: "Termos",
  source: "Origem",
  extras: "Extras",
};

const reasonLabels: Record<string, string> = {
  "required event fields invalid":
    "Dados essenciais da festa inválidos ou em falta",
  "missing or invalid deposit": "Valor do sinal em falta ou inválido",
  "ambiguous age": "Idade da criança ambígua",
  "missing or ambiguous image authorization":
    "Autorização de fotografias em falta ou ambígua",
  "terms not accepted": "Termos não aceites",
  "catering requires review": "Pedido de catering para confirmar",
  "decoration requires review": "Pedido de decoração para confirmar",
  "requested extras require review": "Extras pedidos para confirmar",
  "extra not confirmed": "Extra por confirmar",
  "extra requires review": "Extra sem correspondência segura no catálogo",
  "extra price invalid": "Preço do extra inválido",
  "pack price unavailable": "Preço base do pack indisponível no catálogo",
  "matching date and phone": "Já existe uma festa com esta data e telefone",
};

async function requestReview<T>(path: string, init?: RequestInit): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw Error("Sessão terminada. Entra novamente na app.");
  const response = await fetch(`/api/integrations/google-forms/review${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    },
  });
  if (!response.ok)
    throw Error(
      response.status === 409
        ? "Este pedido já foi resolvido. Atualiza a lista."
        : response.status === 422
          ? "A festa escolhida não corresponde à data e telefone do formulário."
          : "Não foi possível consultar ou atualizar os pedidos.",
    );
  return response.json() as Promise<T>;
}

export default function GoogleFormsReviewPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const {
    data,
    isLoading,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["google-forms-review"],
    initialPageParam: "",
    queryFn: ({ pageParam }) =>
      requestReview<ReviewPage>(
        pageParam ? `?cursor=${encodeURIComponent(pageParam)}` : "",
      ),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    retry: false,
  });
  const reviews = data?.pages.flatMap((page) => page.items) ?? [];
  const { data: events = [], isError: eventsError } = useListVenueEvents();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedEvents, setSelectedEvents] = useState<Record<string, string>>(
    {},
  );

  async function resolve(
    review: Review,
    decision:
      | { action: "dismiss" }
      | { action: "confirm" }
      | { action: "link"; venueEventId: string },
  ) {
    setBusyId(review.id);
    try {
      await requestReview(`/${encodeURIComponent(review.id)}/resolve`, {
        method: "POST",
        body: JSON.stringify(decision),
      });
      await queryClient.invalidateQueries({
        queryKey: ["google-forms-review"],
      });
      toast({
        title:
          decision.action === "dismiss"
            ? "Pedido descartado"
            : decision.action === "confirm"
              ? "Pedido revisto"
              : "Festa associada ao pedido",
      });
    } catch (error) {
      toast({
        title:
          error instanceof Error
            ? error.message
            : "Não foi possível resolver o pedido",
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-primary md:text-3xl">
          Pedidos do Formulário
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Respostas que precisam de confirmação. Algumas já criaram uma festa
          em rascunho; outras precisam de ser associadas manualmente. Nenhum
          valor ou extra é cobrado neste ecrã.
        </p>
      </div>
      {isLoading ? (
        <p className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> A carregar pedidos…
        </p>
      ) : isError ? (
        <Card>
          <CardContent className="space-y-3 pt-6">
            <p>
              Não foi possível consultar os pedidos. Se a migração ainda não
              tiver sido aplicada, esta lista só ficará disponível depois da
              ativação.
            </p>
            <Button variant="outline" onClick={() => refetch()}>
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      ) : reviews.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-muted-foreground">
            Não há pedidos pendentes de revisão.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => {
            const matches = matchingReviewEvents(review.fields, events);
            const selected = selectedEvents[review.id] ?? "";
            return (
              <Card key={review.id} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
                    <ClipboardList className="h-5 w-5 text-primary" />{" "}
                    {review.fields.customerName ||
                      "Responsável por identificar"}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Festa: {review.fields.eventDate || "data por confirmar"} ·{" "}
                    {review.fields.phone || "telefone por confirmar"} ·{" "}
                    {review.fields.pack || "pack por confirmar"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Resposta recebida em{" "}
                    {new Date(review.submittedAt).toLocaleString("pt-PT", {
                      timeZone: "Europe/Lisbon",
                    })}
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                    <strong>Verificar antes de decidir:</strong>
                    <ul className="ml-5 mt-1 list-disc">
                      {review.reasons.map((reason) => (
                        <li key={reason}>{reasonLabels[reason] ?? reason}</li>
                      ))}
                    </ul>
                  </div>
                  <details className="rounded-lg border p-3 text-sm">
                    <summary className="cursor-pointer font-medium">
                      Ver respostas do formulário
                    </summary>
                    <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                      {Object.entries(review.fields).map(([key, value]) => (
                        <div key={key} className="min-w-0">
                          <dt className="text-muted-foreground">
                            {labels[key] ?? key}
                          </dt>
                          <dd className="break-words font-medium">{value}</dd>
                        </div>
                      ))}
                    </dl>
                  </details>
                  {canConfirmReview(review) ? (
                    <div className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="text-sm">
                        <p className="font-medium">A festa já foi criada na app.</p>
                        <p className="text-muted-foreground">
                          Confirma os dados, preço e pagamentos na festa. Quando estiver certo,
                          fecha este alerta.
                        </p>
                      </div>
                      <Button
                        disabled={busyId === review.id}
                        onClick={() => resolve(review, { action: "confirm" })}
                      >
                        Marcar como revisto
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center">
                      <label
                        className="text-sm font-medium"
                        htmlFor={`event-${review.id}`}
                      >
                        Associar a uma festa já registada:
                      </label>
                      <select
                        id={`event-${review.id}`}
                        className="min-h-10 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm"
                        value={selected}
                        onChange={(e) =>
                          setSelectedEvents((current) => ({
                            ...current,
                            [review.id]: e.target.value,
                          }))
                        }
                        disabled={busyId === review.id || matches.length === 0}
                      >
                        <option value="">
                          {matches.length
                            ? "Escolher festa"
                            : "Sem festa com a mesma data e telefone"}
                        </option>
                        {matches.map((event) => (
                          <option key={event.id} value={event.id}>
                            {event.customerName} · {event.eventDate}
                          </option>
                        ))}
                      </select>
                      <Button
                        disabled={!selected || busyId === review.id}
                        onClick={() =>
                          resolve(review, {
                            action: "link",
                            venueEventId: selected,
                          })
                        }
                      >
                        Associar
                      </Button>
                    </div>
                  )}
                  {eventsError && (
                    <p className="text-sm text-destructive">
                      Não foi possível carregar as festas para associação.
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-3">
                    <Link
                      className="text-sm font-medium text-primary underline"
                      href="/venue-events"
                    >
                      Criar uma festa manualmente
                    </Link>
                    <span className="text-xs text-muted-foreground">
                      Depois, volta aqui para a associar. Confirma preços e
                      pagamentos na festa.
                    </span>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" disabled={busyId === review.id}>
                        Descartar pedido
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          Descartar este pedido?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          O pedido sai da lista de revisão. Nenhuma festa ou
                          pagamento será alterado.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Manter pendente</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => resolve(review, { action: "dismiss" })}
                        >
                          Descartar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardContent>
              </Card>
            );
          })}
          {hasNextPage && (
            <Button
              variant="outline"
              disabled={isFetchingNextPage}
              onClick={() => fetchNextPage()}
            >
              {isFetchingNextPage ? "A carregar…" : "Carregar mais pedidos"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
