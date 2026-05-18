import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  useCreateReservation,
  useUpdateReservation,
  useGetCalendarReservations,
  getListReservationsQueryKey,
  getGetDashboardStatsQueryKey,
  getGetUpcomingReservationsQueryKey,
  getGetCalendarReservationsQueryKey,
} from "@workspace/api-client-react";
import type { Reservation } from "@workspace/api-client-react";
import {
  SERVICE_CATALOG,
  SERVICE_NAMES,
  PACK_PRICES,
  EXTRA_CATALOG,
  EXTRA_CATEGORIES,
  NOTE_TEMPLATES,
  RESERVATION_SOURCE_OPTIONS,
  MAX_EVENTS_PER_DAY,
  getServiceCatalogItem,
  getServiceType,
  getSuggestedDeposit,
} from "@/lib/constants";

const formSchema = z.object({
  customerName: z.string().min(1, "O nome é obrigatório"),
  phone: z.string().min(9, "Telefone inválido"),
  eventDate: z.string().min(1, "A data é obrigatória"),
  eventTime: z.string().min(1, "A hora é obrigatória"),
  pack: z.enum(SERVICE_NAMES),
  numChildren: z.coerce.number().min(0, "Indique 0 quando não se aplica"),
  childrenAges: z.string().min(1, "Idades obrigatórias"),
  extras: z.string().optional(),
  notes: z.string().optional(),
  totalPrice: z.coerce.number().min(0),
  amountPaid: z.coerce.number().min(0),
}).refine((data) => data.amountPaid <= data.totalPrice, {
  message: "O valor pago não pode ser superior ao preço total",
  path: ["amountPaid"],
});

type FormValues = z.infer<typeof formSchema>;

type ExtraLine = {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  custom: boolean;
};

const roundCurrency = (value: number) => Math.round(value * 100) / 100;

