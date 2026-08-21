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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatMoneyInput, parseMoneyInput } from "@/lib/money";
import {
  calculateExtrasTotal,
  EventExtrasSelector,
  toEventExtraDrafts,
  toSelectedExtraInputs,
  type EventExtraDraft,
} from "@/components/event-extras-selector";
import {
  ExternalEventServicesSelector,
  FALLBACK_SERVICE_OPTIONS,
  type ExternalServiceDraft,
  type ExternalServiceOption,
} from "@/components/external-event-services-selector";
import {
  changeRefundableDepositStatus,
  markRefundableDepositReceivedNow,
  REFUNDABLE_DEPOSIT_LABELS,
} from "@/lib/refundable-deposit";
import { useToast } from "@/hooks/use-toast";
import {
  getListSelectedExtrasQueryKey,
  getListExternalEventsQueryKey,
  useCreateExternalEvent,
  useListExternalServices,
  useListSelectedExtras,
  useReplaceSelectedExtras,
  useUpdateExternalEvent,
} from "@workspace/api-client-react";
import type { CreateExternalEventBody, ExternalEvent, ExternalEventServiceType, ExternalServiceCatalog, RefundableDepositStatus } from "@workspace/api-client-react";

type ExternalEventFormState = {
  customerName: string;
  phone: string;
  email: string;
  nif: string;
  source: string;
  eventDate: string;
  startTime: string;
  endTime: string;
  status: "draft" | "confirmed" | "completed" | "cancelled";
  eventLocation: string;
  guestCount: string;
  eventType: string;
  eventTheme: string;
  setupNotes: string;
  teardownNotes: string;
  accessNotes: string;
  totalPrice: string;
  amountPaid: string;
  refundableDepositAmount: string;
  refundableDepositStatus: RefundableDepositStatus;
  refundableDepositReceivedAt: string | null;
  refundableDepositReturnedAt: string | null;
  refundableDepositNotes: string;
  paymentMethod: string;
  notes: string;
};

const initialState: ExternalEventFormState = {
  customerName: "",
  phone: "",
  email: "",
  nif: "",
  source: "",
  eventDate: "",
  startTime: "",
  endTime: "",
  status: "draft",
  eventLocation: "",
  guestCount: "0",
  eventType: "",
  eventTheme: "",
  setupNotes: "",
  teardownNotes: "",
  accessNotes: "",
  totalPrice: "0",
  amountPaid: "0",
  refundableDepositAmount: "0",
  refundableDepositStatus: "not_required",
  refundableDepositReceivedAt: null,
  refundableDepositReturnedAt: null,
  refundableDepositNotes: "",
  paymentMethod: "",
  notes: "",
};

