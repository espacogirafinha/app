import { useMemo, useState } from "react";
import { endOfMonth, endOfYear, format, parseISO, startOfMonth, startOfYear } from "date-fns";
import { pt } from "date-fns/locale";
import {
  BarChart3,
  CalendarDays,
  ChevronDown,
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
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useGetReportsV2,
  type ReportsV2,
  type ReportsV2AreaSummary,
  type ReportsV2RevenueStat,
} from "@workspace/api-client-react";

type PeriodMode = "month" | "year" | "custom";
type AreaRow = ReportsV2AreaSummary & { name: string; shortName: string };

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const COLORS = ["#ec4899", "#14b8a6", "#8b5cf6"];
const euro = (value: number) => `${value.toFixed(2)} €`;

export default function ReportsPage() {
  const now = new Date();
  const [mode, setMode] = useState<PeriodMode>("month");
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [customStart, setCustomStart] = useState(format(startOfMonth(now), "yyyy-MM-dd"));
  const [customEnd, setCustomEnd] = useState(format(endOfMonth(now), "yyyy-MM-dd"));
  const [mobileDetailsOpen, setMobileDetailsOpen] = useState(false);

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
        label: `${format(parseISO(startDate), "dd MMM yyyy", { locale: pt })} – ${format(parseISO(endDate), "dd MMM yyyy", { locale: pt })}`,
      };
    }
    const base = new Date(selectedYear, selectedMonth - 1, 1);
    return {
      startDate: format(startOfMonth(base), "yyyy-MM-dd"),
      endDate: format(endOfMonth(base), "yyyy-MM-dd"),
      label: `${MONTHS[selectedMonth - 1]} ${selectedYear}`,
    };
  }, [customEnd, customStart, mode, now, selectedMonth, selectedYear]);

  const { data: report, isLoading, isError } = useGetReportsV2({ startDate: period.startDate, endDate: period.endDate });
  const areaRows = useMemo<AreaRow[]>(() => report ? [
    { name: "Festas no Espaço", shortName: "Festas", ...report.areas.venueEvents },
    { name: "Serviços Externos", shortName: "Serviços", ...report.areas.externalEvents },
    { name: "Workshops/Formações", shortName: "Workshops", ...report.areas.workshops },
  ] : [], [report]);

  const exportCsv = () => {
    if (!report) return;
    const rows: Array<Array<string | number>> = [
      ["Período", period.startDate, period.endDate],
      ["Resumo", "Receita total", report.summary.totalRevenue],
      ["Resumo", "Recebido", report.summary.totalReceived],
      ["Resumo", "Por receber", report.summary.totalPending],
      ["Resumo", "Cauções em posse", report.summary.heldDeposits],
      ...(report.summary.retainedDeposits > 0 ? [["Resumo", "Cauções retidas", report.summary.retainedDeposits]] : []),
      ["Resumo", "Eventos", report.summary.eventCount],
      ["Resumo", "Ticket médio", report.summary.averageTicket],
      ...areaRows.flatMap((area) => [
        [area.name, "Receita", area.revenue],
        [area.name, "Recebido", area.received],
        [area.name, "Por receber", area.pending],
        ...(area.heldDeposits > 0 ? [[area.name, "Cauções em posse", area.heldDeposits]] : []),
        ...(area.retainedDeposits > 0 ? [[area.name, "Cauções retidas", area.retainedDeposits]] : []),
      ]),
    ];
    downloadCsv(rows.map((row) => row.map(csv).join(",")).join("\n"), `relatorio_${period.startDate}_${period.endDate}.csv`);
  };

  return (
    <div className="animate-in space-y-4 overflow-x-hidden fade-in slide-in-from-bottom-4 duration-500 md:space-y-6">
      <header className="flex items-center justify-between gap-3 md:items-start">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-primary md:text-3xl">Relatórios</h1>
          <p className="mt-1 hidden text-base text-muted-foreground sm:block">
            Análise de festas, serviços externos e workshops/formações.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={!report} className="min-h-10 shrink-0 rounded-xl px-3 md:px-4">
          <Download className="h-4 w-4" />
          Exportar CSV
        </Button>
      </header>

      <PeriodFilters
        mode={mode}
        setMode={setMode}
        selectedMonth={selectedMonth}
        setSelectedMonth={setSelectedMonth}
        selectedYear={selectedYear}
        setSelectedYear={setSelectedYear}
        customStart={customStart}
        setCustomStart={setCustomStart}
        customEnd={customEnd}
        setCustomEnd={setCustomEnd}
        label={period.label}
      />

      {isLoading ? (
        <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary/50" /></div>
      ) : isError || !report ? (
        <EmptyState text="Não foi possível carregar os relatórios." />
      ) : (
        <>
          <section aria-label="Indicadores principais" className="grid grid-cols-2 gap-2.5 md:grid-cols-5 md:gap-3">
            <MetricCard title="Receita" value={euro(report.summary.totalRevenue)} icon={Euro} tone="emerald" />
            <MetricCard title="Recebido" value={euro(report.summary.totalReceived)} icon={TrendingUp} tone="teal" />
            <MetricCard title="Por receber" value={euro(report.summary.totalPending)} icon={Euro} tone="amber" />
            <MetricCard title="Eventos" value={String(report.summary.eventCount)} icon={CalendarDays} tone="pink" />
            <MetricCard title="Ticket médio" value={euro(report.summary.averageTicket)} icon={FileText} className="col-span-2 hidden md:block md:col-span-1" />
          </section>

          <div className="grid grid-cols-2 gap-2 rounded-xl border border-border/70 bg-muted/30 p-2 text-xs md:flex md:justify-end md:gap-6 md:px-4">
            <div className="flex items-center justify-between gap-3 rounded-lg bg-background px-2.5 py-2 md:hidden">
              <span className="text-muted-foreground">Ticket médio</span>
              <strong>{euro(report.summary.averageTicket)}</strong>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg bg-background px-2.5 py-2 md:bg-transparent md:px-0">
              <span className="text-muted-foreground">Cauções em posse</span>
              <strong className="text-violet-700">{euro(report.summary.heldDeposits)}</strong>
            </div>
            {report.summary.retainedDeposits > 0 ? (
              <div className="col-span-2 flex items-center justify-between gap-3 rounded-lg bg-background px-2.5 py-2 md:bg-transparent md:px-0">
                <span className="text-muted-foreground">Cauções retidas</span>
                <strong className="text-violet-700">{euro(report.summary.retainedDeposits)}</strong>
              </div>
            ) : null}
          </div>

          <section className="space-y-2 md:hidden">
            <h2 className="text-base font-semibold">Resumo por área</h2>
            {areaRows.map((area) => <MobileAreaCard key={area.name} area={area} />)}
          </section>

          <section className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(290px,34%)]">
            <RevenueChart rows={areaRows} />
            <div className="hidden md:block"><DistributionChart rows={areaRows} /></div>
          </section>

          <div className="md:hidden">
            <Button
              variant="outline"
              className="min-h-11 w-full justify-between rounded-xl"
              aria-expanded={mobileDetailsOpen}
              onClick={() => setMobileDetailsOpen((open) => !open)}
            >
              Mais detalhes
              <ChevronDown className={`h-4 w-4 transition-transform ${mobileDetailsOpen ? "rotate-180" : ""}`} />
            </Button>
            {mobileDetailsOpen && (
              <div className="mt-3 space-y-4">
                <DistributionChart rows={areaRows} compact />
                <AreaDetails report={report} mobile />
              </div>
            )}
          </div>

          <div className="hidden md:block"><AreaDetails report={report} /></div>
        </>
      )}
    </div>
  );
}

