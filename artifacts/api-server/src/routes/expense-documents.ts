import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import { requireRole } from "../lib/roles";
import {
  createDocumentStorage,
  documentId,
  ExpenseDocuments,
} from "../lib/expense-documents";
import { DocumentError } from "../lib/expense-document-validation";
const router: IRouter = Router();
// Query actions deliberately reuse the collection URL: no nested Vercel adapter/function.
router.all(
  "/expenses",
  (req, res, next) => {
    if (req.query.documentAction === undefined) return next();
    return requireRole("admin", "staff")(req, res, next);
  },
  async (req, res, next): Promise<void> => {
    if (req.query.documentAction === undefined) {
      next();
      return;
    }
    res.set("Cache-Control", "no-store");
    try {
      const action = String(req.query.documentAction);
      const service = new ExpenseDocuments(
        pool,
        createDocumentStorage(req.get("authorization")!.slice(7)),
        res.locals.userId,
      );
      if (req.method === "GET") {
        if (action === "list") {
          res.json(await service.list(documentId(req.query.expenseId)));
          return;
        }
        if (action === "library") {
          res.json(
            await service.list(undefined, String(req.query.search ?? "")),
          );
          return;
        }
        if (action === "counts") {
          res.json(
            await service.counts(
              String(req.query.ids ?? "")
                .split(",")
                .filter(Boolean),
            ),
          );
          return;
        }
      }
      if (req.method === "POST") {
        if (action === "prepare") {
          res.json(
            await service.prepare(
              documentId(req.body.expenseId),
              req.body.metadata,
            ),
          );
          return;
        }
        if (action === "finalize") {
          res.json(
            await service.finalize(
              documentId(req.body.expenseId),
              documentId(req.body.documentId),
            ),
          );
          return;
        }
        if (action === "link") {
          res.json(
            await service.link(
              documentId(req.body.expenseId),
              documentId(req.body.documentId),
            ),
          );
          return;
        }
        if (action === "unlink") {
          res.json(
            await service.unlink(
              documentId(req.body.expenseId),
              documentId(req.body.documentId),
            ),
          );
          return;
        }
        if (action === "abort") {
          res.json(await service.abort(documentId(req.body.documentId)));
          return;
        }
        if (action === "cleanup") {
          await service.cleanup();
          res.json({ ok: true });
          return;
        }
      }
      res.status(400).json({ error: "Operação de comprovativo inválida." });
    } catch (error) {
      const code =
        typeof error === "object" && error !== null && "code" in error
          ? error.code
          : null;
      if (code === "42P01") {
        res
          .status(503)
          .json({
            error:
              "Os comprovativos aguardam a ativação da migration neste ambiente.",
          });
        return;
      }
      if (error instanceof DocumentError) {
        res.status(error.status).json({ error: error.message });
        return;
      }
      next(error);
    }
  },
);
export default router;
