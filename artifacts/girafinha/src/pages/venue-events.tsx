import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, ChevronDown, ChevronRight, Loader2, MessageCircle, Pencil, Plus, Trash2, Users } from "lucide-react";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EventExtrasDetails } from "@/components/event-extras-selector";
import { OperationalChecklist } from "@/components/operational-checklist";
import { VenueEventModal } from "@/components/venue-event-modal";
import { useToast } from "@/hooks/use-toast";
import { buildTemplatedWhatsAppUrl, formatAmount } from "@/lib/whatsapp-templates";
import {
  getListVenueEventsQueryKey,
  useDeleteVenueEvent,
  useListVenueEvents,
  useListMessageTemplates,
} from "@workspace/api-client-react";
import type { MessageTemplate, VenueEvent } from "@workspace/api-client-react";

export default function VenueEventsPage() {
  const { data: events, isLoading } = useListVenueEvents();
  const { data: messageTemplates } = useListMessageTemplates();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [listView, setListView] = useState<"upcoming" | "past">("upcoming");
  const deleteVenueEvent = useDeleteVenueEvent();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { upcomingRows, pastRows } = useMemo(() => {
    const now = getPortugalDateTimeKey();
    const sortedEvents = [...(events ?? [])].sort(compareVenueEvents);

    return {
      upcomingRows: sortedEvents.filter((event) => !hasVenueEventEnded(event, now)),
      pastRows: sortedEvents.filter((event) => hasVenueEventEnded(event, now)).reverse(),
    };
  }, [events]);

  const rows = listView === "upcoming" ? upcomingRows : pastRows;

  const summary = useMemo(() => {
    const today = getPortugalDateKey();
    const sevenDaysFromToday = addCalendarDays(today, 7);
    return (events ?? []).reduce(
      (acc, event) => {
        const isUpcoming = !hasVenueEventEnded(event) && event.status !== "cancelled";
        if (isUpcoming) acc.upcoming += 1;
        if (isUpcoming && event.eventDate >= today && event.eventDate <= sevenDaysFromToday) acc.nextSevenDays += 1;
        if (event.paymentStatus === "paid") acc.paid += 1;
        acc.pending += event.remainingBalance;
        return acc;
      },
      { upcoming: 0, pending: 0, paid: 0, nextSevenDays: 0 },
    );
  }, [events]);

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
      <div className="flex items-center justify-between gap-3 md:items-start">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-primary md:text-3xl">Festas no Espaço</h1>
          <p className="mt-2 hidden max-w-3xl text-sm text-muted-foreground md:block md:text-base">
            Gestão de aniversários, packs, decoração, catering e eventos realizados no espaço.
          </p>
        </div>
        <div className="shrink-0 md:hidden">
          <VenueEventModal
            trigger={
              <Button className="min-h-10 rounded-full px-4 shadow-sm">
                <Plus className="h-4 w-4" />
                Nova
              </Button>
            }
          />
        </div>
        <div className="hidden md:block">
          <VenueEventModal />
        </div>
      </div>

      <section className="grid gap-2 grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Próximas festas" value={String(summary.upcoming)} loading={isLoading} />
        <SummaryCard label="Por receber" value={`${summary.pending.toFixed(2)} €`} loading={isLoading} />
        <SummaryCard label="Pagas" value={String(summary.paid)} loading={isLoading} />
        <SummaryCard label="Próximos 7 dias" value={String(summary.nextSevenDays)} loading={isLoading} />
      </section>

      <Card className="overflow-hidden border-border/70 shadow-sm">
        <CardHeader className="gap-3 border-b border-border/60 bg-card/70 p-2.5 md:flex-row md:items-center md:justify-between md:p-6 md:pb-4">
          <div className="hidden md:block">
            <CardTitle className="text-lg">Lista de festas</CardTitle>
            <CardDescription>
              {listView === "upcoming" ? "Festas de hoje e próximas, por ordem cronológica." : "Festas terminadas, da mais recente para a mais antiga."}
            </CardDescription>
          </div>
          <Tabs className="w-full md:w-auto" value={listView} onValueChange={(value) => setListView(value as "upcoming" | "past")}>
            <TabsList className="grid w-full grid-cols-2 md:w-auto">
              <TabsTrigger value="upcoming">Próximas ({upcomingRows.length})</TabsTrigger>
              <TabsTrigger value="past">Anteriores</TabsTrigger>
            </TabsList>
          </Tabs>
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
                  messageTemplates={messageTemplates}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-10 text-center text-muted-foreground">
              <CalendarDays className="mb-3 h-12 w-12 text-muted-foreground/30" />
              <p className="font-medium text-foreground">
                {listView === "upcoming" ? "Não há festas próximas." : "Ainda não há festas anteriores."}
              </p>
              <p className="mt-1 text-sm">
                {listView === "upcoming" ? "Cria uma festa usando o botão de nova festa ou consulta as anteriores." : "As festas terminadas aparecerão aqui."}
              </p>
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
  messageTemplates,
}: {
  event: VenueEvent;
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  deleting: boolean;
  messageTemplates?: MessageTemplate[];
}) {
  const date = parseISO(event.eventDate);
  const whatsappUrl = buildWhatsAppUrl(event, messageTemplates);
  const dateLabel = format(date, "dd MMM", { locale: ptBR }).replace(".", "").toUpperCase();
  const timeLabel = normalizeTime(event.startTime) + (event.endTime ? "–" + normalizeTime(event.endTime) : "");
  const childSummary = [
    event.birthdayChildName,
    event.birthdayChildAge !== null && event.birthdayChildAge !== undefined ? String(event.birthdayChildAge) + " anos" : null,
    String(event.childrenCount) + " crianças",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="transition-colors hover:bg-muted/30">
      <div className="relative md:hidden">
        <button
          type="button"
          className="w-full rounded-none p-3 pb-14 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-controls={"venue-event-details-" + event.id}
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-bold tracking-wide text-primary">
              {dateLabel} · {timeLabel}
            </p>
            <ChevronRight className={"h-4 w-4 shrink-0 text-muted-foreground transition-transform " + (expanded ? "rotate-90" : "")} />
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <h3 className="mr-0.5 min-w-0 break-words font-bold leading-snug text-foreground">{event.customerName}</h3>
            <PaymentBadge status={event.paymentStatus} />
            <StatusBadge status={event.status} ended={hasVenueEventEnded(event)} />
          </div>

          <p className="mt-1.5 break-words text-sm leading-snug text-muted-foreground">{childSummary}</p>

          <div className="mt-2 text-sm leading-snug">
            <p className="font-semibold text-foreground">{event.packName}</p>
            {event.partyTheme ? <p className="mt-0.5 break-words text-muted-foreground">Tema: {event.partyTheme}</p> : null}
          </div>

          <p className={"mt-3 pr-28 text-sm font-bold " + (event.remainingBalance > 0 ? "text-rose-700" : "text-emerald-700")}>
            Falta {event.remainingBalance.toFixed(2)} €
          </p>
        </button>

        <Button asChild variant="outline" size="sm" className="absolute bottom-3 right-3 z-10 min-h-9 rounded-xl px-3">
          <a href={whatsappUrl} target="_blank" rel="noreferrer" onClick={(clickEvent) => clickEvent.stopPropagation()}>
            <MessageCircle className="h-4 w-4" />
            WhatsApp
          </a>
        </Button>
      </div>

      <div className="hidden p-4 md:block">
        <div className="grid gap-3 lg:grid-cols-[88px_1fr_auto] lg:items-center">
        <div className="flex items-center justify-between rounded-xl bg-pink-50 px-3 py-2 text-pink-800 lg:flex-col lg:justify-center">
          <span className="text-xs font-semibold uppercase">{format(date, "MMM", { locale: ptBR })}</span>
          <span className="text-xl font-bold leading-none">{format(date, "dd")}</span>
        </div>

        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-bold text-foreground">{event.customerName}</h3>
            <PaymentBadge status={event.paymentStatus} />
            <StatusBadge status={event.status} ended={hasVenueEventEnded(event)} />
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
      </div>

      {expanded && (
        <div id={"venue-event-details-" + event.id} className="mx-3 mb-3 rounded-xl border border-border bg-muted/20 p-3 md:mx-4 md:mb-4 md:p-4">
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
          <EventExtrasDetails module="venue_events" entityId={event.id} />
          <div className="mt-4">
            <OperationalChecklist module="venue_events" entityId={event.id} title={`Checklist ${event.customerName}`} />
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

function StatusBadge({ status, ended }: { status: VenueEvent["status"]; ended: boolean }) {
  const labels = {
    draft: "Em preparação",
    confirmed: "Confirmada",
    completed: "Concluída",
    cancelled: "Cancelada",
  };
  const presentationStatus = ended && status !== "cancelled" ? "completed" : status;
  return <Badge variant="outline" className="rounded-md">{labels[presentationStatus]}</Badge>;
}

const PORTUGAL_TIME_ZONE = "Europe/Lisbon";

function compareVenueEvents(a: VenueEvent, b: VenueEvent) {
  return getVenueEventStartKey(a).localeCompare(getVenueEventStartKey(b));
}

function hasVenueEventEnded(event: VenueEvent, now = getPortugalDateTimeKey()) {
  return getVenueEventEndKey(event) <= now;
}

function getVenueEventStartKey(event: VenueEvent) {
  return `${event.eventDate}T${normalizeTime(event.startTime)}`;
}

function getVenueEventEndKey(event: VenueEvent) {
  return `${event.eventDate}T${normalizeTime(event.endTime || event.startTime)}`;
}

function normalizeTime(time: string) {
  return time.slice(0, 5).padStart(5, "0");
}

function getPortugalDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: PORTUGAL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function getPortugalDateTimeKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: PORTUGAL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

function addCalendarDays(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
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

function buildWhatsAppUrl(event: VenueEvent, templates?: MessageTemplate[]) {
  const fallback = `Ola ${event.customerName}! A sua festa no Espaco Girafinha esta registada para ${event.eventDate} as ${event.startTime}.`;
  return buildTemplatedWhatsAppUrl(event.phone, fallback, templates, "venue_events", {
    customerName: event.customerName,
    eventDate: event.eventDate,
    startTime: event.startTime,
    amountDue: formatAmount(event.remainingBalance),
    packName: event.packName,
  });
}
