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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { getListWorkshopsQueryKey, useCreateWorkshop, useUpdateWorkshop } from "@workspace/api-client-react";
import type { CreateWorkshopBody, Workshop, WorkshopStatus } from "@workspace/api-client-react";

type WorkshopFormState = {
  name: string;
  description: string;
  date: string;
  startTime: string;
  endTime: string;
  capacity: string;
  price: string;
  kitIncluded: boolean;
  status: WorkshopStatus;
  location: string;
  notes: string;
};

const initialState: WorkshopFormState = {
  name: "",
  description: "",
  date: "",
  startTime: "",
  endTime: "",
  capacity: "10",
  price: "70",
  kitIncluded: false,
  status: "draft",
  location: "Espaço Girafinha",
  notes: "",
};

const STATUS_OPTIONS: Array<{ value: WorkshopStatus; label: string }> = [
  { value: "draft", label: "Em preparação" },
  { value: "open", label: "Inscrições abertas" },
  { value: "full", label: "Lotado" },
  { value: "completed", label: "Concluído" },
  { value: "cancelled", label: "Cancelado" },
];

export function WorkshopModal({
  workshop,
  trigger,
}: {
  workshop?: Workshop;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<WorkshopFormState>(() => toFormState(workshop));
  const createWorkshop = useCreateWorkshop();
  const updateWorkshop = useUpdateWorkshop();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isEditing = Boolean(workshop);
  const isPending = createWorkshop.isPending || updateWorkshop.isPending;

  useEffect(() => {
    if (!open) return;
    setForm(toFormState(workshop));
  }, [open, workshop]);

  const patch = (value: Partial<WorkshopFormState>) => setForm((current) => ({ ...current, ...value }));

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    if (!form.name.trim() || !form.date || !form.startTime) {
      toast({
        title: "Verifique os campos obrigatórios",
        description: "Nome, data e hora de início são obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    if (toNumber(form.capacity) < 0 || toNumber(form.price) < 0) {
      toast({
        title: "Valores inválidos",
        description: "Nº de vagas e preço devem ser iguais ou superiores a zero.",
        variant: "destructive",
      });
      return;
    }

    const body = toRequestBody(form);
    const mutationOptions = {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListWorkshopsQueryKey() });
        toast({
          title: isEditing ? "Workshop atualizado" : "Workshop criado",
          description: `${form.name} ficou guardado em Workshops/Formações.`,
        });
        setOpen(false);
      },
      onError: () => {
        toast({ title: "Não foi possível guardar o workshop", variant: "destructive" });
      },
    };

    if (workshop) {
      updateWorkshop.mutate({ id: workshop.id, data: body }, mutationOptions);
    } else {
      createWorkshop.mutate({ data: body }, mutationOptions);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button className="min-h-[42px] rounded-full bg-primary px-5 text-primary-foreground shadow-md hover:bg-primary/90">
            <Plus className="h-4 w-4" />
            Novo Workshop
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Workshop" : "Novo Workshop"}</DialogTitle>
          <DialogDescription>Defina os dados gerais do workshop e acompanhe depois as inscrições no painel de participantes.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <FormSection title="Dados do workshop">
            <Field label="Nome do workshop" required>
              <Input value={form.name} onChange={(event) => patch({ name: event.target.value })} />
            </Field>
            <Field label="Estado">
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={form.status}
                onChange={(event) => patch({ status: event.target.value as WorkshopStatus })}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Descrição">
              <Textarea value={form.description} onChange={(event) => patch({ description: event.target.value })} />
            </Field>
            <Field label="Local">
              <Input value={form.location} onChange={(event) => patch({ location: event.target.value })} />
            </Field>
          </FormSection>

          <FormSection title="Data, vagas e preço">
            <Field label="Data" required>
              <Input type="date" value={form.date} onChange={(event) => patch({ date: event.target.value })} />
            </Field>
            <Field label="Hora início" required>
              <Input type="time" value={form.startTime} onChange={(event) => patch({ startTime: event.target.value })} />
            </Field>
            <Field label="Hora fim">
              <Input type="time" value={form.endTime} onChange={(event) => patch({ endTime: event.target.value })} />
            </Field>
            <Field label="Nº vagas" required>
              <Input type="number" min="0" value={form.capacity} onChange={(event) => patch({ capacity: event.target.value })} />
            </Field>
            <Field label="Preço por participante" required>
              <Input type="number" min="0" step="0.01" value={form.price} onChange={(event) => patch({ price: event.target.value })} />
            </Field>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
              <div>
                <p className="text-sm font-medium text-foreground">Kit incluído</p>
                <p className="text-xs text-muted-foreground">Assinale quando o workshop inclui material ou kit.</p>
              </div>
              <input
                type="checkbox"
                className="h-5 w-5 rounded border-border"
                checked={form.kitIncluded}
                onChange={(event) => patch({ kitIncluded: event.target.checked })}
              />
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
              {isEditing ? "Guardar alterações" : "Guardar Workshop"}
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

function toFormState(workshop?: Workshop): WorkshopFormState {
  if (!workshop) return initialState;

  return {
    name: workshop.name,
    description: workshop.description ?? "",
    date: workshop.date,
    startTime: workshop.startTime,
    endTime: workshop.endTime ?? "",
    capacity: String(workshop.capacity),
    price: String(workshop.price),
    kitIncluded: workshop.kitIncluded,
    status: workshop.status,
    location: workshop.location ?? "",
    notes: workshop.notes ?? "",
  };
}

function toRequestBody(form: WorkshopFormState): CreateWorkshopBody {
  return {
    name: form.name.trim(),
    description: emptyToNull(form.description),
    date: form.date,
    startTime: form.startTime,
    endTime: emptyToNull(form.endTime),
    capacity: toNumber(form.capacity),
    price: toNumber(form.price),
    kitIncluded: form.kitIncluded,
    status: form.status,
    location: emptyToNull(form.location),
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
