import type {
  EventPaymentMethod,
  EventPaymentModule,
  FinancialMovement,
} from "@workspace/api-client-react";

export type MovementPeriodMode = "this_month" | "previous_month" | "all" | "custom";
export type MovementMethodFilter = EventPaymentMethod | "all";
export type MovementOriginFilter = EventPaymentModule | "all";
export type MovementReconciliationFilter = "all" | "pending" | "reconciled";

export type FinancialMovementFilters = {
  search: string;
  periodMode: MovementPeriodMode;
  customStart: string;
  customEnd: string;
  method: MovementMethodFilter;
  origin: MovementOriginFilter;
  reconciliation: MovementReconciliationFilter;
};

const PORTUGAL_TIME_ZONE = "Europe/Lisbon";

export function normalizeFinancialMovementSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-PT");
}

export function lisbonDateKey(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: PORTUGAL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function yearMonthAtOffset(now: Date, monthOffset: number) {
  const current = lisbonDateKey(now);
  const [year, month] = current.slice(0, 7).split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1 + monthOffset, 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthRange(yearMonth: string) {
  const [year, month] = yearMonth.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    startDate: `${yearMonth}-01`,
    endDate: `${yearMonth}-${String(lastDay).padStart(2, "0")}`,
  };
}

export function financialMovementPeriodRange(
  mode: MovementPeriodMode,
  now = new Date(),
  customStart = "",
  customEnd = "",
) {
  if (mode === "all") return null;
  if (mode === "custom") {
    return {
      startDate: customStart || null,
      endDate: customEnd || null,
    };
  }
  return monthRange(yearMonthAtOffset(now, mode === "previous_month" ? -1 : 0));
}

function matchesCommonFilters(
  movement: FinancialMovement,
  filters: FinancialMovementFilters,
) {
  if (filters.method !== "all" && movement.paymentMethod !== filters.method) return false;
  if (filters.origin !== "all" && movement.module !== filters.origin) return false;

  const search = normalizeFinancialMovementSearch(filters.search);
  if (!search) return true;
  const haystack = normalizeFinancialMovementSearch(
    `${movement.customerName} ${movement.birthdayChildName ?? ""}`,
  );
  return haystack.includes(search);
}

export function filterFinancialMovements(
  movements: FinancialMovement[],
  filters: FinancialMovementFilters,
  now = new Date(),
) {
  const range = financialMovementPeriodRange(
    filters.periodMode,
    now,
    filters.customStart,
    filters.customEnd,
  );

  return movements.filter((movement) => {
    if (!movement.paidAt || !matchesCommonFilters(movement, filters)) return false;
    if (filters.reconciliation === "pending" && movement.reconciledAt !== null) return false;
    if (filters.reconciliation === "reconciled" && movement.reconciledAt === null) return false;
    if (!range) return true;
    const paymentDate = lisbonDateKey(movement.paidAt);
    if (range.startDate && paymentDate < range.startDate) return false;
    if (range.endDate && paymentDate > range.endDate) return false;
    return true;
  });
}

export function filterUndatedFinancialMovements(
  movements: FinancialMovement[],
  filters: FinancialMovementFilters,
) {
  return movements.filter((movement) => matchesCommonFilters(movement, filters));
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function summarizeFinancialMovements(movements: FinancialMovement[]) {
  const reconciled = movements.filter((movement) => movement.reconciledAt !== null);
  const pending = movements.filter((movement) => movement.reconciledAt === null);

  return {
    received: roundMoney(movements.reduce((sum, movement) => sum + movement.amount, 0)),
    count: movements.length,
    pending: {
      amount: roundMoney(pending.reduce((sum, movement) => sum + movement.amount, 0)),
      count: pending.length,
    },
    reconciled: {
      amount: roundMoney(reconciled.reduce((sum, movement) => sum + movement.amount, 0)),
      count: reconciled.length,
    },
  };
}
