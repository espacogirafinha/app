import { differenceInDays, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, ChevronDown, Loader2, MapPin, MessageCircle, Pencil, Trash2, Users } from "lucide-react";
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
import { EventExtrasDetails } from "@/components/event-extras-selector";
import { ExternalEventModal } from "@/components/external-event-modal";
import { OperationalChecklist } from "@/components/operational-checklist";
import { useToast } from "@/hooks/use-toast";
import { buildTemplatedWhatsAppUrl, formatAmount } from "@/lib/whatsapp-templates";
import {
  getListExternalEventsQueryKey,
  useDeleteExternalEvent,
  useListExternalEvents,
  useListMessageTemplates,
} from "@workspace/api-client-react";
import type { ExternalEvent, ExternalEventServiceType, MessageTemplate } from "@workspace/api-client-react";

const SERVICE_LABELS: Record<ExternalEventServiceType, string> = {
  decoracao: "Decoração",
  catering: "Catering / Brunch",
  organizacao_evento: "Organização",
  animacao: "Animação",
  insuflavel: "Insuflável",
  baloes: "Balões",
  outro: "Outro",
};

export default function ExternalEventsPage() {
  const { data: events, isLoading } = useListExternalEvents();
  const { data: messageTemplates } = useListMessageTemplates();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const deleteExternalEvent = useDeleteExternalEvent();
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

  const handleDelete = (event: ExternalEvent) => {
    deleteExternalEvent.mutate(
      { id: event.id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListExternalEventsQueryKey() });
          toast({ title: "Serviço apagado", description: `${event.customerName} foi removido dos Serviços Externos.` });
        },
        onError: () => {
          toast({ title: "Não foi possível apagar o serviço externo", variant: "destructive" });
        },
      },
    );
  };

  return (
    <div className="space-y-4 md:space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-primary md:text-3xl">Serviços Externos</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground md:text-base">
            Gestão de decoração, catering, animação, insufláveis e serviços fora do espaço.
          </p>
        </div>
        <ExternalEventModal />
      </div>

      <section className="grid gap-2 grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Próximos serviços" value={String(summary.upcoming)} loading={isLoading} />
        <SummaryCard label="Por receber" value={`${summary.pending.toFixed(2)} €`} loading={isLoading} />
        <SummaryCard label="Pagos" value={String(summary.paid)} loading={isLoading} />
        <SummaryCard label="Próximos 7 dias" value={String(summary.nextSevenDays)} loading={isLoading} />
      </section>

      <Card className="overflow-hidden border-border/70 shadow-sm">
        <CardHeader className="border-b border-border/60 bg-card/70 pb-4">
          <CardTitle className="text-lg">Lista de serviços externos</CardTitle>
          <CardDescription>Eventos fora do espaço com um ou vários serviços associados.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center p-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
            </div>
          ) : rows.length > 0 ? (
            <div className="divide-y divide-border/60">
              {rows.map((event) => (
                <ExternalEventRow
                  key={event.id}
                  event={event}
                  expanded={expandedId === event.id}
                  onToggle={() => setExpandedId((current) => (current === event.id ? null : event.id))}
                  onDelete={() => handleDelete(event)}
                  deleting={deleteExternalEvent.isPending}
                  messageTemplates={messageTemplates}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-10 text-center text-muted-foreground">
              <CalendarDays className="mb-3 h-12 w-12 text-muted-foreground/30" />
              <p className="font-medium text-foreground">Ainda não há serviços externos registados.</p>
              <p className="mt-1 text-sm">Crie o primeiro evento externo usando o botão “Novo Serviço”.</p>
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

function ExternalEventRow({
  event,
  expanded,
  onToggle,
  onDelete,
  deleting,
  messageTemplates,
}: {
  event: ExternalEvent;
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  deleting: boolean;
  messageTemplates?: MessageTemplate[];
}) {
  const date = parseISO(event.eventDate);
  const whatsappUrl = buildWhatsAppUrl(event, messageTemplates);

  return (
    <div className="p-4 transition-colors hover:bg-muted/30">
      <div className="grid gap-3 lg:grid-cols-[88px_1fr_auto] lg:items-center">
        <div className="flex items-center justify-between rounded-xl bg-sky-50 px-3 py-2 text-sky-800 lg:flex-col lg:justify-center">
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
            {event.eventLocation && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{event.eventLocation}</span>}
            <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{event.guestCount} pessoas</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {event.eventType && <Badge variant="outline" className="rounded-md">{event.eventType}</Badge>}
            {event.eventTheme && <Badge variant="outline" className="rounded-md">Tema: {event.eventTheme}</Badge>}
            {event.services.map((service) => (
              <Badge key={service.id} className="rounded-md bg-sky-100 text-sky-800 hover:bg-sky-100">
                {service.serviceLabel || SERVICE_LABELS[service.serviceType]}
              </Badge>
            ))}
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
            <DetailsBlock title="Dados do cliente">
              <Info label="Cliente" value={event.customerName} />
              <Info label="Telefone" value={event.phone} />
              <Info label="Email" value={event.email} />
              <Info label="NIF" value={event.nif} />
              <Info label="Origem" value={event.source} />
            </DetailsBlock>
            <DetailsBlock title="Dados do evento">
              <Info label="Data" value={event.eventDate} />
              <Info label="Horário" value={`${event.startTime}${event.endTime ? `-${event.endTime}` : ""}`} />
              <Info label="Local" value={event.eventLocation} />
              <Info label="Tipo" value={event.eventType} />
              <Info label="Tema" value={event.eventTheme} />
            </DetailsBlock>
            <DetailsBlock title="Pagamento e ações">
              <Info label="Total" value={`${event.totalPrice.toFixed(2)} €`} />
              <Info label="Pago" value={`${event.amountPaid.toFixed(2)} €`} />
              <Info label="Método" value={event.paymentMethod} />
              <div className="mt-3 flex flex-wrap gap-2">
                <ExternalEventModal
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
                      <AlertDialogTitle>Apagar este serviço externo?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta ação remove o evento externo e todos os serviços associados.
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

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <DetailsBlock title="Serviços incluídos">
              {event.services.length > 0 ? (
                event.services.map((service) => (
                  <div key={service.id} className="rounded-lg border border-border p-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold">{service.serviceLabel}</span>
                      <span className="font-bold">{service.price.toFixed(2)} €</span>
                    </div>
                    {service.notes && <p className="mt-1 text-muted-foreground">{service.notes}</p>}
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Sem serviços associados.</p>
              )}
            </DetailsBlock>
            <DetailsBlock title="Notas operacionais">
              <Info label="Montagem" value={event.setupNotes} />
              <Info label="Desmontagem" value={event.teardownNotes} />
              <Info label="Acessos" value={event.accessNotes} />
              <Info label="Observações" value={event.notes} />
            </DetailsBlock>
          </div>
          <EventExtrasDetails module="external_events" entityId={event.id} />
          <div className="mt-4">
            <OperationalChecklist module="external_events" entityId={event.id} title={`Checklist ${event.customerName}`} />
          </div>
        </div>
      )}
    </div>
  );
}

function PaymentBadge({ status }: { status: ExternalEvent["paymentStatus"] }) {
  if (status === "paid") return <Badge className="rounded-md bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Pago</Badge>;
  if (status === "partial") return <Badge className="rounded-md bg-amber-100 text-amber-800 hover:bg-amber-100">Sinal</Badge>;
  return <Badge className="rounded-md bg-rose-100 text-rose-800 hover:bg-rose-100">Pendente</Badge>;
}

function StatusBadge({ status }: { status: ExternalEvent["status"] }) {
  const labels = {
    draft: "Em preparação",
    confirmed: "Confirmado",
    completed: "Concluído",
    cancelled: "Cancelado",
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

function buildWhatsAppUrl(event: ExternalEvent, templates?: MessageTemplate[]) {
  const fallback = `Ola ${event.customerName}, confirmamos o seu evento/servico externo para dia ${event.eventDate} as ${event.startTime}.`;
  return buildTemplatedWhatsAppUrl(event.phone, fallback, templates, "external_events", {
    customerName: event.customerName,
    eventDate: event.eventDate,
    startTime: event.startTime,
    amountDue: formatAmount(event.remainingBalance),
    eventLocation: event.eventLocation,
  });
}



