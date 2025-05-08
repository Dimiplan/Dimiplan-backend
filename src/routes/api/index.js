/**
 * API 라우터 인덱스
 * /api 경로 아래의 모든 라우터 통합 관리
 */
const express = require("express");
const userRouter = require("./user");
const taskRouter = require("./task");
const plannerRouter = require("./planner");
const aiRouter = require("./ai");
const { isAuthenticated } = require("../../middleware/auth");

const router = express.Router();

// 모든 API 라우트에 인증 적용
router.use(isAuthenticated);

// 세부 라우터 등록
router.use("/user", userRouter);     // 사용자 관련 API
router.use("/task", taskRouter);      // 작업 관련 API
router.use("/planner", plannerRouter); // 플래너 관련 API
router.use("/ai", aiRouter);           // AI 관련 API

module.exports = router;
