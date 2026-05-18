import { Router, type IRouter } from "express";
import { eq, asc, inArray, sql } from "drizzle-orm";
import { db, tasksTable, reservationsTable } from "@workspace/db";
import {
  ListTasksParams,
  CreateTaskParams,
  CreateTaskBody,
  UpdateTaskParams,
  UpdateTaskBody,
  DeleteTaskParams,
  GetTasksSummaryQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function formatTask(t: typeof tasksTable.$inferSelect) {
  return {
    id: t.id,
    reservationId: t.reservationId,
    title: t.title,
    completed: t.completed,
    sortOrder: t.sortOrder,
    createdAt: t.createdAt.toISOString(),
  };
}

router.get("/reservations/:id/tasks", async (req, res): Promise<void> => {
  const params = ListTasksParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const rows = await db
    .select()
    .from(tasksTable)
    .where(eq(tasksTable.reservationId, params.data.id))
    .orderBy(asc(tasksTable.completed), asc(tasksTable.sortOrder), asc(tasksTable.id));

  res.json(rows.map(formatTask));
});

router.post("/reservations/:id/tasks", async (req, res): Promise<void> => {
  const params = CreateTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = CreateTaskBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [reservation] = await db
    .select({ id: reservationsTable.id })
    .from(reservationsTable)
    .where(eq(reservationsTable.id, params.data.id));

  if (!reservation) {
    res.status(404).json({ error: "Reservation not found" });
    return;
  }

  const [maxRow] = await db
    .select({ max: sql<number>`coalesce(max(${tasksTable.sortOrder}), 0)` })
    .from(tasksTable)
    .where(eq(tasksTable.reservationId, params.data.id));

  const nextOrder = (maxRow?.max ?? 0) + 1;

  const [row] = await db
    .insert(tasksTable)
    .values({
      reservationId: params.data.id,
      title: body.data.title,
      sortOrder: nextOrder,
    })
    .returning();

  res.status(201).json(formatTask(row));
});

router.patch("/tasks/:taskId", async (req, res): Promise<void> => {
  const params = UpdateTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = UpdateTaskBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const updateData: Record<string, unknown> = {};
  if (body.data.title !== undefined) updateData.title = body.data.title;
  if (body.data.completed !== undefined) updateData.completed = body.data.completed;

  if (Object.keys(updateData).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }

  const [row] = await db
    .update(tasksTable)
    .set(updateData)
    .where(eq(tasksTable.id, params.data.taskId))
    .returning();

  if (!row) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  res.json(formatTask(row));
});

router.delete("/tasks/:taskId", async (req, res): Promise<void> => {
  const params = DeleteTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [row] = await db
    .delete(tasksTable)
    .where(eq(tasksTable.id, params.data.taskId))
    .returning();

  if (!row) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  res.sendStatus(204);
});

router.get("/tasks/summary", async (req, res): Promise<void> => {
  const parsed = GetTasksSummaryQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const ids = parsed.data.reservationIds
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n));

  if (ids.length === 0) {
    res.json([]);
    return;
  }

  const rows = await db
    .select({
      reservationId: tasksTable.reservationId,
      total: sql<number>`count(*)::int`,
      completed: sql<number>`sum(case when ${tasksTable.completed} then 1 else 0 end)::int`,
    })
    .from(tasksTable)
    .where(inArray(tasksTable.reservationId, ids))
    .groupBy(tasksTable.reservationId);

  const summaryMap = new Map(rows.map((r) => [r.reservationId, r]));

  const result = ids.map((id) => ({
    reservationId: id,
    total: summaryMap.get(id)?.total ?? 0,
    completed: summaryMap.get(id)?.completed ?? 0,
  }));

  res.json(result);
});

export default router;
