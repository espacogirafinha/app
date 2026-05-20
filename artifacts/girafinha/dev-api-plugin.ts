import type { IncomingMessage, ServerResponse } from "node:http";
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

const ADMIN_EMAIL = "admin@espacogirafinha.pt";
const ADMIN_PASSWORD = "girafinha2026";
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
          if (!isAuthed(req)) return json(res, 401, { error: "Não autenticado" });
          return json(res, 200, { email: ADMIN_EMAIL });
        }

        if (path === "/auth/login" && method === "POST") {
          const body = await readBody(req);
          const email = String(body.email ?? "").trim().toLowerCase();
          const password = String(body.password ?? "");
          if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
            return json(res, 401, { error: "Credenciais inválidas" });
          }
          res.setHeader("Set-Cookie", `${SESSION_COOKIE}=1; Path=/; SameSite=Lax`);
          return json(res, 200, { email: ADMIN_EMAIL });
        }

        if (path === "/auth/logout" && method === "POST") {
          res.setHeader("Set-Cookie", `${SESSION_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`);
          return json(res, 204);
        }

        if (path === "/healthz") return json(res, 200, { ok: true });
        if (!(await requireAuth(req, res))) return;

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
