import { differenceInDays, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronRight, GraduationCap, Loader2, MapPin, Pencil, Plus, Trash2, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
import { WorkshopModal } from "@/components/workshop-modal";
import { WorkshopParticipantsPanel } from "@/components/workshop-participants-panel";
import { useToast } from "@/hooks/use-toast";
import { getListWorkshopsQueryKey, useDeleteWorkshop, useListWorkshops } from "@workspace/api-client-react";
import type { Workshop } from "@workspace/api-client-react";

type WorkshopListView = "upcoming" | "past";

export default function WorkshopsPage() {
  const { data: workshops, isLoading } = useListWorkshops();
  const linkedId = useMemo(getLinkedCalendarItemId, []);
  const [expandedId, setExpandedId] = useState<string | null>(linkedId);
  const [listView, setListView] = useState<WorkshopListView>("upcoming");
  const deleteWorkshop = useDeleteWorkshop();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { sortedRows, upcomingRows, pastRows } = useMemo(() => {
    const now = getPortugalDateTimeKey();
    const sorted = [...(workshops ?? [])].sort(compareWorkshops);

    return {
      sortedRows: sorted,
      upcomingRows: sorted.filter((workshop) => !hasWorkshopEnded(workshop, now)),
      pastRows: sorted.filter((workshop) => hasWorkshopEnded(workshop, now)).reverse(),
    };
  }, [workshops]);

  const rows = listView === "upcoming" ? upcomingRows : pastRows;

  useEffect(() => {
    if (!linkedId || !workshops) return;
    const linkedWorkshop = workshops.find((workshop) => workshop.id === linkedId);
    if (!linkedWorkshop) return;
    const targetView: WorkshopListView = hasWorkshopEnded(linkedWorkshop) ? "past" : "upcoming";
    if (listView !== targetView) {
      setListView(targetView);
      return;
    }
    const frame = requestAnimationFrame(() => document.getElementById("workshop-" + linkedId)?.scrollIntoView({ block: "center" }));
    return () => cancelAnimationFrame(frame);
  }, [linkedId, listView, workshops]);

  const summary = useMemo(() => {
    const today = new Date();
    return sortedRows.reduce(
      (acc, workshop) => {
        const daysUntil = differenceInDays(parseISO(workshop.date), today);
        if (daysUntil >= 0) acc.scheduled += 1;
        acc.registrations += workshop.activeParticipantsCount;
        acc.pending += workshop.totalPending;
        acc.availableSeats += workshop.availableSeats;
        return acc;
      },
      { scheduled: 0, registrations: 0, pending: 0, availableSeats: 0 },
    );
  }, [sortedRows]);

  const handleDelete = (workshop: Workshop) => {
    deleteWorkshop.mutate(
      { id: workshop.id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListWorkshopsQueryKey() });
          toast({ title: "Workshop apagado", description: `${workshop.name} foi removido dos Workshops/Formações.` });
        },
        onError: () => {
          toast({ title: "Não foi possível apagar o workshop", variant: "destructive" });
        },
      },
    );
  };

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500 md:space-y-6">
      <div className="flex items-center justify-between gap-3 md:items-start">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-primary md:text-3xl">Workshops/Formações</h1>
          <p className="mt-2 hidden max-w-3xl text-sm text-muted-foreground md:block md:text-base">
            Gestão de workshops, formações, inscrições e participantes.
          </p>
        </div>
        <div className="shrink-0 md:hidden">
          <WorkshopModal
            trigger={
              <Button className="min-h-10 rounded-full px-4 shadow-sm">
                <Plus className="h-4 w-4" />
                Novo
              </Button>
            }
          />
        </div>
        <div className="hidden md:block">
          <WorkshopModal />
        </div>
      </div>

      <section className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <SummaryCard label="Workshops agendados" value={String(summary.scheduled)} loading={isLoading} />
        <SummaryCard label="Inscrições" value={String(summary.registrations)} loading={isLoading} />
        <SummaryCard label="Por receber" value={`${summary.pending.toFixed(2)} €`} loading={isLoading} />
        <SummaryCard label="Vagas disponíveis" value={String(summary.availableSeats)} loading={isLoading} />
      </section>

      <Card className="overflow-hidden border-border/70 shadow-sm">
        <CardHeader className="gap-3 border-b border-border/60 bg-card/70 p-2.5 md:flex-row md:items-center md:justify-between md:p-4">
          <div className="hidden md:block">
            <CardTitle className="text-lg">Lista de workshops</CardTitle>
            <CardDescription>Workshops, inscrições e disponibilidade num só lugar.</CardDescription>
          </div>
          <Tabs className="w-full md:w-auto" value={listView} onValueChange={(value) => setListView(value as WorkshopListView)}>
            <TabsList className="grid w-full grid-cols-2 md:w-auto">
              <TabsTrigger value="upcoming">Próximos ({upcomingRows.length})</TabsTrigger>
              <TabsTrigger value="past">Anteriores</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center p-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
            </div>
          ) : rows.length > 0 ? (
            <div className="divide-y divide-border/60">
              {rows.map((workshop) => (
                <WorkshopRow
                  key={workshop.id}
                  workshop={workshop}
                  expanded={expandedId === workshop.id}
                  onToggle={() => setExpandedId((current) => (current === workshop.id ? null : workshop.id))}
                  onDelete={() => handleDelete(workshop)}
                  deleting={deleteWorkshop.isPending}
                />
              ))}
            </div>
          ) : (
            <WorkshopEmptyState view={listView} hasAnyWorkshops={sortedRows.length > 0} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({ label, value, loading }: { label: string; value: string; loading: boolean }) {
  return (
    <Card className="border-border/70 shadow-sm">
      <CardContent className="p-2.5 sm:p-3 md:p-4">
        <p className="text-xs font-medium leading-snug text-muted-foreground">{label}</p>
        {loading ? (
          <Loader2 className="mt-2 h-5 w-5 animate-spin text-muted-foreground" />
        ) : (
          <p className="mt-1 text-xl font-bold md:text-2xl">{value}</p>
        )}
      </CardContent>
    </Card>
  );
}

function WorkshopEmptyState({ view, hasAnyWorkshops }: { view: WorkshopListView; hasAnyWorkshops: boolean }) {
  const title = !hasAnyWorkshops
    ? "Nenhum workshop agendado"
    : view === "upcoming"
      ? "Nenhum workshop próximo"
      : "Nenhum workshop anterior";
  const description = !hasAnyWorkshops
    ? "Crie o primeiro workshop para começar a gerir inscrições e participantes."
    : view === "upcoming"
      ? "Crie um workshop ou consulte os anteriores."
      : "Os workshops terminados aparecerão aqui.";

  return (
    <div className="flex flex-col items-center justify-center px-5 py-8 text-center text-muted-foreground">
      <div className="mb-3 rounded-full bg-violet-50 p-2.5 text-violet-500">
        <GraduationCap className="h-6 w-6" />
      </div>
      <p className="font-semibold text-foreground">{title}</p>
      <p className="mt-1 max-w-md text-sm">{description}</p>
      <WorkshopModal
        trigger={
          <Button className="mt-4 min-h-10 rounded-full px-4 shadow-sm">
            <Plus className="h-4 w-4" />
            Novo workshop
          </Button>
        }
      />
    </div>
  );
}

function WorkshopRow({
  workshop,
  expanded,
  onToggle,
  onDelete,
  deleting,
}: {
  workshop: Workshop;
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  const date = parseISO(workshop.date);
  const dateLabel = format(date, "dd MMM", { locale: ptBR }).replace(".", "").toUpperCase();
  const timeLabel = normalizeTime(workshop.startTime) + (workshop.endTime ? "–" + normalizeTime(workshop.endTime) : "");
  const financialLabel = workshop.totalPending > 0
    ? { label: `Falta ${workshop.totalPending.toFixed(2)} €`, className: "text-rose-700" }
    : workshop.totalReceived > 0
      ? { label: "Pago", className: "text-emerald-700" }
      : null;

  return (
    <div id={"workshop-" + workshop.id} className="scroll-mt-6 transition-colors hover:bg-muted/30">
      <button
        type="button"
        className="w-full p-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring md:p-4"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={"workshop-details-" + workshop.id}
      >
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold tracking-wide text-primary">
              {dateLabel} · {timeLabel}
            </p>

            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <h3 className="mr-0.5 min-w-0 break-words font-bold leading-snug text-foreground">{workshop.name}</h3>
              <StatusBadge status={workshop.status} ended={hasWorkshopEnded(workshop)} />
              {workshop.kitIncluded ? <Badge className="rounded-md bg-violet-100 text-violet-800 hover:bg-violet-100">Kit incluído</Badge> : null}
            </div>

            <p className="mt-1.5 flex items-start gap-1.5 break-words text-sm leading-snug text-muted-foreground">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{workshop.location || "Espaço Girafinha"}</span>
            </p>

            <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm leading-snug text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  {workshop.activeParticipantsCount} {workshop.activeParticipantsCount === 1 ? "inscrito" : "inscritos"}
                </span>
                <span>{formatAvailableSeats(workshop.availableSeats)}</span>
                <span>{workshop.price.toFixed(2)} € / participante</span>
              </div>
              {financialLabel ? <p className={`text-sm font-bold ${financialLabel.className}`}>{financialLabel.label}</p> : null}
            </div>
          </div>

          <ChevronRight className={`mt-1 h-5 w-5 shrink-0 text-muted-foreground transition-transform ${expanded ? "rotate-90" : ""}`} />
        </div>
      </button>

      {expanded ? (
        <div id={"workshop-details-" + workshop.id} className="mx-3 mb-3 rounded-xl border border-border bg-muted/20 p-3 md:mx-4 md:mb-4 md:p-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <DetailsBlock title="Dados do workshop">
              <Info label="Nome" value={workshop.name} />
              <Info label="Data" value={workshop.date} />
              <Info label="Horário" value={`${workshop.startTime}${workshop.endTime ? `-${workshop.endTime}` : ""}`} />
              <Info label="Local" value={workshop.location} />
              <Info label="Kit incluído" value={workshop.kitIncluded ? "Sim" : "Não"} />
            </DetailsBlock>
            <DetailsBlock title="Vagas e inscrições">
              <Info label="Capacidade" value={String(workshop.capacity)} />
              <Info label="Inscrições ativas" value={String(workshop.activeParticipantsCount)} />
              <Info label="Vagas livres" value={String(workshop.availableSeats)} />
              <Info label="Total de participantes" value={String(workshop.participantsCount)} />
              <Info label="Participantes cancelados" value="Visíveis no painel, sem ocupar vaga." />
            </DetailsBlock>
            <DetailsBlock title="Pagamento e ações">
              <Info label="Preço" value={`${workshop.price.toFixed(2)} €`} />
              <Info label="Recebido" value={`${workshop.totalReceived.toFixed(2)} €`} />
              <Info label="Por receber" value={`${workshop.totalPending.toFixed(2)} €`} />
              <div className="mt-3 flex flex-wrap gap-2">
                <WorkshopModal
                  workshop={workshop}
                  trigger={
                    <Button variant="outline" size="sm" className="rounded-xl">
                      <Pencil className="h-4 w-4" />
                      Editar
                    </Button>
                  }
                />
                <WorkshopParticipantsPanel
                  workshop={workshop}
                  trigger={
                    <Button variant="outline" size="sm" className="rounded-xl">
                      <Users className="h-4 w-4" />
                      Participantes
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
                      <AlertDialogTitle>Apagar este workshop?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta ação remove o workshop e os participantes associados. Não pode ser anulada.
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
            <DetailsBlock title="Descrição">
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">{workshop.description || "Sem descrição."}</p>
            </DetailsBlock>
            <DetailsBlock title="Observações">
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">{workshop.notes || "Sem observações."}</p>
            </DetailsBlock>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StatusBadge({ status, ended }: { status: Workshop["status"]; ended: boolean }) {
  const labels = {
    draft: "Em preparação",
    open: "Inscrições abertas",
    full: "Lotado",
    completed: "Concluído",
    cancelled: "Cancelado",
  };
  const classes = {
    draft: "bg-slate-100 text-slate-800 hover:bg-slate-100",
    open: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
    full: "bg-amber-100 text-amber-800 hover:bg-amber-100",
    completed: "bg-violet-100 text-violet-800 hover:bg-violet-100",
    cancelled: "bg-rose-100 text-rose-800 hover:bg-rose-100",
  };
  const presentationStatus = ended && status !== "cancelled" ? "completed" : status;
  return <Badge className={`rounded-md ${classes[presentationStatus]}`}>{labels[presentationStatus]}</Badge>;
}

const PORTUGAL_TIME_ZONE = "Europe/Lisbon";

function compareWorkshops(a: Workshop, b: Workshop) {
  return getWorkshopStartKey(a).localeCompare(getWorkshopStartKey(b));
}

function hasWorkshopEnded(workshop: Workshop, now = getPortugalDateTimeKey()) {
  return getWorkshopEndKey(workshop) <= now;
}

function getWorkshopStartKey(workshop: Workshop) {
  return `${workshop.date}T${normalizeTime(workshop.startTime)}`;
}

function getWorkshopEndKey(workshop: Workshop) {
  return `${workshop.date}T${normalizeTime(workshop.endTime || workshop.startTime)}`;
}

function normalizeTime(time: string) {
  return time.slice(0, 5).padStart(5, "0");
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

function formatAvailableSeats(availableSeats: number) {
  if (availableSeats === 0) return "Sem vagas";
  return `${availableSeats} ${availableSeats === 1 ? "vaga" : "vagas"}`;
}

function getLinkedCalendarItemId() {
  return new URLSearchParams(window.location.search).get("open");
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
