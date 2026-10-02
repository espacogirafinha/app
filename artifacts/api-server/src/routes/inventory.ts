import { Router, type IRouter } from "express";
import {
  and,
  asc,
  desc,
  eq,
  ilike,
  isNotNull,
  or,
  sql,
} from "drizzle-orm";
import {
  db,
  inventoryItemsTable,
  inventoryMovementsTable,
} from "@workspace/db";
import {
  CreateInventoryItemBody,
  CreateInventoryMovementBody,
  CreateInventoryMovementParams,
  ListInventoryItemsQueryParams,
  ListInventoryMovementsParams,
  UpdateInventoryItemBody,
  UpdateInventoryItemParams,
} from "@workspace/api-zod";
import {
  calculateInventoryMovement,
  InventoryStockError,
} from "../lib/inventory-stock";

const router: IRouter = Router();

function numberValue(value: unknown) {
  return Number.parseFloat(String(value ?? 0));
}

function nullableText(value: string | null | undefined) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function itemResponse(row: typeof inventoryItemsTable.$inferSelect) {
  const quantityCurrent = numberValue(row.quantityCurrent);
  const minimumStock = row.minimumStock === null ? null : numberValue(row.minimumStock);
  return {
    id: row.id,
    itemType: row.itemType as "consumable" | "material",
    name: row.name,
    category: row.category,
    quantityCurrent,
    unit: row.unit,
    minimumStock,
    unitCost: row.unitCost === null ? null : numberValue(row.unitCost),
    photoPath: row.photoPath,
    color: row.color,
    theme: row.theme,
    location: row.location,
    condition: row.condition,
    purchaseCost: row.purchaseCost === null ? null : numberValue(row.purchaseCost),
    notes: row.notes,
    isActive: row.isActive,
    isLowStock: minimumStock !== null && quantityCurrent <= minimumStock,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function movementResponse(row: typeof inventoryMovementsTable.$inferSelect) {
  return {
    id: row.id,
    itemId: row.itemId,
    movementType: row.movementType as "entry" | "exit" | "adjustment",
    quantityDelta: numberValue(row.quantityDelta),
    quantityBefore: numberValue(row.quantityBefore),
    quantityAfter: numberValue(row.quantityAfter),
    occurredAt: row.occurredAt.toISOString(),
    reason: row.reason,
    createdAt: row.createdAt.toISOString(),
  };
}

function validPhotoPath(itemId: string, path: string) {
  return path.startsWith(`material/${itemId}/`) && !path.includes("..");
}

function booleanQuery(value: unknown) {
  if (value === "true" || value === true) return true;
  if (value === "false" || value === false) return false;
  return value;
}

router.get("/inventory/items", async (req, res): Promise<void> => {
  const parsed = ListInventoryItemsQueryParams.safeParse({
    ...req.query,
    active: booleanQuery(req.query.active),
    lowStock: booleanQuery(req.query.lowStock),
  });
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const conditions = [];
  if (parsed.data.itemType) conditions.push(eq(inventoryItemsTable.itemType, parsed.data.itemType));
  if (parsed.data.category?.trim()) conditions.push(eq(inventoryItemsTable.category, parsed.data.category.trim()));
  if (parsed.data.location?.trim()) conditions.push(eq(inventoryItemsTable.location, parsed.data.location.trim()));
  if (parsed.data.condition) conditions.push(eq(inventoryItemsTable.condition, parsed.data.condition));
  if (parsed.data.active !== undefined) conditions.push(eq(inventoryItemsTable.isActive, parsed.data.active));
  if (parsed.data.lowStock) {
    conditions.push(isNotNull(inventoryItemsTable.minimumStock));
    conditions.push(sql`${inventoryItemsTable.quantityCurrent} <= ${inventoryItemsTable.minimumStock}`);
  }
  if (parsed.data.search?.trim()) {
    const search = `%${parsed.data.search.trim()}%`;
    conditions.push(or(
      ilike(inventoryItemsTable.name, search),
      ilike(inventoryItemsTable.theme, search),
    )!);
  }

  const rows = await db
    .select()
    .from(inventoryItemsTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(asc(inventoryItemsTable.name), asc(inventoryItemsTable.id));

  res.json(rows.map(itemResponse));
});

router.post("/inventory/items", async (req, res): Promise<void> => {
  const parsed = CreateInventoryItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const data = parsed.data;
  const initialQuantity = data.quantity ?? 0;

  if (data.itemType === "consumable" && data.photoPath) {
    res.status(400).json({ error: "Consumables do not support photos" });
    return;
  }

  const created = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(inventoryItemsTable)
      .values({
        itemType: data.itemType,
        name: data.name.trim(),
        category: data.category.trim(),
        quantityCurrent: String(initialQuantity),
        unit: data.unit,
        minimumStock: data.minimumStock == null ? null : String(data.minimumStock),
        unitCost: data.unitCost == null ? null : String(data.unitCost),
        photoPath: null,
        color: nullableText(data.color),
        theme: nullableText(data.theme),
        location: nullableText(data.location),
        condition: data.condition ?? null,
        purchaseCost: data.purchaseCost == null ? null : String(data.purchaseCost),
        notes: nullableText(data.notes),
        isActive: data.isActive ?? true,
      })
      .returning();

    if (initialQuantity > 0) {
      await tx.insert(inventoryMovementsTable).values({
        itemId: row.id,
        movementType: "adjustment",
        quantityDelta: String(initialQuantity),
        quantityBefore: "0",
        quantityAfter: String(initialQuantity),
        reason: "Stock inicial",
      });
    }

    return row;
  });

  res.status(201).json(itemResponse(created));
});

router.patch("/inventory/items/:id", async (req, res): Promise<void> => {
  const params = UpdateInventoryItemParams.safeParse(req.params);
  const body = UpdateInventoryItemBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(inventoryItemsTable)
    .where(eq(inventoryItemsTable.id, params.data.id))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "Inventory item not found" });
    return;
  }

  if (body.data.photoPath !== undefined && body.data.photoPath !== null) {
    if (existing.itemType !== "material" || !validPhotoPath(existing.id, body.data.photoPath)) {
      res.status(400).json({ error: "Invalid inventory image path" });
      return;
    }
  }

  const update: Partial<typeof inventoryItemsTable.$inferInsert> = {};
  if (body.data.name !== undefined) update.name = body.data.name.trim();
  if (body.data.category !== undefined) update.category = body.data.category.trim();
  if (body.data.unit !== undefined) update.unit = body.data.unit;
  if (body.data.minimumStock !== undefined) update.minimumStock = body.data.minimumStock === null ? null : String(body.data.minimumStock);
  if (body.data.unitCost !== undefined) update.unitCost = body.data.unitCost === null ? null : String(body.data.unitCost);
  if (body.data.photoPath !== undefined) update.photoPath = body.data.photoPath;
  if (body.data.color !== undefined) update.color = nullableText(body.data.color);
  if (body.data.theme !== undefined) update.theme = nullableText(body.data.theme);
  if (body.data.location !== undefined) update.location = nullableText(body.data.location);
  if (body.data.condition !== undefined) update.condition = body.data.condition;
  if (body.data.purchaseCost !== undefined) update.purchaseCost = body.data.purchaseCost === null ? null : String(body.data.purchaseCost);
  if (body.data.notes !== undefined) update.notes = nullableText(body.data.notes);
  if (body.data.isActive !== undefined) update.isActive = body.data.isActive;

  if (Object.keys(update).length === 0) {
    res.json(itemResponse(existing));
    return;
  }

  const [updated] = await db
    .update(inventoryItemsTable)
    .set(update)
    .where(eq(inventoryItemsTable.id, existing.id))
    .returning();

  res.json(itemResponse(updated));
});

