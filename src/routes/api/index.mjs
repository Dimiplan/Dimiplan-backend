import { $ } from "bun";
import { Router } from "express";
import { isAuthenticated, isUserRegistered } from "../../middleware/auth.mjs";
import aiRouter from "./ai.mjs";
import plannerRouter from "./planner.mjs";
import taskRouter from "./task.mjs";
import userRouter from "./user.mjs";

const router = Router();

router.get("/update", async (req, res) => {
    await $`git pull`.nothrow();
    res.status(204).send();
});

router.use(isAuthenticated, isUserRegistered);

router.use("/user", userRouter);
router.use("/tasks", taskRouter);
router.use("/planners", plannerRouter);
router.use("/ai", aiRouter);

export default router;
