import { useEffect, useMemo, useRef, useState } from "react";
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
import { EventAttachmentsEditor, type EventAttachmentsHandle } from "@/components/event-attachments";
import { Textarea } from "@/components/ui/textarea";
import { formatMoneyInput, parseMoneyInput } from "@/lib/money";
import {
  calculateExtrasTotal,
  EventExtrasSelector,
  toEventExtraDrafts,
  toSelectedExtraInputs,
  type EventExtraDraft,
} from "@/components/event-extras-selector";
import { useToast } from "@/hooks/use-toast";
import {
  getListSelectedExtrasQueryKey,
  getListVenueEventsQueryKey,
  useCreateVenueEvent,
  useListSelectedExtras,
  useListVenuePacks,
  useReplaceSelectedExtras,
  useUpdateVenueEvent,
} from "@workspace/api-client-react";
import type { CreateVenueEventBody, VenueEvent, VenuePack } from "@workspace/api-client-react";

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

type PackOption = {
  name: string;
  basePrice: number;
  defaultStartTime?: string | null;
  defaultEndTime?: string | null;
  sortOrder: number;
};

const FALLBACK_PACKS: PackOption[] = Object.entries(PACK_PRICES).map(([name, basePrice], index) => ({
  name,
  basePrice,
  defaultStartTime: null,
  defaultEndTime: null,
  sortOrder: index,
}));

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
  const [extras, setExtras] = useState<EventExtraDraft[]>([]);
  const [basePrice, setBasePrice] = useState(() => getFallbackPackPrice(event?.packName));
  const [isTotalManual, setIsTotalManual] = useState(false);
  const loadedExtrasEntityRef = useRef<string | null>(null);
  const attachmentsRef = useRef<EventAttachmentsHandle>(null);
  const createVenueEvent = useCreateVenueEvent();
  const updateVenueEvent = useUpdateVenueEvent();
  const replaceSelectedExtras = useReplaceSelectedExtras();
  const venuePacksQuery = useListVenuePacks();
  const selectedExtrasQuery = useListSelectedExtras(
    { module: "venue_events", entityId: event?.id ?? "" },
    {
      query: {
        enabled: open && Boolean(event?.id),
        queryKey: getListSelectedExtrasQueryKey({ module: "venue_events", entityId: event?.id ?? "" }),
      },
    },
  );
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isEditing = Boolean(event);

  const totalPrice = parseMoneyInput(form.totalPrice);
  const amountPaid = parseMoneyInput(form.amountPaid);
  const remainingBalance = Math.max(0, totalPrice - amountPaid);
  const extrasTotal = useMemo(() => calculateExtrasTotal(extras), [extras]);
  const isPending = createVenueEvent.isPending || updateVenueEvent.isPending || replaceSelectedExtras.isPending;
  const packOptions = useMemo(() => buildPackOptions(venuePacksQuery.data), [venuePacksQuery.data]);

  useEffect(() => {
    if (!open) return;

    const nextForm = toFormState(event);
    const nextPackPrice = getFallbackPackPrice(nextForm.packName);
    setForm(nextForm);
    setExtras([]);
    setBasePrice(nextPackPrice);
    setIsTotalManual(Boolean(event) && Math.abs(parseMoneyInput(nextForm.totalPrice) - nextPackPrice) > 0.01);
    loadedExtrasEntityRef.current = null;
  }, [event, open]);

  useEffect(() => {
    if (!open || !event || !selectedExtrasQuery.data || loadedExtrasEntityRef.current === event.id) return;

    const drafts = toEventExtraDrafts(selectedExtrasQuery.data);
    const nextExtrasTotal = calculateExtrasTotal(drafts);
    const nextPackPrice = findPackPrice(packOptions, event.packName, Math.max(0, event.totalPrice - nextExtrasTotal));
    setExtras(drafts);
    setBasePrice(nextPackPrice);
    setIsTotalManual(Math.abs(event.totalPrice - (nextPackPrice + nextExtrasTotal)) > 0.01);
    loadedExtrasEntityRef.current = event.id;
  }, [event, open, packOptions, selectedExtrasQuery.data]);

  useEffect(() => {
    if (!open || isTotalManual) return;
    setForm((current) => ({ ...current, totalPrice: formatMoneyInput(basePrice + extrasTotal) }));
  }, [basePrice, extrasTotal, isTotalManual, open]);

  const activeSlot = useMemo(() => {
    if (form.startTime === "10:00" && form.endTime === "13:00") return "morning";
    if (form.startTime === "16:00" && form.endTime === "19:00") return "afternoon";
    return "custom";
  }, [form.endTime, form.startTime]);

  const patch = (value: Partial<VenueEventFormState>) => setForm((current) => ({ ...current, ...value }));

  const selectPack = (pack: PackOption) => {
    const nextPatch: Partial<VenueEventFormState> = {
      packName: pack.name,
      totalPrice: formatMoneyInput(pack.basePrice + extrasTotal),
    };

    if (pack.defaultStartTime && !form.startTime) nextPatch.startTime = pack.defaultStartTime;
    if (pack.defaultEndTime && !form.endTime) nextPatch.endTime = pack.defaultEndTime;

    setBasePrice(pack.basePrice);
    setIsTotalManual(false);
    patch(nextPatch);
  };

  const selectSlot = (slot: "morning" | "afternoon" | "custom") => {
    if (slot === "morning") patch({ startTime: "10:00", endTime: "13:00" });
    if (slot === "afternoon") patch({ startTime: "16:00", endTime: "19:00" });
  };

  const updateTotalPrice = (value: string) => {
    patch({ totalPrice: value });
    setIsTotalManual(Math.abs(parseMoneyInput(value) - (basePrice + extrasTotal)) > 0.01);
  };

  const recalculateTotal = () => {
    patch({ totalPrice: formatMoneyInput(basePrice + extrasTotal) });
    setIsTotalManual(false);
  };

  const handleSubmit = async (submitEvent: React.FormEvent) => {
    submitEvent.preventDefault();

    if (!form.customerName.trim() || !form.phone.trim() || !form.eventDate || !form.startTime || !form.packName) {
      toast({ title: "Verifique os campos obrigatórios", variant: "destructive" });
      return;
    }

    try {
      const body = toRequestBody(form);
      const savedEvent = event
        ? await updateVenueEvent.mutateAsync({ id: event.id, data: body })
        : await createVenueEvent.mutateAsync({ data: body });

      await replaceSelectedExtras.mutateAsync({
        data: {
          module: "venue_events",
          entityId: savedEvent.id,
          items: toSelectedExtraInputs(extras),
        },
      });

      const attachmentResult = await attachmentsRef.current?.savePending(savedEvent.id);

      queryClient.invalidateQueries({ queryKey: getListVenueEventsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListSelectedExtrasQueryKey({ module: "venue_events", entityId: savedEvent.id }) });
      toast({
        title: isEditing ? "Festa atualizada" : "Festa criada",
        description: attachmentResult?.failed
          ? `${form.customerName} ficou guardado, mas ${attachmentResult.failed} imagem(ns) falharam.`
          : `${form.customerName} ficou guardado em Festas no Espaço.`,
      });
      setOpen(false);
    } catch {
      toast({ title: "Não foi possível guardar a festa e os extras", variant: "destructive" });
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
                {packOptions.map((pack) => (
                  <button
                    key={pack.name}
                    type="button"
                    onClick={() => selectPack(pack)}
                    className={`rounded-xl border p-3 text-left transition-colors ${
                      form.packName === pack.name ? "border-primary bg-primary/10" : "border-border bg-background hover:bg-muted/40"
                    }`}
                  >
                    <span className="block font-semibold">{pack.name}</span>
                    <span className="text-sm text-muted-foreground">{pack.basePrice.toFixed(2)} €</span>
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

          <EventExtrasSelector module="venue_events" extras={extras} onChange={setExtras} />

          <EventAttachmentsEditor ref={attachmentsRef} entityType="venue_event" entityId={event?.id} />

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
            <div className="rounded-xl border border-border bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">Valor base</p>
              <p className="text-xl font-bold text-foreground">{basePrice.toFixed(2)} €</p>
            </div>
            <div className="rounded-xl border border-border bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">Subtotal dos extras</p>
              <p className="text-xl font-bold text-foreground">{extrasTotal.toFixed(2)} €</p>
            </div>
            <Field label="Valor total">
              <MoneyInput value={form.totalPrice} onValueChange={updateTotalPrice} />
            </Field>
            <Field label="Valor pago/sinal">
              <MoneyInput value={form.amountPaid} onValueChange={(value) => patch({ amountPaid: value })} />
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
            {isTotalManual && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 md:col-span-2">
                <p>Total final com ajuste manual.</p>
                <Button type="button" variant="outline" size="sm" className="mt-2 rounded-xl" onClick={recalculateTotal}>
                  Recalcular base + extras
                </Button>
              </div>
            )}
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

function buildPackOptions(packs?: VenuePack[]): PackOption[] {
  const activePacks = (packs ?? [])
    .filter((pack) => pack.isActive)
    .map((pack) => ({
      name: pack.name,
      basePrice: pack.basePrice,
      defaultStartTime: pack.defaultStartTime,
      defaultEndTime: pack.defaultEndTime,
      sortOrder: pack.sortOrder,
    }))
    .sort(comparePackOptions);

  return activePacks.length > 0 ? activePacks : FALLBACK_PACKS;
}

function comparePackOptions(first: PackOption, second: PackOption) {
  if (first.sortOrder !== second.sortOrder) return first.sortOrder - second.sortOrder;
  return first.name.localeCompare(second.name, "pt");
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
    totalPrice: parseMoneyInput(form.totalPrice),
    amountPaid: parseMoneyInput(form.amountPaid),
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


function getFallbackPackPrice(packName?: string) {
  return PACK_PRICES[packName ?? initialState.packName] ?? 0;
}

function findPackPrice(packOptions: PackOption[], packName: string, fallback = getFallbackPackPrice(packName)) {
  return packOptions.find((pack) => pack.name === packName)?.basePrice ?? fallback;
}