router.get("/inventory/items/:id/movements", async (req, res): Promise<void> => {
  const params = ListInventoryMovementsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [item] = await db
    .select({ id: inventoryItemsTable.id })
    .from(inventoryItemsTable)
    .where(eq(inventoryItemsTable.id, params.data.id))
    .limit(1);
  if (!item) {
    res.status(404).json({ error: "Inventory item not found" });
    return;
  }

  const rows = await db
    .select()
    .from(inventoryMovementsTable)
    .where(eq(inventoryMovementsTable.itemId, params.data.id))
    .orderBy(desc(inventoryMovementsTable.occurredAt), desc(inventoryMovementsTable.createdAt));

  res.json(rows.map(movementResponse));
});

router.post("/inventory/items/:id/movements", async (req, res): Promise<void> => {
  const params = CreateInventoryMovementParams.safeParse(req.params);
  const body = CreateInventoryMovementBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  try {
    const result = await db.transaction(async (tx) => {
      const [item] = await tx
        .select()
        .from(inventoryItemsTable)
        .where(eq(inventoryItemsTable.id, params.data.id))
        .for("update");

      if (!item) return null;

      const { quantityBefore: before, quantityDelta: delta, quantityAfter: after } =
        calculateInventoryMovement({
          currentQuantity: numberValue(item.quantityCurrent),
          movementType: body.data.movementType,
          quantity: body.data.quantity,
        });

      const [updatedItem] = await tx
        .update(inventoryItemsTable)
        .set({ quantityCurrent: String(after) })
        .where(eq(inventoryItemsTable.id, item.id))
        .returning();

      const [movement] = await tx
        .insert(inventoryMovementsTable)
        .values({
          itemId: item.id,
          movementType: body.data.movementType,
          quantityDelta: String(delta),
          quantityBefore: String(before),
          quantityAfter: String(after),
          occurredAt: body.data.occurredAt ?? new Date(),
          reason: nullableText(body.data.reason),
        })
        .returning();

      return { item: itemResponse(updatedItem), movement: movementResponse(movement) };
    });

    if (!result) {
      res.status(404).json({ error: "Inventory item not found" });
      return;
    }

    res.status(201).json(result);
  } catch (error) {
    if (error instanceof InventoryStockError) {
      res.status(409).json({ error: error.message });
      return;
    }
    throw error;
  }
});

export default router;
