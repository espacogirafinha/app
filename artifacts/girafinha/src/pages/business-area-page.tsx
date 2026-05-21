import { differenceInDays, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { LucideIcon } from "lucide-react";
import { CalendarDays, Clock, Euro, Loader2, Plus, Users } from "lucide-react";
import { useMemo } from "react";
import { ReservationModal } from "@/components/reservation-modal";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useListReservations } from "@workspace/api-client-react";
import type { Reservation } from "@workspace/api-client-react";

type BusinessAreaType = "venue_party" | "external_service" | "workshop";

type SummaryCardConfig = {
  key: "upcoming" | "pending" | "paid" | "nextSevenDays" | "participants" | "occupancy";
  label: string;
};

type BusinessAreaPageProps = {
  type: BusinessAreaType;
  title: string;
  subtitle: string;
  actionLabel: string;
  emptyText: string;
  icon: LucideIcon;
  tone: "pink" | "sky" | "violet";
  summaryCards: SummaryCardConfig[];
};

export function BusinessAreaPage({
  type,
  title,
  subtitle,
  actionLabel,
  emptyText,
  icon: Icon,
  tone,
  summaryCards,
}: BusinessAreaPageProps) {
  const { data: reservations, isLoading } = useListReservations();

  const rows = useMemo(
    () =>
      [...(reservations ?? [])]
        .filter((reservation) => matchesBusinessArea(reservation, type))
        .sort((a, b) => `${a.eventDate} ${a.eventTime}`.localeCompare(`${b.eventDate} ${b.eventTime}`)),
    [reservations, type],
  );

  const summary = useMemo(() => buildSummary(rows), [rows]);
  const toneClasses = getToneClasses(tone);

  return (
    <div className="space-y-4 md:space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className={`rounded-xl p-2 ${toneClasses.iconBg}`}>
              <Icon className={`h-5 w-5 ${toneClasses.icon}`} />
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-primary md:text-3xl">{title}</h1>
          </div>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground md:text-base">{subtitle}</p>
        </div>
        <ReservationModal
          trigger={
            <Button className="min-h-[42px] rounded-full bg-primary px-5 text-primary-foreground shadow-md hover:bg-primary/90">
              <Plus className="h-4 w-4" />
              {actionLabel}
            </Button>
          }
        />
      </div>

      <section className="grid gap-2 grid-cols-2 lg:grid-cols-4">
        {summaryCards.map((card) => (
          <AreaMetricCard key={card.key} label={card.label} value={getSummaryValue(card.key, summary)} loading={isLoading} />
        ))}
      </section>

      <Card className="overflow-hidden border-border/70 shadow-sm">
        <CardHeader className="border-b border-border/60 bg-card/70 pb-4">
          <CardTitle className="text-lg">Lista</CardTitle>
          <CardDescription>Vista simples temporaria com dados atuais da tabela de reservas.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center p-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
            </div>
          ) : rows.length > 0 ? (
            <div className="divide-y divide-border/60">
              {rows.map((reservation) => (
                <AreaListItem key={reservation.id} reservation={reservation} type={type} toneClasses={toneClasses} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-10 text-center text-muted-foreground">
              <CalendarDays className="mb-3 h-12 w-12 text-muted-foreground/30" />
              <p className="font-medium text-foreground">{emptyText}</p>
              <p className="mt-1 text-sm">Esta pagina ja esta preparada para receber o fluxo proprio da V2.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AreaMetricCard({ label, value, loading }: { label: string; value: string; loading: boolean }) {
  return (
    <Card className="border-border/70 shadow-sm">
      <CardContent className="p-3 md:p-4">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {loading ? (
          <Loader2 className="mt-2 h-5 w-5 animate-spin text-muted-foreground" />
        ) : (
          <p className="mt-1 text-xl font-bold md:text-2xl">{value}</p>
        )}
      </CardContent>
    </Card>
  );
}

function AreaListItem({
  reservation,
  type,
  toneClasses,
}: {
  reservation: Reservation;
  type: BusinessAreaType;
  toneClasses: ReturnType<typeof getToneClasses>;
}) {
  const date = parseISO(reservation.eventDate);

  return (
    <div className="grid gap-3 p-4 md:grid-cols-[88px_1fr_auto] md:items-center">
      <div className={`flex items-center justify-between rounded-xl px-3 py-2 md:flex-col md:justify-center ${toneClasses.dateBg}`}>
        <span className="text-xs font-semibold uppercase">{format(date, "MMM", { locale: ptBR })}</span>
        <span className="text-xl font-bold leading-none">{format(date, "dd")}</span>
      </div>

      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-bold text-foreground">{reservation.customerName}</p>
          <StatusBadge status={reservation.paymentStatus} />
          <Badge variant="outline" className="rounded-md">{getStatusLabel(reservation.reservationStatus)}</Badge>
        </div>
        <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {reservation.eventTime}
          </span>
          <span className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            {getPeopleLabel(reservation, type)}
          </span>
          <span className="truncate font-medium text-foreground">{getPrimaryLabel(reservation, type)}</span>
        </div>
        <p className="line-clamp-1 text-sm text-muted-foreground">{getSecondaryLabel(reservation, type)}</p>
      </div>

      <div className="rounded-xl border border-border bg-background p-3 text-sm md:min-w-[150px]">
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <Euro className="h-3.5 w-3.5" />
          Por receber
        </p>
        <p className={reservation.remainingBalance > 0 ? "mt-1 font-bold text-rose-700" : "mt-1 font-bold text-emerald-700"}>
          {euro(reservation.remainingBalance)}
        </p>
      </div>
    </div>
  );
}

function buildSummary(rows: Reservation[]) {
  const today = new Date();

  return rows.reduce(
    (acc, reservation) => {
      const daysUntil = differenceInDays(parseISO(reservation.eventDate), today);
      const participants = reservation.participantCount ?? reservation.guestCount ?? reservation.numChildren ?? 0;

      if (daysUntil >= 0) acc.upcoming += 1;
      if (daysUntil >= 0 && daysUntil <= 7) acc.nextSevenDays += 1;
      if (reservation.paymentStatus === "paid") acc.paid += 1;
      acc.pending += reservation.remainingBalance;
      acc.participants += participants;

      return acc;
    },
    { upcoming: 0, pending: 0, paid: 0, nextSevenDays: 0, participants: 0 },
  );
}

function getSummaryValue(key: SummaryCardConfig["key"], summary: ReturnType<typeof buildSummary>) {
  if (key === "pending") return euro(summary.pending);
  if (key === "paid") return String(summary.paid);
  if (key === "nextSevenDays") return String(summary.nextSevenDays);
  if (key === "participants") return String(summary.participants);
  if (key === "occupancy") return summary.participants > 0 ? `${summary.participants} inscritos` : "Sem dados";
  return String(summary.upcoming);
}

function matchesBusinessArea(reservation: Reservation, type: BusinessAreaType) {
  if (reservation.reservationType === type) return true;
  const serviceType = reservation.serviceType.toLowerCase();

  if (type === "external_service") return serviceType.includes("extern");
  if (type === "workshop") return serviceType.includes("workshop");
  return serviceType.includes("festa") || serviceType.includes("espaco") || serviceType.includes("espa");
}

function getPrimaryLabel(reservation: Reservation, type: BusinessAreaType) {
  if (type === "workshop") return reservation.workshopName || reservation.pack || "Workshop/Formacao";
  if (type === "external_service") return reservation.pack || reservation.eventType || "Servico externo";
  return reservation.pack || "Festa no espaco";
}

function getSecondaryLabel(reservation: Reservation, type: BusinessAreaType) {
  if (type === "workshop") return reservation.workshopNotes || reservation.notes || "Inscricoes e participantes a estruturar na V2.";
  if (type === "external_service") {
    return [reservation.eventLocation, reservation.eventType, reservation.eventTheme].filter(Boolean).join(" · ") || "Servico realizado fora do espaco.";
  }
  return [reservation.birthdayChildName, reservation.partyTheme].filter(Boolean).join(" · ") || "Aniversario ou evento no Espaco Girafinha.";
}

function getPeopleLabel(reservation: Reservation, type: BusinessAreaType) {
  if (type === "workshop") return `${reservation.participantCount ?? reservation.numChildren ?? 0} participantes`;
  if (type === "external_service") return `${reservation.guestCount ?? reservation.numChildren ?? 0} pessoas`;
  return `${reservation.numChildren ?? 0} criancas`;
}

function getStatusLabel(status: Reservation["reservationStatus"]) {
  if (status === "confirmed") return "Confirmada";
  if (status === "completed") return "Concluida";
  if (status === "cancelled") return "Cancelada";
  return "Em preparacao";
}

function getToneClasses(tone: BusinessAreaPageProps["tone"]) {
  if (tone === "sky") {
    return {
      icon: "text-sky-700",
      iconBg: "bg-sky-100",
      dateBg: "bg-sky-50 text-sky-800",
    };
  }
  if (tone === "violet") {
    return {
      icon: "text-violet-700",
      iconBg: "bg-violet-100",
      dateBg: "bg-violet-50 text-violet-800",
    };
  }
  return {
    icon: "text-pink-700",
    iconBg: "bg-pink-100",
    dateBg: "bg-pink-50 text-pink-800",
  };
}

function euro(value: number) {
  return `${value.toFixed(2)} €`;
}
