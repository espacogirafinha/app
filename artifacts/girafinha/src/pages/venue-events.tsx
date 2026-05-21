import { differenceInDays, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, CheckCircle2, ChevronDown, Loader2, MessageCircle, Pencil, Trash2, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { VenueEventModal } from "@/components/venue-event-modal";
import { useToast } from "@/hooks/use-toast";
import {
  getListVenueEventsQueryKey,
  useDeleteVenueEvent,
  useListVenueEvents,
} from "@workspace/api-client-react";
import type { VenueEvent } from "@workspace/api-client-react";

export default function VenueEventsPage() {
  const { data: events, isLoading } = useListVenueEvents();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const deleteVenueEvent = useDeleteVenueEvent();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const rows = useMemo(
    () => [...(events ?? [])].sort((a, b) => `${a.eventDate} ${a.startTime}`.localeCompare(`${b.eventDate} ${b.startTime}`)),
    [events],
  );

  const summary = useMemo(() => {
    const today = new Date();
    return rows.reduce(
      (acc, event) => {
        const daysUntil = differenceInDays(parseISO(event.eventDate), today);
        if (daysUntil >= 0) acc.upcoming += 1;
        if (daysUntil >= 0 && daysUntil <= 7) acc.nextSevenDays += 1;
        if (event.paymentStatus === "paid") acc.paid += 1;
        acc.pending += event.remainingBalance;
        return acc;
      },
      { upcoming: 0, pending: 0, paid: 0, nextSevenDays: 0 },
    );
  }, [rows]);

  const handleDelete = (event: VenueEvent) => {
    deleteVenueEvent.mutate(
      { id: event.id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListVenueEventsQueryKey() });
          toast({ title: "Festa apagada", description: `${event.customerName} foi removido das Festas no Espaço.` });
        },
        onError: () => {
          toast({ title: "Não foi possível apagar a festa", variant: "destructive" });
        },
      },
    );
  };

  return (
    <div className="space-y-4 md:space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-primary md:text-3xl">Festas no Espaço</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground md:text-base">
            Gestão de aniversários, packs, decoração, catering e eventos realizados no espaço.
          </p>
        </div>
        <VenueEventModal />
      </div>

      <section className="grid gap-2 grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Próximas festas" value={String(summary.upcoming)} loading={isLoading} />
        <SummaryCard label="Por receber" value={`${summary.pending.toFixed(2)} €`} loading={isLoading} />
        <SummaryCard label="Pagas" value={String(summary.paid)} loading={isLoading} />
        <SummaryCard label="Próximos 7 dias" value={String(summary.nextSevenDays)} loading={isLoading} />
      </section>

      <Card className="overflow-hidden border-border/70 shadow-sm">
        <CardHeader className="border-b border-border/60 bg-card/70 pb-4">
          <CardTitle className="text-lg">Lista de festas</CardTitle>
          <CardDescription>Módulo próprio da V2 ligado à nova entidade venue_events.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center p-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
            </div>
          ) : rows.length > 0 ? (
            <div className="divide-y divide-border/60">
              {rows.map((event) => (
                <VenueEventRow
                  key={event.id}
                  event={event}
                  expanded={expandedId === event.id}
                  onToggle={() => setExpandedId((current) => (current === event.id ? null : event.id))}
                  onDelete={() => handleDelete(event)}
                  deleting={deleteVenueEvent.isPending}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-10 text-center text-muted-foreground">
              <CalendarDays className="mb-3 h-12 w-12 text-muted-foreground/30" />
              <p className="font-medium text-foreground">Ainda não há festas no espaço registadas.</p>
              <p className="mt-1 text-sm">Cria a primeira festa usando o botão “Nova Festa”.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({ label, value, loading }: { label: string; value: string; loading: boolean }) {
  return (
    <Card className="border-border/70 shadow-sm">
      <CardContent className="p-3 md:p-4">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {loading ? (
          <Loader2 className="mt-2 h-5 w-5 animate-spin text-muted-foreground" />
        ) : (
          <p className="mt-1 text-xl font-bold md:text-2xl">{value}</p>
        )}
      </CardContent>
    </Card>
  );
}

function VenueEventRow({
  event,
  expanded,
  onToggle,
  onDelete,
  deleting,
}: {
  event: VenueEvent;
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  const date = parseISO(event.eventDate);
  const whatsappUrl = buildWhatsAppUrl(event);

  return (
    <div className="p-4 transition-colors hover:bg-muted/30">
      <div className="grid gap-3 lg:grid-cols-[88px_1fr_auto] lg:items-center">
        <div className="flex items-center justify-between rounded-xl bg-pink-50 px-3 py-2 text-pink-800 lg:flex-col lg:justify-center">
          <span className="text-xs font-semibold uppercase">{format(date, "MMM", { locale: ptBR })}</span>
          <span className="text-xl font-bold leading-none">{format(date, "dd")}</span>
        </div>

        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-bold text-foreground">{event.customerName}</h3>
            <PaymentBadge status={event.paymentStatus} />
            <StatusBadge status={event.status} />
          </div>
          <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
            <span>{event.startTime}{event.endTime ? `-${event.endTime}` : ""}</span>
            <span>{event.phone}</span>
            <span className="font-medium text-foreground">{event.packName}</span>
          </div>
          <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
            {event.birthdayChildName && <span>Aniversariante: {event.birthdayChildName}</span>}
            {event.birthdayChildAge !== null && event.birthdayChildAge !== undefined && <span>{event.birthdayChildAge} anos</span>}
            <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{event.childrenCount} crianças</span>
            {event.partyTheme && <span>Tema: {event.partyTheme}</span>}
          </div>
        </div>

        <div className="space-y-3 lg:min-w-[250px]">
          <div className="rounded-xl border border-border bg-background p-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Em falta</span>
              <span className={event.remainingBalance > 0 ? "font-bold text-rose-700" : "font-bold text-emerald-700"}>
                {event.remainingBalance.toFixed(2)} €
              </span>
            </div>
          </div>
          <div className="flex flex-wrap justify-start gap-2 lg:justify-end">
            <Button asChild variant="outline" size="sm" className="rounded-xl">
              <a href={whatsappUrl} target="_blank" rel="noreferrer">
                <MessageCircle className="h-4 w-4" />
                WhatsApp
              </a>
            </Button>
            <Button variant="outline" size="sm" onClick={onToggle} className="rounded-xl">
              <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
              Detalhes
            </Button>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 rounded-xl border border-border bg-muted/20 p-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <DetailsBlock title="Informação da festa">
              <Info label="Cliente" value={event.customerName} />
              <Info label="Telefone" value={event.phone} />
              <Info label="Email" value={event.email} />
              <Info label="Pack" value={event.packName} />
              <Info label="Origem" value={event.source} />
            </DetailsBlock>
            <DetailsBlock title="Aniversário e preparação">
              <Info label="Aniversariante" value={event.birthdayChildName} />
              <Info label="Idade" value={event.birthdayChildAge !== null && event.birthdayChildAge !== undefined ? `${event.birthdayChildAge} anos` : ""} />
              <Info label="Tema" value={event.partyTheme} />
              <Info label="Decoração" value={event.decorationNotes} />
              <Info label="Catering" value={event.cateringNotes} />
              <Info label="Alergias" value={event.allergies} />
            </DetailsBlock>
            <DetailsBlock title="Pagamento e ações">
              <Info label="Total" value={`${event.totalPrice.toFixed(2)} €`} />
              <Info label="Pago" value={`${event.amountPaid.toFixed(2)} €`} />
              <Info label="Método" value={event.paymentMethod} />
              <Info label="Checklist" value="TODO V2: checklist própria de festas" />
              <div className="mt-3 flex flex-wrap gap-2">
                <VenueEventModal
                  event={event}
                  trigger={
                    <Button variant="outline" size="sm" className="rounded-xl">
                      <Pencil className="h-4 w-4" />
                      Editar
                    </Button>
                  }
                />
                <Button variant="outline" size="sm" disabled className="rounded-xl">
                  <CheckCircle2 className="h-4 w-4" />
                  Checklist
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" className="rounded-xl text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                      Apagar
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Apagar esta festa?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta ação remove a festa da nova tabela venue_events. A tabela antiga de reservas não é afetada.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={onDelete} disabled={deleting}>
                        Apagar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </DetailsBlock>
          </div>
          {event.notes && (
            <div className="mt-4 rounded-lg border border-border bg-background p-3 text-sm">
              <p className="font-semibold">Observações</p>
              <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{event.notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PaymentBadge({ status }: { status: VenueEvent["paymentStatus"] }) {
  if (status === "paid") return <Badge className="rounded-md bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Pago</Badge>;
  if (status === "partial") return <Badge className="rounded-md bg-amber-100 text-amber-800 hover:bg-amber-100">Sinal</Badge>;
  return <Badge className="rounded-md bg-rose-100 text-rose-800 hover:bg-rose-100">Pendente</Badge>;
}

function StatusBadge({ status }: { status: VenueEvent["status"] }) {
  const labels = {
    draft: "Em preparação",
    confirmed: "Confirmada",
    completed: "Concluída",
    cancelled: "Cancelada",
  };
  return <Badge variant="outline" className="rounded-md">{labels[status]}</Badge>;
}

function DetailsBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <p className="mb-3 font-semibold text-foreground">{title}</p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="text-sm">
      <span className="text-muted-foreground">{label}: </span>
      <span className="font-medium text-foreground">{value || "-"}</span>
    </div>
  );
}

function buildWhatsAppUrl(event: VenueEvent) {
  const phone = event.phone.replace(/\D/g, "");
  const normalizedPhone = phone.startsWith("351") ? phone : `351${phone}`;
  const message = encodeURIComponent(
    `Olá ${event.customerName}! A sua festa no Espaço Girafinha está registada para ${event.eventDate} às ${event.startTime}.`,
  );
  return `https://wa.me/${normalizedPhone}?text=${message}`;
}
