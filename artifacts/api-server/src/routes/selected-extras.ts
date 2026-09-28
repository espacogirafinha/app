import { Router, type IRouter } from "express";
import { and, asc, eq } from "drizzle-orm";
import { db, eventSelectedExtrasTable } from "@workspace/db";
import {
  ListSelectedExtrasQueryParams,
  ReplaceSelectedExtrasBody,
  UpdateSelectedExtraCostBody,
  UpdateSelectedExtraCostParams,
} from "@workspace/api-zod";
import { updateSelectedExtraCostSnapshot } from "../lib/selected-extra-cost-update";

const router: IRouter = Router();

type SelectedExtraRow = typeof eventSelectedExtrasTable.$inferSelect;

function money(value: unknown) {
  return Number.parseFloat(String(value ?? 0));
}

function moneyOrNull(value: unknown) {
  return value === null || value === undefined ? null : Number.parseFloat(String(value));
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function iso(value: Date | null | undefined) {
  return value?.toISOString() ?? new Date().toISOString();
}

function formatSelectedExtra(row: SelectedExtraRow) {
  return {
    id: row.id,
    module: row.module,
    entityId: row.entityId,
    extraId: row.extraId,
    extraName: row.extraName,
    category: row.category,
    unitPrice: money(row.unitPrice),
    unitCost: moneyOrNull(row.unitCost),
    quantity: row.quantity,
    totalPrice: money(row.totalPrice),
    totalCost: moneyOrNull(row.totalCost),
    notes: row.notes,
    sortOrder: row.sortOrder,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

router.get("/selected-extras", async (req, res): Promise<void> => {
  const parsed = ListSelectedExtrasQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const rows = await db
    .select()
    .from(eventSelectedExtrasTable)
    .where(and(
      eq(eventSelectedExtrasTable.module, parsed.data.module),
      eq(eventSelectedExtrasTable.entityId, parsed.data.entityId),
    ))
    .orderBy(asc(eventSelectedExtrasTable.sortOrder), asc(eventSelectedExtrasTable.extraName));

  res.json(rows.map(formatSelectedExtra));
});

router.patch("/selected-extras/:id", async (req, res): Promise<void> => {
  const params = UpdateSelectedExtraCostParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = UpdateSelectedExtraCostBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const updated = await updateSelectedExtraCostSnapshot(
    params.data.id,
    body.data.unitCost,
    async (id) => {
      const [existing] = await db
        .select()
        .from(eventSelectedExtrasTable)
        .where(eq(eventSelectedExtrasTable.id, id))
        .limit(1);
      return existing ?? null;
    },
    async (id, values) => {
      const [row] = await db
        .update(eventSelectedExtrasTable)
        .set({
          unitCost: values.unitCost === null ? null : String(values.unitCost),
          totalCost: values.totalCost === null ? null : String(values.totalCost),
          updatedAt: new Date(),
        })
        .where(eq(eventSelectedExtrasTable.id, id))
        .returning();
      return row;
    },
  );

  if (!updated) {
    res.status(404).json({ error: "Selected extra not found" });
    return;
  }

  res.json(formatSelectedExtra(updated));
});

router.post("/selected-extras", async (req, res): Promise<void> => {
  const parsed = ReplaceSelectedExtrasBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { module, entityId, items } = parsed.data;
  const rows = await db.transaction(async (tx) => {
    await tx
      .delete(eventSelectedExtrasTable)
      .where(and(
        eq(eventSelectedExtrasTable.module, module),
        eq(eventSelectedExtrasTable.entityId, entityId),
      ));

    if (items.length === 0) return [];

    return tx
      .insert(eventSelectedExtrasTable)
      .values(items.map((item, index) => {
        const quantity = item.quantity;
        const unitPrice = roundMoney(item.unitPrice);
        const unitCost = item.unitCost === null || item.unitCost === undefined
          ? null
          : roundMoney(item.unitCost);

        return {
          module,
          entityId,
          extraId: item.extraId ?? null,
          extraName: item.extraName,
          category: item.category ?? null,
          unitPrice: String(unitPrice),
          unitCost: unitCost === null ? null : String(unitCost),
          quantity,
          totalPrice: String(roundMoney(quantity * unitPrice)),
          totalCost: unitCost === null ? null : String(roundMoney(quantity * unitCost)),
          notes: item.notes ?? null,
          sortOrder: item.sortOrder ?? index,
        };
      }))
      .returning();
  });

  res.json(rows.map(formatSelectedExtra));
});

export default router;
