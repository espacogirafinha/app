import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Euro,
  Loader2,
  Plus,
  Save,
  Trash2,
  UserCheck,
  Users,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ReservationModal } from "@/components/reservation-modal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { PACK_PRICES } from "@/lib/constants";
import {
  getGetDashboardStatsQueryKey,
  getGetUpcomingReservationsQueryKey,
  getListReservationsQueryKey,
  useListReservations,
  useUpdateReservation,
} from "@workspace/api-client-react";
import type { Reservation } from "@workspace/api-client-react";

type ParticipantStatus = "confirmed" | "waitlist" | "cancelled";
type ParticipantFilter = "all" | "confirmed" | "waitlist" | "unpaid";

type WorkshopParticipant = {
  id: string;
  name: string;
  phone: string;
  amountPaid: number;
  notes: string;
  status: ParticipantStatus;
};

type ParticipantStats = {
  confirmed: number;
  waitlist: number;
  cancelled: number;
  paid: number;
  partial: number;
  unpaid: number;
  expectedRevenue: number;
  received: number;
  pendingPayment: number;
};

const START_MARKER = "[WORKSHOP_PARTICIPANTS]";
const END_MARKER = "[/WORKSHOP_PARTICIPANTS]";

const euro = (value: number) => `${value.toFixed(2)} €`;
const newId = () => `participant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const STATUS_LABELS: Record<ParticipantStatus, string> = {
  confirmed: "Confirmado",
  waitlist: "Lista de espera",
  cancelled: "Cancelado",
};

export default function WorkshopsPage() {
  const { data: reservations, isLoading } = useListReservations({ serviceType: "Workshops" });
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const workshops = useMemo(
    () => [...(reservations ?? [])].sort((a, b) => a.eventDate.localeCompare(b.eventDate)),
    [reservations],
  );
  const selectedWorkshop = workshops.find((workshop) => workshop.id === selectedId) ?? workshops[0];

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-primary">Workshops</h1>
          <p className="mt-1 text-sm md:text-base text-muted-foreground">
            Gestão de inscrições, participantes e pagamentos por pessoa.
          </p>
        </div>
        <ReservationModal
          defaultPack="Workshop Balões Nível 1"
          trigger={
            <Button className="min-h-[44px] rounded-full bg-primary px-5 text-primary-foreground shadow-md hover:bg-primary/90">
              <Plus className="h-4 w-4" />
              Novo Workshop
            </Button>
          }
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
          <Card className="h-fit border-border/70 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Workshops agendados</CardTitle>
              <CardDescription>
                {workshops.length} workshop{workshops.length === 1 ? "" : "s"} registado{workshops.length === 1 ? "" : "s"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {workshops.length === 0 ? (
                <EmptyState text="Ainda não há workshops registados." />
              ) : (
                workshops.map((workshop) => {
                  const participants = getWorkshopParticipants(workshop);
                  const stats = getParticipantStats(participants, getParticipantPrice(workshop));
                  const isSelected = selectedWorkshop?.id === workshop.id;
                  return (
                    <button
                      key={workshop.id}
                      type="button"
                      onClick={() => setSelectedId(workshop.id)}
                      className={`w-full rounded-xl border p-3 text-left transition-colors ${
                        isSelected ? "border-primary bg-primary/5" : "border-border bg-background hover:bg-muted/40"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{workshop.pack}</p>
                          <p className="text-sm text-muted-foreground">
                            {format(parseISO(workshop.eventDate), "dd MMM yyyy", { locale: ptBR })} · {workshop.eventTime}
                          </p>
                        </div>
                        <Badge variant={stats.pendingPayment > 0 ? "destructive" : "outline"} className="rounded-md">
                          {stats.confirmed}
                        </Badge>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="truncate">{workshop.customerName}</span>
                        {stats.waitlist > 0 && <span>{stats.waitlist} em espera</span>}
                        {stats.pendingPayment > 0 && <span className="font-medium text-amber-700">{euro(stats.pendingPayment)} por receber</span>}
                      </div>
                    </button>
                  );
                })
              )}
            </CardContent>
          </Card>

          {selectedWorkshop ? <WorkshopManager workshop={selectedWorkshop} /> : <EmptyWorkshopPanel />}
        </div>
      )}
    </div>
  );
}

