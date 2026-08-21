export const refundableDepositStatuses = ["not_required", "pending", "held", "returned", "retained"] as const;

export type RefundableDepositStatus = (typeof refundableDepositStatuses)[number];

type RefundableDepositInput = {
  refundableDepositAmount?: number;
  refundableDepositStatus?: RefundableDepositStatus;
  refundableDepositReceivedAt?: string | Date | null;
  refundableDepositReturnedAt?: string | Date | null;
  refundableDepositNotes?: string | null;
};

export function refundableDepositCreateValues(input: RefundableDepositInput) {
  return {
    refundableDepositAmount: moneyValue(input.refundableDepositAmount ?? 0),
    refundableDepositStatus: input.refundableDepositStatus ?? "not_required",
    refundableDepositReceivedAt: nullableDate(input.refundableDepositReceivedAt ?? null),
    refundableDepositReturnedAt: nullableDate(input.refundableDepositReturnedAt ?? null),
    refundableDepositNotes: input.refundableDepositNotes ?? null,
  };
}

export function refundableDepositUpdateValues(input: RefundableDepositInput) {
  const values: Record<string, unknown> = {};

  if (input.refundableDepositAmount !== undefined) {
    values.refundableDepositAmount = moneyValue(input.refundableDepositAmount);
  }
  if (input.refundableDepositStatus !== undefined) {
    values.refundableDepositStatus = input.refundableDepositStatus;
  }
  if (input.refundableDepositReceivedAt !== undefined) {
    values.refundableDepositReceivedAt = nullableDate(input.refundableDepositReceivedAt);
  }
  if (input.refundableDepositReturnedAt !== undefined) {
    values.refundableDepositReturnedAt = nullableDate(input.refundableDepositReturnedAt);
  }
  if (input.refundableDepositNotes !== undefined) {
    values.refundableDepositNotes = input.refundableDepositNotes;
  }

  return values;
}

function moneyValue(value: number) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("Refundable deposit amount must be a non-negative number");
  }
  return String(value);
}

function nullableDate(value: string | Date | null) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid refundable deposit timestamp");
  }
  return date;
}
