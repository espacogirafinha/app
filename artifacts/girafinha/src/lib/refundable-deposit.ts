import type { RefundableDepositStatus } from "@workspace/api-client-react";

export const REFUNDABLE_DEPOSIT_LABELS: Record<RefundableDepositStatus, string> = {
  not_required: "Não aplicável",
  pending: "Por receber",
  held: "Em posse",
  returned: "Devolvida",
  retained: "Retida",
};

export type RefundableDepositDates = {
  status: RefundableDepositStatus;
  receivedAt: string | null;
  returnedAt: string | null;
};

export function changeRefundableDepositStatus(
  current: RefundableDepositDates,
  status: RefundableDepositStatus,
  now = new Date().toISOString(),
): RefundableDepositDates {
  return {
    status,
    receivedAt: status === "not_required" ? null : current.receivedAt,
    returnedAt: status === "returned" ? current.returnedAt ?? now : null,
  };
}

export function markRefundableDepositReceivedNow(
  current: RefundableDepositDates,
  now = new Date().toISOString(),
): RefundableDepositDates {
  return {
    ...current,
    status: "held",
    receivedAt: current.receivedAt ?? now,
    returnedAt: null,
  };
}

export function shouldShowRefundableDeposit(amount: number, status: RefundableDepositStatus) {
  return amount > 0 && status !== "not_required";
}

export function shouldHighlightHeldRefundableDeposit(amount: number, status: RefundableDepositStatus) {
  return amount > 0 && status === "held";
}
