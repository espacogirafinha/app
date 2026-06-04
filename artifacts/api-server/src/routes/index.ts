import { Router, type IRouter } from "express";
import reservationsRouter from "./reservations";
import dashboardRouter from "./dashboard";
import dashboardV2Router from "./dashboard-v2";
import calendarV2Router from "./calendar-v2";
import reportsV2Router from "./reports-v2";
import reportsRouter from "./reports";
import tasksRouter from "./tasks";
import venueEventsRouter from "./venue-events";
import externalEventsRouter from "./external-events";
import workshopsRouter from "./workshops";
import settingsCatalogsRouter from "./settings-catalogs";
import checklistsRouter from "./checklists";

const router: IRouter = Router();

router.use(reservationsRouter);
router.use(dashboardRouter);
router.use(dashboardV2Router);
router.use(calendarV2Router);
router.use(reportsV2Router);
router.use(reportsRouter);
router.use(tasksRouter);
router.use(venueEventsRouter);
router.use(externalEventsRouter);
router.use(workshopsRouter);
router.use(settingsCatalogsRouter);
router.use(checklistsRouter);

export default router;