function WorkshopManager({ workshop }: { workshop: Reservation }) {
  const [participants, setParticipants] = useState(() => getWorkshopParticipants(workshop));
  const [filter, setFilter] = useState<ParticipantFilter>("all");
  const updateReservation = useUpdateReservation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    setParticipants(getWorkshopParticipants(workshop));
    setFilter("all");
  }, [workshop.id, workshop.notes, workshop.amountPaid, workshop.totalPrice, workshop.numChildren, workshop.pack]);

  const participantPrice = getParticipantPrice(workshop);
  const stats = getParticipantStats(participants, participantPrice);
  const paymentProgress = stats.expectedRevenue > 0 ? Math.round((stats.received / stats.expectedRevenue) * 100) : 0;
  const filteredParticipants = participants.filter((participant) => {
    if (filter === "confirmed") return participant.status === "confirmed";
    if (filter === "waitlist") return participant.status === "waitlist";
    if (filter === "unpaid") return participant.status === "confirmed" && participant.amountPaid < participantPrice;
    return true;
  });

  const updateParticipant = (id: string, patch: Partial<WorkshopParticipant>) => {
    setParticipants((current) =>
      current.map((participant) =>
        participant.id === id
          ? { ...participant, ...patch, amountPaid: patch.amountPaid !== undefined ? Math.max(0, patch.amountPaid) : participant.amountPaid }
          : participant,
      ),
    );
  };

  const addParticipant = (status: ParticipantStatus = "confirmed") => {
    setParticipants((current) => [...current, { id: newId(), name: "", phone: "", amountPaid: 0, notes: "", status }]);
  };

  const removeParticipant = (id: string) => {
    setParticipants((current) => current.filter((participant) => participant.id !== id));
  };

  const markAsPaid = (id: string) => {
    updateParticipant(id, { amountPaid: participantPrice, status: "confirmed" });
  };

  const markDepositPaid = (id: string) => {
    updateParticipant(id, { amountPaid: Math.min(participantPrice, participantPrice / 2), status: "confirmed" });
  };

  const saveParticipants = () => {
    const notes = writeParticipants(workshop.notes, participants);
    updateReservation.mutate(
      {
        id: workshop.id,
        data: {
          notes,
          numChildren: stats.confirmed,
          amountPaid: stats.received,
          totalPrice: stats.expectedRevenue,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListReservationsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetUpcomingReservationsQueryKey() });
          toast({ title: "Inscrições guardadas", description: "Participantes e pagamentos do workshop atualizados." });
        },
      },
    );
  };

  const exportCsv = () => {
    const headers = ["Workshop", "Data", "Estado", "Participante", "Telefone", "Pago", "Em falta", "Notas"];
    const rows = participants.map((participant) =>
      [
        csv(workshop.pack),
        workshop.eventDate,
        csv(STATUS_LABELS[participant.status]),
        csv(participant.name),
        csv(participant.phone),
        participant.amountPaid,
        getParticipantPending(participant, participantPrice),
        csv(participant.notes),
      ].join(","),
    );
    downloadCsv([headers.join(","), ...rows].join("\n"), `workshop_${workshop.eventDate}.csv`);
  };

  return (
    <div className="space-y-4">
      <Card className="border-border/70 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <CardTitle className="text-xl">{workshop.pack}</CardTitle>
              <CardDescription>
                {format(parseISO(workshop.eventDate), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })} · {workshop.eventTime}
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={exportCsv} disabled={participants.length === 0} className="rounded-xl">
                <Download className="h-4 w-4" />
                Exportar
              </Button>
              <Button onClick={saveParticipants} disabled={updateReservation.isPending} className="rounded-xl">
                <Save className="h-4 w-4" />
                Guardar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <Metric label="Confirmados" value={String(stats.confirmed)} icon={UserCheck} />
            <Metric label="Lista de espera" value={String(stats.waitlist)} icon={Users} />
            <Metric label="Pagos" value={`${stats.paid}/${stats.confirmed}`} icon={CheckCircle2} tone="success" />
            <Metric label="Recebido" value={euro(stats.received)} icon={Euro} tone="success" />
            <Metric label="Por receber" value={euro(stats.pendingPayment)} icon={AlertCircle} tone="warning" />
          </div>
          <div className="rounded-xl border border-border p-3">
            <div className="mb-2 flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">Progresso de pagamentos</span>
              <span className="font-semibold">{paymentProgress}%</span>
            </div>
            <Progress value={paymentProgress} className="h-2" />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/70 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <CardTitle className="text-base">Inscrições</CardTitle>
              <CardDescription>Preço por participante: {euro(participantPrice || 0)}</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <FilterButton active={filter === "all"} onClick={() => setFilter("all")}>Todos</FilterButton>
              <FilterButton active={filter === "confirmed"} onClick={() => setFilter("confirmed")}>Confirmados</FilterButton>
              <FilterButton active={filter === "waitlist"} onClick={() => setFilter("waitlist")}>Espera</FilterButton>
              <FilterButton active={filter === "unpaid"} onClick={() => setFilter("unpaid")}>Por pagar</FilterButton>
              <Button type="button" variant="secondary" onClick={() => addParticipant("confirmed")} className="rounded-xl">
                <Plus className="h-4 w-4" />
                Participante
              </Button>
              <Button type="button" variant="outline" onClick={() => addParticipant("waitlist")} className="rounded-xl">
                <Plus className="h-4 w-4" />
                Espera
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {participants.length === 0 ? (
            <EmptyState text="Adiciona o primeiro participante deste workshop." />
          ) : filteredParticipants.length === 0 ? (
            <EmptyState text="Não há participantes neste filtro." />
          ) : (
            filteredParticipants.map((participant) => {
              const pending = getParticipantPending(participant, participantPrice);
              const paymentState = getPaymentState(participant, participantPrice);
              return (
                <div key={participant.id} className="space-y-3 rounded-xl border border-border p-3">
                  <div className="grid gap-2 lg:grid-cols-[1.3fr_130px_150px_130px]">
                    <Input
                      value={participant.name}
                      onChange={(event) => updateParticipant(participant.id, { name: event.target.value })}
                      placeholder="Nome do participante"
                    />
                    <Input
                      value={participant.phone}
                      onChange={(event) => updateParticipant(participant.id, { phone: event.target.value })}
                      placeholder="Telefone"
                    />
                    <Select
                      value={participant.status}
                      onValueChange={(value) => updateParticipant(participant.id, { status: value as ParticipantStatus })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="confirmed">Confirmado</SelectItem>
                        <SelectItem value="waitlist">Lista de espera</SelectItem>
                        <SelectItem value="cancelled">Cancelado</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      step="0.01"
                      value={participant.amountPaid}
                      onChange={(event) => updateParticipant(participant.id, { amountPaid: Number(event.target.value) || 0 })}
                      aria-label="Valor pago"
                    />
                  </div>
                  <div className="grid gap-2 lg:grid-cols-[1fr_auto] lg:items-center">
                    <Input
                      value={participant.notes}
                      onChange={(event) => updateParticipant(participant.id, { notes: event.target.value })}
                      placeholder={pending > 0 ? `Falta ${euro(pending)}` : paymentState.label}
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <PaymentBadge state={paymentState} />
                      <Button type="button" variant="outline" size="sm" onClick={() => markDepositPaid(participant.id)}>
                        Sinal
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => markAsPaid(participant.id)}>
                        Pago
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeParticipant(participant.id)}
                        aria-label="Remover participante"
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function getParticipantPrice(workshop: Reservation) {
  return PACK_PRICES[workshop.pack as keyof typeof PACK_PRICES] ?? workshop.totalPrice;
}

function getParticipantPending(participant: WorkshopParticipant, participantPrice: number) {
  if (participant.status !== "confirmed") return 0;
  return Math.max(0, participantPrice - participant.amountPaid);
}

function getPaymentState(participant: WorkshopParticipant, participantPrice: number) {
  if (participant.status === "waitlist") return { label: "Em espera", tone: "neutral" as const };
  if (participant.status === "cancelled") return { label: "Cancelado", tone: "danger" as const };
  if (participant.amountPaid >= participantPrice) return { label: "Pago", tone: "success" as const };
  if (participant.amountPaid > 0) return { label: "Sinal", tone: "warning" as const };
  return { label: "Por pagar", tone: "danger" as const };
}

function getParticipantStats(participants: WorkshopParticipant[], participantPrice: number): ParticipantStats {
  return participants.reduce<ParticipantStats>(
    (acc, participant) => {
      const paymentState = getPaymentState(participant, participantPrice);

      if (participant.status === "confirmed") {
        acc.confirmed += 1;
        acc.expectedRevenue += participantPrice;
        acc.received += participant.amountPaid;
        acc.pendingPayment += getParticipantPending(participant, participantPrice);
        if (paymentState.label === "Pago") acc.paid += 1;
        if (paymentState.label === "Sinal") acc.partial += 1;
        if (paymentState.label === "Por pagar") acc.unpaid += 1;
      }

      if (participant.status === "waitlist") acc.waitlist += 1;
      if (participant.status === "cancelled") acc.cancelled += 1;
      return acc;
    },
    { confirmed: 0, waitlist: 0, cancelled: 0, paid: 0, partial: 0, unpaid: 0, expectedRevenue: 0, received: 0, pendingPayment: 0 },
  );
}

function parseParticipants(notes?: string | null): WorkshopParticipant[] {
  if (!notes) return [];
  const start = notes.indexOf(START_MARKER);
  const end = notes.indexOf(END_MARKER);
  if (start === -1 || end === -1 || end <= start) return [];

  try {
    const raw = notes.slice(start + START_MARKER.length, end).trim();
    const parsed = JSON.parse(raw) as Partial<WorkshopParticipant>[];
    return parsed.map((participant) => ({
      id: participant.id || newId(),
      name: participant.name || "",
      phone: participant.phone || "",
      amountPaid: Number(participant.amountPaid) || 0,
      notes: participant.notes || "",
      status: participant.status || "confirmed",
    }));
  } catch {
    return [];
  }
}

function getWorkshopParticipants(workshop: Reservation): WorkshopParticipant[] {
  const savedParticipants = parseParticipants(workshop.notes);
  if (savedParticipants.length > 0) return savedParticipants;

  const participantPrice = getParticipantPrice(workshop);
  const inferredByTotal = participantPrice > 0 ? Math.round(workshop.totalPrice / participantPrice) : 0;
  const participantCount = Math.max(0, inferredByTotal || workshop.numChildren || 0);
  let remainingPaid = workshop.amountPaid;

  return Array.from({ length: participantCount }, (_, index) => {
    const amountPaid = Math.min(participantPrice, Math.max(0, remainingPaid));
    remainingPaid = Math.max(0, remainingPaid - amountPaid);

    return {
      id: `participant-${workshop.id}-${index + 1}`,
      name: "",
      phone: "",
      amountPaid,
      notes: "",
      status: "confirmed",
    };
  });
}

function writeParticipants(notes: string | null | undefined, participants: WorkshopParticipant[]) {
  const cleanNotes = removeParticipantsBlock(notes);
  const block = `${START_MARKER}\n${JSON.stringify(participants, null, 2)}\n${END_MARKER}`;
  return cleanNotes ? `${cleanNotes.trim()}\n\n${block}` : block;
}

function removeParticipantsBlock(notes?: string | null) {
  if (!notes) return "";
  const pattern = new RegExp(`${escapeRegex(START_MARKER)}[\\s\\S]*?${escapeRegex(END_MARKER)}`, "m");
  return notes.replace(pattern, "").trim();
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function PaymentBadge({ state }: { state: ReturnType<typeof getPaymentState> }) {
  const className =
    state.tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : state.tone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : state.tone === "danger"
          ? "border-rose-200 bg-rose-50 text-rose-700"
          : "border-slate-200 bg-slate-50 text-slate-700";

  return (
    <Badge variant="outline" className={`rounded-md ${className}`}>
      {state.label}
    </Badge>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button type="button" variant={active ? "default" : "outline"} size="sm" onClick={onClick} className="rounded-xl">
      {children}
    </Button>
  );
}

function Metric({ label, value, icon: Icon, tone }: { label: string; value: string; icon: React.ElementType; tone?: "success" | "warning" }) {
  const color = tone === "success" ? "text-emerald-700" : tone === "warning" ? "text-amber-700" : "";
  return (
    <div className="rounded-xl border border-border p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className={`mt-1 text-xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

function EmptyWorkshopPanel() {
  return (
    <Card className="border-border/70 shadow-sm">
      <CardContent className="p-8">
        <EmptyState text="Cria ou seleciona um workshop para gerir inscrições." />
      </CardContent>
    </Card>
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
