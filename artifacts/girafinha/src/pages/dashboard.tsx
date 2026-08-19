import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Calendar as CalendarIcon,
  ChevronRight,
  Clock,
  Euro,
  GraduationCap,
  Loader2,
  MapPin,
  PartyPopper,
  Plus,
  Wallet,
} from "lucide-react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useGetDashboardV2 } from "@workspace/api-client-react";
import type { DashboardV2AgendaItem, DashboardV2AreaSummary, DashboardV2WorkshopAreaSummary } from "@workspace/api-client-react";

const moneyFormatter = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR",
});

export default function Dashboard() {
  const { data, isLoading, isError, refetch } = useGetDashboardV2();

  if (isLoading) {
    return (
      <div className="flex min-h-[360px] items-center justify-center">
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm font-medium text-muted-foreground">A carregar painel...</span>
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex min-h-[360px] items-center justify-center">
        <Card className="max-w-md border-border/70 shadow-sm">
          <CardHeader>
            <CardTitle>Dashboard indisponível</CardTitle>
            <CardDescription>Não foi possível carregar o painel neste momento.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => refetch()} className="w-full rounded-xl">
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const nextEvents = data.agenda.slice(0, 3);
  const desktopNextEvents = data.agenda.slice(0, 6);

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500 md:relative md:left-1/2 md:w-[calc(100vw-20rem)] md:max-w-[1480px] md:-translate-x-1/2 md:space-y-5">
      <header className="flex items-center justify-between gap-3 md:items-start">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-primary md:text-3xl">Painel de gestão</h1>
          <p className="mt-1 hidden text-sm text-muted-foreground md:block md:text-base">
            Festas, serviços externos e workshops num só lugar.
          </p>
        </div>
        <NewItemMenu />
        <div className="hidden grid-cols-3 gap-2 md:grid">
          <QuickLink href="/venue-events" label="Nova festa" />
          <QuickLink href="/external-events" label="Novo serviço" />
          <QuickLink href="/workshops" label="Novo workshop" />
        </div>
      </header>

      <section className="grid grid-cols-2 gap-2 lg:grid-cols-4" aria-label="Indicadores gerais">
        <MetricCard title="Hoje" value={String(data.summary.todayCount)} helper="Itens marcados" icon={CalendarIcon} />
        <MetricCard title="Próximos 7 dias" value={String(data.summary.nextSevenDaysCount)} helper="Agenda ativa" icon={Clock} />
        <MetricCard
          title="Por receber"
          value={formatMoney(data.summary.totalPending)}
          helper="Eventos ativos"
          icon={Wallet}
          tone="danger"
        />
        <MetricCard
          title="Recebido"
          value={formatMoney(data.summary.totalReceived)}
          helper="Pagamentos registados"
          icon={Euro}
          tone="success"
        />
      </section>

      <section className="space-y-3 md:hidden" aria-labelledby="next-events-title">
        <div className="flex items-center justify-between gap-3">
          <h2 id="next-events-title" className="text-lg font-bold text-foreground">Próximos eventos</h2>
          <span className="text-xs font-medium text-muted-foreground">Até 3 eventos</span>
        </div>
        {nextEvents.length > 0 ? (
          <div className="space-y-2">
            {nextEvents.map((item) => (
              <CompactAgendaItem key={`${item.type}-${item.id}`} item={item} />
            ))}
          </div>
        ) : (
          <Card className="border-border/70 shadow-sm">
            <CardContent className="flex items-center gap-3 p-4 text-sm text-muted-foreground">
              <CalendarIcon className="h-5 w-5 shrink-0 text-primary/60" />
              Não há eventos próximos.
            </CardContent>
          </Card>
        )}
        <Button asChild variant="outline" className="min-h-11 w-full rounded-xl">
          <Link href="/calendar">
            Ver agenda completa
            <ChevronRight className="h-4 w-4" />
          </Link>
        </Button>
      </section>

      <section className="space-y-3 md:hidden" aria-labelledby="summary-title">
        <h2 id="summary-title" className="text-lg font-bold text-foreground">Resumo</h2>
        <div className="space-y-2">
          <CompactAreaCard
            title="Festas no Espaço"
            href="/venue-events"
            icon={PartyPopper}
            area={data.areas.venueEvents}
            tone="venue"
          />
          <CompactAreaCard
            title="Serviços Externos"
            href="/external-events"
            icon={MapPin}
            area={data.areas.externalEvents}
            tone="external"
          />
          <CompactAreaCard
            title="Workshops/Formações"
            href="/workshops"
            icon={GraduationCap}
            area={data.areas.workshops}
            tone="workshop"
          />
        </div>
      </section>

      <section
        className="hidden gap-4 md:grid lg:grid-cols-[minmax(0,2fr)_minmax(240px,1fr)]"
        aria-label="Visão operacional"
      >
        <Card className="overflow-hidden border-border/70 shadow-sm">
          <CardHeader className="flex-row items-center justify-between gap-3 border-b border-border/60 bg-card/70 py-4">
            <CardTitle className="text-lg xl:text-xl">Próximos eventos</CardTitle>
            <Badge variant="secondary" className="shrink-0 rounded-md">
              {desktopNextEvents.length} {desktopNextEvents.length === 1 ? "evento" : "eventos"}
            </Badge>
          </CardHeader>
          <CardContent className="p-0">
            {desktopNextEvents.length > 0 ? (
              <div className="divide-y divide-border/60">
                {desktopNextEvents.map((item) => (
                  <DesktopAgendaItem key={item.type + "-" + item.id} item={item} />
                ))}
              </div>
            ) : (
              <div className="flex min-h-[260px] flex-col items-center justify-center p-8 text-center text-muted-foreground">
                <CalendarIcon className="mb-3 h-10 w-10 text-muted-foreground/30" />
                <p className="font-medium text-foreground">Não há eventos próximos.</p>
                <p className="mt-1 text-sm">Os próximos eventos aparecerão aqui por ordem cronológica.</p>
              </div>
            )}
            <div className="border-t border-border/60 p-3">
              <Button asChild variant="ghost" size="sm" className="w-full justify-center rounded-xl">
                <Link href="/calendar">
                  Ver agenda completa
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <aside className="space-y-3" aria-labelledby="desktop-summary-title">
          <h2 id="desktop-summary-title" className="px-1 text-lg font-bold text-foreground">
            Resumo
          </h2>
          <DesktopAreaSummaryCard
            title="Festas no Espaço"
            href="/venue-events"
            icon={PartyPopper}
            area={data.areas.venueEvents}
            tone="venue"
          />
          <DesktopAreaSummaryCard
            title="Serviços Externos"
            href="/external-events"
            icon={MapPin}
            area={data.areas.externalEvents}
            tone="external"
          />
          <DesktopAreaSummaryCard
            title="Workshops/Formações"
            href="/workshops"
            icon={GraduationCap}
            area={data.areas.workshops}
            tone="workshop"
          />
        </aside>
      </section>
    </div>
  );
}

