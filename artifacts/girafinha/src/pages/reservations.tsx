import { useMemo, useState } from "react";
import { addDays, addMonths, endOfMonth, format, isToday, parseISO, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  FileDown,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { StatusBadge, PaymentSummary } from "@/components/status-badge";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { SERVICE_TYPE_OPTIONS, type ServiceType } from "@/lib/constants";
import {
  getGetDashboardStatsQueryKey,
  getGetUpcomingReservationsQueryKey,
  getListReservationsQueryKey,
  useDeleteReservation,
  useListReservations,
  useUpdateReservation,
} from "@workspace/api-client-react";
import type { ListReservationsStatus, Reservation, TaskSummary } from "@workspace/api-client-react";

type QuickFilter = "all" | "upcoming" | "today" | "pending" | "paid" | "workshops" | "external";
type DateFilter = "all" | "week" | "month" | "nextMonth";
type SortKey = "eventDate" | "customerName" | "remainingBalance" | "paymentStatus";
type SortDirection = "asc" | "desc";

const QUICK_FILTERS: Array<{ value: QuickFilter; label: string }> = [
  { value: "all", label: "Todas" },
  { value: "upcoming", label: "Próximas" },
  { value: "today", label: "Hoje" },
  { value: "pending", label: "Pendentes" },
  { value: "paid", label: "Pagas" },
  { value: "workshops", label: "Workshops" },
  { value: "external", label: "Serviços externos" },
];

export default function Reservations() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<ListReservationsStatus | "all">("all");
  const [serviceTypeFilter, setServiceTypeFilter] = useState<ServiceType | "all">("all");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("eventDate");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const isMobile = useIsMobile();

  const queryParams = {
    ...(searchTerm ? { search: searchTerm } : {}),
    ...(statusFilter !== "all" ? { status: statusFilter } : {}),
    ...(serviceTypeFilter !== "all" ? { serviceType: serviceTypeFilter } : {}),
  };

  const { data: reservations, isLoading } = useListReservations(queryParams);
  const deleteReservation = useDeleteReservation();
  const updateReservation = useUpdateReservation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const visibleReservations = useMemo(() => {
    return [...(reservations ?? [])]
      .filter((reservation) => matchesQuickFilter(reservation, quickFilter))
      .filter((reservation) => matchesDateFilter(reservation, dateFilter))
      .sort((a, b) => compareReservations(a, b, sortKey, sortDirection));
  }, [dateFilter, quickFilter, reservations, sortDirection, sortKey]);

  const taskSummaries = useReservationTaskSummaries(visibleReservations.map((r) => r.id));
  const selectedReservations = visibleReservations.filter((reservation) => selectedIds.includes(reservation.id));
  const allVisibleSelected = visibleReservations.length > 0 && visibleReservations.every((reservation) => selectedIds.includes(reservation.id));

  const summary = useMemo(() => {
    return visibleReservations.reduce(
      (acc, reservation) => {
        acc.total += 1;
        acc.pending += reservation.remainingBalance;
        if (reservation.paymentStatus === "paid") acc.paidCount += 1;
        if (reservation.paymentStatus !== "paid") acc.pendingCount += 1;
        return acc;
      },
      { total: 0, pending: 0, paidCount: 0, pendingCount: 0 },
    );
  }, [visibleReservations]);

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
        setSelectedIds((ids) => ids.filter((selectedId) => selectedId !== id));
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

  const handleBulkMarkPaid = () => {
    selectedReservations
      .filter((reservation) => reservation.paymentStatus !== "paid")
      .forEach((reservation) => {
        updateReservation.mutate({ id: reservation.id, data: { amountPaid: reservation.totalPrice } }, { onSuccess: invalidateAll });
      });
    toast({ title: "Pagamentos enviados", description: `${selectedReservations.length} reservas em processamento.` });
  };

  const toggleSelection = (id: number) => {
    setSelectedIds((ids) => ids.includes(id) ? ids.filter((selectedId) => selectedId !== id) : [...ids, id]);
  };

  const toggleAllVisible = () => {
    setSelectedIds(allVisibleSelected ? [] : visibleReservations.map((reservation) => reservation.id));
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
    <div className="space-y-4 md:space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-primary">Reservas</h1>
          <p className="text-muted-foreground mt-1 text-sm md:text-base">
            Gestão operacional de festas, serviços externos e workshops.
          </p>
        </div>
        <div className="flex items-center gap-2 md:gap-3">
          <Button variant="outline" onClick={() => exportRows(visibleReservations)} disabled={!visibleReservations.length} className="min-h-[44px] rounded-xl">
            <FileDown className="h-4 w-4 mr-2" />
            Exportar filtradas
          </Button>
          <ReservationModal
            trigger={
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 rounded-full px-5 md:px-6 shadow-md hover:shadow-lg transition-all min-h-[44px]">
                <Plus className="h-4 w-4" />
                Nova Reserva
              </Button>
            }
          />
        </div>
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Total filtrado" value={summary.total.toString()} />
        <SummaryCard label="Por receber" value={`€${summary.pending.toFixed(2)}`} tone="danger" />
        <SummaryCard label="Pagas" value={summary.paidCount.toString()} tone="success" />
        <SummaryCard label="Pendentes" value={summary.pendingCount.toString()} tone="warning" />
      </div>

      <div className="space-y-3 bg-card p-3 md:p-4 rounded-xl shadow-sm border border-border">
        <div className="flex gap-2 overflow-x-auto">
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

        <div className="grid gap-3 md:grid-cols-[1fr_180px_220px_200px_190px]">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar por nome ou telemóvel..."
              className="pl-9 min-h-[44px]"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

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

          <Select value={serviceTypeFilter} onValueChange={(val) => setServiceTypeFilter(val as ServiceType | "all")}>
            <SelectTrigger className="min-h-[44px]">
              <SelectValue placeholder="Tipo de serviço" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os serviços</SelectItem>
              {SERVICE_TYPE_OPTIONS.map((serviceType) => (
                <SelectItem key={serviceType} value={serviceType}>
                  {serviceType}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val as ListReservationsStatus | "all")}>
            <SelectTrigger className="min-h-[44px]">
              <SelectValue placeholder="Pagamento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os estados</SelectItem>
              <SelectItem value="paid">Pago</SelectItem>
              <SelectItem value="partial">Sinal</SelectItem>
              <SelectItem value="unpaid">Pendente</SelectItem>
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

        {selectedReservations.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
            <p className="text-sm font-medium">{selectedReservations.length} reserva{selectedReservations.length === 1 ? "" : "s"} selecionada{selectedReservations.length === 1 ? "" : "s"}</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => exportRows(selectedReservations, "reservas_selecionadas")} className="rounded-xl">
                <FileDown className="h-4 w-4" />
                Exportar selecionadas
              </Button>
              <Button variant="outline" size="sm" onClick={handleBulkMarkPaid} className="rounded-xl text-emerald-700 border-emerald-200 hover:bg-emerald-50">
                <CheckCircle2 className="h-4 w-4" />
                Marcar como pagas
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSelectedIds([])} className="rounded-xl">
                Limpar seleção
              </Button>
            </div>
          </div>
        )}
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
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox checked={allVisibleSelected} onCheckedChange={toggleAllVisible} aria-label="Selecionar reservas visíveis" />
                  </TableHead>
                  <SortableHead label="Data / Hora" active={sortKey === "eventDate"} direction={sortDirection} onClick={() => updateSort("eventDate")} />
                  <SortableHead label="Cliente" active={sortKey === "customerName"} direction={sortDirection} onClick={() => updateSort("customerName")} />
                  <TableHead>Tipo / Pack</TableHead>
                  <TableHead>Checklist</TableHead>
                  <TableHead>Alertas</TableHead>
                  <SortableHead label="Pagamento" active={sortKey === "remainingBalance"} direction={sortDirection} onClick={() => updateSort("remainingBalance")} align="right" />
                  <TableHead className="text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleReservations.map((reservation) => (
                  <ReservationTableRows
                    key={reservation.id}
                    reservation={reservation}
                    taskSummary={taskSummaries.get(reservation.id)}
                    selected={selectedIds.includes(reservation.id)}
                    expanded={expandedId === reservation.id}
                    onToggleSelection={() => toggleSelection(reservation.id)}
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
  selected,
  expanded,
  onToggleSelection,
  onToggleExpanded,
  onMarkPaid,
  onDelete,
}: {
  reservation: Reservation;
  taskSummary?: TaskSummary;
  selected: boolean;
  expanded: boolean;
  onToggleSelection: () => void;
  onToggleExpanded: () => void;
  onMarkPaid: (reservation: Reservation) => void;
  onDelete: (id: number) => void;
}) {
  const alerts = getReservationAlerts(reservation, taskSummary);
  return (
    <>
      <TableRow className="hover:bg-muted/30">
        <TableCell>
          <Checkbox checked={selected} onCheckedChange={onToggleSelection} aria-label={`Selecionar ${reservation.customerName}`} />
        </TableCell>
        <TableCell className="whitespace-nowrap">
          <div className="font-medium text-foreground">
            {format(parseISO(reservation.eventDate), "dd MMM yyyy", { locale: ptBR })}
          </div>
          <div className="text-xs text-muted-foreground">{reservation.eventTime}</div>
        </TableCell>
        <TableCell>
          <div className="font-bold text-foreground">{reservation.customerName}</div>
          <div className="text-xs text-muted-foreground">{reservation.phone}</div>
        </TableCell>
        <TableCell className="max-w-[260px]">
          <span className="text-sm font-medium">{reservation.pack}</span>
          <div className="mt-1 flex items-center gap-1 flex-wrap">
            <Badge variant="secondary" className="rounded-md text-[11px] font-medium">
              {reservation.serviceType}
            </Badge>
            <span className="text-xs text-muted-foreground">{reservation.numChildren} participantes</span>
          </div>
        </TableCell>
        <TableCell className="min-w-[150px]">
          <ChecklistProgressBar summary={taskSummary} />
        </TableCell>
        <TableCell>
          <div className="flex flex-wrap gap-1.5">
            {alerts.length > 0 ? alerts.map((alert) => (
              <Badge key={alert} variant="outline" className="rounded-md border-amber-200 bg-amber-50 text-amber-800">
                {alert}
              </Badge>
            )) : (
              <span className="text-xs text-muted-foreground">Sem alertas</span>
            )}
          </div>
        </TableCell>
        <TableCell className="text-right whitespace-nowrap">
          <StatusBadge status={reservation.paymentStatus} />
          <div className="mt-1">
            <PaymentSummary
              totalPrice={reservation.totalPrice}
              amountPaid={reservation.amountPaid}
              remainingBalance={reservation.remainingBalance}
              compact
            />
          </div>
        </TableCell>
        <TableCell>
          <div className="flex items-center justify-center gap-1.5 flex-wrap">
            <Button variant="ghost" size="sm" onClick={onToggleExpanded} className="min-h-[36px] rounded-xl">
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
            <RowActions reservation={reservation} onMarkPaid={onMarkPaid} onDelete={onDelete} compact />
          </div>
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow className="bg-muted/20">
          <TableCell colSpan={8}>
            <div className="grid gap-3 p-3 md:grid-cols-3">
              <DetailBlock title="Extras" value={reservation.extras || "Sem extras registados"} />
              <DetailBlock title="Notas" value={reservation.notes || "Sem notas internas"} />
              <div className="rounded-lg border border-border bg-background p-3">
                <p className="text-xs font-semibold text-muted-foreground mb-2">Ações rápidas</p>
                <div className="flex flex-wrap gap-2">
                  <ChecklistButton reservation={reservation} summary={taskSummary} variant="compact" />
                  <ReservationModal
                    reservation={reservation}
                    trigger={
                      <Button variant="outline" size="sm" className="min-h-[36px] gap-1 rounded-xl">
                        <Pencil className="h-3.5 w-3.5" />
                        Editar
                      </Button>
                    }
                  />
                </div>
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function RowActions({
  reservation,
  onMarkPaid,
  onDelete,
  compact = false,
}: {
  reservation: Reservation;
  onMarkPaid: (reservation: Reservation) => void;
  onDelete: (id: number) => void;
  compact?: boolean;
}) {
  return (
    <>
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
      {reservation.paymentStatus !== "paid" && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => onMarkPaid(reservation)}
          className={`${compact ? "min-h-[36px]" : "min-h-[44px]"} text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 border-emerald-200 gap-1 rounded-xl`}
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          Pago
        </Button>
      )}
      {!compact && (
        <ReservationModal
          reservation={reservation}
          trigger={
            <Button variant="outline" size="sm" className="rounded-xl min-h-[44px] gap-1.5 font-medium">
              <Pencil className="h-4 w-4" />
              Editar
            </Button>
          }
        />
      )}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline" size="sm" className={`${compact ? "min-h-[36px]" : "min-h-[44px]"} text-destructive hover:bg-destructive/10 border-destructive/30 gap-1 rounded-xl`}>
            <Trash2 className="h-3.5 w-3.5" />
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
    </>
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
  const date = parseISO(reservation.eventDate);
  const dateDisplay = format(date, "dd 'de' MMM", { locale: ptBR });
  const alerts = getReservationAlerts(reservation, taskSummary);

  return (
    <Card className={`shadow-sm overflow-hidden border ${
      reservation.paymentStatus === "paid" ? "border-emerald-200" :
      reservation.paymentStatus === "partial" ? "border-amber-200" :
      "border-rose-200"
    }`}>
      <CardContent className="p-4 space-y-3">
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
                {reservation.numChildren}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 text-sm">
          <div className="min-w-0">
            <p className="font-medium truncate">{reservation.pack}</p>
            <Badge variant="secondary" className="mt-1 rounded-md text-[11px] font-medium">
              {reservation.serviceType}
            </Badge>
          </div>
          <span className="text-muted-foreground">{reservation.phone}</span>
        </div>

        {alerts.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {alerts.map((alert) => (
              <Badge key={alert} variant="outline" className="rounded-md border-amber-200 bg-amber-50 text-amber-800">
                <AlertTriangle className="mr-1 h-3 w-3" />
                {alert}
              </Badge>
            ))}
          </div>
        )}

        <div className={`p-2.5 rounded-lg ${
          reservation.paymentStatus === "paid" ? "bg-emerald-50" :
          reservation.paymentStatus === "partial" ? "bg-amber-50" :
          "bg-rose-50"
        }`}>
          <PaymentSummary
            totalPrice={reservation.totalPrice}
            amountPaid={reservation.amountPaid}
            remainingBalance={reservation.remainingBalance}
          />
        </div>

        <ChecklistProgressBar summary={taskSummary} />

        <div className="flex items-center gap-2 flex-wrap pt-1">
          <RowActions reservation={reservation} onMarkPaid={onMarkPaid} onDelete={onDelete} />
          <ChecklistButton reservation={reservation} summary={taskSummary} variant="compact" />
        </div>
      </CardContent>
    </Card>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone?: "success" | "warning" | "danger" }) {
  const toneClass = tone === "success" ? "text-emerald-700" : tone === "warning" ? "text-amber-700" : tone === "danger" ? "text-rose-700" : "";
  return (
    <Card className="shadow-sm border-border/70">
      <CardContent className="p-4">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className={`mt-1 text-2xl font-bold ${toneClass}`}>{value}</p>
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
    <TableHead className={align === "right" ? "text-right" : undefined}>
      <button type="button" onClick={onClick} className={`inline-flex items-center gap-1 ${align === "right" ? "justify-end" : ""}`}>
        {label}
        {active && (direction === "asc" ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />)}
      </button>
    </TableHead>
  );
}

function DetailBlock({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <p className="text-xs font-semibold text-muted-foreground mb-1">{title}</p>
      <p className="text-sm whitespace-pre-wrap">{value}</p>
    </div>
  );
}

function matchesQuickFilter(reservation: Reservation, quickFilter: QuickFilter) {
  const today = format(new Date(), "yyyy-MM-dd");
  if (quickFilter === "upcoming") return reservation.eventDate >= today;
  if (quickFilter === "today") return isToday(parseISO(reservation.eventDate));
  if (quickFilter === "pending") return reservation.paymentStatus !== "paid";
  if (quickFilter === "paid") return reservation.paymentStatus === "paid";
  if (quickFilter === "workshops") return reservation.serviceType === "Workshops";
  if (quickFilter === "external") return reservation.serviceType === "Serviços externos";
  return true;
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

function getReservationAlerts(reservation: Reservation, taskSummary?: TaskSummary) {
  const alerts: string[] = [];
  if (isToday(parseISO(reservation.eventDate))) alerts.push("Hoje");
  if (reservation.paymentStatus !== "paid") alerts.push("Cobrar");
  if (taskSummary && taskSummary.total > 0 && taskSummary.completed < taskSummary.total) alerts.push("Checklist");
  return alerts;
}

function csv(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}
