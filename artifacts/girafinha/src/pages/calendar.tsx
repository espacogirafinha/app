import { useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, ChevronLeft, ChevronRight, Clock, Loader2, MapPin, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { useGetCalendarV2 } from "@workspace/api-client-react";
import type { CalendarV2Day, CalendarV2DayStatus, CalendarV2Item } from "@workspace/api-client-react";

const moneyFormatter = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR",
});

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const isMobile = useIsMobile();

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
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
  const selectedDay = selectedDate ? daysByDate.get(selectedDate) ?? emptyDay(selectedDate) : null;

  return (
    <div className="space-y-4 md:space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-primary md:text-3xl">Calendário V2</h1>
          <p className="mt-1 text-sm text-muted-foreground md:text-base">
            Festas, serviços externos e workshops com ocupação real do espaço.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="min-h-[40px] rounded-full">
            <a href="/venue-events">Festas</a>
          </Button>
          <Button asChild variant="outline" className="min-h-[40px] rounded-full">
            <a href="/external-events">Serviços</a>
          </Button>
          <Button asChild variant="outline" className="min-h-[40px] rounded-full">
            <a href="/workshops">Workshops</a>
          </Button>
        </div>
      </div>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        <CalendarMetric label="Dias livres" value={String(data?.summary.freeDays ?? 0)} tone="free" />
        <CalendarMetric label="Com eventos" value={String(data?.summary.busyDays ?? 0)} tone="busy" />
        <CalendarMetric label="Quase cheios" value={String(data?.summary.almostFullDays ?? 0)} tone="almost_full" />
        <CalendarMetric label="Lotados" value={String(data?.summary.fullDays ?? 0)} tone="full" />
        <CalendarMetric label="Não ocupam espaço" value={String(data?.summary.externalItems ?? 0)} />
      </section>

      <Card className="overflow-hidden border-border/70 shadow-sm">
        <CardHeader className="border-b border-border/60 bg-card/70 p-3 md:p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg capitalize md:text-xl">
                {format(currentDate, "MMMM yyyy", { locale: ptBR })}
              </CardTitle>
              {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())} className="min-h-[36px]">
                Hoje
              </Button>
              <div className="flex items-center rounded-md border border-input bg-transparent">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setCurrentDate(subMonths(currentDate, 1))}
                  aria-label="Mês anterior"
                  className="h-10 w-10 rounded-none border-r border-input"
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setCurrentDate(addMonths(currentDate, 1))}
                  aria-label="Próximo mês"
                  className="h-10 w-10 rounded-none"
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="grid grid-cols-7 border-b border-border bg-muted/20">
            {(isMobile ? ["S", "T", "Q", "Q", "S", "S", "D"] : ["Seg", "Ter", "Qua", "Qui", "Sex", "Sab", "Dom"]).map((day) => (
              <div key={day} className="p-2 text-center text-xs font-semibold text-muted-foreground md:p-3 md:text-sm">
                {day}
              </div>
            ))}
          </div>

          <div className={`grid grid-cols-7 gap-px bg-border ${isMobile ? "auto-rows-[92px]" : "auto-rows-[138px]"}`}>
            {gridDays.map((day) => {
              const date = format(day, "yyyy-MM-dd");
              const dayData = daysByDate.get(date) ?? emptyDay(date);
              const currentMonth = isSameMonth(day, currentDate);
              const today = isToday(day);
              const visibleItems = dayData.items.slice(0, isMobile ? 1 : 3);

              return (
                <button
                  key={date}
                  onClick={() => setSelectedDate(date)}
                  className={cn(
                    "flex min-w-0 flex-col p-2 text-left transition-colors hover:brightness-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset",
                    dayClass(dayData.status, currentMonth),
                    !currentMonth && "text-muted-foreground/50",
                    today && "ring-2 ring-primary/40 ring-inset",
                  )}
                >
                  <div className="flex items-start justify-between gap-1">
                    <span
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                        today && "bg-primary text-primary-foreground",
                      )}
                    >
                      {format(day, "d")}
                    </span>
                    {currentMonth && (
                      <Badge variant="outline" className={cn("rounded-md px-1.5 text-[10px]", dayBadgeClass(dayData.status))}>
                        {isMobile ? `${dayData.spaceSlotsUsed}/${dayData.spaceSlotsTotal}` : dayStatusLabel(dayData.status)}
                      </Badge>
                    )}
                  </div>

                  {currentMonth && (
                    <div className="mt-auto min-w-0 space-y-1">
                      <p className="truncate text-[11px] font-medium text-foreground">
                        {dayData.spaceSlotsUsed}/{dayData.spaceSlotsTotal} slots ocupados
                      </p>
                      <div className="min-w-0 space-y-1">
                        {visibleItems.map((item) => (
                          <div key={`${item.type}-${item.id}`} className="flex min-w-0 items-center gap-1 text-[10px]">
                            <span className={cn("h-2 w-2 shrink-0 rounded-full", itemDotClass(item))} />
                            <span className="truncate">{item.title}</span>
                          </div>
                        ))}
                        {dayData.items.length > visibleItems.length && (
                          <p className="text-[10px] font-medium text-muted-foreground">+{dayData.items.length - visibleItems.length} itens</p>
                        )}
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-4 px-1 text-xs text-muted-foreground">
        <LegendItem className="bg-emerald-100 border-emerald-200" label="Livre" />
        <LegendItem className="bg-sky-100 border-sky-200" label="Com eventos" />
        <LegendItem className="bg-amber-100 border-amber-200" label="Quase cheio" />
        <LegendItem className="bg-rose-100 border-rose-200" label="Lotado" />
        <LegendItem className="bg-pink-500 border-pink-600" label="Festa no Espaço" />
        <LegendItem className="bg-blue-500 border-blue-600" label="Serviço externo, não ocupa espaço" />
        <LegendItem className="bg-violet-500 border-violet-600" label="Workshop/Formação" />
      </div>

      <DayDetailsModal
        day={selectedDay}
        open={!!selectedDate}
        onOpenChange={(open) => {
          if (!open) setSelectedDate(null);
        }}
      />
    </div>
  );
}

function DayDetailsModal({
  day,
  open,
  onOpenChange,
}: {
  day: CalendarV2Day | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const formattedDate = day ? format(parseISO(day.date), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : "";
  const spaceItems = day?.items.filter((item) => item.occupiesSpace) ?? [];
  const operationalItems = day?.items.filter((item) => !item.occupiesSpace) ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-primary capitalize">{formattedDate}</DialogTitle>
          {day && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={cn("rounded-md", dayBadgeClass(day.status))}>
                {dayStatusLabel(day.status)}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {day.spaceSlotsUsed}/{day.spaceSlotsTotal} slots ocupados
              </span>
            </div>
          )}
        </DialogHeader>

        <div className="mt-4 space-y-4">
          <section>
            <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Ocupa o espaço</h3>
            {spaceItems.length > 0 ? (
              <div className="space-y-2">
                {spaceItems.map((item) => (
                  <CalendarItemCard key={`${item.type}-${item.id}`} item={item} />
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                Sem eventos a ocupar o espaço neste dia.
              </div>
            )}
          </section>

          {operationalItems.length > 0 && (
            <section>
              <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Operacional, não ocupa espaço</h3>
              <div className="space-y-2">
                {operationalItems.map((item) => (
                  <CalendarItemCard key={`${item.type}-${item.id}`} item={item} />
                ))}
              </div>
            </section>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CalendarItemCard({ item }: { item: CalendarV2Item }) {
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={itemTypeBadgeClass(item)}>{itemTypeLabel(item.type)}</Badge>
            <Badge variant="outline" className={item.occupiesSpace ? "rounded-md border-emerald-200 bg-emerald-50 text-emerald-800" : "rounded-md border-blue-200 bg-blue-50 text-blue-800"}>
              {item.occupiesSpace ? "Ocupa espaço" : "Não ocupa espaço"}
            </Badge>
          </div>
          <p className="mt-2 truncate font-semibold">{item.title}</p>
          <div className="mt-1 flex flex-wrap gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {item.startTime}{item.endTime ? ` - ${item.endTime}` : ""}
            </span>
            {item.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {item.location}
              </span>
            )}
            {item.activeParticipantsCount !== null && item.capacity !== null && (
              <span className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                {item.activeParticipantsCount}/{item.capacity}
              </span>
            )}
          </div>
          {item.customerName && <p className="mt-1 text-sm text-muted-foreground">Cliente: {item.customerName}</p>}
          {item.servicesLabels.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {item.servicesLabels.map((service) => (
                <Badge key={service} variant="secondary" className="rounded-md">{service}</Badge>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm sm:min-w-[170px] sm:text-right">
          {item.totalPrice !== null && item.amountPaid !== null && item.pendingAmount !== null && (
            <>
              <div>
                <p className="text-xs text-muted-foreground">Pago</p>
                <p className="font-bold text-emerald-700">{formatMoney(item.amountPaid)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Falta</p>
                <p className={item.pendingAmount > 0 ? "font-bold text-rose-700" : "font-bold text-emerald-700"}>
                  {formatMoney(item.pendingAmount)}
                </p>
              </div>
            </>
          )}
          {item.totalReceived !== null && item.totalPending !== null && (
            <>
              <div>
                <p className="text-xs text-muted-foreground">Recebido</p>
                <p className="font-bold text-emerald-700">{formatMoney(item.totalReceived)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Por receber</p>
                <p className={item.totalPending > 0 ? "font-bold text-rose-700" : "font-bold text-emerald-700"}>
                  {formatMoney(item.totalPending)}
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function CalendarMetric({ label, value, tone }: { label: string; value: string; tone?: CalendarV2DayStatus }) {
  return (
    <Card className="border-border/70 shadow-sm">
      <CardContent className="p-4">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className={`mt-1 text-2xl font-bold ${metricToneClass(tone)}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function LegendItem({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("h-3 w-3 rounded-sm border", className)} />
      {label}
    </span>
  );
}

function emptyDay(date: string): CalendarV2Day {
  return {
    date,
    status: "free",
    spaceSlotsUsed: 0,
    spaceSlotsTotal: 2,
    items: [],
  };
}

function dayStatusLabel(status: CalendarV2DayStatus) {
  if (status === "full") return "Lotado";
  if (status === "almost_full") return "Quase cheio";
  if (status === "busy") return "Com eventos";
  return "Livre";
}

function itemTypeLabel(type: CalendarV2Item["type"]) {
  if (type === "external_event") return "Serviço Externo";
  if (type === "workshop") return "Workshop/Formação";
  return "Festa no Espaço";
}

function dayClass(status: CalendarV2DayStatus, currentMonth: boolean) {
  if (!currentMonth) return "bg-muted/30";
  if (status === "full") return "bg-rose-50";
  if (status === "almost_full") return "bg-amber-50";
  if (status === "busy") return "bg-sky-50";
  return "bg-emerald-50";
}

function dayBadgeClass(status: CalendarV2DayStatus) {
  if (status === "full") return "border-rose-200 bg-rose-100 text-rose-800";
  if (status === "almost_full") return "border-amber-200 bg-amber-100 text-amber-800";
  if (status === "busy") return "border-sky-200 bg-sky-100 text-sky-800";
  return "border-emerald-200 bg-emerald-100 text-emerald-800";
}

function metricToneClass(status?: CalendarV2DayStatus) {
  if (status === "full") return "text-rose-700";
  if (status === "almost_full") return "text-amber-700";
  if (status === "busy") return "text-sky-700";
  if (status === "free") return "text-emerald-700";
  return "";
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

function formatMoney(value: number) {
  return moneyFormatter.format(value);
}
