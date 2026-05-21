import { useEffect, useMemo, useState } from "react";
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
import {
  getListVenueEventsQueryKey,
  useCreateVenueEvent,
  useUpdateVenueEvent,
} from "@workspace/api-client-react";
import type { CreateVenueEventBody, VenueEvent } from "@workspace/api-client-react";

type VenueEventFormState = {
  customerName: string;
  phone: string;
  email: string;
  nif: string;
  source: string;
  eventDate: string;
  startTime: string;
  endTime: string;
  status: "draft" | "confirmed" | "completed" | "cancelled";
  packName: string;
  birthdayChildName: string;
  birthdayChildAge: string;
  childrenCount: string;
  childrenAges: string;
  partyTheme: string;
  decorationNotes: string;
  cateringNotes: string;
  allergies: string;
  imageAuthorization: "rosto_visivel" | "rosto_tapado" | "nao_autorizo" | "";
  termsAccepted: boolean;
  totalPrice: string;
  amountPaid: string;
  paymentMethod: string;
  notes: string;
};

const PACK_PRICES: Record<string, number> = {
  "Aluguer do Espaço": 160,
  "Pack Simples": 220,
  "Pack Simples com Decoração": 350,
  "Pack VIP": 0,
  "Pack Deluxe": 500,
  "Pack Personalizado": 0,
};

const PACKS = Object.keys(PACK_PRICES);

const initialState: VenueEventFormState = {
  customerName: "",
  phone: "",
  email: "",
  nif: "",
  source: "",
  eventDate: "",
  startTime: "10:00",
  endTime: "13:00",
  status: "draft",
  packName: "Pack Simples",
  birthdayChildName: "",
  birthdayChildAge: "",
  childrenCount: "0",
  childrenAges: "",
  partyTheme: "",
  decorationNotes: "",
  cateringNotes: "",
  allergies: "",
  imageAuthorization: "",
  termsAccepted: false,
  totalPrice: "220",
  amountPaid: "0",
  paymentMethod: "",
  notes: "",
};

