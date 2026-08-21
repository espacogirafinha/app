import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Edit, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MoneyInput } from "@/components/money-input";
import { parseMoneyInput } from "@/lib/money";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  getGetWorkshopQueryKey,
  getListWorkshopsQueryKey,
  useCreateWorkshopParticipant,
  useUpdateWorkshopParticipant,
} from "@workspace/api-client-react";
import type {
  CreateWorkshopParticipantBody,
  Workshop,
  WorkshopParticipant,
  WorkshopParticipantStatus,
} from "@workspace/api-client-react";

type ParticipantFormState = {
  name: string;
  phone: string;
  email: string;
  nif: string;
  amountPaid: string;
  paymentMethod: string;
  status: WorkshopParticipantStatus;
  notes: string;
};

const initialState: ParticipantFormState = {
  name: "",
  phone: "",
  email: "",
  nif: "",
  amountPaid: "0",
  paymentMethod: "",
  status: "registered",
  notes: "",
};

const STATUS_OPTIONS: Array<{ value: WorkshopParticipantStatus; label: string }> = [
  { value: "registered", label: "Inscrito" },
  { value: "confirmed", label: "Confirmado" },
  { value: "attended", label: "Presente" },
  { value: "cancelled", label: "Cancelado" },
];

export function WorkshopParticipantModal({
  workshop,
  participant,
  trigger,
}: {
  workshop: Workshop;
  participant?: WorkshopParticipant;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ParticipantFormState>(() => toFormState(participant));
  const createParticipant = useCreateWorkshopParticipant();
  const updateParticipant = useUpdateWorkshopParticipant();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isEditing = Boolean(participant);
  const isPending = createParticipant.isPending || updateParticipant.isPending;
  const amountPaid = parseMoneyInput(form.amountPaid);
  const expectedDue = Math.max(0, workshop.price - amountPaid);

  useEffect(() => {
    if (!open) return;
    setForm(toFormState(participant));
  }, [open, participant]);

  const patch = (value: Partial<ParticipantFormState>) => setForm((current) => ({ ...current, ...value }));

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    if (!form.name.trim() || !form.phone.trim()) {
      toast({
        title: "Verifique os campos obrigatórios",
        description: "Nome e telemóvel são obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    if (amountPaid < 0) {
      toast({
        title: "Valor pago inválido",
        description: "O valor pago deve ser igual ou superior a zero.",
        variant: "destructive",
      });
      return;
    }

    const body = toRequestBody(form);
    const mutationOptions = {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListWorkshopsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetWorkshopQueryKey(workshop.id) });
        toast({
          title: isEditing ? "Participante atualizado" : "Participante adicionado",
          description: `${form.name} ficou guardado em ${workshop.name}.`,
        });
        setOpen(false);
      },
      onError: (error: unknown) => {
        const message = error instanceof Error ? error.message : "";
        const isCapacityError = message.toLowerCase().includes("capacity");
        toast({
          title: isCapacityError ? "Workshop sem vagas disponíveis" : "Não foi possível guardar o participante",
          description: isCapacityError
            ? "Este workshop já atingiu a capacidade. Cancele uma inscrição ou aumente o número de vagas."
            : "Confirme os dados e se ainda existem vagas disponíveis.",
          variant: "destructive",
        });
      },
    };

    if (participant) {
      updateParticipant.mutate({ id: workshop.id, participantId: participant.id, data: body }, mutationOptions);
    } else {
      createParticipant.mutate({ id: workshop.id, data: body }, mutationOptions);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button className="min-h-[42px] rounded-full">
            <Plus className="h-4 w-4" />
            Adicionar participante
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar participante" : "Adicionar participante"}</DialogTitle>
          <DialogDescription>
            {workshop.name} · {workshop.date} às {workshop.startTime}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <FormSection title="Dados do participante">
            <Field label="Nome" required>
              <Input value={form.name} onChange={(event) => patch({ name: event.target.value })} />
            </Field>
            <Field label="Telemóvel" required>
              <Input value={form.phone} onChange={(event) => patch({ phone: event.target.value })} />
            </Field>
            <Field label="Email">
              <Input type="email" value={form.email} onChange={(event) => patch({ email: event.target.value })} />
            </Field>
            <Field label="NIF">
              <Input value={form.nif} onChange={(event) => patch({ nif: event.target.value })} />
            </Field>
          </FormSection>

          <FormSection title="Inscrição e pagamento">
            <Field label="Estado">
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={form.status}
                onChange={(event) => patch({ status: event.target.value as WorkshopParticipantStatus })}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Valor pago">
              <MoneyInput value={form.amountPaid} onValueChange={(value) => patch({ amountPaid: value })} />
            </Field>
            <Field label="Método de pagamento">
              <Input value={form.paymentMethod} onChange={(event) => patch({ paymentMethod: event.target.value })} placeholder="MB Way, transferência..." />
            </Field>
            <div className="rounded-xl border border-border bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">Valor em falta calculado</p>
              <p className={expectedDue > 0 ? "text-xl font-bold text-rose-700" : "text-xl font-bold text-emerald-700"}>
                {expectedDue.toFixed(2)} €
              </p>
            </div>
          </FormSection>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea value={form.notes} onChange={(event) => patch({ notes: event.target.value })} />
          </div>

          <DialogFooter className="sticky bottom-0 -mx-6 border-t border-border bg-background px-6 py-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isEditing ? <Edit className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {isEditing ? "Guardar alterações" : "Adicionar participante"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-xl border border-border p-3 md:p-4">
      <h3 className="font-semibold text-foreground">{title}</h3>
      <div className="grid gap-3 md:grid-cols-2">{children}</div>
    </section>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {children}
    </div>
  );
}

function toFormState(participant?: WorkshopParticipant): ParticipantFormState {
  if (!participant) return initialState;

  return {
    name: participant.name,
    phone: participant.phone,
    email: participant.email ?? "",
    nif: participant.nif ?? "",
    amountPaid: String(participant.amountPaid),
    paymentMethod: participant.paymentMethod ?? "",
    status: participant.status,
    notes: participant.notes ?? "",
  };
}

function toRequestBody(form: ParticipantFormState): CreateWorkshopParticipantBody {
  return {
    name: form.name.trim(),
    phone: form.phone.trim(),
    email: emptyToNull(form.email),
    nif: emptyToNull(form.nif),
    amountPaid: parseMoneyInput(form.amountPaid),
    paymentMethod: emptyToNull(form.paymentMethod),
    status: form.status,
    notes: emptyToNull(form.notes),
  };
}

function emptyToNull(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function toNumber(value: string | number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