type PeriodFiltersProps = {
  mode: PeriodMode;
  setMode: (mode: PeriodMode) => void;
  selectedMonth: number;
  setSelectedMonth: (month: number) => void;
  selectedYear: number;
  setSelectedYear: (year: number) => void;
  customStart: string;
  setCustomStart: (date: string) => void;
  customEnd: string;
  setCustomEnd: (date: string) => void;
  label: string;
};

function PeriodFilters(props: PeriodFiltersProps) {
  const monthValue = `${props.selectedYear}-${String(props.selectedMonth).padStart(2, "0")}`;
  const updateMonth = (value: string) => {
    const [year, month] = value.split("-").map(Number);
    if (year && month) { props.setSelectedYear(year); props.setSelectedMonth(month); }
  };

  return (
    <Card className="border-border/70 shadow-sm">
      <CardContent className="grid gap-2.5 p-3 md:grid-cols-[160px_1fr] md:p-4 lg:grid-cols-[160px_180px_130px_1fr]">
        <Select value={props.mode} onValueChange={(value) => props.setMode(value as PeriodMode)}>
          <SelectTrigger aria-label="Tipo de período"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="month">Mês</SelectItem>
            <SelectItem value="year">Ano</SelectItem>
            <SelectItem value="custom">Intervalo</SelectItem>
          </SelectContent>
        </Select>

        {props.mode === "month" && (
          <>
            <Input className="md:hidden" type="month" aria-label="Mês do relatório" value={monthValue} onChange={(event) => updateMonth(event.target.value)} />
            <Select value={String(props.selectedMonth)} onValueChange={(value) => props.setSelectedMonth(Number(value))}>
              <SelectTrigger className="hidden md:flex" aria-label="Mês"><SelectValue /></SelectTrigger>
              <SelectContent>{MONTHS.map((month, index) => <SelectItem key={month} value={String(index + 1)}>{month}</SelectItem>)}</SelectContent>
            </Select>
            <YearInput className="hidden md:flex" value={props.selectedYear} onChange={props.setSelectedYear} />
          </>
        )}
        {props.mode === "year" && <YearInput value={props.selectedYear} onChange={props.setSelectedYear} />}
        {props.mode === "custom" && (
          <div className="grid grid-cols-2 gap-2 md:contents">
            <Input type="date" aria-label="Data inicial" value={props.customStart} onChange={(event) => props.setCustomStart(event.target.value)} />
            <Input type="date" aria-label="Data final" value={props.customEnd} onChange={(event) => props.setCustomEnd(event.target.value)} />
          </div>
        )}
        <div className="hidden items-center rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm font-medium lg:flex">{props.label}</div>
      </CardContent>
    </Card>
  );
}

