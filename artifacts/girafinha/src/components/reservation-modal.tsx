import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { useForm, type SubmitErrorHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Cake, GraduationCap, MapPin, Plus, Trash2 } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import {
  useCreateReservation,
  useUpdateReservation,
  useGetCalendarReservations,
  getListReservationsQueryKey,
  getGetDashboardStatsQueryKey,
  getGetUpcomingReservationsQueryKey,
} from "@workspace/api-client-react";
import type {
  CreateReservationBody,
  Reservation,
  UpdateReservationBody,
} from "@workspace/api-client-react";
import {
  SERVICE_CATALOG,
  SERVICE_NAMES,
  PACK_PRICES,
  EXTRA_CATALOG,
  EXTRA_CATEGORIES,
  MAX_EVENTS_PER_DAY,
  getServiceType,
} from "@/lib/constants";

const reservationTypeSchema = z.enum(["venue_party", "external_service", "workshop"]);
const reservationStatusSchema = z.enum(["draft", "confirmed", "completed", "cancelled"]);
const imageAuthorizationSchema = z.enum(["rosto_visivel", "rosto_tapado", "nao_autorizo"]);
const optionalEmailSchema = z.union([z.string().email("Email invalido"), z.literal("")]).optional().nullable();
const nullableTextSchema = z.string().optional().nullable();
const nullableNumberSchema = z.preprocess(
  (value) => (value === "" || value === undefined || value === null ? null : Number(value)),
  z.number().min(0).nullable().optional(),
);

const formSchema = z.object({
  customerName: z.string().min(1, "O nome e obrigatorio"),
  phone: z.string().min(9, "Telefone invalido"),
  eventDate: z.string().min(1, "A data e obrigatoria"),
  eventTime: z.string().min(1, "A hora e obrigatoria"),
  pack: z.enum(SERVICE_NAMES),
  numChildren: z.coerce.number().min(0, "Indique 0 quando nao se aplica"),
  childrenAges: z.string().min(1, "Campo obrigatorio"),
  extras: z.string().optional(),
  notes: z.string().optional(),
  totalPrice: z.coerce.number().min(0),
  amountPaid: z.coerce.number().min(0),
  reservationType: reservationTypeSchema,
  customerEmail: optionalEmailSchema,
  customerNif: nullableTextSchema,
  paymentMethod: nullableTextSchema,
  reservationSource: nullableTextSchema,
  reservationStatus: reservationStatusSchema,
  birthdayChildName: nullableTextSchema,
  birthdayChildAge: nullableNumberSchema,
  partyTheme: nullableTextSchema,
  decorationNotes: nullableTextSchema,
  cateringOption: nullableTextSchema,
  allergies: nullableTextSchema,
  imageAuthorization: imageAuthorizationSchema.nullable().optional(),
  termsAccepted: z.boolean().nullable().optional(),
  eventLocation: nullableTextSchema,
  guestCount: nullableNumberSchema,
  eventType: nullableTextSchema,
  eventTheme: nullableTextSchema,
  externalServiceNotes: nullableTextSchema,
  workshopName: nullableTextSchema,
  participantCount: nullableNumberSchema,
  workshopNotes: nullableTextSchema,
}).refine((data) => data.amountPaid <= data.totalPrice, {
  message: "O valor pago nao pode ser superior ao preco total",
  path: ["amountPaid"],
});

const getExternalChildrenAges = (eventType?: string | null) =>
  emptyToNull(eventType) ?? "Serviço exterior";

type FormValues = z.infer<typeof formSchema>;
type ReservationKind = "venue" | "external" | "workshop";

type ExtraLine = {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  custom: boolean;
};

const KIND_TO_RESERVATION_TYPE: Record<ReservationKind, FormValues["reservationType"]> = {
  venue: "venue_party",
  external: "external_service",
  workshop: "workshop",
};

const KIND_CONFIG: Record<ReservationKind, { label: string; description: string; icon: typeof Cake }> = {
  venue: {
    label: "Festas no espaco",
    description: "Aniversarios, packs e aluguer do espaco.",
    icon: Cake,
  },
  external: {
    label: "Servicos no exterior",
    description: "Decoracao, catering, animacao e alugueres.",
    icon: MapPin,
  },
  workshop: {
    label: "Workshops e formacoes",
    description: "Inscricoes, participantes e sessoes formativas.",
    icon: GraduationCap,
  },
};

