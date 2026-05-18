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
import { CalendarDays, ChevronLeft, ChevronRight, Clock, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ReservationModal } from "@/components/reservation-modal";
import { StatusBadge } from "@/components/status-badge";
import { useGetCalendarReservations } from "@workspace/api-client-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { MAX_EVENTS_PER_DAY } from "@/lib/constants";
import type { Reservation } from "@workspace/api-client-react";

type AvailabilityTone = "free" | "available" | "almost" | "full";

function occupiesSpace(reservation: Reservation) {
  return reservation.serviceType !== "Serviços externos";
}

function getAvailability(reservations: Reservation[]) {
  const spaceReservations = reservations.filter(occupiesSpace);
  const externalReservations = reservations.filter((reservation) => !occupiesSpace(reservation));
  const used = spaceReservations.length;
  const available = Math.max(0, MAX_EVENTS_PER_DAY - used);

  if (used >= MAX_EVENTS_PER_DAY) {
    return { label: "Lotado", tone: "full" as AvailabilityTone, used, available, external: externalReservations.length };
  }

  if (used === MAX_EVENTS_PER_DAY - 1) {
    return {
      label: "Quase cheio",
      tone: "almost" as AvailabilityTone,
      used,
      available,
      external: externalReservations.length,
    };
  }

  return {
    label: used === 0 ? "Livre" : "Disponível",
    tone: used === 0 ? ("free" as AvailabilityTone) : ("available" as AvailabilityTone),
    used,
    available,
    external: externalReservations.length,
  };
}

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const isMobile = useIsMobile();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;
  const { data: calendarDays, isLoading } = useGetCalendarReservations({ year, month });

  const days = useMemo(() => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    const intervalStart = new Date(start);
    intervalStart.setDate(start.getDate() - (start.getDay() === 0 ? 6 : start.getDay() - 1));
    const intervalEnd = new Date(end);
    intervalEnd.setDate(end.getDate() + (intervalEnd.getDay() === 0 ? 0 : 7 - intervalEnd.getDay()));
    return eachDayOfInterval({ start: intervalStart, end: intervalEnd });
  }, [currentDate]);

  const reservationsByDate = useMemo(() => {
    return new Map((calendarDays ?? []).map((day) => [day.date, day.reservations]));
  }, [calendarDays]);

  const monthStats = useMemo(() => {
    const currentMonthDays = days.filter((day) => isSameMonth(day, currentDate));

    return currentMonthDays.reduce(
      (acc, day) => {
        const date = format(day, "yyyy-MM-dd");
        const reservations = reservationsByDate.get(date) ?? [];
        const availability = getAvailability(reservations);

        if (availability.tone === "free") acc.freeDays += 1;
        if (availability.tone === "almost") acc.almostFullDays += 1;
        if (availability.tone === "full") acc.fullDays += 1;

        acc.usedSlots += Math.min(availability.used, MAX_EVENTS_PER_DAY);
        acc.externalServices += availability.external;
        return acc;
      },
      { freeDays: 0, almostFullDays: 0, fullDays: 0, usedSlots: 0, externalServices: 0 },
    );
  }, [currentDate, days, reservationsByDate]);

  const selectedReservations = selectedDate ? reservationsByDate.get(selectedDate) ?? [] : [];
  const maxSlots = endOfMonth(currentDate).getDate() * MAX_EVENTS_PER_DAY;
  const availableSlots = Math.max(0, maxSlots - monthStats.usedSlots);

  return (
    <div className="space-y-4 md:space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-primary">Disponibilidade do Espaço</h1>
          <p className="mt-1 text-sm md:text-base text-muted-foreground">
            Confirme dias livres, capacidade para festas/workshops e serviços externos no mesmo calendário.
          </p>
        </div>
        <ReservationModal
          trigger={
            <Button className="min-h-[44px] rounded-full bg-primary px-6 text-primary-foreground shadow-md hover:bg-primary/90">
              <Plus className="h-4 w-4" />
              Nova reserva
            </Button>
          }
        />
      </div>

      <div className="grid gap-3 grid-cols-2 xl:grid-cols-5">
        <AvailabilityMetric label="Dias livres" value={monthStats.freeDays.toString()} tone="free" />
        <AvailabilityMetric label="Quase cheios" value={monthStats.almostFullDays.toString()} tone="almost" />
        <AvailabilityMetric label="Lotados" value={monthStats.fullDays.toString()} tone="full" />
        <AvailabilityMetric label="Slots livres" value={`${availableSlots}/${maxSlots}`} tone="available" />
        <AvailabilityMetric label="Serviços externos" value={monthStats.externalServices.toString()} />
      </div>

      <Card className="overflow-hidden border-border/70 shadow-sm">
        <CardHeader className="border-b border-border/60 bg-card/70 p-3 md:p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg md:text-xl capitalize">
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
            {(isMobile ? ["S", "T", "Q", "Q", "S", "S", "D"] : ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"]).map(
              (day) => (
                <div key={day} className="p-2 md:p-3 text-center text-xs md:text-sm font-semibold text-muted-foreground">
                  {day}
                </div>
              ),
            )}
          </div>

          <div className={`grid grid-cols-7 bg-border gap-px ${isMobile ? "auto-rows-[82px]" : "auto-rows-[126px]"}`}>
            {days.map((day) => {
              const date = format(day, "yyyy-MM-dd");
              const reservations = reservationsByDate.get(date) ?? [];
              const availability = getAvailability(reservations);
              const currentMonth = isSameMonth(day, currentDate);
              const today = isToday(day);

              return (
                <button
                  key={date}
                  onClick={() => setSelectedDate(date)}
                  className={cn(
                    "flex flex-col p-2 text-left transition-colors hover:brightness-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset",
                    availabilityClass(availability.tone, currentMonth),
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
                      <Badge variant="outline" className={cn("rounded-md px-1.5 text-[10px]", availabilityBadgeClass(availability.tone))}>
                        {isMobile ? `${availability.used}/${MAX_EVENTS_PER_DAY}` : availability.label}
                      </Badge>
                    )}
                  </div>

                  {currentMonth && (
                    <div className="mt-auto min-w-0 space-y-1">
                      <p className="truncate text-xs font-medium text-foreground">
                        {availability.available > 0
                          ? `${availability.available} slot${availability.available > 1 ? "s" : ""} livre${availability.available > 1 ? "s" : ""}`
                          : "Sem slots livres"}
                      </p>
                      {!isMobile && (
                        <p className="truncate text-[11px] text-muted-foreground">
                          {availability.used}/{MAX_EVENTS_PER_DAY} no espaço
                          {availability.external > 0 ? ` · ${availability.external} externo${availability.external > 1 ? "s" : ""}` : ""}
                        </p>
                      )}
                      {isMobile && availability.external > 0 && <span className="text-[10px] font-medium text-violet-700">+ ext.</span>}
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
        <LegendItem className="bg-sky-100 border-sky-200" label="Com reservas, ainda disponível" />
        <LegendItem className="bg-amber-100 border-amber-200" label="Quase cheio" />
        <LegendItem className="bg-rose-100 border-rose-200" label="Lotado" />
        <LegendItem className="bg-violet-100 border-violet-200" label="Serviço externo, não ocupa slot do espaço" />
      </div>

      <DayAvailabilityModal
        date={selectedDate}
        reservations={selectedReservations}
        open={!!selectedDate}
        onOpenChange={(open) => {
          if (!open) setSelectedDate(null);
        }}
      />
    </div>
  );
}

function DayAvailabilityModal({
  date,
  reservations,
  open,
  onOpenChange,
}: {
  date: string | null;
  reservations: Reservation[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const availability = getAvailability(reservations);
  const formattedDate = date ? format(parseISO(date), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : "";
  const spaceReservations = reservations.filter(occupiesSpace);
  const externalReservations = reservations.filter((reservation) => !occupiesSpace(reservation));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-primary capitalize">{formattedDate}</DialogTitle>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={cn("rounded-md", availabilityBadgeClass(availability.tone))}>
              {availability.label}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {availability.used}/{MAX_EVENTS_PER_DAY} slots ocupados · {availability.available} livres
            </span>
          </div>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <section>
            <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Reservas no espaço</h3>
            {spaceReservations.length > 0 ? (
              <div className="space-y-2">
                {spaceReservations.map((reservation) => (
                  <ReservationSummary key={reservation.id} reservation={reservation} />
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                Dia livre para festas ou workshops.
              </div>
            )}
          </section>

          {externalReservations.length > 0 && (
            <section>
              <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Serviços externos no mesmo dia</h3>
              <div className="space-y-2">
                {externalReservations.map((reservation) => (
                  <ReservationSummary key={reservation.id} reservation={reservation} />
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="mt-4">
          <ReservationModal
            defaultDate={date ?? undefined}
            trigger={
              <Button className="w-full min-h-[48px] rounded-xl bg-primary text-primary-foreground shadow-md hover:bg-primary/90">
                <Plus className="h-4 w-4" />
                Adicionar reserva neste dia
              </Button>
            }
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ReservationSummary({ reservation }: { reservation: Reservation }) {
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold">{reservation.customerName}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {reservation.eventTime}
            </span>
            <Badge variant="outline" className="rounded-md text-[11px]">
              {reservation.serviceType}
            </Badge>
          </div>
          <p className="mt-1 truncate text-sm text-muted-foreground">{reservation.pack}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <StatusBadge status={reservation.paymentStatus} />
          <ReservationModal
            reservation={reservation}
            trigger={
              <Button variant="outline" size="sm" className="h-8 rounded-md">
                Abrir
              </Button>
            }
          />
        </div>
      </div>
    </div>
  );
}

function AvailabilityMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: AvailabilityTone;
}) {
  const color =
    tone === "free"
      ? "text-emerald-700"
      : tone === "available"
        ? "text-sky-700"
        : tone === "almost"
          ? "text-amber-700"
          : tone === "full"
            ? "text-rose-700"
            : "";

  return (
    <Card className="border-border/70 shadow-sm">
      <CardContent className="p-4">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p>
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

function availabilityClass(tone: AvailabilityTone, currentMonth: boolean) {
  if (!currentMonth) return "bg-muted/30";
  if (tone === "full") return "bg-rose-50";
  if (tone === "almost") return "bg-amber-50";
  if (tone === "available") return "bg-sky-50";
  return "bg-emerald-50";
}

function availabilityBadgeClass(tone: AvailabilityTone) {
  if (tone === "full") return "border-rose-200 bg-rose-100 text-rose-800";
  if (tone === "almost") return "border-amber-200 bg-amber-100 text-amber-800";
  if (tone === "available") return "border-sky-200 bg-sky-100 text-sky-800";
  return "border-emerald-200 bg-emerald-100 text-emerald-800";
}
