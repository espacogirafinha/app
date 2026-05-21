import { Router, type IRouter } from "express";
import reservationsRouter from "./reservations";
import dashboardRouter from "./dashboard";
import reportsRouter from "./reports";
import tasksRouter from "./tasks";
import venueEventsRouter from "./venue-events";
import externalEventsRouter from "./external-events";

const router: IRouter = Router();

router.use(reservationsRouter);
router.use(dashboardRouter);
router.use(reportsRouter);
router.use(tasksRouter);
router.use(venueEventsRouter);
router.use(externalEventsRouter);

export default router;