function NewItemMenu() {
  const actionClass = "flex min-h-12 w-full items-center gap-3 rounded-xl border border-border px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted";

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button className="min-h-10 shrink-0 rounded-full px-4 shadow-sm md:hidden">
          <Plus className="h-4 w-4" />
          Novo
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-2xl pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <SheetHeader className="text-left">
          <SheetTitle>Novo registo</SheetTitle>
          <SheetDescription>Escolha o tipo de atividade que pretende criar.</SheetDescription>
        </SheetHeader>
        <div className="mt-2 grid gap-2">
          <SheetClose asChild>
            <Link href="/venue-events" className={actionClass}>
              <PartyPopper className="h-5 w-5 text-pink-700" />
              Nova festa
            </Link>
          </SheetClose>
          <SheetClose asChild>
            <Link href="/external-events" className={actionClass}>
              <MapPin className="h-5 w-5 text-sky-700" />
              Novo serviço
            </Link>
          </SheetClose>
          <SheetClose asChild>
            <Link href="/workshops" className={actionClass}>
              <GraduationCap className="h-5 w-5 text-violet-700" />
              Novo workshop
            </Link>
          </SheetClose>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <Button asChild variant="outline" className="min-h-[40px] rounded-full">
      <Link href={href}>{label}</Link>
    </Button>
  );
}

