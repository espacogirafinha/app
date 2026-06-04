import { useMemo, useState } from "react";
import { endOfMonth, endOfYear, format, parseISO, startOfMonth, startOfYear } from "date-fns";
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
  Users,
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
import { useGetReportsV2, type ReportsV2AreaSummary, type ReportsV2RevenueStat } from "@workspace/api-client-react";

type PeriodMode = "month" | "year" | "custom";

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
        startDate: format(startOfYear(base), "yyyy-MM-dd"),
        endDate: format(endOfYear(base), "yyyy-MM-dd"),
        label: selectedYear.toString(),
      };
    }

    if (mode === "custom") {
      const safeStart = customStart || format(startOfMonth(now), "yyyy-MM-dd");
      const safeEnd = customEnd || safeStart;
      const startDate = safeStart <= safeEnd ? safeStart : safeEnd;
      const endDate = safeStart <= safeEnd ? safeEnd : safeStart;
      return {
        startDate,
        endDate,
        label: `${format(parseISO(startDate), "dd MMM yyyy", { locale: ptBR })} - ${format(parseISO(endDate), "dd MMM yyyy", { locale: ptBR })}`,
      };
    }

    const base = new Date(selectedYear, selectedMonth - 1, 1);
    return {
      startDate: format(startOfMonth(base), "yyyy-MM-dd"),
      endDate: format(endOfMonth(base), "yyyy-MM-dd"),
      label: `${MONTHS[selectedMonth - 1]} ${selectedYear}`,
    };
  }, [customEnd, customStart, mode, now, selectedMonth, selectedYear]);

  const { data: report, isLoading, isError } = useGetReportsV2({
    startDate: period.startDate,
    endDate: period.endDate,
  });

  const areaRows = useMemo(() => {
    if (!report) return [];
    return [
      { name: "Festas no Espaço", ...report.areas.venueEvents },
      { name: "Serviços Externos", ...report.areas.externalEvents },
      { name: "Workshops/Formações", ...report.areas.workshops },
    ];
  }, [report]);

  const exportCsv = () => {
    if (!report) return;

    const rows = [
      ["Período", period.startDate, period.endDate],
      ["Resumo", "Receita total", report.summary.totalRevenue],
      ["Resumo", "Recebido", report.summary.totalReceived],
      ["Resumo", "Por receber", report.summary.totalPending],
      ["Resumo", "Eventos", report.summary.eventCount],
      ["Resumo", "Ticket médio", report.summary.averageTicket],
      ...areaRows.map((area) => [area.name, "Receita", area.revenue]),
      ...areaRows.map((area) => [area.name, "Recebido", area.received]),
      ...areaRows.map((area) => [area.name, "Por receber", area.pending]),
    ];

    downloadCsv(rows.map((row) => row.map(csv).join(",")).join("\n"), `relatorio_v2_${period.startDate}_${period.endDate}.csv`);
  };

  return (
    <div className="space-y-4 md:space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-primary">Relatórios</h1>
          <p className="mt-1 text-sm md:text-base text-muted-foreground">
            Análise V2 por festas no espaço, serviços externos e workshops/formações.
          </p>
        </div>
        <Button variant="outline" onClick={exportCsv} disabled={!report} className="min-h-[40px] rounded-xl">
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
      ) : isError || !report ? (
        <EmptyState text="Não foi possível carregar os relatórios V2." />
      ) : (
        <>
          <div className="grid gap-3 grid-cols-2 xl:grid-cols-5">
            <MetricCard title="Receita total" value={euro(report.summary.totalRevenue)} icon={Euro} tone="emerald" />
            <MetricCard title="Recebido" value={euro(report.summary.totalReceived)} icon={TrendingUp} tone="teal" />
            <MetricCard title="Por receber" value={euro(report.summary.totalPending)} icon={Euro} tone="amber" />
            <MetricCard title="Eventos" value={String(report.summary.eventCount)} icon={CalendarDays} tone="pink" />
            <MetricCard title="Ticket médio" value={euro(report.summary.averageTicket)} icon={FileText} />
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Receita por área
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={areaRows} margin={{ top: 8, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(value) => `${value} €`} />
                      <Tooltip formatter={(value: number, name) => [euro(value), name === "received" ? "Recebido" : "Receita"]} />
                      <Bar dataKey="revenue" fill="#ec4899" radius={[6, 6, 0, 0]} name="Receita" />
                      <Bar dataKey="received" fill="#14b8a6" radius={[6, 6, 0, 0]} name="Recebido" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <PieChartIcon className="h-5 w-5 text-primary" />
                  Distribuição por eventos
                </CardTitle>
              </CardHeader>
              <CardContent>
                {areaRows.some((area) => area.eventCount > 0) ? (
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={areaRows}
                          cx="50%"
                          cy="50%"
                          outerRadius={90}
                          dataKey="eventCount"
                          nameKey="name"
                          label={({ eventCount }) => String(eventCount)}
                        >
                          {areaRows.map((_, index) => (
                            <Cell key={index} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number, name) => [value, name]} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <EmptyState text="Sem eventos neste período." />
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <AreaCard title="Festas no Espaço" summary={report.areas.venueEvents} />
            <AreaCard title="Serviços Externos" summary={report.areas.externalEvents} />
            <AreaCard title="Workshops/Formações" summary={report.areas.workshops} />
          </div>

          <section className="grid gap-4 xl:grid-cols-2">
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Star className="h-5 w-5 text-primary" />
                  Festas no Espaço
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <SmallMetric label="Festas" value={String(report.venueEvents.partyCount)} />
                  <SmallMetric label="Média crianças" value={String(report.venueEvents.averageChildren)} />
                  <SmallMetric label="Recebido" value={euro(report.venueEvents.received)} />
                  <SmallMetric label="Por receber" value={euro(report.venueEvents.pending)} />
                </div>
                <RankingCard title="Packs mais vendidos" icon={Star} rows={report.venueEvents.topPacks} />
                <RankingCard title="Receita por pack" icon={BarChart3} rows={report.venueEvents.revenueByPack} />
                <RankingCard title="Origem dos clientes" icon={Users} rows={report.venueEvents.sources} empty="Sem origem registada neste período." />
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <PackagePlus className="h-5 w-5 text-primary" />
                  Serviços Externos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <SmallMetric label="Eventos" value={String(report.externalEvents.eventCount)} />
                  <SmallMetric label="Ticket médio" value={euro(report.externalEvents.averageTicket)} />
                  <SmallMetric label="Recebido" value={euro(report.externalEvents.received)} />
                  <SmallMetric label="Por receber" value={euro(report.externalEvents.pending)} />
                </div>
                <RankingCard title="Serviços mais vendidos" icon={PackagePlus} rows={report.externalEvents.topServices} />
                <RankingCard title="Receita por serviço" icon={BarChart3} rows={report.externalEvents.revenueByServiceType} />
                <RankingCard title="Combinações de serviços" icon={PieChartIcon} rows={report.externalEvents.serviceCombinations} />
              </CardContent>
            </Card>
          </section>

          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-5 w-5 text-primary" />
                Workshops/Formações
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <SmallMetric label="Workshops" value={String(report.workshops.workshopCount)} />
                <SmallMetric label="Inscrições ativas" value={String(report.workshops.activeRegistrations)} />
                <SmallMetric label="Vagas ocupadas" value={String(report.workshops.occupiedSeats)} />
                <SmallMetric label="Vagas livres" value={String(report.workshops.freeSeats)} />
                <SmallMetric label="Taxa ocupação" value={`${report.workshops.occupancyRate}%`} />
                <SmallMetric label="Recebido" value={euro(report.workshops.received)} />
                <SmallMetric label="Por receber" value={euro(report.workshops.pending)} />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <PaymentStatusCard title="Pagos" value={report.workshops.participantsByPaymentStatus.paid} tone="emerald" />
                <PaymentStatusCard title="Parciais" value={report.workshops.participantsByPaymentStatus.partial} tone="amber" />
                <PaymentStatusCard title="Por pagar" value={report.workshops.participantsByPaymentStatus.unpaid} tone="pink" />
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
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

function AreaCard({ title, summary }: { title: string; summary: ReportsV2AreaSummary }) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3">
        <SmallMetric label="Eventos" value={String(summary.eventCount)} />
        <SmallMetric label="Ticket médio" value={euro(summary.averageTicket)} />
        <SmallMetric label="Receita" value={euro(summary.revenue)} />
        <SmallMetric label="Por receber" value={euro(summary.pending)} />
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
  rows: ReportsV2RevenueStat[];
  empty?: string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Icon className="h-4 w-4 text-primary" />
        {title}
      </div>
      {rows.length === 0 ? (
        <EmptyState text={empty} />
      ) : (
        rows.slice(0, 6).map((row, index) => (
          <div key={`${row.label}-${index}`} className="rounded-lg border border-border p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{row.label}</p>
                <p className="text-xs text-muted-foreground">
                  {row.count} registo{row.count === 1 ? "" : "s"} - {row.percentage}%
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
    </div>
  );
}

function SmallMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-bold">{value}</p>
    </div>
  );
}

function PaymentStatusCard({ title, value, tone }: { title: string; value: number; tone: "emerald" | "amber" | "pink" }) {
  const className =
    tone === "emerald"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : tone === "amber"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-primary/20 bg-primary/5 text-primary";

  return (
    <div className={`rounded-lg border p-3 ${className}`}>
      <p className="text-xs font-medium opacity-80">{title}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
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
