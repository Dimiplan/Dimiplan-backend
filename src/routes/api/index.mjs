/**
 * API 라우터 인덱스
 * @module apiRouter
 * @description /api 경로 아래의 모든 라우터 통합 관리
 */
import { Router } from "express";
import userRouter from "./user.mjs";
import taskRouter from "./task.mjs";
import plannerRouter from "./planner.mjs";
import aiRouter from "./ai.mjs";
import adminRouter from "./admin.mjs";
import { isAuthenticated } from "../../middleware/auth.mjs";

/**
 * Express 라우터 인스턴스
 * @type {Object}
 * @constant
 */
const router = Router();

/**
 * 모든 API 라우트에 인증 미들웨어 적용
 * @description 모든 /api/* 경로에 대해 사용자 인증을 요구합니다
 */
router.use(isAuthenticated);

/**
 * 세부 라우터 등록
 * @description 각 기능별로 분리된 라우터를 /api 경로 하위에 마운트
 */
router.use("/user", userRouter); // 사용자 관련 API
router.use("/task", taskRouter); // 작업 관련 API
router.use("/planner", plannerRouter); // 플래너 관련 API
router.use("/ai", aiRouter); // AI 관련 API
router.use("/admin", adminRouter); // 관리자 관련 API

export default router;
