import type { IncomingMessage, ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import type { Plugin } from "vite";

type Reservation = {
  id: number;
  customerName: string;
  phone: string;
  eventDate: string;
  eventTime: string;
  pack:
    | "Aluguer do Espaço"
    | "Pack Simples"
    | "Pack com Decoração"
    | "Pack Completo"
    | "Decoração Externa"
    | "Catering / Brunch"
    | "Animação"
    | "Aluguer de Insuflável"
    | "Workshop Balões Nível 1"
    | "Workshop Balões + Kit Inicial"
    | "Só Espaço"
    | "Espaço + Lanche"
    | "Espaço + Decoração";
  numChildren: number;
  childrenAges: string;
  extras: string | null;
  notes: string | null;
  totalPrice: number;
  amountPaid: number;
  createdAt: string;
  updatedAt: string;
};

type Task = {
  id: number;
  reservationId: number;
  title: string;
  completed: boolean;
  sortOrder: number;
  createdAt: string;
};

type VenueEvent = {
  id: string;
  customerName: string;
  phone: string;
  email: string | null;
  nif: string | null;
  eventDate: string;
  startTime: string;
  endTime: string | null;
  status: "draft" | "confirmed" | "completed" | "cancelled";
  paymentStatus: "unpaid" | "partial" | "paid";
  source: string | null;
  packName: string;
  birthdayChildName: string | null;
  birthdayChildAge: number | null;
  childrenCount: number;
  childrenAges: string | null;
  partyTheme: string | null;
  decorationNotes: string | null;
  cateringNotes: string | null;
  allergies: string | null;
  imageAuthorization: "rosto_visivel" | "rosto_tapado" | "nao_autorizo" | null;
  termsAccepted: boolean;
  totalPrice: number;
  amountPaid: number;
  paymentMethod: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

type ExternalEventService = {
  id: string;
  externalEventId: string;
  serviceType: "decoracao" | "catering" | "organizacao_evento" | "animacao" | "insuflavel" | "baloes" | "outro";
  serviceLabel: string;
  price: number;
  status: "planned" | "in_progress" | "completed" | "cancelled";
  notes: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

type ExternalEvent = {
  id: string;
  customerName: string;
  phone: string;
  email: string | null;
  nif: string | null;
  eventDate: string;
  startTime: string;
  endTime: string | null;
  status: "draft" | "confirmed" | "completed" | "cancelled";
  paymentStatus: "unpaid" | "partial" | "paid";
  source: string | null;
  eventLocation: string | null;
  guestCount: number;
  eventType: string | null;
  eventTheme: string | null;
  setupNotes: string | null;
  teardownNotes: string | null;
  accessNotes: string | null;
  totalPrice: number;
  amountPaid: number;
  paymentMethod: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

type WorkshopParticipant = {
  id: string;
  workshopId: string;
  name: string;
  phone: string;
  email: string | null;
  nif: string | null;
  amountPaid: number;
  amountDue: number;
  paymentMethod: string | null;
  paymentStatus: "unpaid" | "partial" | "paid";
  status: "registered" | "confirmed" | "attended" | "cancelled";
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

type Workshop = {
  id: string;
  name: string;
  description: string | null;
  date: string;
  startTime: string;
  endTime: string | null;
  capacity: number;
  price: number;
  kitIncluded: boolean;
  status: "draft" | "open" | "full" | "completed" | "cancelled";
  location: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

type VenuePack = {
  id: string;
  name: string;
  description: string | null;
  basePrice: number;
  defaultStartTime: string | null;
  defaultEndTime: string | null;
  isActive: boolean;
  sortOrder: number;
  internalNotes: string | null;
  createdAt: string;
  updatedAt: string;
};

type ExternalServiceCatalog = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  basePrice: number;
  isActive: boolean;
  sortOrder: number;
  operationalNotes: string | null;
  createdAt: string;
  updatedAt: string;
};

type EventExtra = {
  id: string;
  name: string;
  category: string | null;
  basePrice: number;
  appliesTo: "all" | "venue_events" | "external_events" | "workshops";
  isActive: boolean;
  sortOrder: number;
  internalNotes: string | null;
  createdAt: string;
  updatedAt: string;
};

function getDevCredentials() {
  const email = process.env.DEV_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.DEV_ADMIN_PASSWORD;

  if (!email || !password) return null;
  return { email, password };
}

const SESSION_COOKIE = "girafinha_dev_session";
const MAX_EVENTS_PER_DAY = 2;

function getServiceType(pack: string) {
  if (pack.startsWith("Workshop")) return "Workshops";
  if (["Decoração Externa", "Catering / Brunch", "Animação", "Aluguer de Insuflável"].includes(pack)) {
    return "Serviços externos";
  }
  return "Festas no espaço";
}

const today = new Date();
const isoDate = (offsetDays: number) => {
  const date = new Date(today);
  date.setDate(today.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
};

let nextReservationId = 6;
let nextTaskId = 13;

const now = new Date().toISOString();

let reservations: Reservation[] = [
  {
    id: 1,
    customerName: "Marta Silva",
    phone: "912345678",
    eventDate: isoDate(2),
    eventTime: "16:00",
    pack: "Pack Completo",
    numChildren: 18,
    childrenAges: "4 a 6 anos",
    extras: "Bolo de aniversário",
    notes: "Tema Barbie. Confirmar alergias.",
    totalPrice: 450,
    amountPaid: 90,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 2,
    customerName: "Joana Costa",
    phone: "934567890",
    eventDate: isoDate(8),
    eventTime: "10:00",
    pack: "Pack com Decoração",
    numChildren: 14,
    childrenAges: "5 anos",
    extras: null,
    notes: "Tema futebol.",
    totalPrice: 300,
    amountPaid: 300,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 3,
    customerName: "Ana Pereira",
    phone: "965432100",
    eventDate: isoDate(15),
    eventTime: "16:00",
    pack: "Pack Simples",
    numChildren: 12,
    childrenAges: "3 a 5 anos",
    extras: "Pinturas faciais",
    notes: null,
    totalPrice: 250,
    amountPaid: 0,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 4,
    customerName: "Rita Martins",
    phone: "931234567",
    eventDate: isoDate(20),
    eventTime: "14:00",
    pack: "Workshop Balões Nível 1",
    numChildren: 8,
    childrenAges: "adultos",
    extras: "Coffee break incluído",
    notes: "Confirmar mínimo de participantes.",
    totalPrice: 70,
    amountPaid: 35,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 5,
    customerName: "Quinta Parceira",
    phone: "939810984",
    eventDate: isoDate(25),
    eventTime: "11:00",
    pack: "Decoração Externa",
    numChildren: 0,
    childrenAges: "evento externo",
    extras: "Arco de balões e mesa temática",
    notes: "Origem: parceiro. Prever comissão.",
    totalPrice: 280,
    amountPaid: 56,
    createdAt: now,
    updatedAt: now,
  },
];

let tasks: Task[] = [
  { id: 1, reservationId: 1, title: "Confirmar tema", completed: true, sortOrder: 1, createdAt: now },
  { id: 2, reservationId: 1, title: "Preparar decoração", completed: false, sortOrder: 2, createdAt: now },
  { id: 3, reservationId: 1, title: "Comprar lanche", completed: false, sortOrder: 3, createdAt: now },
  { id: 4, reservationId: 2, title: "Displays do tema", completed: true, sortOrder: 1, createdAt: now },
  { id: 5, reservationId: 2, title: "Balões", completed: true, sortOrder: 2, createdAt: now },
  { id: 6, reservationId: 3, title: "Lista de compras", completed: false, sortOrder: 1, createdAt: now },
  { id: 7, reservationId: 3, title: "Convites enviados", completed: false, sortOrder: 2, createdAt: now },
  { id: 8, reservationId: 3, title: "Preparar lanche", completed: false, sortOrder: 3, createdAt: now },
  { id: 9, reservationId: 4, title: "Preparar materiais", completed: false, sortOrder: 1, createdAt: now },
  { id: 10, reservationId: 4, title: "Preparar certificados", completed: false, sortOrder: 2, createdAt: now },
  { id: 11, reservationId: 5, title: "Confirmar local de montagem", completed: true, sortOrder: 1, createdAt: now },
  { id: 12, reservationId: 5, title: "Preparar materiais de decoração", completed: false, sortOrder: 2, createdAt: now },
];

let venueEvents: VenueEvent[] = [];
let externalEvents: ExternalEvent[] = [];
let externalEventServices: ExternalEventService[] = [];
let workshops: Workshop[] = [];
let workshopParticipants: WorkshopParticipant[] = [];
let venuePacks: VenuePack[] = [];
let externalServiceCatalog: ExternalServiceCatalog[] = [];
let eventExtras: EventExtra[] = [];

const DEFAULT_TASKS_BY_PACK: Record<string, string[]> = {
  "Aluguer do Espaço": ["Confirmar sinal", "Confirmar caução", "Preparar espaço", "Limpeza final"],
  "Pack Simples": ["Confirmar sinal", "Confirmar número de crianças", "Confirmar menu", "Lista de compras", "Preparar lanche", "Preparar espaço e brinquedos"],
  "Pack com Decoração": ["Confirmar sinal", "Confirmar número de crianças", "Confirmar menu", "Lista de compras", "Confirmar tema", "Confirmar cores", "Preparar balões", "Preparar displays", "Montar decoração", "Preparar lanche"],
  "Pack Completo": ["Confirmar sinal", "Confirmar número de crianças", "Confirmar menu", "Lista de compras", "Confirmar tema", "Confirmar cores", "Preparar balões", "Preparar displays", "Preparar decoração", "Preparar lanche crianças", "Preparar catering adultos", "Confirmar bolo/aniversário"],
  "Decoração Externa": ["Confirmar local e horário de montagem", "Confirmar tema", "Confirmar cores", "Preparar balões", "Preparar displays", "Montar decoração no local"],
  "Catering / Brunch": ["Confirmar número de pessoas", "Confirmar menu", "Lista de compras", "Preparar entrega/montagem"],
  "Animação": ["Confirmar atividades", "Preparar materiais", "Confirmar horário e local"],
  "Aluguer de Insuflável": ["Confirmar local de montagem", "Confirmar transporte", "Verificar equipamento", "Agendar recolha"],
  "Workshop Balões Nível 1": ["Confirmar número mínimo de participantes", "Preparar materiais", "Preparar coffee break", "Preparar certificados"],
  "Workshop Balões + Kit Inicial": ["Confirmar número mínimo de participantes", "Preparar materiais", "Preparar kits iniciais", "Preparar coffee break", "Preparar certificados"],
  "Só Espaço": ["Confirmar sinal", "Preparar espaço", "Confirmar horários", "Limpeza final"],
  "Espaço + Lanche": ["Confirmar sinal", "Confirmar número de crianças", "Confirmar menu", "Lista de compras", "Preparar lanche", "Preparar espaço"],
  "Espaço + Decoração": ["Confirmar sinal", "Confirmar número de crianças", "Confirmar tema", "Confirmar cores", "Lista de compras", "Displays do tema", "Preparar balões", "Montar decoração"],
};

function paymentStatus(reservation: Reservation) {
  if (reservation.amountPaid >= reservation.totalPrice) return "paid";
  if (reservation.amountPaid > 0) return "partial";
  return "unpaid";
}

function parseExtras(extras: string | null) {
  if (!extras) return [];
  return extras
    .split(";")
    .map((raw) => raw.trim())
    .filter(Boolean)
    .map((raw) => {
      const priceMatch = raw.match(/\+([0-9]+(?:[.,][0-9]+)?)\s*€/);
      const revenue = priceMatch ? Number(priceMatch[1].replace(",", ".")) : 0;
      return {
        name: raw.replace(/\s*\(\+[0-9]+(?:[.,][0-9]+)?\s*€\)/, "").trim(),
        revenue,
      };
    });
}

function formatReservation(reservation: Reservation) {
  const remainingBalance = Math.max(0, reservation.totalPrice - reservation.amountPaid);
  return {
    ...reservation,
    serviceType: getServiceType(reservation.pack),
    remainingBalance,
    paymentStatus: paymentStatus(reservation),
  };
}

function computeVenuePaymentStatus(totalPrice: number, amountPaid: number): VenueEvent["paymentStatus"] {
  if (amountPaid >= totalPrice) return "paid";
  if (amountPaid > 0) return "partial";
  return "unpaid";
}

function formatVenueEvent(event: VenueEvent) {
  return {
    ...event,
    remainingBalance: Math.max(0, event.totalPrice - event.amountPaid),
  };
}

function computeExternalPaymentStatus(totalPrice: number, amountPaid: number): ExternalEvent["paymentStatus"] {
  if (amountPaid >= totalPrice) return "paid";
  if (amountPaid > 0) return "partial";
  return "unpaid";
}

function formatExternalEvent(event: ExternalEvent) {
  const services = externalEventServices
    .filter((service) => service.externalEventId === event.id)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return {
    ...event,
    services,
    remainingBalance: Math.max(0, event.totalPrice - event.amountPaid),
  };
}

function computeWorkshopParticipantPayment(price: number, amountPaid: number): Pick<WorkshopParticipant, "amountDue" | "paymentStatus"> {
  if (amountPaid >= price) return { amountDue: 0, paymentStatus: "paid" };
  if (amountPaid > 0) return { amountDue: Math.max(0, price - amountPaid), paymentStatus: "partial" };
  return { amountDue: Math.max(0, price), paymentStatus: "unpaid" };
}

function isActiveWorkshopParticipant(participant: WorkshopParticipant) {
  return ["registered", "confirmed", "attended"].includes(participant.status);
}

function workshopAggregates(workshop: Workshop) {
  const participants = workshopParticipants.filter((participant) => participant.workshopId === workshop.id);
  const activeParticipants = participants.filter(isActiveWorkshopParticipant);

  return {
    participantsCount: participants.length,
    activeParticipantsCount: activeParticipants.length,
    availableSeats: Math.max(0, workshop.capacity - activeParticipants.length),
    totalReceived: activeParticipants.reduce((sum, participant) => sum + participant.amountPaid, 0),
    totalPending: activeParticipants.reduce((sum, participant) => sum + participant.amountDue, 0),
  };
}

function formatWorkshop(workshop: Workshop, includeParticipants = false) {
  const participants = workshopParticipants.filter((participant) => participant.workshopId === workshop.id);

  return {
    ...workshop,
    ...workshopAggregates(workshop),
    ...(includeParticipants ? { participants } : {}),
  };
}

type DashboardAreaType = "venue_events" | "external_events" | "workshops";
type DashboardPaymentStatus = "unpaid" | "partial" | "paid" | "none";
type DashboardAgendaItem = {
  id: string;
  type: DashboardAreaType;
  typeLabel: string;
  title: string;
  date: string;
  time: string;
  location: string | null;
  status: string;
  paymentStatus: DashboardPaymentStatus;
  total: number;
  received: number;
  pending: number;
  nextAction: string;
  href: string;
  services: string[];
};

function currentIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysIso(baseDate: string, days: number) {
  const date = new Date(`${baseDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function isActiveStatus(status: string) {
  return status !== "cancelled";
}

function paymentStatusFromAmounts(total: number, received: number): DashboardPaymentStatus {
  if (total <= 0 && received <= 0) return "none";
  if (received >= total) return "paid";
  if (received > 0) return "partial";
  return "unpaid";
}

function nextDashboardAction(status: string, paymentStatus: DashboardPaymentStatus, pending: number, area: DashboardAreaType) {
  if (status === "cancelled") return "Cancelado";
  if (status === "completed") return "Concluido";
  if (paymentStatus !== "paid" && pending > 0) {
    return paymentStatus === "unpaid" ? "Cobrar sinal" : "Cobrar restante";
  }
  if (area === "workshops") return "Ver participantes";
  if (status === "draft") return "Confirmar detalhes";
  return "Preparar evento";
}

function areaSummary(items: DashboardAgendaItem[], todayValue: string, nextSevenDaysEnd: string) {
  const activeItems = items.filter((item) => isActiveStatus(item.status));
  return {
    totalCount: activeItems.length,
    upcomingCount: activeItems.filter((item) => item.date >= todayValue).length,
    nextSevenDaysCount: activeItems.filter((item) => item.date >= todayValue && item.date <= nextSevenDaysEnd).length,
    received: activeItems.reduce((sum, item) => sum + item.received, 0),
    pending: activeItems.reduce((sum, item) => sum + item.pending, 0),
  };
}

function dashboardV2Data() {
  const todayValue = currentIsoDate();
  const nextSevenDaysEnd = addDaysIso(todayValue, 7);

  const venueItems: DashboardAgendaItem[] = venueEvents.map((event) => {
    const pending = Math.max(0, event.totalPrice - event.amountPaid);
    const payment = paymentStatusFromAmounts(event.totalPrice, event.amountPaid);
    return {
      id: event.id,
      type: "venue_events",
      typeLabel: "Festa no Espaco",
      title: event.birthdayChildName ? `${event.customerName} - ${event.birthdayChildName}` : event.customerName,
      date: event.eventDate,
      time: event.startTime,
      location: "Espaco Girafinha",
      status: event.status,
      paymentStatus: payment,
      total: event.totalPrice,
      received: event.amountPaid,
      pending,
      nextAction: nextDashboardAction(event.status, payment, pending, "venue_events"),
      href: "/venue-events",
      services: [event.packName],
    };
  });

  const externalItems: DashboardAgendaItem[] = externalEvents.map((event) => {
    const services = externalEventServices
      .filter((service) => service.externalEventId === event.id)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    const pending = Math.max(0, event.totalPrice - event.amountPaid);
    const payment = paymentStatusFromAmounts(event.totalPrice, event.amountPaid);
    return {
      id: event.id,
      type: "external_events",
      typeLabel: "Servico Externo",
      title: event.customerName,
      date: event.eventDate,
      time: event.startTime,
      location: event.eventLocation,
      status: event.status,
      paymentStatus: payment,
      total: event.totalPrice,
      received: event.amountPaid,
      pending,
      nextAction: nextDashboardAction(event.status, payment, pending, "external_events"),
      href: "/external-events",
      services: services.map((service) => service.serviceLabel),
    };
  });

  const workshopItems: DashboardAgendaItem[] = workshops.map((workshop) => {
    const participants = workshopParticipants.filter((participant) => participant.workshopId === workshop.id);
    const activeParticipants = participants.filter(isActiveWorkshopParticipant);
    const received = activeParticipants.reduce((sum, participant) => sum + participant.amountPaid, 0);
    const pending = activeParticipants.reduce((sum, participant) => sum + participant.amountDue, 0);
    const total = received + pending;
    const payment = paymentStatusFromAmounts(total, received);
    return {
      id: workshop.id,
      type: "workshops",
      typeLabel: "Workshop/Formacao",
      title: workshop.name,
      date: workshop.date,
      time: workshop.startTime,
      location: workshop.location,
      status: workshop.status,
      paymentStatus: payment,
      total,
      received,
      pending,
      nextAction: nextDashboardAction(workshop.status, payment, pending, "workshops"),
      href: "/workshops",
      services: [`${activeParticipants.length}/${workshop.capacity} inscritos`],
    };
  });

  const allItems = [...venueItems, ...externalItems, ...workshopItems];
  const activeItems = allItems.filter((item) => isActiveStatus(item.status));
  const agenda = activeItems
    .filter((item) => item.date >= todayValue)
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))
    .slice(0, 12);

  return {
    summary: {
      todayCount: activeItems.filter((item) => item.date === todayValue).length,
      nextSevenDaysCount: activeItems.filter((item) => item.date >= todayValue && item.date <= nextSevenDaysEnd).length,
      totalReceived: activeItems.reduce((sum, item) => sum + item.received, 0),
      totalPending: activeItems.reduce((sum, item) => sum + item.pending, 0),
    },
    areas: {
      venueEvents: areaSummary(venueItems, todayValue, nextSevenDaysEnd),
      externalEvents: areaSummary(externalItems, todayValue, nextSevenDaysEnd),
      workshops: {
        ...areaSummary(workshopItems, todayValue, nextSevenDaysEnd),
        activeParticipantsCount: workshopParticipants.filter(isActiveWorkshopParticipant).length,
        availableSeats: workshops
          .filter((workshop) => isActiveStatus(workshop.status))
          .reduce((sum, workshop) => {
            const activeParticipants = workshopParticipants.filter(
              (participant) => participant.workshopId === workshop.id && isActiveWorkshopParticipant(participant),
            );
            return sum + Math.max(0, workshop.capacity - activeParticipants.length);
          }, 0),
      },
    },
    agenda,
  };
}

type CalendarV2ItemType = "venue_event" | "external_event" | "workshop";
type CalendarV2DayStatus = "free" | "busy" | "almost_full" | "full";
type CalendarV2Item = {
  id: string;
  type: CalendarV2ItemType;
  title: string;
  date: string;
  startTime: string;
  endTime: string | null;
  customerName: string | null;
  location: string | null;
  servicesLabels: string[];
  paymentStatus: string | null;
  amountPaid: number | null;
  totalPrice: number | null;
  pendingAmount: number | null;
  capacity: number | null;
  activeParticipantsCount: number | null;
  availableSeats: number | null;
  totalReceived: number | null;
  totalPending: number | null;
  occupiesSpace: boolean;
  status: string;
};

function defaultCalendarDateRange() {
  const date = new Date();
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { startDate, endDate };
}

function isValidDateParam(value: string | null) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function isEspacoGirafinha(location: string | null) {
  if (!location) return false;
  const normalized = location
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return normalized.includes("espaco girafinha") || (normalized.includes("espaco") && normalized.includes("girafinha"));
}

function datesBetween(startDate: string, endDate: string) {
  const dates: string[] = [];
  for (let current = startDate; current <= endDate; current = addDaysIso(current, 1)) {
    dates.push(current);
  }
  return dates;
}

function calendarDayStatus(items: CalendarV2Item[]): CalendarV2DayStatus {
  const spaceSlotsUsed = items.filter((item) => item.occupiesSpace).length;
  const hasOperationalItems = items.some((item) => !item.occupiesSpace);

  if (spaceSlotsUsed >= MAX_EVENTS_PER_DAY) return "full";
  if (spaceSlotsUsed === 1 || hasOperationalItems) return "almost_full";
  if (items.length > 0) return "busy";
  return "free";
}

function calendarV2Data(startDate: string, endDate: string) {
  const venueItems: CalendarV2Item[] = venueEvents
    .filter((event) => isActiveStatus(event.status) && event.eventDate >= startDate && event.eventDate <= endDate)
    .map((event) => ({
      id: event.id,
      type: "venue_event",
      title: event.birthdayChildName ? `${event.packName} - ${event.birthdayChildName}` : event.packName,
      date: event.eventDate,
      startTime: event.startTime,
      endTime: event.endTime,
      customerName: event.customerName,
      location: "Espaco Girafinha",
      servicesLabels: [event.packName],
      paymentStatus: event.paymentStatus,
      amountPaid: event.amountPaid,
      totalPrice: event.totalPrice,
      pendingAmount: Math.max(0, event.totalPrice - event.amountPaid),
      capacity: null,
      activeParticipantsCount: null,
      availableSeats: null,
      totalReceived: null,
      totalPending: null,
      occupiesSpace: true,
      status: event.status,
    }));

  const externalItems: CalendarV2Item[] = externalEvents
    .filter((event) => isActiveStatus(event.status) && event.eventDate >= startDate && event.eventDate <= endDate)
    .map((event) => {
      const services = externalEventServices
        .filter((service) => service.externalEventId === event.id)
        .sort((a, b) => a.sortOrder - b.sortOrder);
      return {
        id: event.id,
        type: "external_event",
        title: event.eventType || event.eventTheme || "Servico externo",
        date: event.eventDate,
        startTime: event.startTime,
        endTime: event.endTime,
        customerName: event.customerName,
        location: event.eventLocation,
        servicesLabels: services.map((service) => service.serviceLabel),
        paymentStatus: event.paymentStatus,
        amountPaid: event.amountPaid,
        totalPrice: event.totalPrice,
        pendingAmount: Math.max(0, event.totalPrice - event.amountPaid),
        capacity: null,
        activeParticipantsCount: null,
        availableSeats: null,
        totalReceived: null,
        totalPending: null,
        occupiesSpace: false,
        status: event.status,
      };
    });

  const workshopItems: CalendarV2Item[] = workshops
    .filter((workshop) => isActiveStatus(workshop.status) && workshop.date >= startDate && workshop.date <= endDate)
    .map((workshop) => {
      const activeParticipants = workshopParticipants
        .filter((participant) => participant.workshopId === workshop.id)
        .filter(isActiveWorkshopParticipant);
      const totalReceived = activeParticipants.reduce((sum, participant) => sum + participant.amountPaid, 0);
      const totalPending = activeParticipants.reduce((sum, participant) => sum + participant.amountDue, 0);
      return {
        id: workshop.id,
        type: "workshop",
        title: workshop.name,
        date: workshop.date,
        startTime: workshop.startTime,
        endTime: workshop.endTime,
        customerName: null,
        location: workshop.location,
        servicesLabels: [],
        paymentStatus: null,
        amountPaid: null,
        totalPrice: null,
        pendingAmount: null,
        capacity: workshop.capacity,
        activeParticipantsCount: activeParticipants.length,
        availableSeats: Math.max(0, workshop.capacity - activeParticipants.length),
        totalReceived,
        totalPending,
        occupiesSpace: isEspacoGirafinha(workshop.location),
        status: workshop.status,
      };
    });

  const items = [...venueItems, ...externalItems, ...workshopItems]
    .sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`));

  const days = datesBetween(startDate, endDate).map((date) => {
    const dayItems = items.filter((item) => item.date === date);
    return {
      date,
      status: calendarDayStatus(dayItems),
      spaceSlotsUsed: dayItems.filter((item) => item.occupiesSpace).length,
      spaceSlotsTotal: MAX_EVENTS_PER_DAY,
      items: dayItems,
    };
  });

  return {
    summary: {
      startDate,
      endDate,
      totalItems: items.length,
      spaceOccupyingItems: items.filter((item) => item.occupiesSpace).length,
      externalItems: items.filter((item) => item.type === "external_event").length,
      workshops: items.filter((item) => item.type === "workshop").length,
      freeDays: days.filter((day) => day.status === "free").length,
      busyDays: days.filter((day) => day.status === "busy").length,
      almostFullDays: days.filter((day) => day.status === "almost_full").length,
      fullDays: days.filter((day) => day.status === "full").length,
    },
    days,
    items,
  };
}

function reportStatFromMap(map: Map<string, { count: number; revenue: number }>, totalCount: number) {
  return [...map.entries()]
    .map(([label, value]) => ({
      label,
      count: value.count,
      revenue: Math.round(value.revenue * 100) / 100,
      percentage: totalCount > 0 ? Math.round((value.count / totalCount) * 10000) / 100 : 0,
    }))
    .sort((a, b) => b.count - a.count || b.revenue - a.revenue || a.label.localeCompare(b.label));
}

function addReportStat(map: Map<string, { count: number; revenue: number }>, label: string, revenue: number) {
  const current = map.get(label) ?? { count: 0, revenue: 0 };
  map.set(label, { count: current.count + 1, revenue: current.revenue + revenue });
}

function reportAreaSummary(count: number, revenue: number, received: number, pending: number) {
  return {
    eventCount: count,
    revenue: Math.round(revenue * 100) / 100,
    received: Math.round(received * 100) / 100,
    pending: Math.round(pending * 100) / 100,
    averageTicket: count > 0 ? Math.round((revenue / count) * 100) / 100 : 0,
  };
}

function reportsV2Data(startDate: string, endDate: string) {
  const activeVenueEvents = venueEvents.filter(
    (event) => isActiveStatus(event.status) && event.eventDate >= startDate && event.eventDate <= endDate,
  );
  const activeExternalEvents = externalEvents.filter(
    (event) => isActiveStatus(event.status) && event.eventDate >= startDate && event.eventDate <= endDate,
  );
  const activeExternalIds = new Set(activeExternalEvents.map((event) => event.id));
  const activeExternalServices = externalEventServices.filter((service) => activeExternalIds.has(service.externalEventId));
  const activeWorkshops = workshops.filter(
    (workshop) => isActiveStatus(workshop.status) && workshop.date >= startDate && workshop.date <= endDate,
  );
  const activeWorkshopIds = new Set(activeWorkshops.map((workshop) => workshop.id));
  const activeWorkshopParticipants = workshopParticipants.filter(
    (participant) => activeWorkshopIds.has(participant.workshopId) && isActiveWorkshopParticipant(participant),
  );

  const packStats = new Map<string, { count: number; revenue: number }>();
  const sourceStats = new Map<string, { count: number; revenue: number }>();
  const venueRevenue = activeVenueEvents.reduce((sum, event) => {
    addReportStat(packStats, event.packName || "Sem pack", event.totalPrice);
    if (event.source) addReportStat(sourceStats, event.source, event.totalPrice);
    return sum + event.totalPrice;
  }, 0);
  const venueReceived = activeVenueEvents.reduce((sum, event) => sum + event.amountPaid, 0);
  const venuePending = Math.max(0, venueRevenue - venueReceived);
  const venueAverageChildren =
    activeVenueEvents.length > 0
      ? Math.round((activeVenueEvents.reduce((sum, event) => sum + event.childrenCount, 0) / activeVenueEvents.length) * 100) / 100
      : 0;

  const serviceStats = new Map<string, { count: number; revenue: number }>();
  const combinationStats = new Map<string, { count: number; revenue: number }>();
  const externalRevenue = activeExternalEvents.reduce((sum, event) => {
    const services = activeExternalServices
      .filter((service) => service.externalEventId === event.id)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    for (const service of services) addReportStat(serviceStats, service.serviceLabel || service.serviceType, service.price);
    addReportStat(
      combinationStats,
      services.length > 0 ? services.map((service) => service.serviceLabel || service.serviceType).join(" + ") : "Sem servicos",
      event.totalPrice,
    );
    return sum + event.totalPrice;
  }, 0);
  const externalReceived = activeExternalEvents.reduce((sum, event) => sum + event.amountPaid, 0);
  const externalPending = Math.max(0, externalRevenue - externalReceived);

  const workshopReceived = activeWorkshopParticipants.reduce((sum, participant) => sum + participant.amountPaid, 0);
  const workshopPending = activeWorkshopParticipants.reduce((sum, participant) => sum + participant.amountDue, 0);
  const workshopCapacity = activeWorkshops.reduce((sum, workshop) => sum + workshop.capacity, 0);
  const workshopPaymentCounts = {
    paid: activeWorkshopParticipants.filter((participant) => participant.paymentStatus === "paid").length,
    partial: activeWorkshopParticipants.filter((participant) => participant.paymentStatus === "partial").length,
    unpaid: activeWorkshopParticipants.filter((participant) => participant.paymentStatus === "unpaid").length,
  };

  const venueArea = reportAreaSummary(activeVenueEvents.length, venueRevenue, venueReceived, venuePending);
  const externalArea = reportAreaSummary(activeExternalEvents.length, externalRevenue, externalReceived, externalPending);
  const workshopArea = reportAreaSummary(activeWorkshops.length, workshopReceived + workshopPending, workshopReceived, workshopPending);
  const totalRevenue = venueArea.revenue + externalArea.revenue + workshopArea.revenue;
  const totalReceived = venueArea.received + externalArea.received + workshopArea.received;
  const totalPending = venueArea.pending + externalArea.pending + workshopArea.pending;
  const eventCount = venueArea.eventCount + externalArea.eventCount + workshopArea.eventCount;

  return {
    summary: {
      startDate,
      endDate,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalReceived: Math.round(totalReceived * 100) / 100,
      totalPending: Math.round(totalPending * 100) / 100,
      eventCount,
      averageTicket: eventCount > 0 ? Math.round((totalRevenue / eventCount) * 100) / 100 : 0,
    },
    areas: {
      venueEvents: venueArea,
      externalEvents: externalArea,
      workshops: workshopArea,
    },
    venueEvents: {
      partyCount: activeVenueEvents.length,
      revenue: venueArea.revenue,
      received: venueArea.received,
      pending: venueArea.pending,
      topPacks: reportStatFromMap(packStats, activeVenueEvents.length),
      revenueByPack: reportStatFromMap(packStats, activeVenueEvents.length),
      averageChildren: venueAverageChildren,
      sources: reportStatFromMap(sourceStats, activeVenueEvents.length),
    },
    externalEvents: {
      eventCount: activeExternalEvents.length,
      revenue: externalArea.revenue,
      received: externalArea.received,
      pending: externalArea.pending,
      topServices: reportStatFromMap(serviceStats, activeExternalServices.length),
      revenueByServiceType: reportStatFromMap(serviceStats, activeExternalServices.length),
      serviceCombinations: reportStatFromMap(combinationStats, activeExternalEvents.length),
      averageTicket: externalArea.averageTicket,
    },
    workshops: {
      workshopCount: activeWorkshops.length,
      activeRegistrations: activeWorkshopParticipants.length,
      occupiedSeats: activeWorkshopParticipants.length,
      freeSeats: Math.max(0, workshopCapacity - activeWorkshopParticipants.length),
      occupancyRate: workshopCapacity > 0 ? Math.round((activeWorkshopParticipants.length / workshopCapacity) * 10000) / 100 : 0,
      received: workshopArea.received,
      pending: workshopArea.pending,
      participantsByPaymentStatus: workshopPaymentCounts,
    },
  };
}

function canAddActiveWorkshopParticipant(workshop: Workshop, status: WorkshopParticipant["status"], excludeParticipantId?: string) {
  if (status === "cancelled") return true;

  const activeCount = workshopParticipants.filter(
    (participant) =>
      participant.workshopId === workshop.id &&
      participant.id !== excludeParticipantId &&
      isActiveWorkshopParticipant(participant),
  ).length;

  return activeCount < workshop.capacity;
}

function json(res: ServerResponse, status: number, body?: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(body === undefined ? "" : JSON.stringify(body));
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function readBody(req: IncomingMessage) {
  return new Promise<Record<string, unknown>>((resolve) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve({});
      }
    });
  });
}

function isAuthed(req: IncomingMessage) {
  if (!getDevCredentials()) return false;
  return req.headers.cookie?.includes(`${SESSION_COOKIE}=1`) ?? false;
}

function getBearerToken(req: IncomingMessage) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return "";
  return header.slice("Bearer ".length).trim();
}

async function verifySupabaseBearerToken(token: string) {
  if (!token) return false;

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn("[girafinha-dev-api] Missing SUPABASE_URL/SUPABASE_ANON_KEY for local auth.");
    return false;
  }

  try {
    const response = await fetch(`${supabaseUrl.replace(/\/+$/, "")}/auth/v1/user`, {
      headers: {
        apikey: supabaseAnonKey,
        authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      console.warn(`[girafinha-dev-api] Supabase token rejected with ${response.status}.`);
      return false;
    }

    return true;
  } catch (error) {
    console.warn("[girafinha-dev-api] Could not verify Supabase token.", error);
    return false;
  }
}

async function requireAuth(req: IncomingMessage, res: ServerResponse) {
  if (isAuthed(req)) return true;
  if (await verifySupabaseBearerToken(getBearerToken(req))) return true;

  json(res, 401, { error: "Unauthorized" });
  return false;
}

function stats() {
  const formatted = reservations.map(formatReservation);
  return {
    totalReservations: formatted.length,
    totalRevenue: formatted.reduce((sum, r) => sum + r.totalPrice, 0),
    totalPaid: formatted.reduce((sum, r) => sum + r.amountPaid, 0),
    totalPending: formatted.reduce((sum, r) => sum + r.remainingBalance, 0),
    upcomingCount: formatted.filter((r) => r.eventDate >= today.toISOString().slice(0, 10)).length,
    paidCount: formatted.filter((r) => r.paymentStatus === "paid").length,
    partialCount: formatted.filter((r) => r.paymentStatus === "partial").length,
    unpaidCount: formatted.filter((r) => r.paymentStatus === "unpaid").length,
  };
}

function reportFor(year: number, month: number) {
  const monthLabel = `${year}-${String(month).padStart(2, "0")}`;
  const current = reservations.filter((r) => r.eventDate.startsWith(monthLabel)).map(formatReservation);
  const selectedMonth = {
    reservationCount: current.length,
    revenue: current.reduce((sum, r) => sum + r.totalPrice, 0),
    paid: current.reduce((sum, r) => sum + r.amountPaid, 0),
    pending: current.reduce((sum, r) => sum + r.remainingBalance, 0),
    avgRevenuePerBooking: current.length
      ? current.reduce((sum, r) => sum + r.totalPrice, 0) / current.length
      : 0,
  };
  const packStats = Object.entries(
    current.reduce<Record<string, { count: number; revenue: number }>>((acc, r) => {
      acc[r.pack] ??= { count: 0, revenue: 0 };
      acc[r.pack].count += 1;
      acc[r.pack].revenue += r.totalPrice;
      return acc;
    }, {}),
  ).map(([pack, item]) => ({
    pack,
    count: item.count,
    revenue: item.revenue,
    percentage: current.length ? Math.round((item.count / current.length) * 100) : 0,
  }));
  const serviceTypeStats = Object.entries(
    current.reduce<Record<string, { count: number; revenue: number }>>((acc, r) => {
      acc[r.serviceType] ??= { count: 0, revenue: 0 };
      acc[r.serviceType].count += 1;
      acc[r.serviceType].revenue += r.totalPrice;
      return acc;
    }, {}),
  ).map(([serviceType, item]) => ({
    serviceType,
    count: item.count,
    revenue: item.revenue,
    percentage: current.length ? Math.round((item.count / current.length) * 100) : 0,
  }));
  const paymentStatusStats = Object.entries(
    current.reduce<Record<string, { count: number; revenue: number; pending: number }>>((acc, r) => {
      acc[r.paymentStatus] ??= { count: 0, revenue: 0, pending: 0 };
      acc[r.paymentStatus].count += 1;
      acc[r.paymentStatus].revenue += r.totalPrice;
      acc[r.paymentStatus].pending += r.remainingBalance;
      return acc;
    }, {}),
  ).map(([status, item]) => ({
    status,
    count: item.count,
    revenue: item.revenue,
    pending: item.pending,
    percentage: current.length ? Math.round((item.count / current.length) * 100) : 0,
  }));
  const extraStats = Object.entries(
    current.reduce<Record<string, { count: number; revenue: number }>>((acc, r) => {
      for (const extra of parseExtras(r.extras)) {
        acc[extra.name] ??= { count: 0, revenue: 0 };
        acc[extra.name].count += 1;
        acc[extra.name].revenue += extra.revenue;
      }
      return acc;
    }, {}),
  ).map(([extra, item]) => ({
    extra,
    count: item.count,
    revenue: item.revenue,
  }));
  const occupancyByDate = current
    .filter((r) => r.serviceType !== "Serviços externos")
    .reduce<Record<string, number>>((acc, r) => {
      acc[r.eventDate] = (acc[r.eventDate] ?? 0) + 1;
      return acc;
    }, {});
  const daysInMonth = new Date(year, month, 0).getDate();
  const usedSlots = Object.values(occupancyByDate).reduce((sum, count) => sum + Math.min(count, MAX_EVENTS_PER_DAY), 0);
  const maxSlots = daysInMonth * MAX_EVENTS_PER_DAY;
  const occupancyStats = {
    bookedDays: Object.keys(occupancyByDate).length,
    fullDays: Object.values(occupancyByDate).filter((count) => count >= MAX_EVENTS_PER_DAY).length,
    usedSlots,
    availableSlots: Math.max(0, maxSlots - usedSlots),
    maxSlots,
    occupancyRate: maxSlots ? Math.round((usedSlots / maxSlots) * 1000) / 10 : 0,
  };

  return {
    selectedMonth,
    previousMonth: { reservationCount: 1, revenue: 220, paid: 220, pending: 0, avgRevenuePerBooking: 220 },
    occupancyStats,
    serviceTypeStats,
    paymentStatusStats,
    extraStats,
    packStats,
    monthlyTrend: Array.from({ length: 12 }, (_, index) => ({
      month: new Date(year, index, 1).toLocaleString("pt-PT", { month: "long" }),
      year,
      monthNum: index + 1,
      reservationCount: index + 1 === month ? selectedMonth.reservationCount : index % 3,
      revenue: index + 1 === month ? selectedMonth.revenue : (index % 3) * 220,
      paid: index + 1 === month ? selectedMonth.paid : (index % 3) * 120,
      pending: index + 1 === month ? selectedMonth.pending : (index % 3) * 100,
    })),
    bestMonth: { month: new Date(year, month - 1, 1).toLocaleString("pt-PT", { month: "long" }), revenue: selectedMonth.revenue },
    insights: [
      "Modo local ativo: estes dados são de demonstração.",
      "Use o modal de reserva para testar criação, edição e pagamentos.",
    ],
  };
}

export function devApiPlugin(): Plugin {
  return {
    name: "girafinha-dev-api",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/api", async (req, res, next) => {
        try {
          if (!req.url || !req.method) return next();

          const url = new URL(req.url, "http://localhost");
          const method = req.method.toUpperCase();
          const path = url.pathname;

        if (path === "/auth/me") {
          const devCredentials = getDevCredentials();
          if (!devCredentials || !isAuthed(req)) return json(res, 401, { error: "NÃ£o autenticado" });
          return json(res, 200, { email: devCredentials.email });
        }

        if (path === "/auth/login" && method === "POST") {
          const devCredentials = getDevCredentials();
          if (!devCredentials) {
            return json(res, 503, { error: "Development login is not configured" });
          }
          const body = await readBody(req);
          const email = String(body.email ?? "").trim().toLowerCase();
          const password = String(body.password ?? "");
          if (email !== devCredentials.email || password !== devCredentials.password) {
            return json(res, 401, { error: "Credenciais inválidas" });
          }
          res.setHeader("Set-Cookie", `${SESSION_COOKIE}=1; Path=/; SameSite=Lax`);
          return json(res, 200, { email: devCredentials.email });
        }

        if (path === "/auth/logout" && method === "POST") {
          res.setHeader("Set-Cookie", `${SESSION_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`);
          return json(res, 204);
        }

        if (path === "/healthz") return json(res, 200, { ok: true });
        if (!(await requireAuth(req, res))) return;

        if (path === "/dashboard-v2") return json(res, 200, dashboardV2Data());
        if (path === "/calendar-v2") {
          const defaults = defaultCalendarDateRange();
          const startDate = isValidDateParam(url.searchParams.get("startDate"))
            ? url.searchParams.get("startDate")!
            : defaults.startDate;
          const endDate = isValidDateParam(url.searchParams.get("endDate"))
            ? url.searchParams.get("endDate")!
            : defaults.endDate;

          if (startDate > endDate) {
            return json(res, 400, { error: "startDate must be before or equal to endDate" });
          }

          return json(res, 200, calendarV2Data(startDate, endDate));
        }
        if (path === "/reports-v2") {
          const defaults = defaultCalendarDateRange();
          const startDate = isValidDateParam(url.searchParams.get("startDate"))
            ? url.searchParams.get("startDate")!
            : defaults.startDate;
          const endDate = isValidDateParam(url.searchParams.get("endDate"))
            ? url.searchParams.get("endDate")!
            : defaults.endDate;

          if (startDate > endDate) {
            return json(res, 400, { error: "startDate must be before or equal to endDate" });
          }

          return json(res, 200, reportsV2Data(startDate, endDate));
        }
        if (path === "/dashboard/stats") return json(res, 200, stats());
        if (path === "/dashboard/upcoming") {
          return json(res, 200, reservations.filter((r) => r.eventDate >= today.toISOString().slice(0, 10)).map(formatReservation));
        }
        if (path === "/dashboard/calendar") {
          const year = Number(url.searchParams.get("year"));
          const month = Number(url.searchParams.get("month"));
          const prefix = `${year}-${String(month).padStart(2, "0")}`;
          const byDate = reservations
            .filter((r) => r.eventDate.startsWith(prefix))
            .reduce<Record<string, ReturnType<typeof formatReservation>[]>>((acc, r) => {
              acc[r.eventDate] ??= [];
              acc[r.eventDate].push(formatReservation(r));
              return acc;
            }, {});
          return json(res, 200, Object.entries(byDate).map(([date, items]) => ({ date, reservations: items })));
        }

        if (path === "/reports") {
          return json(res, 200, reportFor(Number(url.searchParams.get("year")), Number(url.searchParams.get("month"))));
        }

        if (path === "/settings/venue-packs" && method === "GET") {
          return json(res, 200, [...venuePacks].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)));
        }
        if (path === "/settings/venue-packs" && method === "POST") {
          const body = await readBody(req);
          if (!String(body.name ?? "").trim()) return json(res, 400, { error: "name is required" });
          const basePrice = Number(body.basePrice ?? 0);
          if (basePrice < 0) return json(res, 400, { error: "basePrice must be greater than or equal to 0" });
          const pack: VenuePack = {
            id: randomUUID(),
            name: String(body.name).trim(),
            description: body.description ? String(body.description) : null,
            basePrice,
            defaultStartTime: body.defaultStartTime ? String(body.defaultStartTime) : null,
            defaultEndTime: body.defaultEndTime ? String(body.defaultEndTime) : null,
            isActive: body.isActive === undefined ? true : Boolean(body.isActive),
            sortOrder: Number(body.sortOrder ?? 0),
            internalNotes: body.internalNotes ? String(body.internalNotes) : null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          venuePacks.push(pack);
          return json(res, 201, pack);
        }

        const venuePackMatch = path.match(/^\/settings\/venue-packs\/([0-9a-f-]+)$/i);
        if (venuePackMatch && method === "PATCH") {
          const id = venuePackMatch[1];
          const current = venuePacks.find((pack) => pack.id === id);
          if (!current) return json(res, 404, { error: "Venue pack not found" });
          const body = await readBody(req);
          const basePrice = body.basePrice === undefined ? current.basePrice : Number(body.basePrice);
          if (basePrice < 0) return json(res, 400, { error: "basePrice must be greater than or equal to 0" });
          venuePacks = venuePacks.map((pack) =>
            pack.id === id
              ? {
                  ...pack,
                  ...body,
                  name: body.name === undefined ? pack.name : String(body.name).trim(),
                  basePrice,
                  isActive: body.isActive === undefined ? pack.isActive : Boolean(body.isActive),
                  sortOrder: body.sortOrder === undefined ? pack.sortOrder : Number(body.sortOrder),
                  updatedAt: new Date().toISOString(),
                } as VenuePack
              : pack,
          );
          return json(res, 200, venuePacks.find((pack) => pack.id === id));
        }

        if (path === "/settings/external-services" && method === "GET") {
          return json(res, 200, [...externalServiceCatalog].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)));
        }
        if (path === "/settings/external-services" && method === "POST") {
          const body = await readBody(req);
          const code = String(body.code ?? "").trim();
          if (!code) return json(res, 400, { error: "code is required" });
          if (!String(body.name ?? "").trim()) return json(res, 400, { error: "name is required" });
          if (externalServiceCatalog.some((service) => service.code === code)) {
            return json(res, 409, { error: "External service code already exists" });
          }
          const basePrice = Number(body.basePrice ?? 0);
          if (basePrice < 0) return json(res, 400, { error: "basePrice must be greater than or equal to 0" });
          const service: ExternalServiceCatalog = {
            id: randomUUID(),
            code,
            name: String(body.name).trim(),
            description: body.description ? String(body.description) : null,
            basePrice,
            isActive: body.isActive === undefined ? true : Boolean(body.isActive),
            sortOrder: Number(body.sortOrder ?? 0),
            operationalNotes: body.operationalNotes ? String(body.operationalNotes) : null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          externalServiceCatalog.push(service);
          return json(res, 201, service);
        }

        const externalServiceMatch = path.match(/^\/settings\/external-services\/([0-9a-f-]+)$/i);
        if (externalServiceMatch && method === "PATCH") {
          const id = externalServiceMatch[1];
          const current = externalServiceCatalog.find((service) => service.id === id);
          if (!current) return json(res, 404, { error: "External service not found" });
          const body = await readBody(req);
          const code = body.code === undefined ? current.code : String(body.code).trim();
          if (!code) return json(res, 400, { error: "code is required" });
          if (externalServiceCatalog.some((service) => service.id !== id && service.code === code)) {
            return json(res, 409, { error: "External service code already exists" });
          }
          const basePrice = body.basePrice === undefined ? current.basePrice : Number(body.basePrice);
          if (basePrice < 0) return json(res, 400, { error: "basePrice must be greater than or equal to 0" });
          externalServiceCatalog = externalServiceCatalog.map((service) =>
            service.id === id
              ? {
                  ...service,
                  ...body,
                  code,
                  name: body.name === undefined ? service.name : String(body.name).trim(),
                  basePrice,
                  isActive: body.isActive === undefined ? service.isActive : Boolean(body.isActive),
                  sortOrder: body.sortOrder === undefined ? service.sortOrder : Number(body.sortOrder),
                  updatedAt: new Date().toISOString(),
                } as ExternalServiceCatalog
              : service,
          );
          return json(res, 200, externalServiceCatalog.find((service) => service.id === id));
        }

        if (path === "/settings/event-extras" && method === "GET") {
          return json(res, 200, [...eventExtras].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)));
        }
        if (path === "/settings/event-extras" && method === "POST") {
          const body = await readBody(req);
          if (!String(body.name ?? "").trim()) return json(res, 400, { error: "name is required" });
          const basePrice = Number(body.basePrice ?? 0);
          if (basePrice < 0) return json(res, 400, { error: "basePrice must be greater than or equal to 0" });
          const appliesTo = (body.appliesTo as EventExtra["appliesTo"]) ?? "all";
          if (!["all", "venue_events", "external_events", "workshops"].includes(appliesTo)) {
            return json(res, 400, { error: "Invalid appliesTo" });
          }
          const extra: EventExtra = {
            id: randomUUID(),
            name: String(body.name).trim(),
            category: body.category ? String(body.category) : null,
            basePrice,
            appliesTo,
            isActive: body.isActive === undefined ? true : Boolean(body.isActive),
            sortOrder: Number(body.sortOrder ?? 0),
            internalNotes: body.internalNotes ? String(body.internalNotes) : null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          eventExtras.push(extra);
          return json(res, 201, extra);
        }

        const eventExtraMatch = path.match(/^\/settings\/event-extras\/([0-9a-f-]+)$/i);
        if (eventExtraMatch && method === "PATCH") {
          const id = eventExtraMatch[1];
          const current = eventExtras.find((extra) => extra.id === id);
          if (!current) return json(res, 404, { error: "Event extra not found" });
          const body = await readBody(req);
          const basePrice = body.basePrice === undefined ? current.basePrice : Number(body.basePrice);
          if (basePrice < 0) return json(res, 400, { error: "basePrice must be greater than or equal to 0" });
          const appliesTo = (body.appliesTo as EventExtra["appliesTo"]) ?? current.appliesTo;
          if (!["all", "venue_events", "external_events", "workshops"].includes(appliesTo)) {
            return json(res, 400, { error: "Invalid appliesTo" });
          }
          eventExtras = eventExtras.map((extra) =>
            extra.id === id
              ? {
                  ...extra,
                  ...body,
                  name: body.name === undefined ? extra.name : String(body.name).trim(),
                  basePrice,
                  appliesTo,
                  isActive: body.isActive === undefined ? extra.isActive : Boolean(body.isActive),
                  sortOrder: body.sortOrder === undefined ? extra.sortOrder : Number(body.sortOrder),
                  updatedAt: new Date().toISOString(),
                } as EventExtra
              : extra,
          );
          return json(res, 200, eventExtras.find((extra) => extra.id === id));
        }

        if (path === "/venue-events" && method === "GET") {
          const search = url.searchParams.get("search")?.toLowerCase();
          const status = url.searchParams.get("status");
          const paymentStatusFilter = url.searchParams.get("paymentStatus");
          const dateFrom = url.searchParams.get("dateFrom");
          const dateTo = url.searchParams.get("dateTo");
          const result = venueEvents
            .map(formatVenueEvent)
            .filter((event) => !search || event.customerName.toLowerCase().includes(search) || event.phone.includes(search))
            .filter((event) => !status || event.status === status)
            .filter((event) => !paymentStatusFilter || event.paymentStatus === paymentStatusFilter)
            .filter((event) => !dateFrom || event.eventDate >= dateFrom)
            .filter((event) => !dateTo || event.eventDate <= dateTo)
            .sort((a, b) => `${a.eventDate} ${a.startTime}`.localeCompare(`${b.eventDate} ${b.startTime}`));
          return json(res, 200, result);
        }

        if (path === "/venue-events" && method === "POST") {
          const body = await readBody(req);
          const totalPrice = Number(body.totalPrice ?? 0);
          const amountPaid = Number(body.amountPaid ?? 0);
          const event: VenueEvent = {
            id: randomUUID(),
            customerName: String(body.customerName ?? ""),
            phone: String(body.phone ?? ""),
            email: body.email ? String(body.email) : null,
            nif: body.nif ? String(body.nif) : null,
            eventDate: String(body.eventDate ?? ""),
            startTime: String(body.startTime ?? ""),
            endTime: body.endTime ? String(body.endTime) : null,
            status: (body.status as VenueEvent["status"]) ?? "draft",
            paymentStatus: computeVenuePaymentStatus(totalPrice, amountPaid),
            source: body.source ? String(body.source) : null,
            packName: String(body.packName ?? ""),
            birthdayChildName: body.birthdayChildName ? String(body.birthdayChildName) : null,
            birthdayChildAge: body.birthdayChildAge === null || body.birthdayChildAge === undefined ? null : Number(body.birthdayChildAge),
            childrenCount: Number(body.childrenCount ?? 0),
            childrenAges: body.childrenAges ? String(body.childrenAges) : null,
            partyTheme: body.partyTheme ? String(body.partyTheme) : null,
            decorationNotes: body.decorationNotes ? String(body.decorationNotes) : null,
            cateringNotes: body.cateringNotes ? String(body.cateringNotes) : null,
            allergies: body.allergies ? String(body.allergies) : null,
            imageAuthorization: (body.imageAuthorization as VenueEvent["imageAuthorization"]) ?? null,
            termsAccepted: Boolean(body.termsAccepted),
            totalPrice,
            amountPaid,
            paymentMethod: body.paymentMethod ? String(body.paymentMethod) : null,
            notes: body.notes ? String(body.notes) : null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          venueEvents.push(event);
          return json(res, 201, formatVenueEvent(event));
        }

        const venueEventMatch = path.match(/^\/venue-events\/([0-9a-f-]+)$/i);
        if (venueEventMatch && method === "GET") {
          const event = venueEvents.find((item) => item.id === venueEventMatch[1]);
          if (!event) return json(res, 404, { error: "Venue event not found" });
          return json(res, 200, formatVenueEvent(event));
        }
        if (venueEventMatch && method === "PATCH") {
          const id = venueEventMatch[1];
          const body = await readBody(req);
          const current = venueEvents.find((event) => event.id === id);
          if (!current) return json(res, 404, { error: "Venue event not found" });
          const totalPrice = body.totalPrice !== undefined ? Number(body.totalPrice) : current.totalPrice;
          const amountPaid = body.amountPaid !== undefined ? Number(body.amountPaid) : current.amountPaid;
          venueEvents = venueEvents.map((event) =>
            event.id === id
              ? {
                  ...event,
                  ...body,
                  totalPrice,
                  amountPaid,
                  paymentStatus: computeVenuePaymentStatus(totalPrice, amountPaid),
                  updatedAt: new Date().toISOString(),
                } as VenueEvent
              : event,
          );
          return json(res, 200, formatVenueEvent(venueEvents.find((event) => event.id === id)!));
        }
        if (venueEventMatch && method === "DELETE") {
          const id = venueEventMatch[1];
          venueEvents = venueEvents.filter((event) => event.id !== id);
          return json(res, 204);
        }

        if (path === "/external-events" && method === "GET") {
          const search = url.searchParams.get("search")?.toLowerCase();
          const status = url.searchParams.get("status");
          const paymentStatusFilter = url.searchParams.get("paymentStatus");
          const dateFrom = url.searchParams.get("dateFrom");
          const dateTo = url.searchParams.get("dateTo");
          const result = externalEvents
            .map(formatExternalEvent)
            .filter((event) => !search || event.customerName.toLowerCase().includes(search) || event.phone.includes(search) || event.eventLocation?.toLowerCase().includes(search))
            .filter((event) => !status || event.status === status)
            .filter((event) => !paymentStatusFilter || event.paymentStatus === paymentStatusFilter)
            .filter((event) => !dateFrom || event.eventDate >= dateFrom)
            .filter((event) => !dateTo || event.eventDate <= dateTo)
            .sort((a, b) => `${a.eventDate} ${a.startTime}`.localeCompare(`${b.eventDate} ${b.startTime}`));
          return json(res, 200, result);
        }

        if (path === "/external-events" && method === "POST") {
          const body = await readBody(req);
          const services = Array.isArray(body.services) ? body.services as Record<string, unknown>[] : [];
          const totalPrice = Number(body.totalPrice ?? 0);
          const amountPaid = Number(body.amountPaid ?? 0);
          const event: ExternalEvent = {
            id: randomUUID(),
            customerName: String(body.customerName ?? ""),
            phone: String(body.phone ?? ""),
            email: body.email ? String(body.email) : null,
            nif: body.nif ? String(body.nif) : null,
            eventDate: String(body.eventDate ?? ""),
            startTime: String(body.startTime ?? ""),
            endTime: body.endTime ? String(body.endTime) : null,
            status: (body.status as ExternalEvent["status"]) ?? "draft",
            paymentStatus: computeExternalPaymentStatus(totalPrice, amountPaid),
            source: body.source ? String(body.source) : null,
            eventLocation: body.eventLocation ? String(body.eventLocation) : null,
            guestCount: Number(body.guestCount ?? 0),
            eventType: body.eventType ? String(body.eventType) : null,
            eventTheme: body.eventTheme ? String(body.eventTheme) : null,
            setupNotes: body.setupNotes ? String(body.setupNotes) : null,
            teardownNotes: body.teardownNotes ? String(body.teardownNotes) : null,
            accessNotes: body.accessNotes ? String(body.accessNotes) : null,
            totalPrice,
            amountPaid,
            paymentMethod: body.paymentMethod ? String(body.paymentMethod) : null,
            notes: body.notes ? String(body.notes) : null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          externalEvents.push(event);
          externalEventServices.push(...services.map((service, index) => ({
            id: randomUUID(),
            externalEventId: event.id,
            serviceType: service.serviceType as ExternalEventService["serviceType"],
            serviceLabel: String(service.serviceLabel ?? ""),
            price: Number(service.price ?? 0),
            status: (service.status as ExternalEventService["status"]) ?? "planned",
            notes: service.notes ? String(service.notes) : null,
            sortOrder: Number(service.sortOrder ?? index + 1),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })));
          return json(res, 201, formatExternalEvent(event));
        }

        const externalEventMatch = path.match(/^\/external-events\/([0-9a-f-]+)$/i);
        if (externalEventMatch && method === "GET") {
          const event = externalEvents.find((item) => item.id === externalEventMatch[1]);
          if (!event) return json(res, 404, { error: "External event not found" });
          return json(res, 200, formatExternalEvent(event));
        }
        if (externalEventMatch && method === "PATCH") {
          const id = externalEventMatch[1];
          const body = await readBody(req);
          const current = externalEvents.find((event) => event.id === id);
          if (!current) return json(res, 404, { error: "External event not found" });
          const totalPrice = body.totalPrice !== undefined ? Number(body.totalPrice) : current.totalPrice;
          const amountPaid = body.amountPaid !== undefined ? Number(body.amountPaid) : current.amountPaid;
          externalEvents = externalEvents.map((event) =>
            event.id === id
              ? {
                  ...event,
                  ...body,
                  totalPrice,
                  amountPaid,
                  paymentStatus: computeExternalPaymentStatus(totalPrice, amountPaid),
                  updatedAt: new Date().toISOString(),
                } as ExternalEvent
              : event,
          );
          if (Array.isArray(body.services)) {
            externalEventServices = externalEventServices.filter((service) => service.externalEventId !== id);
            externalEventServices.push(...(body.services as Record<string, unknown>[]).map((service, index) => ({
              id: randomUUID(),
              externalEventId: id,
              serviceType: service.serviceType as ExternalEventService["serviceType"],
              serviceLabel: String(service.serviceLabel ?? ""),
              price: Number(service.price ?? 0),
              status: (service.status as ExternalEventService["status"]) ?? "planned",
              notes: service.notes ? String(service.notes) : null,
              sortOrder: Number(service.sortOrder ?? index + 1),
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            })));
          }
          return json(res, 200, formatExternalEvent(externalEvents.find((event) => event.id === id)!));
        }
        if (externalEventMatch && method === "DELETE") {
          const id = externalEventMatch[1];
          externalEvents = externalEvents.filter((event) => event.id !== id);
          externalEventServices = externalEventServices.filter((service) => service.externalEventId !== id);
          return json(res, 204);
        }

        if (path === "/workshops" && method === "GET") {
          const search = url.searchParams.get("search")?.toLowerCase();
          const status = url.searchParams.get("status");
          const dateFrom = url.searchParams.get("dateFrom");
          const dateTo = url.searchParams.get("dateTo");
          const result = workshops
            .map((workshop) => formatWorkshop(workshop))
            .filter((workshop) => !search || workshop.name.toLowerCase().includes(search) || workshop.location?.toLowerCase().includes(search))
            .filter((workshop) => !status || workshop.status === status)
            .filter((workshop) => !dateFrom || workshop.date >= dateFrom)
            .filter((workshop) => !dateTo || workshop.date <= dateTo)
            .sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`));
          return json(res, 200, result);
        }

        if (path === "/workshops" && method === "POST") {
          const body = await readBody(req);
          const workshop: Workshop = {
            id: randomUUID(),
            name: String(body.name ?? ""),
            description: body.description ? String(body.description) : null,
            date: String(body.date ?? ""),
            startTime: String(body.startTime ?? ""),
            endTime: body.endTime ? String(body.endTime) : null,
            capacity: Number(body.capacity ?? 0),
            price: Number(body.price ?? 0),
            kitIncluded: Boolean(body.kitIncluded),
            status: (body.status as Workshop["status"]) ?? "draft",
            location: body.location ? String(body.location) : null,
            notes: body.notes ? String(body.notes) : null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          workshops.push(workshop);
          return json(res, 201, formatWorkshop(workshop));
        }

        const workshopMatch = path.match(/^\/workshops\/([0-9a-f-]+)$/i);
        if (workshopMatch && method === "GET") {
          const workshop = workshops.find((item) => item.id === workshopMatch[1]);
          if (!workshop) return json(res, 404, { error: "Workshop not found" });
          return json(res, 200, formatWorkshop(workshop, true));
        }
        if (workshopMatch && method === "PATCH") {
          const id = workshopMatch[1];
          const body = await readBody(req);
          const current = workshops.find((workshop) => workshop.id === id);
          if (!current) return json(res, 404, { error: "Workshop not found" });
          workshops = workshops.map((workshop) =>
            workshop.id === id
              ? {
                  ...workshop,
                  ...body,
                  capacity: body.capacity !== undefined ? Number(body.capacity) : workshop.capacity,
                  price: body.price !== undefined ? Number(body.price) : workshop.price,
                  kitIncluded: body.kitIncluded !== undefined ? Boolean(body.kitIncluded) : workshop.kitIncluded,
                  updatedAt: new Date().toISOString(),
                } as Workshop
              : workshop,
          );
          return json(res, 200, formatWorkshop(workshops.find((workshop) => workshop.id === id)!, true));
        }
        if (workshopMatch && method === "DELETE") {
          const id = workshopMatch[1];
          workshops = workshops.filter((workshop) => workshop.id !== id);
          workshopParticipants = workshopParticipants.filter((participant) => participant.workshopId !== id);
          return json(res, 204);
        }

        const workshopParticipantsMatch = path.match(/^\/workshops\/([0-9a-f-]+)\/participants$/i);
        if (workshopParticipantsMatch && method === "POST") {
          const workshopId = workshopParticipantsMatch[1];
          const workshop = workshops.find((item) => item.id === workshopId);
          if (!workshop) return json(res, 404, { error: "Workshop not found" });

          const body = await readBody(req);
          const status = (body.status as WorkshopParticipant["status"]) ?? "registered";
          if (!canAddActiveWorkshopParticipant(workshop, status)) {
            return json(res, 400, { error: "Workshop capacity reached" });
          }

          const amountPaid = Number(body.amountPaid ?? 0);
          const payment = computeWorkshopParticipantPayment(workshop.price, amountPaid);
          const participant: WorkshopParticipant = {
            id: randomUUID(),
            workshopId,
            name: String(body.name ?? ""),
            phone: String(body.phone ?? ""),
            email: body.email ? String(body.email) : null,
            nif: body.nif ? String(body.nif) : null,
            amountPaid,
            amountDue: payment.amountDue,
            paymentMethod: body.paymentMethod ? String(body.paymentMethod) : null,
            paymentStatus: payment.paymentStatus,
            status,
            notes: body.notes ? String(body.notes) : null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          workshopParticipants.push(participant);
          return json(res, 201, participant);
        }

        const workshopParticipantMatch = path.match(/^\/workshops\/([0-9a-f-]+)\/participants\/([0-9a-f-]+)$/i);
        if (workshopParticipantMatch && method === "PATCH") {
          const workshopId = workshopParticipantMatch[1];
          const participantId = workshopParticipantMatch[2];
          const workshop = workshops.find((item) => item.id === workshopId);
          if (!workshop) return json(res, 404, { error: "Workshop not found" });

          const current = workshopParticipants.find((participant) => participant.id === participantId && participant.workshopId === workshopId);
          if (!current) return json(res, 404, { error: "Workshop participant not found" });

          const body = await readBody(req);
          const status = (body.status as WorkshopParticipant["status"]) ?? current.status;
          if (!canAddActiveWorkshopParticipant(workshop, status, participantId)) {
            return json(res, 400, { error: "Workshop capacity reached" });
          }

          const amountPaid = body.amountPaid !== undefined ? Number(body.amountPaid) : current.amountPaid;
          const payment = computeWorkshopParticipantPayment(workshop.price, amountPaid);
          workshopParticipants = workshopParticipants.map((participant) =>
            participant.id === participantId
              ? {
                  ...participant,
                  ...body,
                  amountPaid,
                  amountDue: payment.amountDue,
                  paymentStatus: payment.paymentStatus,
                  status,
                  updatedAt: new Date().toISOString(),
                } as WorkshopParticipant
              : participant,
          );
          return json(res, 200, workshopParticipants.find((participant) => participant.id === participantId));
        }
        if (workshopParticipantMatch && method === "DELETE") {
          const workshopId = workshopParticipantMatch[1];
          const participantId = workshopParticipantMatch[2];
          const current = workshopParticipants.find((participant) => participant.id === participantId && participant.workshopId === workshopId);
          if (!current) return json(res, 404, { error: "Workshop participant not found" });
          workshopParticipants = workshopParticipants.filter((participant) => participant.id !== participantId);
          return json(res, 204);
        }

        if (path === "/reservations" && method === "GET") {
          const search = url.searchParams.get("search")?.toLowerCase();
          const status = url.searchParams.get("status");
          const serviceType = url.searchParams.get("serviceType");
          const result = reservations
            .map(formatReservation)
            .filter((r) => !search || r.customerName.toLowerCase().includes(search) || r.phone.includes(search))
            .filter((r) => !status || r.paymentStatus === status)
            .filter((r) => !serviceType || r.serviceType === serviceType)
            .sort((a, b) => a.eventDate.localeCompare(b.eventDate));
          return json(res, 200, result);
        }

        if (path === "/reservations" && method === "POST") {
          const body = await readBody(req);
          const reservation = {
            ...(body as Omit<Reservation, "id" | "createdAt" | "updatedAt">),
            id: nextReservationId++,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          } as Reservation;
          reservations.push(reservation);
          const defaultTasks = DEFAULT_TASKS_BY_PACK[reservation.pack] ?? [];
          for (const [index, title] of defaultTasks.entries()) {
            tasks.push({
              id: nextTaskId++,
              reservationId: reservation.id,
              title,
              completed: false,
              sortOrder: index + 1,
              createdAt: new Date().toISOString(),
            });
          }
          return json(res, 201, formatReservation(reservation));
        }

        const reservationMatch = path.match(/^\/reservations\/(\d+)$/);
        if (reservationMatch && method === "PATCH") {
          const id = Number(reservationMatch[1]);
          const body = await readBody(req);
          reservations = reservations.map((r) => (r.id === id ? { ...r, ...body, updatedAt: new Date().toISOString() } : r));
          return json(res, 200, formatReservation(reservations.find((r) => r.id === id)!));
        }
        if (reservationMatch && method === "DELETE") {
          const id = Number(reservationMatch[1]);
          reservations = reservations.filter((r) => r.id !== id);
          tasks = tasks.filter((t) => t.reservationId !== id);
          return json(res, 204);
        }

        const listTasksMatch = path.match(/^\/reservations\/(\d+)\/tasks$/);
        if (listTasksMatch && method === "GET") {
          const reservationId = Number(listTasksMatch[1]);
          return json(res, 200, tasks.filter((t) => t.reservationId === reservationId).sort((a, b) => a.sortOrder - b.sortOrder));
        }
        if (listTasksMatch && method === "POST") {
          const reservationId = Number(listTasksMatch[1]);
          const body = await readBody(req);
          const task: Task = {
            id: nextTaskId++,
            reservationId,
            title: String(body.title ?? "Nova tarefa"),
            completed: false,
            sortOrder: tasks.filter((t) => t.reservationId === reservationId).length + 1,
            createdAt: new Date().toISOString(),
          };
          tasks.push(task);
          return json(res, 201, task);
        }

        if (path === "/tasks/summary") {
          const ids = String(url.searchParams.get("reservationIds") ?? "")
            .split(",")
            .map(Number)
            .filter(Boolean);
          return json(res, 200, ids.map((reservationId) => {
            const items = tasks.filter((t) => t.reservationId === reservationId);
            return { reservationId, total: items.length, completed: items.filter((t) => t.completed).length };
          }));
        }

        const taskMatch = path.match(/^\/tasks\/(\d+)$/);
        if (taskMatch && method === "PATCH") {
          const taskId = Number(taskMatch[1]);
          const body = await readBody(req);
          tasks = tasks.map((t) => (t.id === taskId ? { ...t, ...body } : t));
          return json(res, 200, tasks.find((t) => t.id === taskId));
        }
        if (taskMatch && method === "DELETE") {
          const taskId = Number(taskMatch[1]);
          tasks = tasks.filter((t) => t.id !== taskId);
          return json(res, 204);
        }

          return json(res, 404, { error: "Not found" });
        } catch (error) {
          console.error("[girafinha-dev-api] Request failed", {
            method: req.method,
            url: req.url,
            error,
          });
          return json(res, 500, {
            error: "Local dev API request failed",
            message: errorMessage(error),
          });
        }
      });
    },
  };
}