const createExtraId = () => `extra-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const formatCurrency = (value: number) => `${roundCurrency(value).toFixed(2)} €`;

const calculateExtrasTotal = (extras: ExtraLine[]) =>
  roundCurrency(extras.reduce((sum, extra) => sum + extra.quantity * extra.unitPrice, 0));

function parseExtrasText(value?: string | null): ExtraLine[] {
  if (!value?.trim()) return [];

  return value
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const structuredMatch = item.match(/^(.*?)\s+x\s*([\d.,]+)\s+-\s*([\d.,]+)\s*€/);
      if (structuredMatch) {
        const quantity = Number(structuredMatch[2].replace(",", ".")) || 1;
        const total = Number(structuredMatch[3].replace(",", ".")) || 0;
        return {
          id: createExtraId(),
          name: structuredMatch[1].trim(),
          quantity,
          unitPrice: quantity > 0 ? roundCurrency(total / quantity) : total,
          custom: true,
        };
      }

      const legacyPriceMatch = item.match(/^(.*?)\s*\(\+?([\d.,]+)\s*€\)$/);
      if (legacyPriceMatch) {
        return {
          id: createExtraId(),
          name: legacyPriceMatch[1].trim(),
          quantity: 1,
          unitPrice: Number(legacyPriceMatch[2].replace(",", ".")) || 0,
          custom: true,
        };
      }

      return {
        id: createExtraId(),
        name: item,
        quantity: 1,
        unitPrice: 0,
        custom: true,
      };
    });
}

function buildExtrasText(extras: ExtraLine[]) {
  return extras
    .filter((extra) => extra.name.trim())
    .map((extra) => `${extra.name.trim()} x ${extra.quantity || 1} - ${formatCurrency((extra.quantity || 1) * (extra.unitPrice || 0))}`)
    .join("; ");
}

export function ReservationModal({
  reservation,
  trigger,
  defaultDate,
  defaultPack,
  open,
  onOpenChange,
}: {
  reservation?: Reservation;
  trigger?: React.ReactNode;
  defaultDate?: string;
  defaultPack?: FormValues["pack"];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = open !== undefined ? open : internalOpen;
  const setIsOpen = onOpenChange || setInternalOpen;
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createReservation = useCreateReservation();
  const updateReservation = useUpdateReservation();
  const initialExtras = parseExtrasText(reservation?.extras);
  const initialExtrasTotal = calculateExtrasTotal(initialExtras);
  const initialPackName = defaultPack ?? "Pack Simples";
  const initialPackPrice = reservation
    ? Math.max(0, roundCurrency(reservation.totalPrice - initialExtrasTotal))
    : PACK_PRICES[initialPackName];
  const [basePrice, setBasePrice] = useState(initialPackPrice);
  const [extraLines, setExtraLines] = useState<ExtraLine[]>(initialExtras);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: reservation
      ? {
          customerName: reservation.customerName,
          phone: reservation.phone,
          eventDate: reservation.eventDate,
          eventTime: reservation.eventTime,
          pack: reservation.pack as FormValues["pack"],
          numChildren: reservation.numChildren,
          childrenAges: reservation.childrenAges,
          extras: reservation.extras || "",
          notes: reservation.notes || "",
          totalPrice: reservation.totalPrice,
          amountPaid: reservation.amountPaid,
        }
      : {
          customerName: "",
          phone: "",
          eventDate: defaultDate ?? "",
          eventTime: "",
          pack: initialPackName,
          numChildren: 10,
          childrenAges: "",
          extras: "",
          notes: "",
          totalPrice: initialPackPrice,
          amountPaid: 0,
        },
  });

  const extrasTotal = calculateExtrasTotal(extraLines);
  const computedTotalPrice = roundCurrency(basePrice + extrasTotal);

  useEffect(() => {
    form.setValue("extras", buildExtrasText(extraLines), { shouldDirty: true, shouldValidate: true });
    form.setValue("totalPrice", computedTotalPrice, { shouldDirty: true, shouldValidate: true });
  }, [computedTotalPrice, extraLines, form]);

  const onSubmit = (data: FormValues) => {
    const onSuccess = () => {
      queryClient.invalidateQueries({ queryKey: getListReservationsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetUpcomingReservationsQueryKey() });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/calendar"] });
      
      toast({
        title: reservation ? "Reserva atualizada" : "Reserva criada",
        description: "A operação foi concluída com sucesso.",
      });
      setIsOpen(false);
      if (!reservation) {
        setExtraLines([]);
        setBasePrice(PACK_PRICES[initialPackName]);
        form.reset({
          customerName: "",
          phone: "",
          eventDate: defaultDate ?? "",
          eventTime: "",
          pack: initialPackName,
          numChildren: 10,
          childrenAges: "",
          extras: "",
          notes: "",
          totalPrice: PACK_PRICES[initialPackName],
          amountPaid: 0,
        });
      }
    };

    if (reservation) {
      updateReservation.mutate(
        { id: reservation.id, data: { ...data, extras: data.extras || null, notes: data.notes || null } as any },
        { onSuccess }
      );
    } else {
      createReservation.mutate(
        { data: { ...data, extras: data.extras || null, notes: data.notes || null } as any },
        { onSuccess }
      );
    }
  };

  const handlePackChange = (pack: FormValues["pack"]) => {
    const nextSuggestedPrice = PACK_PRICES[pack] ?? 0;

    form.setValue("pack", pack);
    setBasePrice(nextSuggestedPrice);
  };

  const applyPaymentValue = (value: number) => {
    form.setValue("amountPaid", roundCurrency(value), {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  const addPresetExtra = (extra: (typeof EXTRA_CATALOG)[number]) => {
    setExtraLines((current) => [
      ...current,
      {
        id: createExtraId(),
        name: extra.name,
        quantity: extra.defaultQuantity ?? 1,
        unitPrice: extra.price,
        custom: false,
      },
    ]);
  };

  const addCustomExtra = () => {
    setExtraLines((current) => [
      ...current,
      { id: createExtraId(), name: "", quantity: 1, unitPrice: 0, custom: true },
    ]);
  };

  const updateExtraLine = (id: string, patch: Partial<ExtraLine>) => {
    setExtraLines((current) =>
      current.map((extra) =>
        extra.id === id
          ? {
              ...extra,
              ...patch,
              quantity: patch.quantity !== undefined ? Math.max(0, patch.quantity) : extra.quantity,
              unitPrice: patch.unitPrice !== undefined ? Math.max(0, patch.unitPrice) : extra.unitPrice,
            }
          : extra,
      ),
    );
  };

  const removeExtraLine = (id: string) => {
    setExtraLines((current) => current.filter((extra) => extra.id !== id));
  };

  const appendToNotes = (text: string) => {
    const currentNotes = form.getValues("notes")?.trim();
    form.setValue("notes", currentNotes ? `${currentNotes}\n${text}` : text, {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  const addSource = (source: string) => {
    appendToNotes(`Origem: ${source}`);
  };

  const watchedTotalPrice = form.watch("totalPrice");
  const watchedAmountPaid = form.watch("amountPaid");
  const totalPrice = Number(watchedTotalPrice) || 0;
  const amountPaid = Number(watchedAmountPaid) || 0;
  const selectedDate = form.watch("eventDate");
  const selectedPack = form.watch("pack");
  const selectedService = getServiceCatalogItem(selectedPack);
  const selectedServiceType = getServiceType(selectedPack);
  const selectedMonthParams = selectedDate
    ? {
        year: Number(selectedDate.slice(0, 4)),
        month: Number(selectedDate.slice(5, 7)),
      }
    : { year: new Date().getFullYear(), month: new Date().getMonth() + 1 };
  const { data: selectedMonthReservations } = useGetCalendarReservations(selectedMonthParams);
  const selectedDayReservations = selectedDate
    ? selectedMonthReservations?.find((day) => day.date === selectedDate)?.reservations ?? []
    : [];
  const occupancyCount = selectedDayReservations.filter(
    (item) => item.id !== reservation?.id && item.serviceType !== "Serviços externos",
  ).length;
  const isVenueBooking = selectedServiceType !== "Serviços externos";
  const availableExtras = EXTRA_CATALOG.filter((extra) => extra.appliesTo.includes(selectedServiceType));
  const suggestedDeposit = getSuggestedDeposit(selectedPack, basePrice);
  const remaining = Math.max(0, totalPrice - amountPaid);
  const packRemaining = Math.max(0, basePrice - amountPaid);
  const totalAdjustment = reservation ? roundCurrency(totalPrice - reservation.totalPrice) : 0;
  const paymentPercent = totalPrice > 0 ? Math.min(100, Math.round((amountPaid / totalPrice) * 100)) : 0;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {trigger ? (
        <DialogTrigger asChild>{trigger}</DialogTrigger>
      ) : null}
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-primary">
            {reservation ? "Editar Reserva" : "Nova Reserva"}
          </DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="customerName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome do Cliente</FormLabel>
                    <FormControl>
                      <Input placeholder="Maria Silva" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telemóvel</FormLabel>
                    <FormControl>
                      <Input placeholder="912345678" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="eventDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data do Evento</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="eventTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hora</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="pack"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Serviço / Pack</FormLabel>
                    <Select value={field.value} onValueChange={handlePackChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um serviço" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {SERVICE_CATALOG.map((service) => (
                          <SelectItem key={service.name} value={service.name}>
                            {service.category} - {service.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedService && (
                      <p className="text-xs text-muted-foreground">{selectedService.description}</p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="numChildren"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nº Crianças / Participantes</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="childrenAges"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Idades / Observação</FormLabel>
                      <FormControl>
                        <Input placeholder="ex: 4 a 6 anos" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {selectedDate && isVenueBooking && occupancyCount > 0 && (
              <Alert className={occupancyCount >= MAX_EVENTS_PER_DAY ? "border-rose-300 bg-rose-50" : "border-amber-300 bg-amber-50"}>
                <AlertTitle>
                  {occupancyCount >= MAX_EVENTS_PER_DAY ? "Data sem disponibilidade" : "Data quase preenchida"}
                </AlertTitle>
                <AlertDescription>
                  Já existem {occupancyCount} de {MAX_EVENTS_PER_DAY} reservas que ocupam o espaço neste dia.
                  {occupancyCount >= MAX_EVENTS_PER_DAY
                    ? " Confirme antes de guardar para evitar sobreposição."
                    : " Ainda existe capacidade, mas vale confirmar horários e equipa."}
                </AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-1 gap-4 rounded-xl border border-border bg-muted/50 p-4">
              <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                <FinanceMetric label="Pack/base" value={formatCurrency(basePrice)} />
                <FinanceMetric label="Extras" value={formatCurrency(extrasTotal)} />
                <FinanceMetric label="Total" value={formatCurrency(totalPrice)} />
                <FinanceMetric label="Pago" value={formatCurrency(amountPaid)} />
                <FinanceMetric label="Em falta" value={formatCurrency(remaining)} accent={remaining > 0 ? "warning" : "success"} />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_1fr_1.2fr]">
                <div className="space-y-2">
                  <label className="text-sm font-medium leading-none" htmlFor="base-price">
                    Preço do pack/base (€)
                  </label>
                  <Input
                    id="base-price"
                    type="number"
                    step="0.01"
                    value={basePrice}
                    onChange={(event) => setBasePrice(roundCurrency(Number(event.target.value) || 0))}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="amountPaid"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor já pago (€)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="rounded-lg border border-border bg-background p-3">
                  <p className="text-xs font-medium text-muted-foreground">Resumo a liquidar</p>
                  <p className="mt-1 text-sm">
                    Pack pendente: <strong>{formatCurrency(packRemaining)}</strong>
                  </p>
                  <p className="text-sm">
                    Extras para o dia: <strong>{formatCurrency(extrasTotal)}</strong>
                  </p>
                </div>
              </div>

              {reservation && (
                <div className="rounded-lg border border-border bg-background p-3 text-sm">
                  <div className="grid gap-2 sm:grid-cols-3">
                    <span>Total anterior: <strong>{formatCurrency(reservation.totalPrice)}</strong></span>
                    <span>Novo total: <strong>{formatCurrency(totalPrice)}</strong></span>
                    <span className={totalAdjustment > 0 ? "text-amber-700" : totalAdjustment < 0 ? "text-emerald-700" : ""}>
                      Ajuste: <strong>{formatCurrency(totalAdjustment)}</strong>
                    </span>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => applyPaymentValue(0)} className="rounded-full">
                  Sem sinal
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => applyPaymentValue(suggestedDeposit)} className="rounded-full">
                  Sinal do pack
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => applyPaymentValue(basePrice)} className="rounded-full">
                  Pack pago
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => applyPaymentValue(totalPrice)} className="rounded-full">
                  Tudo pago
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Sinal sugerido calculado apenas sobre o pack/base: {formatCurrency(suggestedDeposit)}. Extras acrescentados depois ficam para liquidar no dia da festa.
              </p>
            </div>

            <ExtraBuilder
              extras={extraLines}
              availableExtras={availableExtras}
              selectedServiceType={selectedServiceType}
              onAddPreset={addPresetExtra}
              onAddCustom={addCustomExtra}
              onUpdate={updateExtraLine}
              onRemove={removeExtraLine}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notas Internas (Opcional)</FormLabel>
                  <div className="space-y-2 pb-2">
                    <div className="flex flex-wrap gap-2">
                      {NOTE_TEMPLATES.map((note) => (
                        <Button key={note} type="button" variant="outline" size="sm" onClick={() => appendToNotes(note)} className="rounded-full">
                          {note}
                        </Button>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {RESERVATION_SOURCE_OPTIONS.map((source) => (
                        <Button key={source} type="button" variant="secondary" size="sm" onClick={() => addSource(source)} className="rounded-full">
                          Origem: {source}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <FormControl>
                    <Textarea placeholder="Informações sobre alergias, pedidos especiais..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-4 sticky bottom-0 bg-background pb-1">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsOpen(false)}
                className="min-h-[44px] sm:w-auto"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createReservation.isPending || updateReservation.isPending}
                className="min-h-[44px] sm:w-auto"
              >
                {createReservation.isPending || updateReservation.isPending ? "A guardar..." : "Guardar Reserva"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function ExtraBuilder({
  extras,
  availableExtras,
  selectedServiceType,
  onAddPreset,
  onAddCustom,
  onUpdate,
  onRemove,
}: {
  extras: ExtraLine[];
  availableExtras: typeof EXTRA_CATALOG;
  selectedServiceType: string;
  onAddPreset: (extra: (typeof EXTRA_CATALOG)[number]) => void;
  onAddCustom: () => void;
  onUpdate: (id: string, patch: Partial<ExtraLine>) => void;
  onRemove: (id: string) => void;
}) {
  const extrasTotal = calculateExtrasTotal(extras);

  return (
    <div className="space-y-4 rounded-xl border border-border bg-background p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-base font-semibold">Extras</h3>
          <p className="text-sm text-muted-foreground">
            Selecione extras para {selectedServiceType.toLowerCase()} ou adicione linhas personalizadas.
          </p>
        </div>
        <div className="rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm font-semibold">
          Total extras: {formatCurrency(extrasTotal)}
        </div>
      </div>

      <div className="space-y-3">
        {EXTRA_CATEGORIES.map((category) => {
          const categoryExtras = availableExtras.filter((extra) => extra.category === category);
          if (categoryExtras.length === 0) return null;

          return (
            <div key={category} className="space-y-2">
              <p className="text-xs font-semibold uppercase text-muted-foreground">{category}</p>
              <div className="flex flex-wrap gap-2">
                {categoryExtras.map((extra) => (
                  <Button
                    key={extra.name}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onAddPreset(extra)}
                    className="rounded-full"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {extra.name}
                    {extra.price > 0 ? ` · ${formatCurrency(extra.price)}` : ""}
                  </Button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="space-y-2">
        <div className="grid grid-cols-[1fr_72px_96px_32px] gap-2 text-xs font-medium text-muted-foreground">
          <span>Extra</span>
          <span>Qtd.</span>
          <span>Preço</span>
          <span />
        </div>

        {extras.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
            Ainda não há extras nesta reserva.
          </div>
        ) : (
          extras.map((extra) => (
            <div key={extra.id} className="grid grid-cols-[1fr_72px_96px_32px] gap-2">
              <Input
                value={extra.name}
                onChange={(event) => onUpdate(extra.id, { name: event.target.value, custom: true })}
                placeholder="Nome do extra"
              />
              <Input
                type="number"
                min="0"
                step="1"
                value={extra.quantity}
                onChange={(event) => onUpdate(extra.id, { quantity: Number(event.target.value) || 0 })}
                aria-label="Quantidade"
              />
              <Input
                type="number"
                min="0"
                step="0.01"
                value={extra.unitPrice}
                onChange={(event) => onUpdate(extra.id, { unitPrice: Number(event.target.value) || 0 })}
                aria-label="Preço unitário"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onRemove(extra.id)}
                aria-label="Remover extra"
                className="h-10 w-8 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))
        )}

        <Button type="button" variant="secondary" size="sm" onClick={onAddCustom} className="rounded-full">
          <Plus className="h-4 w-4" />
          Extra personalizado
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Os preços ficam editáveis para ajustes pontuais. O valor dos extras soma automaticamente ao total, mas não altera o sinal sugerido do pack.
      </p>
    </div>
  );
}

function FinanceMetric({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "warning" | "success";
}) {
  const valueColor = accent === "warning" ? "text-amber-700" : accent === "success" ? "text-emerald-700" : "";
  return (
    <div className="rounded-lg border border-border bg-background p-2.5">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={`text-sm font-bold ${valueColor}`}>{value}</p>
    </div>
  );
}

