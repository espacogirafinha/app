import { useMemo, useState } from "react";
import {
  eachDayOfInterval,
  endOfMonth,
  endOfYear,
  format,
  parseISO,
  startOfMonth,
  startOfYear,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  BarChart3,
  CalendarDays,
  Download,
  Euro,
  FileText,
  Loader2,
  PackagePlus,
  PieChart as PieChartIcon,
  Star,
  TrendingUp,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MAX_EVENTS_PER_DAY } from "@/lib/constants";
import { useListReservations } from "@workspace/api-client-react";
import type { Reservation } from "@workspace/api-client-react";

type PeriodMode = "month" | "year" | "custom";

type RankedStat = {
  name: string;
  count: number;
  revenue: number;
  percentage: number;
};

const MONTHS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const COLORS = ["#ec4899", "#14b8a6", "#f59e0b", "#6366f1", "#84cc16", "#f97316"];

const euro = (value: number) => `${value.toFixed(2)} €`;

export default function ReportsPage() {
  const now = new Date();
  const [mode, setMode] = useState<PeriodMode>("month");
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [customStart, setCustomStart] = useState(format(startOfMonth(now), "yyyy-MM-dd"));
  const [customEnd, setCustomEnd] = useState(format(endOfMonth(now), "yyyy-MM-dd"));

  const period = useMemo(() => {
    if (mode === "year") {
      const base = new Date(selectedYear, 0, 1);
      return {
        dateFrom: format(startOfYear(base), "yyyy-MM-dd"),
        dateTo: format(endOfYear(base), "yyyy-MM-dd"),
        label: selectedYear.toString(),
      };
    }

    if (mode === "custom") {
      const safeStart = customStart || format(startOfMonth(now), "yyyy-MM-dd");
      const safeEnd = customEnd || safeStart;
      return {
        dateFrom: safeStart <= safeEnd ? safeStart : safeEnd,
        dateTo: safeStart <= safeEnd ? safeEnd : safeStart,
        label: `${format(parseISO(safeStart <= safeEnd ? safeStart : safeEnd), "dd MMM yyyy", { locale: ptBR })} - ${format(parseISO(safeStart <= safeEnd ? safeEnd : safeStart), "dd MMM yyyy", { locale: ptBR })}`,
      };
    }

    const base = new Date(selectedYear, selectedMonth - 1, 1);
    return {
      dateFrom: format(startOfMonth(base), "yyyy-MM-dd"),
      dateTo: format(endOfMonth(base), "yyyy-MM-dd"),
      label: `${MONTHS[selectedMonth - 1]} ${selectedYear}`,
    };
  }, [customEnd, customStart, mode, now, selectedMonth, selectedYear]);

  const { data: reservations, isLoading } = useListReservations();

  const filteredReservations = useMemo(
    () => filterReservationsByDate(reservations ?? [], period.dateFrom, period.dateTo),
    [period.dateFrom, period.dateTo, reservations],
  );

  const report = useMemo(() => buildReport(filteredReservations, period.dateFrom, period.dateTo), [filteredReservations, period]);
  const monthlyTrend = useMemo(() => buildMonthlyTrend(reservations ?? [], selectedYear), [reservations, selectedYear]);

  const exportCsv = () => {
    const rows = filteredReservations;
    const headers = [
      "Cliente",
      "Data",
      "Hora",
      "Tipo",
      "Pack",
      "Total",
      "Recebido",
      "Por receber",
      "Extras",
      "Origem",
      "Notas",
    ];

    const csvRows = rows.map((reservation) =>
      [
        csv(reservation.customerName),
        reservation.eventDate,
        reservation.eventTime,
        csv(reservation.serviceType),
        csv(reservation.pack),
        reservation.totalPrice,
        reservation.amountPaid,
        reservation.remainingBalance,
        csv(reservation.extras || ""),
        csv(getOrigin(reservation.notes)),
        csv(reservation.notes || ""),
      ].join(","),
    );

    downloadCsv([headers.join(","), ...csvRows].join("\n"), `relatorio_girafinha_${period.dateFrom}_${period.dateTo}.csv`);
  };

  return (
    <div className="space-y-4 md:space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-primary">Relatórios</h1>
          <p className="mt-1 text-sm md:text-base text-muted-foreground">
            Faturação, ocupação e desempenho dos serviços para decisões internas.
          </p>
        </div>
        <Button variant="outline" onClick={exportCsv} disabled={filteredReservations.length === 0} className="min-h-[40px] rounded-xl">
          <Download className="h-4 w-4" />
          Exportar CSV
        </Button>
      </div>

      <Card className="border-border/70 shadow-sm">
        <CardContent className="grid gap-3 p-4 md:grid-cols-[180px_1fr] lg:grid-cols-[180px_160px_160px_1fr]">
          <Select value={mode} onValueChange={(value) => setMode(value as PeriodMode)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Mês</SelectItem>
              <SelectItem value="year">Ano</SelectItem>
              <SelectItem value="custom">Intervalo</SelectItem>
            </SelectContent>
          </Select>

          {mode === "month" && (
            <>
              <Select value={String(selectedMonth)} onValueChange={(value) => setSelectedMonth(Number(value))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((month, index) => (
                    <SelectItem key={month} value={String(index + 1)}>
                      {month}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <YearInput value={selectedYear} onChange={setSelectedYear} />
            </>
          )}

          {mode === "year" && <YearInput value={selectedYear} onChange={setSelectedYear} />}

          {mode === "custom" && (
            <>
              <Input type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} />
              <Input type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} />
            </>
          )}

          <div className="flex items-center rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm font-medium">
            {period.label}
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
        </div>
      ) : (
        <>
          <div className="grid gap-3 grid-cols-2 xl:grid-cols-5">
            <MetricCard title="Receita total" value={euro(report.revenue)} icon={Euro} tone="emerald" />
            <MetricCard title="Recebido" value={euro(report.paid)} icon={TrendingUp} tone="teal" />
            <MetricCard title="Por receber" value={euro(report.pending)} icon={Euro} tone="amber" />
            <MetricCard title="Reservas" value={String(report.count)} icon={CalendarDays} tone="pink" />
            <MetricCard title="Ticket médio" value={euro(report.avgTicket)} icon={FileText} />
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Faturação por mês em {selectedYear}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyTrend} margin={{ top: 8, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(value) => `${value}€`} />
                      <Tooltip formatter={(value: number, name) => [euro(value), name === "paid" ? "Recebido" : "Receita"]} />
                      <Bar dataKey="revenue" fill="#ec4899" radius={[6, 6, 0, 0]} name="Receita" />
                      <Bar dataKey="paid" fill="#14b8a6" radius={[6, 6, 0, 0]} name="Recebido" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <CalendarDays className="h-5 w-5 text-primary" />
                  Ocupação
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <SmallMetric label="Dias com reservas" value={String(report.occupancy.bookedDays)} />
                  <SmallMetric label="Dias lotados" value={String(report.occupancy.fullDays)} />
                  <SmallMetric label="Slots usados" value={`${report.occupancy.usedSlots}/${report.occupancy.maxSlots}`} />
                  <SmallMetric label="Slots livres" value={String(report.occupancy.availableSlots)} />
                </div>
                <div>
                  <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
                    <span>Taxa de ocupação</span>
                    <span>{report.occupancy.rate}%</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, report.occupancy.rate)}%` }} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <RankingCard title="Packs mais vendidos" icon={Star} rows={report.packStats} />
            <RankingCard title="Tipos de serviço" icon={PieChartIcon} rows={report.serviceStats} />
            <RankingCard title="Extras mais vendidos" icon={PackagePlus} rows={report.extraStats} empty="Sem extras neste período." />
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <PieChartIcon className="h-5 w-5 text-primary" />
                  Distribuição dos serviços
                </CardTitle>
              </CardHeader>
              <CardContent>
                {report.serviceStats.length > 0 ? (
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={report.serviceStats}
                          cx="50%"
                          cy="50%"
                          outerRadius={96}
                          dataKey="count"
                          nameKey="name"
                          label={({ percentage }) => `${percentage}%`}
                        >
                          {report.serviceStats.map((_, index) => (
                            <Cell key={index} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number, name) => [value, name]} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <EmptyState text="Sem reservas neste período." />
                )}
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Origem dos clientes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {report.originStats.length > 0 ? (
                  report.originStats.map((item) => (
                    <div key={item.name} className="flex items-center justify-between rounded-lg border border-border p-3">
                      <span className="text-sm font-medium">{item.name}</span>
                      <span className="text-sm font-bold">{item.count}</span>
                    </div>
                  ))
                ) : (
                  <EmptyState text="Sem origem registada nas notas." />
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function filterReservationsByDate(reservations: Reservation[], dateFrom: string, dateTo: string) {
  return reservations.filter((reservation) => reservation.eventDate >= dateFrom && reservation.eventDate <= dateTo);
}

function buildReport(reservations: Reservation[], dateFrom: string, dateTo: string) {
  const packMap = new Map<string, { count: number; revenue: number }>();
  const serviceMap = new Map<string, { count: number; revenue: number }>();
  const extraMap = new Map<string, { count: number; revenue: number }>();
  const originMap = new Map<string, { count: number; revenue: number }>();
  const occupancyByDate = new Map<string, number>();

  let revenue = 0;
  let paid = 0;
  let pending = 0;
  let extrasRevenue = 0;

  for (const reservation of reservations) {
    const extras = parseExtras(reservation.extras);
    const reservationExtrasRevenue = extras.reduce((sum, extra) => sum + extra.revenue, 0);
    extrasRevenue += reservationExtrasRevenue;
    revenue += reservation.totalPrice;
    paid += reservation.amountPaid;
    pending += reservation.remainingBalance;

    addStat(packMap, reservation.pack, reservation.totalPrice);
    addStat(serviceMap, reservation.serviceType, reservation.totalPrice);

    for (const extra of extras) addStat(extraMap, extra.name, extra.revenue);

    const origin = getOrigin(reservation.notes);
    if (origin !== "Sem origem") addStat(originMap, origin, reservation.totalPrice);

    if (reservation.serviceType !== "Serviços externos") {
      occupancyByDate.set(reservation.eventDate, (occupancyByDate.get(reservation.eventDate) ?? 0) + 1);
    }
  }

  const days = eachDayOfInterval({ start: parseISO(dateFrom), end: parseISO(dateTo) }).length;
  const usedSlots = Array.from(occupancyByDate.values()).reduce((sum, count) => sum + Math.min(count, MAX_EVENTS_PER_DAY), 0);
  const maxSlots = days * MAX_EVENTS_PER_DAY;

  return {
    count: reservations.length,
    revenue,
    paid,
    pending,
    avgTicket: reservations.length > 0 ? revenue / reservations.length : 0,
    baseRevenue: Math.max(0, revenue - extrasRevenue),
    extrasRevenue,
    packStats: toRankedStats(packMap, reservations.length),
    serviceStats: toRankedStats(serviceMap, reservations.length),
    extraStats: toRankedStats(extraMap, Math.max(1, Array.from(extraMap.values()).reduce((sum, item) => sum + item.count, 0))),
    originStats: toRankedStats(originMap, reservations.length),
    occupancy: {
      bookedDays: occupancyByDate.size,
      fullDays: Array.from(occupancyByDate.values()).filter((count) => count >= MAX_EVENTS_PER_DAY).length,
      usedSlots,
      maxSlots,
      availableSlots: Math.max(0, maxSlots - usedSlots),
      rate: maxSlots > 0 ? Math.round((usedSlots / maxSlots) * 1000) / 10 : 0,
    },
  };
}

function buildMonthlyTrend(reservations: Reservation[], year: number) {
  return MONTHS.map((month, index) => {
    const rows = reservations.filter(
      (reservation) =>
        Number(reservation.eventDate.slice(0, 4)) === year &&
        Number(reservation.eventDate.slice(5, 7)) === index + 1,
    );
    return {
      month: month.slice(0, 3),
      revenue: rows.reduce((sum, reservation) => sum + reservation.totalPrice, 0),
      paid: rows.reduce((sum, reservation) => sum + reservation.amountPaid, 0),
      reservations: rows.length,
    };
  });
}

function addStat(map: Map<string, { count: number; revenue: number }>, name: string, revenue: number) {
  const current = map.get(name) ?? { count: 0, revenue: 0 };
  map.set(name, { count: current.count + 1, revenue: current.revenue + revenue });
}

function toRankedStats(map: Map<string, { count: number; revenue: number }>, totalCount: number): RankedStat[] {
  return Array.from(map.entries())
    .map(([name, item]) => ({
      name,
      count: item.count,
      revenue: item.revenue,
      percentage: totalCount > 0 ? Math.round((item.count / totalCount) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.count - a.count || b.revenue - a.revenue);
}

function parseExtras(value?: string | null) {
  if (!value) return [];

  return value
    .split(";")
    .map((raw) => raw.trim())
    .filter(Boolean)
    .map((raw) => {
      const structured = raw.match(/^(.*?)\s+x\s*([\d.,]+)\s+-\s*([\d.,]+)\s*€/);
      if (structured) {
        return { name: structured[1].trim(), revenue: Number(structured[3].replace(",", ".")) || 0 };
      }

      const legacy = raw.match(/^(.*?)\s*\(\+?([\d.,]+)\s*€\)$/);
      if (legacy) {
        return { name: legacy[1].trim(), revenue: Number(legacy[2].replace(",", ".")) || 0 };
      }

      return { name: raw, revenue: 0 };
    });
}

function getOrigin(notes?: string | null) {
  const match = notes?.match(/Origem:\s*([^\n;]+)/i);
  return match?.[1]?.trim() || "Sem origem";
}

function YearInput({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <Input
      type="number"
      min="2020"
      max="2100"
      value={value}
      onChange={(event) => onChange(Number(event.target.value) || new Date().getFullYear())}
    />
  );
}

function MetricCard({
  title,
  value,
  icon: Icon,
  tone,
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  tone?: "emerald" | "teal" | "amber" | "pink";
}) {
  const toneClass =
    tone === "emerald"
      ? "bg-emerald-50 border-emerald-200 text-emerald-800"
      : tone === "teal"
        ? "bg-teal-50 border-teal-200 text-teal-800"
        : tone === "amber"
          ? "bg-amber-50 border-amber-200 text-amber-800"
          : tone === "pink"
            ? "bg-primary/5 border-primary/20 text-primary"
            : "bg-card text-foreground";

  return (
    <Card className={`shadow-sm ${toneClass}`}>
      <CardContent className="p-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-medium opacity-80">{title}</p>
          <Icon className="h-4 w-4 opacity-70" />
        </div>
        <p className="text-xl font-bold md:text-2xl">{value}</p>
      </CardContent>
    </Card>
  );
}

function RankingCard({
  title,
  icon: Icon,
  rows,
  empty = "Sem dados neste período.",
}: {
  title: string;
  icon: React.ElementType;
  rows: RankedStat[];
  empty?: string;
}) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-5 w-5 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.length === 0 ? (
          <EmptyState text={empty} />
        ) : (
          rows.slice(0, 6).map((row, index) => (
            <div key={row.name} className="rounded-lg border border-border p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{row.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.count} reserva{row.count === 1 ? "" : "s"} · {row.percentage}%
                  </p>
                </div>
                <p className="shrink-0 text-sm font-bold text-emerald-700">{euro(row.revenue)}</p>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.min(100, row.percentage)}%`, backgroundColor: COLORS[index % COLORS.length] }}
                />
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function SmallMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">{text}</div>;
}

function csv(value: string | number) {
  const text = String(value).replace(/"/g, '""');
  return `"${text}"`;
}

function downloadCsv(content: string, filename: string) {
  const blob = new Blob(["\ufeff", content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