export function ExternalEventModal({
  event,
  trigger,
}: {
  event?: ExternalEvent;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ExternalEventFormState>(() => toFormState(event));
  const [services, setServices] = useState<ExternalServiceDraft[]>(() => toServiceDrafts(event));
  const [extras, setExtras] = useState<EventExtraDraft[]>([]);
  const [isTotalManual, setIsTotalManual] = useState(false);
  const loadedExtrasEntityRef = useRef<string | null>(null);
  const attachmentsRef = useRef<EventAttachmentsHandle>(null);
  const createExternalEvent = useCreateExternalEvent();
  const updateExternalEvent = useUpdateExternalEvent();
  const replaceSelectedExtras = useReplaceSelectedExtras();
  const externalServicesQuery = useListExternalServices();
  const selectedExtrasQuery = useListSelectedExtras(
    { module: "external_events", entityId: event?.id ?? "" },
    {
      query: {
        enabled: open && Boolean(event?.id),
        queryKey: getListSelectedExtrasQueryKey({ module: "external_events", entityId: event?.id ?? "" }),
      },
    },
  );
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isEditing = Boolean(event);

  useEffect(() => {
    if (!open) return;
    const nextForm = toFormState(event);
    const nextServices = toServiceDrafts(event);
    const initialSubtotal = calculateServicesTotal(nextServices);
    const initialTotal = parseMoneyInput(nextForm.totalPrice);

    setForm(nextForm);
    setServices(nextServices);
    setExtras([]);
    setIsTotalManual(Boolean(event) && Math.abs(initialTotal - initialSubtotal) > 0.01);
    loadedExtrasEntityRef.current = null;
  }, [event, open]);

  const servicesTotal = useMemo(() => calculateServicesTotal(services), [services]);
  const extrasTotal = useMemo(() => calculateExtrasTotal(extras), [extras]);
  const automaticTotal = servicesTotal + extrasTotal;
  const totalPrice = parseMoneyInput(form.totalPrice);
  const amountPaid = parseMoneyInput(form.amountPaid);
  const remainingBalance = Math.max(0, totalPrice - amountPaid);
  const isPending = createExternalEvent.isPending || updateExternalEvent.isPending || replaceSelectedExtras.isPending;
  const serviceOptions = useMemo(() => buildServiceOptions(externalServicesQuery.data), [externalServicesQuery.data]);

  useEffect(() => {
    if (!open || !event || !selectedExtrasQuery.data || loadedExtrasEntityRef.current === event.id) return;

    const drafts = toEventExtraDrafts(selectedExtrasQuery.data);
    setExtras(drafts);
    setIsTotalManual(Math.abs(event.totalPrice - (calculateServicesTotal(toServiceDrafts(event)) + calculateExtrasTotal(drafts))) > 0.01);
    loadedExtrasEntityRef.current = event.id;
  }, [event, open, selectedExtrasQuery.data]);

  useEffect(() => {
    if (!open || isTotalManual) return;
    setForm((current) => ({ ...current, totalPrice: formatMoneyInput(automaticTotal) }));
  }, [automaticTotal, isTotalManual, open]);

  const patch = (value: Partial<ExternalEventFormState>) => setForm((current) => ({ ...current, ...value }));

  const updateTotalPrice = (value: string) => {
    const nextTotal = parseMoneyInput(value);
    patch({ totalPrice: value });
    setIsTotalManual(Math.abs(nextTotal - automaticTotal) > 0.01);
  };

  const recalculateTotal = () => {
    patch({ totalPrice: formatMoneyInput(automaticTotal) });
    setIsTotalManual(false);
  };

  const updateRefundableDepositStatus = (status: RefundableDepositStatus) => {
    setForm((current) => {
      const changed = changeRefundableDepositStatus({
        status: current.refundableDepositStatus,
        receivedAt: current.refundableDepositReceivedAt,
        returnedAt: current.refundableDepositReturnedAt,
      }, status);
      return {
        ...current,
        refundableDepositStatus: changed.status,
        refundableDepositReceivedAt: changed.receivedAt,
        refundableDepositReturnedAt: changed.returnedAt,
      };
    });
  };

  const registerRefundableDepositReceivedNow = () => {
    setForm((current) => {
      const changed = markRefundableDepositReceivedNow({
        status: current.refundableDepositStatus,
        receivedAt: current.refundableDepositReceivedAt,
        returnedAt: current.refundableDepositReturnedAt,
      });
      return {
        ...current,
        refundableDepositStatus: changed.status,
        refundableDepositReceivedAt: changed.receivedAt,
        refundableDepositReturnedAt: changed.returnedAt,
      };
    });
  };

  const handleSubmit = async (submitEvent: React.FormEvent) => {
    submitEvent.preventDefault();

    if (!form.customerName.trim() || !form.phone.trim() || !form.eventDate || !form.startTime || services.length === 0) {
      toast({ title: "Verifique os campos obrigatórios", description: "Nome, telemóvel, data, hora e pelo menos um serviço são obrigatórios.", variant: "destructive" });
      return;
    }

    try {
      const body = toRequestBody(form, services);
      const savedEvent = event
        ? await updateExternalEvent.mutateAsync({ id: event.id, data: body })
        : await createExternalEvent.mutateAsync({ data: body });

      await replaceSelectedExtras.mutateAsync({
        data: {
          module: "external_events",
          entityId: savedEvent.id,
          items: toSelectedExtraInputs(extras),
        },
      });

      const attachmentResult = await attachmentsRef.current?.savePending(savedEvent.id);

      queryClient.invalidateQueries({ queryKey: getListExternalEventsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListSelectedExtrasQueryKey({ module: "external_events", entityId: savedEvent.id }) });
      toast({
        title: isEditing ? "Serviço externo atualizado" : "Serviço externo criado",
        description: attachmentResult?.failed
          ? `${form.customerName} ficou guardado, mas ${attachmentResult.failed} imagem(ns) falharam.`
          : `${form.customerName} ficou guardado em Serviços Externos.`,
      });
      setOpen(false);
    } catch {
      toast({ title: "Não foi possível guardar o serviço externo e os extras", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button className="min-h-[42px] rounded-full bg-primary px-5 text-primary-foreground shadow-md hover:bg-primary/90">
            <Plus className="h-4 w-4" />
            Novo Serviço
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Serviço Externo" : "Novo Serviço Externo"}</DialogTitle>
          <DialogDescription>Registe eventos fora do espaço com vários serviços no mesmo pedido.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <FormSection title="Dados do cliente">
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

          <FormSection title="Dados do evento">
            <Field label="Data" required>
              <Input type="date" value={form.eventDate} onChange={(event) => patch({ eventDate: event.target.value })} />
            </Field>
            <Field label="Hora início" required>
              <Input type="time" value={form.startTime} onChange={(event) => patch({ startTime: event.target.value })} />
            </Field>
            <Field label="Hora fim">
              <Input type="time" value={form.endTime} onChange={(event) => patch({ endTime: event.target.value })} />
            </Field>
            <Field label="Local/morada">
              <Input value={form.eventLocation} onChange={(event) => patch({ eventLocation: event.target.value })} />
            </Field>
            <Field label="Nº pessoas/convidados">
              <Input type="number" min="0" value={form.guestCount} onChange={(event) => patch({ guestCount: event.target.value })} />
            </Field>
            <Field label="Tipo de evento">
              <Input value={form.eventType} onChange={(event) => patch({ eventType: event.target.value })} placeholder="Batizado, aniversário, empresa..." />
            </Field>
            <Field label="Tema/estilo">
              <Input value={form.eventTheme} onChange={(event) => patch({ eventTheme: event.target.value })} />
            </Field>
          </FormSection>

          <section className="space-y-3 rounded-xl border border-border p-3 md:p-4">
            <ExternalEventServicesSelector services={services} options={serviceOptions} onChange={setServices} />
            <div className="flex flex-col gap-2 rounded-xl border border-border bg-muted/30 p-3 text-sm md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-semibold text-foreground">Subtotal dos serviços: {servicesTotal.toFixed(2)} €</p>
                <p className="text-xs text-muted-foreground">
                  {isTotalManual
                    ? "O total final tem um ajuste manual ativo."
                    : "O total final acompanha automaticamente a soma dos serviços e extras."}
                </p>
              </div>
              {isTotalManual && (
                <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={recalculateTotal}>
                  Recalcular serviços + extras
                </Button>
              )}
            </div>
          </section>

          <EventExtrasSelector module="external_events" extras={extras} onChange={setExtras} />

          <EventAttachmentsEditor ref={attachmentsRef} entityType="external_event" entityId={event?.id} />

          <FormSection title="Notas operacionais">
            <Field label="Montagem">
              <Textarea value={form.setupNotes} onChange={(event) => patch({ setupNotes: event.target.value })} />
            </Field>
            <Field label="Desmontagem">
              <Textarea value={form.teardownNotes} onChange={(event) => patch({ teardownNotes: event.target.value })} />
            </Field>
            <Field label="Acessos ao local">
              <Textarea value={form.accessNotes} onChange={(event) => patch({ accessNotes: event.target.value })} />
            </Field>
          </FormSection>

          <FormSection title="Pagamento">
            <div className="rounded-xl border border-border bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">Subtotal dos serviços</p>
              <p className="text-xl font-bold text-foreground">{servicesTotal.toFixed(2)} €</p>
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
                Total final com ajuste manual. Use "Recalcular serviços + extras" para voltar ao total automático.
              </div>
            )}
          </FormSection>

          <FormSection title="Caução reembolsável">
            <Field label="Estado">
              <Select value={form.refundableDepositStatus} onValueChange={(value) => updateRefundableDepositStatus(value as RefundableDepositStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(REFUNDABLE_DEPOSIT_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            {form.refundableDepositStatus !== "not_required" ? (
              <>
                <Field label="Valor da caução">
                  <MoneyInput
                    value={form.refundableDepositAmount}
                    onValueChange={(value) => patch({ refundableDepositAmount: value })}
                  />
                </Field>
                {form.refundableDepositStatus === "held" ? (
                  <div className="rounded-xl border border-border bg-muted/30 p-3 text-sm md:col-span-2">
                    {form.refundableDepositReceivedAt ? (
                      <p>Receção registada em {formatDepositDateTime(form.refundableDepositReceivedAt)}.</p>
                    ) : (
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-muted-foreground">Data de receção ainda não registada. Pode ficar vazia em registos históricos.</p>
                        <Button type="button" variant="outline" size="sm" className="shrink-0 rounded-xl" onClick={registerRefundableDepositReceivedNow}>
                          Registar receção agora
                        </Button>
                      </div>
                    )}
                  </div>
                ) : null}
                {form.refundableDepositStatus === "returned" && form.refundableDepositReturnedAt ? (
                  <p className="text-sm text-muted-foreground md:col-span-2">Devolução registada em {formatDepositDateTime(form.refundableDepositReturnedAt)}.</p>
                ) : null}
                <div className="space-y-2 md:col-span-2">
                  <Label>Notas da caução</Label>
                  <Textarea value={form.refundableDepositNotes} onChange={(event) => patch({ refundableDepositNotes: event.target.value })} placeholder="Objeto alugado, condições ou referência da devolução..." />
                </div>
              </>
            ) : null}
            <p className="text-xs text-muted-foreground md:col-span-2">A caução fica separada do preço, do sinal e dos pagamentos do serviço.</p>
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
              {isEditing ? "Guardar alterações" : "Guardar Serviço"}
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

const serviceTypeValues = new Set<ExternalEventServiceType>([
  "decoracao",
  "catering",
  "organizacao_evento",
  "animacao",
  "insuflavel",
  "baloes",
  "outro",
]);

function buildServiceOptions(services?: ExternalServiceCatalog[]): ExternalServiceOption[] {
  const activeServices = (services ?? [])
    .filter((service) => service.isActive)
    .map((service) => ({
      type: toServiceType(service.code),
      label: service.name,
      price: service.basePrice,
      sortOrder: service.sortOrder,
    }))
    .sort(compareServiceOptions);

  return activeServices.length > 0 ? activeServices : FALLBACK_SERVICE_OPTIONS;
}

function toServiceType(code: string): ExternalEventServiceType {
  return serviceTypeValues.has(code as ExternalEventServiceType) ? (code as ExternalEventServiceType) : "outro";
}

function compareServiceOptions(first: ExternalServiceOption, second: ExternalServiceOption) {
  if (first.sortOrder !== second.sortOrder) return first.sortOrder - second.sortOrder;
  return first.label.localeCompare(second.label, "pt");
}

function toFormState(event?: ExternalEvent): ExternalEventFormState {
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
    eventLocation: event.eventLocation ?? "",
    guestCount: String(event.guestCount),
    eventType: event.eventType ?? "",
    eventTheme: event.eventTheme ?? "",
    setupNotes: event.setupNotes ?? "",
    teardownNotes: event.teardownNotes ?? "",
    accessNotes: event.accessNotes ?? "",
    totalPrice: String(event.totalPrice),
    amountPaid: String(event.amountPaid),
    refundableDepositAmount: String(event.refundableDepositAmount ?? 0),
    refundableDepositStatus: event.refundableDepositStatus ?? "not_required",
    refundableDepositReceivedAt: event.refundableDepositReceivedAt ?? null,
    refundableDepositReturnedAt: event.refundableDepositReturnedAt ?? null,
    refundableDepositNotes: event.refundableDepositNotes ?? "",
    paymentMethod: event.paymentMethod ?? "",
    notes: event.notes ?? "",
  };
}

function toServiceDrafts(event?: ExternalEvent): ExternalServiceDraft[] {
  return (event?.services ?? []).map((service) => ({
    localId: service.id,
    serviceType: service.serviceType,
    serviceLabel: service.serviceLabel,
    price: service.price,
    status: service.status,
    notes: service.notes,
    sortOrder: service.sortOrder,
  }));
}

function toRequestBody(form: ExternalEventFormState, services: ExternalServiceDraft[]): CreateExternalEventBody {
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
    eventLocation: emptyToNull(form.eventLocation),
    guestCount: toNumber(form.guestCount),
    eventType: emptyToNull(form.eventType),
    eventTheme: emptyToNull(form.eventTheme),
    setupNotes: emptyToNull(form.setupNotes),
    teardownNotes: emptyToNull(form.teardownNotes),
    accessNotes: emptyToNull(form.accessNotes),
    totalPrice: parseMoneyInput(form.totalPrice),
    amountPaid: parseMoneyInput(form.amountPaid),
    refundableDepositAmount: form.refundableDepositStatus === "not_required" ? 0 : parseMoneyInput(form.refundableDepositAmount),
    refundableDepositStatus: form.refundableDepositStatus,
    refundableDepositReceivedAt: form.refundableDepositStatus === "not_required" ? null : form.refundableDepositReceivedAt,
    refundableDepositReturnedAt: form.refundableDepositStatus === "not_required" ? null : form.refundableDepositReturnedAt,
    refundableDepositNotes: form.refundableDepositStatus === "not_required" ? null : emptyToNull(form.refundableDepositNotes),
    paymentMethod: emptyToNull(form.paymentMethod),
    notes: emptyToNull(form.notes),
    services: services.map(({ localId: _localId, ...service }, index) => ({
      ...service,
      price: Number(service.price ?? 0),
      status: service.status ?? "planned",
      notes: service.notes || null,
      sortOrder: index + 1,
    })),
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

function calculateServicesTotal(services: ExternalServiceDraft[]) {
  return services.reduce((sum, service) => sum + Number(service.price ?? 0), 0);
}


function formatDepositDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-PT", {
    timeZone: "Europe/Lisbon",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}
