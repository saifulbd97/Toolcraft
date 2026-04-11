import { Router, type IRouter } from "express";
import healthRouter from "./health";
import pdfRouter from "./pdf";
import bgRemoveRouter from "./bg-remove";

const router: IRouter = Router();

router.use(healthRouter);
router.use(pdfRouter);
router.use(bgRemoveRouter);

export default router;