const TIME_OPTIONS = [
  { label: "10h as 13h", value: "10:00" },
  { label: "16h as 19h", value: "16:00" },
] as const;

const PAYMENT_METHODS = ["MB Way", "Transferencia", "Dinheiro", "Multibanco", "Outro"] as const;
const ORIGIN_OPTIONS = ["Instagram", "WhatsApp", "Site", "Parceiro", "Cliente recorrente", "Passa-palavra"] as const;
const IMAGE_AUTHORIZATION_OPTIONS = [
  { label: "Rosto visivel", value: "rosto_visivel" },
  { label: "Rosto tapado", value: "rosto_tapado" },
  { label: "Nao autorizo", value: "nao_autorizo" },
] as const;

const roundCurrency = (value: number) => Math.round(value * 100) / 100;
const createExtraId = () => `extra-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const formatCurrency = (value: number) => `${roundCurrency(value).toFixed(2)} €`;

const calculateExtrasTotal = (extras: ExtraLine[]) =>
  roundCurrency(extras.reduce((sum, extra) => sum + extra.quantity * extra.unitPrice, 0));

const emptyToNull = (value?: string | null) => {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
};

function getKindFromPack(pack: string): ReservationKind {
  const serviceType = getServiceType(pack);
  if (serviceType === "Serviços externos") return "external";
  if (serviceType === "Workshops") return "workshop";
  return "venue";
}

function getKindFromReservation(reservation?: Reservation, fallbackPack?: string): ReservationKind {
  if (reservation?.reservationType === "external_service") return "external";
  if (reservation?.reservationType === "workshop") return "workshop";
  if (reservation?.reservationType === "venue_party") return "venue";
  return getKindFromPack(reservation?.pack ?? fallbackPack ?? "Pack Simples");
}

function getDefaultPack(kind: ReservationKind): FormValues["pack"] {
  if (kind === "external") return "Decoração Externa";
  if (kind === "workshop") return "Workshop Balões Nível 1";
  return "Pack Simples";
}

function getServicesForKind(kind: ReservationKind) {
  return SERVICE_CATALOG.filter((service) => getKindFromPack(service.name) === kind);
}

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

function buildPayload(kind: ReservationKind, data: FormValues): CreateReservationBody {
  const isExternal = kind === "external";
  const isWorkshop = kind === "workshop";
  const participantCount = data.participantCount ?? data.numChildren;
  const guestCount = data.guestCount ?? data.numChildren;

  return {
    customerName: data.customerName,
    phone: data.phone,
    eventDate: data.eventDate,
    eventTime: data.eventTime,
    pack: data.pack as CreateReservationBody["pack"],
    numChildren: isWorkshop ? participantCount ?? 0 : isExternal ? guestCount ?? 0 : data.numChildren,
    childrenAges: isWorkshop ? "Participantes" : isExternal ? getExternalChildrenAges(data.eventType) : data.childrenAges,
    extras: emptyToNull(data.extras),
    notes: emptyToNull(data.notes),
    totalPrice: data.totalPrice,
    amountPaid: data.amountPaid,
    reservationType: KIND_TO_RESERVATION_TYPE[kind],
    customerEmail: emptyToNull(data.customerEmail),
    customerNif: emptyToNull(data.customerNif),
    paymentMethod: emptyToNull(data.paymentMethod),
    reservationSource: emptyToNull(data.reservationSource),
    reservationStatus: data.reservationStatus,
    birthdayChildName: kind === "venue" ? emptyToNull(data.birthdayChildName) : null,
    birthdayChildAge: kind === "venue" ? data.birthdayChildAge ?? null : null,
    partyTheme: kind === "venue" ? emptyToNull(data.partyTheme) : null,
    decorationNotes: kind === "venue" ? emptyToNull(data.decorationNotes) : null,
    cateringOption: kind === "venue" ? emptyToNull(data.cateringOption) : null,
    allergies: kind === "venue" ? emptyToNull(data.allergies) : null,
    imageAuthorization: kind === "venue" ? data.imageAuthorization ?? null : null,
    termsAccepted: kind === "venue" ? data.termsAccepted ?? null : null,
    eventLocation: isExternal ? emptyToNull(data.eventLocation) : null,
    guestCount: isExternal ? guestCount ?? null : null,
    eventType: isExternal ? emptyToNull(data.eventType) : null,
    eventTheme: isExternal ? emptyToNull(data.eventTheme) : null,
    externalServiceNotes: isExternal ? emptyToNull(data.externalServiceNotes) : null,
    workshopName: isWorkshop ? emptyToNull(data.workshopName) ?? data.pack : null,
    participantCount: isWorkshop ? participantCount ?? null : null,
    workshopNotes: isWorkshop ? emptyToNull(data.workshopNotes) : null,
  };
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

  const initialKind = getKindFromReservation(reservation, defaultPack);
  const initialPackName = reservation?.pack as FormValues["pack"] | undefined ?? defaultPack ?? getDefaultPack(initialKind);
  const initialExtras = parseExtrasText(reservation?.extras);
  const initialExtrasTotal = calculateExtrasTotal(initialExtras);
  const initialBasePrice = reservation
    ? Math.max(0, roundCurrency(reservation.totalPrice - initialExtrasTotal))
    : PACK_PRICES[initialPackName];

  const [kind, setKind] = useState<ReservationKind>(initialKind);
  const [basePrice, setBasePrice] = useState(initialBasePrice);
  const [extraLines, setExtraLines] = useState<ExtraLine[]>(initialExtras);
  const [showExtras, setShowExtras] = useState(false);
  const [showCustomTime, setShowCustomTime] = useState(
    Boolean(reservation?.eventTime && !TIME_OPTIONS.some((option) => option.value === reservation.eventTime)),
  );

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
          reservationType: reservation.reservationType ?? KIND_TO_RESERVATION_TYPE[initialKind],
          customerEmail: reservation.customerEmail ?? "",
          customerNif: reservation.customerNif ?? "",
          paymentMethod: reservation.paymentMethod ?? "",
          reservationSource: reservation.reservationSource ?? "",
          reservationStatus: reservation.reservationStatus ?? "draft",
          birthdayChildName: reservation.birthdayChildName ?? "",
          birthdayChildAge: reservation.birthdayChildAge ?? null,
          partyTheme: reservation.partyTheme ?? "",
          decorationNotes: reservation.decorationNotes ?? "",
          cateringOption: reservation.cateringOption ?? "",
          allergies: reservation.allergies ?? "",
          imageAuthorization: reservation.imageAuthorization ?? null,
          termsAccepted: reservation.termsAccepted ?? null,
          eventLocation: reservation.eventLocation ?? "",
          guestCount: reservation.guestCount ?? reservation.numChildren,
          eventType: reservation.eventType ?? (initialKind === "external" ? reservation.childrenAges : ""),
          eventTheme: reservation.eventTheme ?? "",
          externalServiceNotes: reservation.externalServiceNotes ?? "",
          workshopName: reservation.workshopName ?? (initialKind === "workshop" ? reservation.pack : ""),
          participantCount: reservation.participantCount ?? (initialKind === "workshop" ? reservation.numChildren : null),
          workshopNotes: reservation.workshopNotes ?? "",
        }
      : {
          customerName: "",
          phone: "",
          eventDate: defaultDate ?? "",
          eventTime: "",
          pack: initialPackName,
          numChildren: initialKind === "workshop" ? 1 : 10,
          childrenAges: initialKind === "workshop" ? "Participantes" : initialKind === "external" ? "Serviço exterior" : "",
          extras: "",
          notes: "",
          totalPrice: initialBasePrice,
          amountPaid: 0,
          reservationType: KIND_TO_RESERVATION_TYPE[initialKind],
          customerEmail: "",
          customerNif: "",
          paymentMethod: "",
          reservationSource: "",
          reservationStatus: "draft",
          birthdayChildName: "",
          birthdayChildAge: null,
          partyTheme: "",
          decorationNotes: "",
          cateringOption: "",
          allergies: "",
          imageAuthorization: null,
          termsAccepted: null,
          eventLocation: "",
          guestCount: initialKind === "external" ? 10 : null,
          eventType: "",
          eventTheme: "",
          externalServiceNotes: "",
          workshopName: initialKind === "workshop" ? initialPackName : "",
          participantCount: initialKind === "workshop" ? 1 : null,
          workshopNotes: "",
        },
  });

  const extrasTotal = calculateExtrasTotal(extraLines);
  const computedTotalPrice = roundCurrency(basePrice + extrasTotal);
  const totalPrice = Number(form.watch("totalPrice")) || 0;
  const amountPaid = Number(form.watch("amountPaid")) || 0;
  const remaining = Math.max(0, totalPrice - amountPaid);
  const selectedDate = form.watch("eventDate");
  const selectedPack = form.watch("pack");
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
  const totalAdjustment = reservation ? roundCurrency(totalPrice - reservation.totalPrice) : 0;
  const serviceOptions = useMemo(() => getServicesForKind(kind), [kind]);

  useEffect(() => {
    form.setValue("extras", buildExtrasText(extraLines), { shouldDirty: true, shouldValidate: true });
    form.setValue("totalPrice", computedTotalPrice, { shouldDirty: true, shouldValidate: true });
  }, [computedTotalPrice, extraLines, form]);

  const selectKind = (nextKind: ReservationKind) => {
    setKind(nextKind);
    setShowCustomTime(nextKind !== "venue");
    const nextPack = getDefaultPack(nextKind);
    const nextPrice = PACK_PRICES[nextPack] ?? 0;
    form.setValue("reservationType", KIND_TO_RESERVATION_TYPE[nextKind], { shouldDirty: true, shouldValidate: true });
    form.setValue("pack", nextPack, { shouldDirty: true, shouldValidate: true });
    form.setValue("childrenAges", nextKind === "workshop" ? "Participantes" : nextKind === "external" ? "Serviço exterior" : "", { shouldDirty: true, shouldValidate: true });
    form.setValue("numChildren", nextKind === "workshop" ? 1 : 10, { shouldDirty: true, shouldValidate: true });
    form.setValue("guestCount", nextKind === "external" ? 10 : null, { shouldDirty: true, shouldValidate: true });
    form.setValue("participantCount", nextKind === "workshop" ? 1 : null, { shouldDirty: true, shouldValidate: true });
    form.setValue("workshopName", nextKind === "workshop" ? nextPack : "", { shouldDirty: true, shouldValidate: true });
    form.setValue("eventTime", "", { shouldDirty: true, shouldValidate: true });
    setBasePrice(nextPrice);
    setExtraLines([]);
  };

  const handlePackChange = (pack: FormValues["pack"]) => {
    const nextSuggestedPrice = PACK_PRICES[pack] ?? 0;
    form.setValue("pack", pack, { shouldDirty: true, shouldValidate: true });
    if (kind === "workshop") {
      form.setValue("workshopName", pack, { shouldDirty: true, shouldValidate: true });
    }
    setBasePrice(nextSuggestedPrice);
  };

  const handleTotalChange = (value: number) => {
    const total = roundCurrency(Math.max(0, value));
    form.setValue("totalPrice", total, { shouldDirty: true, shouldValidate: true });
    setBasePrice(Math.max(0, roundCurrency(total - extrasTotal)));
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
    setShowExtras(true);
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

  const resetNewReservationForm = () => {
    const resetPack = defaultPack ?? "Pack Simples";
    const resetKind = getKindFromPack(resetPack);
    setKind(resetKind);
    setExtraLines([]);
    setShowExtras(false);
    setShowCustomTime(false);
    setBasePrice(PACK_PRICES[resetPack]);
    form.reset({
      customerName: "",
      phone: "",
      eventDate: defaultDate ?? "",
      eventTime: "",
      pack: resetPack,
      numChildren: resetKind === "workshop" ? 1 : 10,
      childrenAges: resetKind === "workshop" ? "Participantes" : resetKind === "external" ? "Serviço exterior" : "",
      extras: "",
      notes: "",
      totalPrice: PACK_PRICES[resetPack],
      amountPaid: 0,
      reservationType: KIND_TO_RESERVATION_TYPE[resetKind],
      customerEmail: "",
      customerNif: "",
      paymentMethod: "",
      reservationSource: "",
      reservationStatus: "draft",
      birthdayChildName: "",
      birthdayChildAge: null,
      partyTheme: "",
      decorationNotes: "",
      cateringOption: "",
      allergies: "",
      imageAuthorization: null,
      termsAccepted: null,
      eventLocation: "",
      guestCount: resetKind === "external" ? 10 : null,
      eventType: "",
      eventTheme: "",
      externalServiceNotes: "",
      workshopName: resetKind === "workshop" ? resetPack : "",
      participantCount: resetKind === "workshop" ? 1 : null,
      workshopNotes: "",
    });
  };

  const onSubmit = (data: FormValues) => {
    const payload = buildPayload(kind, data);

    const onError = (error: unknown) => {
      const message = error instanceof Error ? error.message : "Tente novamente dentro de momentos.";
      toast({
        title: reservation ? "Nao foi possivel atualizar a reserva" : "Nao foi possivel guardar a reserva",
        description: message,
        variant: "destructive",
      });
    };

    const onSuccess = () => {
      queryClient.invalidateQueries({ queryKey: getListReservationsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetUpcomingReservationsQueryKey() });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/calendar"] });

      toast({
        title: reservation ? "Reserva atualizada" : "Reserva criada",
        description: "A operacao foi concluida com sucesso.",
      });
      setIsOpen(false);
      if (!reservation) resetNewReservationForm();
    };

    if (reservation) {
      updateReservation.mutate({ id: reservation.id, data: payload as UpdateReservationBody }, { onSuccess, onError });
    } else {
      createReservation.mutate({ data: payload }, { onSuccess, onError });
    }
  };

  const onInvalid: SubmitErrorHandler<FormValues> = (errors) => {
    if (import.meta.env.DEV) {
      console.log("[reservation-modal] validation errors", errors);
    }

    toast({
      title: "Verifique os campos obrigatórios.",
      description: "Há informação obrigatória por preencher antes de guardar.",
      variant: "destructive",
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-primary sm:text-2xl">
            {reservation ? "Editar Reserva" : "Nova Reserva"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="mt-4 space-y-5 pb-2">
            <ReservationKindSelector kind={kind} disabled={Boolean(reservation)} onChange={selectKind} />

            <Section title="Dados principais">
              <div className="grid gap-3 sm:grid-cols-2">
                <FormTextField
                  control={form.control}
                  name="customerName"
                  label={kind === "venue" ? "Nome responsavel" : "Nome"}
                  placeholder="Maria Silva"
                />
                <FormTextField control={form.control} name="phone" label="Telemovel" placeholder="912345678" />
                <FormTextField control={form.control} name="customerEmail" label="Email" type="email" />
                <FormTextField control={form.control} name="customerNif" label="NIF opcional" />
              </div>
            </Section>

            <Section title={KIND_CONFIG[kind].label}>
              {kind === "venue" && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormTextField control={form.control} name="birthdayChildName" label="Nome aniversariante" />
                  <FormTextField control={form.control} name="birthdayChildAge" label="Idade" type="number" />
                </div>
              )}

              <ServiceCards
                label={kind === "external" ? "Tipo de servico" : kind === "workshop" ? "Workshop" : "Pack"}
                services={serviceOptions}
                selectedPack={selectedPack}
                onChange={handlePackChange}
              />
            </Section>

            <Section title="Data e horario">
              <div className="grid gap-3 sm:grid-cols-2">
                <FormTextField control={form.control} name="eventDate" label="Data" type="date" />
                {kind === "venue" ? (
                  <div className="space-y-2">
                    <p className="text-sm font-medium leading-none">Horario</p>
                    <div className="grid grid-cols-3 gap-2">
                      {TIME_OPTIONS.map((option) => (
                        <Button
                          key={option.value}
                          type="button"
                          variant={!showCustomTime && form.watch("eventTime") === option.value ? "default" : "outline"}
                          className="h-auto min-h-[44px] whitespace-normal rounded-lg text-xs"
                          onClick={() => {
                            setShowCustomTime(false);
                            form.setValue("eventTime", option.value, { shouldDirty: true, shouldValidate: true });
                          }}
                        >
                          {option.label}
                        </Button>
                      ))}
                      <Button
                        type="button"
                        variant={showCustomTime ? "default" : "outline"}
                        className="min-h-[44px] rounded-lg text-xs"
                        onClick={() => setShowCustomTime(true)}
                      >
                        Outro
                      </Button>
                    </div>
                    {showCustomTime && <FormTextField control={form.control} name="eventTime" label="Hora personalizada" type="time" />}
                    {form.formState.errors.eventTime?.message && (
                      <p className="text-sm text-destructive">{form.formState.errors.eventTime.message}</p>
                    )}
                  </div>
                ) : (
                  <FormTextField control={form.control} name="eventTime" label="Horario" type="time" />
                )}
              </div>

              {selectedDate && isVenueBooking && occupancyCount > 0 && (
                <Alert className={occupancyCount >= MAX_EVENTS_PER_DAY ? "border-rose-300 bg-rose-50" : "border-amber-300 bg-amber-50"}>
                  <AlertTitle>
                    {occupancyCount >= MAX_EVENTS_PER_DAY ? "Data sem disponibilidade" : "Data quase preenchida"}
                  </AlertTitle>
                  <AlertDescription>
                    Ja existem {occupancyCount} de {MAX_EVENTS_PER_DAY} reservas que ocupam o espaco neste dia.
                  </AlertDescription>
                </Alert>
              )}
            </Section>

            {kind === "venue" && (
              <Section title="Detalhes da festa">
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormTextField control={form.control} name="numChildren" label="No. criancas" type="number" />
                  <FormTextField control={form.control} name="childrenAges" label="Idades / observacao" placeholder="ex: 4 a 6 anos" />
                  <FormTextField control={form.control} name="partyTheme" label="Tema" />
                  <FormTextField control={form.control} name="decorationNotes" label="Pedido especial" />
                  <FormTextField control={form.control} name="cateringOption" label="Catering" />
                  <FormTextField control={form.control} name="allergies" label="Alergias" />
                </div>
              </Section>
            )}

            {kind === "external" && (
              <Section title="Detalhes do servico">
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormTextField control={form.control} name="eventLocation" label="Local / morada" />
                  <FormTextField control={form.control} name="guestCount" label="No. pessoas" type="number" />
                  <FormTextField
                    control={form.control}
                    name="eventType"
                    label="Tipo de evento"
                    placeholder="Batizado, aniversario, empresa..."
                    onValueChange={(value) => {
                      form.setValue("childrenAges", getExternalChildrenAges(value), {
                        shouldDirty: true,
                        shouldValidate: true,
                      });
                    }}
                  />
                  <FormTextField control={form.control} name="eventTheme" label="Tema / estilo" />
                  <FormTextField control={form.control} name="externalServiceNotes" label="Pedido especial" className="sm:col-span-2" multiline />
                </div>
              </Section>
            )}

            {kind === "workshop" && (
              <Section title="Detalhes do workshop">
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormTextField control={form.control} name="participantCount" label="No. participantes" type="number" />
                  <FormTextField control={form.control} name="workshopNotes" label="Observacoes do workshop" className="sm:col-span-2" multiline />
                </div>
              </Section>
            )}

            <Section title="Pagamento">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium leading-none">Valor total</label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={totalPrice}
                    onChange={(event) => handleTotalChange(Number(event.target.value) || 0)}
                  />
                </div>
                <FormTextField control={form.control} name="amountPaid" label="Sinal pago" type="number" step="0.01" />
                <OptionButtons control={form.control} name="paymentMethod" label="Forma de pagamento" options={PAYMENT_METHODS} />
              </div>

              <div className="grid grid-cols-3 gap-2 rounded-xl border border-border bg-muted/40 p-3">
                <SummaryMetric label="Total" value={formatCurrency(totalPrice)} />
                <SummaryMetric label="Sinal pago" value={formatCurrency(amountPaid)} />
                <SummaryMetric label="Em falta" value={formatCurrency(remaining)} accent={remaining > 0 ? "warning" : "success"} />
              </div>

              {reservation && (
                <p className="rounded-lg border border-border bg-background p-3 text-sm text-muted-foreground">
                  Total anterior: <strong>{formatCurrency(reservation.totalPrice)}</strong> · Novo total:{" "}
                  <strong>{formatCurrency(totalPrice)}</strong> · Ajuste: <strong>{formatCurrency(totalAdjustment)}</strong>
                </p>
              )}
            </Section>

            <Section title={kind === "venue" ? "Autorizacoes e origem" : "Origem"}>
              <div className="grid gap-3 sm:grid-cols-2">
                {kind === "venue" && (
                  <>
                    <ImageAuthorizationButtons control={form.control} />
                    <BooleanButtons control={form.control} name="termsAccepted" label="Termos aceites" />
                  </>
                )}
                <OptionButtons control={form.control} name="reservationSource" label="Origem" options={ORIGIN_OPTIONS} />
              </div>
            </Section>

            <div className="rounded-xl border border-border bg-background p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="font-semibold">Extras</h3>
                  <p className="text-sm text-muted-foreground">
                    {extrasTotal > 0 ? `${formatCurrency(extrasTotal)} em extras adicionados.` : "Sem extras adicionados."}
                  </p>
                </div>
                <Button type="button" variant="secondary" onClick={() => setShowExtras((value) => !value)}>
                  <Plus className="h-4 w-4" />
                  {showExtras ? "Ocultar extras" : "Adicionar extras"}
                </Button>
              </div>
              {showExtras && (
                <ExtraBuilder
                  extras={extraLines}
                  availableExtras={availableExtras}
                  onAddPreset={addPresetExtra}
                  onAddCustom={addCustomExtra}
                  onUpdate={updateExtraLine}
                  onRemove={removeExtraLine}
                />
              )}
            </div>

            <Section title="Observacoes">
              <FormTextField control={form.control} name="notes" label="Observacoes internas" multiline />
            </Section>

            <div className="flex flex-col-reverse gap-3 border-t border-border bg-background pt-4 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)} className="min-h-[44px] sm:w-auto">
                Cancelar
              </Button>
              <Button type="submit" disabled={createReservation.isPending || updateReservation.isPending} className="min-h-[44px] sm:w-auto">
                {createReservation.isPending || updateReservation.isPending ? "A guardar..." : "Guardar Reserva"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function ReservationKindSelector({
  kind,
  disabled,
  onChange,
}: {
  kind: ReservationKind;
  disabled: boolean;
  onChange: (kind: ReservationKind) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {(Object.keys(KIND_CONFIG) as ReservationKind[]).map((item) => {
        const config = KIND_CONFIG[item];
        const Icon = config.icon;
        const selected = kind === item;

        return (
          <button
            key={item}
            type="button"
            disabled={disabled}
            onClick={() => onChange(item)}
            className={`min-h-[96px] rounded-xl border p-3 text-left transition ${
              selected ? "border-primary bg-primary/10 text-primary" : "border-border bg-background hover:border-primary/50"
            } ${disabled ? "cursor-not-allowed opacity-80" : ""}`}
          >
            <Icon className="mb-2 h-5 w-5" />
            <span className="block font-semibold">{config.label}</span>
            <span className="mt-1 block text-xs text-muted-foreground">{config.description}</span>
          </button>
        );
      })}
    </div>
  );
}

function ServiceCards({
  label,
  services,
  selectedPack,
  onChange,
}: {
  label: string;
  services: typeof SERVICE_CATALOG[number][];
  selectedPack: FormValues["pack"];
  onChange: (pack: FormValues["pack"]) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium leading-none">{label}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {services.map((service) => {
          const selected = selectedPack === service.name;
          return (
            <button
              key={service.name}
              type="button"
              onClick={() => onChange(service.name as FormValues["pack"])}
              className={`rounded-xl border p-3 text-left transition ${
                selected ? "border-primary bg-primary/10" : "border-border bg-background hover:border-primary/50"
              }`}
            >
              <span className="block font-semibold">{service.name}</span>
              <span className="mt-1 block text-xs text-muted-foreground">{service.description}</span>
              {service.price > 0 && <span className="mt-2 block text-sm font-bold">{formatCurrency(service.price)}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-xl border border-border bg-background p-4">
      <h3 className="font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function FormTextField({
  control,
  name,
  label,
  placeholder,
  type = "text",
  step,
  multiline,
  className,
  onValueChange,
}: {
  control: ReturnType<typeof useForm<FormValues>>["control"];
  name: keyof FormValues;
  label: string;
  placeholder?: string;
  type?: string;
  step?: string;
  multiline?: boolean;
  className?: string;
  onValueChange?: (value: string) => void;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            {multiline ? (
              <Textarea
                placeholder={placeholder}
                value={(field.value as string | null | undefined) ?? ""}
                onChange={(event) => {
                  field.onChange(event);
                  onValueChange?.(event.target.value);
                }}
                onBlur={field.onBlur}
                name={field.name}
                ref={field.ref}
              />
            ) : (
              <Input
                type={type}
                step={step}
                placeholder={placeholder}
                value={(field.value as string | number | null | undefined) ?? ""}
                onChange={(event) => {
                  field.onChange(event);
                  onValueChange?.(event.target.value);
                }}
                onBlur={field.onBlur}
                name={field.name}
                ref={field.ref}
              />
            )}
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function OptionButtons({
  control,
  name,
  label,
  options,
}: {
  control: ReturnType<typeof useForm<FormValues>>["control"];
  name: keyof FormValues;
  label: string;
  options: readonly string[];
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <div className="flex flex-wrap gap-2">
            {options.map((option) => (
              <Button
                key={option}
                type="button"
                variant={field.value === option ? "default" : "outline"}
                size="sm"
                className="rounded-full"
                onClick={() => field.onChange(field.value === option ? "" : option)}
              >
                {option}
              </Button>
            ))}
          </div>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function ImageAuthorizationButtons({
  control,
}: {
  control: ReturnType<typeof useForm<FormValues>>["control"];
}) {
  return (
    <FormField
      control={control}
      name="imageAuthorization"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Autorizacao de imagens</FormLabel>
          <div className="flex flex-wrap gap-2">
            {IMAGE_AUTHORIZATION_OPTIONS.map((option) => (
              <Button
                key={option.value}
                type="button"
                variant={field.value === option.value ? "default" : "outline"}
                size="sm"
                className="rounded-full"
                onClick={() => field.onChange(field.value === option.value ? null : option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function BooleanButtons({
  control,
  name,
  label,
}: {
  control: ReturnType<typeof useForm<FormValues>>["control"];
  name: "termsAccepted";
  label: string;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={field.value === true ? "default" : "outline"}
              size="sm"
              className="rounded-full"
              onClick={() => field.onChange(field.value === true ? null : true)}
            >
              Sim
            </Button>
            <Button
              type="button"
              variant={field.value === false ? "default" : "outline"}
              size="sm"
              className="rounded-full"
              onClick={() => field.onChange(field.value === false ? null : false)}
            >
              Nao
            </Button>
          </div>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function ExtraBuilder({
  extras,
  availableExtras,
  onAddPreset,
  onAddCustom,
  onUpdate,
  onRemove,
}: {
  extras: ExtraLine[];
  availableExtras: typeof EXTRA_CATALOG;
  onAddPreset: (extra: (typeof EXTRA_CATALOG)[number]) => void;
  onAddCustom: () => void;
  onUpdate: (id: string, patch: Partial<ExtraLine>) => void;
  onRemove: (id: string) => void;
}) {
  const extrasTotal = calculateExtrasTotal(extras);

  return (
    <div className="mt-4 space-y-4">
      <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm font-semibold">
        Total extras: {formatCurrency(extrasTotal)}
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
                  <Button key={extra.name} type="button" variant="outline" size="sm" onClick={() => onAddPreset(extra)} className="rounded-full">
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
        {extras.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
            Ainda nao ha extras nesta reserva.
          </div>
        ) : (
          extras.map((extra) => (
            <div key={extra.id} className="grid grid-cols-[1fr_64px_90px_32px] gap-2">
              <Input value={extra.name} onChange={(event) => onUpdate(extra.id, { name: event.target.value, custom: true })} placeholder="Extra" />
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
                aria-label="Preco unitario"
              />
              <Button type="button" variant="ghost" size="icon" onClick={() => onRemove(extra.id)} aria-label="Remover extra" className="h-10 w-8">
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
        Extras somam ao total, mas podem ser ajustados manualmente no valor total da reserva.
      </p>
    </div>
  );
}

function SummaryMetric({
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
    <div>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={`text-sm font-bold ${valueColor}`}>{value}</p>
    </div>
  );
}
