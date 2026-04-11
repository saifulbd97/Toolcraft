import { Router, type IRouter } from "express";
import healthRouter from "./health";
import pdfRouter from "./pdf";
import bgRemoveRouter from "./bg-remove";
import detectCornersRouter from "./detect-corners";

const router: IRouter = Router();

router.use(healthRouter);
router.use(pdfRouter);
router.use(bgRemoveRouter);
router.use(detectCornersRouter);

export default router;
