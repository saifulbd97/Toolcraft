import { Router, type IRouter } from "express";
import healthRouter from "./health";
import pdfRouter from "./pdf";
import authRouter from "./auth";
import usersRouter from "./users";

const router: IRouter = Router();

router.use(authRouter);
router.use(healthRouter);
router.use(pdfRouter);
router.use(usersRouter);

export default router;
