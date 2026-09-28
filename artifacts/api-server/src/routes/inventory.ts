import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import {
  db,
  inventoryItemsTable,
  inventoryMovementsTable,
} from "@workspace/db";
import {
  AdjustInventoryStockBody,
  CreateInventoryItemBody,
  CreateInventoryMovementBody,
  GetInventoryItemParams,
  ListInventoryItemsQueryParams,
  ListInventoryMovementsParams,
  UpdateInventoryItemBody,
  UpdateInventoryItemParams,
} from "@workspace/api-zod";
import {
  adjustmentDelta,
  calculateCurrentStock,
  inventoryStockState,
  inventorySummary,
  matchesInventorySearch,
  missingToMinimum,
  nextStockAfterDelta,
  signedMovementDelta,
} from "../lib/inventory-stock";

const router: IRouter = Router();

type ItemRow = typeof inventoryItemsTable.$inferSelect;
type MovementRow = typeof inventoryMovementsTable.$inferSelect;

function numberOrNull(value: unknown) {
  return value === null || value === undefined ? null : Number(value);
}

function formatQuantity(value: number) {
  return Number.isInteger(value)
    ? String(value)
    : value.toLocaleString("pt-PT", { maximumFractionDigits: 3 });
}

function formatMovement(row: MovementRow) {
  return {
    id: row.id,
    itemId: row.itemId,
    quantityDelta: Number(row.quantityDelta),
    reason: row.reason as
      | "initial_stock"
      | "purchase"
      | "usage"
      | "correction"
      | "damaged"
      | "lost"
      | "return",
    note: row.note,
    occurredAt: row.occurredAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

function formatItem(row: ItemRow, movements: MovementRow[]) {
  const currentStock = calculateCurrentStock(
    movements
      .filter((movement) => movement.itemId === row.id)
      .map((movement) => movement.quantityDelta),
  );
  const minimumStock = numberOrNull(row.minimumStock);

  return {
    id: row.id,
    itemType: row.itemType as "consumable" | "material",
    name: row.name,
    category: row.category,
    brand: row.brand,
    color: row.color,
    size: row.size,
    unit: row.unit,
    minimumStock,
    location: row.location,
    referenceCost: numberOrNull(row.referenceCost),
    notes: row.notes,
    isActive: row.isActive,
    currentStock,
    stockState: inventoryStockState(currentStock, minimumStock),
    missingToMinimum: missingToMinimum(currentStock, minimumStock),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function loadInventoryItems() {
  const [items, movements] = await Promise.all([
    db.select().from(inventoryItemsTable),
    db.select().from(inventoryMovementsTable),
  ]);

  return items.map((item) => formatItem(item, movements));
}

function itemPayload(body: {
  itemType?: "consumable" | "material";
  name?: string;
  category?: string | null;
  brand?: string | null;
  color?: string | null;
  size?: string | null;
  unit?: string;
  minimumStock?: number | null;
  location?: string | null;
  referenceCost?: number | null;
  notes?: string | null;
  isActive?: boolean;
}): Partial<typeof inventoryItemsTable.$inferInsert> {
  return Object.fromEntries(
    Object.entries({
      itemType: body.itemType,
      name: body.name?.trim(),
      category: body.category === undefined ? undefined : body.category?.trim() || null,
      brand: body.brand === undefined ? undefined : body.brand?.trim() || null,
      color: body.color === undefined ? undefined : body.color?.trim() || null,
      size: body.size === undefined ? undefined : body.size?.trim() || null,
      unit: body.unit?.trim(),
      minimumStock:
        body.minimumStock === undefined
          ? undefined
          : body.minimumStock === null
            ? null
            : String(body.minimumStock),
      location: body.location === undefined ? undefined : body.location?.trim() || null,
      referenceCost:
        body.referenceCost === undefined
          ? undefined
          : body.referenceCost === null
            ? null
            : String(body.referenceCost),
      notes: body.notes === undefined ? undefined : body.notes?.trim() || null,
      isActive: body.isActive,
    }).filter(([, value]) => value !== undefined),
  ) as Partial<typeof inventoryItemsTable.$inferInsert>;
}

router.get("/inventory-items", async (req, res): Promise<void> => {
  const parsed = ListInventoryItemsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { search, itemType, category, activity, stockStatus } = parsed.data;
  let items = await loadInventoryItems();

  if (activity === "inactive") {
    items = items.filter((item) => !item.isActive);
  } else if (activity !== "all") {
    items = items.filter((item) => item.isActive);
  }

  if (itemType) items = items.filter((item) => item.itemType === itemType);
  if (category) {
    const target = category.trim().toLocaleLowerCase("pt-PT");
    items = items.filter(
      (item) => item.category?.toLocaleLowerCase("pt-PT") === target,
    );
  }

  if (stockStatus === "low") {
    items = items.filter((item) => item.stockState === "low");
  } else if (stockStatus === "out") {
    items = items.filter((item) => item.stockState === "out");
  } else if (stockStatus === "to_restock") {
    items = items.filter(
      (item) =>
        item.minimumStock !== null && item.currentStock < item.minimumStock,
    );
  }

  if (search) {
    items = items.filter((item) =>
      matchesInventorySearch(
        [
          item.name,
          item.category,
          item.brand,
          item.color,
          item.size,
          item.location,
          item.notes,
        ],
        search,
      ),
    );
  }

  items.sort(
    (a, b) =>
      a.name.localeCompare(b.name, "pt-PT", { sensitivity: "base" })
      || a.id.localeCompare(b.id),
  );

  res.json(items);
});

router.get("/inventory-summary", async (_req, res): Promise<void> => {
  const items = await loadInventoryItems();
  res.json(inventorySummary(items));
});

router.post("/inventory-items", async (req, res): Promise<void> => {
  const parsed = CreateInventoryItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { initialStock = 0, ...body } = parsed.data;
  if (!body.name.trim() || !body.unit.trim()) {
    res.status(400).json({ error: "name and unit cannot be blank" });
    return;
  }

  const created = await db.transaction(async (tx) => {
    const [item] = await tx
      .insert(inventoryItemsTable)
      .values({
        itemType: body.itemType,
        name: body.name.trim(),
        category: body.category?.trim() || null,
        brand: body.brand?.trim() || null,
        color: body.color?.trim() || null,
        size: body.size?.trim() || null,
        unit: body.unit.trim(),
        minimumStock: body.minimumStock === null || body.minimumStock === undefined ? null : String(body.minimumStock),
        location: body.location?.trim() || null,
        referenceCost: body.referenceCost === null || body.referenceCost === undefined ? null : String(body.referenceCost),
        notes: body.notes?.trim() || null,
        isActive: body.isActive ?? true,
      })
      .returning();

    if (initialStock > 0) {
      await tx.insert(inventoryMovementsTable).values({
        itemId: item.id,
        quantityDelta: String(initialStock),
        reason: "initial_stock",
        note: "Stock inicial",
      });
    }

    return item;
  });

  const movements = await db
    .select()
    .from(inventoryMovementsTable)
    .where(eq(inventoryMovementsTable.itemId, created.id));

  res.status(201).json(formatItem(created, movements));
});

router.get("/inventory-items/:id", async (req, res): Promise<void> => {
  const params = GetInventoryItemParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [item] = await db
    .select()
    .from(inventoryItemsTable)
    .where(eq(inventoryItemsTable.id, params.data.id));

  if (!item) {
    res.status(404).json({ error: "Inventory item not found" });
    return;
  }

  const movements = await db
    .select()
    .from(inventoryMovementsTable)
    .where(eq(inventoryMovementsTable.itemId, item.id));

  res.json(formatItem(item, movements));
});

router.patch("/inventory-items/:id", async (req, res): Promise<void> => {
  const params = UpdateInventoryItemParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateInventoryItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  if (
    (parsed.data.name !== undefined && !parsed.data.name.trim())
    || (parsed.data.unit !== undefined && !parsed.data.unit.trim())
  ) {
    res.status(400).json({ error: "name and unit cannot be blank" });
    return;
  }

  const [updated] = await db
    .update(inventoryItemsTable)
    .set(itemPayload(parsed.data))
    .where(eq(inventoryItemsTable.id, params.data.id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Inventory item not found" });
    return;
  }

  const movements = await db
    .select()
    .from(inventoryMovementsTable)
    .where(eq(inventoryMovementsTable.itemId, updated.id));

  res.json(formatItem(updated, movements));
});

router.get("/inventory-items/:id/movements", async (req, res): Promise<void> => {
  const params = ListInventoryMovementsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const rows = await db
    .select()
    .from(inventoryMovementsTable)
    .where(eq(inventoryMovementsTable.itemId, params.data.id))
    .orderBy(
      desc(inventoryMovementsTable.occurredAt),
      desc(inventoryMovementsTable.createdAt),
    );

  res.json(rows.map(formatMovement));
});

router.post("/inventory-items/:id/movements", async (req, res): Promise<void> => {
  const params = ListInventoryMovementsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = CreateInventoryMovementBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const result = await db.transaction(async (tx) => {
    const [item] = await tx
      .select()
      .from(inventoryItemsTable)
      .where(eq(inventoryItemsTable.id, params.data.id))
      .for("update");

    if (!item) return { status: 404 as const, error: "Inventory item not found" };

    const rows = await tx
      .select()
      .from(inventoryMovementsTable)
      .where(eq(inventoryMovementsTable.itemId, item.id));

    const currentStock = calculateCurrentStock(rows.map((row) => row.quantityDelta));
    const delta = signedMovementDelta(parsed.data.direction, parsed.data.quantity);

    let nextStock: number;
    try {
      nextStock = nextStockAfterDelta(currentStock, delta);
    } catch (error) {
      if (
        error instanceof Error
        && error.message === "inventory_insufficient_stock"
      ) {
        return {
          status: 409 as const,
          error: `Só existem ${formatQuantity(currentStock)} ${item.unit} em stock.`,
        };
      }
      throw error;
    }

    const [movement] = await tx
      .insert(inventoryMovementsTable)
      .values({
        itemId: item.id,
        quantityDelta: String(delta),
        reason: parsed.data.reason,
        note: parsed.data.note?.trim() || null,
        occurredAt: parsed.data.occurredAt
          ? new Date(parsed.data.occurredAt)
          : new Date(),
      })
      .returning();

    return { status: 201 as const, item, movement, nextStock };
  });

  if (result.status !== 201) {
    res.status(result.status).json({ error: result.error });
    return;
  }

  const minimumStock = numberOrNull(result.item.minimumStock);
  res.status(201).json({
    movement: formatMovement(result.movement),
    currentStock: result.nextStock,
    stockState: inventoryStockState(result.nextStock, minimumStock),
    missingToMinimum: missingToMinimum(result.nextStock, minimumStock),
  });
});

router.post("/inventory-items/:id/adjust-stock", async (req, res): Promise<void> => {
  const params = GetInventoryItemParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = AdjustInventoryStockBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const result = await db.transaction(async (tx) => {
    const [item] = await tx
      .select()
      .from(inventoryItemsTable)
      .where(eq(inventoryItemsTable.id, params.data.id))
      .for("update");

    if (!item) return { status: 404 as const, error: "Inventory item not found" };

    const rows = await tx
      .select()
      .from(inventoryMovementsTable)
      .where(eq(inventoryMovementsTable.itemId, item.id));

    const currentStock = calculateCurrentStock(rows.map((row) => row.quantityDelta));
    const delta = adjustmentDelta(currentStock, parsed.data.stock);

    if (delta === 0) {
      return {
        status: 409 as const,
        error: "O stock indicado já corresponde ao stock atual.",
      };
    }

    const [movement] = await tx
      .insert(inventoryMovementsTable)
      .values({
        itemId: item.id,
        quantityDelta: String(delta),
        reason: "correction",
        note: parsed.data.note?.trim() || "Ajuste de stock",
        occurredAt: parsed.data.occurredAt
          ? new Date(parsed.data.occurredAt)
          : new Date(),
      })
      .returning();

    return {
      status: 201 as const,
      item,
      movement,
      nextStock: parsed.data.stock,
    };
  });

  if (result.status !== 201) {
    res.status(result.status).json({ error: result.error });
    return;
  }

  const minimumStock = numberOrNull(result.item.minimumStock);
  res.status(201).json({
    movement: formatMovement(result.movement),
    currentStock: result.nextStock,
    stockState: inventoryStockState(result.nextStock, minimumStock),
    missingToMinimum: missingToMinimum(result.nextStock, minimumStock),
  });
});

export default router;
