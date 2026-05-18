import { endOfMonth, format, parseISO, isToday, isTomorrow, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertTriangle,
  Calendar as CalendarIcon,
  CheckCircle2,
  Clock,
  Euro,
  Loader2,
  Plus,
  Search,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ChecklistButton, ChecklistProgressBar, useReservationTaskSummaries } from "@/components/checklist-button";
import { ReservationModal } from "@/components/reservation-modal";
import { StatusBadge, PaymentSummary } from "@/components/status-badge";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { useToast } from "@/hooks/use-toast";
import {
  getGetDashboardStatsQueryKey,
  getGetUpcomingReservationsQueryKey,
  getListReservationsQueryKey,
  useGetDashboardStats,
  useGetUpcomingReservations,
  useUpdateReservation,
} from "@workspace/api-client-react";
import type { Reservation, TaskSummary } from "@workspace/api-client-react";

type QuickFilter = "all" | "today" | "week" | "pending" | "workshops" | "external";

const QUICK_FILTERS: Array<{ value: QuickFilter; label: string }> = [
  { value: "all", label: "Todas" },
  { value: "today", label: "Hoje" },
  { value: "week", label: "7 dias" },
  { value: "pending", label: "Pendentes" },
  { value: "workshops", label: "Workshops" },
  { value: "external", label: "Serviços externos" },
];

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: upcoming, isLoading: upcomingLoading } = useGetUpcomingReservations();
  const [searchTerm, setSearchTerm] = useState("");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");

  const taskSummaries = useReservationTaskSummaries(upcoming?.map((r) => r.id) ?? []);

  const todayReservations = useMemo(
    () => upcoming?.filter((reservation) => isToday(parseISO(reservation.eventDate))) ?? [],
    [upcoming],
  );

  const nextSevenDays = useMemo(
    () => upcoming?.filter((reservation) => {
      const daysUntil = differenceInDays(parseISO(reservation.eventDate), new Date());
      return daysUntil >= 0 && daysUntil <= 7;
    }) ?? [],
    [upcoming],
  );

  const restOfMonth = useMemo(() => {
    const today = new Date();
    const monthEnd = format(endOfMonth(today), "yyyy-MM-dd");
    return (upcoming ?? []).filter((reservation) => {
      const daysUntil = differenceInDays(parseISO(reservation.eventDate), today);
      return daysUntil > 7 && reservation.eventDate <= monthEnd;
    });
  }, [upcoming]);

  const workshopsUpcoming = useMemo(
    () => (upcoming ?? []).filter((reservation) => reservation.serviceType === "Workshops"),
    [upcoming],
  );

  const pendingPaymentSoon = useMemo(
    () => nextSevenDays.filter((reservation) => reservation.paymentStatus !== "paid"),
    [nextSevenDays],
  );

  const incompleteTasksSoon = useMemo(
    () => nextSevenDays.filter((reservation) => {
      const summary = taskSummaries.get(reservation.id);
      return summary && summary.total > 0 && summary.completed < summary.total;
    }),
    [nextSevenDays, taskSummaries],
  );

  const filteredUpcoming = useMemo(
    () => (upcoming ?? [])
      .filter((reservation) => matchesQuickFilter(reservation, quickFilter))
      .filter((reservation) => {
        const search = searchTerm.trim().toLowerCase();
        if (!search) return true;
        return reservation.customerName.toLowerCase().includes(search) || reservation.phone.includes(search);
      }),
    [quickFilter, searchTerm, upcoming],
  );

  const nextReservation = upcoming?.[0];
  const pendingSoonTotal = pendingPaymentSoon.reduce((sum, reservation) => sum + reservation.remainingBalance, 0);

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-primary">Painel de gestão</h1>
          <p className="mt-1 text-sm md:text-base text-muted-foreground">
            Prioridades, pagamentos e próximas reservas num só sítio.
          </p>
        </div>
        <ReservationModal
          trigger={
            <Button className="min-h-[44px] rounded-full bg-primary px-5 text-primary-foreground shadow-md hover:bg-primary/90">
              <Plus className="h-4 w-4" />
              Nova Reserva
            </Button>
          }
        />
      </div>

      <section className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
        <TodayPanel todayReservations={todayReservations} nextReservation={nextReservation} loading={upcomingLoading} />
        <ActionPanel
          pendingPaymentSoon={pendingPaymentSoon}
          incompleteTasksSoon={incompleteTasksSoon}
          pendingSoonTotal={pendingSoonTotal}
        />
      </section>

      <section className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Hoje" value={todayReservations.length.toString()} helper="Eventos marcados" loading={upcomingLoading} />
        <MetricCard title="Próximos 7 dias" value={nextSevenDays.length.toString()} helper="Reservas e serviços" loading={upcomingLoading} />
        <MetricCard
          title="Por receber"
          value={`€${stats?.totalPending.toFixed(2) || "0.00"}`}
          helper="Total pendente"
          loading={statsLoading}
          tone="danger"
        />
        <MetricCard
          title="Recebido"
          value={`€${stats?.totalPaid.toFixed(2) || "0.00"}`}
          helper="Pagamentos registados"
          loading={statsLoading}
          tone="success"
        />
      </section>

      <PreparationPanel
        nextSevenDays={nextSevenDays}
        restOfMonth={restOfMonth}
        workshops={workshopsUpcoming}
        taskSummaries={taskSummaries}
      />

      <section className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card className="overflow-hidden border-border/70 shadow-sm">
          <CardHeader className="border-b border-border/60 bg-card/70 pb-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <CardTitle className="text-lg md:text-xl">Agenda operacional</CardTitle>
                <CardDescription>Reservas, workshops e serviços por ordem de data.</CardDescription>
              </div>
              <div className="relative w-full md:w-72">
                <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Pesquisar cliente ou telemóvel..."
                  className="min-h-[44px] rounded-full bg-background pl-9"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-2 overflow-x-auto pt-3">
              {QUICK_FILTERS.map((filter) => (
                <Button
                  key={filter.value}
                  type="button"
                  variant={quickFilter === filter.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setQuickFilter(filter.value)}
                  className="rounded-full whitespace-nowrap"
                >
                  {filter.label}
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {upcomingLoading ? (
              <div className="flex justify-center p-10">
                <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
              </div>
            ) : filteredUpcoming.length > 0 ? (
              <div className="divide-y divide-border/60">
                {filteredUpcoming.map((reservation) => (
                  <UpcomingReservationRow
                    key={reservation.id}
                    reservation={reservation}
                    taskSummary={taskSummaries.get(reservation.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center p-10 text-center text-muted-foreground">
                <CalendarIcon className="mb-3 h-12 w-12 text-muted-foreground/30" />
                <p>Nenhuma reserva encontrada.</p>
                <p className="mt-1 text-sm">Ajuste os filtros ou crie uma nova reserva.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <SideSummary stats={stats} loading={statsLoading} />
      </section>
    </div>
  );
}

function matchesQuickFilter(reservation: Reservation, quickFilter: QuickFilter) {
  const eventDate = parseISO(reservation.eventDate);
  const daysUntil = differenceInDays(eventDate, new Date());
  if (quickFilter === "today") return isToday(eventDate);
  if (quickFilter === "week") return daysUntil >= 0 && daysUntil <= 7;
  if (quickFilter === "pending") return reservation.paymentStatus !== "paid";
  if (quickFilter === "workshops") return reservation.serviceType === "Workshops";
  if (quickFilter === "external") return reservation.serviceType === "Serviços externos";
  return true;
}

function TodayPanel({
  todayReservations,
  nextReservation,
  loading,
}: {
  todayReservations: Reservation[];
  nextReservation?: Reservation;
  loading: boolean;
}) {
  return (
    <Card className="border-primary/20 bg-primary/5 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarIcon className="h-5 w-5 text-primary" />
          Hoje
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Loader2 className="h-6 w-6 animate-spin text-primary/60" />
        ) : todayReservations.length > 0 ? (
          <div className="space-y-2">
            {todayReservations.map((reservation) => (
              <div key={reservation.id} className="rounded-lg border border-primary/20 bg-background p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{reservation.customerName}</p>
                    <p className="text-sm text-muted-foreground">{reservation.eventTime} · {reservation.pack}</p>
                  </div>
                  <StatusBadge status={reservation.paymentStatus} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div>
            <p className="text-lg font-bold">Sem eventos hoje</p>
            <p className="text-sm text-muted-foreground">
              {nextReservation
                ? `Próxima reserva: ${format(parseISO(nextReservation.eventDate), "dd MMM", { locale: ptBR })}, ${nextReservation.customerName}.`
                : "Não há reservas futuras registadas."}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ActionPanel({
  pendingPaymentSoon,
  incompleteTasksSoon,
  pendingSoonTotal,
}: {
  pendingPaymentSoon: Reservation[];
  incompleteTasksSoon: Reservation[];
  pendingSoonTotal: number;
}) {
  const hasActions = pendingPaymentSoon.length > 0 || incompleteTasksSoon.length > 0;

  return (
    <Card className={hasActions ? "border-amber-300 bg-amber-50 shadow-sm" : "border-emerald-200 bg-emerald-50 shadow-sm"}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          {hasActions ? (
            <AlertTriangle className="h-5 w-5 text-amber-600" />
          ) : (
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          )}
          Ações prioritárias
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {hasActions ? (
          <>
            <ActionLine label="Pagamentos por cobrar" count={pendingPaymentSoon.length} detail={`€${pendingSoonTotal.toFixed(2)}`} />
            <ActionLine label="Checklists incompletas" count={incompleteTasksSoon.length} detail="Próximos 7 dias" />
            <p className="text-xs text-amber-800">
              Use os botões na agenda para enviar lembretes, marcar pagamentos e abrir checklists.
            </p>
          </>
        ) : (
          <p className="text-sm text-emerald-800">Nada urgente nos próximos 7 dias.</p>
        )}
      </CardContent>
    </Card>
  );
}

function ActionLine({ label, count, detail }: { label: string; count: number; detail: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-background/80 p-3">
      <div>
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </div>
      <span className="text-xl font-bold">{count}</span>
    </div>
  );
}

function MetricCard({
  title,
  value,
  helper,
  loading,
  tone,
}: {
  title: string;
  value: string;
  helper: string;
  loading?: boolean;
  tone?: "success" | "danger";
}) {
  const toneClass = tone === "success" ? "text-emerald-700" : tone === "danger" ? "text-rose-700" : "";
  return (
    <Card className="border-border/70 shadow-sm">
      <CardContent className="p-4">
        <p className="text-xs font-medium text-muted-foreground">{title}</p>
        {loading ? (
          <Loader2 className="mt-2 h-5 w-5 animate-spin text-muted-foreground" />
        ) : (
          <p className={`mt-1 text-2xl font-bold ${toneClass}`}>{value}</p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">{helper}</p>
      </CardContent>
    </Card>
  );
}

function SideSummary({
  stats,
  loading,
}: {
  stats?: {
    totalReservations: number;
    paidCount: number;
    partialCount: number;
    unpaidCount: number;
    totalRevenue: number;
  };
  loading: boolean;
}) {
  return (
    <Card className="h-fit border-border/70 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Resumo rápido</CardTitle>
        <CardDescription>Estado geral das reservas.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        ) : (
          <>
            <StatusCountPill label="Total" count={stats?.totalReservations || 0} color="bg-muted text-foreground" />
            <StatusCountPill label="Pagas" count={stats?.paidCount || 0} color="bg-emerald-100 text-emerald-800" />
            <StatusCountPill label="Com sinal" count={stats?.partialCount || 0} color="bg-amber-100 text-amber-800" />
            <StatusCountPill label="Pendentes" count={stats?.unpaidCount || 0} color="bg-rose-100 text-rose-800" />
            <div className="rounded-lg border border-border bg-background p-3">
              <p className="text-xs text-muted-foreground">Receita total</p>
              <p className="mt-1 text-lg font-bold">€{stats?.totalRevenue.toFixed(2) || "0.00"}</p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function StatusCountPill({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm font-medium ${color}`}>
      <span>{label}</span>
      <span className="font-bold">{count}</span>
    </div>
  );
}

function PreparationPanel({
  nextSevenDays,
  restOfMonth,
  workshops,
  taskSummaries,
}: {
  nextSevenDays: Reservation[];
  restOfMonth: Reservation[];
  workshops: Reservation[];
  taskSummaries: Map<number, TaskSummary>;
}) {
  const incompleteThisWeek = nextSevenDays.filter((reservation) => {
    const summary = taskSummaries.get(reservation.id);
    return !summary || summary.total === 0 || summary.completed < summary.total;
  });

  return (
    <section className="grid gap-4 xl:grid-cols-3">
      <PreparationCard
        title="Preparar esta semana"
        description="Reservas que precisam de atenção nos próximos 7 dias."
        rows={incompleteThisWeek}
        taskSummaries={taskSummaries}
        empty="Nada pendente para preparar esta semana."
      />
      <PreparationCard
        title="Resto do mês"
        description="Próximas reservas depois desta semana."
        rows={restOfMonth}
        taskSummaries={taskSummaries}
        empty="Sem reservas no resto do mês."
      />
      <PreparationCard
        title="Workshops"
        description="Produto separado das festas e serviços externos."
        rows={workshops}
        taskSummaries={taskSummaries}
        empty="Sem workshops agendados."
      />
    </section>
  );
}

function PreparationCard({
  title,
  description,
  rows,
  taskSummaries,
  empty,
}: {
  title: string;
  description: string;
  rows: Reservation[];
  taskSummaries: Map<number, TaskSummary>;
  empty: string;
}) {
  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">{empty}</div>
        ) : (
          rows.slice(0, 4).map((reservation) => {
            const summary = taskSummaries.get(reservation.id);
            return (
              <div key={reservation.id} className="rounded-lg border border-border bg-background p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{reservation.customerName}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(parseISO(reservation.eventDate), "dd MMM", { locale: ptBR })} · {reservation.pack}
                    </p>
                  </div>
                  <OperationalStatus reservation={reservation} summary={summary} />
                </div>
                <div className="mt-2">
                  <ChecklistProgressBar summary={summary} />
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

function OperationalStatus({ reservation, summary }: { reservation: Reservation; summary?: TaskSummary }) {
  if (reservation.paymentStatus === "unpaid") {
    return <Badge className="rounded-md bg-rose-100 text-rose-800 hover:bg-rose-100">Sinal por pagar</Badge>;
  }
  if (summary && summary.total > 0 && summary.completed === summary.total) {
    return <Badge className="rounded-md bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Pronta</Badge>;
  }
  if (summary && summary.total > 0) {
    return <Badge className="rounded-md bg-amber-100 text-amber-800 hover:bg-amber-100">Em preparação</Badge>;
  }
  return <Badge variant="outline" className="rounded-md">Confirmada</Badge>;
}

function UpcomingReservationRow({
  reservation,
  taskSummary,
}: {
  reservation: Reservation;
  taskSummary?: TaskSummary;
}) {
  const date = parseISO(reservation.eventDate);
  const queryClient = useQueryClient();
  const updateReservation = useUpdateReservation();
  const { toast } = useToast();

  let dateDisplay = format(date, "dd MMM", { locale: ptBR });
  if (isToday(date)) dateDisplay = "Hoje";
  else if (isTomorrow(date)) dateDisplay = "Amanhã";

  const daysUntil = differenceInDays(date, new Date());
  const isUrgent = daysUntil <= 3 && daysUntil >= 0 && reservation.paymentStatus !== "paid";

  const handleMarkPaid = (event: React.MouseEvent) => {
    event.stopPropagation();
    updateReservation.mutate(
      { id: reservation.id, data: { amountPaid: reservation.totalPrice } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetUpcomingReservationsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListReservationsQueryKey() });
          queryClient.invalidateQueries({ queryKey: ["/api/dashboard/calendar"] });
          toast({ title: "Pagamento registado", description: `${reservation.customerName} marcado como pago.` });
        },
      },
    );
  };

  const handleMessageSent = (messageType: "reservation" | "depositRequest" | "depositConfirmation" | "postEvent") => {
    const labels = {
      reservation: "confirmação da reserva",
      depositRequest: "pedido de sinal",
      depositConfirmation: "confirmação do sinal",
      postEvent: "mensagem pós-festa",
    };
    const note = `[${format(new Date(), "yyyy-MM-dd HH:mm")}] WhatsApp enviado: ${labels[messageType]}.`;
    const notes = reservation.notes ? `${reservation.notes}\n${note}` : note;

    updateReservation.mutate(
      { id: reservation.id, data: { notes } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetUpcomingReservationsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListReservationsQueryKey() });
          toast({ title: "Mensagem registada", description: `Nota adicionada em ${reservation.customerName}.` });
        },
      },
    );
  };

  return (
    <div className={`p-4 transition-colors hover:bg-muted/30 ${isUrgent ? "border-l-4 border-l-amber-400 bg-amber-50/50" : ""}`}>
      <div className="grid gap-3 lg:grid-cols-[72px_1fr_auto] lg:items-center">
        <div className="flex lg:flex-col items-center justify-between lg:justify-center rounded-xl bg-primary/10 px-3 py-2 text-primary">
          <span className="text-xs font-semibold uppercase">{format(date, "MMM", { locale: ptBR })}</span>
          <span className="text-xl font-bold leading-none">{format(date, "dd")}</span>
        </div>

        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-bold text-base">{reservation.customerName}</h3>
            <StatusBadge status={reservation.paymentStatus} />
            <Badge variant="outline" className="rounded-md">{reservation.serviceType}</Badge>
          </div>
          <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{dateDisplay}, {reservation.eventTime}</span>
            <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{reservation.numChildren}</span>
            <span className="truncate">{reservation.pack}</span>
          </div>
          {taskSummary && taskSummary.total > 0 && (
            <div className="max-w-sm">
              <ChecklistProgressBar summary={taskSummary} />
            </div>
          )}
        </div>

        <div className="space-y-3 lg:min-w-[210px]">
          <PaymentSummary
            totalPrice={reservation.totalPrice}
            amountPaid={reservation.amountPaid}
            remainingBalance={reservation.remainingBalance}
            compact
          />
          <div className="flex flex-wrap gap-2">
            <WhatsAppButton
              phone={reservation.phone}
              customerName={reservation.customerName}
              eventDate={dateDisplay}
              eventTime={reservation.eventTime}
              pack={reservation.pack}
              serviceType={reservation.serviceType}
              extras={reservation.extras}
              totalPrice={reservation.totalPrice}
              amountPaid={reservation.amountPaid}
              remainingBalance={reservation.remainingBalance}
              messageType="reservation"
              label="Confirmação"
              onSent={handleMessageSent}
            />
            {reservation.paymentStatus === "unpaid" && (
              <WhatsAppButton
                phone={reservation.phone}
                customerName={reservation.customerName}
                eventDate={dateDisplay}
                eventTime={reservation.eventTime}
                pack={reservation.pack}
                serviceType={reservation.serviceType}
                extras={reservation.extras}
                totalPrice={reservation.totalPrice}
                amountPaid={reservation.amountPaid}
                remainingBalance={reservation.remainingBalance}
                variant="reminder"
                messageType="depositRequest"
                label="Sinal"
                onSent={handleMessageSent}
              />
            )}
            {reservation.paymentStatus === "partial" && (
              <WhatsAppButton
                phone={reservation.phone}
                customerName={reservation.customerName}
                eventDate={dateDisplay}
                eventTime={reservation.eventTime}
                pack={reservation.pack}
                serviceType={reservation.serviceType}
                extras={reservation.extras}
                totalPrice={reservation.totalPrice}
                amountPaid={reservation.amountPaid}
                remainingBalance={reservation.remainingBalance}
                messageType="depositConfirmation"
                label="Sinal OK"
                onSent={handleMessageSent}
              />
            )}
            {differenceInDays(new Date(), date) >= 0 && (
              <WhatsAppButton
                phone={reservation.phone}
                customerName={reservation.customerName}
                eventDate={dateDisplay}
                eventTime={reservation.eventTime}
                serviceType={reservation.serviceType}
                messageType="postEvent"
                label="Pós-festa"
                onSent={handleMessageSent}
              />
            )}
            {reservation.paymentStatus !== "paid" && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleMarkPaid}
                disabled={updateReservation.isPending}
                className="min-h-[40px] rounded-xl border-emerald-200 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
              >
                <CheckCircle2 className="h-4 w-4" />
                Pago
              </Button>
            )}
            <ChecklistButton reservation={reservation} summary={taskSummary} variant="compact" />
            <ReservationModal
              reservation={reservation}
              trigger={
                <Button variant="outline" size="sm" className="min-h-[40px] rounded-xl">
                  Detalhes
                </Button>
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}
