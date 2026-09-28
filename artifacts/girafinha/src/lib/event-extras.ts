import type { SelectedExtraInput } from "@workspace/api-client-react";

export type EventExtraDraft = SelectedExtraInput & {
  localId: string;
  custom: boolean;
};

const roundMoney = (value: number) => Math.round(value * 100) / 100;

export function calculateExtraLine(input: {
  quantity: number;
  unitPrice: number;
  unitCost?: number | null;
}) {
  const quantity = Math.max(1, Number(input.quantity) || 1);
  const unitPrice = Math.max(0, Number(input.unitPrice) || 0);
  const unitCost = input.unitCost === null || input.unitCost === undefined
    ? null
    : Math.max(0, Number(input.unitCost) || 0);
  const totalPrice = roundMoney(quantity * unitPrice);
  const totalCost = unitCost === null ? null : roundMoney(quantity * unitCost);
  return {
    quantity,
    unitPrice,
    unitCost,
    totalPrice,
    totalCost,
    margin: totalCost === null ? null : roundMoney(totalPrice - totalCost),
  };
}

export function toEventExtraDrafts(
  extras?: SelectedExtraInput[],
): EventExtraDraft[] {
  return (extras ?? []).map((extra, index) => ({
    ...extra,
    unitCost: extra.unitCost ?? null,
    totalCost: extra.totalCost ?? null,
    localId: extra.extraId ? `${extra.extraId}-${index}` : `snapshot-${index}`,
    custom: !extra.extraId,
  }));
}

export function appendEventExtraDraft(
  extras: EventExtraDraft[],
  extra: EventExtraDraft,
) {
  if (extra.extraId && extras.some((selected) => selected.extraId === extra.extraId)) {
    return extras;
  }
  return [...extras, { ...extra, sortOrder: extras.length + 1 }];
}

export function removeEventExtraDraft(
  extras: EventExtraDraft[],
  localId: string,
) {
  return extras
    .filter((extra) => extra.localId !== localId)
    .map((extra, index) => ({ ...extra, sortOrder: index + 1 }));
}

export function toSelectedExtraInputs(
  extras: EventExtraDraft[],
): SelectedExtraInput[] {
  return extras
    .filter((extra) => extra.extraName.trim())
    .map(({ localId: _localId, custom: _custom, ...extra }, index) => {
      const line = calculateExtraLine(extra);
      return {
        ...extra,
        extraName: extra.extraName.trim(),
        category: extra.category?.trim() || null,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        unitCost: line.unitCost,
        totalPrice: line.totalPrice,
        totalCost: line.totalCost,
        sortOrder: index + 1,
      };
    });
}

export function calculateExtrasTotal(extras: SelectedExtraInput[]) {
  return roundMoney(extras.reduce((sum, extra) => sum + Number(extra.totalPrice ?? 0), 0));
}
