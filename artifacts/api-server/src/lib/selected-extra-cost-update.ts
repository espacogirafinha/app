import { selectedExtraCostPatch } from "./selected-extra-cost";

export type SelectedExtraCostRecord = {
  id: string;
  quantity: number;
};

export type SelectedExtraCostValues = {
  unitCost: number | null;
  totalCost: number | null;
};

export async function updateSelectedExtraCostSnapshot<T extends SelectedExtraCostRecord>(
  id: string,
  unitCost: number | null,
  load: (id: string) => Promise<T | null>,
  persist: (id: string, values: SelectedExtraCostValues) => Promise<T>,
) {
  const existing = await load(id);
  if (!existing) return null;

  const values = selectedExtraCostPatch(existing.quantity, unitCost);
  return persist(id, values);
}
