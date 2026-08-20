import { useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  isSameMonth,
  parseISO,
  startOfMonth,
  subMonths,
} from "date-fns";
import { pt } from "date-fns/locale";
import { CalendarDays, ChevronLeft, ChevronRight, Clock, Loader2, MapPin, Users } from "lucide-react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { useGetCalendarV2 } from "@workspace/api-client-react";
import type { CalendarV2Day, CalendarV2Item } from "@workspace/api-client-react";

const PORTUGAL_TIME_ZONE = "Europe/Lisbon";
const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const MOBILE_WEEKDAYS = ["S", "T", "Q", "Q", "S", "S", "D"];

const moneyFormatter = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR",
});

type CalendarFilter = "all" | CalendarV2Item["type"];
type MobileView = "agenda" | "month";

export default function CalendarPage() {
  const todayKey = getPortugalDateKey();
  const [currentDate, setCurrentDate] = useState(() => parseISO(todayKey));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [filter, setFilter] = useState<CalendarFilter>("all");
  const [mobileView, setMobileView] = useState<MobileView>("agenda");
  const isMobile = useIsMobile();

  const monthStart = useMemo(() => startOfMonth(currentDate), [currentDate]);
  const monthEnd = useMemo(() => endOfMonth(currentDate), [currentDate]);
  const startDate = format(monthStart, "yyyy-MM-dd");
  const endDate = format(monthEnd, "yyyy-MM-dd");
  const { data, isLoading } = useGetCalendarV2({ startDate, endDate });

  const gridDays = useMemo(() => {
    const intervalStart = new Date(monthStart);
    intervalStart.setDate(monthStart.getDate() - (monthStart.getDay() === 0 ? 6 : monthStart.getDay() - 1));
    const intervalEnd = new Date(monthEnd);
    intervalEnd.setDate(monthEnd.getDate() + (intervalEnd.getDay() === 0 ? 0 : 7 - intervalEnd.getDay()));
    return eachDayOfInterval({ start: intervalStart, end: intervalEnd });
  }, [monthEnd, monthStart]);

  const daysByDate = useMemo(() => new Map((data?.days ?? []).map((day) => [day.date, day])), [data?.days]);
  const spaceSlotsTotal = data?.days[0]?.spaceSlotsTotal ?? 2;
  const selectedDay = selectedDate ? daysByDate.get(selectedDate) ?? emptyDay(selectedDate, spaceSlotsTotal) : null;
  const filteredItems = useMemo(() => filterCalendarItems(data?.items ?? [], filter), [data?.items, filter]);
  const agendaGroups = useMemo(
    () => groupAgendaItems(filteredItems, currentDate, todayKey),
    [currentDate, filteredItems, todayKey],
  );

  const goToToday = () => setCurrentDate(parseISO(todayKey));
  const openDay = (date: string) => {
    setSelectedDate(date);
    setDetailsOpen(true);
  };

  return (
    <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500 md:space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-primary md:text-3xl">Calendário</h1>
        <p className="mt-1 hidden text-sm text-muted-foreground md:block md:text-base">
          Festas, serviços externos e workshops com ocupação real do espaço.
        </p>
      </header>

      <CalendarSummary days={data?.days ?? []} externalItems={data?.summary.externalItems ?? 0} />

      <Tabs
        value={mobileView}
        onValueChange={(value) => setMobileView(value as MobileView)}
        className="md:hidden"
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="agenda">Agenda</TabsTrigger>
          <TabsTrigger value="month">Mês</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card className="overflow-hidden border-border/70 shadow-sm">
        <CardHeader className="space-y-3 border-b border-border/60 bg-card/70 p-3 md:p-4">
          <CalendarToolbar
            currentDate={currentDate}
            loading={isLoading}
            onToday={goToToday}
            onPrevious={() => setCurrentDate((date) => subMonths(date, 1))}
            onNext={() => setCurrentDate((date) => addMonths(date, 1))}
          />
          <TypeFilters value={filter} onChange={setFilter} />
        </CardHeader>

        <CardContent className="p-0">
          <div className="hidden md:block">
            <DesktopMonthView
              currentDate={currentDate}
              daysByDate={daysByDate}
              filter={filter}
              gridDays={gridDays}
              spaceSlotsTotal={spaceSlotsTotal}
              todayKey={todayKey}
              onSelectDate={openDay}
            />
          </div>

          <div className="md:hidden">
            {mobileView === "agenda" ? (
              <MobileAgenda groups={agendaGroups} loading={isLoading} />
            ) : (
              <MobileMonthView
                currentDate={currentDate}
                daysByDate={daysByDate}
                filter={filter}
                gridDays={gridDays}
                spaceSlotsTotal={spaceSlotsTotal}
                todayKey={todayKey}
                onSelectDate={openDay}
              />
            )}
          </div>
        </CardContent>
      </Card>

      <CalendarLegend />

      <DayDetailsSheet
        day={selectedDay}
        filter={filter}
        isMobile={isMobile}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
      />
    </div>
  );
}

