import { useMemo, useState } from "react";
import { addDays, addMonths, endOfMonth, format, parseISO, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  FileDown,
  Loader2,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  Users,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Card, CardContent } from "@/components/ui/card";
import { ChecklistButton, ChecklistProgressBar, useReservationTaskSummaries } from "@/components/checklist-button";
import { ReservationModal } from "@/components/reservation-modal";
import { StatusBadge } from "@/components/status-badge";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  getGetDashboardStatsQueryKey,
  getGetUpcomingReservationsQueryKey,
  getListReservationsQueryKey,
  useDeleteReservation,
  useListReservations,
  useUpdateReservation,
} from "@workspace/api-client-react";
import type { ListReservationsStatus, Reservation, TaskSummary } from "@workspace/api-client-react";

type TypeFilter = "all" | "venue_party" | "external_service" | "workshop";
type ReservationStatusFilter = "all" | "draft" | "confirmed" | "completed" | "cancelled";
type DateFilter = "all" | "week" | "month" | "nextMonth";
type SortKey = "eventDate" | "customerName" | "remainingBalance" | "paymentStatus";
type SortDirection = "asc" | "desc";

const TYPE_FILTERS: Array<{ value: TypeFilter; label: string }> = [
  { value: "all", label: "Todas" },
  { value: "venue_party", label: "Festas no espaço" },
  { value: "external_service", label: "Serviços no exterior" },
  { value: "workshop", label: "Workshops/Formações" },
];

