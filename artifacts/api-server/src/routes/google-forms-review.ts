import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { db, googleFormImportsTable } from "@workspace/db";
import { formatReviewImport } from "../integrations/google-forms-review";

const router: IRouter = Router();

// Mounted behind the application's ordinary bearer authentication.
router.get("/integrations/google-forms/review", async (_req, res): Promise<void> => {
  try {
    const rows = await db
      .select({
        id: googleFormImportsTable.id,
        submittedAt: googleFormImportsTable.submittedAt,
        status: googleFormImportsTable.status,
        errorMessage: googleFormImportsTable.errorMessage,
        venueEventId: googleFormImportsTable.venueEventId,
      })
      .from(googleFormImportsTable)
      .where(eq(googleFormImportsTable.needsReview, true))
      .orderBy(desc(googleFormImportsTable.submittedAt))
      .limit(100);
    res.json(rows.map(formatReviewImport));
  } catch {
    res.status(500).json({ error: "Unable to list imports for review" });
  }
});

export default router;
