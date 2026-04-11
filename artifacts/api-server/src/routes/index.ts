import { Router, type IRouter } from "express";
import healthRouter from "./health";
import pdfRouter from "./pdf";
import authRouter from "./auth";

const router: IRouter = Router();

router.use(authRouter);
router.use(healthRouter);
router.use(pdfRouter);

export default router;