function YearInput({ value, onChange, className = "" }: { value: number; onChange: (value: number) => void; className?: string }) {
  return <Input className={className} aria-label="Ano" type="number" min="2020" max="2100" value={value} onChange={(event) => onChange(Number(event.target.value) || new Date().getFullYear())} />;
}

function MetricCard({ title, value, icon: Icon, tone, className = "" }: {
  title: string; value: string; icon: React.ElementType; tone?: "emerald" | "teal" | "amber" | "pink"; className?: string;
}) {
  const toneClass = tone === "emerald" ? "bg-emerald-50 border-emerald-200 text-emerald-800"
    : tone === "teal" ? "bg-teal-50 border-teal-200 text-teal-800"
      : tone === "amber" ? "bg-amber-50 border-amber-200 text-amber-800"
        : tone === "pink" ? "bg-primary/5 border-primary/20 text-primary" : "bg-card text-foreground";
  return (
    <Card className={`shadow-sm ${toneClass} ${className}`}>
      <CardContent className="p-3 md:p-4">
        <div className="mb-1.5 flex items-center justify-between"><p className="text-[11px] font-medium opacity-80 md:text-xs">{title}</p><Icon className="h-4 w-4 opacity-70" /></div>
        <p className="truncate text-lg font-bold md:text-2xl">{value}</p>
      </CardContent>
    </Card>
  );
}

function MobileAreaCard({ area }: { area: AreaRow }) {
  return (
    <Card className="shadow-sm"><CardContent className="p-3">
      <div className="flex items-center justify-between gap-3"><h3 className="truncate text-sm font-semibold">{area.name}</h3><span className="shrink-0 text-xs text-muted-foreground">{area.eventCount} evento{area.eventCount === 1 ? "" : "s"}</span></div>
      {area.eventCount === 0 ? <p className="mt-1.5 text-xs text-muted-foreground">Nenhum neste período</p> : (
        <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
          <span className="text-muted-foreground">Receita</span><strong className="text-right">{euro(area.revenue)}</strong>
          <span className="text-muted-foreground">Por receber</span><strong className="text-right text-amber-700">{area.pending > 0 ? euro(area.pending) : "Pago"}</strong>
          {area.heldDeposits > 0 && <><span className="text-muted-foreground">Cauções em posse</span><strong className="text-right text-violet-700">{euro(area.heldDeposits)}</strong></>}
          {area.retainedDeposits > 0 && <><span className="text-muted-foreground">Cauções retidas</span><strong className="text-right text-violet-700">{euro(area.retainedDeposits)}</strong></>}
        </div>
      )}
    </CardContent></Card>
  );
}