export default function Reservations() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<ListReservationsStatus | "all">("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [reservationStatusFilter, setReservationStatusFilter] = useState<ReservationStatusFilter>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("eventDate");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const isMobile = useIsMobile();

  const queryParams = {
    ...(searchTerm ? { search: searchTerm } : {}),
    ...(statusFilter !== "all" ? { status: statusFilter } : {}),
  };

  const { data: reservations, isLoading } = useListReservations(queryParams);
  const deleteReservation = useDeleteReservation();
  const updateReservation = useUpdateReservation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const visibleReservations = useMemo(() => {
    return [...(reservations ?? [])]
      .filter((reservation) => matchesTypeFilter(reservation, typeFilter))
      .filter((reservation) => matchesReservationStatusFilter(reservation, reservationStatusFilter))
      .filter((reservation) => matchesDateFilter(reservation, dateFilter))
      .sort((a, b) => compareReservations(a, b, sortKey, sortDirection));
  }, [dateFilter, reservations, reservationStatusFilter, sortDirection, sortKey, typeFilter]);

  const taskSummaries = useReservationTaskSummaries(visibleReservations.map((r) => r.id));

  const summary = useMemo(() => {
    return (reservations ?? []).reduce(
      (acc, reservation) => {
        const type = getReservationType(reservation);
        if (type === "venue_party") acc.venueParty += 1;
        if (type === "external_service") acc.externalService += 1;
        if (type === "workshop") acc.workshop += 1;
        acc.pending += reservation.remainingBalance;
        return acc;
      },
      { venueParty: 0, externalService: 0, workshop: 0, pending: 0 },
    );
  }, [reservations]);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: getListReservationsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetUpcomingReservationsQueryKey() });
    queryClient.invalidateQueries({ queryKey: ["/api/dashboard/calendar"] });
  };

  const exportRows = (rows: Reservation[], label = "reservas_girafinha") => {
    if (rows.length === 0) return;
    const headers = [
      "ID", "Cliente", "Telemóvel", "Data", "Hora", "Tipo", "Pack",
      "Nº Crianças", "Idades", "Extras", "Preço Total", "Valor Pago",
      "Valor Pendente", "Cobrança Necessária", "Estado Pagamento", "Notas",
    ].join(",");

    const csvRows = rows.map((r) => [
      r.id,
      csv(r.customerName),
      r.phone,
      r.eventDate,
      r.eventTime,
      csv(r.serviceType),
      csv(r.pack),
      r.numChildren,
      csv(r.childrenAges),
      csv(r.extras || ""),
      r.totalPrice,
      r.amountPaid,
      r.remainingBalance,
      r.remainingBalance > 0 ? "Sim" : "Não",
      r.paymentStatus,
      csv(r.notes || ""),
    ].join(","));

    const csvContent = [headers, ...csvRows].join("\n");
    const blob = new Blob(["\ufeff", csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${label}_${format(new Date(), "yyyy-MM-dd")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDelete = (id: number) => {
    deleteReservation.mutate({ id }, {
      onSuccess: () => {
        invalidateAll();
        toast({ title: "Reserva eliminada" });
      },
    });
  };

  const handleMarkPaid = (reservation: Reservation) => {
    updateReservation.mutate(
      { id: reservation.id, data: { amountPaid: reservation.totalPrice } },
      {
        onSuccess: () => {
          invalidateAll();
          toast({ title: "Pagamento registado", description: `${reservation.customerName} marcado como pago.` });
        },
      },
    );
  };

  const updateSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((direction) => direction === "asc" ? "desc" : "asc");
      return;
    }
    setSortKey(key);
    setSortDirection(key === "remainingBalance" ? "desc" : "asc");
  };

  return (
    <div className="space-y-3 md:space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-primary">Reservas</h1>
          <p className="text-muted-foreground mt-0.5 text-sm md:mt-1 md:text-base">
            Gestão operacional de festas, serviços externos e workshops.
          </p>
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto md:gap-3">
          <Button variant="outline" onClick={() => exportRows(visibleReservations)} disabled={!visibleReservations.length} className="min-h-[40px] flex-1 rounded-xl sm:flex-none md:min-h-[44px]">
            <FileDown className="h-4 w-4 mr-2" />
            Exportar filtradas
          </Button>
          <ReservationModal
            trigger={
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 rounded-full px-4 md:px-6 shadow-md hover:shadow-lg transition-all min-h-[40px] md:min-h-[44px]">
                <Plus className="h-4 w-4" />
                Nova Reserva
              </Button>
            }
          />
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {TYPE_FILTERS.map((filter) => (
          <Button
            key={filter.value}
            type="button"
            variant={typeFilter === filter.value ? "default" : "outline"}
            onClick={() => setTypeFilter(filter.value)}
            className="min-h-[42px] justify-between rounded-xl px-3 text-sm md:min-h-[48px] md:px-4"
          >
            <span>{filter.label}</span>
            <Badge variant={typeFilter === filter.value ? "secondary" : "outline"} className="rounded-full">
              {filter.value === "all" ? reservations?.length ?? 0 : getTypeCount(summary, filter.value)}
            </Badge>
          </Button>
        ))}
      </div>

      <div className="grid gap-2 grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Festas no espaço" value={summary.venueParty.toString()} />
        <SummaryCard label="Serviços no exterior" value={summary.externalService.toString()} />
        <SummaryCard label="Workshops" value={summary.workshop.toString()} />
        <SummaryCard label="Por receber" value={`€${summary.pending.toFixed(2)}`} tone="danger" />
      </div>

      <div className="space-y-3 bg-card p-3 md:p-4 rounded-xl shadow-sm border border-border">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar por nome ou telemóvel..."
              className="pl-9 min-h-[44px]"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowMobileFilters((value) => !value)}
            className="min-h-[44px] rounded-xl md:hidden"
            aria-expanded={showMobileFilters}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filtros
          </Button>
        </div>

        <div className={`${isMobile && !showMobileFilters ? "hidden" : "grid"} gap-3 md:grid md:grid-cols-[180px_190px_190px_190px]`}>
          <Select value={dateFilter} onValueChange={(val) => setDateFilter(val as DateFilter)}>
            <SelectTrigger className="min-h-[44px]">
              <SelectValue placeholder="Data" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as datas</SelectItem>
              <SelectItem value="week">Esta semana</SelectItem>
              <SelectItem value="month">Este mês</SelectItem>
              <SelectItem value="nextMonth">Mês seguinte</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val as ListReservationsStatus | "all")}>
            <SelectTrigger className="min-h-[44px]">
              <SelectValue placeholder="Pagamento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os pagamentos</SelectItem>
              <SelectItem value="paid">Pago</SelectItem>
              <SelectItem value="partial">Sinal</SelectItem>
              <SelectItem value="unpaid">Pendente</SelectItem>
            </SelectContent>
          </Select>

          <Select value={reservationStatusFilter} onValueChange={(val) => setReservationStatusFilter(val as ReservationStatusFilter)}>
            <SelectTrigger className="min-h-[44px]">
              <SelectValue placeholder="Estado da reserva" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os estados</SelectItem>
              <SelectItem value="draft">Em preparação</SelectItem>
              <SelectItem value="confirmed">Confirmada</SelectItem>
              <SelectItem value="completed">Concluída</SelectItem>
              <SelectItem value="cancelled">Cancelada</SelectItem>
            </SelectContent>
          </Select>

          <Select value={`${sortKey}:${sortDirection}`} onValueChange={(value) => {
            const [key, direction] = value.split(":") as [SortKey, SortDirection];
            setSortKey(key);
            setSortDirection(direction);
          }}>
            <SelectTrigger className="min-h-[44px]">
              <SelectValue placeholder="Ordenação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="eventDate:asc">Data crescente</SelectItem>
              <SelectItem value="eventDate:desc">Data decrescente</SelectItem>
              <SelectItem value="customerName:asc">Cliente A-Z</SelectItem>
              <SelectItem value="remainingBalance:desc">Maior dívida</SelectItem>
              <SelectItem value="paymentStatus:asc">Estado pagamento</SelectItem>
            </SelectContent>
          </Select>
        </div>

      </div>

      {isLoading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
        </div>
      ) : visibleReservations.length === 0 ? (
        <div className="bg-card rounded-xl shadow-sm border border-border p-12 text-center text-muted-foreground">
          <p>Nenhuma reserva encontrada.</p>
        </div>
      ) : isMobile ? (
        <div className="space-y-3">
          {visibleReservations.map((reservation) => (
            <MobileReservationCard
              key={reservation.id}
              reservation={reservation}
              onDelete={handleDelete}
              onMarkPaid={handleMarkPaid}
              taskSummary={taskSummaries.get(reservation.id)}
            />
          ))}
        </div>
      ) : (
        <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <SortableHead label="Data / Hora" active={sortKey === "eventDate"} direction={sortDirection} onClick={() => updateSort("eventDate")} />
                  <SortableHead label="Cliente" active={sortKey === "customerName"} direction={sortDirection} onClick={() => updateSort("customerName")} />
                  <TableHead className="py-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Reserva</TableHead>
                  <TableHead className="py-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Próxima ação</TableHead>
                  <TableHead className="py-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Checklist</TableHead>
                  <SortableHead label="Pagamento" active={sortKey === "remainingBalance"} direction={sortDirection} onClick={() => updateSort("remainingBalance")} align="right" />
                  <TableHead className="py-3 text-center text-xs font-bold uppercase tracking-wide text-muted-foreground">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleReservations.map((reservation) => (
                  <ReservationTableRows
                    key={reservation.id}
                    reservation={reservation}
                    taskSummary={taskSummaries.get(reservation.id)}
                    expanded={expandedId === reservation.id}
                    onToggleExpanded={() => setExpandedId(expandedId === reservation.id ? null : reservation.id)}
                    onMarkPaid={handleMarkPaid}
                    onDelete={handleDelete}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}

function ReservationTableRows({
  reservation,
  taskSummary,
  expanded,
  onToggleExpanded,
  onMarkPaid,
  onDelete,
}: {
  reservation: Reservation;
  taskSummary?: TaskSummary;
  expanded: boolean;
  onToggleExpanded: () => void;
  onMarkPaid: (reservation: Reservation) => void;
  onDelete: (id: number) => void;
}) {
  const nextAction = getNextAction(reservation, taskSummary);
  return (
    <>
      <TableRow className="hover:bg-muted/30">
        <TableCell className="py-4 whitespace-nowrap align-top">
          <div className="font-medium text-foreground">
            {format(parseISO(reservation.eventDate), "dd MMM yyyy", { locale: ptBR })}
          </div>
          <div className="text-xs text-muted-foreground">{reservation.eventTime}</div>
        </TableCell>
        <TableCell className="py-4 align-top">
          <div className="font-bold text-foreground">{reservation.customerName}</div>
          <div className="text-xs text-muted-foreground">{reservation.phone}</div>
          <div className="mt-1">
            <ReservationStatusBadge status={reservation.reservationStatus} />
          </div>
        </TableCell>
        <TableCell className="py-4 max-w-[260px] align-top">
          <ReservationKindBadge reservation={reservation} />
          <p className="mt-1 text-sm font-semibold text-foreground">{getReservationTitle(reservation)}</p>
          <p className="text-xs text-muted-foreground">{getReservationSubtitle(reservation)}</p>
        </TableCell>
        <TableCell className="py-4 align-top">
          <NextActionBadge action={nextAction} />
        </TableCell>
        <TableCell className="py-4 min-w-[150px] align-top">
          <ChecklistProgressBar summary={taskSummary} />
        </TableCell>
        <TableCell className="py-4 text-right whitespace-nowrap align-top">
          <StatusBadge status={reservation.paymentStatus} />
          <div className="mt-1">
            <PaymentBreakdown
              totalPrice={reservation.totalPrice}
              amountPaid={reservation.amountPaid}
              remainingBalance={reservation.remainingBalance}
            />
          </div>
        </TableCell>
        <TableCell className="py-4 align-top">
          <div className="flex items-center justify-center gap-2">
            <WhatsAppButton
              phone={reservation.phone}
              customerName={reservation.customerName}
              eventDate={format(parseISO(reservation.eventDate), "dd/MM", { locale: ptBR })}
              eventTime={reservation.eventTime}
              pack={reservation.pack}
              serviceType={reservation.serviceType}
              extras={reservation.extras}
              totalPrice={reservation.totalPrice}
              amountPaid={reservation.amountPaid}
              remainingBalance={reservation.remainingBalance}
            />
            <Button variant="outline" size="sm" onClick={onToggleExpanded} className="min-h-[38px] rounded-xl px-3">
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              Detalhes
            </Button>
          </div>
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow className="bg-muted/15">
          <TableCell colSpan={7} className="p-4">
            <div className="grid gap-3 rounded-xl border border-border/70 bg-background/80 p-3 shadow-sm md:grid-cols-4 md:p-4">
              <DetailBlock title="Informação da reserva" value={getReservationDetailsText(reservation)} />
              <DetailBlock title="Extras" value={reservation.extras || "Sem extras registados"} />
              <DetailBlock title="Notas" value={reservation.notes || "Sem notas internas"} />
              <div className="rounded-lg border border-border bg-card p-3">
                <p className="mb-3 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Ações rápidas</p>
                <div className="flex flex-wrap items-center gap-2">
                  <ChecklistButton reservation={reservation} summary={taskSummary} variant="compact" />
                  {reservation.paymentStatus !== "paid" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onMarkPaid(reservation)}
                      className="min-h-[36px] text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 border-emerald-200 gap-1 rounded-xl"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Pago
                    </Button>
                  )}
                  <ReservationModal
                    reservation={reservation}
                    trigger={
                      <Button variant="outline" size="sm" className="min-h-[36px] gap-1 rounded-xl">
                        <Pencil className="h-3.5 w-3.5" />
                        Editar
                      </Button>
                    }
                  />
                  <DeleteReservationButton reservation={reservation} onDelete={onDelete} compact />
                </div>
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function DeleteReservationButton({
  reservation,
  onDelete,
  compact = false,
}: {
  reservation: Reservation;
  onDelete: (id: number) => void;
  compact?: boolean;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" className={`${compact ? "min-h-[36px]" : "min-h-[44px]"} text-destructive hover:bg-destructive/10 border-destructive/30 gap-1 rounded-xl`}>
          <Trash2 className="h-3.5 w-3.5" />
          Apagar
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Tem a certeza?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta ação não pode ser desfeita. Irá eliminar permanentemente a reserva de {reservation.customerName}.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={() => onDelete(reservation.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            Eliminar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function MobileReservationCard({
  reservation,
  onDelete,
  onMarkPaid,
  taskSummary,
}: {
  reservation: Reservation;
  onDelete: (id: number) => void;
  onMarkPaid: (reservation: Reservation) => void;
  taskSummary?: TaskSummary;
}) {
  const [expanded, setExpanded] = useState(false);
  const date = parseISO(reservation.eventDate);
  const dateDisplay = format(date, "dd 'de' MMM", { locale: ptBR });
  const nextAction = getNextAction(reservation, taskSummary);

  return (
    <Card className={`shadow-sm overflow-hidden border ${
      reservation.paymentStatus === "paid" ? "border-emerald-200" :
      reservation.paymentStatus === "partial" ? "border-amber-200" :
      "border-rose-200"
    }`}>
      <CardContent className="p-3.5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-bold text-lg truncate">{reservation.customerName}</h3>
              <StatusBadge status={reservation.paymentStatus} />
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {dateDisplay}, {reservation.eventTime}
              </span>
              <span className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                {getParticipantCount(reservation)}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <ReservationKindBadge reservation={reservation} />
              <ReservationStatusBadge status={reservation.reservationStatus} />
              <NextActionBadge action={nextAction} />
            </div>
          </div>
        </div>

        <div className="text-sm">
          <div className="min-w-0">
            <p className="font-semibold truncate">{getReservationTitle(reservation)}</p>
            <p className="text-xs text-muted-foreground truncate">{getReservationSubtitle(reservation)}</p>
          </div>
        </div>

        <div className={`p-2.5 rounded-lg ${
          reservation.paymentStatus === "paid" ? "bg-emerald-50" :
          reservation.paymentStatus === "partial" ? "bg-amber-50" :
          "bg-rose-50"
        }`}>
          <PaymentBreakdown
            totalPrice={reservation.totalPrice}
            amountPaid={reservation.amountPaid}
            remainingBalance={reservation.remainingBalance}
          />
        </div>

        <ChecklistProgressBar summary={taskSummary} />

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setExpanded((value) => !value)}
          className="w-full min-h-[40px] rounded-xl"
        >
          {expanded ? "Esconder detalhes" : "Detalhes"}
        </Button>

        {expanded && (
          <div className="rounded-xl border border-border bg-background p-3">
            <ReservationDetailList reservation={reservation} />
            <div className="mt-3 grid gap-2">
              <DetailBlock title="Extras" value={reservation.extras || "Sem extras registados"} />
              <DetailBlock title="Notas" value={reservation.notes || "Sem notas internas"} />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <ChecklistButton reservation={reservation} summary={taskSummary} variant="compact" />
              {reservation.paymentStatus !== "paid" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onMarkPaid(reservation)}
                  className="min-h-[36px] text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 border-emerald-200 gap-1 rounded-xl"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Pago
                </Button>
              )}
              <ReservationModal
                reservation={reservation}
                trigger={
                  <Button variant="outline" size="sm" className="min-h-[36px] gap-1 rounded-xl">
                    <Pencil className="h-3.5 w-3.5" />
                    Editar
                  </Button>
                }
              />
              <DeleteReservationButton reservation={reservation} onDelete={onDelete} compact />
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 pt-1">
          <WhatsAppButton
            phone={reservation.phone}
            customerName={reservation.customerName}
            eventDate={format(parseISO(reservation.eventDate), "dd/MM", { locale: ptBR })}
            eventTime={reservation.eventTime}
            pack={reservation.pack}
            serviceType={reservation.serviceType}
            extras={reservation.extras}
            totalPrice={reservation.totalPrice}
            amountPaid={reservation.amountPaid}
            remainingBalance={reservation.remainingBalance}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function ReservationKindBadge({ reservation }: { reservation: Reservation }) {
  const type = getReservationType(reservation);
  const label = type === "external_service" ? "Serviço exterior" : type === "workshop" ? "Workshop/Formação" : "Festa no espaço";
  const className = type === "external_service"
    ? "bg-sky-100 text-sky-800 hover:bg-sky-100"
    : type === "workshop"
      ? "bg-violet-100 text-violet-800 hover:bg-violet-100"
      : "bg-pink-100 text-pink-800 hover:bg-pink-100";

  return (
    <Badge className={`rounded-md border-none text-[11px] font-semibold ${className}`}>
      {label}
    </Badge>
  );
}

function ReservationStatusBadge({ status }: { status?: Reservation["reservationStatus"] | null }) {
  const value = status ?? "confirmed";
  const labels: Record<Exclude<ReservationStatusFilter, "all">, string> = {
    draft: "Em preparação",
    confirmed: "Confirmada",
    completed: "Concluída",
    cancelled: "Cancelada",
  };
  const className = value === "draft"
    ? "bg-slate-100 text-slate-700"
    : value === "completed"
      ? "bg-emerald-100 text-emerald-800"
      : value === "cancelled"
        ? "bg-rose-100 text-rose-800"
        : "bg-blue-100 text-blue-800";

  return (
    <Badge className={`rounded-full border-none text-[11px] font-semibold ${className}`}>
      {labels[value]}
    </Badge>
  );
}

function ReservationDetailList({ reservation, compact = false }: { reservation: Reservation; compact?: boolean }) {
  const details = getReservationDetails(reservation).slice(0, compact ? 4 : undefined);
  return (
    <div className="space-y-2 text-sm">
      {details.map((detail) => (
        <div key={detail.label} className="flex gap-2">
          <span className="min-w-[86px] text-xs font-semibold text-muted-foreground">{detail.label}</span>
          <span className="min-w-0 flex-1 truncate text-foreground">{detail.value}</span>
        </div>
      ))}
    </div>
  );
}

function PaymentBreakdown({ totalPrice, amountPaid, remainingBalance }: {
  totalPrice: number;
  amountPaid: number;
  remainingBalance: number;
}) {
  if (remainingBalance <= 0) {
    return (
      <div className="space-y-1 text-xs">
        <div className="flex justify-between gap-3">
          <span className="text-muted-foreground">Total</span>
          <span className="font-semibold">€{totalPrice.toFixed(2)}</span>
        </div>
        <div className="font-semibold text-emerald-700">Totalmente pago</div>
      </div>
    );
  }

  return (
    <div className="space-y-1 text-xs">
      <div className="flex justify-between gap-3">
        <span className="text-muted-foreground">Total</span>
        <span className="font-semibold">€{totalPrice.toFixed(2)}</span>
      </div>
      <div className="flex justify-between gap-3">
        <span className="text-muted-foreground">Pago</span>
        <span className="font-medium text-emerald-700">€{amountPaid.toFixed(2)}</span>
      </div>
      <div className="flex justify-between gap-3">
        <span className="font-semibold text-rose-700">Em falta</span>
        <span className="font-bold text-rose-700">€{remainingBalance.toFixed(2)}</span>
      </div>
    </div>
  );
}

type NextAction = "Cobrar sinal" | "Cobrar restante" | "Completar checklist" | "Preparar evento" | "Concluído" | "Acompanhar";

function getNextAction(reservation: Reservation, taskSummary?: TaskSummary): NextAction {
  if (reservation.paymentStatus !== "paid" && reservation.amountPaid === 0) return "Cobrar sinal";
  if (reservation.paymentStatus !== "paid" && reservation.remainingBalance > 0) return "Cobrar restante";
  if (taskSummary && taskSummary.total > 0 && taskSummary.completed < taskSummary.total) return "Completar checklist";
  if (reservation.reservationStatus === "confirmed" && reservation.paymentStatus === "paid") return "Preparar evento";
  if (reservation.reservationStatus === "completed") return "Concluído";
  return "Acompanhar";
}

function NextActionBadge({ action }: { action: NextAction }) {
  const className = action === "Cobrar sinal" || action === "Cobrar restante"
    ? "bg-orange-100 text-orange-800 ring-1 ring-orange-200"
    : action === "Completar checklist"
      ? "bg-blue-100 text-blue-800 ring-1 ring-blue-200"
      : action === "Concluído"
        ? "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200"
        : action === "Preparar evento"
          ? "bg-violet-100 text-violet-800 ring-1 ring-violet-200"
          : "bg-slate-100 text-slate-700 ring-1 ring-slate-200";

  return (
    <Badge className={`rounded-full border-none px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap ${className}`}>
      {action}
    </Badge>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone?: "success" | "warning" | "danger" }) {
  const toneClass = tone === "success" ? "text-emerald-700" : tone === "warning" ? "text-amber-700" : tone === "danger" ? "text-rose-700" : "";
  return (
    <Card className="shadow-sm border-border/70">
      <CardContent className="p-3 md:p-4">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className={`mt-0.5 text-xl font-bold leading-tight md:mt-1 md:text-2xl ${toneClass}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function SortableHead({
  label,
  active,
  direction,
  onClick,
  align,
}: {
  label: string;
  active: boolean;
  direction: SortDirection;
  onClick: () => void;
  align?: "right";
}) {
  return (
    <TableHead className={`py-3 text-xs font-bold uppercase tracking-wide text-muted-foreground ${align === "right" ? "text-right" : ""}`}>
      <button type="button" onClick={onClick} className={`inline-flex items-center gap-1 ${align === "right" ? "justify-end" : ""}`}>
        {label}
        {active && (direction === "asc" ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />)}
      </button>
    </TableHead>
  );
}

function DetailBlock({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{title}</p>
      <p className="text-sm leading-relaxed whitespace-pre-wrap">{value}</p>
    </div>
  );
}

function getTypeCount(summary: { venueParty: number; externalService: number; workshop: number }, filter: TypeFilter) {
  if (filter === "venue_party") return summary.venueParty;
  if (filter === "external_service") return summary.externalService;
  if (filter === "workshop") return summary.workshop;
  return summary.venueParty + summary.externalService + summary.workshop;
}

function getReservationType(reservation: Reservation): Exclude<TypeFilter, "all"> {
  if (reservation.reservationType === "external_service" || reservation.serviceType?.toLowerCase().includes("extern")) {
    return "external_service";
  }
  if (reservation.reservationType === "workshop" || reservation.serviceType?.toLowerCase().includes("workshop")) {
    return "workshop";
  }
  return "venue_party";
}

function getReservationTitle(reservation: Reservation) {
  const type = getReservationType(reservation);
  if (type === "external_service") return reservation.pack || reservation.eventType || "Serviço no exterior";
  if (type === "workshop") return reservation.workshopName || reservation.pack || "Workshop/Formação";
  return reservation.birthdayChildName ? `${reservation.pack} · ${reservation.birthdayChildName}` : reservation.pack;
}

function getReservationSubtitle(reservation: Reservation) {
  const type = getReservationType(reservation);
  if (type === "external_service") return reservation.eventLocation || reservation.eventType || "Serviço exterior";
  if (type === "workshop") return `${getParticipantCount(reservation)} participante(s)`;
  return reservation.partyTheme ? `Tema: ${reservation.partyTheme}` : `${getParticipantCount(reservation)} criança(s)`;
}

function getParticipantCount(reservation: Reservation) {
  const type = getReservationType(reservation);
  if (type === "external_service") return reservation.guestCount ?? reservation.numChildren ?? 0;
  if (type === "workshop") return reservation.participantCount ?? reservation.numChildren ?? 0;
  return reservation.numChildren ?? 0;
}

function getReservationDetails(reservation: Reservation) {
  const type = getReservationType(reservation);
  const details: Array<{ label: string; value: string }> = [];

  if (type === "external_service") {
    addDetail(details, "Serviço", reservation.pack);
    addDetail(details, "Morada", reservation.eventLocation);
    addDetail(details, "Pessoas", formatCount(reservation.guestCount ?? reservation.numChildren));
    addDetail(details, "Evento", reservation.eventType);
    addDetail(details, "Tema", reservation.eventTheme);
    return details;
  }

  if (type === "workshop") {
    addDetail(details, "Workshop", reservation.workshopName || reservation.pack);
    addDetail(details, "Pessoas", formatCount(reservation.participantCount ?? reservation.numChildren));
    addDetail(details, "Notas", reservation.workshopNotes);
    return details;
  }

  addDetail(details, "Pack", reservation.pack);
  addDetail(details, "Anivers.", reservation.birthdayChildName);
  addDetail(details, "Idade", reservation.birthdayChildAge ? `${reservation.birthdayChildAge} anos` : undefined);
  addDetail(details, "Crianças", formatCount(reservation.numChildren));
  addDetail(details, "Tema", reservation.partyTheme);
  return details;
}

function getReservationDetailsText(reservation: Reservation) {
  const details = getReservationDetails(reservation);
  return details.length ? details.map((detail) => `${detail.label}: ${detail.value}`).join("\n") : "Sem detalhes específicos registados.";
}

function addDetail(details: Array<{ label: string; value: string }>, label: string, value?: string | number | null) {
  if (value === undefined || value === null || value === "") return;
  details.push({ label, value: String(value) });
}

function formatCount(value?: number | null) {
  if (value === undefined || value === null) return undefined;
  return String(value);
}

function matchesTypeFilter(reservation: Reservation, typeFilter: TypeFilter) {
  if (typeFilter === "all") return true;
  return getReservationType(reservation) === typeFilter;
}

function matchesReservationStatusFilter(reservation: Reservation, statusFilter: ReservationStatusFilter) {
  if (statusFilter === "all") return true;
  return (reservation.reservationStatus ?? "confirmed") === statusFilter;
}

function matchesDateFilter(reservation: Reservation, dateFilter: DateFilter) {
  if (dateFilter === "all") return true;
  const date = reservation.eventDate;
  const now = new Date();
  if (dateFilter === "week") {
    return date >= format(now, "yyyy-MM-dd") && date <= format(addDays(now, 7), "yyyy-MM-dd");
  }
  if (dateFilter === "month") {
    return date >= format(startOfMonth(now), "yyyy-MM-dd") && date <= format(endOfMonth(now), "yyyy-MM-dd");
  }
  const nextMonth = addMonths(now, 1);
  return date >= format(startOfMonth(nextMonth), "yyyy-MM-dd") && date <= format(endOfMonth(nextMonth), "yyyy-MM-dd");
}

function compareReservations(a: Reservation, b: Reservation, sortKey: SortKey, sortDirection: SortDirection) {
  const direction = sortDirection === "asc" ? 1 : -1;
  if (sortKey === "customerName") return a.customerName.localeCompare(b.customerName) * direction;
  if (sortKey === "remainingBalance") return (a.remainingBalance - b.remainingBalance) * direction;
  if (sortKey === "paymentStatus") return a.paymentStatus.localeCompare(b.paymentStatus) * direction;
  return (`${a.eventDate} ${a.eventTime}`).localeCompare(`${b.eventDate} ${b.eventTime}`) * direction;
}

function csv(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}