function MetricCard({
  title,
  value,
  helper,
  icon: Icon,
  tone,
}: {
  title: string;
  value: string;
  helper: string;
  icon: typeof CalendarIcon;
  tone?: "success" | "danger";
}) {
  const toneClass = tone === "success" ? "text-emerald-700" : tone === "danger" ? "text-rose-700" : "text-foreground";

  return (
    <Card className="border-border/70 shadow-sm">
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">{title}</p>
            <p className={`mt-1 break-words text-lg font-bold sm:text-2xl md:text-xl xl:text-2xl ${toneClass}`}>{value}</p>
            <p className="mt-1 hidden text-xs text-muted-foreground sm:block">{helper}</p>
          </div>
          <div className="rounded-full bg-primary/10 p-1.5 text-primary sm:p-2">
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CompactAgendaItem({ item }: { item: DashboardV2AgendaItem }) {
  const date = parseISO(item.date);
  const primaryService = item.services[0];

  return (
    <Link
      href={item.href}
      className="flex min-h-[116px] items-center gap-3 rounded-2xl border border-border/70 bg-card p-3 shadow-sm transition-colors active:bg-muted/50"
      aria-label={`Abrir ${item.typeLabel}: ${item.title}`}
    >
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold uppercase tracking-wide text-primary">
          {format(date, "dd MMM", { locale: ptBR }).replace(".", "")} · {item.time}
        </p>
        <div className="mt-1.5 flex items-center gap-2">
          <Badge className={agendaBadgeClass(item.type)}>{item.typeLabel}</Badge>
        </div>
        <p className="mt-1.5 truncate font-bold text-foreground">{item.title}</p>
        {primaryService && <p className="mt-0.5 truncate text-sm text-muted-foreground">{primaryService}</p>}
        {item.pending > 0 && <p className="mt-1 text-sm font-bold text-rose-700">Falta {formatMoney(item.pending)}</p>}
      </div>
      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
    </Link>
  );
}

function CompactAreaCard({
  title,
  href,
  icon: Icon,
  area,
  tone,
}: {
  title: string;
  href: string;
  icon: typeof PartyPopper;
  area: DashboardV2AreaSummary | DashboardV2WorkshopAreaSummary;
  tone: "venue" | "external" | "workshop";
}) {
  return (
    <Link
      href={href}
      className="flex min-h-[92px] items-center gap-3 rounded-2xl border border-border/70 bg-card p-3 shadow-sm transition-colors active:bg-muted/50"
    >
      <div className={`rounded-full p-2 ${areaToneClass(tone)}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-bold text-foreground">{title}</p>
        {area.upcomingCount > 0 ? (
          <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
            <p><span className="font-semibold text-foreground">{area.upcomingCount}</span> próximas · <span className="font-semibold text-foreground">{area.nextSevenDaysCount}</span> nos próximos 7 dias</p>
            <p><span className="font-semibold text-rose-700">{formatMoney(area.pending)}</span> por receber</p>
          </div>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">Nenhum próximo</p>
        )}
      </div>
      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
    </Link>
  );
}

function DesktopAgendaItem({ item }: { item: DashboardV2AgendaItem }) {
  const date = parseISO(item.date);
  const primaryService = item.services[0];

  return (
    <Link
      href={item.href}
      className="grid min-h-[78px] grid-cols-[82px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      aria-label={"Abrir " + item.typeLabel + ": " + item.title}
    >
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-wide text-primary">
          {format(date, "dd MMM", { locale: ptBR }).replace(".", "")}
        </p>
        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          {item.time}
        </p>
      </div>

      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <Badge className={agendaBadgeClass(item.type)}>{item.typeLabel}</Badge>
          <p className="truncate font-semibold text-foreground">{item.title}</p>
        </div>
        {primaryService || item.location ? (
          <div className="mt-1.5 flex min-w-0 items-center gap-3 text-xs text-muted-foreground">
            {primaryService ? <span className="truncate font-medium text-foreground/80">{primaryService}</span> : null}
            {item.location ? (
              <span className="flex min-w-0 items-center gap-1">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{item.location}</span>
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {item.pending > 0 ? (
          <div className="text-right">
            <p className="text-xs font-bold text-rose-700">Falta {formatMoney(item.pending)}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{paymentLabel(item.paymentStatus)}</p>
          </div>
        ) : (
          <Badge className={paymentBadgeClass(item.paymentStatus)}>{paymentLabel(item.paymentStatus)}</Badge>
        )}
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>
    </Link>
  );
}

function DesktopAreaSummaryCard({
  title,
  href,
  icon: Icon,
  area,
  tone,
}: {
  title: string;
  href: string;
  icon: typeof PartyPopper;
  area: DashboardV2AreaSummary | DashboardV2WorkshopAreaSummary;
  tone: "venue" | "external" | "workshop";
}) {
  return (
    <Link
      href={href}
      className="block rounded-2xl border border-border/70 bg-card p-4 shadow-sm transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-center gap-3">
        <div className={"rounded-full p-2 " + areaToneClass(tone)}>
          <Icon className="h-5 w-5" />
        </div>
        <p className="min-w-0 flex-1 font-bold text-foreground">{title}</p>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </div>

      {area.upcomingCount > 0 ? (
        <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm text-muted-foreground">
          <p><span className="font-bold text-foreground">{area.upcomingCount}</span> próximas</p>
          <p><span className="font-bold text-foreground">{area.nextSevenDaysCount}</span> em 7 dias</p>
          <p className="col-span-2 border-t border-border/60 pt-2">
            <span className="font-bold text-rose-700">{formatMoney(area.pending)}</span> por receber
          </p>
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">Nenhum próximo</p>
      )}
    </Link>
  );
}

function areaToneClass(tone: "venue" | "external" | "workshop") {
  if (tone === "external") return "bg-sky-100 text-sky-800";
  if (tone === "workshop") return "bg-violet-100 text-violet-800";
  return "bg-pink-100 text-pink-800";
}

function agendaBadgeClass(type: DashboardV2AgendaItem["type"]) {
  if (type === "external_events") return "rounded-md border-none bg-sky-100 text-sky-800 hover:bg-sky-100";
  if (type === "workshops") return "rounded-md border-none bg-violet-100 text-violet-800 hover:bg-violet-100";
  return "rounded-md border-none bg-pink-100 text-pink-800 hover:bg-pink-100";
}

function paymentBadgeClass(status: DashboardV2AgendaItem["paymentStatus"]) {
  if (status === "paid") return "rounded-md border-none bg-emerald-100 text-emerald-800 hover:bg-emerald-100";
  if (status === "partial") return "rounded-md border-none bg-amber-100 text-amber-800 hover:bg-amber-100";
  if (status === "unpaid") return "rounded-md border-none bg-rose-100 text-rose-800 hover:bg-rose-100";
  return "rounded-md border-none bg-muted text-muted-foreground hover:bg-muted";
}

function paymentLabel(status: DashboardV2AgendaItem["paymentStatus"]) {
  if (status === "paid") return "Pago";
  if (status === "partial") return "Sinal";
  if (status === "unpaid") return "Pendente";
  return "Sem pagamento";
}

function formatMoney(value: number) {
  return moneyFormatter.format(value);
}