function RevenueChart({ rows }: { rows: AreaRow[] }) {
  const data = rows.filter((area) => area.revenue > 0 || area.received > 0);
  return (
    <Card className="min-w-0 shadow-sm">
      <CardHeader className="p-4 pb-1"><CardTitle className="flex items-center gap-2 text-base"><BarChart3 className="h-5 w-5 text-primary" />Receita por área</CardTitle></CardHeader>
      <CardContent className="p-2 pt-0 md:p-4 md:pt-0">
        {data.length === 0 ? <EmptyState text="Sem receita neste período." /> : (
          <div className="h-60 min-w-0 md:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 12, right: 6, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="shortName" tick={{ fontSize: 11 }} interval={0} />
                <YAxis width={58} tick={{ fontSize: 10 }} tickFormatter={(value) => `${value} €`} />
                <Tooltip formatter={(value: number, name) => [euro(value), name === "received" ? "Recebido" : "Receita"]} />
                <Bar dataKey="revenue" fill="#ec4899" radius={[5, 5, 0, 0]} name="Receita" />
                <Bar dataKey="received" fill="#14b8a6" radius={[5, 5, 0, 0]} name="Recebido" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DistributionChart({ rows, compact = false }: { rows: AreaRow[]; compact?: boolean }) {
  const data = rows.filter((area) => area.eventCount > 0);
  return (
    <Card className="min-w-0 shadow-sm">
      <CardHeader className="p-4 pb-1"><CardTitle className="flex items-center gap-2 text-base"><PieChartIcon className="h-5 w-5 text-primary" />Distribuição por eventos</CardTitle></CardHeader>
      <CardContent className="p-2 pt-0 md:p-4 md:pt-0">
        {data.length === 0 ? <EmptyState text="Sem eventos neste período." /> : (
          <div className={compact ? "h-52" : "h-72"}>
            <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data} cx="50%" cy="50%" outerRadius={compact ? 68 : 90} dataKey="eventCount" nameKey="name" label={({ eventCount }) => String(eventCount)}>
              {data.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
            </Pie><Tooltip formatter={(value: number, name) => [value, name]} /></PieChart></ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AreaDetails({ report, mobile = false }: { report: ReportsV2; mobile?: boolean }) {
  const externalMetrics: Array<[string, string | number]> = [
    ["Eventos", report.externalEvents.eventCount],
    ["Ticket médio", euro(report.externalEvents.averageTicket)],
    ["Recebido", euro(report.externalEvents.received)],
    ["Por receber", euro(report.externalEvents.pending)],
  ];
  if (report.externalEvents.heldDeposits > 0) externalMetrics.push(["Cauções em posse", euro(report.externalEvents.heldDeposits)]);
  if (report.externalEvents.retainedDeposits > 0) externalMetrics.push(["Cauções retidas", euro(report.externalEvents.retainedDeposits)]);

  const sectionClass = mobile ? "space-y-4" : "grid gap-4 xl:grid-cols-2";
  return (
    <section className={sectionClass} aria-label="Detalhes por área">
      <DetailCard title="Festas no Espaço" icon={Star} empty={report.venueEvents.partyCount === 0} mobile={mobile}>
        <MetricStrip items={[
          ["Festas", report.venueEvents.partyCount], ["Ticket médio", euro(report.areas.venueEvents.averageTicket)],
          ["Média crianças", report.venueEvents.averageChildren], ["Por receber", euro(report.venueEvents.pending)],
        ]} />
        <RankingCard title="Packs mais vendidos" icon={Star} rows={report.venueEvents.topPacks} />
        <RankingCard title="Receita por pack" icon={BarChart3} rows={report.venueEvents.revenueByPack} />
        <RankingCard title="Origem dos clientes" icon={Users} rows={report.venueEvents.sources} empty="Sem origem registada neste período." />
      </DetailCard>

      <DetailCard title="Serviços Externos" icon={PackagePlus} empty={report.externalEvents.eventCount === 0} mobile={mobile}>
        <MetricStrip items={externalMetrics} />
        <RankingCard title="Serviços mais vendidos" icon={PackagePlus} rows={report.externalEvents.topServices} />
        <RankingCard title="Receita por serviço" icon={BarChart3} rows={report.externalEvents.revenueByServiceType} />
        <RankingCard title="Combinações de serviços" icon={PieChartIcon} rows={report.externalEvents.serviceCombinations} />
      </DetailCard>

      <DetailCard title="Workshops/Formações" icon={Users} empty={report.workshops.workshopCount === 0} mobile={mobile} className="xl:col-span-2">
        <MetricStrip items={[
          ["Workshops", report.workshops.workshopCount], ["Inscrições", report.workshops.activeRegistrations],
          ["Vagas livres", report.workshops.freeSeats], ["Taxa de ocupação", `${report.workshops.occupancyRate}%`],
          ["Recebido", euro(report.workshops.received)], ["Por receber", euro(report.workshops.pending)],
        ]} />
        <div className="grid grid-cols-3 gap-2">
          <PaymentStatusCard title="Pagos" value={report.workshops.participantsByPaymentStatus.paid} tone="emerald" />
          <PaymentStatusCard title="Parciais" value={report.workshops.participantsByPaymentStatus.partial} tone="amber" />
          <PaymentStatusCard title="Por pagar" value={report.workshops.participantsByPaymentStatus.unpaid} tone="pink" />
        </div>
      </DetailCard>
    </section>
  );
}

function DetailCard({ title, icon: Icon, empty, mobile, className = "", children }: {
  title: string; icon: React.ElementType; empty: boolean; mobile: boolean; className?: string; children: React.ReactNode;
}) {
  return (
    <Card className={`shadow-sm ${className}`}>
      <CardHeader className="p-4 pb-2"><CardTitle className="flex items-center gap-2 text-base"><Icon className="h-5 w-5 text-primary" />{title}</CardTitle></CardHeader>
      <CardContent className="space-y-4 p-4 pt-1">{empty ? <EmptyState text="Nenhum neste período." /> : children}</CardContent>
    </Card>
  );
}

function MetricStrip({ items }: { items: Array<[string, string | number]> }) {
  return <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">{items.map(([label, value]) => <SmallMetric key={label} label={label} value={String(value)} />)}</div>;
}

function RankingCard({ title, icon: Icon, rows, empty = "Sem dados neste período." }: {
  title: string; icon: React.ElementType; rows: ReportsV2RevenueStat[]; empty?: string;
}) {
  if (rows.length === 0) return null;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-semibold"><Icon className="h-4 w-4 text-primary" />{title}</div>
      {rows.slice(0, 6).map((row, index) => (
        <div key={`${row.label}-${index}`} className="rounded-lg border border-border p-2.5">
          <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="break-words text-sm font-semibold">{row.label}</p><p className="text-xs text-muted-foreground">{row.count} registo{row.count === 1 ? "" : "s"} · {row.percentage}%</p></div><p className="shrink-0 text-sm font-bold text-emerald-700">{euro(row.revenue)}</p></div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${Math.min(100, row.percentage)}%`, backgroundColor: COLORS[index % COLORS.length] }} /></div>
        </div>
      ))}
    </div>
  );
}

function SmallMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-border p-2.5"><p className="text-[11px] text-muted-foreground">{label}</p><p className="mt-0.5 text-base font-bold">{value}</p></div>;
}

function PaymentStatusCard({ title, value, tone }: { title: string; value: number; tone: "emerald" | "amber" | "pink" }) {
  const className = tone === "emerald" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : tone === "amber" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-primary/20 bg-primary/5 text-primary";
  return <div className={`rounded-lg border p-2.5 ${className}`}><p className="text-[11px] font-medium opacity-80">{title}</p><p className="mt-0.5 text-xl font-bold">{value}</p></div>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">{text}</div>;
}

function csv(value: string | number) { return `"${String(value).replace(/"/g, '""')}"`; }
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
