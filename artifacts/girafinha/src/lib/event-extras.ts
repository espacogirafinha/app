import type { SelectedExtraInput } from "@workspace/api-client-react";

export type EventExtraDraft = SelectedExtraInput & {
  localId: string;
  custom: boolean;
};

export function toEventExtraDrafts(
  extras?: SelectedExtraInput[],
): EventExtraDraft[] {
  return (extras ?? []).map((extra, index) => ({
    ...extra,
    localId: extra.extraId ? `${extra.extraId}-${index}` : `snapshot-${index}`,
    custom: !extra.extraId,
  }));
}

export function toSelectedExtraInputs(
  extras: EventExtraDraft[],
): SelectedExtraInput[] {
  return extras
    .filter((extra) => extra.extraName.trim())
    .map(({ localId: _localId, custom: _custom, ...extra }, index) => ({
      ...extra,
      extraName: extra.extraName.trim(),
      quantity: Math.max(1, Number(extra.quantity) || 1),
      unitPrice: Math.max(0, Number(extra.unitPrice) || 0),
      totalPrice: Math.max(
        0,
        (Number(extra.quantity) || 1) * (Number(extra.unitPrice) || 0),
      ),
      sortOrder: index + 1,
    }));
}

export function calculateExtrasTotal(extras: SelectedExtraInput[]) {
  return extras.reduce((sum, extra) => sum + Number(extra.totalPrice ?? 0), 0);
}
