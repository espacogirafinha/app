import { Router, type IRouter } from "express";
import reservationsRouter from "./reservations";
import dashboardRouter from "./dashboard";
import reportsRouter from "./reports";
import tasksRouter from "./tasks";

const router: IRouter = Router();

router.use(reservationsRouter);
router.use(dashboardRouter);
router.use(reportsRouter);
router.use(tasksRouter);

export default router;
