import { Loader2, MessageCircle, Pencil, Trash2, UserX, Users } from "lucide-react";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
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
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { buildTemplatedWhatsAppUrl, formatAmount } from "@/lib/whatsapp-templates";
import { WorkshopParticipantModal } from "@/components/workshop-participant-modal";
import {
  getGetWorkshopQueryKey,
  getListWorkshopsQueryKey,
  useDeleteWorkshopParticipant,
  useGetWorkshop,
  useListMessageTemplates,
  useUpdateWorkshopParticipant,
} from "@workspace/api-client-react";
import type { MessageTemplate, Workshop, WorkshopParticipant } from "@workspace/api-client-react";

export function WorkshopParticipantsPanel({
  workshop,
  trigger,
}: {
  workshop: Workshop;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const query = useGetWorkshop(workshop.id, { query: { enabled: open, queryKey: getGetWorkshopQueryKey(workshop.id) } });
  const { data: messageTemplates } = useListMessageTemplates();
  const fullWorkshop = query.data ?? workshop;
  const participants = fullWorkshop.participants ?? [];
  const updateParticipant = useUpdateWorkshopParticipant();
  const deleteParticipant = useDeleteWorkshopParticipant();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: getListWorkshopsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetWorkshopQueryKey(workshop.id) });
  };

  const cancelParticipant = (participant: WorkshopParticipant) => {
    updateParticipant.mutate(
      { id: workshop.id, participantId: participant.id, data: { status: "cancelled" } },
      {
        onSuccess: () => {
          refresh();
          toast({ title: "Inscrição cancelada", description: `${participant.name} ficou marcado como cancelado.` });
        },
        onError: () => {
          toast({ title: "Não foi possível cancelar a inscrição", variant: "destructive" });
        },
      },
    );
  };

  const removeParticipant = (participant: WorkshopParticipant) => {
    deleteParticipant.mutate(
      { id: workshop.id, participantId: participant.id },
      {
        onSuccess: () => {
          refresh();
          toast({ title: "Participante removido", description: `${participant.name} foi removido da lista.` });
        },
        onError: () => {
          toast({ title: "Não foi possível remover o participante", variant: "destructive" });
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Participantes · {fullWorkshop.name}</DialogTitle>
          <DialogDescription>
            {fullWorkshop.date} às {fullWorkshop.startTime}
            {fullWorkshop.endTime ? `-${fullWorkshop.endTime}` : ""} · {fullWorkshop.capacity} vagas
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <section className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <Metric label="Inscritos ativos" value={`${fullWorkshop.activeParticipantsCount}/${fullWorkshop.capacity}`} />
            <Metric label="Vagas livres" value={String(fullWorkshop.availableSeats)} />
            <Metric label="Recebido" value={`${fullWorkshop.totalReceived.toFixed(2)} €`} />
            <Metric label="Por receber" value={`${fullWorkshop.totalPending.toFixed(2)} €`} />
          </section>

          <div className="flex flex-col gap-2 rounded-xl border border-border bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-foreground">Lista de participantes</p>
              <p className="text-sm text-muted-foreground">Participantes cancelados continuam visíveis, mas não ocupam vaga.</p>
            </div>
            <WorkshopParticipantModal workshop={fullWorkshop} />
          </div>

          {query.isLoading ? (
            <div className="flex justify-center p-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
            </div>
          ) : participants.length > 0 ? (
            <div className="grid gap-3">
              {participants.map((participant) => (
                <ParticipantCard
                  key={participant.id}
                  workshop={fullWorkshop}
                  participant={participant}
                  onCancel={() => cancelParticipant(participant)}
                  onRemove={() => removeParticipant(participant)}
                  isMutating={updateParticipant.isPending || deleteParticipant.isPending}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground">
              <Users className="mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="font-medium text-foreground">Ainda não há participantes inscritos.</p>
              <p className="mt-1 text-sm">Adicione o primeiro participante deste workshop.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ParticipantCard({
  workshop,
  participant,
  onCancel,
  onRemove,
  isMutating,
  messageTemplates,
}: {
  workshop: Workshop;
  participant: WorkshopParticipant;
  onCancel: () => void;
  onRemove: () => void;
  isMutating: boolean;
  messageTemplates?: MessageTemplate[];
}) {
  const isCancelled = participant.status === "cancelled";
  const whatsappUrl = buildWhatsAppUrl(workshop, participant, messageTemplates);

  return (
    <div className={`rounded-xl border border-border bg-background p-4 ${isCancelled ? "opacity-65" : ""}`}>
      <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-bold text-foreground">{participant.name}</h3>
            <ParticipantStatusBadge status={participant.status} />
            <PaymentBadge status={participant.paymentStatus} />
          </div>
          <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
            <span>{participant.phone}</span>
            {participant.email && <span>{participant.email}</span>}
            {participant.paymentMethod && <span>{participant.paymentMethod}</span>}
          </div>
          <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <Info label="Valor pago" value={`${participant.amountPaid.toFixed(2)} €`} />
            <Info label="Em falta" value={`${participant.amountDue.toFixed(2)} €`} highlight={participant.amountDue > 0} />
            <Info label="NIF" value={participant.nif} />
          </div>
          {participant.notes && (
            <p className="rounded-lg bg-muted/40 p-2 text-sm text-muted-foreground">{participant.notes}</p>
          )}
        </div>

        <div className="flex flex-wrap gap-2 lg:justify-end">
          <Button asChild variant="outline" size="sm" className="rounded-xl">
            <a href={whatsappUrl} target="_blank" rel="noreferrer">
              <MessageCircle className="h-4 w-4" />
              WhatsApp
            </a>
          </Button>
          <WorkshopParticipantModal
            workshop={workshop}
            participant={participant}
            trigger={
              <Button variant="outline" size="sm" className="rounded-xl">
                <Pencil className="h-4 w-4" />
                Editar
              </Button>
            }
          />
          {!isCancelled && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" disabled={isMutating} className="rounded-xl text-amber-700 hover:text-amber-800">
                  <UserX className="h-4 w-4" />
                  Cancelar
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancelar inscrição?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {participant.name} continua visível no workshop, mas deixa de ocupar vaga.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Voltar</AlertDialogCancel>
                  <AlertDialogAction onClick={onCancel} disabled={isMutating}>
                    Cancelar inscrição
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {participant.amountPaid <= 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" disabled={isMutating} className="rounded-xl text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                  Apagar
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Apagar participante?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação remove {participant.name} da lista. Use cancelar quando já existir pagamento registado.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Voltar</AlertDialogCancel>
                  <AlertDialogAction onClick={onRemove} disabled={isMutating}>
                    Apagar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold text-foreground">{value}</p>
    </div>
  );
}

function ParticipantStatusBadge({ status }: { status: WorkshopParticipant["status"] }) {
  const labels = {
    registered: "Inscrito",
    confirmed: "Confirmado",
    attended: "Presente",
    cancelled: "Cancelado",
  };
  const classes = {
    registered: "bg-sky-100 text-sky-800 hover:bg-sky-100",
    confirmed: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
    attended: "bg-violet-100 text-violet-800 hover:bg-violet-100",
    cancelled: "bg-rose-100 text-rose-800 hover:bg-rose-100",
  };
  return <Badge className={`rounded-md ${classes[status]}`}>{labels[status]}</Badge>;
}

function PaymentBadge({ status }: { status: WorkshopParticipant["paymentStatus"] }) {
  if (status === "paid") return <Badge className="rounded-md bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Pago</Badge>;
  if (status === "partial") return <Badge className="rounded-md bg-amber-100 text-amber-800 hover:bg-amber-100">Sinal</Badge>;
  return <Badge className="rounded-md bg-rose-100 text-rose-800 hover:bg-rose-100">Por pagar</Badge>;
}

function Info({ label, value, highlight }: { label: string; value?: string | null; highlight?: boolean }) {
  return (
    <div>
      <span className="text-muted-foreground">{label}: </span>
      <span className={highlight ? "font-semibold text-rose-700" : "font-medium text-foreground"}>{value || "-"}</span>
    </div>
  );
}

function buildWhatsAppUrl(workshop: Workshop, participant: WorkshopParticipant, templates?: MessageTemplate[]) {
  const fallback = `Ola ${participant.name}, confirmamos a sua inscricao no workshop ${workshop.name}, no dia ${workshop.date} as ${workshop.startTime}. Obrigada, Espaco Girafinha.`;
  return buildTemplatedWhatsAppUrl(participant.phone, fallback, templates, "workshop_participants", {
    participantName: participant.name,
    workshopName: workshop.name,
    eventDate: workshop.date,
    startTime: workshop.startTime,
    amountDue: formatAmount(participant.amountDue),
  });
}
