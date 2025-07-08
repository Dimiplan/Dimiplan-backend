/**
 * API 라우터 인덱스
 * @module apiRouter
 * @description /api 경로 아래의 모든 라우터 통합 관리
 */
import { Router } from "express";
import { isAuthenticated, isUserRegistered } from "../../middleware/auth.mjs";
import aiRouter from "./ai.mjs";
import plannerRouter from "./planner.mjs";
import taskRouter from "./task.mjs";
import userRouter from "./user.mjs";

/**
 * Express 라우터 인스턴스
 * @type {object}
 * @constant
 */
const router = Router();

router.use(isAuthenticated, isUserRegistered);

/**
 * 세부 라우터 등록
 * @description 각 기능별로 분리된 라우터를 /api 경로 하위에 마운트
 */
router.use("/user", userRouter); // 사용자 관련 API
router.use("/tasks", taskRouter); // 작업 관련 API
router.use("/planners", plannerRouter); // 플래너 관련 API
router.use("/ai", aiRouter); // AI 관련 API

export default router;
