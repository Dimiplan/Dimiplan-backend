/**
 * API 라우터 인덱스
 * /api 경로 아래의 모든 라우터 통합 관리
 */
import { Router } from "express";
import userRouter from "./user.mjs";
import taskRouter from "./task.mjs";
import plannerRouter from "./planner.mjs";
import aiRouter from "./ai.mjs";
import adminRouter from "./admin.mjs";
import { isAuthenticated } from "../../middleware/auth.mjs";

const router = Router();

// 모든 API 라우트에 인증 적용
router.use(isAuthenticated);

// 세부 라우터 등록
router.use("/user", userRouter); // 사용자 관련 API
router.use("/task", taskRouter); // 작업 관련 API
router.use("/planner", plannerRouter); // 플래너 관련 API
router.use("/ai", aiRouter); // AI 관련 API
router.use("/admin", adminRouter); // 관리자 관련 API

export default router;
