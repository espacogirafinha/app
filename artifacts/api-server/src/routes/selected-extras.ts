import { Router, type IRouter } from "express";
import { and, asc, eq } from "drizzle-orm";
import { db, eventSelectedExtrasTable } from "@workspace/db";
import { ListSelectedExtrasQueryParams, ReplaceSelectedExtrasBody } from "@workspace/api-zod";

const router: IRouter = Router();

type SelectedExtraRow = typeof eventSelectedExtrasTable.$inferSelect;

function money(value: unknown) {
  return Number.parseFloat(String(value ?? 0));
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
    quantity: row.quantity,
    totalPrice: money(row.totalPrice),
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
      .values(items.map((item, index) => ({
        module,
        entityId,
        extraId: item.extraId ?? null,
        extraName: item.extraName,
        category: item.category ?? null,
        unitPrice: String(item.unitPrice),
        quantity: item.quantity,
        totalPrice: String(item.totalPrice),
        notes: item.notes ?? null,
        sortOrder: item.sortOrder ?? index,
      })))
      .returning();
  });

  res.json(rows.map(formatSelectedExtra));
});

export default router;
