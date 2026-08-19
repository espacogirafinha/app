import { differenceInDays, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, ChevronDown, GraduationCap, Loader2, Pencil, Trash2, Users } from "lucide-react";
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
import { WorkshopModal } from "@/components/workshop-modal";
import { WorkshopParticipantsPanel } from "@/components/workshop-participants-panel";
import { useToast } from "@/hooks/use-toast";
import { getListWorkshopsQueryKey, useDeleteWorkshop, useListWorkshops } from "@workspace/api-client-react";
import type { Workshop } from "@workspace/api-client-react";

export default function WorkshopsPage() {
  const { data: workshops, isLoading } = useListWorkshops();
  const linkedId = useMemo(getLinkedCalendarItemId, []);
  const [expandedId, setExpandedId] = useState<string | null>(linkedId);
  const deleteWorkshop = useDeleteWorkshop();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const rows = useMemo(
    () => [...(workshops ?? [])].sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`)),
    [workshops],
  );

  useEffect(() => {
    if (!linkedId || !workshops?.some((workshop) => workshop.id === linkedId)) return;
    const frame = requestAnimationFrame(() => document.getElementById("workshop-" + linkedId)?.scrollIntoView({ block: "center" }));
    return () => cancelAnimationFrame(frame);
  }, [linkedId, workshops]);

  const summary = useMemo(() => {
    const today = new Date();
    return rows.reduce(
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
  }, [rows]);

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
    <div className="space-y-4 md:space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-primary md:text-3xl">Workshops/Formações</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground md:text-base">
            Gestão de workshops, formações, inscrições e participantes.
          </p>
        </div>
        <WorkshopModal />
      </div>

      <section className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <SummaryCard label="Workshops agendados" value={String(summary.scheduled)} loading={isLoading} />
        <SummaryCard label="Inscrições" value={String(summary.registrations)} loading={isLoading} />
        <SummaryCard label="Por receber" value={`${summary.pending.toFixed(2)} €`} loading={isLoading} />
        <SummaryCard label="Vagas disponíveis" value={String(summary.availableSeats)} loading={isLoading} />
      </section>

      <Card className="overflow-hidden border-border/70 shadow-sm">
        <CardHeader className="border-b border-border/60 bg-card/70 pb-4">
          <CardTitle className="text-lg">Lista de workshops</CardTitle>
          <CardDescription>Módulo próprio da V2 ligado às novas entidades workshops e workshop_participants.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center p-12">
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
            <div className="flex flex-col items-center justify-center p-10 text-center text-muted-foreground">
              <GraduationCap className="mb-3 h-12 w-12 text-muted-foreground/30" />
              <p className="font-medium text-foreground">Ainda não há workshops registados.</p>
              <p className="mt-1 text-sm">Crie o primeiro workshop usando o botão “Novo Workshop”.</p>
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

  return (
    <div id={"workshop-" + workshop.id} className="scroll-mt-6 p-4 transition-colors hover:bg-muted/30">
      <div className="grid gap-3 lg:grid-cols-[88px_1fr_auto] lg:items-center">
        <div className="flex items-center justify-between rounded-xl bg-violet-50 px-3 py-2 text-violet-800 lg:flex-col lg:justify-center">
          <span className="text-xs font-semibold uppercase">{format(date, "MMM", { locale: ptBR })}</span>
          <span className="text-xl font-bold leading-none">{format(date, "dd")}</span>
        </div>

        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-bold text-foreground">{workshop.name}</h3>
            <StatusBadge status={workshop.status} />
            {workshop.kitIncluded && <Badge className="rounded-md bg-violet-100 text-violet-800 hover:bg-violet-100">Kit incluído</Badge>}
          </div>
          <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
            <span>{workshop.startTime}{workshop.endTime ? `-${workshop.endTime}` : ""}</span>
            <span>{workshop.location || "Espaço Girafinha"}</span>
            <span className="font-medium text-foreground">{workshop.price.toFixed(2)} € / participante</span>
          </div>
          <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{workshop.activeParticipantsCount}/{workshop.capacity} inscritos</span>
            <span>{workshop.availableSeats} vagas livres</span>
            <span>Recebido: {workshop.totalReceived.toFixed(2)} €</span>
          </div>
        </div>

        <div className="space-y-3 lg:min-w-[250px]">
          <div className="rounded-xl border border-border bg-background p-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Por receber</span>
              <span className={workshop.totalPending > 0 ? "font-bold text-rose-700" : "font-bold text-emerald-700"}>
                {workshop.totalPending.toFixed(2)} €
              </span>
            </div>
          </div>
          <div className="flex flex-wrap justify-start gap-2 lg:justify-end">
            <Button variant="outline" size="sm" onClick={onToggle} className="rounded-xl">
              <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
              Detalhes
            </Button>
            <WorkshopParticipantsPanel
              workshop={workshop}
              trigger={
                <Button variant="outline" size="sm" className="rounded-xl">
                  <Users className="h-4 w-4" />
                  Participantes
                </Button>
              }
            />
          </div>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 rounded-xl border border-border bg-muted/20 p-4">
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
                        Esta ação remove o workshop e, na base de dados, os participantes associados por cascade.
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
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: Workshop["status"] }) {
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
  return <Badge className={`rounded-md ${classes[status]}`}>{labels[status]}</Badge>;
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