export function VenueEventModal({
  event,
  trigger,
}: {
  event?: VenueEvent;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<VenueEventFormState>(() => toFormState(event));
  const createVenueEvent = useCreateVenueEvent();
  const updateVenueEvent = useUpdateVenueEvent();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isEditing = Boolean(event);

  useEffect(() => {
    if (open) setForm(toFormState(event));
  }, [event, open]);

  const totalPrice = toNumber(form.totalPrice);
  const amountPaid = toNumber(form.amountPaid);
  const remainingBalance = Math.max(0, totalPrice - amountPaid);
  const isPending = createVenueEvent.isPending || updateVenueEvent.isPending;

  const activeSlot = useMemo(() => {
    if (form.startTime === "10:00" && form.endTime === "13:00") return "morning";
    if (form.startTime === "16:00" && form.endTime === "19:00") return "afternoon";
    return "custom";
  }, [form.endTime, form.startTime]);

  const patch = (value: Partial<VenueEventFormState>) => setForm((current) => ({ ...current, ...value }));

  const selectPack = (packName: string) => {
    patch({ packName, totalPrice: String(PACK_PRICES[packName] ?? 0) });
  };

  const selectSlot = (slot: "morning" | "afternoon" | "custom") => {
    if (slot === "morning") patch({ startTime: "10:00", endTime: "13:00" });
    if (slot === "afternoon") patch({ startTime: "16:00", endTime: "19:00" });
  };

  const handleSubmit = (submitEvent: React.FormEvent) => {
    submitEvent.preventDefault();

    if (!form.customerName.trim() || !form.phone.trim() || !form.eventDate || !form.startTime || !form.packName) {
      toast({ title: "Verifique os campos obrigatórios", variant: "destructive" });
      return;
    }

    const body = toRequestBody(form);
    const mutationOptions = {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListVenueEventsQueryKey() });
        toast({
          title: isEditing ? "Festa atualizada" : "Festa criada",
          description: `${form.customerName} ficou guardado em Festas no Espaço.`,
        });
        setOpen(false);
      },
      onError: () => {
        toast({ title: "Não foi possível guardar a festa", variant: "destructive" });
      },
    };

    if (event) {
      updateVenueEvent.mutate({ id: event.id, data: body }, mutationOptions);
    } else {
      createVenueEvent.mutate({ data: body }, mutationOptions);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button className="min-h-[42px] rounded-full bg-primary px-5 text-primary-foreground shadow-md hover:bg-primary/90">
            <Plus className="h-4 w-4" />
            Nova Festa
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Festa no Espaço" : "Nova Festa no Espaço"}</DialogTitle>
          <DialogDescription>
            Formulário próprio da V2 para aniversários, packs, decoração, catering e pagamentos.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <FormSection title="Dados do responsável">
            <Field label="Nome" required>
              <Input value={form.customerName} onChange={(event) => patch({ customerName: event.target.value })} />
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
            <Field label="Origem">
              <Input value={form.source} onChange={(event) => patch({ source: event.target.value })} placeholder="Instagram, WhatsApp, site..." />
            </Field>
          </FormSection>

          <FormSection title="Dados da festa">
            <Field label="Data" required>
              <Input type="date" value={form.eventDate} onChange={(event) => patch({ eventDate: event.target.value })} />
            </Field>
            <div className="space-y-2 md:col-span-2">
              <Label>Horário</Label>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant={activeSlot === "morning" ? "default" : "outline"} onClick={() => selectSlot("morning")}>
                  10h às 13h
                </Button>
                <Button type="button" variant={activeSlot === "afternoon" ? "default" : "outline"} onClick={() => selectSlot("afternoon")}>
                  16h às 19h
                </Button>
                <Button type="button" variant={activeSlot === "custom" ? "default" : "outline"} onClick={() => selectSlot("custom")}>
                  Outro
                </Button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Input type="time" value={form.startTime} onChange={(event) => patch({ startTime: event.target.value })} />
                <Input type="time" value={form.endTime} onChange={(event) => patch({ endTime: event.target.value })} />
              </div>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Pack</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {PACKS.map((pack) => (
                  <button
                    key={pack}
                    type="button"
                    onClick={() => selectPack(pack)}
                    className={`rounded-xl border p-3 text-left transition-colors ${
                      form.packName === pack ? "border-primary bg-primary/10" : "border-border bg-background hover:bg-muted/40"
                    }`}
                  >
                    <span className="block font-semibold">{pack}</span>
                    <span className="text-sm text-muted-foreground">{PACK_PRICES[pack].toFixed(2)} €</span>
                  </button>
                ))}
              </div>
            </div>
            <Field label="Aniversariante">
              <Input value={form.birthdayChildName} onChange={(event) => patch({ birthdayChildName: event.target.value })} />
            </Field>
            <Field label="Idade">
              <Input type="number" min="0" value={form.birthdayChildAge} onChange={(event) => patch({ birthdayChildAge: event.target.value })} />
            </Field>
            <Field label="Nº crianças">
              <Input type="number" min="0" value={form.childrenCount} onChange={(event) => patch({ childrenCount: event.target.value })} />
            </Field>
            <Field label="Idades/observações">
              <Input value={form.childrenAges} onChange={(event) => patch({ childrenAges: event.target.value })} />
            </Field>
            <Field label="Tema">
              <Input value={form.partyTheme} onChange={(event) => patch({ partyTheme: event.target.value })} />
            </Field>
            <Field label="Pedido especial/decoração">
              <Textarea value={form.decorationNotes} onChange={(event) => patch({ decorationNotes: event.target.value })} />
            </Field>
            <Field label="Catering/notas">
              <Textarea value={form.cateringNotes} onChange={(event) => patch({ cateringNotes: event.target.value })} />
            </Field>
            <Field label="Alergias/restrições">
              <Textarea value={form.allergies} onChange={(event) => patch({ allergies: event.target.value })} />
            </Field>
          </FormSection>

          <FormSection title="Autorizações">
            <Field label="Autorização de imagem">
              <select
                value={form.imageAuthorization}
                onChange={(event) => patch({ imageAuthorization: event.target.value as VenueEventFormState["imageAuthorization"] })}
                className="min-h-[40px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Por confirmar</option>
                <option value="rosto_visivel">Rosto visível</option>
                <option value="rosto_tapado">Rosto tapado</option>
                <option value="nao_autorizo">Não autorizo</option>
              </select>
            </Field>
            <label className="flex items-center gap-3 rounded-xl border border-border p-3 text-sm">
              <input
                type="checkbox"
                checked={form.termsAccepted}
                onChange={(event) => patch({ termsAccepted: event.target.checked })}
                className="h-4 w-4"
              />
              Condições aceites
            </label>
          </FormSection>

          <FormSection title="Pagamento">
            <Field label="Valor total">
              <Input type="number" min="0" step="0.01" value={form.totalPrice} onChange={(event) => patch({ totalPrice: event.target.value })} />
            </Field>
            <Field label="Valor pago/sinal">
              <Input type="number" min="0" step="0.01" value={form.amountPaid} onChange={(event) => patch({ amountPaid: event.target.value })} />
            </Field>
            <Field label="Método de pagamento">
              <Input value={form.paymentMethod} onChange={(event) => patch({ paymentMethod: event.target.value })} placeholder="MB Way, transferência..." />
            </Field>
            <div className="rounded-xl border border-border bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">Valor em falta</p>
              <p className={remainingBalance > 0 ? "text-xl font-bold text-rose-700" : "text-xl font-bold text-emerald-700"}>
                {remainingBalance.toFixed(2)} €
              </p>
            </div>
          </FormSection>

          <div className="space-y-2">
            <Label>Observações internas</Label>
            <Textarea value={form.notes} onChange={(event) => patch({ notes: event.target.value })} />
          </div>

          <DialogFooter className="sticky bottom-0 -mx-6 border-t border-border bg-background px-6 py-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isEditing ? <Edit className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {isEditing ? "Guardar alterações" : "Guardar Festa"}
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

function toFormState(event?: VenueEvent): VenueEventFormState {
  if (!event) return initialState;

  return {
    customerName: event.customerName,
    phone: event.phone,
    email: event.email ?? "",
    nif: event.nif ?? "",
    source: event.source ?? "",
    eventDate: event.eventDate,
    startTime: event.startTime,
    endTime: event.endTime ?? "",
    status: event.status,
    packName: event.packName,
    birthdayChildName: event.birthdayChildName ?? "",
    birthdayChildAge: event.birthdayChildAge?.toString() ?? "",
    childrenCount: event.childrenCount.toString(),
    childrenAges: event.childrenAges ?? "",
    partyTheme: event.partyTheme ?? "",
    decorationNotes: event.decorationNotes ?? "",
    cateringNotes: event.cateringNotes ?? "",
    allergies: event.allergies ?? "",
    imageAuthorization: event.imageAuthorization ?? "",
    termsAccepted: event.termsAccepted,
    totalPrice: String(event.totalPrice),
    amountPaid: String(event.amountPaid),
    paymentMethod: event.paymentMethod ?? "",
    notes: event.notes ?? "",
  };
}

function toRequestBody(form: VenueEventFormState): CreateVenueEventBody {
  return {
    customerName: form.customerName.trim(),
    phone: form.phone.trim(),
    email: emptyToNull(form.email),
    nif: emptyToNull(form.nif),
    source: emptyToNull(form.source),
    eventDate: form.eventDate,
    startTime: form.startTime,
    endTime: emptyToNull(form.endTime),
    status: form.status,
    packName: form.packName,
    birthdayChildName: emptyToNull(form.birthdayChildName),
    birthdayChildAge: form.birthdayChildAge ? Number(form.birthdayChildAge) : null,
    childrenCount: toNumber(form.childrenCount),
    childrenAges: emptyToNull(form.childrenAges),
    partyTheme: emptyToNull(form.partyTheme),
    decorationNotes: emptyToNull(form.decorationNotes),
    cateringNotes: emptyToNull(form.cateringNotes),
    allergies: emptyToNull(form.allergies),
    imageAuthorization: form.imageAuthorization || null,
    termsAccepted: form.termsAccepted,
    totalPrice: toNumber(form.totalPrice),
    amountPaid: toNumber(form.amountPaid),
    paymentMethod: emptyToNull(form.paymentMethod),
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