function CalendarSummary({ days, externalItems }: { days: CalendarV2Day[]; externalItems: number }) {
  const summary = useMemo(() => summarizeOccupancy(days), [days]);
  const metrics = [
    { label: "Dias livres", value: summary.freeDays, tone: "text-emerald-700" },
    { label: "Quase cheios", value: summary.almostFullDays, tone: "text-amber-700" },
    { label: "Lotados", value: summary.fullDays, tone: "text-rose-700" },
    { label: "Serviços externos", value: externalItems, tone: "text-blue-700" },
  ];

  return (
    <section aria-label="Resumo do mês">
      <Card className="border-border/70 shadow-sm">
        <CardContent className="grid grid-cols-2 gap-x-3 gap-y-3 p-3 md:grid-cols-4 md:gap-4 md:p-4">
          {metrics.map((metric) => (
            <div key={metric.label} className="min-w-0">
              <p className="truncate text-[11px] font-medium text-muted-foreground md:text-xs">{metric.label}</p>
              <p className={cn("mt-0.5 text-xl font-bold md:text-2xl", metric.tone)}>{metric.value}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </section>
  );
}

function CalendarToolbar({
  currentDate,
  loading,
  onToday,
  onPrevious,
  onNext,
}: {
  currentDate: Date;
  loading: boolean;
  onToday: () => void;
  onPrevious: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2">
        <CalendarDays className="h-5 w-5 shrink-0 text-primary" />
        <CardTitle className="truncate text-lg capitalize md:text-xl">
          {format(currentDate, "MMMM yyyy", { locale: pt })}
        </CardTitle>
        {loading ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" /> : null}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <Button variant="outline" size="sm" onClick={onToday} className="min-h-9 px-3">
          Hoje
        </Button>
        <div className="flex items-center rounded-md border border-input bg-background">
          <Button
            variant="ghost"
            size="icon"
            onClick={onPrevious}
            aria-label="Mês anterior"
            className="h-9 w-9 rounded-none border-r border-input"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onNext}
            aria-label="Próximo mês"
            className="h-9 w-9 rounded-none"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function TypeFilters({ value, onChange }: { value: CalendarFilter; onChange: (value: CalendarFilter) => void }) {
  return (
    <Tabs value={value} onValueChange={(nextValue) => onChange(nextValue as CalendarFilter)}>
      <TabsList className="grid h-auto w-full grid-cols-4 md:ml-auto md:w-[430px]">
        <TabsTrigger value="all" className="px-1 text-xs md:px-3 md:text-sm">Todos</TabsTrigger>
        <TabsTrigger value="venue_event" className="px-1 text-xs md:px-3 md:text-sm">Festas</TabsTrigger>
        <TabsTrigger value="external_event" className="px-1 text-xs md:px-3 md:text-sm">Serviços</TabsTrigger>
        <TabsTrigger value="workshop" className="px-1 text-xs md:px-3 md:text-sm">Workshops</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}

function DesktopMonthView({
  currentDate,
  daysByDate,
  filter,
  gridDays,
  spaceSlotsTotal,
  todayKey,
  onSelectDate,
}: MonthViewProps) {
  return (
    <>
      <WeekdayHeader labels={WEEKDAYS} />
      <div className="grid grid-cols-7 gap-px bg-border auto-rows-[128px] xl:auto-rows-[142px]">
        {gridDays.map((day) => {
          const date = format(day, "yyyy-MM-dd");
          const currentMonth = isSameMonth(day, currentDate);
          const dayData = daysByDate.get(date) ?? emptyDay(date, spaceSlotsTotal);
          const occupancyStatus = visualDayStatus(dayData);
          const visibleItems = filterCalendarItems(dayData.items, filter).slice(0, 2);
          const hiddenCount = filterCalendarItems(dayData.items, filter).length - visibleItems.length;

          return (
            <button
              key={date}
              type="button"
              disabled={!currentMonth}
              onClick={() => onSelectDate(date)}
              aria-label={calendarDayAriaLabel(dayData, currentMonth)}
              className={cn(
                "flex min-w-0 flex-col p-2 text-left transition-colors hover:brightness-[0.98] focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset disabled:cursor-default",
                desktopDayClass(dayData, currentMonth),
                date === todayKey && "ring-2 ring-primary/50 ring-inset",
              )}
            >
              <div className="flex items-start justify-between gap-1.5">
                <DayNumber date={day} today={date === todayKey} muted={!currentMonth} />
                {currentMonth && occupancyStatus !== "free" ? (
                  <span className={cn("rounded-md border px-1.5 py-0.5 text-[10px] font-semibold", dayBadgeClass(dayData))}>
                    {dayCellStatusLabel(dayData)}
                  </span>
                ) : null}
              </div>

              {currentMonth ? (
                <div className="mt-2 min-w-0 flex-1">
                  <p className="text-[11px] font-semibold text-foreground/80">
                    {dayData.spaceSlotsUsed}/{dayData.spaceSlotsTotal}
                    {occupancyStatus === "free" ? null : " ocupados"}
                  </p>
                  <div className="mt-2 space-y-1">
                    {visibleItems.map((item) => (
                      <div key={`${item.type}-${item.id}`} className="flex min-w-0 items-center gap-1.5 rounded-md bg-background/75 px-1.5 py-1 text-[10px] shadow-sm">
                        <span className={cn("h-2 w-2 shrink-0 rounded-full", itemDotClass(item))} />
                        <span className="truncate font-medium">{calendarItemTitle(item)}</span>
                      </div>
                    ))}
                    {hiddenCount > 0 ? (
                      <p className="px-1 text-[10px] font-semibold text-muted-foreground">+ {hiddenCount} eventos</p>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </button>
          );
        })}
      </div>
    </>
  );
}

function MobileAgenda({ groups, loading }: { groups: Array<[string, CalendarV2Item[]]>; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex min-h-56 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (groups.length === 0) {
    return <EmptyPeriod />;
  }

  return (
    <div className="space-y-5 p-3">
      {groups.map(([date, items]) => (
        <section key={date} aria-labelledby={`agenda-${date}`}>
          <h2 id={`agenda-${date}`} className="mb-2 text-xs font-bold uppercase tracking-wide text-primary">
            {formatAgendaDate(date)}
          </h2>
          <div className="space-y-2">
            {items.map((item) => (
              <AgendaEventCard key={`${item.type}-${item.id}`} item={item} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function AgendaEventCard({ item }: { item: CalendarV2Item }) {
  const financial = financialSummary(item);
  const secondary = item.customerName ? item.title : item.servicesLabels[0];

  return (
    <Link
      href={calendarItemHref(item)}
      className="flex min-h-[118px] items-center gap-3 rounded-2xl border border-border/70 bg-background p-3 shadow-sm transition-colors active:bg-muted/50"
      aria-label={`Abrir ${itemTypeLabel(item.type)}: ${calendarItemTitle(item)}`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge className={itemTypeBadgeClass(item)}>{itemTypeLabel(item.type)}</Badge>
          {!item.occupiesSpace ? (
            <Badge variant="outline" className="rounded-md border-blue-200 bg-blue-50 text-blue-800">Fora do espaço</Badge>
          ) : null}
        </div>
        <p className="mt-2 break-words font-bold leading-snug text-foreground">{calendarItemTitle(item)}</p>
        {secondary && secondary !== calendarItemTitle(item) ? (
          <p className="mt-0.5 truncate text-sm text-muted-foreground">{secondary}</p>
        ) : null}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{timeLabel(item)}</span>
          {item.location ? <span className="flex min-w-0 items-center gap-1"><MapPin className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{item.location}</span></span> : null}
        </div>
        {financial ? (
          <p className={cn("mt-2 text-sm font-bold", financial.pending ? "text-rose-700" : "text-emerald-700")}>
            {financial.label}
          </p>
        ) : null}
      </div>
      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
    </Link>
  );
}

function MobileMonthView({
  currentDate,
  daysByDate,
  filter,
  gridDays,
  spaceSlotsTotal,
  todayKey,
  onSelectDate,
}: MonthViewProps) {
  return (
    <>
      <WeekdayHeader labels={MOBILE_WEEKDAYS} compact />
      <div className="grid grid-cols-7 gap-px bg-border auto-rows-[58px]">
        {gridDays.map((day) => {
          const date = format(day, "yyyy-MM-dd");
          const currentMonth = isSameMonth(day, currentDate);
          const dayData = daysByDate.get(date) ?? emptyDay(date, spaceSlotsTotal);
          const visibleItems = filterCalendarItems(dayData.items, filter);

          return (
            <button
              key={date}
              type="button"
              disabled={!currentMonth}
              onClick={() => onSelectDate(date)}
              aria-label={calendarDayAriaLabel(dayData, currentMonth)}
              className={cn(
                "flex min-w-0 flex-col items-center justify-center gap-1 bg-background p-1 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset disabled:bg-muted/40",
                currentMonth && mobileDayClass(dayData),
                date === todayKey && "ring-2 ring-primary/50 ring-inset",
              )}
            >
              <span className={cn("text-xs font-bold", !currentMonth && "text-muted-foreground/45", date === todayKey && "flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground")}>
                {format(day, "d")}
              </span>
              {currentMonth ? (
                <>
                  <div className="flex h-2 items-center justify-center gap-0.5" aria-hidden="true">
                    {visibleItems.slice(0, 3).map((item) => (
                      <span key={`${item.type}-${item.id}`} className={cn("h-1.5 w-1.5 rounded-full", itemDotClass(item))} />
                    ))}
                  </div>
                  {dayData.items.length > 0 || dayData.spaceSlotsUsed > 0 ? (
                    <span className="text-[9px] font-semibold text-foreground/75">{dayData.spaceSlotsUsed}/{dayData.spaceSlotsTotal}</span>
                  ) : <span className="h-[11px]" />}
                </>
              ) : null}
            </button>
          );
        })}
      </div>
    </>
  );
}

type MonthViewProps = {
  currentDate: Date;
  daysByDate: Map<string, CalendarV2Day>;
  filter: CalendarFilter;
  gridDays: Date[];
  spaceSlotsTotal: number;
  todayKey: string;
  onSelectDate: (date: string) => void;
};

function WeekdayHeader({ labels, compact = false }: { labels: string[]; compact?: boolean }) {
  return (
    <div className="grid grid-cols-7 border-b border-border bg-muted/20">
      {labels.map((label, index) => (
        <div key={`${label}-${index}`} className={cn("text-center font-semibold text-muted-foreground", compact ? "p-1.5 text-[10px]" : "p-3 text-sm")}>
          {label}
        </div>
      ))}
    </div>
  );
}

function DayNumber({ date, today, muted }: { date: Date; today: boolean; muted: boolean }) {
  return (
    <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold", muted && "text-muted-foreground/45", today && "bg-primary text-primary-foreground")}>
      {format(date, "d")}
    </span>
  );
}

function DayDetailsSheet({
  day,
  filter,
  isMobile,
  open,
  onOpenChange,
}: {
  day: CalendarV2Day | null;
  filter: CalendarFilter;
  isMobile: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const visibleItems = filterCalendarItems(day?.items ?? [], filter);
  const spaceItems = visibleItems.filter((item) => item.occupiesSpace);
  const outsideItems = visibleItems.filter((item) => !item.occupiesSpace);
  const formattedDate = day ? capitalize(format(parseISO(day.date), "EEEE, d 'de' MMMM 'de' yyyy", { locale: pt })) : "";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={cn(
          "overflow-y-auto",
          isMobile ? "max-h-[88vh] rounded-t-3xl px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-5" : "w-full sm:max-w-lg",
        )}
      >
        <SheetHeader className="pr-8 text-left">
          <SheetTitle className="text-xl font-bold capitalize text-primary">{formattedDate}</SheetTitle>
          <SheetDescription>
            {day ? `${day.spaceSlotsUsed}/${day.spaceSlotsTotal} slots ocupados · ${dayPresentationLabel(day)}` : "Detalhes do dia"}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-5 space-y-5">
          {visibleItems.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Nenhum evento neste período.
            </div>
          ) : (
            <>
              <DayItemSection title="No Espaço Girafinha" items={spaceItems} />
              <DayItemSection title="Fora do espaço" items={outsideItems} />
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function DayItemSection({ title, items }: { title: string; items: CalendarV2Item[] }) {
  if (items.length === 0) return null;

  return (
    <section>
      <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">{title}</h3>
      <div className="space-y-2">
        {items.map((item) => (
          <DayEventCard key={`${item.type}-${item.id}`} item={item} />
        ))}
      </div>
    </section>
  );
}

function DayEventCard({ item }: { item: CalendarV2Item }) {
  const financial = financialSummary(item);

  return (
    <SheetClose asChild>
      <Link
        href={calendarItemHref(item)}
        className="flex items-start gap-3 rounded-2xl border border-border bg-background p-3 shadow-sm transition-colors hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`Abrir ${itemTypeLabel(item.type)}: ${calendarItemTitle(item)}`}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge className={itemTypeBadgeClass(item)}>{itemTypeLabel(item.type)}</Badge>
            {!item.occupiesSpace ? <Badge variant="outline" className="rounded-md border-blue-200 bg-blue-50 text-blue-800">Não ocupa espaço</Badge> : null}
          </div>
          <p className="mt-2 break-words font-bold leading-snug text-foreground">{calendarItemTitle(item)}</p>
          {item.customerName && item.customerName !== calendarItemTitle(item) ? <p className="mt-0.5 text-sm text-muted-foreground">{item.title}</p> : null}
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{timeLabel(item)}</span>
            {item.location ? <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{item.location}</span> : null}
            {item.activeParticipantsCount !== null && item.capacity !== null ? (
              <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{item.activeParticipantsCount}/{item.capacity}</span>
            ) : null}
          </div>
          {item.servicesLabels.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1">
              {item.servicesLabels.map((service) => <Badge key={service} variant="secondary" className="rounded-md">{service}</Badge>)}
            </div>
          ) : null}
          {financial ? <p className={cn("mt-2 text-sm font-bold", financial.pending ? "text-rose-700" : "text-emerald-700")}>{financial.label}</p> : null}
        </div>
        <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" />
      </Link>
    </SheetClose>
  );
}

function CalendarLegend() {
  const items = [
    { label: "Livre", className: "bg-emerald-100 border-emerald-300" },
    { label: "Quase cheio", className: "bg-amber-100 border-amber-300" },
    { label: "Lotado", className: "bg-rose-100 border-rose-300" },
    { label: "Festa no Espaço", className: "bg-pink-500 border-pink-600 rounded-full" },
    { label: "Serviço Externo", className: "bg-blue-500 border-blue-600 rounded-full" },
    { label: "Workshop/Formação", className: "bg-violet-500 border-violet-600 rounded-full" },
  ];

  return (
    <>
      <div className="hidden flex-wrap items-center gap-x-4 gap-y-2 px-1 text-xs text-muted-foreground md:flex" aria-label="Legenda do calendário">
        {items.map((item) => <LegendItem key={item.label} {...item} />)}
      </div>
      <details className="rounded-xl border border-border/70 bg-card px-3 py-2 text-xs text-muted-foreground md:hidden">
        <summary className="cursor-pointer font-semibold text-foreground">Legenda</summary>
        <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2" aria-label="Legenda do calendário">
          {items.map((item) => <LegendItem key={item.label} {...item} />)}
        </div>
      </details>
    </>
  );
}

function LegendItem({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <span className={cn("h-2.5 w-2.5 shrink-0 rounded-sm border", className)} />
      <span>{label}</span>
    </span>
  );
}

function EmptyPeriod() {
  return (
    <div className="flex min-h-56 flex-col items-center justify-center p-8 text-center text-muted-foreground">
      <CalendarDays className="mb-3 h-9 w-9 text-muted-foreground/35" />
      <p className="font-medium text-foreground">Nenhum evento neste período.</p>
      <p className="mt-1 text-sm">Escolha outro mês ou altere o filtro.</p>
    </div>
  );
}

function filterCalendarItems(items: CalendarV2Item[], filter: CalendarFilter) {
  return filter === "all" ? items : items.filter((item) => item.type === filter);
}

function groupAgendaItems(items: CalendarV2Item[], currentDate: Date, todayKey: string) {
  const selectedMonthIsCurrent = isSameMonth(currentDate, parseISO(todayKey));
  const visibleItems = selectedMonthIsCurrent ? items.filter((item) => item.date >= todayKey) : items;
  const groups = new Map<string, CalendarV2Item[]>();
  for (const item of visibleItems) {
    const dayItems = groups.get(item.date) ?? [];
    dayItems.push(item);
    groups.set(item.date, dayItems);
  }
  return [...groups.entries()];
}

function emptyDay(date: string, spaceSlotsTotal: number): CalendarV2Day {
  return { date, status: "free", spaceSlotsUsed: 0, spaceSlotsTotal, items: [] };
}

function visualDayStatus(day: CalendarV2Day) {
  if (day.spaceSlotsUsed >= day.spaceSlotsTotal) return "full" as const;
  if (day.spaceSlotsUsed === 1) return "almost_full" as const;
  return "free" as const;
}

function summarizeOccupancy(days: CalendarV2Day[]) {
  return days.reduce(
    (summary, day) => {
      const status = visualDayStatus(day);
      if (status === "full") summary.fullDays += 1;
      else if (status === "almost_full") summary.almostFullDays += 1;
      else summary.freeDays += 1;
      return summary;
    },
    { freeDays: 0, almostFullDays: 0, fullDays: 0 },
  );
}

function dayPresentationLabel(day: CalendarV2Day) {
  const status = visualDayStatus(day);
  if (status === "full") return "Lotado";
  if (status === "almost_full") return "Quase cheio";
  return "Livre";
}

function dayCellStatusLabel(day: CalendarV2Day) {
  return dayPresentationLabel(day);
}

function calendarDayAriaLabel(day: CalendarV2Day, currentMonth: boolean) {
  const dateLabel = capitalize(format(parseISO(day.date), "EEEE, d 'de' MMMM", { locale: pt }));
  if (!currentMonth) return dateLabel;
  return `${dateLabel}: ${dayPresentationLabel(day)}, ${day.spaceSlotsUsed} de ${day.spaceSlotsTotal} slots ocupados, ${day.items.length} eventos`;
}

function desktopDayClass(day: CalendarV2Day, currentMonth: boolean) {
  if (!currentMonth) return "bg-muted/35 text-muted-foreground/50";
  const status = visualDayStatus(day);
  if (status === "full") return "bg-rose-50/80";
  if (status === "almost_full") return "bg-amber-50/80";
  return "bg-background";
}

function mobileDayClass(day: CalendarV2Day) {
  const status = visualDayStatus(day);
  if (status === "full") return "bg-rose-50";
  if (status === "almost_full") return "bg-amber-50";
  return "bg-background";
}

function dayBadgeClass(day: CalendarV2Day) {
  const status = visualDayStatus(day);
  if (status === "full") return "border-rose-200 bg-rose-100 text-rose-800";
  if (status === "almost_full") return "border-amber-200 bg-amber-100 text-amber-800";
  return "border-emerald-200 bg-emerald-100 text-emerald-800";
}

function itemDotClass(item: CalendarV2Item) {
  if (item.type === "external_event") return "bg-blue-500";
  if (item.type === "workshop") return item.occupiesSpace ? "bg-violet-600" : "bg-violet-400";
  return "bg-pink-500";
}

function itemTypeBadgeClass(item: CalendarV2Item) {
  if (item.type === "external_event") return "rounded-md border-none bg-blue-100 text-blue-800 hover:bg-blue-100";
  if (item.type === "workshop") return "rounded-md border-none bg-violet-100 text-violet-800 hover:bg-violet-100";
  return "rounded-md border-none bg-pink-100 text-pink-800 hover:bg-pink-100";
}

function itemTypeLabel(type: CalendarV2Item["type"]) {
  if (type === "external_event") return "Serviço Externo";
  if (type === "workshop") return "Workshop/Formação";
  return "Festa no Espaço";
}

function calendarItemTitle(item: CalendarV2Item) {
  return item.customerName || item.title;
}

function calendarItemHref(item: CalendarV2Item) {
  const route = item.type === "venue_event" ? "/venue-events" : item.type === "external_event" ? "/external-events" : "/workshops";
  return `${route}?open=${encodeURIComponent(item.id)}`;
}

function timeLabel(item: CalendarV2Item) {
  return item.startTime + (item.endTime ? `–${item.endTime}` : "");
}

function financialSummary(item: CalendarV2Item) {
  const pending = item.pendingAmount ?? item.totalPending;
  if (pending === null) return null;
  return pending > 0
    ? { label: `Falta ${formatMoney(pending)}`, pending: true }
    : { label: "Pago", pending: false };
}

function formatAgendaDate(date: string) {
  const parsed = parseISO(date);
  return `${format(parsed, "dd MMM", { locale: pt }).replace(".", "").toUpperCase()} · ${capitalize(format(parsed, "EEEE", { locale: pt }))}`;
}

function getPortugalDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: PORTUGAL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatMoney(value: number) {
  return moneyFormatter.format(value);
}
