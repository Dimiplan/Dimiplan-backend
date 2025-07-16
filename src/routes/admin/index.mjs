import { Router } from "express";
import { isAdmin } from "../../middleware/adminAuth.mjs";
import databaseRouter from "./database.mjs";
import docsRouter from "./docs.mjs";
import logsRouter from "./logs.mjs";
import statsRouter from "./stats.mjs";
import systemRouter from "./system.mjs";

const router = Router();

router.use(isAdmin);

router.use("/system", systemRouter);
router.use("/logs", logsRouter);
router.use("/database", databaseRouter);
router.use("/docs", docsRouter);
router.use("/stats", statsRouter);

export default router;
